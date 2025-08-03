# Production Deployment Guide

## 🚨 Security Status

**CRITICAL**: This application has been security-reviewed and hardened for production deployment.

### Security Improvements Implemented:
- ✅ **HTTPS with TLS 1.2+ enforced**
- ✅ **Security headers** (HSTS, XSS Protection, CSP)
- ✅ **Restricted CORS** policy
- ✅ **Debug endpoints** disabled in production
- ✅ **Enhanced SSL** configuration
- ✅ **Trusted host** middleware
- ✅ **Production-ready** error handling

### ⚠️ Known Limitations:
- **Authentication system** needs implementation for multi-user scenarios
- **File upload validation** needs enhancement for malicious PDF detection
- **Rate limiting** recommended for production usage

## 🚀 Quick Production Setup

### 1. Prerequisites
```bash
# Install Docker and Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Verify installation
docker --version
docker-compose --version
```

### 2. Deploy with HTTPS
```bash
# Run the production setup script
./setup-https-production.sh

# Follow the prompts:
# - Enter your domain: pdfreader.yourdomain.com
# - Enter your email: admin@yourdomain.com
# - Choose staging: N (for production certificates)
```

### 3. Configure Production Environment
```bash
# Edit the generated production environment
nano .env.production

# REQUIRED: Add your Claude API key
CLAUDE_API_KEY=your_actual_claude_api_key_here

# OPTIONAL: Customize other settings
RATE_LIMIT_REQUESTS=100  # Requests per minute
MAX_FILE_SIZE=50485760   # Max upload size (50MB)
```

### 4. Start Production Server
```bash
# Start with HTTPS
./start-https.sh

# Your app will be available at: https://yourdomain.com
```

## 🔧 Advanced Configuration

### Environment Variables Reference

```bash
# Core Configuration
ENVIRONMENT=production
DOMAIN=yourdomain.com
CLAUDE_API_KEY=your_key_here

# SSL Configuration
SSL_CERT_PATH=/path/to/fullchain.pem
SSL_KEY_PATH=/path/to/privkey.pem

# Security Settings
ENABLE_HSTS=true
HSTS_MAX_AGE=31536000
SECURE_COOKIES=true
SESSION_COOKIE_SECURE=true

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# Application Limits
MAX_FILE_SIZE=50485760
MAX_FLASHCARDS_PER_GENERATION=10
PDF_STORAGE_PATH=./storage/pdfs

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
ENABLE_ACCESS_LOGS=true

# Database
DATABASE_URL=sqlite+aiosqlite:///./storage/database.db
# For production PostgreSQL:
# DATABASE_URL=postgresql+asyncio://user:password@host:port/database?sslmode=require

# Optional: Redis for caching
# REDIS_URL=redis://localhost:6379/0
```

### Docker Production Deployment

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  pdf-reader:
    build: 
      context: study-pdf-reader/backend
      dockerfile: Dockerfile.production
    container_name: pdf_reader_production
    restart: unless-stopped
    ports:
      - "443:443"
      - "80:80"  # For HTTP redirect
    volumes:
      - ./ssl:/ssl:ro
      - ./storage:/app/storage
    environment:
      - ENVIRONMENT=production
    env_file:
      - .env.production
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    user: "1000:1000"  # Non-root user
    healthcheck:
      test: ["CMD", "curl", "-f", "https://localhost/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Optional: Nginx reverse proxy for additional security
  nginx:
    image: nginx:alpine
    container_name: pdf_reader_nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/ssl:ro
    depends_on:
      - pdf-reader
```

### Nginx Configuration (Optional)

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=1r/s;
    
    upstream backend {
        server pdf-reader:8000;
    }
    
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;
        
        ssl_certificate /ssl/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /ssl/letsencrypt/live/yourdomain.com/privkey.pem;
        
        # SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        
        # Upload size limit
        client_max_body_size 50M;
        
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location /api/v1/documents {
            limit_req zone=upload burst=5 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
        
        location / {
            root /var/www/html;
            try_files $uri $uri/ /index.html;
        }
    }
}
```

## 🔍 Monitoring and Maintenance

### Certificate Monitoring
```bash
# Check certificate status
./monitor-ssl.sh

# Manual renewal
./renew-ssl.sh

# View renewal logs
tail -f ssl/logs/renewal.log
```

### Application Monitoring
```bash
# Check application health
curl -f https://yourdomain.com/api/v1/health

# View application logs
docker-compose logs -f pdf-reader

# Monitor resource usage
docker stats pdf-reader
```

### Security Monitoring
```bash
# Check for security updates
pip list --outdated

# Scan for vulnerabilities
safety check

# Check SSL configuration
nmap --script ssl-enum-ciphers -p 443 yourdomain.com
```

## 🚨 Security Checklist

### Pre-Deployment
- [ ] Change default API keys
- [ ] Review CORS origins
- [ ] Set secure environment variables
- [ ] Configure firewall rules
- [ ] Set up backup procedures
- [ ] Configure monitoring alerts

### Post-Deployment
- [ ] Test SSL certificate
- [ ] Verify security headers
- [ ] Test rate limiting
- [ ] Check error handling
- [ ] Monitor resource usage
- [ ] Schedule security updates

### Regular Maintenance
- [ ] Update dependencies monthly
- [ ] Monitor certificate expiry
- [ ] Review access logs
- [ ] Check for security advisories
- [ ] Test backup restoration
- [ ] Performance monitoring

## 🆘 Troubleshooting

### Common Issues

**SSL Certificate Errors**:
```bash
# Check certificate validity
openssl x509 -in ssl/letsencrypt/live/yourdomain.com/cert.pem -noout -dates

# Verify DNS
dig yourdomain.com

# Test SSL configuration
curl -I https://yourdomain.com
```

**Application Not Starting**:
```bash
# Check logs
tail -f ssl/logs/startup.log

# Verify environment
source .env.production && env | grep -E "(SSL_|DOMAIN|CLAUDE_)"

# Test without SSL
ENVIRONMENT=development python main.py
```

**Performance Issues**:
```bash
# Check resource usage
docker stats

# Monitor database
sqlite3 storage/database.db ".tables"

# Check disk space
df -h
```

## 📞 Support

For production deployment support:
1. Check the logs in `ssl/logs/`
2. Review this deployment guide
3. Check the security review recommendations
4. Monitor certificate expiry with `./monitor-ssl.sh`

**Remember**: This setup provides a secure foundation, but additional security measures may be needed based on your specific requirements and threat model.