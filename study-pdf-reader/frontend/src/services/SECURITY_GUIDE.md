# Ultra-Secure HTTP Client - Security Guide

## 🔒 Security Features Overview

This HTTP client implements **enterprise-grade security** following OWASP 2025 standards and industry best practices.

### ✅ Security Features Implemented

| Feature | Status | Description |
|---------|--------|-------------|
| 🍪 **httpOnly Cookies** | ✅ HTTPS Ready | Secure token storage (XSS immune) |
| 🛡️ **CSRF Protection** | ✅ Advanced | Dynamic tokens + SameSite cookies |
| 🧿 **XSS Prevention** | ✅ Multi-layer | Input sanitization + CSP support |
| 🔐 **Input Validation** | ✅ Schema-based | Type checking + pattern validation |
| 📊 **Rate Limiting** | ✅ Fingerprint-based | Per-user + per-endpoint limits |
| 🔄 **Request Deduplication** | ✅ Smart | Prevents duplicate API calls |
| 📝 **Secure Logging** | ✅ PII-safe | Sanitized logs + security events |
| 🚫 **Error Sanitization** | ✅ Production-ready | No sensitive data leakage |
| 🔍 **Security Monitoring** | ✅ Real-time | Threat detection + metrics |
| ⚡ **Performance Caching** | ✅ Secure | ETag support + TTL management |

---

## 🚀 Quick Start

### Basic Usage

```typescript
import { useSecureHttpGet } from '../hooks/useSecureHttpClient';

function UserProfile() {
  const { data, loading, error, securityMetrics } = useSecureHttpGet('/api/user/profile', {
    immediate: true,
    useCache: true,
    onSecurityEvent: (event, details) => {
      console.log('Security event:', event, details);
    }
  });

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <UserProfileComponent data={data} />;
}
```

### Secure POST with Validation

```typescript
import { useSecureHttpPost } from '../hooks/useSecureHttpClient';

function CreateUser() {
  const { execute, loading, error } = useSecureHttpPost({
    validation: {
      name: { type: 'string', required: true, maxLength: 100 },
      email: { type: 'string', required: true, pattern: /^\S+@\S+\.\S+$/ },
      age: { type: 'number', min: 18, max: 120 }
    },
    onSecurityEvent: (event, details) => {
      if (event === 'SECURITY_ERROR') {
        alert('Security violation detected!');
      }
    }
  });

  const handleSubmit = async (userData: any) => {
    try {
      await execute('/api/users', userData);
      alert('User created successfully!');
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  return <UserForm onSubmit={handleSubmit} loading={loading} error={error} />;
}
```

---

## 🔐 Authentication & Authorization

### HTTPS Production Setup (Recommended)

```typescript
// In production with HTTPS, tokens are handled via httpOnly cookies
// No client-side token management needed!

import { useSecureAuth } from '../hooks/useSecureHttpClient';

function LoginForm() {
  const { login, isAuthenticated, authLoading } = useSecureAuth();

  const handleLogin = async (email: string, password: string) => {
    try {
      await login({ email, password });
      // Server sets httpOnly cookies automatically
      // Client gets authenticated state
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return isAuthenticated ? <Dashboard /> : <LoginComponent onLogin={handleLogin} />;
}
```

### Development Fallback (Encrypted localStorage)

```typescript
// For development without HTTPS, tokens are encrypted in localStorage
// Automatic fallback with browser fingerprinting for security
```

---

## 🛡️ CSRF Protection

### Automatic CSRF Handling

```typescript
// CSRF tokens are automatically:
// 1. Fetched from server on initialization
// 2. Added to all state-changing requests (POST, PUT, DELETE)
// 3. Refreshed when server provides new tokens

// Manual CSRF initialization (if needed)
import { secureHttpClient } from '../services/http.client.secure';

// CSRF is auto-initialized, but you can manually refresh:
// await secureHttpClient['tokenManager'].initializeCSRF();
```

### CSRF Configuration

```typescript
// Skip CSRF for specific requests
const data = await secureHttpClient.post('/api/public-endpoint', payload, {
  skipCSRF: true
});
```

---

## 🧿 XSS Prevention

### Automatic Input Sanitization

```typescript
// All inputs are automatically sanitized unless disabled
const userData = {
  name: "<script>alert('xss')</script>John", // Automatically sanitized
  bio: "Hello <b>world</b>" // HTML encoded
};

await secureHttpClient.post('/api/users', userData); 
// Sends: { name: "John", bio: "Hello &lt;b&gt;world&lt;/b&gt;" }

// Disable sanitization for trusted content
await secureHttpClient.post('/api/content', richTextData, {
  sanitize: false // Use with caution!
});
```

### XSS Detection

```typescript
// XSS attempts are automatically detected and blocked
const maliciousData = {
  comment: "<script>steal_cookies()</script>"
};

try {
  await secureHttpClient.post('/api/comments', maliciousData);
} catch (error) {
  // SecurityError: Potential XSS detected in field 'comment'
  console.log(error.name); // "SecurityError"
}
```

---

## ✅ Input Validation

### Schema-Based Validation

```typescript
import { ValidationSchema } from '../services/http.client.secure';

const userSchema: ValidationSchema = {
  name: { 
    type: 'string', 
    required: true, 
    minLength: 2, 
    maxLength: 50,
    pattern: /^[a-zA-Z\s]+$/ 
  },
  email: { 
    type: 'string', 
    required: true, 
    pattern: /^\S+@\S+\.\S+$/ 
  },
  age: { 
    type: 'number', 
    min: 13, 
    max: 120 
  },
  role: { 
    type: 'string', 
    allowedValues: ['user', 'admin', 'moderator'] 
  }
};

// Validation is automatic with schema
const { execute } = useSecureHttpPost({ validation: userSchema });
```

### Custom Validation

```typescript
// Server-side validation is still required!
// Client validation is for UX, not security
```

---

## 📊 Rate Limiting

### Automatic Rate Limiting

```typescript
// 100 requests per minute per endpoint per user (default)
// Rate limiting uses browser fingerprint + endpoint pattern

try {
  await secureHttpClient.get('/api/data');
} catch (error) {
  if (error.message === 'Rate limit exceeded') {
    // Handle rate limiting
    setTimeout(() => retry(), 60000); // Wait 1 minute
  }
}
```

### Configuration

```typescript
import { createHttpConfig } from '../config/http.config';

const customConfig = createHttpConfig({
  enableRateLimit: true,
  requestsPerMinute: 200, // Increase limit
});

const customClient = new UltraSecureHttpClient(customConfig);
```

---

## 🔍 Security Monitoring

### Real-time Security Metrics

```typescript
import { useSecurityMonitoring } from '../hooks/useSecureHttpClient';

function SecurityDashboard() {
  const { securityMetrics, cacheStats, refreshMetrics, clearCache } = useSecurityMonitoring();

  return (
    <div>
      <h3>Security Metrics</h3>
      <p>Total Requests: {securityMetrics.totalRequests}</p>
      <p>Blocked Requests: {securityMetrics.blockedRequests}</p>
      <p>XSS Attempts: {securityMetrics.xssAttempts}</p>
      <p>Rate Limit Hits: {securityMetrics.rateLimitHits}</p>
      
      <button onClick={refreshMetrics}>Refresh</button>
      <button onClick={clearCache}>Clear Cache</button>
    </div>
  );
}
```

### Security Event Handling

```typescript
const { data } = useSecureHttpGet('/api/sensitive-data', {
  onSecurityEvent: (event, details) => {
    switch (event) {
      case 'SECURITY_ERROR':
        // Log to security service
        console.error('Security violation:', details);
        break;
      case 'RATE_LIMIT_HIT':
        // Show user-friendly message
        toast.warning('Please slow down your requests');
        break;
      case 'XSS_ATTEMPT':
        // Alert security team
        reportSecurityIncident(details);
        break;
    }
  }
});
```

---

## 📁 File Upload Security

### Secure File Upload

```typescript
import { useSecureHttpUpload } from '../hooks/useSecureHttpClient';

function FileUploader() {
  const { execute, loading, progress, error } = useSecureHttpUpload({
    onSecurityEvent: (event, details) => {
      if (event === 'UPLOAD_SECURITY_ERROR') {
        alert(`Upload blocked: ${details.error}`);
      }
    }
  });

  const handleFileUpload = async (file: File) => {
    // Automatic security checks:
    // - File type validation (PDF, JPEG, PNG, GIF only)
    // - File size limit (50MB max)
    // - Content scanning (server-side recommended)
    
    try {
      await execute('/api/upload', file);
    } catch (error) {
      console.error('Upload failed:', error);
    }
  };

  return (
    <div>
      <input 
        type="file" 
        onChange={e => handleFileUpload(e.target.files[0])} 
        accept=".pdf,.jpg,.jpeg,.png,.gif"
      />
      {loading && (
        <div>
          <progress value={progress} max={100} />
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
}
```

---

## ⚡ Performance & Caching

### Smart Caching

```typescript
// GET requests are automatically cached
const { data } = useSecureHttpGet('/api/static-data', {
  useCache: true,
  cacheTime: 10 * 60 * 1000 // 10 minutes
});

// Manual cache management
import { secureHttpClient } from '../services/http.client.secure';

// Clear all cache
secureHttpClient.clearCache();

// View cache statistics
const stats = secureHttpClient.getCacheStats();
console.log('Cache size:', stats.size);
```

### Request Deduplication

```typescript
// Multiple identical requests are automatically deduplicated
const promise1 = secureHttpClient.get('/api/users');
const promise2 = secureHttpClient.get('/api/users'); 
// Only one actual HTTP request is made

// Disable deduplication if needed
const data = await secureHttpClient.get('/api/real-time-data', {
  dedupe: false
});
```

---

## 🚨 Error Handling

### Secure Error Messages

```typescript
// Errors are automatically sanitized for production
try {
  await secureHttpClient.get('/api/secret-data');
} catch (error) {
  // Production: "Access denied. You do not have permission."
  // Development: Full error details with stack trace
  console.log(error.message);
}
```

### Custom Error Handling

```typescript
const { data, error } = useSecureHttpGet('/api/data', {
  onError: (error) => {
    // Custom error handling
    if (error.includes('Authentication')) {
      redirectToLogin();
    } else if (error.includes('Rate limit')) {
      showRateLimitMessage();
    }
  }
});
```

---

## 🔧 Configuration

### Environment-Specific Security

```typescript
// config/http.config.ts
export const httpConfigs = {
  production: {
    enableRequestLogging: false,
    logLevel: 'error',
    defaultRetries: 2,
    requestsPerMinute: 100,
    secureTokenStorage: true,
  },
  development: {
    enableRequestLogging: true,
    logLevel: 'debug',
    defaultRetries: 3,
    requestsPerMinute: 1000,
    secureTokenStorage: false,
  }
};
```

### Custom Security Configuration

```typescript
import { createHttpConfig, UltraSecureHttpClient } from '../services/http.client.secure';

const customConfig = createHttpConfig({
  // Security settings
  enableCSRFProtection: true,
  validateTokens: true,
  
  // Rate limiting
  enableRateLimit: true,
  requestsPerMinute: 200,
  
  // Caching
  enableCaching: true,
  defaultCacheTime: 5 * 60 * 1000,
  
  // Logging
  enableRequestLogging: false,
  logLevel: 'warn'
});

const customClient = new UltraSecureHttpClient(customConfig);
```

---

## 🛠️ Backend Security Requirements

### Required Server-Side Implementation

```python
# FastAPI example - Required for full security
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.base import BaseHTTPMiddleware

app = FastAPI()

class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Essential security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        
        return response

app.add_middleware(SecurityMiddleware)

# httpOnly cookie authentication
@app.post("/auth/login")
async def login(credentials: LoginCredentials, response: Response):
    # Validate credentials
    if validate_user(credentials):
        # Set httpOnly, secure, sameSite cookies
        response.set_cookie(
            key="auth_token",
            value=generate_token(),
            httponly=True,
            secure=True,  # HTTPS only
            samesite="strict"
        )
        return {"success": True}
    raise HTTPException(401, "Invalid credentials")

# CSRF token endpoint
@app.get("/api/v1/csrf-token")
async def get_csrf_token():
    return {"csrfToken": generate_csrf_token()}
```

---

## 🔍 Security Testing

### Testing Security Features

```typescript
// Example security tests
describe('Security Features', () => {
  it('should block XSS attempts', async () => {
    const maliciousData = { comment: '<script>alert("xss")</script>' };
    
    await expect(
      secureHttpClient.post('/api/comments', maliciousData)
    ).rejects.toThrow('Potential XSS detected');
  });

  it('should enforce rate limits', async () => {
    // Make 101 requests rapidly
    const requests = Array(101).fill(0).map(() => 
      secureHttpClient.get('/api/test')
    );
    
    await expect(
      Promise.all(requests)
    ).rejects.toThrow('Rate limit exceeded');
  });

  it('should validate input schemas', async () => {
    const invalidData = { email: 'not-an-email' };
    
    await expect(
      secureHttpClient.post('/api/users', invalidData, {
        validation: {
          email: { type: 'string', pattern: /^\S+@\S+\.\S+$/ }
        }
      })
    ).rejects.toThrow('Validation failed');
  });
});
```

---

## 🚀 Migration from Basic HTTP Client

### Simple Migration

```typescript
// OLD
import { httpGet, httpPost } from './http.client';

// NEW
import { httpGet, httpPost } from './http.client.secure';
// API is 100% compatible!
```

### Enhanced Migration (Recommended)

```typescript
// OLD
const [data, setData] = useState(null);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  httpGet('/api/data')
    .then(setData)
    .finally(() => setLoading(false));
}, []);

// NEW (much better!)
const { data, loading, error, securityMetrics } = useSecureHttpGet('/api/data', {
  immediate: true,
  useCache: true,
  validation: { /* schema */ }
});
```

---

## ⚠️ Security Best Practices

### DO's ✅

- **Always use HTTPS in production**
- **Validate all inputs on server-side too**
- **Monitor security metrics regularly**
- **Keep security configurations updated**
- **Use schema validation for critical endpoints**
- **Enable CSP headers on your server**
- **Implement proper session management**
- **Use httpOnly cookies for tokens**

### DON'Ts ❌

- **Never disable sanitization for user input**
- **Don't store secrets in localStorage**
- **Don't trust client-side validation alone**
- **Don't ignore security events/alerts**
- **Don't use HTTP in production**
- **Don't disable CSRF protection**
- **Don't log sensitive information**
- **Don't ignore rate limiting violations**

---

## 🆘 Security Incident Response

### If You Detect an Attack

1. **Immediate Actions**:
   ```typescript
   // Check security metrics
   const metrics = secureHttpClient.getSecurityMetrics();
   console.log('Security metrics:', metrics);
   
   // Clear all caches if needed
   secureHttpClient.clearCache();
   ```

2. **Investigation**:
   - Check browser console for security events
   - Review network requests for anomalies
   - Verify CSRF tokens are being sent
   - Check rate limiting effectiveness

3. **Response**:
   - Force logout affected users
   - Increase rate limiting temporarily
   - Review and update security configurations
   - Notify security team

---

## 📞 Support & Security Updates

### Getting Help

- **Security Issues**: Report immediately to security team
- **Configuration**: Check environment-specific configs
- **Performance**: Monitor cache hit rates and metrics
- **Integration**: Follow migration guide step-by-step

### Security Updates

This security implementation follows OWASP guidelines and is updated for 2025 standards. Regular updates ensure protection against emerging threats.

---

**Remember: Client-side security is just one layer. Always implement comprehensive server-side security measures!** 🔒