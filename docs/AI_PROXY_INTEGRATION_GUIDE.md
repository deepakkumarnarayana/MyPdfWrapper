# AI Proxy Integration Guide

## Overview

This guide provides comprehensive instructions for integrating and deploying the secure AI proxy system for your FastAPI backend. The implementation provides production-ready patterns for proxying AI services (Claude, OpenAI) with advanced security, rate limiting, caching, and monitoring.

## 🏗️ Architecture Overview

The AI proxy system consists of several integrated components:

- **FastAPI Router**: Secure API endpoints for AI service access
- **Redis Manager**: Connection pooling, caching, and rate limiting
- **Security Middleware**: Request validation, threat detection, and blocking
- **Rate Limiting**: Per-user/session limits with threat-aware scaling
- **Circuit Breakers**: Automatic failover and recovery
- **Comprehensive Logging**: Structured logs with monitoring integration
- **Error Handling**: Classified error responses with recovery strategies
- **Cost Tracking**: Usage analytics and quota management

## 📋 Prerequisites

### System Requirements
- Python 3.9+
- Redis Server (for caching and rate limiting)
- SQLite/PostgreSQL (for persistence)
- 2GB+ RAM (recommended for production)

### API Keys Required
- Claude API Key (Anthropic)
- OpenAI API Key (optional)

## 🚀 Quick Start Integration

### 1. Install Dependencies

Add these to your `requirements.txt`:

```bash
# AI Proxy dependencies
aioredis>=2.0.1
anthropic>=0.21.0  
openai>=1.0.0
circuitbreaker>=1.4.0
uvloop>=0.17.0
httptools>=0.5.0
```

Install:
```bash
pip install -r requirements.txt
```

### 2. Update Configuration

Add AI proxy settings to your `.env` file:

```bash
# AI Configuration
CLAUDE_API_KEY=your_actual_claude_api_key_here
OPENAI_API_KEY=your_actual_openai_api_key_here  # Optional
DEFAULT_AI_MODEL=claude-3-sonnet

# AI Proxy Configuration
AI_PROXY_ENABLED=true
AI_PROXY_RATE_LIMIT_PER_MINUTE=60
AI_PROXY_RATE_LIMIT_PER_HOUR=500
AI_PROXY_MAX_TOKENS=4000
AI_PROXY_TIMEOUT_SECONDS=60
AI_PROXY_CACHE_TTL_SECONDS=3600
AI_PROXY_COST_LIMIT_DAILY=10.0

# Redis Configuration
REDIS_URL=redis://localhost:6379/0
REDIS_ENABLED=true
REDIS_MAX_CONNECTIONS=10

# Circuit Breaker Configuration
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_RECOVERY_TIMEOUT=60
CIRCUIT_BREAKER_EXPECTED_EXCEPTION_RATE=0.5
```

### 3. Run Database Migration

Create AI proxy tables:

```bash
cd src/backend
python migrate_ai_proxy_database.py
```

Verify migration:
```bash
python migrate_ai_proxy_database.py --verify-only
```

### 4. Start Redis Server

```bash
# Ubuntu/Debian
sudo systemctl start redis-server

# macOS with Homebrew
brew services start redis

# Docker
docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 5. Update Your Main Application

Replace your existing `main.py` with the enhanced version:

```bash
cp app/main_enhanced.py main.py
```

Or integrate the components into your existing FastAPI app:

```python
from app.routers import ai_providers
from app.middleware.ai_proxy_middleware import AIProxyRateLimitMiddleware, AIProxySecurityMiddleware
from app.services.redis_manager import initialize_redis, shutdown_redis

# Add middleware
app.add_middleware(AIProxySecurityMiddleware)
app.add_middleware(AIProxyRateLimitMiddleware)

# Include AI proxy router
app.include_router(ai_providers.router, tags=["AI Proxy"])

# Add startup/shutdown events
@app.on_event("startup")
async def startup():
    await initialize_redis()

@app.on_event("shutdown") 
async def shutdown():
    await shutdown_redis()
```

### 6. Start the Application

Development:
```bash
python main.py
```

Production:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 🔒 Security Configuration

### API Key Management

Store API keys securely using the existing Pydantic Settings with SecretStr:

```python
# In config.py - already implemented
claude_api_key: SecretStr = Field(default="your_claude_api_key_here")
openai_api_key: SecretStr = Field(default="your_openai_api_key_here")
```

### Environment Variables

Never commit API keys to version control. Use environment-specific files:

```bash
# .env.production
CLAUDE_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-...
AI_PROXY_ENABLED=true
REDIS_URL=redis://production-redis:6379/0
```

### Security Headers

The middleware automatically adds security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Cache-Control: no-cache, no-store, must-revalidate`

## 📊 API Endpoints

### Core AI Endpoints

#### Claude Chat Completion
```http
POST /api/v1/ai-proxy/claude/chat
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "model": "claude-3-sonnet",
  "max_tokens": 1000,
  "temperature": 0.7
}
```

#### OpenAI Chat Completion
```http
POST /api/v1/ai-proxy/openai/chat
Content-Type: application/json

{
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "model": "gpt-3.5-turbo",
  "max_tokens": 1000,
  "temperature": 0.7
}
```

### Monitoring Endpoints

#### Provider Status
```http
GET /api/v1/ai-proxy/providers/status
```

#### Usage Analytics
```http
GET /api/v1/ai-proxy/usage/analytics?days=7&provider=claude
```

#### Usage Quota
```http
GET /api/v1/ai-proxy/usage/quota
```

### Management Endpoints

#### Reset Circuit Breaker
```http
POST /api/v1/ai-proxy/circuit-breaker/claude/reset
```

#### Clear Cache
```http
DELETE /api/v1/ai-proxy/cache/clear?provider=claude
```

## 🎛️ Frontend Integration

### React/TypeScript Example

```typescript
// services/aiProxyService.ts
interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIRequest {
  messages: AIMessage[];
  model?: string;
  max_tokens?: number;
  temperature?: number;
}

interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
  cached: boolean;
  cost: number;
  response_time_ms?: number;
}

class AIProxyService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async chatWithClaude(request: AIRequest): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/ai-proxy/claude/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': this.getSessionId()
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'AI request failed');
    }

    return response.json();
  }

  async chatWithOpenAI(request: AIRequest): Promise<AIResponse> {
    const response = await fetch(`${this.baseUrl}/api/v1/ai-proxy/openai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': this.getSessionId()
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'AI request failed');
    }

    return response.json();
  }

  async getUsageAnalytics(days: number = 7): Promise<any> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/ai-proxy/usage/analytics?days=${days}`,
      {
        headers: {
          'X-Session-ID': this.getSessionId()
        }
      }
    );

    return response.json();
  }

  private getSessionId(): string {
    // Generate or retrieve session ID
    let sessionId = localStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  }
}

export const aiProxyService = new AIProxyService(process.env.REACT_APP_API_URL!);
```

### Usage in React Components

```typescript
// components/AIChatComponent.tsx
import React, { useState } from 'react';
import { aiProxyService } from '../services/aiProxyService';

export const AIChatComponent: React.FC = () => {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: AIMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const response = await aiProxyService.chatWithClaude({
        messages: newMessages,
        max_tokens: 1000,
        temperature: 0.7
      });

      if (response.success && response.data) {
        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: response.data.content[0].text
        };
        setMessages([...newMessages, assistantMessage]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-chat-component">
      <div className="messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            <strong>{msg.role}:</strong> {msg.content}
          </div>
        ))}
      </div>
      
      {error && <div className="error">{error}</div>}
      
      <div className="input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()}>
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
};
```

## 🚀 Production Deployment

### Docker Deployment

Create `Dockerfile.ai-proxy`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/backend/ .

# Create logs directory
RUN mkdir -p logs

# Run database migration and start application
CMD ["python", "migrate_ai_proxy_database.py", "&&", "python", "main.py"]

EXPOSE 8000
```

Create `docker-compose.ai-proxy.yml`:

```yaml
version: '3.8'

services:
  ai-proxy:
    build:
      context: .
      dockerfile: Dockerfile.ai-proxy
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=production
      - CLAUDE_API_KEY=${CLAUDE_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - REDIS_URL=redis://redis:6379/0
      - DATABASE_URL=sqlite+aiosqlite:///data/database.db
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  redis_data:
```

Deploy:
```bash
docker-compose -f docker-compose.ai-proxy.yml up -d
```

### Kubernetes Deployment

Create `k8s-ai-proxy.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-proxy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-proxy
  template:
    metadata:
      labels:
        app: ai-proxy
    spec:
      containers:
      - name: ai-proxy
        image: your-registry/ai-proxy:latest
        ports:
        - containerPort: 8000
        env:
        - name: ENVIRONMENT
          value: "production"
        - name: CLAUDE_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-proxy-secrets
              key: claude-api-key
        - name: REDIS_URL
          value: "redis://redis-service:6379/0"
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: ai-proxy-service
spec:
  selector:
    app: ai-proxy
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP

---
apiVersion: v1
kind: Secret
metadata:
  name: ai-proxy-secrets
type: Opaque
stringData:
  claude-api-key: "your-actual-claude-api-key"
  openai-api-key: "your-actual-openai-api-key"
```

Deploy:
```bash
kubectl apply -f k8s-ai-proxy.yaml
```

## 📊 Monitoring and Observability

### Health Checks

The system provides multiple health check endpoints:

- `/health` - Basic health status
- `/health/detailed` - Detailed component status
- `/api/v1/ai-proxy/providers/status` - AI provider status

### Structured Logging

Logs are structured JSON in production for easy parsing:

```json
{
  "timestamp": "2025-01-20T10:30:00Z",
  "level": "INFO",
  "category": "ai_proxy",
  "message": "AI request completed",
  "provider": "claude",
  "duration_ms": 1250,
  "cost_usd": 0.0025,
  "tokens_used": 150,
  "cache_hit": false,
  "request_id": "req_123456"
}
```

### Metrics Collection

The system logs comprehensive metrics for monitoring:

- Request counts by provider and status
- Response times and latency percentiles
- Cost tracking and quota usage
- Error rates and types
- Cache hit ratios
- Circuit breaker states

### Alerting Integration

Integrate with your monitoring system by parsing structured logs:

```bash
# Example: Parse error logs for alerting
tail -f logs/ai_proxy_errors.log | jq '.category, .severity, .provider, .error_code'
```

## 🔧 Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_PROXY_ENABLED` | `true` | Enable/disable AI proxy |
| `AI_PROXY_RATE_LIMIT_PER_MINUTE` | `60` | Rate limit per minute |
| `AI_PROXY_RATE_LIMIT_PER_HOUR` | `500` | Rate limit per hour |
| `AI_PROXY_MAX_TOKENS` | `4000` | Maximum tokens per request |
| `AI_PROXY_TIMEOUT_SECONDS` | `60` | Request timeout |
| `AI_PROXY_CACHE_TTL_SECONDS` | `3600` | Cache TTL |
| `AI_PROXY_COST_LIMIT_DAILY` | `10.0` | Daily cost limit per user |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `REDIS_ENABLED` | `true` | Enable Redis caching |
| `REDIS_MAX_CONNECTIONS` | `10` | Redis connection pool size |

### Rate Limiting

Rate limits are applied per user (if authenticated) or per session:

- **Minute limit**: Short-term burst protection
- **Hour limit**: Sustained usage protection
- **Daily quota**: Cost control
- **Threat-aware scaling**: Reduces limits for suspicious requests

### Caching Strategy

- **Request hashing**: Normalizes requests for consistent caching
- **TTL-based expiration**: Configurable cache lifetime
- **Redis + Database**: Dual-layer caching for reliability
- **Cache warming**: Proactive cache population for common requests

## 🛠️ Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   ```bash
   # Check Redis status
   redis-cli ping
   
   # Check connection string
   echo $REDIS_URL
   ```

2. **API Key Authentication Failed**
   ```bash
   # Verify API key format
   echo $CLAUDE_API_KEY | cut -c1-10
   
   # Test API key manually
   curl -H "x-api-key: $CLAUDE_API_KEY" https://api.anthropic.com/v1/messages
   ```

3. **Rate Limiting Too Aggressive**
   ```bash
   # Increase limits in environment
   export AI_PROXY_RATE_LIMIT_PER_MINUTE=120
   export AI_PROXY_RATE_LIMIT_PER_HOUR=1000
   ```

4. **Database Migration Failed**
   ```bash
   # Run migration manually
   python migrate_ai_proxy_database.py --verify-only
   
   # Reset if needed (CAUTION: destroys data)
   python migrate_ai_proxy_database.py --rollback
   python migrate_ai_proxy_database.py
   ```

### Debug Mode

Enable debug logging:
```bash
export LOG_LEVEL=DEBUG
export DEBUG=true
```

### Performance Tuning

1. **Increase Redis Connections**
   ```bash
   export REDIS_MAX_CONNECTIONS=20
   ```

2. **Adjust Cache TTL**
   ```bash
   export AI_PROXY_CACHE_TTL_SECONDS=7200  # 2 hours
   ```

3. **Optimize Database**
   ```bash
   # Run database optimization
   python migrate_ai_proxy_database.py --verify-only
   ```

## 🔄 Upgrade Guide

### Version 1.x to 2.x

1. **Backup existing data**
2. **Update dependencies**
3. **Run new migration**
4. **Update configuration**
5. **Test endpoints**

### Breaking Changes

- API endpoints now use `/api/v1/ai-proxy/` prefix
- Rate limiting now uses Redis by default
- Error responses have new format
- Security middleware is now mandatory

## 📈 Performance Benchmarks

Expected performance metrics:

- **Throughput**: 1000+ requests/minute per instance
- **Latency**: <100ms proxy overhead
- **Cache hit ratio**: 60-80% for similar requests
- **Memory usage**: ~512MB per instance
- **CPU usage**: ~25% per core under load

## 🤝 Support and Maintenance

### Regular Maintenance Tasks

1. **Monitor logs for errors**
2. **Clean up expired cache entries**
3. **Review rate limiting effectiveness**
4. **Update API keys as needed**
5. **Monitor costs and quotas**

### Getting Help

1. Check logs in `logs/` directory
2. Use detailed health check endpoint
3. Review configuration validation
4. Check component status endpoints

---

This integration guide provides everything needed to deploy a production-ready AI proxy system. The implementation follows security best practices, provides comprehensive monitoring, and scales effectively for real-world usage.