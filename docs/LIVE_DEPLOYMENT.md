# Live Deployment Documentation

**Status:** ✅ LIVE  
**Last Updated:** 2024-01-20  
**Deploy Type:** Shared Hosting (LiteSpeed + Node.js)

---

## 🌍 Live URLs

### Production URLs:
- **App Dashboard:** https://app.aiwoochat.com
- **Public Domain:** https://aiwoochat.com

### API Base URL:
- **API Endpoints:** https://app.aiwoochat.com/api
- **Widget Endpoints:** https://app.aiwoochat.com/api/widget

---

## 🖥️ Server Information

### Server Configuration:
- **Web Server:** LiteSpeed
- **Runtime:** Node.js 20 (via lsnode)
- **Build Type:** Next.js Standalone
- **Entry Point:** `server.js`
- **Project Location:** `/home/thehappy/app.aiwoochat.com/app`

### Build Output Structure:
```
.next/standalone/     # Standalone server files
.next/static/         # Static assets
public/               # Public assets (favicon, etc.)
server.js             # Entry point (in standalone folder)
```

### Environment:
- **Node.js Version:** 20.x
- **NPM Version:** (auto-managed by LiteSpeed via nodevenv)
- **Node.js Environment:** Virtual environment (nodevenv) required
- **nodevenv Path:** `/home/thehappy/nodevenv/app.aiwoochat.com/app/20/bin/activate`
- **Build Mode:** Production
- **Auto-reload:** LiteSpeed automatically reloads on file changes

**⚠️ Important:** `npm` and `node` are **NOT** available globally in PATH. They are only available after activating nodevenv.

---

## 🔁 Git Workflow

### Repository:
- **Branch:** `main`
- **Remote:** (configured on server)

### Development Flow:
1. **Local Development:**
   - Develop in Cursor / XAMPP (localhost:3001)
   - Test locally with `npm run dev`

2. **Push to Git:**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

3. **Deploy on Server:**
   - **Option A:** Use automated deploy script (recommended):
     ```bash
     cd ~/app.aiwoochat.com/app
     ./deploy.sh
     ```
   - **Option B:** Manual deploy:
     ```bash
     ssh user@server
     cd ~/app.aiwoochat.com/app
     source /home/thehappy/nodevenv/app.aiwoochat.com/app/20/bin/activate
     git pull origin main
     npm run build
     ```
   - LiteSpeed automatically reloads app (no manual restart needed)

### Git Ignore (Files NOT in Git):
- `.next/` - Build output
- `node_modules/` - Dependencies
- `deploy/` - Deploy artifacts
- `.env*.local` - Local environment variables
- `stderr.log` / `stdout.log` - Runtime logs

---

## ⚙️ Build Configuration

### `next.config.js` Settings:

```javascript
{
  output: 'standalone',  // Standalone build for shared hosting
  reactStrictMode: true,
  
  // Build optimizations (intentional for fast development)
  typescript: {
    ignoreBuildErrors: true,  // TODO: Clean up TS errors later
  },
  eslint: {
    ignoreDuringBuilds: true,  // TODO: Clean up ESLint errors later
  },
}
```

**Note:** TypeScript and ESLint errors are intentionally ignored during build for faster development. These should be cleaned up in future iterations.

### Standalone Build:
- **Purpose:** Self-contained build that includes only necessary files
- **Entry Point:** `.next/standalone/server.js`
- **Benefits:** 
  - Smaller deployment size
  - Faster server startup
  - Better compatibility with shared hosting

---

## 🔌 API Routes Architecture

### Dynamic Routes (Node Runtime):
All API routes run through Node.js runtime and are **dynamic** (not static):

- `/api/*` - All API routes require Node.js runtime
- **Why Dynamic:**
  - Cookies handling (auth, sessions)
  - Authentication (Supabase auth checks)
  - Database queries (Supabase client)
  - Real-time processing (chat, embeddings)

### Key API Endpoints:
- `/api/chat/bootstrap` - Initialize chat session
- `/api/chat/message` - Handle chat messages (SSE streaming)
- `/api/chat/events` - Track user events
- `/api/license/activate` - License activation
- `/api/admin/*` - Super admin endpoints
- `/api/widget` - Widget loader
- `/api/widget/loader.js` - Widget script

**Important:** These routes require Node.js runtime and cannot be static.

---

## 📁 Project Structure on Server

```
/home/thehappy/app.aiwoochat.com/app/
├── .next/
│   ├── standalone/          # Standalone build (deployed)
│   │   └── server.js        # Entry point
│   └── static/              # Static assets (deployed)
├── public/
│   └── favicon.ico          # Favicon (not in git)
├── src/                     # Source code (in git)
├── package.json             # Dependencies (in git)
├── .env.production          # Production env vars (NOT in git)
├── .gitignore
└── next.config.js
```

---

## 🚀 Deploy Commands

### ⚠️ Important: Build Limitations

**Server build fails with EAGAIN errors** due to shared hosting resource limits.  
**Use local build + upload workflow** instead (see [Local Build Deployment Guide](./LOCAL_BUILD_DEPLOYMENT.md)).

### Local Build + Upload Workflow (Recommended):

1. **Build locally:**
   ```bash
   npm run build
   # Creates .next/standalone/, .next/static/, and public/ folders
   ```

2. **Package for deployment:**
   - Create `deploy-standalone.zip` with `.next/standalone/` folder
   - Create `deploy-assets.zip` with `.next/static/` and `public/` folders

3. **Upload and deploy on server:**
   ```bash
   # Upload zip files to server, then run:
   cd ~/app.aiwoochat.com/app
   chmod +x unpack-and-deploy.sh
   ./unpack-and-deploy.sh
   ```

See [Local Build Deployment Guide](./LOCAL_BUILD_DEPLOYMENT.md) for complete instructions.

### Git Pull Only (No Build - For Code Updates Without Rebuild):

**Use this only when:**
- Updating configuration files (e.g., `.env.production`)
- Updating static files that don't require rebuild
- You've already deployed build files separately

**Script:** `deploy.sh` (git pull only - build is skipped on server due to EAGAIN errors)

**Usage:**
```bash
cd ~/app.aiwoochat.com/app
chmod +x deploy.sh
./deploy.sh
```

**Note:** This script attempts to build, but will fail with EAGAIN. Use local build + upload workflow instead.

---

## 🔐 Environment Variables

### Production Environment Variables (`.env.production`):

**Location:** `/home/thehappy/app.aiwoochat.com/app/.env.production`

**⚠️ Important:** `.env.production` is **NOT** in git (excluded via `.gitignore`)

### Required Variables:

```bash
# Supabase (Public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase (Private - Server-only)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI (Private - Server-only)
OPENAI_API_KEY=sk-...

# Resend (Private - Server-only)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@aiwoochat.com

# SaaS Platform URL (Public)
SAAS_URL=https://app.aiwoochat.com

# Node Environment
NODE_ENV=production
```

**Note:** Environment variables must be set on server directly. They are not version controlled.

---

## 🎨 Assets & Static Files

### Favicon:
- **Location:** `public/favicon.ico`
- **Status:** Not in git (see `.gitignore`)
- **Note:** `src/app/icon.tsx` was removed - now uses `public/favicon.ico` directly

### Static Assets:
- **Location:** `public/` folder
- **Deployed:** Yes (copied during build)
- **Access:** `https://app.aiwoochat.com/[asset-name]`

---

## 🐛 Troubleshooting

### Build Errors:

**TypeScript Errors:**
- Currently ignored via `typescript.ignoreBuildErrors: true`
- These should be fixed in future iterations
- Build will succeed even with TS errors

**ESLint Errors:**
- Currently ignored via `eslint.ignoreDuringBuilds: true`
- These should be fixed in future iterations
- Build will succeed even with ESLint errors

### Runtime Issues:

**App not reloading after deploy:**
- LiteSpeed should auto-reload, but if not:
  - Check LiteSpeed logs
  - Verify `server.js` is in correct location
  - Check Node.js process status

**API routes not working:**
- Verify Node.js runtime is enabled for API routes
- Check that `/api/*` routes are not cached as static
- Verify environment variables are set correctly

**Environment variables not loading:**
- Check `.env.production` exists in project root
- Verify file permissions (should be readable)
- Restart Node.js process if needed

**`npm: command not found` error:**
- **Cause:** `npm` is not available globally in PATH on cPanel shared hosting
- **Solution:** Always activate nodevenv before running npm commands:
  ```bash
  source /home/thehappy/nodevenv/app.aiwoochat.com/app/20/bin/activate
  ```
- **Recommended:** Use the `deploy.sh` script which activates nodevenv automatically

---

## 📋 Maintenance Checklist

### Regular Maintenance:

- [ ] Monitor server logs (`stderr.log`, `stdout.log`)
- [ ] Check disk space (build artifacts can accumulate)
- [ ] Verify SSL certificate is valid
- [ ] Monitor API response times
- [ ] Check Supabase connection status
- [ ] Verify environment variables are current

### Before Major Updates:

- [ ] Backup `.env.production` file
- [ ] Test build locally first
- [ ] Verify all dependencies are compatible
- [ ] Check for breaking changes in dependencies
- [ ] Test API endpoints after deploy

### After Deploy:

- [ ] Verify app loads (`https://app.aiwoochat.com`)
- [ ] Test dashboard login
- [ ] Check API endpoints respond correctly
- [ ] Verify widget loads (if applicable)
- [ ] Monitor error logs for first few minutes

---

## 📝 Important Notes

### Build Configuration:
- **TypeScript errors:** Intentionally ignored for fast development (TODO: fix)
- **ESLint errors:** Intentionally ignored for fast development (TODO: fix)
- **Standalone build:** Required for shared hosting compatibility

### Deployment:
- **No manual restart needed:** LiteSpeed auto-reloads
- **Git workflow:** Simple `pull + build` process
- **Build artifacts:** `.next/` is excluded from git (built on server)

### API Routes:
- **All API routes are dynamic** - require Node.js runtime
- **Cookies and auth:** Handled server-side (not static)
- **CORS:** Validated per-site via `allowed_origins`

### Assets:
- **Favicon:** Uses `public/favicon.ico` (not `src/app/icon.tsx`)
- **Static files:** Served from `public/` folder
- **Build output:** `.next/static/` contains optimized assets

---

## 🔗 Related Documentation

- **[Local Build & Deployment Guide](./LOCAL_BUILD_DEPLOYMENT.md)** ⭐ - **Use this for deployments!**
- [Production Environment Variables](../PRODUCTION_ENV_VARIABLES.md)
- [API Contract v1.0](./api-contract-v1.md)
- [Super Admin Dashboard](./super-admin-dashboard.md)
- [License to User Account Flow](./license-to-user-account-flow.md)

---

## 📞 Support & Contact

**Server Access:**
- SSH: `user@server`
- Project Path: `/home/thehappy/app.aiwoochat.com/app`

**Environment:**
- Node.js 20.x
- LiteSpeed + lsnode
- Next.js Standalone Build

---

**Last Updated:** 2024-01-20  
**Status:** ✅ LIVE  
**Next Review:** (When TS/ESLint cleanup is planned)

---

## 📦 Nodevenv Setup (cPanel Shared Hosting)

### Problem:
On cPanel shared hosting, `npm` and `node` are **NOT available globally** in PATH. They are only available after activating a virtual environment (nodevenv).

### Solution:
The `deploy.sh` script automatically activates nodevenv before running npm commands. For manual operations, you must activate nodevenv first:

```bash
source /home/thehappy/nodevenv/app.aiwoochat.com/app/20/bin/activate
```

### Nodevenv Path:
- **Location:** `/home/thehappy/nodevenv/app.aiwoochat.com/app/20/bin/activate`
- **Node.js Version:** 20.x
- **Created by:** cPanel Node.js App manager

### Verify nodevenv is active:
After activation, you should be able to run:
```bash
node --version  # Should output: v20.x.x
npm --version   # Should output: 10.x.x
```

**Note:** This is a cPanel/LiteSpeed hosting limitation, not an application issue.
