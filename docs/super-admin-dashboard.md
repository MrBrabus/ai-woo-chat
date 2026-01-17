# Super Admin Dashboard - Documentation

**Purpose**: This document explains how the super admin dashboard works and how super admin users access platform-level data.

**Version**: 1.0  
**Last Updated**: 2024-01-16  
**Status**: ✅ ACTIVE

---

## Overview

Super admin users have platform-level access to all tenants, licenses, and system data. They can monitor the entire platform, troubleshoot issues, and manage all customers.

Super admin accounts are stored in the `platform_users` table with `role = 'super_admin'`.

---

## Access Control

### Super Admin Role Check

Super admin access is controlled by the `platform_users` table:

```sql
platform_users (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    role TEXT CHECK (role = 'super_admin'),
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

### Helper Function

```typescript
// src/lib/auth/check-super-admin.ts
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('platform_users')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'super_admin')
    .single();
  
  return !!data;
}
```

**Usage in Server Components**:
```typescript
const admin = await isSuperAdmin(user.id);
if (!admin) {
  redirect('/dashboard');
}
```

**Usage in Client Components**:
```typescript
// Check via API endpoint
const response = await fetch('/api/admin/license-check');
const { isSuperAdmin } = await response.json();
```

---

## Dashboard Structure

### Regular User Dashboard

Regular users see:
- `/dashboard` - Tenant-level statistics
- `/dashboard/conversations` - Their tenant's conversations
- `/dashboard/sites` - Their tenant's sites
- `/dashboard/analytics` - Their tenant's analytics
- `/dashboard/settings/*` - Their tenant's settings
- `/dashboard/account` - Account settings

### Super Admin Dashboard

Super admins see **ALL** regular sections PLUS:
- `/admin/licenses` - All licenses across all tenants
- `/admin/tenants` - All tenants on the platform
- `/admin/usage` - Usage analytics (tokens per license)
- `/admin/logs` - Error logs / System health

---

## Navigation

### Sidebar Navigation

The sidebar automatically detects super admin status and shows additional admin sections:

```typescript
// src/components/DashboardSidebar.tsx
const [isSuperAdmin, setIsSuperAdmin] = useState<boolean>(false);

// Check super admin status on mount
useEffect(() => {
  const checkAdmin = async () => {
    const { data: platformUser } = await supabase
      .from('platform_users')
      .select('role')
      .eq('user_id', currentUser.id)
      .eq('role', 'super_admin')
      .single();
    
    setIsSuperAdmin(!!platformUser);
  };
  // ...
}, []);
```

**Admin Navigation Items**:
- All Licenses (`/admin/licenses`)
- All Tenants (`/admin/tenants`)
- Usage Analytics (`/admin/usage`)
- System Logs (`/admin/logs`)

Admin items are displayed in a separate "Admin" section in the sidebar (red/orange styling to distinguish from regular items).

---

## Super Admin Pages

### 1. `/admin/licenses` - All Licenses

**Purpose**: View all licenses across all tenants

**Features**:
- List all licenses (license_key, customer_email, tenant, status, sites count, expires_at)
- Filter by status (active, expired, revoked, suspended)
- View license details
- Monitor license usage

**Data Source**:
```sql
SELECT 
    l.*,
    t.name as tenant_name,
    t.slug as tenant_slug,
    COUNT(s.id) as site_count
FROM licenses l
JOIN tenants t ON l.tenant_id = t.id
LEFT JOIN sites s ON s.license_id = l.id
GROUP BY l.id, t.id
ORDER BY l.created_at DESC;
```

**Access Control**:
```typescript
const admin = await isSuperAdmin(user.id);
if (!admin) {
  redirect('/dashboard');
}
```

---

### 2. `/admin/tenants` - All Tenants

**Purpose**: View all tenants on the platform

**Features**:
- List all tenants (name, slug, status, license count, site count, user count)
- Filter by status (active, suspended, deleted)
- View tenant details
- Monitor tenant activity

**Data Source**:
```sql
SELECT 
    t.*,
    COUNT(DISTINCT l.id) as license_count,
    COUNT(DISTINCT s.id) as site_count,
    COUNT(DISTINCT ut.user_id) as user_count
FROM tenants t
LEFT JOIN licenses l ON l.tenant_id = t.id
LEFT JOIN sites s ON s.tenant_id = t.id
LEFT JOIN user_tenants ut ON ut.tenant_id = t.id
GROUP BY t.id
ORDER BY t.created_at DESC;
```

---

### 3. `/admin/usage` - Usage Analytics

**Purpose**: Monitor token usage and API requests across all licenses

**Features**:
- Tokens used per license (daily/weekly/monthly)
- API requests per license
- Top licenses by usage
- Usage trends over time
- Alert on unusual usage patterns

**Data Source**:
```sql
SELECT 
    l.license_key,
    l.customer_email,
    t.name as tenant_name,
    SUM(ue.tokens_used) as total_tokens,
    COUNT(DISTINCT ue.id) as request_count,
    DATE(ue.created_at) as usage_date
FROM usage_events ue
JOIN sites s ON s.id = ue.site_id
JOIN licenses l ON l.id = s.license_id
JOIN tenants t ON t.id = l.tenant_id
WHERE ue.created_at >= NOW() - INTERVAL '30 days'
GROUP BY l.id, t.id, DATE(ue.created_at)
ORDER BY total_tokens DESC;
```

---

### 4. `/admin/logs` - System Logs

**Purpose**: View error logs and system health

**Features**:
- Error logs from chat runtime
- Error logs from ingestion service
- API response times
- System health metrics
- Recent errors/warnings
- Failed requests

**Data Source**:
```sql
-- Error logs (from audit_logs or separate error_logs table)
SELECT 
    created_at,
    action,
    resource_type,
    resource_id,
    metadata,
    user_id,
    ip_address
FROM audit_logs
WHERE action LIKE '%error%' OR action LIKE '%failed%'
ORDER BY created_at DESC
LIMIT 100;
```

---

## API Endpoints

### GET /api/admin/license-check

**Purpose**: Check if current user is super admin (client-side)

**Response**:
```json
{
  "isSuperAdmin": true
}
```

**Access**: Authenticated users only

---

## Security Considerations

### 1. Server-Side Verification

**Always verify super admin status on the server**:

```typescript
// ✅ GOOD - Server-side check
export default async function AdminPage() {
  const admin = await isSuperAdmin(user.id);
  if (!admin) {
    redirect('/dashboard');
  }
  // ...
}
```

```typescript
// ❌ BAD - Client-side only check
'use client';
if (!isSuperAdmin) {
  redirect('/dashboard');
}
// Client-side checks can be bypassed!
```

### 2. Database Access

Super admin pages use `createAdminClient()` (service_role) to bypass RLS and access all data.

**Note**: Regular users use `createClient()` which respects RLS policies.

### 3. API Route Protection

All admin API routes must verify super admin status:

```typescript
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = await isSuperAdmin(user.id);
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Admin-only logic
}
```

---

## Data Flow

### Super Admin Access Flow

```
1. User logs in
   ↓
2. Dashboard Layout checks isSuperAdmin(user.id)
   ↓
3. If super admin:
   - Sidebar shows admin sections
   - Admin routes accessible
   - Can access all tenants/licenses data
   ↓
4. If not super admin:
   - Only regular sections visible
   - Admin routes redirect to /dashboard
   - Only tenant-level data accessible (via RLS)
```

### Regular User Access Flow

```
1. User logs in
   ↓
2. Dashboard Layout checks isSuperAdmin(user.id) → false
   ↓
3. Sidebar shows only regular sections
   ↓
4. All data filtered by tenant_id (via RLS)
   ↓
5. Admin routes redirect to /dashboard (if accessed)
```

---

## UI/UX Differences

### Sidebar

**Regular User**:
- Dashboard
- Conversations
- Sites
- Analytics
- Settings section

**Super Admin**:
- Dashboard
- Conversations
- Sites
- Analytics
- **Admin section** (red/orange styling)
  - All Licenses
  - All Tenants
  - Usage Analytics
  - System Logs
- Settings section

### Page Access

**Regular User**:
- Can only access `/dashboard/*` routes
- `/admin/*` routes redirect to `/dashboard`

**Super Admin**:
- Can access both `/dashboard/*` and `/admin/*` routes
- See platform-wide data in admin sections
- Still see tenant-level data in regular sections (their own tenant or first tenant)

---

## Troubleshooting Guide

### Issue: Super admin not seeing admin sections

**Check**:
1. Verify `platform_users` entry exists:
   ```sql
   SELECT * FROM platform_users WHERE user_id = 'your-user-id';
   ```
2. Verify role is `'super_admin'`:
   ```sql
   SELECT * FROM platform_users WHERE user_id = 'your-user-id' AND role = 'super_admin';
   ```
3. Check browser cache (try incognito mode)
4. Check console for errors

### Issue: "Access Denied" on admin routes

**Check**:
1. Server-side `isSuperAdmin()` is being called
2. Function returns correct value
3. No redirect happening before check

### Issue: Can't see all licenses/tenants

**Check**:
1. Using `createAdminClient()` (not `createClient()`)
2. No RLS policies blocking access
3. Query includes all tenants/licenses (no WHERE tenant_id filter)

---

## Summary

**Key Points**:
1. Super admin role stored in `platform_users` table
2. Server-side verification required for all admin routes
3. Admin sections visible only to super admins
4. Super admins use `createAdminClient()` to bypass RLS
5. Regular users restricted to tenant-level data via RLS

**Routes**:
- `/admin/licenses` - All licenses
- `/admin/tenants` - All tenants
- `/admin/usage` - Usage analytics
- `/admin/logs` - System logs

**Security**:
- Always verify super admin on server
- Use service_role for admin queries
- RLS protects regular user data

---

---

## Implementation Summary

### Files Created/Modified

#### Helper Functions
- ✅ `src/lib/auth/check-super-admin.ts` - Server-side super admin check

#### Components
- ✅ `src/components/DashboardSidebar.tsx` - Updated with admin section (role-based rendering)

#### Admin Pages
- ✅ `src/app/(dashboard)/admin/licenses/page.tsx` - All licenses view
- ✅ `src/app/(dashboard)/admin/tenants/page.tsx` - All tenants view
- ✅ `src/app/(dashboard)/admin/usage/page.tsx` - Usage analytics (placeholder)
- ✅ `src/app/(dashboard)/admin/logs/page.tsx` - System logs view

#### API Endpoints
- ✅ `src/app/api/admin/license-check/route.ts` - Client-side super admin check

#### Documentation
- ✅ `docs/super-admin-dashboard.md` - This file

### Database

#### Tables Used
- `platform_users` - Super admin role storage
- `licenses` - All licenses (with `customer_email`)
- `tenants` - All tenants
- `sites` - All sites
- `user_tenants` - User-tenant relationships
- `audit_logs` - System logs
- `usage_events` - Usage tracking (for future usage analytics)

### Access Control Flow

```
1. User logs in → Supabase Auth
   ↓
2. Dashboard Layout checks isSuperAdmin(user.id)
   ↓
3. Sidebar checks super admin status (client-side)
   ↓
4. If super admin:
   - Show admin sections in sidebar
   - Allow access to /admin/* routes
   - Use createAdminClient() to bypass RLS
   - Display platform-wide data
   ↓
5. If regular user:
   - Show only regular sections
   - Redirect /admin/* routes to /dashboard
   - Use createClient() (respects RLS)
   - Display only tenant-level data
```

### Security Checklist

- ✅ Server-side role verification on all admin routes
- ✅ Service role client (createAdminClient) for admin queries
- ✅ RLS policies protect regular user data
- ✅ Admin sections hidden from regular users
- ✅ Admin routes redirect non-admins to /dashboard
- ✅ Super admin status checked on every page load

---

**Document Status**: ✅ ACTIVE  
**Last Reviewed**: 2024-01-16  
**Implementation Date**: 2024-01-16
