#!/bin/bash

# Production HTTPS Setup for PDF Reader Application
# Optimized and security-hardened version

set -euo pipefail  # Exit on error, undefined vars, pipe failures
IFS=$'\n\t'       # Secure Internal Field Separator

# Colors and formatting
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly BLUE='\033[0;34m'
readonly YELLOW='\033[1;33m'
readonly NC='\033[0m'

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SSL_DIR="${SCRIPT_DIR}/ssl"
readonly LOGS_DIR="${SSL_DIR}/logs"
readonly BACKUP_DIR="${SSL_DIR}/backup"

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Input validation
validate_domain() {
    local domain="$1"
    if [[ ! "$domain" =~ ^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$ ]]; then
        error "Invalid domain format: $domain"
        return 1
    fi
    return 0
}

validate_email() {
    local email="$1"
    if [[ ! "$email" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
        error "Invalid email format: $email"
        return 1
    fi
    return 0
}

# Prerequisites check
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running as root for port 443
    if [[ $EUID -eq 0 ]]; then
        warn "Running as root. Consider using port forwarding instead."
    fi
    
    # Check required commands
    local required_commands=("docker" "openssl" "curl")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command not found: $cmd"
            exit 1
        fi
    done
    
    # Check Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is not running. Please start Docker service."
        exit 1
    fi
    
    # Check network connectivity
    if ! curl -s --connect-timeout 5 https://api.letsencrypt.org/directory &> /dev/null; then
        error "Cannot reach Let's Encrypt API. Check internet connection."
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Setup directories with proper permissions
setup_directories() {
    log "Setting up directories..."
    
    mkdir -p "$SSL_DIR" "$LOGS_DIR" "$BACKUP_DIR"
    
    # Set secure permissions
    chmod 700 "$SSL_DIR"
    chmod 755 "$LOGS_DIR"
    chmod 700 "$BACKUP_DIR"
    
    success "Directories created with secure permissions"
}

# DNS verification
verify_dns() {
    local domain="$1"
    log "Verifying DNS configuration for $domain..."
    
    local domain_ip
    domain_ip=$(dig +short "$domain" @8.8.8.8 2>/dev/null | tail -1)
    
    if [[ -z "$domain_ip" ]]; then
        error "Domain $domain does not resolve to any IP address"
        return 1
    fi
    
    # Get server's public IP
    local server_ip
    server_ip=$(curl -s --connect-timeout 10 https://api.ipify.org 2>/dev/null || echo "unknown")
    
    if [[ "$domain_ip" != "$server_ip" ]]; then
        warn "Domain $domain resolves to $domain_ip, but server IP is $server_ip"
        warn "SSL certificate generation may fail if domain doesn't point to this server"
        
        read -p "Continue anyway? [y/N]: " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            error "DNS verification failed. Please fix DNS configuration first."
            return 1
        fi
    fi
    
    success "DNS verification passed"
    return 0
}

# Backup existing certificates
backup_existing_certs() {
    local domain="$1"
    
    if [[ -d "${SSL_DIR}/letsencrypt/live/$domain" ]]; then
        log "Backing up existing certificates..."
        
        local backup_file="${BACKUP_DIR}/certs-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
        tar -czf "$backup_file" -C "$SSL_DIR" letsencrypt/ 2>/dev/null || {
            warn "Failed to create backup"
        }
        
        success "Certificates backed up to $backup_file"
    fi
}

# Stop running services safely
stop_services() {
    log "Stopping running services..."
    
    # Stop any process using port 80 or 443
    local port80_pid
    port80_pid=$(lsof -ti:80 2>/dev/null || true)
    if [[ -n "$port80_pid" ]]; then
        warn "Stopping process using port 80 (PID: $port80_pid)"
        kill -TERM "$port80_pid" 2>/dev/null || true
        sleep 2
    fi
    
    local port443_pid
    port443_pid=$(lsof -ti:443 2>/dev/null || true)
    if [[ -n "$port443_pid" ]]; then
        warn "Stopping process using port 443 (PID: $port443_pid)"
        kill -TERM "$port443_pid" 2>/dev/null || true
        sleep 2
    fi
    
    # Stop application containers
    docker-compose down 2>/dev/null || true
    
    success "Services stopped"
}

# Generate SSL certificate with enhanced security
generate_certificate() {
    local domain="$1"
    local email="$2"
    local staging="${3:-false}"
    
    log "Generating SSL certificate for $domain..."
    
    local staging_flag=""
    if [[ "$staging" == "true" ]]; then
        staging_flag="--staging"
        warn "Using Let's Encrypt staging environment"
    fi
    
    # Enhanced certbot command with security options
    docker run --rm -it \
        --name certbot-ssl-generation \
        -p 80:80 \
        -v "${SSL_DIR}/letsencrypt:/etc/letsencrypt" \
        -v "${LOGS_DIR}:/var/log/letsencrypt" \
        --security-opt no-new-privileges:true \
        --cap-drop ALL \
        certbot/certbot:latest \
        certonly \
        --standalone \
        --non-interactive \
        --agree-tos \
        --no-eff-email \
        --email "$email" \
        --domains "$domain" \
        --rsa-key-size 4096 \
        --must-staple \
        $staging_flag \
        --verbose
    
    # Verify certificate was created
    if [[ ! -f "${SSL_DIR}/letsencrypt/live/$domain/fullchain.pem" ]]; then
        error "Certificate generation failed. Check logs in $LOGS_DIR"
        return 1
    fi
    
    success "SSL certificate generated successfully"
    return 0
}

# Create secure environment configuration
create_environment() {
    local domain="$1"
    
    log "Creating secure environment configuration..."
    
    # Create production environment file with secure defaults
    cat > "${SCRIPT_DIR}/.env.production" << EOF
# Production Environment Configuration
# Generated on $(date)

# SSL Configuration
SSL_CERT_PATH=${SSL_DIR}/letsencrypt/live/$domain/fullchain.pem
SSL_KEY_PATH=${SSL_DIR}/letsencrypt/live/$domain/privkey.pem
DOMAIN=$domain

# Security Configuration
ENVIRONMENT=production
DEBUG=false
ENABLE_HSTS=true
HSTS_MAX_AGE=31536000
SECURE_COOKIES=true
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true

# CORS Configuration  
ALLOWED_ORIGINS=https://$domain
ALLOWED_HOSTS=$domain,www.$domain

# Application Configuration
PDF_STORAGE_PATH=./storage/pdfs
DATABASE_URL=sqlite+aiosqlite:///./storage/database.db
MAX_FILE_SIZE=10485760
MAX_FLASHCARDS_PER_GENERATION=10

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
ENABLE_ACCESS_LOGS=true

# Rate Limiting (requests per minute)
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60

# API Keys (MUST be set manually)
CLAUDE_API_KEY=your_claude_api_key_here

# Optional: External Database
# DATABASE_URL=postgresql+asyncio://user:password@host:port/database?sslmode=require

# Optional: Redis for sessions/caching
# REDIS_URL=redis://localhost:6379/0
EOF

    # Set secure permissions on environment file
    chmod 600 "${SCRIPT_DIR}/.env.production"
    
    success "Environment configuration created"
}

# Create optimized renewal script
create_renewal_script() {
    local domain="$1"
    
    log "Creating certificate renewal script..."
    
    cat > "${SCRIPT_DIR}/renew-ssl.sh" << 'EOF'
#!/bin/bash

# SSL Certificate Renewal Script
# Production-ready with proper error handling and logging

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSL_DIR="${SCRIPT_DIR}/ssl"
LOG_FILE="${SSL_DIR}/logs/renewal.log"
DOMAIN="${1:-$(grep DOMAIN .env.production | cut -d'=' -f2)}"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

error() {
    echo "[ERROR] $1" | tee -a "$LOG_FILE" >&2
}

# Renewal function with rollback capability
renew_certificate() {
    log "Starting SSL certificate renewal for $DOMAIN"
    
    # Create backup before renewal
    if [[ -d "${SSL_DIR}/letsencrypt/live/$DOMAIN" ]]; then
        local backup_dir="${SSL_DIR}/backup/pre-renewal-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$backup_dir"
        cp -r "${SSL_DIR}/letsencrypt/live/$DOMAIN" "$backup_dir/"
        log "Certificate backed up to $backup_dir"
    fi
    
    # Stop application gracefully
    log "Stopping application..."
    if pgrep -f "python main.py" > /dev/null; then
        pkill -TERM -f "python main.py"
        sleep 5
        # Force kill if still running
        pkill -KILL -f "python main.py" 2>/dev/null || true
    fi
    
    # Renew certificate
    log "Renewing certificate..."
    if docker run --rm \
        -p 80:80 \
        -v "${SSL_DIR}/letsencrypt:/etc/letsencrypt" \
        -v "${SSL_DIR}/logs:/var/log/letsencrypt" \
        --security-opt no-new-privileges:true \
        --cap-drop ALL \
        certbot/certbot:latest \
        renew --standalone --non-interactive --quiet; then
        
        log "Certificate renewal successful"
        
        # Restart application
        log "Restarting application..."
        cd "$SCRIPT_DIR"
        ./start-https.sh &
        
        log "SSL renewal completed successfully"
        return 0
    else
        error "Certificate renewal failed"
        
        # Restore from backup if available
        if [[ -d "$backup_dir" ]]; then
            log "Restoring from backup..."
            cp -r "$backup_dir/$DOMAIN" "${SSL_DIR}/letsencrypt/live/"
        fi
        
        return 1
    fi
}

# Main execution
if renew_certificate; then
    log "Renewal process completed successfully"
    exit 0
else
    error "Renewal process failed"
    exit 1
fi
EOF

    chmod +x "${SCRIPT_DIR}/renew-ssl.sh"
    
    # Create systemd timer for automatic renewal (if systemd is available)
    if command -v systemctl &> /dev/null; then
        create_systemd_timer "$domain"
    else
        create_cron_job
    fi
    
    success "Renewal script created"
}

# Create systemd timer (preferred over cron)
create_systemd_timer() {
    local domain="$1"
    
    log "Creating systemd timer for automatic renewal..."
    
    # Create service file
    sudo tee /etc/systemd/system/ssl-renewal.service > /dev/null << EOF
[Unit]
Description=SSL Certificate Renewal for PDF Reader
After=network.target

[Service]
Type=oneshot
User=$(whoami)
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${SCRIPT_DIR}/renew-ssl.sh
StandardOutput=journal
StandardError=journal
EOF

    # Create timer file
    sudo tee /etc/systemd/system/ssl-renewal.timer > /dev/null << EOF
[Unit]
Description=Run SSL certificate renewal twice daily
Requires=ssl-renewal.service

[Timer]
OnCalendar=*-*-* 02,14:00:00
RandomizedDelaySec=3600
Persistent=true

[Install]
WantedBy=timers.target
EOF

    # Enable and start timer
    sudo systemctl daemon-reload
    sudo systemctl enable ssl-renewal.timer
    sudo systemctl start ssl-renewal.timer
    
    success "Systemd timer configured"
}

# Fallback cron job
create_cron_job() {
    log "Creating cron job for automatic renewal..."
    
    local cron_entry="0 2,14 * * * ${SCRIPT_DIR}/renew-ssl.sh >> ${SSL_DIR}/logs/renewal.log 2>&1"
    
    # Add to crontab if not already present
    if ! crontab -l 2>/dev/null | grep -q "${SCRIPT_DIR}/renew-ssl.sh"; then
        (crontab -l 2>/dev/null; echo "$cron_entry") | crontab -
        success "Cron job added"
    else
        warn "Cron job already exists"
    fi
}

# Create production startup script
create_startup_script() {
    log "Creating production startup script..."
    
    cat > "${SCRIPT_DIR}/start-https.sh" << 'EOF'
#!/bin/bash

# Production HTTPS Startup Script
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables
if [[ -f "${SCRIPT_DIR}/.env.production" ]]; then
    set -a
    source "${SCRIPT_DIR}/.env.production"
    set +a
else
    echo "Error: .env.production file not found"
    exit 1
fi

# Validate required environment variables
required_vars=("SSL_CERT_PATH" "SSL_KEY_PATH" "DOMAIN" "CLAUDE_API_KEY")
for var in "${required_vars[@]}"; do
    if [[ -z "${!var:-}" ]]; then
        echo "Error: Required environment variable $var is not set"
        exit 1
    fi
done

# Validate SSL certificates exist
if [[ ! -f "$SSL_CERT_PATH" ]]; then
    echo "Error: SSL certificate not found at $SSL_CERT_PATH"
    exit 1
fi

if [[ ! -f "$SSL_KEY_PATH" ]]; then
    echo "Error: SSL private key not found at $SSL_KEY_PATH"
    exit 1
fi

# Check certificate expiry
cert_expiry=$(openssl x509 -in "$SSL_CERT_PATH" -noout -enddate | cut -d= -f2)
cert_expiry_epoch=$(date -d "$cert_expiry" +%s)
current_epoch=$(date +%s)
days_until_expiry=$(( (cert_expiry_epoch - current_epoch) / 86400 ))

if [[ $days_until_expiry -lt 30 ]]; then
    echo "Warning: SSL certificate expires in $days_until_expiry days"
fi

echo "🔒 Starting PDF Reader with HTTPS..."
echo "   Domain: $DOMAIN"
echo "   Certificate expires in: $days_until_expiry days"

# Start the application
cd "${SCRIPT_DIR}/study-pdf-reader/backend"

# Activate virtual environment if it exists
if [[ -f "venv/bin/activate" ]]; then
    source venv/bin/activate
fi

# Start with production settings
exec python main.py
EOF

    chmod +x "${SCRIPT_DIR}/start-https.sh"
    
    success "Production startup script created"
}

# Create monitoring script
create_monitoring_script() {
    log "Creating monitoring script..."
    
    cat > "${SCRIPT_DIR}/monitor-ssl.sh" << 'EOF'
#!/bin/bash

# SSL Certificate Monitoring Script
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/.env.production" 2>/dev/null || {
    echo "Error: Cannot load .env.production"
    exit 1
}

# Check certificate expiry
check_certificate_expiry() {
    local cert_file="$1"
    local domain="$2"
    
    if [[ ! -f "$cert_file" ]]; then
        echo "❌ Certificate file not found: $cert_file"
        return 1
    fi
    
    local expiry_date
    expiry_date=$(openssl x509 -in "$cert_file" -noout -enddate | cut -d= -f2)
    local expiry_epoch
    expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch
    current_epoch=$(date +%s)
    local days_until_expiry
    days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    echo "📅 Certificate Status for $domain:"
    echo "   Expires: $expiry_date"
    echo "   Days until expiry: $days_until_expiry"
    
    if [[ $days_until_expiry -le 7 ]]; then
        echo "🚨 CRITICAL: Certificate expires in $days_until_expiry days!"
        return 2
    elif [[ $days_until_expiry -le 30 ]]; then
        echo "⚠️  WARNING: Certificate expires in $days_until_expiry days"
        return 1
    else
        echo "✅ Certificate is valid"
        return 0
    fi
}

# Check HTTPS connectivity
check_https_connectivity() {
    local domain="$1"
    
    echo "🌐 Testing HTTPS connectivity..."
    
    if curl -sSf -m 10 "https://$domain/api/v1/health" > /dev/null; then
        echo "✅ HTTPS endpoint is accessible"
        return 0
    else
        echo "❌ HTTPS endpoint is not accessible"
        return 1
    fi
}

# Main monitoring
echo "🔍 SSL Certificate Monitoring Report"
echo "===================================="
echo "Generated: $(date)"
echo ""

exit_code=0

# Check certificate
if ! check_certificate_expiry "$SSL_CERT_PATH" "$DOMAIN"; then
    exit_code=$?
fi

echo ""

# Check connectivity
if ! check_https_connectivity "$DOMAIN"; then
    exit_code=1
fi

echo ""
echo "Monitoring completed with exit code: $exit_code"
exit $exit_code
EOF

    chmod +x "${SCRIPT_DIR}/monitor-ssl.sh"
    
    success "Monitoring script created"
}

# Main setup function
main() {
    echo -e "${BLUE}"
    cat << "EOF"
╔══════════════════════════════════════════════════════════════════════════════╗
║                  Production HTTPS Setup for PDF Reader                      ║
║                         Security-Hardened Version                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    
    # Get user input with validation
    while true; do
        read -p "Enter your domain (e.g., pdfreader.yourdomain.com): " domain
        if validate_domain "$domain"; then
            break
        fi
    done
    
    while true; do
        read -p "Enter your email for Let's Encrypt notifications: " email
        if validate_email "$email"; then
            break
        fi
    done
    
    read -p "Use Let's Encrypt staging environment for testing? [y/N]: " -r
    local staging=false
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        staging=true
    fi
    
    # Execute setup steps
    check_prerequisites
    setup_directories
    verify_dns "$domain"
    backup_existing_certs "$domain"
    stop_services
    
    if generate_certificate "$domain" "$email" "$staging"; then
        create_environment "$domain"
        create_renewal_script "$domain"
        create_startup_script
        create_monitoring_script
        
        success "🎉 Production HTTPS setup completed successfully!"
        echo ""
        echo -e "${GREEN}Next steps:${NC}"
        echo "1. Add your Claude API key to .env.production"
        echo "2. Review configuration in .env.production"
        echo "3. Start the application: ./start-https.sh"
        echo "4. Monitor certificates: ./monitor-ssl.sh"
        echo ""
        echo -e "${BLUE}Your application will be available at: https://$domain${NC}"
        
    else
        error "Setup failed. Check logs in $LOGS_DIR"
        exit 1
    fi
}

# Execute main function
main "$@"
EOF