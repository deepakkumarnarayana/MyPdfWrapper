from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timedelta

from app.database import get_db
from app.models import StudySession, PDF
from app.schemas.sessions import SessionCreate, SessionUpdate, SessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])

@router.post("/", response_model=SessionResponse)
async def create_session(
    session_data: SessionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new reading/study session"""
    
    # Verify PDF exists
    pdf_query = select(PDF).where(PDF.id == session_data.pdf_id)
    pdf_result = await db.execute(pdf_query)
    pdf = pdf_result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="PDF not found")
    
    # Create session
    session = StudySession(
        pdf_id=session_data.pdf_id,
        start_page=session_data.start_page,
        session_type=session_data.session_type or "reading"
    )
    
    db.add(session)
    await db.commit()
    await db.refresh(session)
    
    return SessionResponse.from_orm(session)

@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    updates: SessionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a session (typically to mark as ended)"""
    
    # Get session
    query = select(StudySession).where(StudySession.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update fields
    if updates.end_page is not None:
        session.end_page = updates.end_page
        
        # Calculate pages read
        if session.start_page and updates.end_page:
            session.pages_read = max(0, updates.end_page - session.start_page + 1)
    
    if updates.ended_at is not None:
        session.ended_at = updates.ended_at
        
        # Calculate total time
        if session.started_at and updates.ended_at:
            time_diff = updates.ended_at - session.started_at
            session.total_time_minutes = int(time_diff.total_seconds() / 60)
    
    if updates.flashcards_reviewed is not None:
        session.flashcards_reviewed = updates.flashcards_reviewed
        
    if updates.correct_answers is not None:
        session.correct_answers = updates.correct_answers
    
    await db.commit()
    await db.refresh(session)
    
    return SessionResponse.from_orm(session)

@router.get("/", response_model=List[SessionResponse])
async def get_sessions(
    pdf_id: Optional[int] = None,
    session_type: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get sessions with optional filtering"""
    
    query = select(StudySession)
    
    if pdf_id:
        query = query.where(StudySession.pdf_id == pdf_id)
        
    if session_type:
        query = query.where(StudySession.session_type == session_type)
    
    query = query.order_by(StudySession.started_at.desc()).limit(limit)
    
    result = await db.execute(query)
    sessions = result.scalars().all()
    
    return [SessionResponse.from_orm(session) for session in sessions]

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific session by ID"""
    
    query = select(StudySession).where(StudySession.id == session_id)
    result = await db.execute(query)
    session = result.scalar_one_or_none()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return SessionResponse.from_orm(session)