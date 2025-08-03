#!/bin/bash

# Simple HTTPS Setup for PDF Reader Application
# No Nginx - Just FastAPI + Let's Encrypt + Cron Job

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔒 PDF Reader HTTPS Setup${NC}"
echo -e "${BLUE}=========================${NC}"
echo ""

# Get domain and email
read -p "Enter your domain (e.g., pdfreader.yourdomain.com): " DOMAIN
read -p "Enter your email for Let's Encrypt: " EMAIL

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo -e "${RED}❌ Domain and email are required${NC}"
    exit 1
fi

echo ""
echo -e "Domain: ${GREEN}$DOMAIN${NC}"
echo -e "Email: ${GREEN}$EMAIL${NC}"
echo ""

# Step 1: Create directories
echo -e "${BLUE}Step 1: Creating SSL directories...${NC}"
mkdir -p ssl/letsencrypt
mkdir -p ssl/logs

# Step 2: Stop any running services
echo -e "${BLUE}Step 2: Stopping any running services...${NC}"
pkill -f "uvicorn" || true
sleep 2

# Step 3: Get SSL certificate
echo -e "${BLUE}Step 3: Getting SSL certificate from Let's Encrypt...${NC}"
docker run --rm -it \
  -p 80:80 \
  -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
  -v "$(pwd)/ssl/logs:/var/log/letsencrypt" \
  certbot/certbot:latest \
  certonly \
  --standalone \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Step 4: Verify certificate
if [ ! -f "ssl/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo -e "${RED}❌ Certificate not found! Check the logs in ssl/logs/${NC}"
  exit 1
fi

echo -e "${GREEN}✅ SSL certificate obtained successfully!${NC}"

# Step 5: Create environment file
echo -e "${BLUE}Step 4: Creating environment configuration...${NC}"
cat > .env.production << EOF
# SSL Configuration
SSL_CERT_PATH=$(pwd)/ssl/letsencrypt/live/$DOMAIN/fullchain.pem
SSL_KEY_PATH=$(pwd)/ssl/letsencrypt/live/$DOMAIN/privkey.pem
DOMAIN=$DOMAIN

# Your existing environment variables
CLAUDE_API_KEY=\${CLAUDE_API_KEY}
PDF_STORAGE_PATH=./storage/pdfs
DATABASE_URL=sqlite+aiosqlite:///./storage/database.db
MAX_FILE_SIZE=10485760
MAX_FLASHCARDS_PER_GENERATION=10
EOF

echo -e "${GREEN}✅ Environment file created: .env.production${NC}"

# Step 6: Create renewal script
echo -e "${BLUE}Step 5: Creating SSL renewal script...${NC}"
cat > renew-ssl.sh << 'EOF'
#!/bin/bash

# SSL Renewal Script for PDF Reader
cd "$(dirname "$0")"

echo "$(date): Starting SSL renewal for PDF Reader..."

# Stop the application
echo "Stopping application..."
pkill -f "uvicorn" || true
sleep 5

# Renew certificate
echo "Renewing SSL certificate..."
docker run --rm \
  -p 80:80 \
  -v "$(pwd)/ssl/letsencrypt:/etc/letsencrypt" \
  -v "$(pwd)/ssl/logs:/var/log/letsencrypt" \
  certbot/certbot:latest \
  renew --standalone

# Start the application again
echo "Starting application with HTTPS..."
cd study-pdf-reader/backend
source venv/bin/activate
python main.py &

echo "$(date): SSL renewal completed for PDF Reader"
EOF

chmod +x renew-ssl.sh

# Step 7: Set up cron job
echo -e "${BLUE}Step 6: Setting up automatic renewal (cron job)...${NC}"
SCRIPT_PATH="$(pwd)/renew-ssl.sh"
LOG_PATH="$(pwd)/ssl-renewal.log"

# Add cron job (runs every Sunday at 3 AM)
(crontab -l 2>/dev/null; echo "0 3 * * 0 $SCRIPT_PATH >> $LOG_PATH 2>&1") | crontab -

echo -e "${GREEN}✅ Cron job added (runs every Sunday at 3 AM)${NC}"

# Step 8: Create startup script
echo -e "${BLUE}Step 7: Creating HTTPS startup script...${NC}"
cat > start-https.sh << EOF
#!/bin/bash

# Start PDF Reader with HTTPS
cd "\$(dirname "\$0")"

echo "🔒 Starting PDF Reader with HTTPS..."

# Load environment
export \$(cat .env.production | xargs)

# Start backend with HTTPS
cd study-pdf-reader/backend
source venv/bin/activate
python main.py
EOF

chmod +x start-https.sh

echo ""
echo -e "${GREEN}🎉 HTTPS Setup Complete!${NC}"
echo ""
echo -e "${BLUE}What was configured:${NC}"
echo -e "✅ SSL certificate from Let's Encrypt"
echo -e "✅ FastAPI configured for direct SSL termination"
echo -e "✅ Environment file (.env.production)"
echo -e "✅ Automatic renewal via cron job"
echo -e "✅ Startup script (start-https.sh)"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo -e "1. Add your Claude API key to .env.production"
echo -e "2. Start your app: ${GREEN}./start-https.sh${NC}"
echo -e "3. Test: ${GREEN}curl -I https://$DOMAIN${NC}"
echo ""
echo -e "${BLUE}Management commands:${NC}"
echo -e "• Manual renewal: ${GREEN}./renew-ssl.sh${NC}"
echo -e "• View renewal log: ${GREEN}tail -f ssl-renewal.log${NC}"
echo -e "• Check certificate: ${GREEN}openssl x509 -in ssl/letsencrypt/live/$DOMAIN/cert.pem -noout -dates${NC}"
echo ""
echo -e "${YELLOW}Remember: Port 80 and 443 must be open on your server!${NC}"