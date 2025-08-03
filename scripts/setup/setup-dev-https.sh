#!/bin/bash

# HTTPS Setup for Development Server
clear
echo "🔧 Development HTTPS Setup"
echo "=========================="
echo ""

echo "Choose your development HTTPS option:"
echo "1. Self-signed certificates (localhost)"
echo "2. Ngrok tunnel (real HTTPS URL)"
echo "3. Local domain with mkcert (trusted certificates)"
echo ""
read -p "Choose option (1/2/3): " option

case $option in
    1)
        echo ""
        echo "🔒 Setting up self-signed certificates..."
        
        # Create self-signed certificate for localhost
        openssl req -x509 -newkey rsa:4096 -keyout dev-localhost.key -out dev-localhost.crt \
            -days 365 -nodes \
            -subj "/C=US/ST=Dev/L=Dev/O=DevOrg/CN=localhost" \
            -addext "subjectAltName=DNS:localhost,DNS:127.0.0.1,IP:127.0.0.1" 2>/dev/null
        
        if [ $? -eq 0 ]; then
            echo "✅ Certificates created"
            
            # Create development environment
            cat > .env.dev.https << EOF
# Development HTTPS Environment
SSL_CERT_PATH=$(pwd)/dev-localhost.crt
SSL_KEY_PATH=$(pwd)/dev-localhost.key
DOMAIN=localhost
CLAUDE_API_KEY=your_claude_api_key_here
EOF
            
            # Create start script
            cat > start-dev-https.sh << 'EOF'
#!/bin/bash
echo "🔒 Starting Development Server with HTTPS..."
source .env.dev.https
export SSL_CERT_PATH SSL_KEY_PATH DOMAIN CLAUDE_API_KEY
cd study-pdf-reader/backend
source venv/bin/activate
python main.py
EOF
            chmod +x start-dev-https.sh
            
            echo "✅ Development HTTPS ready!"
            echo ""
            echo "🚀 To start:"
            echo "1. Add your Claude API key to .env.dev.https"
            echo "2. Run: ./start-dev-https.sh"
            echo "3. Access: https://localhost (ignore browser warning)"
            echo "4. Update frontend: VITE_API_BASE_URL=https://localhost/api/v1"
        else
            echo "❌ OpenSSL not found. Install with: sudo apt-get install openssl"
        fi
        ;;
        
    2)
        echo ""
        echo "🌐 Setting up Ngrok tunnel..."
        
        # Check if ngrok is installed
        if ! command -v ngrok &> /dev/null; then
            echo "Installing ngrok..."
            if command -v wget &> /dev/null; then
                wget -q https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-amd64.zip
                unzip -q ngrok-stable-linux-amd64.zip
                chmod +x ngrok
                sudo mv ngrok /usr/local/bin/
                rm ngrok-stable-linux-amd64.zip
            else
                echo "Please install ngrok manually from: https://ngrok.com/download"
                exit 1
            fi
        fi
        
        echo "✅ Ngrok ready"
        
        # Create ngrok startup script
        cat > start-dev-ngrok.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Development Server with Ngrok..."

# Start backend in background
cd study-pdf-reader/backend
source venv/bin/activate
python main.py &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start ngrok tunnel
echo "🌐 Creating HTTPS tunnel..."
ngrok http 8000 --log=stdout &
NGROK_PID=$!

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID $NGROK_PID 2>/dev/null
    exit 0
}

# Set trap for cleanup
trap cleanup SIGINT SIGTERM

echo ""
echo "✅ Servers started!"
echo "📋 Next steps:"
echo "1. Copy the HTTPS URL from ngrok output above"
echo "2. Update frontend/.env: VITE_API_BASE_URL=https://your-ngrok-url.ngrok.io/api/v1"
echo "3. Restart frontend in another terminal"
echo ""
echo "Press Ctrl+C to stop all servers"

# Wait for user to stop
wait
EOF
        chmod +x start-dev-ngrok.sh
        
        echo "✅ Ngrok development setup ready!"
        echo ""
        echo "🚀 To start:"
        echo "./start-dev-ngrok.sh"
        echo ""
        echo "This will:"
        echo "- Start your backend on HTTP"
        echo "- Create HTTPS tunnel via ngrok"
        echo "- Give you a real HTTPS URL to use"
        ;;
        
    3)
        echo ""
        echo "🛡️ Setting up trusted local certificates with mkcert..."
        
        # Check if mkcert is installed
        if ! command -v mkcert &> /dev/null; then
            echo "Installing mkcert..."
            if command -v wget &> /dev/null; then
                wget -O mkcert https://github.com/FiloSottile/mkcert/releases/download/v1.4.4/mkcert-v1.4.4-linux-amd64
                chmod +x mkcert
                sudo mv mkcert /usr/local/bin/
            else
                echo "Please install mkcert manually from: https://github.com/FiloSottile/mkcert"
                exit 1
            fi
        fi
        
        # Install CA
        mkcert -install
        
        # Create certificates for local development
        mkcert localhost 127.0.0.1 ::1
        
        if [ -f "localhost+2.pem" ]; then
            echo "✅ Trusted certificates created"
            
            # Create development environment
            cat > .env.dev.trusted << EOF
# Development HTTPS Environment (Trusted)
SSL_CERT_PATH=$(pwd)/localhost+2.pem
SSL_KEY_PATH=$(pwd)/localhost+2-key.pem
DOMAIN=localhost
CLAUDE_API_KEY=your_claude_api_key_here
EOF
            
            # Create start script
            cat > start-dev-trusted.sh << 'EOF'
#!/bin/bash
echo "🛡️ Starting Development Server with Trusted HTTPS..."
source .env.dev.trusted
export SSL_CERT_PATH SSL_KEY_PATH DOMAIN CLAUDE_API_KEY
cd study-pdf-reader/backend
source venv/bin/activate
python main.py
EOF
            chmod +x start-dev-trusted.sh
            
            echo "✅ Trusted development HTTPS ready!"
            echo ""
            echo "🚀 To start:"
            echo "1. Add your Claude API key to .env.dev.trusted"
            echo "2. Run: ./start-dev-trusted.sh"
            echo "3. Access: https://localhost (NO browser warning!)"
            echo "4. Update frontend: VITE_API_BASE_URL=https://localhost/api/v1"
        else
            echo "❌ Failed to create certificates"
        fi
        ;;
        
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "💡 Development Tips:"
echo "- Option 1: Quick but browser shows warning"
echo "- Option 2: Real HTTPS URL, easy sharing"
echo "- Option 3: Best experience, no warnings"