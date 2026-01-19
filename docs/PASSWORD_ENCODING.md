# Password URL Encoding Guide

## Problem

Supabase connection strings require URL encoding for special characters in passwords.

## Your Password

Password: `Semalirani1!`

## URL Encoding

Special characters that need encoding:
- `!` → `%21`
- `@` → `%40`
- `#` → `%23`
- `+` → `%2B`
- `/` → `%2F`
- ` ` (space) → `%20`

## Encoded Password

`Semalirani1!` → `Semalirani1%21`

## Connection String

```bash
SUPABASE_DB_URL=postgresql://postgres.drmuwsxyvvfivdfsyydy:Semalirani1%21@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

## How to Encode in Node.js

```javascript
const password = 'Semalirani1!';
const encoded = encodeURIComponent(password);
console.log(encoded); // Semalirani1%21
```

## Verify in Terminal

```bash
# From server, test encoding:
node -e "console.log(encodeURIComponent('Semalirani1!'))"
# Output: Semalirani1%21
```

## Test Connection

After setting up `.env.production`, test the connection:

```bash
cd /home/thehappy/app.aiwoochat.com/app
node test-db-connection.js
```

This will test the database connection and show detailed error messages if something is wrong.
