from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any
from app.models import FlashcardSource

class FlashcardBase(BaseModel):
    question: str
    answer: str
    page_number: Optional[int] = None
    difficulty: str = "medium"
    category: Optional[str] = None
    context_text: Optional[str] = None

class ManualFlashcardCreate(BaseModel):
    pdf_id: int
    question: str
    answer: str
    page_number: Optional[int] = None
    context_text: Optional[str] = None
    # Optional: Store position of the highlight on the page
    coordinates: Optional[Dict[str, Any]] = None

class FlashcardResponse(FlashcardBase):
    id: int
    pdf_id: int
    source: FlashcardSource
    times_reviewed: int = 0
    correct_answers: int = 0
    last_reviewed: Optional[datetime] = None
    next_review: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# This schema is for the existing AI generation endpoint
class FlashcardCreate(FlashcardBase):
    pass