#!/bin/bash
# Unpack and Deploy Script for Server
# Unpacks deploy-standalone.zip and deploy-assets.zip and sets up the application
#
# Usage: ./unpack-and-deploy.sh
# Location: /home/thehappy/app.aiwoochat.com/app/unpack-and-deploy.sh

# Note: set -e removed to allow graceful handling of optional operations

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Unpacking deployment files...${NC}"

# Navigate to project directory
cd /home/thehappy/app.aiwoochat.com/app

# Check if zip files exist
if [ ! -f "deploy-standalone.zip" ] && [ ! -f "deploy-assets.zip" ] && [ ! -f "deploy.zip" ]; then
    echo -e "${RED}❌ Error: No deploy zip files found!${NC}"
    echo "Please upload deploy-standalone.zip and deploy-assets.zip (or deploy.zip) first."
    exit 1
fi

# Create temporary directories
echo -e "${YELLOW}Creating temporary directories...${NC}"
mkdir -p temp_deploy_standalone temp_deploy_assets

# Unpack standalone (if exists)
if [ -f "deploy-standalone.zip" ]; then
    echo -e "${YELLOW}Unpacking deploy-standalone.zip...${NC}"
    cd temp_deploy_standalone
    unzip -o ../deploy-standalone.zip
    cd ..
else
    echo -e "${YELLOW}⚠️  deploy-standalone.zip not found, skipping...${NC}"
fi

# Unpack assets (if exists)
if [ -f "deploy-assets.zip" ]; then
    echo -e "${YELLOW}Unpacking deploy-assets.zip...${NC}"
    cd temp_deploy_assets
    unzip -o ../deploy-assets.zip
    cd ..
else
    echo -e "${YELLOW}⚠️  deploy-assets.zip not found, skipping...${NC}"
fi

# Unpack single deploy.zip if exists (alternative)
if [ -f "deploy.zip" ] && [ ! -f "deploy-standalone.zip" ]; then
    echo -e "${YELLOW}Unpacking deploy.zip...${NC}"
    cd temp_deploy_standalone
    unzip -o ../deploy.zip
    cd ..
fi

# Remove old folders
echo -e "${YELLOW}Removing old deployment files...${NC}"
rm -rf .next/standalone .next/static public

# Move new folders to correct location
echo -e "${YELLOW}Setting up new deployment...${NC}"
mkdir -p .next

# Move standalone
if [ -d "temp_deploy_standalone/standalone" ]; then
    mv temp_deploy_standalone/standalone .next/standalone
elif [ -d "temp_deploy_standalone/.next/standalone" ]; then
    mv temp_deploy_standalone/.next/standalone .next/standalone
fi

# Move static
if [ -d "temp_deploy_assets/static" ]; then
    mv temp_deploy_assets/static .next/static
fi

# Move public
if [ -d "temp_deploy_assets/public" ]; then
    mv temp_deploy_assets/public public
fi

# Clean up temp directories
echo -e "${YELLOW}Cleaning up...${NC}"
rm -rf temp_deploy_standalone temp_deploy_assets

# Set permissions
echo -e "${YELLOW}Setting permissions...${NC}"
chmod -R 755 .next/standalone/ 2>/dev/null || true
chmod -R 755 .next/static/ 2>/dev/null || true
chmod -R 755 public/ 2>/dev/null || true

# ALWAYS copy static folder to standalone/.next/static/ (REQUIRED for Next.js)
if [ -d ".next/standalone/.next" ] && [ -d ".next/static" ]; then
    echo -e "${YELLOW}Setting up static assets in standalone...${NC}"
    cd .next/standalone/.next/
    
    # Remove existing static (if any) and copy complete static folder
    rm -rf static 2>/dev/null || true
    
    # Copy entire static folder with all contents (chunks, css, media, etc.)
    echo -e "${YELLOW}Copying complete static folder...${NC}"
    cp -r ../../../static static
    
    # Set permissions on copied static folder
    chmod -R 755 static/
    
    cd ../../../../
    echo -e "${GREEN}✅ Static assets configured in standalone/.next/static/${NC}"
elif [ -d ".next/standalone/.next" ]; then
    echo -e "${YELLOW}⚠️  Warning: .next/static not found. Static assets may not work correctly.${NC}"
fi

echo -e "${GREEN}✅ Deployment unpacking complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Restart Node.js app in cPanel (Node.js App → Restart)"
echo "2. Test application at https://app.aiwoochat.com"
echo ""
echo -e "${YELLOW}💡 To clean up zip files:${NC}"
echo "   rm -f deploy*.zip"
