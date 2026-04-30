#!/bin/bash
# Run this ONCE on a fresh Ubuntu 22.04 DigitalOcean droplet as root.
# Usage: bash setup-droplet.sh

set -e

echo "==> Updating system packages..."
apt-get update -y && apt-get upgrade -y

echo "==> Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

echo "==> Installing Docker Compose plugin..."
apt-get install -y docker-compose-plugin

echo "==> Installing Git..."
apt-get install -y git

echo "==> Cloning repository..."
cd /opt
git clone https://github.com/dinnewton/my-worker.git myworker
cd myworker

echo "==> Creating backend .env from example..."
cp backend/.env.example backend/.env

echo ""
echo "=========================================================="
echo " Setup complete!"
echo " Next steps:"
echo "   1. Edit /opt/myworker/backend/.env with your API keys"
echo "      nano /opt/myworker/backend/.env"
echo "   2. Then run: bash /opt/myworker/deploy.sh"
echo "=========================================================="
