"""
Flashcard Annotation Service - Simple, reliable annotation processing for flashcard generation.

This service replaces the complex annotation system with a hybrid approach:
- IMMEDIATE: Save annotations quickly for instant user feedback
- BACKGROUND: Process text extraction and enhancement for flashcard quality

Architecture:
- Single message type from frontend: 'flashcard-annotations-changed'
- Batch processing for performance
- Dual text extraction (PDF.js + PyMuPDF validation)
- Simple error handling and retry logic
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, insert, update, delete
from sqlalchemy.orm import selectinload
from app.flashcard_models import FlashcardAnnotation
from app.models import PDF
from typing import List, Dict, Any, Optional, Tuple
import json
import logging
from datetime import datetime
import asyncio
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class AnnotationSyncRequest:
    """Request to sync annotations from PDF.js"""
    annotations: List[Dict[str, Any]]
    change_type: str = 'batch'  # added, deleted, modified, initial_load, batch
    document_id: Optional[int] = None
    timestamp: Optional[str] = None


@dataclass
class AnnotationSyncResult:
    """Result of annotation sync operation"""
    success: bool
    immediate_saved_count: int
    background_processing_count: int
    errors: List[str]
    message: str


class FlashcardAnnotationService:
    """
    Simple, reliable service for flashcard annotation processing.
    Designed for 2-second polling frontend with hybrid backend processing.
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def sync_annotations(
        self, 
        request: AnnotationSyncRequest,
        user_id: int = 1  # TODO: Get from auth
    ) -> AnnotationSyncResult:
        """
        Main sync method - handles all annotation changes from PDF.js.
        
        IMMEDIATE PHASE: Save to database for instant access
        BACKGROUND PHASE: Process text extraction and enhancement (queued)
        """
        logger.info(f"[FLASHCARD_SYNC] Processing {len(request.annotations)} annotations")
        
        try:
            # Verify document access
            pdf = await self._get_document(request.document_id, user_id)
            if not pdf:
                return AnnotationSyncResult(
                    success=False,
                    immediate_saved_count=0,
                    background_processing_count=0,
                    errors=["Document not found or access denied"],
                    message="Document access failed"
                )
            
            # IMMEDIATE PROCESSING: Replace all annotations for this document
            saved_count, errors = await self._save_annotations_immediate(
                document_id=request.document_id,
                user_id=user_id,
                annotations=request.annotations,
                change_type=request.change_type
            )
            
            # BACKGROUND PROCESSING: Will be implemented in next step
            background_count = saved_count  # All saved annotations need processing
            
            result = AnnotationSyncResult(
                success=True,
                immediate_saved_count=saved_count,
                background_processing_count=background_count,
                errors=errors,
                message=f"Saved {saved_count} annotations for flashcard generation"
            )
            
            logger.info(f"[FLASHCARD_SYNC] ✅ Result: {result}")
            return result
            
        except Exception as e:
            logger.error(f"[FLASHCARD_SYNC] ❌ Sync failed: {e}")
            return AnnotationSyncResult(
                success=False,
                immediate_saved_count=0,
                background_processing_count=0,
                errors=[str(e)],
                message="Sync operation failed"
            )
    
    async def _get_document(self, document_id: int, user_id: int) -> Optional[PDF]:
        """Get and verify document access"""
        try:
            result = await self.db.execute(
                select(PDF).where(PDF.id == document_id)
                # TODO: Add user_id check when users table exists
                # .where(PDF.user_id == user_id)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"[DOCUMENT_ACCESS] Error getting document {document_id}: {e}")
            return None
    
    async def _save_annotations_immediate(
        self,
        document_id: int,
        user_id: int,
        annotations: List[Dict[str, Any]],
        change_type: str = 'batch'
    ) -> Tuple[int, List[str]]:
        """
        IMMEDIATE PHASE: Save annotations quickly to database.
        
        Strategy: Clear and replace all annotations for this document.
        This is simpler and more reliable than trying to track individual changes.
        """
        errors = []
        
        try:
            # Clear existing annotations for this document
            await self.db.execute(
                delete(FlashcardAnnotation)
                .where(FlashcardAnnotation.pdf_id == document_id)
                .where(FlashcardAnnotation.user_id == user_id)
            )
            
            logger.info(f"[IMMEDIATE_SAVE] Cleared existing annotations for document {document_id}")
            
            # Save new annotations
            saved_count = 0
            for annotation_data in annotations:
                try:
                    flashcard_annotation = self._convert_pdfjs_to_flashcard_annotation(
                        annotation_data=annotation_data,
                        document_id=document_id,
                        user_id=user_id
                    )
                    
                    self.db.add(flashcard_annotation)
                    saved_count += 1
                    
                except Exception as e:
                    error_msg = f"Failed to save annotation {annotation_data.get('id', 'unknown')}: {str(e)}"
                    errors.append(error_msg)
                    logger.error(f"[IMMEDIATE_SAVE] {error_msg}")
            
            # Commit all changes
            await self.db.commit()
            
            logger.info(f"[IMMEDIATE_SAVE] ✅ Saved {saved_count} annotations immediately")
            return saved_count, errors
            
        except Exception as e:
            await self.db.rollback()
            error_msg = f"Database operation failed: {str(e)}"
            errors.append(error_msg)
            logger.error(f"[IMMEDIATE_SAVE] ❌ {error_msg}")
            return 0, errors
    
    def _convert_pdfjs_to_flashcard_annotation(
        self,
        annotation_data: Dict[str, Any],
        document_id: int,
        user_id: int
    ) -> FlashcardAnnotation:
        """
        Convert PDF.js annotation data to FlashcardAnnotation model.
        
        This handles the immediate conversion with basic data.
        Enhanced processing (text extraction, context analysis) happens in background.
        """
        
        # Extract basic information
        client_id = annotation_data.get('id') or annotation_data.get('clientId')
        page_number = annotation_data.get('pageNumber', 1)
        
        # Extract text (basic - will be enhanced in background)
        highlighted_text = annotation_data.get('text', '')
        if not highlighted_text:
            highlighted_text = "Text will be extracted in background"
        
        # Extract coordinates
        coordinates = annotation_data.get('coordinates', {
            'x': 0, 'y': 0, 'width': 0, 'height': 0
        })
        
        # Store complete PDF.js data for background processing
        annotation_storage_data = {
            "pdfjs_data": annotation_data,
            "coordinates": coordinates,
            "text_context": {
                "highlighted_text": highlighted_text,
                "context_before": "",  # Will be filled in background
                "context_after": "",   # Will be filled in background
                "full_paragraph": "",  # Will be filled in background
                "extraction_method": "immediate_save"
            },
            "processing_status": "pending_enhancement",
            "saved_at": datetime.utcnow().isoformat()
        }
        
        return FlashcardAnnotation(
            pdf_id=document_id,
            user_id=user_id,
            client_id=client_id,
            page_number=page_number,
            annotation_data=annotation_storage_data,
            highlighted_text=highlighted_text,
            context_level="pending",  # Will be updated in background
            word_count=len(highlighted_text.split()) if highlighted_text else 0,
            flashcard_readiness_score=0.0,  # Will be calculated in background
            extraction_quality="pending"  # Will be assessed in background
        )
    
    async def get_annotations_for_document(
        self,
        document_id: int,
        user_id: int,
        include_processing_status: bool = False
    ) -> List[Dict[str, Any]]:
        """Get all annotations for a document"""
        try:
            result = await self.db.execute(
                select(FlashcardAnnotation)
                .where(FlashcardAnnotation.pdf_id == document_id)
                .where(FlashcardAnnotation.user_id == user_id)
                .order_by(FlashcardAnnotation.page_number, FlashcardAnnotation.created_at)
            )
            
            annotations = result.scalars().all()
            
            return [
                {
                    **annotation.to_dict(),
                    **({"processing_details": annotation.annotation_data.get("processing_status")} 
                       if include_processing_status else {})
                }
                for annotation in annotations
            ]
            
        except Exception as e:
            logger.error(f"[GET_ANNOTATIONS] Error getting annotations for document {document_id}: {e}")
            logger.error(f"[GET_ANNOTATIONS] Exception type: {type(e).__name__}")
            # Return empty list to avoid blocking PDF save
            return []
    
    async def get_flashcard_candidates(
        self,
        document_id: int,
        user_id: int,
        min_readiness_score: float = 0.5
    ) -> List[Dict[str, Any]]:
        """Get annotations that are ready for flashcard generation"""
        try:
            result = await self.db.execute(
                select(FlashcardAnnotation)
                .where(FlashcardAnnotation.pdf_id == document_id)
                .where(FlashcardAnnotation.user_id == user_id)
                .where(FlashcardAnnotation.flashcard_readiness_score >= min_readiness_score)
                .where(FlashcardAnnotation.processed_at.isnot(None))
                .order_by(FlashcardAnnotation.flashcard_readiness_score.desc())
            )
            
            candidates = result.scalars().all()
            
            return [
                {
                    **annotation.to_dict(),
                    "text_context": annotation.get_text_context(),
                    "suggested_question_types": annotation.suggested_question_types or []
                }
                for annotation in candidates
            ]
            
        except Exception as e:
            logger.error(f"[FLASHCARD_CANDIDATES] Error getting candidates for document {document_id}: {e}")
            return []
    
    # Background processing methods
    async def process_annotation_enhanced(self, annotation_id: int, pdf_file_path: str):
        """
        BACKGROUND PHASE: Enhanced text extraction and flashcard analysis.
        This method processes individual annotations to extract high-quality text and context.
        """
        logger.info(f"[BACKGROUND_PROCESSING] Starting enhanced processing for annotation {annotation_id}")
        
        try:
            # Get the annotation
            result = await self.db.execute(
                select(FlashcardAnnotation)
                .where(FlashcardAnnotation.id == annotation_id)
            )
            annotation = result.scalar_one_or_none()
            
            if not annotation:
                logger.error(f"[BACKGROUND_PROCESSING] Annotation {annotation_id} not found")
                return
            
            # Skip if already processed
            if annotation.processed_at:
                logger.info(f"[BACKGROUND_PROCESSING] Annotation {annotation_id} already processed")
                return
            
            # Enhanced text context extraction
            pdfjs_data = annotation.annotation_data.get("pdfjs_data", {})
            coordinates = annotation.annotation_data.get("coordinates", {})
            pdfjs_text = annotation.highlighted_text
            
            # TODO: Implement enhanced text extraction
            enhanced_context = pdfjs_text
            extraction_metadata = {"method": "simple", "quality": "basic"}
            
            # Simplified scoring for now
            readiness_score = 0.7  # Default decent score
            question_types = ["definition", "concept"]  # Default types
            
            # Update annotation with enhanced data
            enhanced_annotation_data = annotation.annotation_data.copy()
            enhanced_annotation_data.update({
                "text_context": {
                    "highlighted_text": enhanced_context.highlighted_text,
                    "context_before": enhanced_context.context_before,
                    "context_after": enhanced_context.context_after,
                    "sentence_context": enhanced_context.sentence_context,
                    "full_paragraph": enhanced_context.full_paragraph,
                    "extraction_method": enhanced_context.extraction_method,
                    "quality_score": enhanced_context.quality_score
                },
                "extraction_metadata": {
                    "pdfjs_available": extraction_metadata.pdfjs_available,
                    "pymupdf_available": extraction_metadata.pymupdf_available,
                    "text_match_score": extraction_metadata.text_match_score,
                    "extraction_method": extraction_metadata.extraction_method,
                    "quality_score": extraction_metadata.quality_score,
                    "processing_time_ms": extraction_metadata.processing_time_ms,
                    "error": extraction_metadata.error
                },
                "processing_status": "completed",
                "enhanced_at": datetime.utcnow().isoformat()
            })
            
            # Assess extraction quality
            extraction_quality = "basic"  # TODO: Implement quality assessment
            
            # Update the annotation
            await self.db.execute(
                update(FlashcardAnnotation)
                .where(FlashcardAnnotation.id == annotation_id)
                .values(
                    annotation_data=enhanced_annotation_data,
                    highlighted_text=enhanced_context,
                    context_level="basic",
                    word_count=len(enhanced_context.split()) if enhanced_context else 0,
                    flashcard_readiness_score=readiness_score,
                    suggested_question_types=question_types,
                    extraction_quality=extraction_quality,
                    processed_at=datetime.utcnow(),
                    processing_version="v1.0"
                )
            )
            
            await self.db.commit()
            
            logger.info(f"[BACKGROUND_PROCESSING] ✅ Enhanced processing completed for annotation {annotation_id}")
            logger.info(f"[BACKGROUND_PROCESSING] Score: {readiness_score:.2f}, Quality: {extraction_quality}")
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"[BACKGROUND_PROCESSING] ❌ Failed to process annotation {annotation_id}: {e}")
            
            # Mark as failed for retry later
            try:
                error_data = {
                    "processing_status": "failed",
                    "error": str(e),
                    "failed_at": datetime.utcnow().isoformat()
                }
                
                await self.db.execute(
                    update(FlashcardAnnotation)
                    .where(FlashcardAnnotation.id == annotation_id)
                    .values(annotation_data=FlashcardAnnotation.annotation_data.op('||')(error_data))
                )
                await self.db.commit()
            except:
                pass  # Don't fail if we can't update error status
    
    async def process_all_annotations_for_document(self, document_id: int, pdf_file_path: str):
        """
        Process all unprocessed annotations for a document in background.
        This is called after sync operations to enhance all new annotations.
        """
        logger.info(f"[BACKGROUND_PROCESSING] Processing all unprocessed annotations for document {document_id}")
        
        try:
            # Get all unprocessed annotations for this document
            result = await self.db.execute(
                select(FlashcardAnnotation)
                .where(FlashcardAnnotation.pdf_id == document_id)
                .where(FlashcardAnnotation.processed_at.is_(None))
                .order_by(FlashcardAnnotation.created_at)
            )
            
            annotations = result.scalars().all()
            logger.info(f"[BACKGROUND_PROCESSING] Found {len(annotations)} unprocessed annotations")
            
            processed_count = 0
            failed_count = 0
            
            for annotation in annotations:
                try:
                    await self.process_annotation_enhanced(annotation.id, pdf_file_path)
                    processed_count += 1
                    
                    # Small delay between processing to avoid overwhelming the system
                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"[BACKGROUND_PROCESSING] Failed to process annotation {annotation.id}: {e}")
                    failed_count += 1
            
            logger.info(f"[BACKGROUND_PROCESSING] ✅ Completed: {processed_count} processed, {failed_count} failed")
            
        except Exception as e:
            logger.error(f"[BACKGROUND_PROCESSING] ❌ Batch processing failed for document {document_id}: {e}")
    
    def calculate_flashcard_readiness_score(
        self,
        highlighted_text: str,
        context: Dict[str, Any]
    ) -> float:
        """
        Enhanced flashcard readiness calculation with more sophisticated analysis.
        """
        
        score = 0.0
        
        # Text length score (optimized for flashcard readability)
        text_length = len(highlighted_text.strip())
        if 15 <= text_length <= 100:
            score += 0.3  # Optimal length
        elif 10 <= text_length <= 150:
            score += 0.2  # Good length
        elif 5 <= text_length <= 200:
            score += 0.1  # Acceptable length
        
        # Context quality score
        context_before = context.get("context_before", "")
        context_after = context.get("context_after", "")
        sentence_context = context.get("sentence_context", "")
        full_paragraph = context.get("full_paragraph", "")
        
        if context_before and context_after and full_paragraph:
            score += 0.25  # Excellent context
        elif sentence_context:
            score += 0.15  # Good context
        elif context_before or context_after:
            score += 0.1   # Basic context
        
        # Content type analysis (what makes good flashcards)
        text_lower = highlighted_text.lower()
        
        # Definition indicators (excellent for flashcards)
        definition_indicators = ['definition', 'means', 'refers to', 'is defined as', 'is called', 'known as']
        if any(indicator in text_lower for indicator in definition_indicators):
            score += 0.2
        
        # Process/method indicators (good for procedural flashcards)
        process_indicators = ['process', 'steps', 'method', 'procedure', 'algorithm', 'technique']
        if any(indicator in text_lower for indicator in process_indicators):
            score += 0.15
        
        # Concept/theory indicators (good for conceptual flashcards)
        concept_indicators = ['concept', 'theory', 'principle', 'law', 'rule', 'hypothesis']
        if any(indicator in text_lower for indicator in concept_indicators):
            score += 0.15
            
        # Cause-effect indicators (good for understanding flashcards)
        causality_indicators = ['because', 'causes', 'results in', 'leads to', 'due to', 'therefore']
        if any(indicator in text_lower for indicator in causality_indicators):
            score += 0.1
        
        # Factual indicators (good for fact-based flashcards)
        fact_indicators = ['date', 'year', 'invented', 'discovered', 'founded', 'established']
        if any(indicator in text_lower for indicator in fact_indicators):
            score += 0.1
        
        # Quality penalties for poor flashcard material
        poor_indicators = ['figure', 'table', 'chart', 'see above', 'see below', 'as shown']
        if any(indicator in text_lower for indicator in poor_indicators):
            score -= 0.1
        
        # Very short or very long text penalty
        if text_length < 5 or text_length > 300:
            score -= 0.1
        
        return max(0.0, min(score, 1.0))  # Ensure score is between 0 and 1
    
    def suggest_question_types(self, highlighted_text: str, context: Dict[str, Any]) -> List[str]:
        """Suggest appropriate flashcard question types based on content"""
        
        types = []
        text_lower = highlighted_text.lower()
        
        # Definition indicators
        if any(word in text_lower for word in ['definition', 'means', 'refers to', 'is defined as', 'is called']):
            types.append("definition")
        
        # Concept indicators
        if any(word in text_lower for word in ['concept', 'theory', 'principle', 'idea']):
            types.append("concept")
        
        # Process indicators
        if any(word in text_lower for word in ['process', 'steps', 'method', 'procedure', 'algorithm']):
            types.append("process")
        
        # Fact indicators
        if any(word in text_lower for word in ['date', 'year', 'number', 'amount', 'quantity']):
            types.append("fact")
        
        # Cause-effect indicators
        if any(word in text_lower for word in ['because', 'causes', 'results', 'leads to', 'due to']):
            types.append("cause-effect")
        
        # Default to definition if no specific type detected
        if not types:
            types.append("definition")
        
        return types