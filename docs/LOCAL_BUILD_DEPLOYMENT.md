# Local Build & Deployment Guide

**Status:** ✅ RECOMMENDED WORKFLOW  
**Last Updated:** 2025-01-17  
**Reason:** Server build fails with EAGAIN errors due to shared hosting resource limits

**📌 For quick reference, see [Quick Deploy Guide](./QUICK_DEPLOY.md) - 3 koraka!**

---

## 📋 Overview

Because the live server has resource limitations (EAGAIN errors during build), we use **local build + upload** workflow instead of building directly on the server.

---

## 🏗️ Local Build Process

### Step 1: Build Locally

On your local machine (Cursor/XAMPP):

```bash
# Navigate to project
cd "C:\xampp\htdocs\AI Woo Chat"

# Install dependencies (if needed)
npm install

# Build application
npm run build
```

### Step 2: Package for Deployment

Use the automated script:

```bash
# Windows PowerShell
.\build-and-package.sh

# Or manually create zip files:
# - deploy-standalone.zip (contains .next/standalone/)
# - deploy-assets.zip (contains .next/static/ and public/)
```

Or create manually:
- Create `deploy-standalone.zip` with `.next/standalone/` folder
- Create `deploy-assets.zip` with `.next/static/` and `public/` folders

---

## 🚀 Server Deployment Process

### Step 1: Upload ZIP Files

Upload `deploy-standalone.zip` and `deploy-assets.zip` to server:
- **Location:** `/home/thehappy/app.aiwoochat.com/app/`
- **Method:** FTP, cPanel File Manager, or SCP

### Step 2: Unpack on Server (Automated)

SSH into server or use cPanel Terminal:

```bash
cd /home/thehappy/app.aiwoochat.com/app

# Make sure unpack-and-deploy.sh is executable (first time only)
chmod +x unpack-and-deploy.sh

# Run the deploy script (automatically unpacks and sets up everything)
./unpack-and-deploy.sh
```

**What the script does automatically:**
- ✅ Unpacks `deploy-standalone.zip` and `deploy-assets.zip`
- ✅ Moves folders to correct locations (`.next/standalone/`, `.next/static/`, `public/`)
- ✅ **Automatically copies complete `static` folder to `standalone/.next/static/`**
- ✅ Sets all permissions (755)
- ✅ Cleans up temp files

**No manual copying needed!** The script handles everything.

### Step 3: Restart Node.js App

In cPanel:
1. Go to **Node.js App**
2. Find app for `app.aiwoochat.com`
3. Click **"Restart"**

### Step 4: Test

Visit `https://app.aiwoochat.com` and verify the application works.

---

## 🔄 Complete Workflow (Git Pull + Local Build)

### When Making Code Changes:

1. **Local Development:**
   ```bash
   # Make changes in Cursor
   # Test locally with npm run dev
   ```

2. **Commit & Push:**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

3. **Local Build:**
   ```bash
   npm run build
   # Create deploy zip files (manually or with script)
   ```

4. **Upload & Deploy on Server:**
   - Upload zip files to server
   - Run deployment commands (see Step 2 above)
   - Restart Node.js app

---

## ⚠️ Important Notes

### Why Not Build on Server?

The live server returns `EAGAIN` errors when building because:
- Shared hosting has strict process limits
- Next.js build spawns multiple worker processes
- Server cannot handle the parallelization required

### File Structure After Deployment

```
/home/thehappy/app.aiwoochat.com/app/
├── .next/
│   ├── standalone/          # Complete standalone build
│   │   ├── .next/
│   │   │   ├── server/      # Server files (REQUIRED)
│   │   │   └── static/      # Static assets (copied, not symlinked)
│   │   ├── node_modules/    # Dependencies
│   │   ├── public/          # Public assets
│   │   └── server.js        # Entry point
│   └── static/              # Static assets (root level)
├── public/                  # Public assets (root level)
└── server.js                # Root entry point
```

### What Gets Uploaded

- `.next/standalone/` - Complete standalone build (includes everything needed)
- `.next/static/` - Static assets (CSS, JS, fonts, etc.)
- `public/` - Public assets (favicon, widget loader, etc.)

### What Does NOT Get Uploaded

- Source code (`src/` folder) - not needed in production
- `node_modules/` (root) - standalone has its own
- `.env` files - already on server
- Development files

---

## ⚠️ Resource Management (Important!)

### Preventing Process Accumulation

The deployment script (`unpack-and-deploy.sh`) automatically:
- ✅ **Kills old zombie `next-server` processes** before deployment (if more than 2 exist)
- ✅ **Cleans up `.next/cache` folder** to prevent excessive disk usage
- ✅ **Removes old deployment folders** before unpacking new ones

**Why this matters:**
- Shared hosting has strict resource limits (processes, memory, disk)
- Old processes can accumulate if Node.js app doesn't restart cleanly
- `.next/cache` can grow very large over time (hundreds of MB or GB)

**If you still see too many processes:**
1. Check cPanel → Process Manager
2. Kill old `next-server` processes manually
3. Restart Node.js app in cPanel

### Preventing Cache Bloat

Next.js cache folder (`.next/cache`) is automatically cleaned during each deployment.

**Cache configuration:**
- `cacheMaxMemorySize: 50MB` is set in `next.config.js` to limit in-memory cache
- `.next/cache` folder is removed during each deploy (does NOT affect required `.next/standalone` or `.next/static`)

---

## 🛠️ Troubleshooting

### "Permission denied" when unpacking

**Solution:**
```bash
# Unpack in temp folder first, then move
mkdir temp_deploy
cd temp_deploy
unzip ../deploy-standalone.zip
cd ..
mv temp_deploy/standalone .next/standalone
rm -rf temp_deploy
```

### "Cannot find module" errors after deployment

**Check:**
- Is `.next/standalone/.next/server/` folder present?
- Are all permissions set correctly (755)?
- Did you restart the Node.js app?

### Static files return 404

**Solution:**
- Ensure `.next/standalone/.next/static/` exists (copy, not symlink)
- Verify permissions are 755
- Restart Node.js app

---

## 📝 Quick Reference

### Local Build Command:
```bash
npm run build
```

### Create Deployment Packages:
```bash
# Manual:
zip -r deploy-standalone.zip .next/standalone
zip -r deploy-assets.zip .next/static public

# Or use script (if available):
./build-and-package.sh
```

### Server Deployment (Quick):
```bash
cd /home/thehappy/app.aiwoochat.com/app
mkdir -p temp_deploy_standalone temp_deploy_assets
cd temp_deploy_standalone && unzip -o ../deploy-standalone.zip && cd ..
cd temp_deploy_assets && unzip -o ../deploy-assets.zip && cd ..
rm -rf .next/standalone .next/static public
mkdir -p .next
mv temp_deploy_standalone/standalone .next/standalone
mv temp_deploy_assets/static .next/static
mv temp_deploy_assets/public public 2>/dev/null || true
rm -rf temp_deploy_standalone temp_deploy_assets
chmod -R 755 .next/ public/
cd .next/standalone/.next/ && rm -f static && cp -r ../../../static static && cd ../../../
```

---

## 🔗 Related Documentation

- [Live Deployment](./LIVE_DEPLOYMENT.md) - Server configuration and environment
- [Production Environment Variables](../PRODUCTION_ENV_VARIABLES.md) - Required env vars

---

**Last Updated:** 2025-01-17  
**Status:** ✅ WORKING - Local build + upload workflow
