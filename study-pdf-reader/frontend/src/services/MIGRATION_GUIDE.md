# HTTP Client Migration Guide

This guide helps you migrate from the basic HTTP client to the enhanced version.

## Quick Migration

### 1. Basic Usage (No Changes Required)

```typescript
// OLD (still works)
import { httpGet, httpPost } from './http.client';

// NEW (same API)
import { httpGet, httpPost } from './http.client.enhanced';
```

### 2. Using React Hooks (Recommended)

```typescript
// OLD
import { httpGet } from './http.client';

function MyComponent() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    setLoading(true);
    httpGet('/api/data')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);
}

// NEW (much cleaner)
import { useHttpGet } from '../hooks/useHttpClient';

function MyComponent() {
  const { data, loading, error } = useHttpGet('/api/data', { 
    immediate: true,
    useCache: true 
  });
}
```

## New Features Available

### 1. Request Caching

```typescript
// Cache GET requests for 5 minutes
const data = await httpClient.get('/api/users', {
  useCache: true,
  cacheTime: 5 * 60 * 1000
});
```

### 2. Automatic Retries

```typescript
// Retry failed requests up to 3 times
const data = await httpClient.get('/api/data', {
  retries: 3,
  retryDelay: 1000
});
```

### 3. Request Deduplication

```typescript
// Multiple identical requests will be deduplicated
const promise1 = httpClient.get('/api/users');
const promise2 = httpClient.get('/api/users'); // Same request, deduplicated
```

### 4. Upload with Progress

```typescript
import { useHttpUpload } from '../hooks/useHttpClient';

function UploadComponent() {
  const { execute, loading, progress, error } = useHttpUpload();
  
  const handleUpload = (file: File) => {
    execute('/api/upload', file);
  };
  
  return (
    <div>
      {loading && <progress value={progress} max={100} />}
      <input type="file" onChange={e => handleUpload(e.target.files[0])} />
    </div>
  );
}
```

### 5. Offline Support

```typescript
// Requests are automatically queued when offline
// and processed when connection is restored
const data = await httpClient.get('/api/data'); // Works offline
```

### 6. Request Cancellation

```typescript
import { useHttpGet } from '../hooks/useHttpClient';

function MyComponent() {
  const { data, loading, cancel } = useHttpGet('/api/slow-endpoint');
  
  return (
    <div>
      {loading && <button onClick={cancel}>Cancel</button>}
      {data && <div>{data}</div>}
    </div>
  );
}
```

## Configuration

### Environment-Based Configuration

```typescript
// config/http.config.ts
export const httpConfigs = {
  development: {
    enableRequestLogging: true,
    timeout: 10000,
  },
  production: {
    enableRequestLogging: false,
    timeout: 30000,
  }
};
```

### Custom Configuration

```typescript
import { createHttpConfig } from '../config/http.config';
import { EnhancedHttpClient } from './http.client.enhanced';

const customConfig = createHttpConfig({
  defaultRetries: 5,
  enableCaching: false,
});

const customClient = new EnhancedHttpClient(customConfig);
```

## Security Improvements

### 1. CSRF Protection (Automatic)
- X-Requested-With header added automatically
- CSRF tokens handled via cookies

### 2. Token Validation
```typescript
// Tokens are automatically validated for expiry
// Invalid tokens trigger refresh automatically
```

### 3. Secure Headers
```typescript
// Security headers added automatically:
// - X-Client-Version
// - X-Client-Timestamp
// - X-Requested-With
```

## Performance Features

### 1. Request Monitoring
```typescript
// Development console logs:
// 🚀 HTTP Request [abc123]: GET /api/users
// ✅ HTTP Response [abc123]: 200 (150ms, 2.3KB)
```

### 2. Cache Management
```typescript
// View cache statistics
console.log(httpClient.getCacheStats());

// Clear cache when needed
httpClient.clearCache();
```

### 3. Rate Limiting
```typescript
// Automatic rate limiting (100 requests/minute by default)
// Throws error if limit exceeded
```

## Error Handling

### Enhanced Error Messages
```typescript
// OLD: Generic axios error
catch (error) {
  console.log(error.message); // "Request failed with status code 500"
}

// NEW: User-friendly messages
catch (error) {
  console.log(error.message); // "No internet connection. Please check your network."
}
```

### Automatic Error Recovery
```typescript
// 401 errors automatically trigger token refresh
// Network errors trigger automatic retries
// Offline errors queue requests for later
```

## Best Practices

### 1. Use React Hooks
```typescript
// ✅ Recommended
const { data, loading, error } = useHttpGet('/api/users');

// ❌ Not recommended (unless you need full control)
const [users, setUsers] = useState([]);
httpClient.get('/api/users').then(setUsers);
```

### 2. Configure Caching Appropriately
```typescript
// ✅ Cache static data
const { data } = useHttpGet('/api/countries', { useCache: true });

// ❌ Don't cache dynamic data
const { data } = useHttpGet('/api/notifications', { useCache: false });
```

### 3. Handle Loading States
```typescript
// ✅ Show loading states
function UserList() {
  const { data: users, loading, error } = useHttpGet('/api/users');
  
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <UserTable users={users} />;
}
```

### 4. Use Batch Requests When Appropriate
```typescript
// ✅ Batch related requests
const { execute, progress } = useHttpBatch();

const loadDashboard = () => {
  execute([
    () => httpClient.get('/api/stats'),
    () => httpClient.get('/api/notifications'),
    () => httpClient.get('/api/recent-activity'),
  ]);
};
```

## Migration Checklist

- [ ] Replace imports with enhanced HTTP client
- [ ] Update components to use React hooks
- [ ] Configure caching for appropriate endpoints
- [ ] Add loading states to UI components
- [ ] Test offline functionality
- [ ] Verify error handling works correctly
- [ ] Update tests to use new API
- [ ] Remove old HTTP client file

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure `withCredentials: true` in config
2. **Cache Issues**: Clear cache with `httpClient.clearCache()`
3. **Rate Limiting**: Reduce request frequency or increase limits
4. **Token Refresh**: Ensure refresh endpoint is correctly configured

### Debug Mode
```typescript
// Enable debug logging
localStorage.setItem('http-debug', 'true');
```