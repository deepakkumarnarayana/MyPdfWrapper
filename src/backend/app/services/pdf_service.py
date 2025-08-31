import os
import uuid
import pymupdf as fitz  # PyMuPDF
from fastapi import UploadFile
from typing import Dict, Any
from pathlib import Path
from app.models import DocumentType
from app.config import get_settings

class PDFService:
    def __init__(self):
        # Use centralized settings for PDF storage path
        settings = get_settings()
        self.storage_path = settings.actual_pdf_storage_path
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
    
    def process_annotations_background(self, file_path: str, annotations: list) -> Dict[str, Any]:
        """Process and save annotations to PDF file using PyMuPDF"""
        try:
            doc = fitz.open(file_path)
            processed_count = 0
            errors = []
            
            # Clear existing annotations first
            for page_num in range(len(doc)):
                page = doc[page_num]
                annots = page.annots()
                for annot in annots:
                    page.delete_annot(annot)
            
            # Add new annotations
            for annotation in annotations:
                try:
                    page_number = annotation.get("page_number", 1) - 1  # Convert to 0-based
                    if page_number < 0 or page_number >= len(doc):
                        continue
                        
                    page = doc[page_number]
                    
                    # Create highlight annotation
                    # Get coordinates from the coordinates dict stored by flashcard annotation service
                    coordinates = annotation.get("coordinates", {})
                    x_norm = coordinates.get("x", 0)
                    y_norm = coordinates.get("y", 0) 
                    width_norm = coordinates.get("width", 100)
                    height_norm = coordinates.get("height", 20)
                    
                    # DEBUG: Log coordinate values
                    print(f"[PDF_SERVICE_DEBUG] Normalized coords from frontend: x={x_norm}, y={y_norm}, width={width_norm}, height={height_norm}")
                    
                    # PDF.js sends normalized coordinates (0-1), convert to absolute coordinates
                    # Both PDF.js and PyMuPDF use same coordinate system (top-left origin)
                    page_rect = page.rect
                    page_width = page_rect.width
                    page_height = page_rect.height
                    
                    # Convert normalized to absolute coordinates
                    x = x_norm * page_width
                    y = y_norm * page_height
                    width = width_norm * page_width
                    height = height_norm * page_height
                    
                    print(f"[PDF_SERVICE_DEBUG] Page dimensions: {page_width} x {page_height}")
                    print(f"[PDF_SERVICE_DEBUG] Converted to absolute coordinates: x={x}, y={y}, width={width}, height={height}")
                    
                    # PyMuPDF coordinate system - both PDF.js and PyMuPDF use top-left origin
                    # Create rectangle with absolute coordinates
                    rect = fitz.Rect(x, y, x + width, y + height)
                    
                    # Add highlight annotation
                    highlight = page.add_highlight_annot(rect)
                    highlight.set_colors({"stroke": [1, 1, 0]})  # Yellow highlight
                    highlight.update()
                    
                    processed_count += 1
                    
                except Exception as e:
                    errors.append(f"Failed to process annotation: {str(e)}")
            
            # Save the PDF
            doc.save(file_path, incremental=True, encryption=fitz.PDF_ENCRYPT_KEEP)
            doc.close()
            
            return {
                "status": "success",
                "processed_count": processed_count,
                "errors": errors,
                "message": f"Processed {processed_count} annotations"
            }
            
        except Exception as e:
            return {
                "status": "error", 
                "processed_count": 0,
                "errors": [str(e)],
                "message": f"Failed to process annotations: {str(e)}"
            }
