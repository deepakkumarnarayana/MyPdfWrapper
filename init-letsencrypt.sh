#!/bin/bash

if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found. Please copy .env.example to .env and fill in your details."
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
    echo "ERROR: DOMAIN and EMAIL must be set in the .env file."
    exit 1
fi

echo "### Initializing SSL certificate for $DOMAIN..."

# Create dummy certificate to allow Nginx to start
mkdir -p ./data/certbot/conf
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "./data/certbot/conf/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "./data/certbot/conf/ssl-dhparams.pem"

mkdir -p ./data/certbot/conf/live/$DOMAIN
openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
    -keyout ./data/certbot/conf/live/$DOMAIN/privkey.pem \
    -out ./data/certbot/conf/live/$DOMAIN/fullchain.pem \
    -subj "/CN=localhost"

# Create the Nginx config with the user's domain
sed "s/your_domain.com/$DOMAIN/g" ./data/nginx/app.conf > ./data/nginx/app.conf.temp
mv ./data/nginx/app.conf.temp ./data/nginx/app.conf

# Start Nginx
docker-compose -f docker-compose.prod.yml up -d frontend

# Request the real certificate from Let's Encrypt
docker-compose -f docker-compose.prod.yml run --rm certbot certonly --webroot --webroot-path /var/www/certbot \
    --email $EMAIL \
    -d $DOMAIN \
    --rsa-key-size 4096 \
    --agree-tos \
    --force-renewal \
    --non-interactive

# Restart Nginx to load the new certificate
docker-compose -f docker-compose.prod.yml restart frontend

echo "### SSL setup complete. Your application is ready!"
echo "### Run 'docker-compose -f docker-compose.prod.yml up -d' to start all services."
