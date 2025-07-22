"""
PDF Storage Service with Multiple Provider Support

This service provides a unified interface for accessing PDFs stored in different locations:
- Local file system
- AWS S3
- Google Cloud Storage
- Azure Blob Storage
- External APIs

The service abstracts storage details from the application, making it easy to switch
between providers or support multiple providers simultaneously.
"""

import os
import aiohttp
import aiofiles
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, Union
from pathlib import Path
from dataclasses import dataclass
from enum import Enum
import boto3
from botocore.exceptions import NoCredentialsError, ClientError
from google.cloud import storage as gcs
from azure.storage.blob import BlobServiceClient
import logging

logger = logging.getLogger(__name__)


class StorageProvider(Enum):
    """Supported storage providers"""
    LOCAL = "local"
    S3 = "s3"
    GCS = "gcs"
    AZURE = "azure"
    EXTERNAL_API = "external_api"
    HYBRID = "hybrid"


@dataclass
class StorageConfig:
    """Configuration for storage providers"""
    provider: StorageProvider
    local_path: Optional[str] = None
    s3_bucket: Optional[str] = None
    s3_region: Optional[str] = None
    gcs_bucket: Optional[str] = None
    azure_container: Optional[str] = None
    azure_account: Optional[str] = None
    external_api_base: Optional[str] = None
    default_expiry_hours: int = 24


class StorageProviderInterface(ABC):
    """Abstract interface for storage providers"""
    
    @abstractmethod
    async def get_pdf_url(self, file_id: str, file_path: str) -> str:
        """Get accessible URL for PDF file"""
        pass
    
    @abstractmethod
    async def get_pdf_stream(self, file_id: str, file_path: str):
        """Get PDF file as stream for direct serving"""
        pass
    
    @abstractmethod
    async def file_exists(self, file_id: str, file_path: str) -> bool:
        """Check if file exists in storage"""
        pass
    
    @abstractmethod
    async def get_file_info(self, file_id: str, file_path: str) -> Dict[str, Any]:
        """Get file metadata (size, modified date, etc.)"""
        pass


class LocalStorageProvider(StorageProviderInterface):
    """Local file system storage provider"""
    
    def __init__(self, config: StorageConfig):
        self.config = config
        self.base_path = Path(config.local_path or "./storage/pdfs")
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    async def get_pdf_url(self, file_id: str, file_path: str) -> str:
        """Return static file URL for local files"""
        filename = Path(file_path).name
        return f"/static/{filename}"
    
    async def get_pdf_stream(self, file_id: str, file_path: str):
        """Get file stream for direct serving"""
        if not await self.file_exists(file_id, file_path):
            raise FileNotFoundError(f"PDF file not found: {file_path}")
        
        return aiofiles.open(file_path, mode='rb')
    
    async def file_exists(self, file_id: str, file_path: str) -> bool:
        """Check if file exists locally"""
        return Path(file_path).exists()
    
    async def get_file_info(self, file_id: str, file_path: str) -> Dict[str, Any]:
        """Get local file info"""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        
        stat = path.stat()
        return {
            "size": stat.st_size,
            "modified": stat.st_mtime,
            "filename": path.name
        }


class S3StorageProvider(StorageProviderInterface):
    """AWS S3 storage provider"""
    
    def __init__(self, config: StorageConfig):
        self.config = config
        self.bucket = config.s3_bucket
        self.region = config.s3_region or 'us-east-1'
        
        try:
            self.s3_client = boto3.client('s3', region_name=self.region)
        except NoCredentialsError:
            logger.error("AWS credentials not found")
            self.s3_client = None
    
    async def get_pdf_url(self, file_id: str, file_path: str) -> str:
        """Generate presigned URL for S3 object"""
        if not self.s3_client:
            raise RuntimeError("S3 client not initialized")
        
        try:
            key = self._get_s3_key(file_id, file_path)
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': self.bucket, 'Key': key},
                ExpiresIn=self.config.default_expiry_hours * 3600
            )
            return url
        except ClientError as e:
            logger.error(f"Error generating S3 URL: {e}")
            raise
    
    async def get_pdf_stream(self, file_id: str, file_path: str):
        """Get S3 object as stream"""
        if not self.s3_client:
            raise RuntimeError("S3 client not initialized")
        
        key = self._get_s3_key(file_id, file_path)
        try:
            response = self.s3_client.get_object(Bucket=self.bucket, Key=key)
            return response['Body']
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise FileNotFoundError(f"S3 object not found: {key}")
            raise
    
    async def file_exists(self, file_id: str, file_path: str) -> bool:
        """Check if S3 object exists"""
        if not self.s3_client:
            return False
        
        key = self._get_s3_key(file_id, file_path)
        try:
            self.s3_client.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False
    
    async def get_file_info(self, file_id: str, file_path: str) -> Dict[str, Any]:
        """Get S3 object metadata"""
        if not self.s3_client:
            raise RuntimeError("S3 client not initialized")
        
        key = self._get_s3_key(file_id, file_path)
        try:
            response = self.s3_client.head_object(Bucket=self.bucket, Key=key)
            return {
                "size": response['ContentLength'],
                "modified": response['LastModified'].timestamp(),
                "filename": Path(key).name
            }
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                raise FileNotFoundError(f"S3 object not found: {key}")
            raise
    
    def _get_s3_key(self, file_id: str, file_path: str) -> str:
        """Generate S3 key from file info"""
        # Use file_id as primary key, fallback to filename
        if file_id:
            return f"pdfs/{file_id}.pdf"
        return f"pdfs/{Path(file_path).name}"


class GCSStorageProvider(StorageProviderInterface):
    """Google Cloud Storage provider"""
    
    def __init__(self, config: StorageConfig):
        self.config = config
        self.bucket_name = config.gcs_bucket
        
        try:
            self.client = gcs.Client()
            self.bucket = self.client.bucket(self.bucket_name)
        except Exception as e:
            logger.error(f"Failed to initialize GCS client: {e}")
            self.client = None
            self.bucket = None
    
    async def get_pdf_url(self, file_id: str, file_path: str) -> str:
        """Generate signed URL for GCS object"""
        if not self.bucket:
            raise RuntimeError("GCS client not initialized")
        
        blob_name = self._get_blob_name(file_id, file_path)
        blob = self.bucket.blob(blob_name)
        
        url = blob.generate_signed_url(
            expiration=self.config.default_expiry_hours * 3600,
            method='GET'
        )
        return url
    
    async def get_pdf_stream(self, file_id: str, file_path: str):
        """Get GCS object as stream"""
        if not self.bucket:
            raise RuntimeError("GCS client not initialized")
        
        blob_name = self._get_blob_name(file_id, file_path)
        blob = self.bucket.blob(blob_name)
        
        if not blob.exists():
            raise FileNotFoundError(f"GCS object not found: {blob_name}")
        
        return blob.download_as_bytes()
    
    async def file_exists(self, file_id: str, file_path: str) -> bool:
        """Check if GCS object exists"""
        if not self.bucket:
            return False
        
        blob_name = self._get_blob_name(file_id, file_path)
        blob = self.bucket.blob(blob_name)
        return blob.exists()
    
    async def get_file_info(self, file_id: str, file_path: str) -> Dict[str, Any]:
        """Get GCS object metadata"""
        if not self.bucket:
            raise RuntimeError("GCS client not initialized")
        
        blob_name = self._get_blob_name(file_id, file_path)
        blob = self.bucket.blob(blob_name)
        
        if not blob.exists():
            raise FileNotFoundError(f"GCS object not found: {blob_name}")
        
        blob.reload()
        return {
            "size": blob.size,
            "modified": blob.updated.timestamp(),
            "filename": Path(blob_name).name
        }
    
    def _get_blob_name(self, file_id: str, file_path: str) -> str:
        """Generate blob name from file info"""
        if file_id:
            return f"pdfs/{file_id}.pdf"
        return f"pdfs/{Path(file_path).name}"


class ExternalAPIProvider(StorageProviderInterface):
    """External API storage provider"""
    
    def __init__(self, config: StorageConfig):
        self.config = config
        self.base_url = config.external_api_base
    
    async def get_pdf_url(self, file_id: str, file_path: str) -> str:
        """Return external API URL"""
        return f"{self.base_url}/files/{file_id}"
    
    async def get_pdf_stream(self, file_id: str, file_path: str):
        """Fetch PDF from external API"""
        url = await self.get_pdf_url(file_id, file_path)
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 404:
                    raise FileNotFoundError(f"External API file not found: {file_id}")
                response.raise_for_status()
                return await response.read()
    
    async def file_exists(self, file_id: str, file_path: str) -> bool:
        """Check if file exists in external API"""
        url = await self.get_pdf_url(file_id, file_path)
        
        async with aiohttp.ClientSession() as session:
            async with session.head(url) as response:
                return response.status == 200
    
    async def get_file_info(self, file_id: str, file_path: str) -> Dict[str, Any]:
        """Get file info from external API"""
        url = f"{self.base_url}/files/{file_id}/info"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status == 404:
                    raise FileNotFoundError(f"External API file not found: {file_id}")
                response.raise_for_status()
                return await response.json()


class PDFStorageService:
    """
    Unified PDF Storage Service
    
    This service provides a single interface for accessing PDFs from multiple storage
    providers. It automatically selects the appropriate provider based on configuration
    and can fall back between providers for resilience.
    """
    
    def __init__(self, config: StorageConfig = None):
        self.config = config or self._load_config()
        self.primary_provider = self._create_provider(self.config.provider)
        self.fallback_providers = self._create_fallback_providers()
    
    def _load_config(self) -> StorageConfig:
        """Load storage configuration from environment variables"""
        provider_name = os.getenv("PDF_STORAGE_PROVIDER", "local").lower()
        provider = StorageProvider(provider_name)
        
        return StorageConfig(
            provider=provider,
            local_path=os.getenv("PDF_STORAGE_PATH", "./storage/pdfs"),
            s3_bucket=os.getenv("AWS_S3_BUCKET"),
            s3_region=os.getenv("AWS_REGION", "us-east-1"),
            gcs_bucket=os.getenv("GCS_BUCKET"),
            azure_container=os.getenv("AZURE_CONTAINER"),
            azure_account=os.getenv("AZURE_ACCOUNT"),
            external_api_base=os.getenv("EXTERNAL_API_BASE"),
            default_expiry_hours=int(os.getenv("PDF_URL_EXPIRY_HOURS", "24"))
        )
    
    def _create_provider(self, provider_type: StorageProvider) -> StorageProviderInterface:
        """Create storage provider instance"""
        if provider_type == StorageProvider.LOCAL:
            return LocalStorageProvider(self.config)
        elif provider_type == StorageProvider.S3:
            return S3StorageProvider(self.config)
        elif provider_type == StorageProvider.GCS:
            return GCSStorageProvider(self.config)
        elif provider_type == StorageProvider.EXTERNAL_API:
            return ExternalAPIProvider(self.config)
        else:
            raise ValueError(f"Unsupported storage provider: {provider_type}")
    
    def _create_fallback_providers(self) -> list:
        """Create fallback providers for resilience"""
        fallbacks = []
        
        # Always have local as fallback if configured
        if (self.config.provider != StorageProvider.LOCAL and 
            self.config.local_path and 
            Path(self.config.local_path).exists()):
            fallbacks.append(LocalStorageProvider(self.config))
        
        return fallbacks
    
    async def get_pdf_url(self, book_id: str, file_path: str) -> str:
        """
        Get accessible URL for PDF file
        
        Args:
            book_id: Unique identifier for the book/PDF
            file_path: File system path or storage key
            
        Returns:
            Accessible URL for the PDF file
        """
        try:
            return await self.primary_provider.get_pdf_url(book_id, file_path)
        except Exception as e:
            logger.error(f"Primary provider failed: {e}")
            
            # Try fallback providers
            for provider in self.fallback_providers:
                try:
                    if await provider.file_exists(book_id, file_path):
                        return await provider.get_pdf_url(book_id, file_path)
                except Exception as fallback_error:
                    logger.error(f"Fallback provider failed: {fallback_error}")
                    continue
            
            raise FileNotFoundError(f"PDF not found in any storage provider: {book_id}")
    
    async def get_pdf_stream(self, book_id: str, file_path: str):
        """
        Get PDF file as stream for direct serving
        
        Args:
            book_id: Unique identifier for the book/PDF
            file_path: File system path or storage key
            
        Returns:
            File stream or bytes
        """
        try:
            return await self.primary_provider.get_pdf_stream(book_id, file_path)
        except Exception as e:
            logger.error(f"Primary provider failed: {e}")
            
            # Try fallback providers
            for provider in self.fallback_providers:
                try:
                    if await provider.file_exists(book_id, file_path):
                        return await provider.get_pdf_stream(book_id, file_path)
                except Exception as fallback_error:
                    logger.error(f"Fallback provider failed: {fallback_error}")
                    continue
            
            raise FileNotFoundError(f"PDF not found in any storage provider: {book_id}")
    
    async def file_exists(self, book_id: str, file_path: str) -> bool:
        """Check if PDF file exists in any provider"""
        if await self.primary_provider.file_exists(book_id, file_path):
            return True
        
        for provider in self.fallback_providers:
            try:
                if await provider.file_exists(book_id, file_path):
                    return True
            except Exception as e:
                logger.error(f"Error checking file existence in fallback: {e}")
                continue
        
        return False
    
    async def get_file_info(self, book_id: str, file_path: str) -> Dict[str, Any]:
        """Get file metadata from storage provider"""
        try:
            return await self.primary_provider.get_file_info(book_id, file_path)
        except Exception as e:
            logger.error(f"Primary provider failed: {e}")
            
            # Try fallback providers
            for provider in self.fallback_providers:
                try:
                    if await provider.file_exists(book_id, file_path):
                        return await provider.get_file_info(book_id, file_path)
                except Exception as fallback_error:
                    logger.error(f"Fallback provider failed: {fallback_error}")
                    continue
            
            raise FileNotFoundError(f"PDF not found in any storage provider: {book_id}")
    
    def requires_direct_serving(self) -> bool:
        """Check if primary provider requires direct serving through backend"""
        return isinstance(self.primary_provider, LocalStorageProvider)
    
    def get_provider_info(self) -> Dict[str, Any]:
        """Get information about configured providers"""
        return {
            "primary_provider": self.config.provider.value,
            "fallback_count": len(self.fallback_providers),
            "requires_direct_serving": self.requires_direct_serving(),
            "config": {
                "expiry_hours": self.config.default_expiry_hours,
                "local_path": self.config.local_path,
                "s3_bucket": self.config.s3_bucket,
                "gcs_bucket": self.config.gcs_bucket,
            }
        }