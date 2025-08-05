from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float, Enum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.sqlite import JSON  # SQLite JSON support
from app.database import Base
import enum
from datetime import datetime, timedelta


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    pdfs = relationship("PDF", back_populates="owner", cascade="all, delete-orphan")


class DocumentType(enum.Enum):
    BOOK = "book"
    RESEARCH_PAPER = "research_paper"
    ARTICLE = "article"
    MANUAL = "manual"

class PDF(Base):
    __tablename__ = "pdfs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    filename = Column(String, unique=True, index=True, nullable=False)
    original_filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    title = Column(String, nullable=True)
    author = Column(String, nullable=True)  # Keep for backwards compatibility
    page_count = Column(Integer, nullable=True)
    file_size = Column(Integer, nullable=True)
    storage_provider = Column(String, nullable=False, server_default="local", default="local")
    
    # New unified document fields
    document_type = Column(Enum(DocumentType), nullable=False, default=DocumentType.BOOK, index=True)
    authors = Column(JSON, nullable=True)  # JSON array for multiple authors
    type_metadata = Column(JSON, nullable=True)  # Type-specific metadata
    processing_status = Column(String, default="completed", index=True)  # pending, processing, completed, failed
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    owner = relationship("User", back_populates="pdfs")
    flashcards = relationship("Flashcard", back_populates="pdf", cascade="all, delete-orphan")
    annotations = relationship("Annotation", back_populates="pdf", cascade="all, delete-orphan")


class FlashcardSource(enum.Enum):
    MANUAL = "manual"
    AI = "ai"


class Flashcard(Base):
    __tablename__ = "flashcards"
    
    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=True)
    context_text = Column(Text, nullable=True)  # The highlighted text
    coordinates = Column(JSON, nullable=True)  # Position of the highlight on the page
    source = Column(Enum(FlashcardSource), nullable=False, default=FlashcardSource.AI, index=True)
    difficulty = Column(String, default="medium")  # easy, medium, hard
    category = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Study tracking
    times_reviewed = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    last_reviewed = Column(DateTime, nullable=True)
    next_review = Column(DateTime, nullable=True)
    
    # Relationships
    pdf = relationship("PDF", back_populates="flashcards")

class Annotation(Base):
    __tablename__ = "annotations"
    
    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=False)
    page_number = Column(Integer, nullable=False)
    x_coordinate = Column(Float, nullable=False)
    y_coordinate = Column(Float, nullable=False)
    width = Column(Float, nullable=False)
    height = Column(Float, nullable=False)
    text = Column(Text, nullable=True)
    note = Column(Text, nullable=True)
    annotation_type = Column(String, default="highlight")  # highlight, note, bookmark
    color = Column(String, default="#ffff00")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Relationships
    pdf = relationship("PDF", back_populates="annotations")

class StudySession(Base):
    __tablename__ = "study_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    pdf_id = Column(Integer, ForeignKey("pdfs.id"), nullable=False)
    started_at = Column(DateTime, server_default=func.now())
    ended_at = Column(DateTime, nullable=True)
    
    # Reading session tracking
    start_page = Column(Integer, nullable=True)
    end_page = Column(Integer, nullable=True)
    pages_read = Column(Integer, default=0)
    highlights = Column(JSON, nullable=True)  # Store highlighted text and coordinates
    
    # Study tracking (flashcards)
    flashcards_reviewed = Column(Integer, default=0)
    correct_answers = Column(Integer, default=0)
    total_time_minutes = Column(Integer, default=0)
    
    # Session type
    session_type = Column(String, default="reading")  # reading, study, review
    
    # Relationships
    pdf = relationship("PDF")


# AI Proxy Models for Usage Tracking, Rate Limiting, and Cost Management

class AIProvider(enum.Enum):
    CLAUDE = "claude"
    OPENAI = "openai"
    GEMINI = "gemini"

class AIRequestStatus(enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"
    CACHED = "cached"
    RATE_LIMITED = "rate_limited"

class AIUsageLog(Base):
    """Comprehensive logging for all AI API requests and responses"""
    __tablename__ = "ai_usage_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Nullable for anonymous usage
    session_id = Column(String, nullable=True, index=True)  # For session-based tracking
    
    # Request details
    provider = Column(Enum(AIProvider), nullable=False, index=True)
    model = Column(String, nullable=False, index=True)
    endpoint = Column(String, nullable=False)  # /v1/chat/completions, /v1/messages, etc.
    request_hash = Column(String, nullable=False, index=True)  # Hash for caching
    
    # Content and usage
    request_tokens = Column(Integer, nullable=True)
    response_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    request_size_bytes = Column(Integer, nullable=True)
    response_size_bytes = Column(Integer, nullable=True)
    
    # Status and performance
    status = Column(Enum(AIRequestStatus), nullable=False, index=True)
    response_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    error_code = Column(String, nullable=True)
    
    # Cost tracking
    estimated_cost_usd = Column(Float, default=0.0)
    
    # Metadata
    user_agent = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    request_metadata = Column(JSON, nullable=True)  # Additional context
    
    created_at = Column(DateTime, server_default=func.now(), index=True)
    
    # Composite indexes for performance
    __table_args__ = (
        Index('idx_user_provider_date', 'user_id', 'provider', 'created_at'),
        Index('idx_session_date', 'session_id', 'created_at'),
        Index('idx_request_hash_status', 'request_hash', 'status'),
    )

class AIRateLimit(Base):
    """Rate limiting buckets for AI API requests"""
    __tablename__ = "ai_rate_limits"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    session_id = Column(String, nullable=True, index=True)
    provider = Column(Enum(AIProvider), nullable=False, index=True)
    
    # Rate limiting windows
    minute_window = Column(DateTime, nullable=False, index=True)
    hour_window = Column(DateTime, nullable=False, index=True)
    day_window = Column(DateTime, nullable=False, index=True)
    
    # Counters
    requests_per_minute = Column(Integer, default=0)
    requests_per_hour = Column(Integer, default=0)
    requests_per_day = Column(Integer, default=0)
    tokens_per_minute = Column(Integer, default=0)
    tokens_per_hour = Column(Integer, default=0)
    tokens_per_day = Column(Integer, default=0)
    
    # Cost tracking
    cost_per_hour = Column(Float, default=0.0)
    cost_per_day = Column(Float, default=0.0)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    # Composite indexes
    __table_args__ = (
        Index('idx_user_provider_windows', 'user_id', 'provider', 'minute_window'),
        Index('idx_session_provider_windows', 'session_id', 'provider', 'hour_window'),
    )

class AIResponseCache(Base):
    """Redis-backed persistent cache for AI responses"""
    __tablename__ = "ai_response_cache"
    
    id = Column(Integer, primary_key=True, index=True)
    request_hash = Column(String, unique=True, nullable=False, index=True)
    provider = Column(Enum(AIProvider), nullable=False, index=True)
    model = Column(String, nullable=False)
    
    # Cache data
    request_data = Column(JSON, nullable=False)  # Normalized request
    response_data = Column(JSON, nullable=False)  # Full response
    response_tokens = Column(Integer, nullable=True)
    estimated_cost_usd = Column(Float, default=0.0)
    
    # Cache metadata
    hit_count = Column(Integer, default=0)
    last_accessed = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False, index=True)
    
    created_at = Column(DateTime, server_default=func.now())
    
    # Clean up expired entries
    __table_args__ = (
        Index('idx_expires_provider', 'expires_at', 'provider'),
    )

class AICircuitBreaker(Base):
    """Circuit breaker state for AI providers"""
    __tablename__ = "ai_circuit_breakers"
    
    id = Column(Integer, primary_key=True, index=True)
    provider = Column(Enum(AIProvider), unique=True, nullable=False, index=True)
    model = Column(String, nullable=True)  # Model-specific circuit breaker
    
    # Circuit breaker state
    state = Column(String, default="closed")  # closed, open, half_open
    failure_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    last_failure_time = Column(DateTime, nullable=True)
    last_success_time = Column(DateTime, nullable=True)
    next_attempt_time = Column(DateTime, nullable=True)
    
    # Configuration
    failure_threshold = Column(Integer, default=5)
    recovery_timeout_seconds = Column(Integer, default=60)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class AIQuotaLimit(Base):
    """Daily/monthly quota limits for cost control"""
    __tablename__ = "ai_quota_limits"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    provider = Column(Enum(AIProvider), nullable=False, index=True)
    
    # Quota periods
    daily_limit_usd = Column(Float, default=10.0)
    monthly_limit_usd = Column(Float, default=100.0)
    daily_request_limit = Column(Integer, default=1000)
    monthly_request_limit = Column(Integer, default=10000)
    
    # Current usage (resets daily/monthly)
    daily_spent_usd = Column(Float, default=0.0)
    monthly_spent_usd = Column(Float, default=0.0)
    daily_requests = Column(Integer, default=0)
    monthly_requests = Column(Integer, default=0)
    
    # Reset tracking
    last_daily_reset = Column(DateTime, server_default=func.now())
    last_monthly_reset = Column(DateTime, server_default=func.now())
    
    # Status
    is_daily_exceeded = Column(Boolean, default=False)
    is_monthly_exceeded = Column(Boolean, default=False)
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    __table_args__ = (
        Index('idx_user_provider_quota', 'user_id', 'provider'),
    )