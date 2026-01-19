# Supabase Database Connection Guide

## Problem: IPv6 Connection Issues & ECONNREFUSED

When using direct Supabase database connection (`db.PROJECT_REF.supabase.co:5432`), the server may try to connect via IPv6, which many shared hosting providers don't support, resulting in `ENETUNREACH` errors.

Also, pooler connections may fail with `ECONNREFUSED` if:
- Wrong connection string format
- Password not URL-encoded (special characters like `!`, `@`, `+` need encoding)
- Pooler not enabled in dashboard
- Network/firewall blocking port 5432

## Solution: Use Pooler URL from Dashboard

**IMPORTANT**: Copy the pooler URL directly from Supabase dashboard. Don't construct it manually.

## How to Get Pooler URL from Dashboard:

1. Go to **Supabase Dashboard** → Your Project
2. Click **Settings** → **Database**
3. Scroll to **Connection string** section
4. Select **Connection pooling** tab
5. Choose **Session mode** (port 5432) - required for pgvector
6. **Copy the entire connection string** (it will look like: `postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`)

## Update .env.production:

**Option 1: Direct copy from dashboard (RECOMMENDED)**

```bash
cd /home/thehappy/app.aiwoochat.com/app

# Paste the pooler URL directly from Supabase dashboard
SUPABASE_DB_URL=postgresql://postgres.drmuwsxyvvfivdfsyydy:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

**Option 2: Manual format (if password has special characters, URL-encode them)**

If your password is `Semalirani1!`, URL-encode special characters:
- `!` → `%21`
- `@` → `%40`
- `+` → `%2B`
- `#` → `%23`
- etc.

Example:
```bash
# If password is "Semalirani1!" (has ! character)
SUPABASE_DB_URL=postgresql://postgres.drmuwsxyvvfivdfsyydy:Semalirani1%21@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

**Note**: The `pg` library should handle URL encoding automatically, but explicit encoding is safer.

## Verify Connection String:

```bash
# Check if SUPABASE_DB_URL is set (masked)
cat .env.production | grep SUPABASE_DB_URL

# Should see something like:
# SUPABASE_DB_URL=postgresql://postgres.drmuwsxyvvfivdfsyydy:****@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

## Restart Node.js App:

After updating `.env.production`, restart the Node.js application:
- cPanel → **Node.js App** → **Restart**

## Troubleshooting:

### If you get ECONNREFUSED:

1. **Verify pooler is enabled**: Supabase Dashboard → Settings → Database → Connection pooling
2. **Check password encoding**: Ensure special characters are URL-encoded
3. **Verify host/port**: Should be `aws-0-eu-west-1.pooler.supabase.com:5432`
4. **Check network**: Server must allow outbound TCP to port 5432

### If you get authentication errors:

1. **Check username format**: Should be `postgres.drmuwsxyvvfivdfsyydy` (with dot)
2. **Verify password**: Copy directly from Supabase dashboard
3. **URL-encode password**: If manually setting, encode special characters

### Test connection from server:

```bash
# Test DNS resolution
nslookup aws-0-eu-west-1.pooler.supabase.com

# Test port connectivity (should connect)
nc -vz aws-0-eu-west-1.pooler.supabase.com 5432
```
