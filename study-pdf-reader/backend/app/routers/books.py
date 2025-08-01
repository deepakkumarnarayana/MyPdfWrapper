from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response, Form
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from datetime import datetime
import logging

from app.database import get_db
from app.models import PDF
from app.schemas.books import BookResponse, BookUpdateRequest, BookProgressUpdate, BookMetadata
from app.services.pdf_service import PDFService
from app.services.storage_service import PDFStorageService, StorageProviderName

logger = logging.getLogger(__name__)

router = APIRouter()
storage_service = PDFStorageService()
pdf_metadata_service = PDFService()

def _pdf_to_book_response(pdf: PDF) -> BookResponse:
    """Convert PDF model to Book response format"""
    progress = 0
    if pdf.page_count and pdf.page_count > 0:
        progress = min(100, max(0, int((1 / pdf.page_count) * 100)))
    
    file_size_mb = (pdf.file_size or 0) / (1024 * 1024)
    file_size_str = f"{file_size_mb:.1f} MB" if file_size_mb > 0 else "Unknown"
    pages_str = f"Pages 1-{pdf.page_count}" if pdf.page_count else "Unknown pages"
    
    if progress == 0:
        status = "Started"
    elif progress == 100:
        status = "Completed"
    else:
        status = "In Progress"
    
    return BookResponse(
        id=str(pdf.id),
        title=pdf.title or pdf.original_filename.replace('.pdf', ''),
        fileName=pdf.original_filename,
        pages=pages_str,
        progress=progress,
        status=status,
        totalPages=pdf.page_count or 0,
        currentPage=1,
        uploadDate=pdf.created_at.strftime('%Y-%m-%d'),
        fileSize=file_size_str,
        lastReadPage=1,
        createdAt=pdf.created_at.isoformat(),
        updatedAt=pdf.updated_at.isoformat(),
        storageProvider=pdf.storage_provider
    )

@router.post("", response_model=BookResponse)
async def upload_book(
    file: UploadFile = File(...),
    storage_provider: StorageProviderName = Form(StorageProviderName.LOCAL),
    db: AsyncSession = Depends(get_db)
):
    """Upload a new book (PDF) to the specified storage provider."""
    if not file.filename or not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        # Save file to the chosen storage provider
        storage_data = await storage_service.save_pdf(file, storage_provider.value)
        
        # Extract metadata from the saved file (if local) or from upload stream
        # For cloud storage, this might need adjustment to avoid re-downloading
        # For now, we assume we can get a temporary local path or work with the stream
        temp_path_for_metadata = storage_data['file_path']
        if storage_provider != StorageProviderName.LOCAL:
             # This is a simplification. In a real-world scenario with cloud storage,
             # you'd process metadata *before* the final upload to avoid downloading.
             # Or use a lambda function triggered on upload.
             # For now, we'll proceed assuming the file is locally accessible for metadata.
             # This part of the logic needs to be improved for production cloud use.
             pass

        # We need to read the file content again for metadata, which is inefficient.
        # This highlights the need to process metadata before/during upload.
        await file.seek(0)
        content_for_metadata = await file.read()
        metadata = pdf_metadata_service._extract_metadata_from_content(content_for_metadata)

        # Create database entry
        pdf = PDF(
            filename=storage_data["filename"],
            original_filename=file.filename,
            file_path=storage_data["file_path"],
            file_size=storage_data["file_size"],
            storage_provider=storage_provider.value,
            title=metadata.get("title"),
            author=metadata.get("author"),
            page_count=metadata.get("page_count")
        )
        
        db.add(pdf)
        await db.commit()
        await db.refresh(pdf)
        
        logger.info(f"Successfully uploaded book '{pdf.original_filename}' to {storage_provider.value}")
        return _pdf_to_book_response(pdf)
        
    except Exception as e:
        await db.rollback()
        logger.error(f"Error uploading book: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error uploading book: {str(e)}")

@router.delete("/{book_id}")
async def delete_book(book_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a book and its associated PDF file from storage."""
    pdf = await _get_pdf_or_404(book_id, db)
    
    try:
        # Delete physical file from its storage provider
        deleted = await storage_service.delete_pdf(pdf.file_path, pdf.storage_provider)
        if not deleted:
            logger.warning(f"File {pdf.file_path} not found in {pdf.storage_provider} for deletion, but proceeding.")
    except Exception as e:
        # Log error but proceed to delete DB record
        logger.error(f"Error deleting file {pdf.file_path} from {pdf.storage_provider}: {e}")

    # Delete from database
    await db.delete(pdf)
    await db.commit()
    
    logger.info(f"Successfully deleted book record: {pdf.original_filename}")
    return {"message": "Book deleted successfully"}

@router.get("/{book_id}/url", response_model=dict)
async def get_book_pdf_url(book_id: str, db: AsyncSession = Depends(get_db)):
    """Get the accessible URL for a book's PDF file."""
    pdf = await _get_pdf_or_404(book_id, db)
    
    try:
        pdf_url = await storage_service.get_pdf_url(book_id, pdf.file_path, pdf.storage_provider)
        return {"url": pdf_url}
    except FileNotFoundError:
        logger.error(f"PDF file not found in {pdf.storage_provider} for book {book_id}: {pdf.file_path}")
        raise HTTPException(status_code=404, detail="PDF file not found in storage")
    except Exception as e:
        logger.error(f"Error getting PDF URL for book {book_id}: {e}")
        raise HTTPException(status_code=500, detail="Error getting PDF URL")

@router.get("/{book_id}/pdf")
async def get_book_pdf(book_id: str, db: AsyncSession = Depends(get_db)):
    """Serves the PDF file directly if local, or redirects if cloud."""
    pdf = await _get_pdf_or_404(book_id, db)
    
    # Check if file exists in its designated storage
    if not await storage_service.file_exists(pdf.file_path, pdf.storage_provider):
        logger.error(f"PDF file not found in {pdf.storage_provider}: {pdf.file_path}")
        raise HTTPException(status_code=404, detail="PDF file not found")
    
    # If local, serve the file directly
    if storage_service.requires_direct_serving(pdf.storage_provider):
        return FileResponse(
            path=pdf.file_path,
            media_type="application/pdf",
            filename=pdf.original_filename
        )
    else:
        # If cloud, get a temporary signed URL and redirect
        pdf_url = await storage_service.get_pdf_url(book_id, pdf.file_path, pdf.storage_provider)
        return RedirectResponse(url=pdf_url)

async def _get_pdf_or_404(book_id: str, db: AsyncSession) -> PDF:
    """Helper to get a PDF by its string ID or raise a 404 error."""
    try:
        pdf_id = int(book_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid book ID format")
    
    result = await db.execute(select(PDF).where(PDF.id == pdf_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Book not found")
    return pdf

# Keep other endpoints like get_books, update_book, etc.
# They can remain largely unchanged for now.

@router.get("", response_model=List[BookResponse])
async def get_books(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all books with pagination."""
    try:
        result = await db.execute(select(PDF).order_by(PDF.created_at.desc()).offset(skip).limit(limit))
        pdfs = result.scalars().all()
        books = [_pdf_to_book_response(pdf) for pdf in pdfs]
        logger.info(f"Retrieved {len(books)} books")
        return books
    except Exception as e:
        logger.error(f"Error retrieving books: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving books")

@router.get("/{book_id}", response_model=BookResponse)
async def get_book(book_id: str, db: AsyncSession = Depends(get_db)):
    """Get a specific book by ID."""
    pdf = await _get_pdf_or_404(book_id, db)
    return _pdf_to_book_response(pdf)
