# Fix Pooler Connection - "Tenant or user not found"

## Problem

Getting "Tenant or user not found" error when connecting to Supabase pooler.

## Solution

Use the **exact format** recommended by Supabase AI:

### Format:

```
postgres://postgres.PROJECT_REF:ENCODED_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

**Note:** Use `postgres://` protocol, NOT `postgresql://` for pooler connections.

### Steps:

1. **Encode your password:**
   - Password: `Semalirani1!`
   - Encoded: `Semalirani1%21`

2. **Update `.env.production`:**

```bash
SUPABASE_DB_URL=postgres://postgres.drmuwsxyvvfivdfsyydy:Semalirani1%21@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

**Key differences:**
- Protocol: `postgres://` (not `postgresql://`)
- Username: `postgres.drmuwsxyvvfivdfsyydy` (with dot)
- Password: URL-encoded `Semalirani1%21`
- Host: `aws-0-eu-west-1.pooler.supabase.com`
- Port: `5432` (Session mode)

3. **Restart Node.js app**

## Alternative: Copy from Supabase Dashboard

1. Supabase Dashboard → Settings → Database
2. Connection pooling → Session mode
3. Copy the **exact** connection string
4. Replace `[YOUR-PASSWORD]` with URL-encoded password (`Semalirani1%21`)
5. Use that string as `SUPABASE_DB_URL`

## Test

After restart, check logs:

```bash
tail -n 50 stderr.log | grep -i "postgres\|connection\|username"
```

Should see:
```
[Postgres] Username format: postgres.drmuwsxyvvfivdfsyydy
[Postgres] Host: aws-0-eu-west-1.pooler.supabase.com
[Postgres] Port: 5432
```
