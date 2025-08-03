# Ultra-Simple HTTPS Setup

The simplest possible HTTPS setup - no nginx, just cron jobs like you asked!

## Quick Start

```bash
# 1. Set your domain
export DOMAIN=yourdomain.com
export EMAIL=admin@yourdomain.com

# 2. Run setup (takes 2 minutes)
./setup-ssl-simple.sh

# 3. Done! Your app now has HTTPS + auto-renewal
```

## What This Sets Up

1. **SSL Certificate**: Gets from Let's Encrypt using certbot
2. **Cron Job**: Renews every Sunday at 3 AM
3. **Direct SSL**: FastAPI handles HTTPS directly (no nginx)

## Files Created

- `renew-ssl.sh` - Simple renewal script
- `renewal.log` - Renewal activity log
- `letsencrypt/` - SSL certificates
- Cron job entry

## How Renewal Works

```bash
# Cron runs this every Sunday:
0 3 * * 0 /path/to/renew-ssl.sh >> renewal.log 2>&1

# The renewal script:
1. Stops your app
2. Renews certificate 
3. Starts your app
4. Logs everything
```

## Manual Commands

```bash
# Test renewal
./renew-ssl.sh

# Check cron jobs
crontab -l

# View renewal log
tail -f renewal.log

# Check certificate expiry
openssl x509 -in letsencrypt/live/$DOMAIN/cert.pem -noout -dates
```

## vs Complex Nginx Setup

| Feature | Simple Setup | Nginx Setup |
|---------|-------------|-------------|
| Setup time | 2 minutes | 20 minutes |
| Services | 1 | 3+ |
| Config files | 2 | 8+ |
| SSL renewal | Cron job | Systemd timers |
| Rate limiting | ❌ | ✅ |
| Load balancing | ❌ | ✅ |
| Complexity | Minimal | High |

**For most small to medium projects, this simple setup is perfect!**