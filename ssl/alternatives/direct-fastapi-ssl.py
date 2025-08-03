# Direct FastAPI with SSL (No Nginx)
# Simpler setup but with limitations

import ssl
import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve frontend static files
app.mount("/", StaticFiles(directory="frontend/build", html=True), name="static")

# Your API routes here
@app.get("/api/health")
async def health():
    return {"status": "healthy", "https": True}

if __name__ == "__main__":
    # SSL Configuration
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(
        certfile="/etc/letsencrypt/live/yourdomain.com/fullchain.pem",
        keyfile="/etc/letsencrypt/live/yourdomain.com/privkey.pem"
    )
    
    # Run with HTTPS
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=443,
        ssl_keyfile="/etc/letsencrypt/live/yourdomain.com/privkey.pem",
        ssl_certfile="/etc/letsencrypt/live/yourdomain.com/fullchain.pem",
        ssl_version=ssl.PROTOCOL_TLS_SERVER,
        ssl_ciphers="ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS"
    )

# Pros:
# ✅ Simple setup
# ✅ One service to manage
# ✅ Direct SSL termination

# Cons:
# ❌ No reverse proxy benefits
# ❌ No rate limiting
# ❌ No static file optimization
# ❌ No load balancing
# ❌ Must restart app for SSL renewal
# ❌ No HTTP to HTTPS redirect
# ❌ Limited security headers
# ❌ No compression optimization