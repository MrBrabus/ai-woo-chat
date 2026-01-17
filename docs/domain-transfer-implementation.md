# License Domain Transfer Implementation

This document describes the self-serve license domain transfer system that allows customers to detach/unpair licenses from one domain and reuse them on another domain.

## Overview

The system enables:
- **Detach/Unpair**: Free a license slot by disabling a site and invalidating its secret
- **Promote**: Move a staging site to production or change site URL
- **Abuse Prevention**: Cooldown periods and monthly limits
- **Security**: Automatic secret rotation and CORS origin management

## Database Schema Changes

### Sites Table Updates

New columns added to `sites` table:
- `status` (ENUM: 'active', 'disabled', 'revoked') - Default: 'active'
- `environment` (ENUM: 'production', 'staging') - Default: 'production'
- `allowed_origins` (TEXT[]) - Array of allowed CORS origins
- `secret_rotated_at` (TIMESTAMPTZ) - Timestamp of last secret rotation
- `disabled_at` (TIMESTAMPTZ) - Timestamp when site was disabled
- `last_paired_at` (TIMESTAMPTZ) - Timestamp of last activation/pairing

### Licenses Table Updates

New columns:
- `max_sites` (INTEGER) - Default: 2 (for prod + staging)

Updated `plan_limits` JSONB to include:
- `detach_cooldown_hours` (default: 24)
- `max_detach_per_month` (default: 3)

### Audit Logs Table

New table `audit_logs` tracks all domain transfer operations:
- `action` - 'site.detach', 'site.promote', etc.
- `old_values` / `new_values` - JSONB snapshots
- `metadata` - Additional context
- Full audit trail with user, IP, timestamp

## API Endpoints

### POST /api/sites/detach

Detaches/unpairs a site from a license.

**Request:**
```json
{
  "site_id": "site_xyz"
}
```

**Response:**
```json
{
  "ok": true,
  "site_id": "...",
  "status": "disabled"
}
```

**Behavior:**
1. Verifies user has access to site (tenant-scoped)
2. Checks cooldown and monthly limits
3. Sets `site.status = 'disabled'`
4. Rotates `site_secret` (invalidates old secret)
5. Clears `allowed_origins`
6. Logs audit event

**Error Codes:**
- `LICENSE_DETACH_COOLDOWN_ACTIVE` (429)
- `LICENSE_DETACH_MONTHLY_LIMIT_REACHED` (429)
- `SITE_NOT_FOUND` (404)
- `UNAUTHORIZED` (401)

### POST /api/sites/promote

Promotes staging to production or changes site URL.

**Request:**
```json
{
  "site_id": "site_xyz",
  "new_site_url": "https://example.com",
  "new_environment": "production"
}
```

**Response:**
```json
{
  "ok": true,
  "site_id": "...",
  "site_url": "https://example.com",
  "environment": "production",
  "site_secret": "sec_..." // New secret for WP plugin
}
```

**Behavior:**
1. Validates new URL format
2. Checks cooldown and monthly limits
3. Verifies license has available slots (if promoting to production)
4. Checks if new URL is already active (prevents duplicates)
5. Updates `site_url`, `environment`, `allowed_origins`
6. Rotates `site_secret`
7. Sets `status = 'active'` and `last_paired_at = now()`
8. Logs audit event

**Error Codes:**
- `LICENSE_DETACH_COOLDOWN_ACTIVE` (429)
- `LICENSE_DETACH_MONTHLY_LIMIT_REACHED` (429)
- `LICENSE_SITE_LIMIT_REACHED` (409)
- `INVALID_SITE_URL` (400)
- `SITE_NOT_FOUND` (404)

### GET /api/licenses/{license_id}/sites

Lists all sites for a license.

**Response:**
```json
{
  "sites": [
    {
      "id": "...",
      "url": "https://example.com",
      "environment": "production",
      "status": "active",
      "paired_at": "2024-01-15T10:00:00Z",
      "disabled_at": null
    }
  ],
  "count": 1
}
```

## Runtime Behavior Changes

All public runtime endpoints (`/api/chat/bootstrap`, `/api/chat/message`, `/api/chat/events`) now:

1. **Check site status**: Must be `'active'`
2. **Check license status**: Must be `'active'`
3. **Validate CORS origin**: Must be in `site.allowed_origins`

**New Error Responses:**
```json
{
  "error": {
    "code": "SITE_DISABLED",
    "message": "This site has been detached. Chat is unavailable."
  }
}
```

```json
{
  "error": {
    "code": "INVALID_ORIGIN",
    "message": "Origin not allowed. Contact support to add your domain."
  }
}
```

## Business Rules

### License Slots
- A license can have up to `max_sites` active sites (default: 2)
- Detaching a site frees a slot
- Promoting to production requires an available slot

### Detach/Unpair
- Sets `site.status = 'disabled'`
- Sets `disabled_at = now()`
- Rotates `site_secret` (old secret becomes invalid)
- Clears `allowed_origins`
- Immediately stops chat runtime and ingestion (kill-switch)

### Promote
- Only allowed if target domain is not already active OR user chooses "replace"
- Updates `site_url` to new production domain
- Sets `environment = 'production'`
- Updates `allowed_origins` to new origin
- Rotates `site_secret` and sets `secret_rotated_at = now()`

### Abuse Prevention
- **Cooldown**: `detach_cooldown_hours` between detach/promote actions (default: 24 hours)
- **Monthly Limit**: `max_detach_per_month` per license (default: 3)
- If exceeded: Returns 429/403 with clear error code

## Origin Normalization

Origins are normalized consistently:
- `https://example.com:443` → `https://example.com`
- `http://localhost:3000` → `http://localhost:3000`
- Scheme + host + optional port (no default ports)

## WordPress Plugin Behavior

- WP plugin remains license-key-only for input
- When a detached site tries to call `/license/activate` again:
  - Creates a NEW site record (if slot available)
  - OR reuses existing disabled site record (implementation choice)
- If site is disabled, plugin can show status message

## Dashboard UI

The dashboard includes a "Sites" section showing:
- Active sites (url, environment, status, last_seen_at)
- Buttons:
  - **Detach** (with confirmation)
  - **Promote to production** (input new domain)
- Clear error messages when cooldown/limits are hit

## Security Considerations

1. **Secret Rotation**: Old secrets are invalidated immediately on detach/promote
2. **CORS Enforcement**: Only origins in `allowed_origins` are allowed
3. **Tenant Isolation**: All operations are tenant-scoped via RLS
4. **Audit Trail**: All operations are logged with full context
5. **Kill Switch**: Disabled sites immediately stop working (no grace period)

## Migration Order

1. `20240116000001_update_sites_table.sql` - Add site management fields
2. `20240116000002_update_licenses_table.sql` - Add max_sites and plan_limits
3. `20240116000003_create_audit_logs.sql` - Create audit logging

## Testing Checklist

- [ ] Detach site successfully
- [ ] Verify old secret is invalidated
- [ ] Verify chat stops working for detached site
- [ ] Promote staging to production
- [ ] Verify new secret works
- [ ] Test cooldown enforcement
- [ ] Test monthly limit enforcement
- [ ] Verify CORS origin validation
- [ ] Test license slot limits
- [ ] Verify audit logs are created
- [ ] Test error responses are clear

## Error Codes Reference

- `LICENSE_SITE_LIMIT_REACHED` - License has max active sites
- `LICENSE_DETACH_COOLDOWN_ACTIVE` - Cooldown period active
- `LICENSE_DETACH_MONTHLY_LIMIT_REACHED` - Monthly limit exceeded
- `SITE_NOT_FOUND` - Site doesn't exist or access denied
- `SITE_DISABLED` - Site has been detached
- `INVALID_SITE_URL` - URL format invalid
- `INVALID_ORIGIN` - CORS origin not allowed
- `UNAUTHORIZED` - Authentication required
