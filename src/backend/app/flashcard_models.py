"""
Flashcard-optimized annotation models for reliable PDF highlight processing.
Replaces the complex annotation system with a simple, JSON-flexible approach.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
from typing import Dict, Any, List, Optional
from datetime import datetime
import json


class FlashcardAnnotation(Base):
    """
    Enhanced annotation model optimized for flashcard generation.
    Uses flexible JSON storage while maintaining queryable fields for performance.
    """
    __tablename__ = "flashcard_annotations"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)  # Will add FK when users table exists
    client_id = Column(String, unique=True, index=True)  # PDF.js client identifier
    page_number = Column(Integer, nullable=False, index=True)
    
    # Core data (JSON for flexibility, extracted fields for performance)
    annotation_data = Column(JSON, nullable=False)  # Complete annotation + context
    highlighted_text = Column(Text, nullable=False, index=True)
    context_level = Column(String, default="sentence", index=True)
    word_count = Column(Integer, default=0)
    
    # Flashcard generation metadata
    flashcard_readiness_score = Column(Float, default=0.0, index=True)
    suggested_question_types = Column(JSON)  # ["definition", "concept"]
    extraction_quality = Column(String, default="pending")  # pending, high, medium, low
    
    # Processing tracking
    processed_at = Column(DateTime, nullable=True, index=True)
    processing_version = Column(String, default="v1.0")
    
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships (will be added once PDF model is properly imported)
    # pdf = relationship("PDF", back_populates="flashcard_annotations")
    generated_flashcards = relationship("GeneratedFlashcard", back_populates="annotation", cascade="all, delete-orphan")
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        # Handle potentially corrupted JSON data
        annotation_data = self.annotation_data
        if annotation_data is None:
            annotation_data = {}
        elif isinstance(annotation_data, str):
            try:
                annotation_data = json.loads(annotation_data)
            except json.JSONDecodeError:
                annotation_data = {"error": "corrupted_json_data"}
        
        return {
            "id": self.id,
            "pdf_id": self.pdf_id,
            "user_id": self.user_id,
            "client_id": self.client_id,
            "page_number": self.page_number,
            "highlighted_text": self.highlighted_text,
            "context_level": self.context_level,
            "word_count": self.word_count,
            "flashcard_readiness_score": self.flashcard_readiness_score,
            "suggested_question_types": self.suggested_question_types,
            "extraction_quality": self.extraction_quality,
            "processed_at": self.processed_at.isoformat() if self.processed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "annotation_data": annotation_data
        }
    
    def get_text_context(self) -> Dict[str, Any]:
        """Extract text context from annotation data"""
        return self.annotation_data.get("text_context", {
            "highlighted_text": self.highlighted_text,
            "context_before": "",
            "context_after": "",
            "sentence_context": "",
            "full_paragraph": ""
        })
    
    def is_ready_for_flashcard_generation(self, min_score: float = 0.5) -> bool:
        """Check if annotation is ready for flashcard generation"""
        return (
            self.flashcard_readiness_score >= min_score and
            self.extraction_quality in ["high", "medium"] and
            self.processed_at is not None and
            len(self.highlighted_text.strip()) > 10
        )


class GeneratedFlashcard(Base):
    """
    AI-generated flashcards from annotations with study tracking.
    Future enhancement for spaced repetition learning system.
    """
    __tablename__ = "generated_flashcards"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    annotation_id = Column(Integer, ForeignKey("flashcard_annotations.id"), nullable=False, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    
    # Flashcard content
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    question_type = Column(String, default="definition", index=True)  # definition, concept, process, fact
    difficulty_level = Column(String, default="medium")   # easy, medium, hard
    
    # Context and source
    source_context = Column(JSON)  # Original annotation context
    generation_method = Column(String, default="ai")  # ai, manual, template
    confidence_score = Column(Float, default=0.0)
    
    # Study tracking
    times_reviewed = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    last_reviewed = Column(DateTime, nullable=True)
    next_review = Column(DateTime, nullable=True, index=True)
    retention_rate = Column(Float, default=0.0)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    annotation = relationship("FlashcardAnnotation", back_populates="generated_flashcards")
    # pdf = relationship("PDF")  # Will be added when PDF model is properly available
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API responses"""
        return {
            "id": self.id,
            "annotation_id": self.annotation_id,
            "pdf_id": self.pdf_id,
            "user_id": self.user_id,
            "question": self.question,
            "answer": self.answer,
            "question_type": self.question_type,
            "difficulty_level": self.difficulty_level,
            "generation_method": self.generation_method,
            "confidence_score": self.confidence_score,
            "times_reviewed": self.times_reviewed,
            "correct_answers": self.correct_answers,
            "retention_rate": self.retention_rate,
            "last_reviewed": self.last_reviewed.isoformat() if self.last_reviewed else None,
            "next_review": self.next_review.isoformat() if self.next_review else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "source_context": self.source_context
        }


# Update PDF model to include relationship
def add_flashcard_annotations_relationship():
    """
    Add relationship to existing PDF model.
    This should be added to app/models.py in the PDF class:
    
    flashcard_annotations = relationship("FlashcardAnnotation", back_populates="pdf", cascade="all, delete-orphan")
    """
    pass