# Update Connection String - New Password (No Special Characters)

## Password Changed

Password changed from `Semalirani1!` to `Semalirani1` (no `!` character).

This means **NO URL encoding needed** - password can be used directly in connection string.

## Update `.env.production` on Server

```bash
cd /home/thehappy/app.aiwoochat.com/app

# Update SUPABASE_DB_URL with new password (no encoding needed)
SUPABASE_DB_URL=postgres://postgres.drmuwsxyvvfivdfsyydy:Semalirani1@aws-0-eu-west-1.pooler.supabase.com:5432/postgres

# Or if using postgresql:// protocol:
SUPABASE_DB_URL=postgresql://postgres.drmuwsxyvvfivdfsyydy:Semalirani1@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

**Note:** No `%21` encoding needed since password has no special characters.

## Verify

```bash
cat .env.production | grep SUPABASE_DB_URL
```

Should see:
```
SUPABASE_DB_URL=postgres://postgres.drmuwsxyvvfivdfsyydy:Semalirani1@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

## Restart Node.js App

After updating `.env.production`, restart the Node.js application in cPanel.
