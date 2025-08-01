from pydantic import BaseModel
from datetime import datetime
from typing import Optional

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
