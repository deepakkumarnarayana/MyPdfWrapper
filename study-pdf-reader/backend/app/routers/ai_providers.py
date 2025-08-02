from fastapi import APIRouter
from typing import List
import os

router = APIRouter()

@router.get("/ai-providers")
async def get_ai_providers():
    """Get list of available AI providers"""
    providers = [
        {
            "id": "claude",
            "name": "Claude",
            "isActive": bool(os.getenv("CLAUDE_API_KEY")),
            "status": "Connected" if os.getenv("CLAUDE_API_KEY") else "Disconnected",
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