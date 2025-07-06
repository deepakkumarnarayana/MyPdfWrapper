import os
import uuid
import fitz  # PyMuPDF
from fastapi import UploadFile
from typing import Dict, Any
from pathlib import Path

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
    
    async def save_pdf(self, file: UploadFile) -> Dict[str, Any]:
        """Save uploaded PDF file and extract metadata"""
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join(self.storage_path, unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Extract metadata
        metadata = self._extract_metadata(file_path)
        
        return {
            "filename": unique_filename,
            "original_filename": file.filename,
            "file_path": file_path,
            "file_size": len(content),
            **metadata
        }
    
    def _extract_metadata(self, file_path: str) -> Dict[str, Any]:
        """Extract metadata from PDF file"""
        try:
            doc = fitz.open(file_path)
            metadata = doc.metadata
            
            return {
                "title": metadata.get("title", "").strip() or None,
                "author": metadata.get("author", "").strip() or None,
                "page_count": len(doc)
            }
        except Exception as e:
            print(f"Error extracting metadata from {file_path}: {e}")
            return {
                "title": None,
                "author": None,
                "page_count": None
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