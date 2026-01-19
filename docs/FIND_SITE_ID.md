# How to Find Site ID

## What is Site ID?

**Site ID** (`site_id`) is NOT the same as Supabase Project ID.

- **Site ID**: UUID from `sites` table (e.g., `550e8400-e29b-41d4-a716-446655440000`)
  - Used in API calls: `/api/chat/message`, `/api/chat/bootstrap`
  - Identifies a specific WordPress site registered in your SaaS platform
  - Stored in `sites` table in database

- **Project ID** (Supabase): `drmuwsxyvvfivdfsyydy` (project reference)
  - Used in Supabase connection URLs
  - Different from Site ID

## How to Find Your Site ID

### Option 1: Query Sites Table by Site URL

In Supabase SQL Editor:

```sql
-- Find site by URL (your WordPress site URL)
SELECT id, site_url, site_name, tenant_id 
FROM sites 
WHERE site_url = 'https://bex.mrbrabus.com';

-- Or find all sites
SELECT id, site_url, site_name, tenant_id 
FROM sites 
ORDER BY created_at DESC;
```

### Option 2: Check License Activation

If you know your license key, find site through license:

```sql
-- Find site by license key
SELECT s.id as site_id, s.site_url, s.site_name, s.tenant_id, l.license_key
FROM sites s
JOIN licenses l ON l.id = s.license_id
WHERE l.license_key = 'YOUR_LICENSE_KEY';
```

### Option 3: Check Chat Bootstrap Logs

If chat widget is working, check browser console:
- Chat widget logs: `AI Woo Chat: Chat session bootstrapped: {visitorId: '...', conversationId: '...', ...}`
- Network tab: POST request to `/api/chat/bootstrap` shows request body with `site_id`

### Option 4: Check Database Directly

```sql
-- List all sites with their tenant_ids
SELECT 
  id as site_id,
  site_url,
  site_name,
  tenant_id,
  license_id,
  created_at
FROM sites
ORDER BY created_at DESC
LIMIT 10;
```

## Example

If your WordPress site URL is `https://bex.mrbrabus.com`, run:

```sql
SELECT id, site_url, site_name, tenant_id 
FROM sites 
WHERE site_url LIKE '%bex.mrbrabus.com%';
```

This will return something like:
```
id: 550e8400-e29b-41d4-a716-446655440000
site_url: https://bex.mrbrabus.com
site_name: My WooCommerce Store
tenant_id: 123e4567-e89b-12d3-a456-426614174000
```

The `id` column is your **Site ID** - use this in SQL queries to check tenant_id.
