# Domain Transfer Implementation Summary

## ✅ Completed Implementation

### 1. Database Migrations (3 files)

**`20240116000001_update_sites_table.sql`**
- Adds `status` (active/disabled/revoked)
- Adds `environment` (production/staging)
- Adds `allowed_origins` (TEXT[] for CORS)
- Adds `secret_rotated_at`, `disabled_at`, `last_paired_at`
- Creates indexes for efficient querying
- Updates existing sites with default values

**`20240116000002_update_licenses_table.sql`**
- Adds `max_sites` (default: 2)
- Updates `plan_limits` to include `detach_cooldown_hours` and `max_detach_per_month`
- Updates validation trigger

**`20240116000003_create_audit_logs.sql`**
- Creates `audit_logs` table for tracking all operations
- Helper function `log_audit_event()` for easy logging
- RLS policies for tenant isolation

### 2. Helper Functions (`src/lib/site-management.ts`)

- `normalizeOrigin()` - Normalizes URLs to origins (scheme + host + port)
- `generateSiteSecret()` - Generates secure site secrets
- `rotateSiteSecret()` - Rotates secret and updates allowed_origins
- `checkLicenseSlots()` - Checks if license has available slots
- `checkDetachLimits()` - Validates cooldown and monthly limits
- `logAuditEvent()` - Logs audit events
- `verifySiteAccess()` - Verifies user has access to site (tenant-scoped)

### 3. API Endpoints

**POST /api/sites/detach**
- Verifies user access (tenant-scoped)
- Checks cooldown and monthly limits
- Disables site and rotates secret
- Logs audit event

**POST /api/sites/promote**
- Validates new URL format
- Checks cooldown and monthly limits
- Verifies license slots
- Updates site URL, environment, allowed_origins
- Rotates secret
- Logs audit event

**GET /api/licenses/{license_id}/sites**
- Lists all sites for a license
- Tenant-scoped access control

**POST /api/license/activate** (Updated)
- Handles disabled sites (can reactivate)
- Checks license slots
- Creates new site or reuses disabled site

### 4. Runtime Validation Middleware

**`src/middleware/runtime-validation.ts`**
- `validateRuntimeRequest()` - Validates site status, license status, CORS
- `withRuntimeValidation()` - Middleware wrapper for public endpoints

**Updated Endpoints:**
- `/api/chat/bootstrap` - Uses runtime validation
- `/api/chat/message` - Uses runtime validation (via usage enforcement)
- `/api/chat/events` - Uses runtime validation

**New Error Responses:**
- `SITE_DISABLED` - Site has been detached
- `SITE_REVOKED` - Site has been revoked
- `INVALID_ORIGIN` - CORS origin not allowed

### 5. Dashboard UI

**`src/app/dashboard/sites/page.tsx`**
- Lists all sites for a license
- Shows site status, environment, paired date
- Detach button (with confirmation)
- Promote button (with URL input)
- Error handling and loading states

## Key Features

✅ **Detach/Unpair** - Free license slots by disabling sites  
✅ **Promote** - Move staging to production or change URLs  
✅ **Abuse Prevention** - Cooldown (24h default) and monthly limits (3 default)  
✅ **Security** - Automatic secret rotation on detach/promote  
✅ **CORS Enforcement** - Only allowed origins can access chat  
✅ **Kill Switch** - Disabled sites immediately stop working  
✅ **Audit Trail** - All operations logged with full context  
✅ **Tenant Isolation** - All operations are tenant-scoped  

## Business Rules Implemented

1. **License Slots**: Max `max_sites` active sites per license (default: 2)
2. **Detach**: Sets status='disabled', rotates secret, clears allowed_origins
3. **Promote**: Updates URL/environment, rotates secret, validates slots
4. **Cooldown**: 24 hours between detach/promote actions
5. **Monthly Limit**: 3 detach/promote actions per month
6. **Origin Normalization**: Consistent origin format (scheme + host + port)

## Error Codes

- `LICENSE_SITE_LIMIT_REACHED` - License has max active sites
- `LICENSE_DETACH_COOLDOWN_ACTIVE` - Cooldown period active (429)
- `LICENSE_DETACH_MONTHLY_LIMIT_REACHED` - Monthly limit exceeded (429)
- `SITE_NOT_FOUND` - Site doesn't exist or access denied
- `SITE_DISABLED` - Site has been detached
- `SITE_REVOKED` - Site has been revoked
- `INVALID_SITE_URL` - URL format invalid
- `INVALID_ORIGIN` - CORS origin not allowed
- `UNAUTHORIZED` - Authentication required

## Files Created/Updated

```
supabase/migrations/
  ├── 20240116000001_update_sites_table.sql
  ├── 20240116000002_update_licenses_table.sql
  └── 20240116000003_create_audit_logs.sql

src/
  ├── api/
  │   ├── sites/
  │   │   ├── detach/route.ts
  │   │   └── promote/route.ts
  │   ├── licenses/
  │   │   └── [license_id]/sites/route.ts
  │   ├── license/
  │   │   └── activate/route.ts (updated)
  │   └── chat/
  │       ├── bootstrap/route.ts (new)
  │       └── events/route.ts (new)
  ├── lib/
  │   └── site-management.ts
  ├── middleware/
  │   ├── runtime-validation.ts (new)
  │   └── usage-enforcement.ts (updated)
  └── app/
      └── dashboard/
          └── sites/
              └── page.tsx

docs/
  └── domain-transfer-implementation.md
```

## Testing Checklist

- [ ] Run migrations successfully
- [ ] Test detach site (verify secret rotation)
- [ ] Test promote site (verify URL update)
- [ ] Test cooldown enforcement
- [ ] Test monthly limit enforcement
- [ ] Test license slot limits
- [ ] Test CORS origin validation
- [ ] Test disabled site cannot access chat
- [ ] Test license activation with disabled site (reactivation)
- [ ] Verify audit logs are created
- [ ] Test dashboard UI (detach, promote)
- [ ] Verify tenant isolation

## Next Steps

1. Run migrations in order
2. Test all endpoints
3. Integrate dashboard UI with your auth system
4. Update WordPress plugin to handle new site_secret on promote
5. Add email notifications for detach/promote actions (optional)

## Notes

- All endpoints require dashboard authentication (Bearer token)
- Runtime endpoints validate site status and CORS on every request
- Secret rotation invalidates old secrets immediately
- Disabled sites are kill-switched (no grace period)
- Audit logs provide full audit trail for compliance
