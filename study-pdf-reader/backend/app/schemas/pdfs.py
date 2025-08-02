from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any
from app.models import DocumentType

# Enhanced Document Schemas
class DocumentBase(BaseModel):
    title: Optional[str] = None
    authors: Optional[List[str]] = None
    document_type: Optional[DocumentType] = DocumentType.BOOK
    type_metadata: Optional[Dict[str, Any]] = None

class DocumentCreate(DocumentBase):
    pass

class DocumentResponse(DocumentBase):
    id: int
    filename: str
    original_filename: str
    file_path: str
    page_count: Optional[int] = None
    file_size: Optional[int] = None
    storage_provider: str
    processing_status: Optional[str] = "completed"
    created_at: datetime
    updated_at: datetime
    
    # Backwards compatibility
    author: Optional[str] = None  # Computed from authors[0] if exists
    
    class Config:
        from_attributes = True

# Legacy PDF schemas for backwards compatibility
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
    storage_provider: str
    created_at: datetime
    updated_at: datetime
    
    # Include new fields for compatibility
    document_type: Optional[str] = "book"
    authors: Optional[List[str]] = None
    type_metadata: Optional[Dict[str, Any]] = None
    processing_status: Optional[str] = "completed"
    
    # Frontend-specific computed fields
    pages: Optional[str] = None
    progress: Optional[int] = 0
    status: Optional[str] = "Started"
    
    class Config:
        from_attributes = True
        
    def __init__(self, **data):
        super().__init__(**data)
        if not self.pages and self.page_count:
            self.pages = f"Pages 1-{self.page_count}"
        elif not self.pages:
            self.pages = "Unknown pages"
