import os
import uuid
import pymupdf as fitz  # PyMuPDF
from fastapi import UploadFile
from typing import Dict, Any
from pathlib import Path
from app.models import DocumentType

class PDFService:
    def __init__(self):
        # Get the project root directory (parent of backend)
        project_root = Path(__file__).parent.parent.parent.parent
        default_storage = project_root / "storage" / "pdfs"
        self.storage_path = os.getenv("PDF_STORAGE_PATH", str(default_storage))
        self._ensure_storage_directory()
    
    def _ensure_storage_directory(self):
        """Ensure the storage directory exists"""
        os.makedirs(self.storage_path, exist_ok=True)
    
    async def save_pdf(self, file: UploadFile, document_type: DocumentType = DocumentType.BOOK) -> Dict[str, Any]:
        """Save uploaded PDF file and extract metadata with type-specific processing"""
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(self.storage_path, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Extract base metadata
        base_metadata = self._extract_metadata(file_path)
        
        # Extract type-specific metadata
        type_metadata = self._extract_type_specific_metadata(file_path, document_type)
        
        return {
            "filename": unique_filename,
            "original_filename": file.filename,
            "file_path": file_path,
            "file_size": len(content),
            **base_metadata,
            **type_metadata
        }
    
    def _extract_metadata(self, file_path: str) -> Dict[str, Any]:
        """Extract metadata from PDF file path"""
        try:
            doc = fitz.open(file_path)
            return self._parse_fitz_metadata(doc)
        except Exception as e:
            print(f"Error extracting metadata from {file_path}: {e}")
            return {"title": None, "author": None, "page_count": None}

    def _extract_metadata_from_content(self, content: bytes) -> Dict[str, Any]:
        """Extract metadata from PDF file content in memory"""
        try:
            doc = fitz.open(stream=content, filetype="pdf")
            return self._parse_fitz_metadata(doc)
        except Exception as e:
            print(f"Error extracting metadata from content: {e}")
            return {"title": None, "author": None, "page_count": None}

    def _parse_fitz_metadata(self, doc: fitz.Document) -> Dict[str, Any]:
        """Helper to parse metadata from a fitz Document"""
        metadata = doc.metadata
        return {
            "title": metadata.get("title", "").strip() or None,
            "author": metadata.get("author", "").strip() or None,
            "page_count": len(doc)
        }
    
    def _extract_type_specific_metadata(self, file_path: str, document_type: DocumentType) -> Dict[str, Any]:
        """Extract type-specific metadata based on document type"""
        try:
            doc = fitz.open(file_path)
            
            if document_type == DocumentType.BOOK:
                return self._extract_book_metadata(doc)
            elif document_type == DocumentType.RESEARCH_PAPER:
                return self._extract_research_paper_metadata(doc)
            else:
                return {}
                
        except Exception as e:
            print(f"Error extracting type-specific metadata from {file_path}: {e}")
            return {}
    
    def _extract_book_metadata(self, doc: fitz.Document) -> Dict[str, Any]:
        """Extract book-specific metadata"""
        # For now, return placeholder values
        # In production, you'd implement ISBN extraction, genre classification, etc.
        return {
            "isbn": None,  # Could extract from text using regex
            "publisher": None,  # Could extract from metadata or first few pages
            "genre": None,  # Could classify using AI/ML
        }
    
    def _extract_research_paper_metadata(self, doc: fitz.Document) -> Dict[str, Any]:
        """Extract research paper-specific metadata"""
        # For now, return placeholder values
        # In production, you'd implement DOI extraction, keyword extraction, etc.
        return {
            "doi": None,  # Could extract from text using regex patterns
            "journal": None,  # Could extract from header/footer text
            "keywords": [],  # Could extract using NLP
            "citation_count": 0,  # Would need to query external APIs
        }
    
    def extract_text(self, file_path: str, page_number: int = None) -> str:
        """Extract text from PDF file"""
        try:
            doc = fitz.open(file_path)
            
            if page_number is not None:
                # Extract text from specific page
                if 0 <= page_number < len(doc):
                    page = doc[page_number]
                    return page.get_text()
                else:
                    raise ValueError(f"Page {page_number} not found in PDF")
            else:
                # Extract text from all pages
                text = ""
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    text += page.get_text() + "\n"
                return text
        except Exception as e:
            print(f"Error extracting text from {file_path}: {e}")
            return ""
    
    def get_page_count(self, file_path: str) -> int:
        """Get number of pages in PDF"""
        try:
            doc = fitz.open(file_path)
            return len(doc)
        except Exception as e:
            print(f"Error getting page count from {file_path}: {e}")
            return 0