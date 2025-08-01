from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime, timedelta, timezone
import logging
import traceback

from app.database import get_db
from app.models import StudySession, PDF
from app.schemas.sessions import SessionCreate, SessionUpdate, SessionResponse

# Configure logger for session debugging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sessions", tags=["sessions"])

# Add a middleware-like function to log all session endpoint access
@router.on_event("startup")
async def log_session_router_startup():
    logger.info("SESSION_ROUTER_STARTUP: Session router initialized with comprehensive logging")

@router.post("/", response_model=SessionResponse)
async def create_session(
    session_data: SessionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Create a new reading/study session"""
    
    # Get client information
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    logger.info(f"SESSION_CREATE_START: PDF_ID={session_data.pdf_id}, START_PAGE={session_data.start_page}, TYPE={session_data.session_type}, CLIENT_IP={client_ip}, USER_AGENT={user_agent[:100]}")
    
    try:
        # Verify PDF exists
        pdf_query = select(PDF).where(PDF.id == session_data.pdf_id)
        pdf_result = await db.execute(pdf_query)
        pdf = pdf_result.scalar_one_or_none()
        
        if not pdf:
            logger.warning(f"SESSION_CREATE_FAILED: PDF_NOT_FOUND PDF_ID={session_data.pdf_id}")
            raise HTTPException(status_code=404, detail="PDF not found")
        
        logger.debug(f"SESSION_CREATE_PDF_VERIFIED: PDF_ID={session_data.pdf_id}, PDF_FILENAME={pdf.filename}")
        
        # Create session
        session = StudySession(
            pdf_id=session_data.pdf_id,
            start_page=session_data.start_page,
            session_type=session_data.session_type or "reading"
        )
        
        db.add(session)
        await db.commit()
        await db.refresh(session)
        
        logger.info(f"SESSION_CREATED_SUCCESS: SESSION_ID={session.id}, PDF_ID={session.pdf_id}, STARTED_AT={session.started_at}, START_PAGE={session.start_page}")
        
        return SessionResponse.from_orm(session)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SESSION_CREATE_ERROR: {str(e)}, TRACEBACK: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to create session")

@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: int,
    updates: SessionUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Update a session (typically to mark as ended)"""
    
    # Get client information for debugging
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")
    
    # Get call stack for debugging who's calling this endpoint
    call_stack = ''.join(traceback.format_stack()[-3:-1])  # Get last 2 stack frames
    
    logger.info(f"SESSION_UPDATE_START: SESSION_ID={session_id}, END_PAGE={updates.end_page}, ENDED_AT={updates.ended_at}, CLIENT_IP={client_ip}, USER_AGENT={user_agent[:50]}")
    logger.debug(f"SESSION_UPDATE_CALL_STACK: SESSION_ID={session_id}, STACK={call_stack}")
    
    try:
        # Get session
        query = select(StudySession).where(StudySession.id == session_id)
        result = await db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            logger.warning(f"SESSION_UPDATE_FAILED: SESSION_NOT_FOUND SESSION_ID={session_id}")
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Log current session state before update
        logger.debug(f"SESSION_UPDATE_BEFORE: SESSION_ID={session_id}, CURRENT_STARTED_AT={session.started_at}, CURRENT_ENDED_AT={session.ended_at}, CURRENT_END_PAGE={session.end_page}")
        
        # Track what's being updated
        updates_made = []
        
        # Update fields
        if updates.end_page is not None:
            old_end_page = session.end_page
            session.end_page = updates.end_page
            updates_made.append(f"END_PAGE: {old_end_page} -> {updates.end_page}")
            
            # Calculate pages read
            if session.start_page and updates.end_page:
                old_pages_read = session.pages_read
                session.pages_read = max(0, updates.end_page - session.start_page + 1)
                updates_made.append(f"PAGES_READ: {old_pages_read} -> {session.pages_read}")
        
        if updates.ended_at is not None:
            old_ended_at = session.ended_at
            session.ended_at = updates.ended_at
            updates_made.append(f"ENDED_AT: {old_ended_at} -> {updates.ended_at}")
            
            # Calculate total time
            if session.started_at and updates.ended_at:
                # Handle timezone differences between naive and aware datetime objects
                started_at = session.started_at
                ended_at = updates.ended_at
                
                logger.debug(f"SESSION_UPDATE_TIME_CALC: SESSION_ID={session_id}, STARTED_AT={started_at} (TZ: {started_at.tzinfo}), ENDED_AT={ended_at} (TZ: {ended_at.tzinfo})")
                
                # If one is timezone-aware and the other is naive, make both timezone-aware
                if started_at.tzinfo is None and ended_at.tzinfo is not None:
                    # started_at is naive, ended_at is aware - make started_at UTC aware
                    started_at = started_at.replace(tzinfo=timezone.utc)
                    logger.debug(f"SESSION_UPDATE_TIMEZONE_ADJUST: Made started_at timezone-aware: {started_at}")
                elif started_at.tzinfo is not None and ended_at.tzinfo is None:
                    # started_at is aware, ended_at is naive - make ended_at UTC aware
                    ended_at = ended_at.replace(tzinfo=timezone.utc)
                    logger.debug(f"SESSION_UPDATE_TIMEZONE_ADJUST: Made ended_at timezone-aware: {ended_at}")
                
                time_diff = ended_at - started_at
                total_seconds = time_diff.total_seconds()
                total_minutes = total_seconds / 60
                old_total_time = session.total_time_minutes
                session.total_time_minutes = max(1, round(total_minutes)) if total_minutes > 0 else 0
                
                logger.info(f"SESSION_UPDATE_DURATION_CALC: SESSION_ID={session_id}, DURATION_SECONDS={total_seconds:.2f}, DURATION_MINUTES={total_minutes:.2f}, STORED_MINUTES={session.total_time_minutes}")
                updates_made.append(f"TOTAL_TIME_MINUTES: {old_total_time} -> {session.total_time_minutes}")
        
        if updates.flashcards_reviewed is not None:
            old_flashcards = session.flashcards_reviewed
            session.flashcards_reviewed = updates.flashcards_reviewed
            updates_made.append(f"FLASHCARDS_REVIEWED: {old_flashcards} -> {updates.flashcards_reviewed}")
            
        if updates.correct_answers is not None:
            old_correct = session.correct_answers
            session.correct_answers = updates.correct_answers
            updates_made.append(f"CORRECT_ANSWERS: {old_correct} -> {updates.correct_answers}")
        
        logger.info(f"SESSION_UPDATE_CHANGES: SESSION_ID={session_id}, UPDATES={', '.join(updates_made) if updates_made else 'NONE'}")
        
        await db.commit()
        await db.refresh(session)
        
        logger.info(f"SESSION_UPDATE_SUCCESS: SESSION_ID={session_id}, FINAL_ENDED_AT={session.ended_at}, FINAL_DURATION_MINUTES={session.total_time_minutes}")
        
        return SessionResponse.from_orm(session)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SESSION_UPDATE_ERROR: SESSION_ID={session_id}, ERROR={str(e)}, TRACEBACK={traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to update session")

@router.get("/", response_model=List[SessionResponse])
async def get_sessions(
    pdf_id: Optional[int] = None,
    session_type: Optional[str] = None,
    limit: int = 50,
    request: Request = None,
    db: AsyncSession = Depends(get_db)
):
    """Get sessions with optional filtering"""
    
    client_ip = request.client.host if request and request.client else "unknown"
    
    logger.debug(f"SESSION_LIST_REQUEST: PDF_ID={pdf_id}, SESSION_TYPE={session_type}, LIMIT={limit}, CLIENT_IP={client_ip}")
    
    try:
        query = select(StudySession)
        
        if pdf_id:
            query = query.where(StudySession.pdf_id == pdf_id)
            
        if session_type:
            query = query.where(StudySession.session_type == session_type)
        
        query = query.order_by(StudySession.started_at.desc()).limit(limit)
        
        result = await db.execute(query)
        sessions = result.scalars().all()
        
        logger.info(f"SESSION_LIST_SUCCESS: FOUND={len(sessions)} sessions, PDF_ID={pdf_id}, SESSION_TYPE={session_type}")
        
        return [SessionResponse.from_orm(session) for session in sessions]
        
    except Exception as e:
        logger.error(f"SESSION_LIST_ERROR: {str(e)}, TRACEBACK={traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to fetch sessions")

@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific session by ID"""
    
    client_ip = request.client.host if request.client else "unknown"
    
    logger.debug(f"SESSION_GET_REQUEST: SESSION_ID={session_id}, CLIENT_IP={client_ip}")
    
    try:
        query = select(StudySession).where(StudySession.id == session_id)
        result = await db.execute(query)
        session = result.scalar_one_or_none()
        
        if not session:
            logger.warning(f"SESSION_GET_NOT_FOUND: SESSION_ID={session_id}")
            raise HTTPException(status_code=404, detail="Session not found")
        
        logger.debug(f"SESSION_GET_SUCCESS: SESSION_ID={session_id}, PDF_ID={session.pdf_id}, STARTED_AT={session.started_at}, ENDED_AT={session.ended_at}")
        
        return SessionResponse.from_orm(session)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"SESSION_GET_ERROR: SESSION_ID={session_id}, ERROR={str(e)}, TRACEBACK={traceback.format_exc()}")
        raise HTTPException(status_code=500, detail="Failed to fetch session")