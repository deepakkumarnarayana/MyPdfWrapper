"""
Cloud-native configuration for PDF processing optimization.

This configuration handles:
- Multi-cloud storage providers (AWS S3, Google Cloud, Azure)
- Performance tuning for large files
- Connection pooling and caching
- Security and compliance settings
- Monitoring and observability
"""

import os
from typing import Optional, Dict, Any, List
from pydantic import BaseSettings, Field, validator
from enum import Enum

class StorageProvider(str, Enum):
    LOCAL = "local"
    AWS_S3 = "aws_s3"
    GOOGLE_CLOUD = "google_cloud"
    AZURE_BLOB = "azure_blob"

class CompressionLevel(int, Enum):
    NONE = 0
    LOW = 1
    MEDIUM = 2
    HIGH = 3

class CloudConfig(BaseSettings):
    """Cloud storage and processing configuration"""
    
    # Storage Provider Configuration
    storage_provider: StorageProvider = Field(
        default=StorageProvider.LOCAL,
        description="Primary storage provider"
    )
    
    fallback_providers: List[StorageProvider] = Field(
        default=[StorageProvider.LOCAL],
        description="Fallback storage providers in order of preference"
    )
    
    # AWS S3 Configuration
    aws_access_key_id: Optional[str] = Field(default=None, env="AWS_ACCESS_KEY_ID")
    aws_secret_access_key: Optional[str] = Field(default=None, env="AWS_SECRET_ACCESS_KEY")
    aws_region: str = Field(default="us-east-1", env="AWS_REGION")
    s3_bucket_name: Optional[str] = Field(default=None, env="S3_BUCKET_NAME")
    s3_prefix: str = Field(default="pdfs/", description="S3 key prefix for PDF files")
    s3_storage_class: str = Field(
        default="STANDARD",
        description="S3 storage class (STANDARD, IA, GLACIER, etc.)"
    )
    
    # Google Cloud Storage Configuration
    gcp_project_id: Optional[str] = Field(default=None, env="GCP_PROJECT_ID")
    gcp_bucket_name: Optional[str] = Field(default=None, env="GCP_BUCKET_NAME")
    gcp_credentials_path: Optional[str] = Field(default=None, env="GOOGLE_APPLICATION_CREDENTIALS")
    
    # Azure Blob Configuration  
    azure_account_name: Optional[str] = Field(default=None, env="AZURE_STORAGE_ACCOUNT")
    azure_account_key: Optional[str] = Field(default=None, env="AZURE_STORAGE_KEY")
    azure_container_name: Optional[str] = Field(default=None, env="AZURE_CONTAINER_NAME")
    
    # Performance Settings
    max_file_size_mb: int = Field(
        default=500,
        description="Maximum PDF file size in MB"
    )
    
    chunk_size_mb: int = Field(
        default=8,
        description="Chunk size for streaming uploads/downloads"
    )
    
    concurrent_workers: int = Field(
        default=4,
        description="Number of concurrent workers for PDF processing"
    )
    
    annotation_batch_size: int = Field(
        default=50,
        description="Number of annotations to process in each batch"
    )
    
    # Caching Configuration
    enable_local_cache: bool = Field(
        default=True,
        description="Enable local filesystem caching"
    )
    
    local_cache_path: str = Field(
        default="/tmp/pdf_cache",
        description="Local cache directory path"
    )
    
    cache_max_size_gb: int = Field(
        default=10,
        description="Maximum cache size in GB"
    )
    
    cache_ttl_hours: int = Field(
        default=24,
        description="Cache TTL in hours"
    )
    
    # Compression and Optimization
    pdf_compression_level: CompressionLevel = Field(
        default=CompressionLevel.MEDIUM,
        description="PDF compression level for storage optimization"
    )
    
    enable_pdf_optimization: bool = Field(
        default=True,
        description="Enable PDF optimization (linearization, etc.)"
    )
    
    image_compression_quality: int = Field(
        default=85,
        ge=1, le=100,
        description="JPEG compression quality for images in PDFs"
    )
    
    # Versioning and Backup
    enable_versioning: bool = Field(
        default=True,
        description="Enable automatic versioning of PDF files"
    )
    
    max_versions_per_file: int = Field(
        default=10,
        description="Maximum number of versions to keep per file"
    )
    
    backup_retention_days: int = Field(
        default=30,
        description="Number of days to retain backup versions"
    )
    
    # Security Settings
    enable_encryption_at_rest: bool = Field(
        default=True,
        description="Enable encryption for stored files"
    )
    
    encryption_key_id: Optional[str] = Field(
        default=None,
        description="KMS key ID for encryption (AWS/GCP/Azure)"
    )
    
    enable_access_logging: bool = Field(
        default=True,
        description="Enable access logging for compliance"
    )
    
    # Network and Reliability
    connection_timeout_seconds: int = Field(
        default=30,
        description="Network connection timeout"
    )
    
    read_timeout_seconds: int = Field(
        default=300,
        description="Read timeout for large file operations"
    )
    
    max_retry_attempts: int = Field(
        default=3,
        description="Maximum retry attempts for failed operations"
    )
    
    retry_backoff_factor: float = Field(
        default=2.0,
        description="Exponential backoff factor for retries"
    )
    
    # Monitoring and Observability
    enable_metrics: bool = Field(
        default=True,
        description="Enable performance metrics collection"
    )
    
    enable_distributed_tracing: bool = Field(
        default=False,
        description="Enable distributed tracing (requires OpenTelemetry setup)"
    )
    
    metrics_endpoint: Optional[str] = Field(
        default=None,
        description="Metrics collection endpoint (Prometheus, etc.)"
    )
    
    # Development and Testing
    local_storage_path: str = Field(
        default="./storage/pdfs",
        description="Local storage path for development"
    )
    
    debug_cloud_operations: bool = Field(
        default=False,
        description="Enable verbose logging for cloud operations"
    )
    
    simulate_cloud_failures: bool = Field(
        default=False,
        description="Simulate cloud failures for testing (dev only)"
    )

    @validator('storage_provider', pre=True)
    def validate_storage_provider(cls, v):
        if isinstance(v, str):
            try:
                return StorageProvider(v.lower())
            except ValueError:
                raise ValueError(f"Invalid storage provider: {v}")
        return v

    @validator('chunk_size_mb')
    def validate_chunk_size(cls, v):
        if v < 1 or v > 100:
            raise ValueError("Chunk size must be between 1 and 100 MB")
        return v

    @validator('concurrent_workers')
    def validate_workers(cls, v):
        if v < 1 or v > 20:
            raise ValueError("Concurrent workers must be between 1 and 20")
        return v

    @property
    def chunk_size_bytes(self) -> int:
        """Get chunk size in bytes"""
        return self.chunk_size_mb * 1024 * 1024

    @property
    def max_file_size_bytes(self) -> int:
        """Get max file size in bytes"""
        return self.max_file_size_mb * 1024 * 1024

    @property
    def cache_max_size_bytes(self) -> int:
        """Get cache max size in bytes"""
        return self.cache_max_size_gb * 1024 * 1024 * 1024

    def get_storage_config(self) -> Dict[str, Any]:
        """Get storage provider specific configuration"""
        if self.storage_provider == StorageProvider.AWS_S3:
            return {
                'provider': 'aws_s3',
                'access_key_id': self.aws_access_key_id,
                'secret_access_key': self.aws_secret_access_key,
                'region': self.aws_region,
                'bucket': self.s3_bucket_name,
                'prefix': self.s3_prefix,
                'storage_class': self.s3_storage_class
            }
        elif self.storage_provider == StorageProvider.GOOGLE_CLOUD:
            return {
                'provider': 'google_cloud',
                'project_id': self.gcp_project_id,
                'bucket': self.gcp_bucket_name,
                'credentials_path': self.gcp_credentials_path
            }
        elif self.storage_provider == StorageProvider.AZURE_BLOB:
            return {
                'provider': 'azure_blob',
                'account_name': self.azure_account_name,
                'account_key': self.azure_account_key,
                'container': self.azure_container_name
            }
        else:
            return {
                'provider': 'local',
                'path': self.local_storage_path
            }

    def get_performance_config(self) -> Dict[str, Any]:
        """Get performance tuning configuration"""
        return {
            'max_file_size_bytes': self.max_file_size_bytes,
            'chunk_size_bytes': self.chunk_size_bytes,
            'concurrent_workers': self.concurrent_workers,
            'annotation_batch_size': self.annotation_batch_size,
            'compression_level': self.pdf_compression_level,
            'enable_optimization': self.enable_pdf_optimization,
            'image_quality': self.image_compression_quality
        }

    def get_reliability_config(self) -> Dict[str, Any]:
        """Get reliability and retry configuration"""
        return {
            'connection_timeout': self.connection_timeout_seconds,
            'read_timeout': self.read_timeout_seconds,
            'max_retries': self.max_retry_attempts,
            'backoff_factor': self.retry_backoff_factor,
            'enable_versioning': self.enable_versioning,
            'max_versions': self.max_versions_per_file
        }

    class Config:
        env_file = ".env"
        env_file_encoding = 'utf-8'
        case_sensitive = False

# Global configuration instance
_cloud_config: Optional[CloudConfig] = None

def get_cloud_config() -> CloudConfig:
    """Get global cloud configuration instance"""
    global _cloud_config
    if _cloud_config is None:
        _cloud_config = CloudConfig()
    return _cloud_config

def set_cloud_config(config: CloudConfig) -> None:
    """Set global cloud configuration (for testing)"""
    global _cloud_config
    _cloud_config = config

# Preset configurations for common scenarios

def get_development_config() -> CloudConfig:
    """Development configuration with local storage and debugging"""
    return CloudConfig(
        storage_provider=StorageProvider.LOCAL,
        max_file_size_mb=100,
        concurrent_workers=2,
        enable_local_cache=True,
        debug_cloud_operations=True,
        enable_versioning=False,
        pdf_compression_level=CompressionLevel.LOW
    )

def get_production_aws_config() -> CloudConfig:
    """Production configuration optimized for AWS S3"""
    return CloudConfig(
        storage_provider=StorageProvider.AWS_S3,
        fallback_providers=[StorageProvider.LOCAL],
        max_file_size_mb=500,
        chunk_size_mb=16,
        concurrent_workers=8,
        annotation_batch_size=100,
        enable_local_cache=True,
        cache_max_size_gb=50,
        pdf_compression_level=CompressionLevel.HIGH,
        enable_pdf_optimization=True,
        enable_versioning=True,
        max_versions_per_file=20,
        enable_encryption_at_rest=True,
        enable_metrics=True,
        max_retry_attempts=5
    )

def get_high_performance_config() -> CloudConfig:
    """High-performance configuration for large-scale deployments"""
    return CloudConfig(
        storage_provider=StorageProvider.AWS_S3,
        max_file_size_mb=1000,
        chunk_size_mb=32,
        concurrent_workers=16,
        annotation_batch_size=200,
        enable_local_cache=True,
        cache_max_size_gb=100,
        cache_ttl_hours=48,
        pdf_compression_level=CompressionLevel.HIGH,
        enable_pdf_optimization=True,
        connection_timeout_seconds=60,
        read_timeout_seconds=600,
        max_retry_attempts=5,
        retry_backoff_factor=1.5,
        enable_metrics=True,
        enable_distributed_tracing=True
    )