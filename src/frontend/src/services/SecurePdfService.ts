/**
 * Secure PDF Service
 * 
 * Provides secure PDF loading through backend proxy with comprehensive
 * error handling, validation, and security monitoring.
 */

import { environment } from '../config/environment';
import { apiService } from './ApiService';

export interface PdfLoadResult {
  arrayBuffer: ArrayBuffer;
  contentLength: number;
  fromCache: boolean;
}

export interface PdfLoadError {
  code: string;
  message: string;
  details?: any;
}

class SecurePdfService {
  private readonly baseUrl: string;
  private readonly maxRetries: number = 3;
  private readonly retryDelayMs: number = 1000;

  constructor() {
    this.baseUrl = environment.backendBaseUrl;
  }

  /**
   * Load PDF through secure proxy with comprehensive error handling
   */
  async loadPdf(externalUrl: string): Promise<PdfLoadResult> {
    // Client-side validation
    if (!this.isValidPdfUrl(externalUrl)) {
      throw this.createPdfError('INVALID_URL', 'Invalid PDF URL format', { url: externalUrl });
    }

    const proxyUrl = `${this.baseUrl}/api/v1/pdf/proxy`;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[SecurePdfService] Loading PDF (attempt ${attempt}/${this.maxRetries}): ${externalUrl}`);
        
        const response = await fetch(proxyUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/pdf',
            'Content-Type': 'application/json',
            ...this.getAuthHeaders()
          },
          // Send URL as query parameter
          ...this.buildRequest(externalUrl)
        });

        if (!response.ok) {
          await this.handleErrorResponse(response, externalUrl, attempt);
          continue;
        }

        // Validate content type
        const contentType = response.headers.get('content-type')?.toLowerCase();
        if (!contentType?.includes('application/pdf')) {
          throw this.createPdfError('INVALID_CONTENT_TYPE', `Expected PDF, got ${contentType}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const contentLength = parseInt(response.headers.get('content-length') || '0');
        const fromCache = response.headers.get('x-cache-status') === 'HIT';

        // Basic PDF validation on client side
        if (!this.validatePdfBuffer(arrayBuffer)) {
          throw this.createPdfError('INVALID_PDF_CONTENT', 'Response is not a valid PDF');
        }

        console.log(`[SecurePdfService] Successfully loaded PDF: ${arrayBuffer.byteLength} bytes ${fromCache ? '(cached)' : '(fresh)'}`);
        
        // Log successful load
        this.logSecurityEvent('pdf_load_success', {
          url: externalUrl,
          size: arrayBuffer.byteLength,
          fromCache,
          attempt
        });

        return {
          arrayBuffer,
          contentLength,
          fromCache
        };

      } catch (error: any) {
        if (attempt === this.maxRetries) {
          throw error;
        }
        
        console.warn(`[SecurePdfService] Attempt ${attempt} failed, retrying...`, error);
        await this.delay(this.retryDelayMs * attempt);
      }
    }

    throw this.createPdfError('MAX_RETRIES_EXCEEDED', 'Failed to load PDF after maximum retries');
  }

  /**
   * Load PDF for PDF.js viewer with optimized parameters
   */
  async loadPdfForViewer(externalUrl: string): Promise<string> {
    try {
      const result = await this.loadPdf(externalUrl);
      
      // Create blob URL for PDF.js
      const blob = new Blob([result.arrayBuffer], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      
      console.log(`[SecurePdfService] Created blob URL for PDF.js: ${blobUrl}`);
      return blobUrl;
      
    } catch (error) {
      console.error('[SecurePdfService] Failed to load PDF for viewer:', error);
      throw error;
    }
  }

  /**
   * Get proxy endpoint URL for direct iframe usage
   */
  getProxyUrl(externalUrl: string): string {
    if (!this.isValidPdfUrl(externalUrl)) {
      throw this.createPdfError('INVALID_URL', 'Invalid PDF URL format');
    }

    const params = new URLSearchParams({
      url: externalUrl
    });

    return `${this.baseUrl}/api/v1/pdf/proxy?${params.toString()}`;
  }

  /**
   * Check if PDF proxy service is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/pdf/health`);
      const health = await response.json();
      return health.status === 'healthy';
    } catch (error) {
      console.error('[SecurePdfService] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get proxy service statistics (admin only)
   */
  async getStats(): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/pdf/stats`, {
        headers: this.getAuthHeaders()
      });
      return await response.json();
    } catch (error) {
      console.error('[SecurePdfService] Stats request failed:', error);
      throw error;
    }
  }

  // Private helper methods

  private buildRequest(url: string): RequestInit {
    const params = new URLSearchParams({ url });
    
    return {
      method: 'GET',
      // URL as query parameter for GET request
      body: undefined,
      // Update the URL with query parameters
      ...{ url: `${this.baseUrl}/api/v1/pdf/proxy?${params.toString()}` }
    };
  }

  private isValidPdfUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return (
        parsed.protocol === 'https:' && 
        parsed.pathname.toLowerCase().endsWith('.pdf') &&
        parsed.hostname.length > 0
      );
    } catch {
      return false;
    }
  }

  private validatePdfBuffer(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 8) return false;
    
    const uint8Array = new Uint8Array(buffer);
    const header = new TextDecoder().decode(uint8Array.slice(0, 8));
    
    return header.startsWith('%PDF-');
  }

  private async handleErrorResponse(response: Response, url: string, attempt: number): Promise<void> {
    let errorDetails: any = {};
    
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        errorDetails = await response.json();
      } else {
        errorDetails.text = await response.text();
      }
    } catch (e) {
      errorDetails.parseError = 'Could not parse error response';
    }

    const error = this.createPdfError(
      `HTTP_${response.status}`,
      `HTTP ${response.status}: ${response.statusText}`,
      { url, attempt, ...errorDetails }
    );

    this.logSecurityEvent('pdf_load_error', {
      url,
      status: response.status,
      attempt,
      error: error.message
    });

    // Don't retry on certain errors
    if (response.status === 403 || response.status === 404 || response.status === 429) {
      throw error;
    }

    throw error;
  }

  private createPdfError(code: string, message: string, details?: any): PdfLoadError {
    return {
      code,
      message,
      details
    };
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': 'application/pdf',
      'Content-Type': 'application/json'
    };

    // Add auth token if available
    try {
      const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('[SecurePdfService] Could not get auth token:', error);
    }

    return headers;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async logSecurityEvent(event: string, data: any): Promise<void> {
    try {
      // Send to backend for centralized logging
      await fetch(`${this.baseUrl}/api/v1/security/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({
          event,
          timestamp: new Date().toISOString(),
          data
        })
      });
    } catch (error) {
      // Fail silently for logging errors
      console.debug('[SecurePdfService] Security event logging failed:', error);
    }
  }
}

// Export singleton instance
export const securePdfService = new SecurePdfService();
export default securePdfService;