from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import jwt
import os
from datetime import datetime, timedelta
from ..config import get_settings

router = APIRouter(prefix="/auth", tags=["authentication"])
security = HTTPBearer(auto_error=False)
settings = get_settings()

# Simple development user for testing
DEV_USER = {
    "id": "dev-user",
    "name": "Development User",
    "email": "dev@example.com",
    "preferences": {
        "theme": "light",
        "notifications": True
    }
}

# Simple authentication for development vs production
class AuthManager:
    def __init__(self):
        self.secret_key = settings.claude_api_key.get_secret_value()[:32]  # Use part of API key as JWT secret
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 1440  # 24 hours
    
    def create_access_token(self, user_id: str) -> str:
        """Create JWT token for user"""
        expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        to_encode = {"sub": user_id, "exp": expire}
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str) -> Optional[dict]:
        """Verify JWT token and return user info"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            user_id: str = payload.get("sub")
            if user_id is None:
                return None
            return {"id": user_id}
        except jwt.PyJWTError:
            return None
    
    def authenticate_user(self, username: str, password: str) -> Optional[dict]:
        """Simple authentication - in production, use proper password hashing"""
        if settings.environment == "development":
            # Development mode - accept any credentials
            return DEV_USER
        
        # Production mode - implement real authentication
        # For now, use simple hardcoded credentials (should be database-backed)
        if username == "admin" and password == os.getenv("ADMIN_PASSWORD", "secure_password_123"):
            return {
                "id": "admin",
                "name": "Admin User",
                "email": "admin@example.com",
                "preferences": {"theme": "light", "notifications": True}
            }
        return None

auth_manager = AuthManager()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to get current authenticated user"""
    if settings.environment == "development" and not credentials:
        # Development mode - allow anonymous access
        return DEV_USER
    
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = auth_manager.verify_token(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

@router.get("/check")
async def check_auth(current_user: dict = Depends(get_current_user)):
    """
    Check authentication status with proper user verification
    """
    return {
        "authenticated": True,
        "user": current_user,
        "environment": settings.environment
    }

@router.post("/login")
async def login(credentials: dict):
    """Login endpoint with environment-aware authentication"""
    username = credentials.get("username", "")
    password = credentials.get("password", "")
    
    user = auth_manager.authenticate_user(username, password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token = auth_manager.create_access_token(user["id"])
    
    return {
        "success": True,
        "message": f"Login successful in {settings.environment} mode",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.post("/logout")
async def logout():
    """Placeholder logout endpoint"""
    return {"success": True, "message": "Logged out successfully"}

@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get user profile with proper authentication"""
    return current_user

@router.get("/notifications")
async def get_notifications(current_user: dict = Depends(get_current_user)):
    """Get user notifications with proper authentication"""
    # Return empty notifications for now
    return []