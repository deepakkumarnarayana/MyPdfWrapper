from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import PDF, DocumentType
from app.schemas.pdfs import PDFResponse, PDFCreate, DocumentResponse, DocumentCreate
from app.services.pdf_service import PDFService
from typing import List, Optional
import os

router = APIRouter()

@router.post("/documents", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    document_type: DocumentType = Form(DocumentType.BOOK),
    db: AsyncSession = Depends(get_db)
):
    """Upload a document (PDF) - supports both books and research papers"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    pdf_service = PDFService()
    
    try:
        # Save and process PDF with type-specific metadata
        pdf_data = await pdf_service.save_pdf(file, document_type)
        
        # Extract authors array from metadata or fallback to single author
        authors = []
        if pdf_data.get("author"):
            authors = [pdf_data["author"]]
        
        # Prepare type-specific metadata
        type_metadata = {}
        if document_type == DocumentType.BOOK:
            type_metadata = {
                "isbn": pdf_data.get("isbn"),
                "publisher": pdf_data.get("publisher"),
                "genre": pdf_data.get("genre"),
            }
        elif document_type == DocumentType.RESEARCH_PAPER:
            type_metadata = {
                "doi": pdf_data.get("doi"),
                "journal": pdf_data.get("journal"),
                "keywords": pdf_data.get("keywords", []),
                "citation_count": pdf_data.get("citation_count", 0),
            }
        
        # Create database entry with enhanced fields
        pdf = PDF(
            filename=pdf_data["filename"],
            original_filename=pdf_data["original_filename"],
            file_path=pdf_data["file_path"],
            title=pdf_data.get("title"),
            author=pdf_data.get("author"),  # Backwards compatibility
            authors=authors,
            page_count=pdf_data.get("page_count"),
            file_size=pdf_data.get("file_size"),
            document_type=document_type,
            type_metadata=type_metadata,
            processing_status="completed"
        )
        
        db.add(pdf)
        await db.commit()
        await db.refresh(pdf)
        
        return pdf
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@router.get("/documents", response_model=List[PDFResponse])
async def get_documents(
    document_type: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Get documents with optional type filtering"""
    query = select(PDF).order_by(PDF.created_at.desc())
    
    if document_type:
        # Convert frontend string to backend enum value
        if document_type == "research_paper":
            document_type = "RESEARCH_PAPER"
        elif document_type == "book":
            document_type = "BOOK"
            
        query = query.where(PDF.document_type == document_type)
    
    query = query.limit(limit)
    result = await db.execute(query)
    pdfs = result.scalars().all()
    
    # Ensure each PDF has a display title
    for pdf in pdfs:
        if not pdf.title:
            pdf.title = pdf.original_filename.replace('.pdf', '') if pdf.original_filename else f"Document {pdf.id}"
    
    return pdfs

@router.get("/documents/{document_id}", response_model=PDFResponse)
async def get_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PDF).where(PDF.id == document_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return pdf

@router.get("/documents/{document_id}/url")
async def get_document_url(document_id: int, db: AsyncSession = Depends(get_db)):
    """Get the URL to access the PDF file for viewing"""
    result = await db.execute(select(PDF).where(PDF.id == document_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Return the static file URL that can be used to access the PDF
    # The frontend can use this URL to display the PDF in a viewer
    filename = os.path.basename(pdf.file_path)
    static_url = f"/static/{filename}"
    
    return {"url": static_url}

@router.delete("/documents/{document_id}")
async def delete_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PDF).where(PDF.id == document_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete physical file
    try:
        if os.path.exists(pdf.file_path):
            os.remove(pdf.file_path)
    except Exception as e:
        print(f"Warning: Could not delete file {pdf.file_path}: {e}")
    
    # Delete from database
    await db.delete(pdf)
    await db.commit()
    
    return {"message": "Document deleted successfully"}