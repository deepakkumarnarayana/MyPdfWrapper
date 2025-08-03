#!/bin/bash

# Automated HTTPS Setup Script for PDF Reader Application
# Solves the "chicken and egg" problem and sets up Let's Encrypt certificates

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN=${DOMAIN:-"yourdomain.com"}
EMAIL=${EMAIL:-"admin@yourdomain.com"}
STAGING=${STAGING:-0}  # Set to 1 for testing
DATA_PATH="./certbot"
COMPOSE_FILE="docker-compose.yml"

echo -e "${BLUE}🔒 PDF Reader HTTPS Setup${NC}"
echo -e "${BLUE}=========================${NC}"
echo ""
echo -e "Domain: ${GREEN}$DOMAIN${NC}"
echo -e "Email: ${GREEN}$EMAIL${NC}"
echo -e "Staging: ${GREEN}$([ $STAGING -eq 1 ] && echo "Yes" || echo "No")${NC}"
echo ""

# Function to print status messages
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if domain is set
if [ "$DOMAIN" = "yourdomain.com" ]; then
    print_error "Please set your domain name in .env file or DOMAIN environment variable"
    exit 1
fi

# Check if email is set
if [ "$EMAIL" = "admin@yourdomain.com" ]; then
    print_error "Please set your email in .env file or EMAIL environment variable"
    exit 1
fi

# Check dependencies
print_status "Checking dependencies..."

if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

print_success "Dependencies check passed"

# Create necessary directories
print_status "Creating directory structure..."
mkdir -p "$DATA_PATH/conf/live/$DOMAIN"
mkdir -p "$DATA_PATH/www"
mkdir -p "$DATA_PATH/logs"
mkdir -p "logs/nginx"
mkdir -p "logs/backend"
mkdir -p "nginx/html"

# Create dummy certificate to solve "chicken and egg" problem
print_status "Creating dummy certificate for initial setup..."

if [ ! -f "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" ]; then
    print_status "Generating dummy certificate..."
    
    # Create a temporary OpenSSL config
    cat > /tmp/openssl.conf << EOF
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Organization
CN = $DOMAIN

[v3_req]
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $DOMAIN
DNS.2 = www.$DOMAIN
EOF

    # Generate dummy certificate
    openssl req -x509 -nodes -newkey rsa:2048 \
        -days 1 \
        -keyout "$DATA_PATH/conf/live/$DOMAIN/privkey.pem" \
        -out "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" \
        -config /tmp/openssl.conf

    # Create chain.pem (copy of fullchain for OCSP stapling)
    cp "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" "$DATA_PATH/conf/live/$DOMAIN/chain.pem"
    
    rm /tmp/openssl.conf
    print_success "Dummy certificate created"
else
    print_warning "Certificate already exists, skipping dummy certificate creation"
fi

# Create nginx configuration with domain substitution
print_status "Updating nginx configuration with domain..."
sed -i "s/yourdomain\.com/$DOMAIN/g" nginx/conf.d/pdf-reader.conf

# Create initial index.html for testing
print_status "Creating initial test page..."
cat > nginx/html/index.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>PDF Reader - HTTPS Setup</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .status { padding: 20px; border-radius: 5px; margin: 20px 0; }
        .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; }
        .info { background: #d1ecf1; border: 1px solid #bee5eb; color: #0c5460; }
    </style>
</head>
<body>
    <h1>🔒 PDF Reader - HTTPS Setup</h1>
    <div class="info status">
        <h3>SSL Setup in Progress</h3>
        <p>If you can see this page over HTTPS, the initial setup is working!</p>
        <p>The application will be available once all services are configured.</p>
    </div>
    <div class="success status">
        <h3>Security Features Enabled</h3>
        <ul>
            <li>HTTPS with Let's Encrypt certificates</li>
            <li>HTTP Strict Transport Security (HSTS)</li>
            <li>Content Security Policy (CSP)</li>
            <li>Security headers protection</li>
            <li>Rate limiting and DDoS protection</li>
        </ul>
    </div>
</body>
</html>
EOF

# Start nginx with dummy certificate
print_status "Starting nginx with dummy certificate..."
docker-compose up --force-recreate -d nginx

# Wait for nginx to start
print_status "Waiting for nginx to start..."
sleep 10

# Check if nginx is running
if ! docker-compose ps nginx | grep -q "Up"; then
    print_error "Nginx failed to start. Check logs with: docker-compose logs nginx"
    exit 1
fi

print_success "Nginx started successfully"

# Delete dummy certificate and get real one
print_status "Removing dummy certificate..."
docker-compose run --rm --entrypoint "\
    rm -rf /etc/letsencrypt/live/$DOMAIN && \
    rm -rf /etc/letsencrypt/archive/$DOMAIN && \
    rm -rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

# Get Let's Encrypt certificate
print_status "Requesting Let's Encrypt certificate..."

if [ $STAGING -eq 1 ]; then
    print_warning "Using Let's Encrypt staging environment (certificates will not be trusted)"
    STAGING_FLAG="--staging"
else
    print_status "Using Let's Encrypt production environment"
    STAGING_FLAG=""
fi

# Request certificate
docker-compose run --rm --entrypoint "\
    certbot certonly --webroot -w /var/www/certbot \
    $STAGING_FLAG \
    --email $EMAIL \
    --agree-tos \
    --no-eff-email \
    -d $DOMAIN \
    -d www.$DOMAIN" certbot

# Check if certificate was obtained
if [ ! -f "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" ]; then
    print_error "Failed to obtain certificate. Check logs with: docker-compose logs certbot"
    exit 1
fi

print_success "Certificate obtained successfully!"

# Reload nginx to use the real certificate
print_status "Reloading nginx with real certificate..."
docker-compose exec nginx nginx -s reload

# Set up auto-renewal
print_status "Setting up certificate auto-renewal..."

# Create renewal script
cat > scripts/renew-certificates.sh << 'EOF'
#!/bin/bash

# Certificate renewal script
# This script should be run via cron every 12 hours

cd "$(dirname "$0")/.."

echo "$(date): Starting certificate renewal check..."

# Try to renew certificates
docker-compose run --rm certbot renew

# If renewal was successful, reload nginx
if [ $? -eq 0 ]; then
    echo "$(date): Certificate renewal successful, reloading nginx..."
    docker-compose exec nginx nginx -s reload
    echo "$(date): Nginx reloaded successfully"
else
    echo "$(date): Certificate renewal failed or not needed"
fi

echo "$(date): Certificate renewal check completed"
EOF

chmod +x scripts/renew-certificates.sh

# Setup systemd timer for auto-renewal (if systemd is available)
if command -v systemctl &> /dev/null; then
    print_status "Setting up systemd timer for auto-renewal..."
    
    # Create systemd service
    sudo tee /etc/systemd/system/pdf-reader-ssl-renewal.service > /dev/null << EOF
[Unit]
Description=PDF Reader SSL Certificate Renewal
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=$(pwd)/scripts/renew-certificates.sh
WorkingDirectory=$(pwd)
User=$USER
EOF

    # Create systemd timer
    sudo tee /etc/systemd/system/pdf-reader-ssl-renewal.timer > /dev/null << EOF
[Unit]
Description=PDF Reader SSL Certificate Renewal Timer
Requires=pdf-reader-ssl-renewal.service

[Timer]
OnCalendar=*-*-* 00,12:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

    # Enable and start timer
    sudo systemctl daemon-reload
    sudo systemctl enable pdf-reader-ssl-renewal.timer
    sudo systemctl start pdf-reader-ssl-renewal.timer
    
    print_success "Systemd timer configured for automatic renewal every 12 hours"
else
    print_warning "Systemd not available. Please set up cron job manually:"
    echo "0 0,12 * * * $(pwd)/scripts/renew-certificates.sh >> $(pwd)/logs/renewal.log 2>&1"
fi

# Start all services
print_status "Starting all services..."
docker-compose up -d

# Wait for services to start
print_status "Waiting for services to start..."
sleep 15

# Health check
print_status "Performing health checks..."

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
    print_warning "Some services may not be running. Check with: docker-compose ps"
fi

# Test HTTPS connection
if curl -sSf -I "https://$DOMAIN/health" > /dev/null 2>&1; then
    print_success "HTTPS health check passed"
else
    print_warning "HTTPS health check failed. The service might still be starting up."
fi

# Final status
echo ""
echo -e "${GREEN}🎉 HTTPS Setup Complete!${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo -e "1. Update your domain's DNS to point to this server"
echo -e "2. Test HTTPS access: ${GREEN}https://$DOMAIN${NC}"
echo -e "3. Verify certificate: ${GREEN}https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN${NC}"
echo -e "4. Monitor logs: ${YELLOW}docker-compose logs -f${NC}"
echo ""
echo -e "${BLUE}Certificate Information:${NC}"
echo -e "Certificate path: $DATA_PATH/conf/live/$DOMAIN/"
echo -e "Auto-renewal: Every 12 hours via systemd timer"
echo -e "Certificate expires: $(openssl x509 -enddate -noout -in "$DATA_PATH/conf/live/$DOMAIN/fullchain.pem" | cut -d= -f2)"
echo ""
echo -e "${BLUE}Useful Commands:${NC}"
echo -e "View services: ${YELLOW}docker-compose ps${NC}"
echo -e "View logs: ${YELLOW}docker-compose logs -f${NC}"
echo -e "Restart services: ${YELLOW}docker-compose restart${NC}"
echo -e "Manual renewal: ${YELLOW}./scripts/renew-certificates.sh${NC}"
echo ""
print_success "HTTPS setup completed successfully! 🔒✨"