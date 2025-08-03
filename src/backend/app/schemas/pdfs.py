from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models import DocumentType

class DocumentResponse(BaseModel):
    id: int
    user_id: int
    filename: str
    original_filename: str
    file_path: str
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    page_count: Optional[int] = None
    file_size: Optional[int] = None
    storage_provider: str
    document_type: DocumentType
    type_metadata: Optional[Dict[str, Any]] = None
    processing_status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DocumentCreate(BaseModel):
    user_id: int
    filename: str
    original_filename: str
    file_path: str
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    page_count: Optional[int] = None
    file_size: Optional[int] = None
    storage_provider: str = "local"
    document_type: DocumentType
    type_metadata: Optional[Dict[str, Any]] = None
    processing_status: str = "completed"