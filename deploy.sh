#!/bin/bash
# Run on the droplet to pull latest code and restart services.
# Usage: bash /opt/myworker/deploy.sh
# Or from your local machine: ssh root@YOUR_IP 'bash /opt/myworker/deploy.sh'

set -e

APP_DIR="/opt/myworker"
cd "$APP_DIR"

echo "==> Pulling latest code from GitHub..."
git pull origin main

echo "==> Building and starting containers..."
docker compose up -d --build

echo "==> Waiting for services to be healthy..."
sleep 10

echo "==> Container status:"
docker compose ps

echo ""
echo "==> Done! App is running at http://$(curl -s ifconfig.me)"
