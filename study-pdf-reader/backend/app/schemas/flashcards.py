from pydantic import BaseModel
from datetime import datetime
from typing import Optional

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
