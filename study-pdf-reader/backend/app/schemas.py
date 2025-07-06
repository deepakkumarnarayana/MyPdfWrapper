from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

# PDF Schemas
class PDFBase(BaseModel):
    filename: str
    original_filename: str
    title: Optional[str] = None
    author: Optional[str] = None

class PDFCreate(PDFBase):
    pass

class PDFResponse(PDFBase):
    id: int
    file_path: str
    page_count: Optional[int] = None
    file_size: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Flashcard Schemas
class FlashcardBase(BaseModel):
    question: str
    answer: str
    page_number: Optional[int] = None
    difficulty: str = "medium"
    category: Optional[str] = None

class FlashcardCreate(FlashcardBase):
    pass

class FlashcardResponse(FlashcardBase):
    id: int
    pdf_id: int
    times_reviewed: int = 0
    correct_answers: int = 0
    last_reviewed: Optional[datetime] = None
    next_review: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Annotation Schemas
class AnnotationBase(BaseModel):
    page_number: int
    x_coordinate: float
    y_coordinate: float
    width: float
    height: float
    text: Optional[str] = None
    note: Optional[str] = None
    annotation_type: str = "highlight"
    color: str = "#ffff00"

class AnnotationCreate(AnnotationBase):
    pass

class AnnotationResponse(AnnotationBase):
    id: int
    pdf_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# Study Session Schemas
class StudySessionBase(BaseModel):
    flashcards_reviewed: int = 0
    correct_answers: int = 0
    total_time_minutes: int = 0

class StudySessionCreate(StudySessionBase):
    pass

class StudySessionResponse(StudySessionBase):
    id: int
    pdf_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True