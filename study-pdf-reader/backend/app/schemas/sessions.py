from pydantic import BaseModel
from datetime import datetime
from typing import Optional

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

class SessionCreate(BaseModel):
    pdf_id: int
    start_page: Optional[int] = None
    session_type: Optional[str] = "reading"

class SessionUpdate(BaseModel):
    end_page: Optional[int] = None
    ended_at: Optional[datetime] = None
    flashcards_reviewed: Optional[int] = None
    correct_answers: Optional[int] = None

class SessionResponse(BaseModel):
    id: int
    pdf_id: int
    started_at: datetime
    ended_at: Optional[datetime] = None
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    pages_read: int
    flashcards_reviewed: int
    correct_answers: int
    total_time_minutes: int
    session_type: str

    class Config:
        from_attributes = True

class SessionSummary(BaseModel):
    total_sessions: int
    total_time_minutes: int
    total_pages_read: int
    total_flashcards_reviewed: int
    overall_flashcard_accuracy: float
