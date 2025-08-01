from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Annotation Schemas
class AnnotationBase(BaseModel):
    page_number: int
    x_coordinate: float
    y_coordinate: float
    width: float
    height: float
    text: Optional[str] = None
    note: Optional[str] = None
    annotation_type: str = "highlight"
    color: str = "#ffff00"

class AnnotationCreate(AnnotationBase):
    pass

class AnnotationResponse(AnnotationBase):
    id: int
    pdf_id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True
