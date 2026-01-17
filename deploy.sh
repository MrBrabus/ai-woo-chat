#!/bin/bash
# AI Woo Chat - Deploy Script
# This script activates nodevenv and deploys the application
#
# Usage: ./deploy.sh
# Location: /home/thehappy/app.aiwoochat.com/app/deploy.sh

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🚀 Starting deployment...${NC}"

# Navigate to project directory
cd /home/thehappy/app.aiwoochat.com/app

# Activate nodevenv (REQUIRED for npm to work on cPanel shared hosting)
echo -e "${YELLOW}📦 Activating Node.js environment...${NC}"
source /home/thehappy/nodevenv/app.aiwoochat.com/app/20/bin/activate

# Verify npm is available
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Error: npm not found after activating nodevenv${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js environment activated${NC}"

# Pull latest code from git
echo -e "${YELLOW}📥 Pulling latest code from git...${NC}"
git pull origin main

# Install/update dependencies (if package.json changed)
echo -e "${YELLOW}📦 Installing dependencies...${NC}"
npm install

# Build application
echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build

echo -e "${GREEN}✅ Deploy complete! LiteSpeed will auto-reload.${NC}"