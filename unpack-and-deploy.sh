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

# Cleanup: Kill old zombie next-server processes (if more than 2 exist)
# This prevents resource exhaustion from accumulated processes
echo -e "${YELLOW}Checking for old processes...${NC}"
NEXT_PROCESSES=$(pgrep -f "next-server" 2>/dev/null | wc -l || echo "0")
if [ "$NEXT_PROCESSES" -gt 2 ]; then
    echo -e "${YELLOW}⚠️  Found $NEXT_PROCESSES next-server processes. Killing old ones...${NC}"
    # Kill all except the most recent 2 (in case app is running)
    pgrep -f "next-server" 2>/dev/null | head -n -2 | xargs -r kill 2>/dev/null || true
    sleep 1
    echo -e "${GREEN}✅ Old processes cleaned up${NC}"
else
    echo -e "${GREEN}✅ Process count OK ($NEXT_PROCESSES processes)${NC}"
fi

# Cleanup: Remove Next.js cache folder (can grow very large)
# This does NOT affect .next/standalone or .next/static which are required
echo -e "${YELLOW}Cleaning up Next.js cache...${NC}"
if [ -d ".next/cache" ]; then
    CACHE_SIZE=$(du -sh .next/cache 2>/dev/null | cut -f1 || echo "unknown")
    echo -e "${YELLOW}Removing .next/cache (size: $CACHE_SIZE)...${NC}"
    rm -rf .next/cache 2>/dev/null || true
    echo -e "${GREEN}✅ Cache cleaned${NC}"
fi

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
# Next.js standalone build does NOT automatically copy .next/static/ - must do manually!
if [ -d ".next/standalone/.next" ] && [ -d ".next/static" ]; then
    echo -e "${YELLOW}Setting up static assets in standalone...${NC}"
    cd .next/standalone/.next/
    
    # Remove existing static (if any) and copy complete static folder
    rm -rf static 2>/dev/null || true
    
    # Copy entire static folder with all contents (chunks, css, media, etc.)
    # From .next/standalone/.next/ to .next/static: ../../static
    echo -e "${YELLOW}Copying complete static folder...${NC}"
    cp -r ../../static static
    
    # Copy BUILD_ID file (REQUIRED for asset URLs with /_next/static/<build_id>/...)
    # BUILD_ID should be in standalone/.next/ already, but also copy to root .next/ for fallback
    if [ -f "BUILD_ID" ]; then
        echo -e "${YELLOW}BUILD_ID already exists in standalone/.next/${NC}"
    elif [ -f "../../BUILD_ID" ]; then
        echo -e "${YELLOW}Copying BUILD_ID file...${NC}"
        cp ../../BUILD_ID BUILD_ID 2>/dev/null || true
    elif [ -f "../../../BUILD_ID" ]; then
        echo -e "${YELLOW}Copying BUILD_ID file from root...${NC}"
        cp ../../../BUILD_ID BUILD_ID 2>/dev/null || true
    else
        echo -e "${YELLOW}⚠️  Warning: BUILD_ID file not found${NC}"
    fi
    
    # Also copy BUILD_ID to root .next/ folder (some Next.js versions check there)
    cd ../../../
    if [ -f ".next/standalone/.next/BUILD_ID" ] && [ ! -f ".next/BUILD_ID" ]; then
        echo -e "${YELLOW}Copying BUILD_ID to root .next/ folder...${NC}"
        cp .next/standalone/.next/BUILD_ID .next/BUILD_ID 2>/dev/null || true
        echo -e "${GREEN}✅ BUILD_ID copied to root .next/${NC}"
    fi
    cd .next/standalone/.next/
    
    # Set permissions on copied static folder
    chmod -R 755 static/
    chmod 644 BUILD_ID 2>/dev/null || true
    
    # Verify static folder was copied correctly
    if [ -d "static" ]; then
        echo -e "${GREEN}✅ Static folder copied successfully${NC}"
        echo -e "${YELLOW}Verifying static folder structure...${NC}"
        if [ -d "static/chunks" ] || [ -d "static/css" ]; then
            echo -e "${GREEN}✅ Static subfolders (chunks/css) found${NC}"
            echo -e "${YELLOW}Sample files in static/:${NC}"
            ls -la static/ | head -10
        else
            echo -e "${YELLOW}⚠️  Warning: Static subfolders (chunks/css) not found${NC}"
            echo -e "${YELLOW}Listing static/ contents:${NC}"
            ls -la static/ 2>/dev/null || echo "  (empty or error)"
        fi
    else
        echo -e "${RED}❌ Error: Static folder was not copied!${NC}"
    fi
    
    # Verify BUILD_ID was copied
    if [ -f "BUILD_ID" ]; then
        echo -e "${GREEN}✅ BUILD_ID file copied successfully${NC}"
        echo -e "${YELLOW}BUILD_ID: $(cat BUILD_ID)${NC}"
    else
        echo -e "${YELLOW}⚠️  Warning: BUILD_ID file not found in standalone/.next/${NC}"
    fi
    
    cd ../../../../
    echo -e "${GREEN}✅ Static assets configured in standalone/.next/static/${NC}"
elif [ -d ".next/standalone/.next" ]; then
    echo -e "${YELLOW}⚠️  Warning: .next/static not found. Static assets may not work correctly.${NC}"
    echo -e "${YELLOW}Checking if .next/static exists...${NC}"
    ls -la .next/ | grep static || echo "  (not found)"
fi

echo -e "${GREEN}✅ Deployment unpacking complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Restart Node.js app in cPanel (Node.js App → Restart)"
echo "2. Test application at https://app.aiwoochat.com"
echo ""
echo -e "${YELLOW}💡 To clean up zip files:${NC}"
echo "   rm -f deploy*.zip"
