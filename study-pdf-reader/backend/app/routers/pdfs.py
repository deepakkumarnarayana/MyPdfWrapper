from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import PDF
from app.schemas.pdfs import PDFResponse, PDFCreate
from app.services.pdf_service import PDFService
from typing import List
import os

router = APIRouter()

@router.post("/pdfs", response_model=PDFResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    pdf_service = PDFService()
    
    try:
        # Save and process PDF
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
        
        return pdf
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing PDF: {str(e)}")

@router.get("/pdfs", response_model=List[PDFResponse])
async def get_pdfs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PDF))
    pdfs = result.scalars().all()
    return pdfs

@router.get("/pdfs/{pdf_id}", response_model=PDFResponse)
async def get_pdf(pdf_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PDF).where(PDF.id == pdf_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    return pdf

@router.delete("/pdfs/{pdf_id}")
async def delete_pdf(pdf_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PDF).where(PDF.id == pdf_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    # Delete physical file
    try:
        if os.path.exists(pdf.file_path):
            os.remove(pdf.file_path)
    except Exception as e:
        print(f"Warning: Could not delete file {pdf.file_path}: {e}")
    
    # Delete from database
    await db.delete(pdf)
    await db.commit()
    
    return {"message": "PDF deleted successfully"}