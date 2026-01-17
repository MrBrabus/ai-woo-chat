# RLS Security Fix Summary

## Critical Security Issue Fixed

### Problem Identified
- All "Service role can manage..." policies had `roles = {public}` with `cmd = ALL`
- This could allow unrestricted writes if table grants permit it
- "Users can view..." policies also used `{public}` instead of `{authenticated}`

### Fixes Applied (Migration: 20240120000001_fix_rls_security.sql)

#### 1. Removed Dangerous Policies
- ✅ Removed ALL "Service role can manage..." policies
- **Reason**: `service_role` bypasses RLS server-side, so these policies are unnecessary and dangerous

#### 2. Updated User Policies
- ✅ Changed all "Users can view..." policies from `roles = {public}` to `roles = {authenticated}`
- **Affected tables**: tenants, licenses, sites, embeddings, settings, settings_history, usage_events, usage_daily, user_tenants, platform_users, audit_logs

#### 3. Revoked Dangerous Grants
- ✅ Revoked INSERT/UPDATE/DELETE from `anon` on all core tables
- ✅ Revoked INSERT/UPDATE/DELETE from `authenticated` on tenant/core tables
- **Reason**: Authenticated users should only SELECT via RLS policies, not write directly

#### 4. Service Role Permissions
- ✅ Explicitly granted ALL permissions to `service_role`
- **Reason**: Service role needs full access for runtime operations (it bypasses RLS anyway)

## Security Posture After Fix

### ✅ Secure
- `anon` role: NO write access to any core tables
- `authenticated` role: NO write access to tenant/core tables, only SELECT via RLS
- `service_role`: Full access (bypasses RLS, used server-side only)
- All user-facing policies use `authenticated` role (not `public`)

### Runtime Tables
- `visitors`, `conversations`, `messages`, `chat_events`: Managed by service_role only
- No user-level policies needed (service role bypasses RLS)

## Verification

Run queries in `docs/security_verification_queries.sql` to verify:
1. RLS policies have correct roles (`authenticated`, not `public`)
2. No dangerous grants to `anon`/`authenticated`
3. `service_role` has necessary permissions
4. RLS is enabled on all key tables

## Migration Status

✅ **Migration Applied**: `20240120000001_fix_rls_security.sql`
✅ **Status**: Successfully pushed to remote database
