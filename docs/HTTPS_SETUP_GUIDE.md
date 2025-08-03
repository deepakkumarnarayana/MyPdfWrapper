# HTTPS Setup Guide

## 🚀 Quick Setup (2 minutes)

### Step 1: Run the Setup Script
```bash
./setup-https.sh
```
The script will ask for:
- **Domain**: Your actual domain name (e.g., `pdfreader.yourdomain.com`)
- **Email**: Your email for Let's Encrypt notifications

### Step 2: Add Your API Key
```bash
# Edit the production environment file
nano .env.production

# Add your Claude API key
CLAUDE_API_KEY=your_actual_claude_api_key_here
```

### Step 3: Start with HTTPS
```bash
./start-https.sh
```

---

## 🌐 Domain Requirements

### Option 1: You Have a Domain
If you own a domain (like `mydomain.com`):
```bash
# Examples of valid setups:
Domain: pdfreader.mydomain.com
Domain: app.mydomain.com  
Domain: mydomain.com
```

**DNS Requirements:**
- Create an A record pointing your domain/subdomain to your server's IP
- Example: `pdfreader.mydomain.com` → `192.168.1.100`

### Option 2: You Don't Have a Domain
**Free Options:**
1. **Ngrok** (easiest for testing):
   ```bash
   # Install ngrok
   npm install -g ngrok
   
   # Expose your local server
   ngrok http 8000
   # Use the https URL ngrok gives you
   ```

2. **Dynamic DNS Services**:
   - DuckDNS (free): `myapp.duckdns.org`
   - No-IP (free): `myapp.ddns.net`

3. **Cloud Platforms**:
   - Railway, Vercel, Netlify provide free domains

### Option 3: Local Development with Self-Signed Certificates
```bash
# Create local certificates for testing
openssl req -x509 -newkey rsa:4096 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj "/CN=localhost"

# Set environment variables
export SSL_CERT_PATH=$(pwd)/localhost.crt
export SSL_KEY_PATH=$(pwd)/localhost.key
export DOMAIN=localhost

# Start backend
python main.py
```

---

## 📋 Complete Setup Examples

### Example 1: With Real Domain
```bash
# You own: mydomain.com
# You want: https://pdfreader.mydomain.com

# 1. Create DNS A record
# pdfreader.mydomain.com → YOUR_SERVER_IP

# 2. Run setup
./setup-https.sh
# Enter: pdfreader.mydomain.com
# Enter: admin@mydomain.com

# 3. Done! Access at https://pdfreader.mydomain.com
```

### Example 2: With Ngrok (No Domain)
```bash
# 1. Install ngrok
npm install -g ngrok

# 2. Start your app normally
python main.py  # HTTP mode

# 3. In another terminal, expose it
ngrok http 8000
# Copy the https URL (e.g., https://abc123.ngrok.io)

# 4. Update frontend
# Edit frontend/.env
VITE_API_BASE_URL=https://abc123.ngrok.io/api/v1
```

### Example 3: Local Testing Only
```bash
# 1. Create self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj "/CN=localhost"

# 2. Set environment
export SSL_CERT_PATH=$(pwd)/localhost.crt
export SSL_KEY_PATH=$(pwd)/localhost.key
export DOMAIN=localhost

# 3. Start backend
python main.py
# Access at https://localhost (ignore browser warning)
```

---

## 🔧 Troubleshooting

### "Domain not accessible"
- Check DNS: `nslookup yourdomain.com`
- Ensure ports 80 and 443 are open
- Check firewall settings

### "Certificate failed"
- Verify domain points to your server
- Check email is valid
- Try staging mode first: `STAGING=1 ./setup-https.sh`

### "Permission denied on port 443"
```bash
# Run with sudo (production servers)
sudo ./start-https.sh

# Or use port forwarding
sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8443
# Then modify main.py to use port 8443
```

---

## 🎯 Recommended Approach

**For Development**: Use ngrok (no domain needed)
**For Production**: Get a real domain + Let's Encrypt (free)

Choose the option that fits your needs!