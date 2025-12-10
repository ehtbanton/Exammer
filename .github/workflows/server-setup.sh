#!/bin/bash
#
# Exammer Deployment Server Setup Script
# For Ubuntu minimal (bare metal or cloud VM)
# Domain: exammer.co.uk
#
# Run as root or with sudo:
#   chmod +x server-setup.sh && sudo ./server-setup.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="exammer.co.uk"
APP_PORT=8933
APP_NAME="exammer-deploy"
DEPLOY_USER="${SUDO_USER:-ubuntu}"
DEPLOY_DIR="/home/${DEPLOY_USER}/Exammer"
NODE_VERSION="20"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Exammer Server Setup Script${NC}"
echo -e "${BLUE}  Domain: ${DOMAIN}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (use sudo)${NC}"
    exit 1
fi

# Determine the deploy user
if [ -z "$SUDO_USER" ] || [ "$SUDO_USER" = "root" ]; then
    echo -e "${YELLOW}Enter the username for deployment (default: ubuntu):${NC}"
    read -r input_user
    DEPLOY_USER=${input_user:-ubuntu}
    DEPLOY_DIR="/home/${DEPLOY_USER}/Exammer"
fi

echo -e "${GREEN}Deploy user: ${DEPLOY_USER}${NC}"
echo -e "${GREEN}Deploy directory: ${DEPLOY_DIR}${NC}"
echo ""

# ============================================
# 1. System Update
# ============================================
echo -e "${BLUE}[1/9] Updating system packages...${NC}"
apt update && apt upgrade -y

# ============================================
# 2. Install Essential Packages
# ============================================
echo -e "${BLUE}[2/9] Installing essential packages...${NC}"
# Include python3, pkg-config, libsqlite3-dev for better-sqlite3 native compilation
apt install -y curl wget git build-essential nginx certbot python3-certbot-nginx rsync ufw \
    python3 pkg-config libsqlite3-dev

# ============================================
# 3. Install Node.js 20
# ============================================
echo -e "${BLUE}[3/9] Installing Node.js ${NODE_VERSION}...${NC}"
if ! command -v node &> /dev/null || ! node -v | grep -q "v${NODE_VERSION}"; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt install -y nodejs
    echo -e "${GREEN}Node.js $(node -v) installed${NC}"
else
    echo -e "${GREEN}Node.js $(node -v) already installed${NC}"
fi

# ============================================
# 4. Install PM2 Globally
# ============================================
echo -e "${BLUE}[4/9] Installing PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo -e "${GREEN}PM2 installed${NC}"
else
    echo -e "${GREEN}PM2 already installed${NC}"
fi

# Setup PM2 to start on boot for deploy user
echo -e "${BLUE}Setting up PM2 startup...${NC}"
env PATH=$PATH:/usr/bin pm2 startup systemd -u ${DEPLOY_USER} --hp /home/${DEPLOY_USER}

# ============================================
# 5. Create Deployment Directory
# ============================================
echo -e "${BLUE}[5/9] Creating deployment directory...${NC}"
mkdir -p ${DEPLOY_DIR}
chown -R ${DEPLOY_USER}:${DEPLOY_USER} ${DEPLOY_DIR}
echo -e "${GREEN}Directory created: ${DEPLOY_DIR}${NC}"

# ============================================
# 6. Setup SSH Key for GitHub Actions
# ============================================
echo -e "${BLUE}[6/9] Setting up SSH key for GitHub Actions...${NC}"
SSH_DIR="/home/${DEPLOY_USER}/.ssh"
KEY_FILE="${SSH_DIR}/github_actions_key"

mkdir -p ${SSH_DIR}
chmod 700 ${SSH_DIR}

if [ ! -f "${KEY_FILE}" ]; then
    ssh-keygen -t ed25519 -f ${KEY_FILE} -N "" -C "github-actions-deploy"
    echo -e "${GREEN}SSH key pair generated${NC}"
else
    echo -e "${GREEN}SSH key already exists${NC}"
fi

# Add public key to authorized_keys
PUBKEY=$(cat ${KEY_FILE}.pub)
if ! grep -q "${PUBKEY}" ${SSH_DIR}/authorized_keys 2>/dev/null; then
    echo "${PUBKEY}" >> ${SSH_DIR}/authorized_keys
    echo -e "${GREEN}Public key added to authorized_keys${NC}"
fi

chmod 600 ${SSH_DIR}/authorized_keys
chown -R ${DEPLOY_USER}:${DEPLOY_USER} ${SSH_DIR}

echo ""
echo -e "${YELLOW}============================================${NC}"
echo -e "${YELLOW}IMPORTANT: GitHub Secrets Configuration${NC}"
echo -e "${YELLOW}============================================${NC}"
echo ""
echo -e "Add these secrets to your GitHub repository:"
echo -e "(Settings -> Secrets and variables -> Actions)"
echo ""
echo -e "${GREEN}SSH_HOST:${NC}"
echo "$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')"
echo ""
echo -e "${GREEN}SSH_USER:${NC}"
echo "${DEPLOY_USER}"
echo ""
echo -e "${GREEN}SSH_PRIVATE_KEY:${NC}"
echo -e "${YELLOW}(Copy the entire content below, including BEGIN and END lines)${NC}"
echo ""
cat ${KEY_FILE}
echo ""
echo -e "${YELLOW}============================================${NC}"
echo ""

# ============================================
# 7. Configure Nginx
# ============================================
echo -e "${BLUE}[7/9] Configuring Nginx...${NC}"

# Create nginx config
cat > /etc/nginx/sites-available/${DOMAIN} << 'NGINX_CONFIG'
server {
    listen 80;
    listen [::]:80;
    server_name exammer.co.uk www.exammer.co.uk;

    location / {
        proxy_pass http://127.0.0.1:8933;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;

        # Increase buffer sizes for large responses
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }

    # Increase max body size for file uploads
    client_max_body_size 50M;
}
NGINX_CONFIG

# Enable the site
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload nginx
nginx -t && systemctl reload nginx
echo -e "${GREEN}Nginx configured${NC}"

# ============================================
# 8. Configure Firewall (UFW)
# ============================================
echo -e "${BLUE}[8/9] Configuring firewall...${NC}"
ufw --force enable
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw reload
echo -e "${GREEN}Firewall configured${NC}"
ufw status

# ============================================
# 9. Create Environment File Template
# ============================================
echo -e "${BLUE}[9/9] Creating environment file template...${NC}"
ENV_FILE="${DEPLOY_DIR}/.env"

if [ ! -f "${ENV_FILE}" ]; then
    # Generate a secure NEXTAUTH_SECRET
    NEXTAUTH_SECRET=$(openssl rand -base64 32)

    cat > ${ENV_FILE} << ENV_TEMPLATE
# Exammer Environment Configuration
# Generated by server-setup.sh

# Gemini API Key (choose one method)
# Option 1: Billed API Key (recommended for production)
# GEMINI_API_KEY_BILLED=your-billed-api-key-here

# Option 2: Free tier parallel keys (array format)
GEMINI_API_KEYS_PARALLEL='[]'

# NextAuth Configuration
NEXTAUTH_URL=https://exammer.co.uk
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}

# Database path (relative to app directory)
DATABASE_PATH=./db/exammer.db
ENV_TEMPLATE

    chown ${DEPLOY_USER}:${DEPLOY_USER} ${ENV_FILE}
    chmod 600 ${ENV_FILE}
    echo -e "${GREEN}.env file created at ${ENV_FILE}${NC}"
    echo -e "${YELLOW}Please edit this file to add your Gemini API key(s)${NC}"
else
    echo -e "${GREEN}.env file already exists${NC}"
fi

# Create db directory
mkdir -p ${DEPLOY_DIR}/db
chown -R ${DEPLOY_USER}:${DEPLOY_USER} ${DEPLOY_DIR}

# ============================================
# SSL Certificate Setup
# ============================================
echo ""
echo -e "${YELLOW}============================================${NC}"
echo -e "${YELLOW}SSL Certificate Setup${NC}"
echo -e "${YELLOW}============================================${NC}"
echo ""
echo -e "Before running certbot, ensure your DNS is configured:"
echo -e "  ${GREEN}A record:${NC} exammer.co.uk -> $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo -e "  ${GREEN}A record:${NC} www.exammer.co.uk -> $(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_SERVER_IP')"
echo ""
echo -e "Once DNS is propagated, run:"
echo -e "  ${BLUE}sudo certbot --nginx -d exammer.co.uk -d www.exammer.co.uk${NC}"
echo ""

# ============================================
# Summary
# ============================================
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Next steps:"
echo ""
echo -e "1. ${YELLOW}Configure GitHub Secrets${NC} (see above for SSH_PRIVATE_KEY)"
echo ""
echo -e "2. ${YELLOW}Configure DNS:${NC}"
echo -e "   Point exammer.co.uk and www.exammer.co.uk to this server's IP"
echo ""
echo -e "3. ${YELLOW}Get SSL Certificate:${NC}"
echo -e "   sudo certbot --nginx -d exammer.co.uk -d www.exammer.co.uk"
echo ""
echo -e "4. ${YELLOW}Edit environment variables:${NC}"
echo -e "   nano ${ENV_FILE}"
echo -e "   (Add your Gemini API key)"
echo ""
echo -e "5. ${YELLOW}Push to deploy branch:${NC}"
echo -e "   git push origin deploy"
echo ""
echo -e "6. ${YELLOW}Monitor deployment:${NC}"
echo -e "   su - ${DEPLOY_USER}"
echo -e "   pm2 logs ${APP_NAME}"
echo ""
echo -e "${GREEN}Server is ready to receive deployments!${NC}"
