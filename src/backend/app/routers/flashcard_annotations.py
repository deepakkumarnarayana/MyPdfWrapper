"""
Flashcard Annotations API Router

Simple, reliable API for PDF annotation processing optimized for flashcard generation.
Replaces complex annotation endpoints with a single, robust sync endpoint.

Key Features:
- Single endpoint for all annotation changes
- Hybrid immediate + background processing
- Flashcard-optimized text extraction and analysis
- Simple error handling and recovery
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from app.database import get_db
from app.models import PDF
from sqlalchemy import select
from app.services.flashcard_annotation_service import (
    FlashcardAnnotationService, 
    AnnotationSyncRequest, 
    AnnotationSyncResult
)

logger = logging.getLogger(__name__)


router = APIRouter(
    prefix="/documents/{document_id}/flashcard-annotations",
    tags=["flashcard-annotations"]
)


# Pydantic models for API
class PDFJSAnnotation(BaseModel):
    """PDF.js annotation data from frontend"""
    id: str
    clientId: str
    pageNumber: int
    text: str = ""
    coordinates: Dict[str, float]
    color: str = "#FFFF98"
    annotationType: str = "highlight"
    timestamp: str
    rawPDFJSData: Optional[Dict[str, Any]] = None


class FlashcardAnnotationSyncRequest(BaseModel):
    """Request to sync annotations for flashcard generation"""
    annotations: List[PDFJSAnnotation]
    changeType: str = Field(default="batch", description="added, deleted, modified, initial_load, batch")
    isInitialLoad: bool = False
    timestamp: str
    

class FlashcardAnnotationSyncResponse(BaseModel):
    """Response for annotation sync operation"""
    status: str
    immediate_saved_count: int
    background_processing_count: int
    errors: Optional[List[str]] = None
    message: str
    processing_details: Optional[Dict[str, Any]] = None


class AnnotationSummaryResponse(BaseModel):
    """Summary of annotations for a document"""
    document_id: int
    total_annotations: int
    processed_annotations: int
    flashcard_ready_count: int
    average_readiness_score: float
    annotations: List[Dict[str, Any]]


class FlashcardCandidate(BaseModel):
    """Annotation ready for flashcard generation"""
    id: int
    highlighted_text: str
    text_context: Dict[str, Any]
    flashcard_readiness_score: float
    suggested_question_types: List[str]
    page_number: int
    extraction_quality: str


@router.post("/sync", response_model=FlashcardAnnotationSyncResponse)
async def sync_flashcard_annotations(
    document_id: int,
    request: FlashcardAnnotationSyncRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user_id: int = 1  # TODO: Get from authentication
):
    """
    DUAL STORAGE SYNC: Save annotations to both PDF and Database.
    
    - PDF: For PDF.js display persistence (coordinates, visual)
    - Database: For RAG system (highlighted text, context, metadata)
    """
    logger.info(f"[DUAL_SYNC] 📥 Processing {len(request.annotations)} annotations for PDF + DB storage")
    
    try:
        # Get PDF file path
        result = await db.execute(
            select(PDF).where(
                PDF.id == document_id,
                PDF.user_id == user_id
            )
        )
        pdf = result.scalar_one_or_none()
        
        if not pdf:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Convert annotations to PDF service format (keep coordinates as nested dict)
        pdf_annotations = []
        for ann in request.annotations:
            pdf_annotations.append({
                "id": ann.clientId,
                "page_number": ann.pageNumber,
                "coordinates": ann.coordinates,  # Keep as nested dict for PDF service
                "annotation_type": ann.annotationType,
                "text": ann.text,
                "color": ann.color
            })
        
        # Save directly to PDF file using PDF service
        from app.services.pdf_service import PDFService
        pdf_service = PDFService()
        
        result = pdf_service.process_annotations_background(
            file_path=pdf.file_path,
            annotations=pdf_annotations
        )
        
        if result["status"] != "success":
            raise HTTPException(status_code=500, detail=f"PDF save failed: {result.get('error')}")
        
        logger.info(f"[DUAL_SYNC] ✅ PDF: Saved {result['processed_count']} annotations to PDF file")
        
        # 2. SAVE TO DATABASE - For RAG system (text content + context)
        service = FlashcardAnnotationService(db)
        db_saved_count = 0
        
        try:
            from app.flashcard_models import FlashcardAnnotation
            
            for ann in request.annotations:
                # Extract text content from PDF if available
                highlighted_text = ann.text or ""
                if not highlighted_text and pdf.file_path:
                    # Could extract text from PDF coordinates if needed
                    highlighted_text = f"Highlight on page {ann.pageNumber}"
                
                # Check if annotation already exists (UPSERT logic)
                existing = await db.execute(
                    select(FlashcardAnnotation).where(
                        FlashcardAnnotation.client_id == ann.clientId,
                        FlashcardAnnotation.pdf_id == document_id
                    )
                )
                existing_annotation = existing.scalar_one_or_none()
                
                if existing_annotation:
                    # UPDATE existing annotation
                    existing_annotation.highlighted_text = highlighted_text
                    existing_annotation.word_count = len(highlighted_text.split())
                    existing_annotation.annotation_data = {
                        "color": ann.color,
                        "type": ann.annotationType,
                        "timestamp": ann.timestamp
                    }
                    existing_annotation.flashcard_readiness_score = 0.5 if highlighted_text else 0.0
                    logger.debug(f"[DUAL_SYNC] Updated existing annotation: {ann.clientId}")
                else:
                    # INSERT new annotation
                    db_annotation = FlashcardAnnotation(
                        pdf_id=document_id,
                        user_id=user_id,
                        client_id=ann.clientId,
                        page_number=ann.pageNumber,
                        highlighted_text=highlighted_text,
                        context_level="sentence",
                        word_count=len(highlighted_text.split()),
                        # Store minimal annotation data as JSON (avoid complex nested objects)
                        annotation_data={
                            "color": ann.color,
                            "type": ann.annotationType,
                            "timestamp": ann.timestamp
                        },
                        flashcard_readiness_score=0.5 if highlighted_text else 0.0,
                        suggested_question_types=["definition"] if highlighted_text else [],
                        extraction_quality="pending"
                    )
                    db.add(db_annotation)
                    logger.debug(f"[DUAL_SYNC] Created new annotation: {ann.clientId}")
                
                db_saved_count += 1
            
            await db.commit()
            logger.info(f"[DUAL_SYNC] ✅ DB: Processed {db_saved_count} annotations for RAG processing")
            
        except Exception as e:
            logger.error(f"[DUAL_SYNC] ❌ DB save failed: {e}")
            await db.rollback()
            # Continue - PDF save succeeded, DB is secondary for RAG
        
        return FlashcardAnnotationSyncResponse(
            status="success",
            immediate_saved_count=result["processed_count"],
            background_processing_count=db_saved_count,
            errors=result.get("errors", []),
            message=f"Dual save: {result['processed_count']} to PDF, {db_saved_count} to DB for RAG",
            processing_details={
                "pdf_save_result": result,
                "db_saved_for_rag": db_saved_count
            }
        )
        
    except Exception as e:
        logger.error(f"[DUAL_SYNC] ❌ Error: {e}")
        raise HTTPException(status_code=500, detail=f"Dual sync failed: {str(e)}")


# Remove the old complex background processing functions
async def process_annotations_background_DISABLED():
    """DISABLED - Using direct PDF save approach instead"""
    pass


    """DISABLED - Using direct PDF save approach instead"""
    pass


@router.get("/summary", response_model=AnnotationSummaryResponse)
async def get_annotation_summary(
    document_id: int,
    include_annotations: bool = True,
    db: AsyncSession = Depends(get_db),
    user_id: int = 1
):
    """Get comprehensive summary of annotations for flashcard generation"""
    
    try:
        service = FlashcardAnnotationService(db)
        
        # Get all annotations for the document
        annotations = await service.get_annotations_for_document(
            document_id=document_id,
            user_id=user_id,
            include_processing_status=True
        )
        
        # Calculate summary statistics
        total_annotations = len(annotations)
        processed_annotations = len([a for a in annotations if a.get("processed_at")])
        flashcard_ready = len([
            a for a in annotations 
            if a.get("flashcard_readiness_score", 0) >= 0.5 and a.get("processed_at")
        ])
        
        average_score = 0.0
        if processed_annotations > 0:
            scores = [a.get("flashcard_readiness_score", 0) for a in annotations if a.get("processed_at")]
            average_score = sum(scores) / len(scores)
        
        return AnnotationSummaryResponse(
            document_id=document_id,
            total_annotations=total_annotations,
            processed_annotations=processed_annotations,
            flashcard_ready_count=flashcard_ready,
            average_readiness_score=average_score,
            annotations=annotations if include_annotations else []
        )
        
    except Exception as e:
        logger.error(f"[FLASHCARD_API] Error getting annotation summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/candidates", response_model=List[FlashcardCandidate])
async def get_flashcard_candidates(
    document_id: int,
    min_readiness_score: float = 0.5,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    user_id: int = 1
):
    """Get annotations ranked by flashcard generation potential"""
    
    try:
        service = FlashcardAnnotationService(db)
        
        candidates = await service.get_flashcard_candidates(
            document_id=document_id,
            user_id=user_id,
            min_readiness_score=min_readiness_score
        )
        
        # Convert to response format and limit results
        response_candidates = []
        for candidate in candidates[:limit]:
            response_candidates.append(FlashcardCandidate(
                id=candidate["id"],
                highlighted_text=candidate["highlighted_text"],
                text_context=candidate["text_context"],
                flashcard_readiness_score=candidate["flashcard_readiness_score"],
                suggested_question_types=candidate["suggested_question_types"],
                page_number=candidate["page_number"],
                extraction_quality=candidate["extraction_quality"]
            ))
        
        logger.info(f"[FLASHCARD_API] Found {len(response_candidates)} candidates for document {document_id}")
        return response_candidates
        
    except Exception as e:
        logger.error(f"[FLASHCARD_API] Error getting flashcard candidates: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/save-to-pdf")
async def save_annotations_to_pdf(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = 1
):
    """Save current annotations to the actual PDF file for persistence across refreshes"""
    
    try:
        service = FlashcardAnnotationService(db)
        
        # Get the PDF document information
        pdf = await service._get_document(document_id, user_id)
        if not pdf:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Get all current annotations
        annotations = await service.get_annotations_for_document(
            document_id=document_id,
            user_id=user_id,
            include_processing_status=False
        )
        
        if not annotations:
            return {
                "status": "success",
                "message": "No annotations to save to PDF",
                "saved_count": 0
            }
        
        # Use the local PDF service for PDF-level saving
        from app.services.pdf_service import PDFService
        pdf_service = PDFService()
        
        # Convert annotations to the format expected by PDF service
        annotation_dicts = []
        for annotation in annotations:
            # Extract the PDF.js data from our annotation
            pdfjs_data = annotation.get("annotation_data", {}).get("pdfjs_data", {})
            coordinates = pdfjs_data.get("coordinates", {})
            
            annotation_dicts.append({
                "id": annotation["client_id"],
                "page_number": annotation["page_number"],  # Keep 1-based, PDF service will convert to 0-based
                "text": annotation["highlighted_text"],
                "x_coordinate": coordinates.get("x", 0),
                "y_coordinate": coordinates.get("y", 0),
                "width": coordinates.get("width", 100),
                "height": coordinates.get("height", 20),
                "color": pdfjs_data.get("color", "#FFFF98"),
                "annotation_type": "highlight",
                "note": "",
                "rawPDFJSData": pdfjs_data
            })
        
        # Save annotations to PDF file using local service
        result = pdf_service.process_annotations_background(
            file_path=pdf.file_path,
            annotations=annotation_dicts
        )
        
        logger.info(f"[FLASHCARD_API] ✅ Saved {len(annotation_dicts)} annotations to PDF file: {result}")
        
        return {
            "status": "success",
            "message": f"Saved {len(annotation_dicts)} annotations to PDF file",
            "saved_count": len(annotation_dicts),
            "result": result
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLASHCARD_API] Error saving annotations to PDF: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save annotations to PDF: {str(e)}")


@router.post("/delete-from-pdf")
async def delete_annotation_from_pdf_only(
    document_id: int,
    request: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user_id: int = 1
):
    """Delete specific annotation from PDF file only (keeps database record for RAG/flashcards)"""
    
    try:
        service = FlashcardAnnotationService(db)
        
        # Get the PDF document information
        pdf = await service._get_document(document_id, user_id)
        if not pdf:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Extract annotation details from request
        annotation_to_delete = request.get('annotation', {})
        if not annotation_to_delete:
            raise HTTPException(status_code=400, detail="Annotation data required")
        
        # Use the local PDF service for individual deletion
        from app.services.pdf_service import PDFService
        pdf_service = PDFService()
        
        # Delete from PDF file only
        result = pdf_service.delete_individual_annotation_from_pdf(
            file_path=pdf.file_path,
            target_annotation=annotation_to_delete
        )
        
        if result["status"] == "success":
            logger.info(f"[FLASHCARD_API] ✅ Individual annotation deletion from PDF: {result}")
            
            return {
                "status": "success",
                "pdf_updated": result["deleted"],
                "message": result["message"],
                "deleted_details": result.get("deleted_details"),
                "database_unchanged": True  # Annotation stays in database
            }
        else:
            logger.error(f"[FLASHCARD_API] ❌ Individual deletion failed: {result}")
            raise HTTPException(status_code=500, detail=f"PDF deletion failed: {result.get('error')}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLASHCARD_API] Error with individual PDF deletion: {e}")
        raise HTTPException(status_code=500, detail=f"Individual deletion failed: {str(e)}")


@router.delete("/clear")
async def clear_all_annotations(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = 1
):
    """Clear all annotations for a document (useful for testing)"""
    
    try:
        service = FlashcardAnnotationService(db)
        
        # Use sync with empty annotations list to clear all
        sync_request = AnnotationSyncRequest(
            annotations=[],
            change_type="clear_all",
            document_id=document_id,
            timestamp=datetime.utcnow().isoformat()
        )
        
        result = await service.sync_annotations(sync_request, user_id=user_id)
        
        if not result.success:
            raise HTTPException(status_code=500, detail=result.message)
        
        return {"status": "success", "message": "All annotations cleared"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[FLASHCARD_API] Error clearing annotations: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Background processing functions
async def save_annotations_to_pdf_background(document_id: int, user_id: int):
    """
    Background task to save annotations to PDF file automatically.
    This ensures annotations persist across browser refreshes.
    """
    logger.info(f"[BACKGROUND_PDF_SAVE] Starting PDF save for document {document_id}")
    
    try:
        # Create a new database session for background processing
        from app.database import get_db
        async for db in get_db():
            service = FlashcardAnnotationService(db)
            
            # Get the PDF document information
            pdf = await service._get_document(document_id, user_id)
            if not pdf:
                logger.error(f"[BACKGROUND_PDF_SAVE] Document {document_id} not found")
                return
            
            # Get all current annotations
            annotations = await service.get_annotations_for_document(
                document_id=document_id,
                user_id=user_id,
                include_processing_status=False
            )
            
            if not annotations:
                logger.info(f"[BACKGROUND_PDF_SAVE] No annotations found for document {document_id} - clearing PDF annotations")
                # Still call PDF service with empty array to clear existing annotations from PDF
                annotations = []  # Empty array will clear all annotations from PDF
            
            # Use the local PDF service for PDF-level saving
            from app.services.pdf_service import PDFService
            pdf_service = PDFService()
            
            # Convert annotations to the format expected by PDF service
            annotation_dicts = []
            for annotation in annotations:
                # Extract coordinates and data from our annotation structure
                annotation_data = annotation.get("annotation_data", {})
                
                # Our data stores coordinates directly in annotation_data
                coordinates = annotation_data.get("coordinates", {})
                raw_pdfjs_data = annotation_data.get("rawPDFJSData", {})
                
                annotation_dicts.append({
                    "id": annotation.get("client_id", ""),
                    "page_number": annotation.get("page_number", 1),  # Keep 1-based, PDF service will convert
                    "text": annotation.get("highlighted_text", ""),
                    "x_coordinate": coordinates.get("x", 0),
                    "y_coordinate": coordinates.get("y", 0),
                    "width": coordinates.get("width", 100),
                    "height": coordinates.get("height", 20),
                    "color": annotation_data.get("color", "#FFFF98"),
                    "annotation_type": annotation_data.get("annotationType", "highlight"),
                    "note": "",
                    "rawPDFJSData": raw_pdfjs_data
                })
            
            # Always save annotations to PDF file (empty array will clear all annotations)
            result = pdf_service.process_annotations_background(
                file_path=pdf.file_path,
                annotations=annotation_dicts
            )
            
            logger.info(f"[BACKGROUND_PDF_SAVE] ✅ Saved {len(annotation_dicts)} annotations to PDF file: {result}")
            break  # Exit after first (and only) db session
        
    except Exception as e:
        logger.error(f"[BACKGROUND_PDF_SAVE] ❌ Failed for document {document_id}: {e}")


async def process_annotations_background(document_id: int, user_id: int):
    """
    Background task for enhanced annotation processing.
    This processes all unprocessed annotations to extract high-quality text and context.
    """
    logger.info(f"[BACKGROUND_PROCESSING] Starting enhanced processing for document {document_id}")
    
    try:
        # Create a new database session for background processing
        from app.database import get_db
        async for db in get_db():
            service = FlashcardAnnotationService(db)
            
            # Get the PDF file path
            pdf = await service._get_document(document_id, user_id)
            if not pdf:
                logger.error(f"[BACKGROUND_PROCESSING] Document {document_id} not found")
                return
            
            # Process all unprocessed annotations for this document
            await service.process_all_annotations_for_document(
                document_id=document_id,
                pdf_file_path=pdf.file_path
            )
            
            break  # Exit after first (and only) db session
        
        logger.info(f"[BACKGROUND_PROCESSING] ✅ Enhanced processing completed for document {document_id}")
        
    except Exception as e:
        logger.error(f"[BACKGROUND_PROCESSING] ❌ Failed for document {document_id}: {e}")


# Health check endpoint
@router.get("/health")
async def health_check():
    """Health check for flashcard annotation system"""
    return {
        "status": "healthy",
        "system": "flashcard-annotations",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }