#!/bin/bash

# Interactive HTTPS Setup with Domain Guidance
clear
echo "🔒 PDF Reader HTTPS Setup Wizard"
echo "================================="
echo ""

# Check if user has a domain
echo "Do you have a domain name for this application? (y/n)"
read -p "Answer: " has_domain

if [[ "$has_domain" =~ ^[Yy]$ ]]; then
    echo ""
    echo "📋 Domain Setup Requirements:"
    echo "1. You need a domain like: mydomain.com"
    echo "2. Create a DNS A record pointing to this server's IP"
    echo "3. Example: pdfreader.mydomain.com → $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
    echo ""
    
    read -p "Enter your domain (e.g., pdfreader.mydomain.com): " domain
    read -p "Enter your email for SSL notifications: " email
    
    if [ -z "$domain" ] || [ -z "$email" ]; then
        echo "❌ Domain and email are required"
        exit 1
    fi
    
    echo ""
    echo "🔍 Checking domain accessibility..."
    
    # Test if domain resolves to this server
    domain_ip=$(dig +short "$domain" 2>/dev/null | tail -1)
    server_ip=$(curl -s ifconfig.me 2>/dev/null)
    
    if [ "$domain_ip" != "$server_ip" ] && [ ! -z "$server_ip" ]; then
        echo "⚠️  WARNING: $domain resolves to $domain_ip"
        echo "   But this server's IP is: $server_ip"
        echo "   SSL certificate might fail. Continue anyway? (y/n)"
        read -p "Answer: " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            echo "❌ Please fix DNS first, then run this script again"
            exit 1
        fi
    fi
    
    echo "✅ Setting up HTTPS with real domain..."
    export DOMAIN="$domain"
    export EMAIL="$email"
    ./setup-https.sh
    
else
    echo ""
    echo "🌐 No Domain Options:"
    echo "1. Use Ngrok (easiest for testing)"
    echo "2. Local development with self-signed certificates"
    echo "3. Get a free domain first"
    echo ""
    echo "Choose option (1/2/3):"
    read -p "Answer: " option
    
    case $option in
        1)
            echo ""
            echo "🚀 Setting up Ngrok..."
            
            # Check if ngrok is installed
            if ! command -v ngrok &> /dev/null; then
                echo "Installing ngrok..."
                if command -v npm &> /dev/null; then
                    npm install -g ngrok
                else
                    echo "❌ Please install Node.js first, then run: npm install -g ngrok"
                    exit 1
                fi
            fi
            
            echo "✅ Starting your app with HTTP..."
            cd study-pdf-reader/backend
            source venv/bin/activate
            python main.py &
            backend_pid=$!
            
            sleep 3
            echo "✅ Starting ngrok tunnel..."
            ngrok http 8000 &
            ngrok_pid=$!
            
            sleep 5
            echo ""
            echo "🎉 Setup complete!"
            echo "1. Find your HTTPS URL in the ngrok output above"
            echo "2. Update frontend/.env with: VITE_API_BASE_URL=https://YOUR_NGROK_URL/api/v1"
            echo "3. Restart frontend: npm run dev"
            echo ""
            echo "Press Enter to stop servers..."
            read
            kill $backend_pid $ngrok_pid 2>/dev/null
            ;;
            
        2)
            echo ""
            echo "🔧 Creating self-signed certificates for localhost..."
            
            # Create self-signed certificate
            openssl req -x509 -newkey rsa:4096 -keyout localhost.key -out localhost.crt \
                -days 365 -nodes -subj "/CN=localhost" 2>/dev/null
            
            if [ $? -eq 0 ]; then
                echo "✅ Certificates created"
                
                # Create environment file
                cat > .env.https << EOF
SSL_CERT_PATH=$(pwd)/localhost.crt
SSL_KEY_PATH=$(pwd)/localhost.key
DOMAIN=localhost
CLAUDE_API_KEY=your_claude_api_key_here
EOF
                
                echo "✅ Environment configured"
                echo ""
                echo "🎉 Setup complete!"
                echo "1. Add your Claude API key to .env.https"
                echo "2. Start backend: source .env.https && cd study-pdf-reader/backend && python main.py"
                echo "3. Access at: https://localhost (ignore browser security warning)"
                echo ""
            else
                echo "❌ Failed to create certificates. Install OpenSSL first."
            fi
            ;;
            
        3)
            echo ""
            echo "🌐 Free Domain Options:"
            echo ""
            echo "1. DuckDNS (Recommended):"
            echo "   - Go to: https://www.duckdns.org"
            echo "   - Sign up and create: myapp.duckdns.org"
            echo "   - Point it to your server IP: $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
            echo ""
            echo "2. Ngrok (Easiest):"
            echo "   - Run this script again and choose option 1"
            echo ""
            echo "3. Cloud Platforms:"
            echo "   - Railway.app (free tier)"
            echo "   - Vercel.com (for frontend)"
            echo "   - Render.com (free tier)"
            echo ""
            echo "After getting a domain, run this script again and choose 'y'"
            ;;
            
        *)
            echo "❌ Invalid option"
            exit 1
            ;;
    esac
fi