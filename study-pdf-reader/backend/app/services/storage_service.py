import os
import aiofiles
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import logging
from fastapi import UploadFile
import uuid

logger = logging.getLogger(__name__)


class StorageProviderName(str, Enum):
    """Supported storage providers"""
    LOCAL = "local"
    S3 = "s3"


@dataclass
class StorageConfig:
    """Configuration for storage providers"""
    local_path: Optional[str] = None
    s3_bucket: Optional[str] = None
    s3_region: Optional[str] = None
    default_expiry_hours: int = 24


class StorageProviderInterface(ABC):
    """Abstract interface for storage providers"""
    
    @abstractmethod
    async def save_pdf(self, file: UploadFile, file_id: str) -> Dict[str, Any]:
        """Save PDF file and return metadata"""
        pass

    @abstractmethod
    async def delete_pdf(self, file_path: str) -> bool:
        """Delete PDF file"""
        pass

    @abstractmethod
    async def get_pdf_url(self, file_id: str, file_path: str) -> str:
        """Get accessible URL for PDF file"""
        pass
    
    @abstractmethod
    async def file_exists(self, file_path: str) -> bool:
        """Check if file exists in storage"""
        pass
    
    @abstractmethod
    def requires_direct_serving(self) -> bool:
        """Check if the provider requires the backend to serve the file"""
        pass


class LocalStorageProvider(StorageProviderInterface):
    """Local file system storage provider"""
    
    def __init__(self, config: StorageConfig):
        self.config = config
        self.base_path = Path(config.local_path or "./storage/pdfs")
        self.base_path.mkdir(parents=True, exist_ok=True)

    async def save_pdf(self, file: UploadFile, file_id: str) -> Dict[str, Any]:
        file_extension = Path(file.filename).suffix
        filename = f"{file_id}{file_extension}"
        file_path = self.base_path / filename
        
        content = await file.read()
        async with aiofiles.open(file_path, "wb") as buffer:
            await buffer.write(content)
            
        return {
            "file_path": str(file_path),
            "filename": filename,
            "file_size": len(content)
        }

    async def delete_pdf(self, file_path: str) -> bool:
        try:
            path = Path(file_path)
            if path.exists():
                path.unlink()
                return True
            return False
        except Exception as e:
            logger.error(f"Error deleting local file {file_path}: {e}")
            return False
    
    async def get_pdf_url(self, file_id: str, file_path: str) -> str:
        """Return static file URL for local files"""
        filename = Path(file_path).name
        return f"/static/{filename}"
    
    async def file_exists(self, file_path: str) -> bool:
        """Check if file exists locally"""
        return Path(file_path).exists()

    def requires_direct_serving(self) -> bool:
        return True


class S3StorageProvider(StorageProviderInterface):
    """AWS S3 storage provider"""
    
    def __init__(self, config: StorageConfig):
        self.config = config
        self.bucket = config.s3_bucket
        self.region = config.s3_region or 'us-east-1'
        
        # Dynamically import boto3 and initialize client
        try:
            import boto3
            from botocore.exceptions import NoCredentialsError
            self.s3_client = boto3.client('s3', region_name=self.region)
            # Perform a quick check to ensure credentials are valid
            self.s3_client.list_buckets() 
        except ImportError:
            logger.warning("S3 provider is configured, but 'boto3' is not installed. S3 will be unavailable.")
            self.s3_client = None
        except NoCredentialsError:
            logger.warning("AWS credentials not found. S3 provider will be unavailable.")
            self.s3_client = None
        except Exception as e:
            logger.error(f"An unexpected error occurred during S3 client initialization: {e}")
            self.s3_client = None

    async def save_pdf(self, file: UploadFile, file_id: str) -> Dict[str, Any]:
        if not self.s3_client or not self.bucket:
            raise RuntimeError("S3 provider is not configured or initialized correctly.")

        file_extension = Path(file.filename).suffix
        filename = f"{file_id}{file_extension}"
        s3_key = f"pdfs/{filename}"
        
        content = await file.read()
        self.s3_client.put_object(
            Bucket=self.bucket,
            Key=s3_key,
            Body=content,
            ContentType='application/pdf'
        )
            
        return {
            "file_path": s3_key, # For S3, path is the key
            "filename": filename,
            "file_size": len(content)
        }

    async def delete_pdf(self, file_path: str) -> bool:
        if not self.s3_client or not self.bucket:
            return False
        try:
            self.s3_client.delete_object(Bucket=self.bucket, Key=file_path)
            return True
        except Exception as e:
            logger.error(f"Error deleting S3 object {file_path}: {e}")
            return False
    
    async def get_pdf_url(self, file_id: str, file_path: str) -> str:
        """Generate presigned URL for S3 object"""
        if not self.s3_client or not self.bucket:
            raise RuntimeError("S3 provider is not configured or initialized correctly.")
        
        try:
            from botocore.exceptions import ClientError
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': file_path},
                ExpiresIn=self.config.default_expiry_hours * 3600
            )
            return url
        except ClientError as e:
            logger.error(f"Error generating S3 URL: {e}")
            raise
    
    async def file_exists(self, file_path: str) -> bool:
        """Check if S3 object exists"""
        if not self.s3_client or not self.bucket:
            return False
        
        try:
            from botocore.exceptions import ClientError
            self.s3_client.head_object(Bucket=self.bucket, Key=file_path)
            return True
        except ClientError:
            return False

    def requires_direct_serving(self) -> bool:
        return False


class PDFStorageService:
    """
    Hybrid PDF Storage Service Dispatcher
    
    This service manages multiple storage providers and dispatches
    operations to the correct one based on per-file settings.
    """
    
    def __init__(self, config: StorageConfig = None):
        self.config = config or self._load_config()
        self.providers: Dict[str, StorageProviderInterface] = self._init_providers()

    def _load_config(self) -> StorageConfig:
        """Load storage configuration from environment variables"""
        project_root = Path(__file__).parent.parent.parent
        default_storage = project_root / "storage" / "pdfs"

        return StorageConfig(
            local_path=os.getenv("PDF_STORAGE_PATH", str(default_storage)),
            s3_bucket=os.getenv("AWS_S3_BUCKET"),
            s3_region=os.getenv("AWS_REGION", "us-east-1"),
            default_expiry_hours=int(os.getenv("PDF_URL_EXPIRY_HOURS", "24"))
        )

    def _init_providers(self) -> Dict[str, StorageProviderInterface]:
        """Initialize all available and configured storage providers"""
        providers = {
            StorageProviderName.LOCAL: LocalStorageProvider(self.config)
        }
        
        # Conditionally initialize S3 provider
        if self.config.s3_bucket:
            logger.info(f"S3 bucket '{self.config.s3_bucket}' is configured. Initializing S3 provider.")
            providers[StorageProviderName.S3] = S3StorageProvider(self.config)
        
        return providers

    def _get_provider(self, provider_name: str) -> StorageProviderInterface:
        """Get a provider instance by name"""
        provider = self.providers.get(provider_name)
        if not provider:
            raise ValueError(f"Unsupported or unconfigured storage provider: {provider_name}")
        return provider

    async def save_pdf(self, file: UploadFile, provider_name: str) -> Dict[str, Any]:
        """Save a PDF to a specified provider"""
        file_id = str(uuid.uuid4())
        provider = self._get_provider(provider_name)
        return await provider.save_pdf(file, file_id)

    async def delete_pdf(self, file_path: str, provider_name: str) -> bool:
        """Delete a PDF from a specified provider"""
        provider = self._get_provider(provider_name)
        return await provider.delete_pdf(file_path)

    async def get_pdf_url(self, book_id: str, file_path: str, provider_name: str) -> str:
        """Get an accessible URL for a PDF from its provider"""
        provider = self._get_provider(provider_name)
        return await provider.get_pdf_url(book_id, file_path)

    async def file_exists(self, file_path: str, provider_name: str) -> bool:
        """Check if a file exists in its provider"""
        provider = self._get_provider(provider_name)
        return await provider.file_exists(file_path)

    def requires_direct_serving(self, provider_name: str) -> bool:
        """Check if a provider requires direct serving through the backend"""
        provider = self._get_provider(provider_name)
        return provider.requires_direct_serving()
