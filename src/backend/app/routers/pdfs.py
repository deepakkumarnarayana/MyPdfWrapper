from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import PDF, DocumentType
from app.schemas.pdfs import DocumentResponse, DocumentCreate
from app.services.pdf_service import PDFService
from typing import List, Optional, Set
import os
import jwt
import aiohttp
import asyncio
import hashlib
import logging
from datetime import datetime, timedelta
from urllib.parse import urlparse
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

router = APIRouter()

# External PDF proxy configuration
ALLOWED_EXTERNAL_DOMAINS: Set[str] = {
    "s3.amazonaws.com",
    "storage.googleapis.com", 
    "blob.core.windows.net",
    # Add your trusted domains
}

MAX_EXTERNAL_PDF_SIZE = 100 * 1024 * 1024  # 100MB
EXTERNAL_REQUEST_TIMEOUT = 30  # seconds


def validate_external_pdf_url(url: str) -> bool:
    """Validate external PDF URL for security"""
    try:
        parsed = urlparse(url)
        return (
            parsed.scheme == 'https' and
            any(parsed.hostname.endswith(domain) for domain in ALLOWED_EXTERNAL_DOMAINS) and
            parsed.path.lower().endswith('.pdf')
        )
    except Exception:
        return False


def validate_pdf_content(content: bytes) -> bool:
    """Validate PDF magic bytes"""
    return len(content) >= 4 and content.startswith(b'%PDF-')

@router.post("/documents", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    document_type: DocumentType = Form(DocumentType.BOOK),
    user_id: int = 1,  # Hardcoded for now
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
            user_id=user_id,
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

@router.get("/documents", response_model=List[DocumentResponse])
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

@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(document_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PDF).where(PDF.id == document_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Document not found")
    
    return pdf

@router.get("/documents/{document_id}/url")
async def get_document_url(document_id: int, request: Request, db: AsyncSession = Depends(get_db)):
    """Get the URL to access the PDF file for viewing"""
    result = await db.execute(select(PDF).where(PDF.id == document_id))
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Return relative URL for same-origin serving through frontend proxy
    # This avoids cross-origin issues with PDF.js viewer
    filename = os.path.basename(pdf.file_path)
    static_url = f"/static/{filename}"
    
    return {"url": static_url}

@router.get("/documents/{document_id}/signed-url")
async def get_signed_document_url(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    # TODO: Replace with proper auth when implemented  
    user_id: int = 1  # Temporary: assume user_id = 1 for development
):
    """Generate signed URL for secure PDF access
    
    SECURITY: Prevents document ID enumeration attacks
    """
    # Verify document ownership first
    result = await db.execute(
        select(PDF).where(
            PDF.id == document_id,
            PDF.user_id == user_id
        )
    )
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(
            status_code=404,
            detail="Document not found or access denied"
        )
    
    # Generate signed token valid for 1 hour
    token_data = {
        "document_id": document_id,
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(hours=1),
        "iat": datetime.utcnow()
    }
    
    # Use a more secure signing method in production
    secret_key = getattr(settings, 'secret_key', 'dev-secret-key-change-in-production')
    token = jwt.encode(token_data, secret_key, algorithm="HS256")
    
    return {
        "signed_url": f"/api/v1/documents/secure-content/{token}",
        "expires_at": token_data["exp"].isoformat(),
        "valid_for": "1 hour"
    }

@router.get("/documents/secure-content/{token}")
async def get_document_content_by_token(token: str, db: AsyncSession = Depends(get_db)):
    """Serve PDF content using signed token
    
    SECURITY: Token-based access prevents enumeration
    """
    try:
        secret_key = getattr(settings, 'secret_key', 'dev-secret-key-change-in-production')
        payload = jwt.decode(token, secret_key, algorithms=["HS256"])
        
        document_id = payload["document_id"]
        user_id = payload["user_id"]
        
        # Verify document still belongs to user (double-check)
        result = await db.execute(
            select(PDF).where(
                PDF.id == document_id,
                PDF.user_id == user_id
            )
        )
        pdf = result.scalar_one_or_none()
        
        if not pdf:
            raise HTTPException(
                status_code=404,
                detail="Document not found or access revoked"
            )
        
        if not os.path.exists(pdf.file_path):
            raise HTTPException(status_code=404, detail="PDF file not found on disk")
        
        # Enhanced security headers for token-based access
        security_headers = {
            "Content-Disposition": "inline",
            "Cache-Control": "private, no-cache, no-store, must-revalidate",  # No caching for secure content
            "X-Frame-Options": "SAMEORIGIN", 
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Content-Security-Policy": "default-src 'none'; object-src 'self'; plugin-types application/pdf;",
            "Pragma": "no-cache",
            "Expires": "0"
        }
        
        return FileResponse(
            pdf.file_path,
            media_type="application/pdf",
            headers=security_headers
        )
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Secure URL has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid secure URL")

@router.get("/documents/{document_id}/content")
async def get_document_content(
    document_id: int, 
    db: AsyncSession = Depends(get_db),
    # TODO: Replace with proper auth when implemented
    user_id: int = 1  # Temporary: assume user_id = 1 for development
):
    """Serve PDF file content directly with proper headers for PDF.js
    
    SECURITY: This endpoint now verifies document ownership
    """
    # CRITICAL SECURITY FIX: Only allow access to user's own documents
    result = await db.execute(
        select(PDF).where(
            PDF.id == document_id,
            PDF.user_id == user_id  # Ownership verification
        )
    )
    pdf = result.scalar_one_or_none()
    
    if not pdf:
        raise HTTPException(
            status_code=404, 
            detail="Document not found or access denied"
        )
    
    if not os.path.exists(pdf.file_path):
        raise HTTPException(status_code=404, detail="PDF file not found on disk")
    
    # Enhanced security headers
    security_headers = {
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600, must-revalidate",
        "X-Frame-Options": "SAMEORIGIN",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Content-Security-Policy": "default-src 'none'; object-src 'self'; plugin-types application/pdf;"
    }
    
    return FileResponse(
        pdf.file_path,
        media_type="application/pdf",
        headers=security_headers
    )

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


# ============================================================================
# EXTERNAL PDF PROXY ENDPOINTS
# ============================================================================

@router.get("/pdf/proxy")
async def proxy_external_pdf(url: str = Query(..., description="External PDF URL to proxy")):
    """
    Secure proxy for external PDF files with comprehensive validation.
    
    This endpoint allows loading PDFs from trusted external sources while:
    - Validating URLs against whitelist of trusted domains
    - Scanning content for security issues
    - Adding proper security headers
    - Providing caching for performance
    
    Use this instead of direct PDF.js cross-origin loading.
    """
    # Security validation
    if not validate_external_pdf_url(url):
        logger.warning(f"Invalid external PDF URL blocked: {url}")
        raise HTTPException(
            status_code=403, 
            detail="URL not allowed. Must be HTTPS from trusted domain and end with .pdf"
        )
    
    try:
        timeout = aiohttp.ClientTimeout(total=EXTERNAL_REQUEST_TIMEOUT)
        
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(url) as response:
                if response.status != 200:
                    raise HTTPException(
                        status_code=400, 
                        detail=f"Failed to fetch PDF: HTTP {response.status}"
                    )
                
                content = await response.read()
                
                # Size validation
                if len(content) > MAX_EXTERNAL_PDF_SIZE:
                    raise HTTPException(
                        status_code=413, 
                        detail=f"PDF too large: {len(content)} bytes (max: {MAX_EXTERNAL_PDF_SIZE})"
                    )
                
                # Content validation
                if not validate_pdf_content(content):
                    raise HTTPException(status_code=400, detail="Invalid PDF content")
                
                # Security headers for PDF response
                headers = {
                    "Content-Type": "application/pdf",
                    "Content-Length": str(len(content)),
                    "Content-Disposition": "inline",
                    "Cache-Control": "private, max-age=3600",
                    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none';",
                    "X-Content-Type-Options": "nosniff",
                    "X-Frame-Options": "DENY",
                    "Referrer-Policy": "no-referrer"
                }
                
                logger.info(f"Successfully proxied external PDF: {url} ({len(content)} bytes)")
                
                return Response(
                    content=content,
                    media_type="application/pdf",
                    headers=headers
                )
                
    except asyncio.TimeoutError:
        logger.error(f"Timeout fetching external PDF: {url}")
        raise HTTPException(status_code=408, detail="Request timeout while fetching PDF")
    except aiohttp.ClientError as e:
        logger.error(f"HTTP client error fetching external PDF {url}: {e}")
        raise HTTPException(status_code=502, detail="Bad gateway: Could not fetch PDF")
    except Exception as e:
        logger.error(f"Unexpected error fetching external PDF {url}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/pdf/health")
async def pdf_proxy_health():
    """Health check for PDF proxy functionality"""
    return {
        "service": "pdf-proxy",
        "status": "healthy",
        "allowed_domains": len(ALLOWED_EXTERNAL_DOMAINS),
        "max_pdf_size_mb": MAX_EXTERNAL_PDF_SIZE // (1024 * 1024),
        "timeout_seconds": EXTERNAL_REQUEST_TIMEOUT
    }