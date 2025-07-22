"""
Books API Router

This router provides a books-centric API that maps to the underlying PDF system.
It bridges the gap between frontend expectations (books) and backend reality (PDFs),
providing a clean, consistent interface that can evolve independently.

The router uses the storage abstraction layer to serve PDFs from multiple sources
while maintaining a unified API surface.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from fastapi.responses import FileResponse, RedirectResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import os
from pathlib import Path
from datetime import datetime

from app.database import get_db
from app.models import PDF
from app.schemas.books import (
    BookResponse, 
    BookCreateRequest, 
    BookUpdateRequest,
    BookProgressUpdate,
    BookListResponse,
    BookMetadata
)
from app.services.pdf_service import PDFService
from app.services.storage_service import PDFStorageService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Initialize storage service
storage_service = PDFStorageService()


def _pdf_to_book_response(pdf: PDF) -> BookResponse:
    """Convert PDF model to Book response format"""
    
    # Calculate progress (mock calculation - you can implement actual reading progress)
    progress = 0
    if pdf.page_count and pdf.page_count > 0:
        # For now, use a simple calculation - this should be replaced with actual reading progress
        progress = min(100, max(0, int((1 / pdf.page_count) * 100)))
    
    # Format file size
    file_size_mb = (pdf.file_size or 0) / (1024 * 1024)
    file_size_str = f"{file_size_mb:.1f} MB" if file_size_mb > 0 else "Unknown"
    
    # Format pages string
    pages_str = f"Pages 1-{pdf.page_count}" if pdf.page_count else "Unknown pages"
    
    # Determine status based on progress (mock logic)
    if progress == 0:
        status = "Started"
    elif progress == 100:
        status = "Completed"
    else:
        status = "In Progress"
    
    return BookResponse(
        id=str(pdf.id),  # Convert to string for frontend compatibility
        title=pdf.title or pdf.original_filename.replace('.pdf', ''),
        fileName=pdf.original_filename,
        pages=pages_str,
        progress=progress,
        status=status,
        totalPages=pdf.page_count or 0,
        currentPage=1,  # Mock value - implement actual reading progress
        uploadDate=pdf.created_at.strftime('%Y-%m-%d'),
        fileSize=file_size_str,
        lastReadPage=1,  # Mock value - implement actual reading progress
        createdAt=pdf.created_at.isoformat(),
        updatedAt=pdf.updated_at.isoformat()
    )


@router.get("", response_model=List[BookResponse])
async def get_books(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all books with pagination
    
    This endpoint maps to the underlying PDF storage while presenting
    a books-centric view to the frontend.
    """
    try:
        # Get PDFs from database
        result = await db.execute(
            select(PDF).offset(skip).limit(limit)
        )
        pdfs = result.scalars().all()
        
        # Convert to book responses
        books = [_pdf_to_book_response(pdf) for pdf in pdfs]
        
        logger.info(f"Retrieved {len(books)} books")
        return books
        
    except Exception as e:
        logger.error(f"Error retrieving books: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving books")


@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get a specific book by ID
    
    Args:
        book_id: String ID of the book (maps to PDF.id)
    """
    try:
        # Convert string ID back to integer for database query
        pdf_id = int(book_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid book ID format")
    
    # Get PDF from database
    result = await db.execute(select(PDF).where(PDF.id == pdf_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Book not found")
    
    return _pdf_to_book_response(pdf)


@router.put("/{book_id}", response_model=BookResponse)
async def update_book(
    book_id: str,
    book_update: BookUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Update book metadata and reading progress
    
    This is where reading progress, bookmarks, and other user-specific
    data would be updated.
    """
    try:
        pdf_id = int(book_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid book ID format")
    
    # Get existing PDF
    result = await db.execute(select(PDF).where(PDF.id == pdf_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # Update PDF fields that map to book updates
    if book_update.title is not None:
        pdf.title = book_update.title
    
    # Note: currentPage, progress, lastReadPage would typically be stored
    # in a separate user_reading_progress table, but for now we'll just
    # acknowledge the update
    
    pdf.updated_at = datetime.utcnow()
    
    try:
        await db.commit()
        await db.refresh(pdf)
        
        return _pdf_to_book_response(pdf)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error updating book {book_id}: {e}")
        raise HTTPException(status_code=500, detail="Error updating book")


@router.post("", response_model=BookResponse)
async def upload_book(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a new book (PDF file)
    
    This endpoint provides a books-centric interface for PDF upload,
    automatically handling the conversion between book and PDF concepts.
    """
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    pdf_service = PDFService()
    
    try:
        # Save and process PDF using existing service
        pdf_data = await pdf_service.save_pdf(file)
        
        # Create database entry
        pdf = PDF(
            filename=pdf_data["filename"],
            original_filename=pdf_data["original_filename"],
            file_path=pdf_data["file_path"],
            title=pdf_data.get("title"),
            author=pdf_data.get("author"),
            page_count=pdf_data.get("page_count"),
            file_size=pdf_data.get("file_size")
        )
        
        db.add(pdf)
        await db.commit()
        await db.refresh(pdf)
        
        logger.info(f"Successfully uploaded book: {pdf.original_filename}")
        return _pdf_to_book_response(pdf)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error uploading book: {e}")
        raise HTTPException(status_code=500, detail=f"Error uploading book: {str(e)}")


@router.delete("/{book_id}")
async def delete_book(book_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a book and its associated PDF file"""
    try:
        pdf_id = int(book_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid book ID format")
    
    # Get PDF from database
    result = await db.execute(select(PDF).where(PDF.id == pdf_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Book not found")
    
    try:
        # Delete physical file
        if os.path.exists(pdf.file_path):
            os.remove(pdf.file_path)
    except Exception as e:
        logger.warning(f"Could not delete file {pdf.file_path}: {e}")
    
    # Delete from database
    await db.delete(pdf)
    await db.commit()
    
    logger.info(f"Successfully deleted book: {pdf.original_filename}")
    return {"message": "Book deleted successfully"}


@router.get("/{book_id}/pdf")
async def get_book_pdf(book_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get the PDF file for a book
    
    This is the key endpoint that provides storage abstraction.
    It automatically handles different storage backends (local, S3, GCS, etc.)
    and provides the appropriate response (direct file, redirect, or stream).
    """
    try:
        pdf_id = int(book_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid book ID format")
    
    # Get PDF metadata from database
    result = await db.execute(select(PDF).where(PDF.id == pdf_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Book not found")
    
    try:
        # Check if file exists in storage
        if not await storage_service.file_exists(book_id, pdf.file_path):
            logger.error(f"PDF file not found in storage: {pdf.file_path}")
            raise HTTPException(status_code=404, detail="PDF file not found")
        
        # Handle different storage providers
        if storage_service.requires_direct_serving():
            # Local storage - serve file directly through FastAPI
            if not os.path.exists(pdf.file_path):
                raise HTTPException(status_code=404, detail="PDF file not found on disk")
            
            return FileResponse(
                path=pdf.file_path,
                media_type="application/pdf",
                filename=pdf.original_filename,
                headers={
                    "Cache-Control": "public, max-age=3600",
                    "Content-Disposition": f'inline; filename="{pdf.original_filename}"'
                }
            )
        
        else:
            # Cloud storage - redirect to signed URL
            pdf_url = await storage_service.get_pdf_url(book_id, pdf.file_path)
            return RedirectResponse(url=pdf_url, status_code=307)
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error serving PDF for book {book_id}: {e}")
        raise HTTPException(status_code=500, detail="Error accessing PDF file")


@router.post("/{book_id}/progress")
async def update_reading_progress(
    book_id: str,
    progress: BookProgressUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update reading progress for a book
    
    In a full implementation, this would update a user_reading_progress table.
    For now, it provides the interface that frontend expects.
    """
    try:
        pdf_id = int(book_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid book ID format")
    
    # Verify book exists
    result = await db.execute(select(PDF).where(PDF.id == pdf_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # In a full implementation, you would:
    # 1. Check if user_reading_progress record exists
    # 2. Update or create the progress record
    # 3. Calculate progress percentage based on currentPage/totalPages
    
    # For now, just return success
    calculated_progress = progress.progress
    if calculated_progress is None and pdf.page_count:
        calculated_progress = int((progress.currentPage / pdf.page_count) * 100)
    
    logger.info(f"Updated reading progress for book {book_id}: page {progress.currentPage}")
    
    return {
        "message": "Reading progress updated successfully",
        "currentPage": progress.currentPage,
        "lastReadPage": progress.lastReadPage,
        "progress": calculated_progress
    }


@router.get("/{book_id}/metadata", response_model=BookMetadata)
async def get_book_metadata(book_id: str, db: AsyncSession = Depends(get_db)):
    """
    Get detailed metadata for a book
    
    This endpoint can be extended to provide rich metadata extracted
    from PDFs, including table of contents, bookmarks, annotations, etc.
    """
    try:
        pdf_id = int(book_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid book ID format")
    
    # Get PDF from database
    result = await db.execute(select(PDF).where(PDF.id == pdf_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Book not found")
    
    # TODO: Extract additional metadata like table of contents, bookmarks
    # For now, return basic metadata
    return BookMetadata(
        title=pdf.title,
        author=pdf.author,
        pageCount=pdf.page_count or 0,
        fileSize=pdf.file_size or 0,
        createdAt=pdf.created_at,
        hasTableOfContents=False,  # TODO: Implement detection
        bookmarks=[]  # TODO: Extract from PDF
    )


@router.get("/debug/storage")
async def debug_storage_info():
    """Debug endpoint to check storage configuration"""
    try:
        return storage_service.get_provider_info()
    except Exception as e:
        logger.error(f"Error getting storage info: {e}")
        return {"error": str(e)}