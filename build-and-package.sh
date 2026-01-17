#!/bin/bash
# Build and Package Script for Local Deployment
# Creates deploy.zip with all necessary files for upload to server
#
# Usage: ./build-and-package.sh
# Output: deploy.zip (ready to upload to server)

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔨 Building Next.js application...${NC}"

# Build application locally
npm run build

# Check if build was successful
if [ ! -d ".next/standalone" ]; then
    echo -e "${RED}❌ Error: Build failed - .next/standalone folder not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"

# Remove old deploy files
echo -e "${YELLOW}📦 Packaging files for deployment...${NC}"
rm -f deploy.zip deploy-standalone.zip deploy-assets.zip

# Create separate zip files (easier to upload on slow connections)
# Option 1: Separate files (recommended for slow uploads)
echo -e "${YELLOW}Creating deploy-standalone.zip...${NC}"
zip -r deploy-standalone.zip .next/standalone

echo -e "${YELLOW}Creating deploy-assets.zip...${NC}"
zip -r deploy-assets.zip .next/static public

# Option 2: Single file (if you prefer)
echo -e "${YELLOW}Creating deploy.zip (single file)...${NC}"
zip -r deploy.zip .next/standalone .next/static public

echo -e "${GREEN}✅ Packaging complete!${NC}"
echo ""
echo -e "${YELLOW}📤 Next steps:${NC}"
echo "1. Upload deploy-standalone.zip and deploy-assets.zip to server"
echo "2. Or upload deploy.zip (single file) to server"
echo "3. On server, run the deployment script (see docs/LOCAL_BUILD_DEPLOYMENT.md)"
echo ""
echo -e "${GREEN}Files created:${NC}"
ls -lh deploy*.zip
