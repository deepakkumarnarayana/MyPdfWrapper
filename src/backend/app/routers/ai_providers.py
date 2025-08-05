from fastapi import APIRouter
from typing import List
from app.config import get_settings
import os

router = APIRouter()

@router.get("/ai-providers")
async def get_ai_providers():
    """Get list of available AI providers"""
    settings = get_settings()
    claude_key = settings.claude_api_key.get_secret_value()
    claude_active = claude_key and claude_key != "your_claude_api_key_here"
    
    providers = [
        {
            "id": "claude",
            "name": "Claude",
            "isActive": claude_active,
            "status": "Connected" if claude_active else "Disconnected",
            "lastUsed": "2025-01-20T10:30:00Z"
        },
        {
            "id": "openai",
            "name": "OpenAI GPT",
            "isActive": False,
            "status": "Disconnected",
            "lastUsed": "2025-01-15T14:20:00Z"
        }
    ]
    return providers

@router.post("/ai-providers/{provider_id}/select")
async def select_ai_provider(provider_id: str):
    """Select an AI provider"""
    return {"success": True, "message": f"Selected AI provider: {provider_id}"}