from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Flashcard, PDF
from app.schemas.flashcards import FlashcardResponse, FlashcardCreate
from app.services.flashcard_service import FlashcardService
from typing import List, Optional

router = APIRouter()

@router.post("/documents/{document_id}/flashcards/generate")
async def generate_flashcards(
    document_id: int,
    db: AsyncSession = Depends(get_db)
):
    # Check if PDF exists
    result = await db.execute(select(PDF).where(PDF.id == document_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Document not found")
    
    flashcard_service = FlashcardService()
    
    try:
        # Generate flashcards using AI
        flashcards_data = await flashcard_service.generate_flashcards(pdf.file_path)
        
        # Save flashcards to database
        flashcards = []
        for flashcard_data in flashcards_data:
            flashcard = Flashcard(
                pdf_id=document_id,
                question=flashcard_data["question"],
                answer=flashcard_data["answer"],
                page_number=flashcard_data.get("page_number"),
                difficulty=flashcard_data.get("difficulty", "medium"),
                category=flashcard_data.get("category")
            )
            flashcards.append(flashcard)
            db.add(flashcard)
        
        await db.commit()
        
        # Refresh all flashcards to get their IDs
        for flashcard in flashcards:
            await db.refresh(flashcard)
        
        return {"message": f"Generated {len(flashcards)} flashcards", "flashcards": flashcards}
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error generating flashcards: {str(e)}")

@router.get("/documents/{document_id}/flashcards", response_model=List[FlashcardResponse])
async def get_flashcards(
    document_id: int,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(Flashcard).where(Flashcard.pdf_id == document_id)
    
    if category:
        query = query.where(Flashcard.category == category)
    
    if difficulty:
        query = query.where(Flashcard.difficulty == difficulty)
    
    result = await db.execute(query)
    flashcards = result.scalars().all()
    
    return flashcards

@router.get("/flashcards/{flashcard_id}", response_model=FlashcardResponse)
async def get_flashcard(flashcard_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Flashcard).where(Flashcard.id == flashcard_id))
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    return flashcard

@router.put("/flashcards/{flashcard_id}", response_model=FlashcardResponse)
async def update_flashcard(
    flashcard_id: int,
    flashcard_data: FlashcardCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Flashcard).where(Flashcard.id == flashcard_id))
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    # Update fields
    for field, value in flashcard_data.dict(exclude_unset=True).items():
        setattr(flashcard, field, value)
    
    await db.commit()
    await db.refresh(flashcard)
    
    return flashcard

@router.delete("/flashcards/{flashcard_id}")
async def delete_flashcard(flashcard_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Flashcard).where(Flashcard.id == flashcard_id))
    flashcard = result.scalar_one_or_none()
    
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    
    await db.delete(flashcard)
    await db.commit()
    
    return {"message": "Flashcard deleted successfully"}