#!/bin/bash

# Ultra-Simple HTTPS Setup - No Nginx, Just Certbot + Cron
# This is the minimal approach you asked about

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOMAIN=${DOMAIN:-"yourdomain.com"}
EMAIL=${EMAIL:-"admin@yourdomain.com"}

echo -e "${BLUE}🔒 Simple HTTPS Setup (No Nginx)${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""
echo -e "Domain: ${GREEN}$DOMAIN${NC}"
echo -e "Email: ${GREEN}$EMAIL${NC}"
echo ""

# Step 1: Stop any running services
echo -e "${BLUE}Step 1: Stopping any running services...${NC}"
docker-compose down 2>/dev/null || true

# Step 2: Create directories
echo -e "${BLUE}Step 2: Creating directories...${NC}"
mkdir -p letsencrypt
mkdir -p certbot-logs

# Step 3: Get certificate using standalone mode
echo -e "${BLUE}Step 3: Getting SSL certificate...${NC}"
docker run --rm -it \
  -p 80:80 \
  -v "$(pwd)/letsencrypt:/etc/letsencrypt" \
  -v "$(pwd)/certbot-logs:/var/log/letsencrypt" \
  certbot/certbot:latest \
  certonly \
  --standalone \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN"

# Step 4: Verify certificate
if [ ! -f "letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo -e "${RED}❌ Certificate not found! Check the logs.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Certificate obtained successfully!${NC}"

# Step 5: Set up cron job for renewal
echo -e "${BLUE}Step 4: Setting up cron job for auto-renewal...${NC}"

# Create renewal script
cat > renew-ssl.sh << 'EOF'
#!/bin/bash

# Simple SSL Renewal Script
cd "$(dirname "$0")"

echo "$(date): Starting SSL renewal..."

# Stop the app temporarily
docker-compose down

# Renew certificate
docker run --rm \
  -p 80:80 \
  -v "$(pwd)/letsencrypt:/etc/letsencrypt" \
  -v "$(pwd)/certbot-logs:/var/log/letsencrypt" \
  certbot/certbot:latest \
  renew --standalone

# Start the app again
docker-compose up -d

echo "$(date): SSL renewal completed"
EOF

chmod +x renew-ssl.sh

# Add to crontab
echo -e "${BLUE}Step 5: Adding cron job...${NC}"
(crontab -l 2>/dev/null; echo "0 3 * * 0 $(pwd)/renew-ssl.sh >> $(pwd)/renewal.log 2>&1") | crontab -

echo -e "${GREEN}✅ Cron job added (runs every Sunday at 3 AM)${NC}"

# Step 6: Start the application
echo -e "${BLUE}Step 6: Starting the application with HTTPS...${NC}"
docker-compose up -d

echo ""
echo -e "${GREEN}🎉 Simple HTTPS Setup Complete!${NC}"
echo ""
echo -e "${BLUE}What was set up:${NC}"
echo -e "✅ SSL certificate from Let's Encrypt"
echo -e "✅ Cron job for automatic renewal (every Sunday 3 AM)"
echo -e "✅ Direct FastAPI SSL termination (no nginx)"
echo ""
echo -e "${BLUE}Test your setup:${NC}"
echo -e "curl -I https://$DOMAIN"
echo ""
echo -e "${BLUE}View renewal log:${NC}"
echo -e "tail -f renewal.log"
echo ""
echo -e "${BLUE}Manual renewal:${NC}"
echo -e "./renew-ssl.sh"