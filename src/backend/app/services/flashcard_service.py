import os
import json
from anthropic import Anthropic
from app.services.pdf_service import PDFService
from app.config import get_settings
from typing import List, Dict, Any

class FlashcardService:
    def __init__(self):
        settings = get_settings()
        self.client = Anthropic(api_key=settings.claude_api_key.get_secret_value())
        self.pdf_service = PDFService()
    
    async def generate_flashcards(self, file_path: str, max_flashcards: int = 10) -> List[Dict[str, Any]]:
        """Generate flashcards from PDF content using Claude API"""
        
        # Extract text from PDF
        text = self.pdf_service.extract_text(file_path)
        
        if not text.strip():
            raise ValueError("No text found in PDF file")
        
        # Prepare prompt for Claude
        prompt = f"""
        Please analyze the following PDF content and create {max_flashcards} educational flashcards.
        
        For each flashcard, provide:
        1. A clear, concise question
        2. A comprehensive answer
        3. Difficulty level (easy, medium, hard)
        4. Category/topic if applicable
        5. Page number if you can determine it from context
        
        Format the response as a JSON array with the following structure:
        [
            {{
                "question": "Question text here",
                "answer": "Answer text here",
                "difficulty": "medium",
                "category": "Topic name",
                "page_number": 1
            }}
        ]
        
        Focus on:
        - Key concepts and definitions
        - Important facts and figures
        - Relationships between ideas
        - Application of concepts
        - Critical thinking questions
        
        PDF Content:
        {text[:8000]}  # Limit to first 8000 characters to stay within token limits
        """
        
        try:
            # Call Claude API
            response = self.client.messages.create(
                model="claude-3-sonnet-20240229",
                max_tokens=2000,
                temperature=0.7,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            # Parse response
            content = response.content[0].text
            
            # Extract JSON from response
            json_start = content.find('[')
            json_end = content.rfind(']') + 1
            
            if json_start == -1 or json_end == 0:
                raise ValueError("No valid JSON found in response")
            
            json_content = content[json_start:json_end]
            flashcards_data = json.loads(json_content)
            
            # Validate and clean flashcards
            valid_flashcards = []
            for flashcard in flashcards_data:
                if self._validate_flashcard(flashcard):
                    valid_flashcards.append(flashcard)
            
            return valid_flashcards
            
        except Exception as e:
            print(f"Error generating flashcards: {e}")
            # Return fallback flashcards if API fails
            return self._generate_fallback_flashcards(text)
    
    def _validate_flashcard(self, flashcard: Dict[str, Any]) -> bool:
        """Validate flashcard data structure"""
        required_fields = ["question", "answer"]
        
        for field in required_fields:
            if field not in flashcard or not flashcard[field].strip():
                return False
        
        # Set default values for optional fields
        flashcard.setdefault("difficulty", "medium")
        flashcard.setdefault("category", None)
        flashcard.setdefault("page_number", None)
        
        return True
    
    def _generate_fallback_flashcards(self, text: str) -> List[Dict[str, Any]]:
        """Generate simple fallback flashcards if API fails"""
        # Simple fallback: create flashcards from first few sentences
        sentences = text.split('. ')[:5]
        
        fallback_flashcards = []
        for i, sentence in enumerate(sentences):
            if len(sentence.strip()) > 20:  # Only use substantial sentences
                flashcard = {
                    "question": f"What is mentioned about: {sentence[:50]}...?",
                    "answer": sentence.strip(),
                    "difficulty": "medium",
                    "category": "General",
                    "page_number": 1
                }
                fallback_flashcards.append(flashcard)
        
        return fallback_flashcards[:3]  # Return max 3 fallback flashcards