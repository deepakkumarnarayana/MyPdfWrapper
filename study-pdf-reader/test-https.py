#!/usr/bin/env python3

"""
Test script for HTTPS configuration
"""

import ssl
import os

def test_ssl_config():
    """Test SSL configuration"""
    
    print("🔍 Testing HTTPS Configuration")
    print("=" * 30)
    
    # Test 1: SSL Context Creation
    try:
        ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        print("✅ SSL context creation: PASS")
    except Exception as e:
        print(f"❌ SSL context creation: FAIL ({e})")
        return
    
    # Test 2: Cipher Configuration
    try:
        cipher_string = "ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS"
        ssl_context.set_ciphers(cipher_string)
        print("✅ SSL cipher configuration: PASS")
    except Exception as e:
        print(f"❌ SSL cipher configuration: FAIL ({e})")
        return
    
    # Test 3: Environment Variable Detection
    ssl_cert_path = os.getenv("SSL_CERT_PATH")
    ssl_key_path = os.getenv("SSL_KEY_PATH")
    
    if ssl_cert_path and ssl_key_path:
        print(f"🔍 SSL_CERT_PATH: {ssl_cert_path}")
        print(f"🔍 SSL_KEY_PATH: {ssl_key_path}")
        
        if os.path.exists(ssl_cert_path) and os.path.exists(ssl_key_path):
            print("✅ SSL certificate files found")
            
            # Test certificate loading
            try:
                ssl_context.load_cert_chain(ssl_cert_path, ssl_key_path)
                print("✅ SSL certificate loading: PASS")
            except Exception as e:
                print(f"❌ SSL certificate loading: FAIL ({e})")
        else:
            print("⚠️  SSL certificate files not found (HTTP mode)")
    else:
        print("⚠️  SSL environment variables not set (HTTP mode)")
    
    # Test 4: Port Configuration
    domain = os.getenv("DOMAIN")
    if domain:
        print(f"🔍 Domain configured: {domain}")
    else:
        print("⚠️  No domain configured")
    
    print("\n🎉 HTTPS configuration test completed!")
    print("\nTo enable HTTPS:")
    print("1. Run: ./setup-https.sh")
    print("2. Set SSL_CERT_PATH and SSL_KEY_PATH in .env.production")
    print("3. Start with: ./start-https.sh")

if __name__ == "__main__":
    test_ssl_config()