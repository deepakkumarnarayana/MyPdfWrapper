from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.sqlite import JSON  # SQLite JSON support
from app.database import Base
import enum

class DocumentType(enum.Enum):
    BOOK = "book"
    RESEARCH_PAPER = "research_paper"
    ARTICLE = "article"
    MANUAL = "manual"

class PDF(Base):
    __tablename__ = "pdfs"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, unique=True, index=True, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    title = Column(String, nullable=True)
    author = Column(String, nullable=True)  # Keep for backwards compatibility
    page_count = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    storage_provider = Column(String, nullable=False, server_default="local", default="local")
    
    # New unified document fields
    document_type = Column(Enum(DocumentType), nullable=False, default=DocumentType.BOOK, index=True)
    authors = Column(JSON, nullable=True)  # JSON array for multiple authors
    type_metadata = Column(JSON, nullable=True)  # Type-specific metadata
    processing_status = Column(String, default="completed", index=True)  # pending, processing, completed, failed
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    flashcards = relationship("Flashcard", back_populates="pdf", cascade="all, delete-orphan")
    annotations = relationship("Annotation", back_populates="pdf", cascade="all, delete-orphan")

class Flashcard(Base):
    __tablename__ = "flashcards"
    
    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    difficulty = Column(String, default="medium")  # easy, medium, hard
    category = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Study tracking
    times_reviewed = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    last_reviewed = Column(DateTime, nullable=True)
    next_review = Column(DateTime, nullable=True)
    
    # Relationships
    pdf = relationship("PDF", back_populates="flashcards")

class Annotation(Base):
    __tablename__ = "annotations"
    
    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=False)
    page_number = Column(Integer, nullable=False)
    x_coordinate = Column(Float, nullable=False)
    y_coordinate = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    text = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    annotation_type = Column(String, default="highlight")  # highlight, note, bookmark
    color = Column(String, default="#ffff00")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    pdf = relationship("PDF", back_populates="annotations")

class StudySession(Base):
    __tablename__ = "study_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=False)
    started_at = Column(DateTime, server_default=func.now())
    ended_at = Column(DateTime, nullable=True)
    
    # Reading session tracking
    start_page = Column(Integer, nullable=True)
    end_page = Column(Integer, nullable=True)
    pages_read = Column(Integer, default=0)
    
    # Study tracking (flashcards)
    flashcards_reviewed = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    total_time_minutes = Column(Integer, default=0)
    
    # Session type
    session_type = Column(String, default="reading")  # reading, study, review
    
    # Relationships
    pdf = relationship("PDF")