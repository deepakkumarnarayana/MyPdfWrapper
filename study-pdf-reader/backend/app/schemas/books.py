"""
Book schemas for frontend compatibility

These schemas bridge the gap between the frontend's expected Book interface
and the backend's PDF model, providing a consistent API that can evolve
independently of the underlying data model.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class BookBase(BaseModel):
    """Base book schema matching frontend expectations"""
    title: str
    fileName: str
    pages: str  # Format: "Pages 1-350"
    progress: int  # Percentage (0-100)
    status: str  # "Started", "In Progress", "Completed"
    totalPages: int
    currentPage: int
    uploadDate: str  # ISO date string
    fileSize: str  # Human readable format like "2.5 MB"
    lastReadPage: int


class BookCreateRequest(BaseModel):
    """Request schema for creating a new book"""
    title: Optional[str] = None
    # File upload handled separately through multipart


class BookUpdateRequest(BaseModel):
    """Request schema for updating book metadata"""
    title: Optional[str] = None
    progress: Optional[int] = None
    status: Optional[str] = None
    currentPage: Optional[int] = None
    lastReadPage: Optional[int] = None


class BookResponse(BookBase):
    """Full book response matching frontend Book interface"""
    id: str  # String ID for frontend compatibility
    createdAt: str  # ISO datetime string
    updatedAt: str  # ISO datetime string
    
    class Config:
        from_attributes = True


class BookListResponse(BaseModel):
    """Response for book list endpoints"""
    books: List[BookResponse]
    total: int
    page: int
    pageSize: int


class BookProgressUpdate(BaseModel):
    """Schema for updating reading progress"""
    currentPage: int
    lastReadPage: int
    progress: Optional[int] = None  # Auto-calculated if not provided


class BookMetadata(BaseModel):
    """Schema for book metadata from PDF analysis"""
    title: Optional[str] = None
    author: Optional[str] = None
    pageCount: int
    fileSize: int
    createdAt: datetime
    hasTableOfContents: bool = False
    bookmarks: List[dict] = []