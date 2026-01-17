# License to User Account Flow - Documentation

**Purpose**: This document explains how licenses are linked to user accounts and how the activation flow works for customers.

**Version**: 1.0  
**Last Updated**: 2024-01-16  
**Status**: ✅ ACTIVE

---

## Overview

When a customer purchases the AI Woo Chat plugin, they receive:
1. **License Key** (`license_key`) - Unique identifier for the license
2. **Download Link** - Link to download the plugin
3. **Email** - Email address used for purchase (`customer_email`)

The platform uses `customer_email` stored in the `licenses` table to:
- Create user accounts automatically
- Send activation/welcome emails
- Link licenses to tenant user accounts
- Enable dashboard access

---

## Database Schema

### Licenses Table

```sql
licenses (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    license_key TEXT UNIQUE NOT NULL,
    customer_email TEXT,  -- ← NEW: Email of the customer who purchased
    status TEXT CHECK (status IN ('active', 'expired', 'revoked', 'suspended')),
    max_sites INTEGER DEFAULT 2,
    plan_limits JSONB,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
```

### Related Tables

```
licenses → tenant_id → tenants
tenants → id → user_tenants → user_id → auth.users (email)
```

**Flow**: `License` → `Tenant` → `User` (via `user_tenants`)

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. PURCHASE PROCESS (Tenant Landing Page / Payment System)      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │ Create License Entry:                     │
        │ - license_key (generated)                 │
        │ - customer_email (from purchase)          │
        │ - tenant_id (create new tenant)           │
        │ - status = 'active'                       │
        └───────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │ Send to Customer:                         │
        │ - License Key                             │
        │ - Download Link                           │
        │ - Welcome Email with Dashboard Link       │
        └───────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. CUSTOMER ACTIVATION FLOW                                     │
└─────────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌──────────────────────┐           ┌──────────────────────┐
│ Option A:            │           │ Option B:            │
│ Auto Account         │           │ Manual Signup        │
│ Creation             │           │                      │
└──────────────────────┘           └──────────────────────┘
        │                                       │
        │ 2.1 WordPress Plugin                  │ 2.2 User visits
        │     Activation                        │     /signup
        │                                       │
        ▼                                       ▼
┌──────────────────────┐           ┌──────────────────────┐
│ POST /api/license/   │           │ User enters:         │
│      activate        │           │ - license_key        │
│ {                    │           │ - email              │
│   license_key,       │           │ - password           │
│   site_url,          │           │                      │
│   site_name          │           │ Platform checks:     │
│ }                    │           │ - license_key exists │
│                      │           │ - email matches      │
│ Platform:            │           │   customer_email     │
│ - Finds license      │           │ - Creates user       │
│ - Creates site       │           │ - Links to tenant    │
│ - Checks customer_   │           │                      │
│   email              │           │                      │
│ - Auto-creates user  │           │                      │
│   if needed          │           │                      │
│ - Links user to      │           │                      │
│   tenant             │           │                      │
└──────────────────────┘           └──────────────────────┘
        │                                       │
        └───────────────────┬───────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │ User Account Created & Linked:            │
        │ - auth.users entry created                │
        │ - user_tenants entry created              │
        │   (user_id → tenant_id, role='owner')     │
        │ - User can now access dashboard           │
        └───────────────────────────────────────────┘
```

---

## Implementation Guide for Tenant Landing Page

### Step 1: Create License Entry

When processing a purchase on your landing page/payment system, create a license entry:

```sql
-- 1. Create Tenant (if new customer)
INSERT INTO tenants (id, name, slug, status)
VALUES (
    gen_random_uuid(),
    'Customer Company Name',  -- Or customer name
    'customer-slug-' || extract(epoch from now()),  -- Unique slug
    'active'
)
RETURNING id;

-- 2. Create License with customer_email
INSERT INTO licenses (
    id,
    tenant_id,
    license_key,
    customer_email,  -- ← Store customer email here
    status,
    max_sites,
    plan_limits,
    expires_at
)
VALUES (
    gen_random_uuid(),
    :tenant_id,  -- From step 1
    'ABC123-DEF456-GHI789',  -- Generate unique license key
    'customer@example.com',  -- ← Customer's purchase email
    'active',
    2,  -- Default max_sites
    '{"max_tokens_per_day": 1000000, ...}'::jsonb,
    NULL  -- Or set expiration date
)
RETURNING id, license_key;
```

**Important**: 
- Store `customer_email` exactly as provided by the customer during purchase
- This email will be used to create their platform account
- Ensure email validation before inserting

---

### Step 2: Send License to Customer

After creating the license, send to customer:

**Email Template**:
```
Subject: Welcome to AI Woo Chat - Your License Key

Hi [Customer Name],

Thank you for purchasing AI Woo Chat!

Your License Key: ABC123-DEF456-GHI789
Download Link: https://your-domain.com/download/ai-woo-chat.zip

To get started:
1. Download and install the plugin in WordPress
2. Activate using your license key
3. Access your dashboard: https://platform.your-domain.com/dashboard

Your dashboard will be automatically set up for email: [customer_email]
```

---

### Step 3: User Account Creation (Automatic on Plugin Activation)

When the WordPress plugin calls `/api/license/activate`, the platform will:

#### A. Find License by Key

```typescript
// Pseudo-code from /api/license/activate
const license = await findLicenseByKey(license_key);

// license contains:
// {
//   id: "...",
//   tenant_id: "...",
//   customer_email: "customer@example.com",  // ← Use this
//   status: "active",
//   ...
// }
```

#### B. Check if User Account Exists

```typescript
// Check if user with customer_email already exists
const { data: existingUser } = await supabase.auth.admin.getUserByEmail(
  license.customer_email
);
```

#### C. Create User Account (if not exists)

```typescript
if (!existingUser) {
  // Generate random password (will be reset via email)
  const tempPassword = crypto.randomBytes(32).toString('hex');
  
  // Create user account in Supabase Auth
  const { data: newUser, error } = await supabase.auth.admin.createUser({
    email: license.customer_email,
    email_confirm: true,  // Auto-confirm email
    password: tempPassword,
    user_metadata: {
      full_name: license.customer_email.split('@')[0],  // Optional
      license_id: license.id,
    }
  });

  // Link user to tenant with 'owner' role
  await supabaseAdmin.from('user_tenants').insert({
    user_id: newUser.user.id,
    tenant_id: license.tenant_id,
    role: 'owner',  // First user is always owner
  });

  // Send welcome email with password reset link
  await sendWelcomeEmail(license.customer_email, {
    license_key: license.license_key,
    dashboard_url: 'https://platform.your-domain.com/dashboard',
    reset_password_url: 'https://platform.your-domain.com/reset-password?token=...',
  });
}
```

#### D. Link Existing User (if already exists)

```typescript
if (existingUser) {
  // Check if user is already linked to this tenant
  const { data: existingLink } = await supabaseAdmin
    .from('user_tenants')
    .select('*')
    .eq('user_id', existingUser.user.id)
    .eq('tenant_id', license.tenant_id)
    .single();

  if (!existingLink) {
    // Link existing user to tenant
    await supabaseAdmin.from('user_tenants').insert({
      user_id: existingUser.user.id,
      tenant_id: license.tenant_id,
      role: 'owner',
    });
  }
}
```

---

## API Endpoints Reference

### POST /api/license/activate

**Request**:
```json
{
  "license_key": "ABC123-DEF456-GHI789",
  "site_url": "https://store.example.com",
  "site_name": "My WooCommerce Store"
}
```

**Response** (success):
```json
{
  "site_id": "550e8400-e29b-41d4-a716-446655440000",
  "site_secret": "sec_abc123...",
  "status": "active",
  "expires_at": null,
  "user_account": {
    "email": "customer@example.com",
    "created": true,  // true if new account, false if existing
    "dashboard_url": "https://platform.your-domain.com/dashboard"
  }
}
```

**Platform Actions**:
1. Find license by `license_key`
2. Verify `customer_email` exists in license
3. Check/create user account for `customer_email`
4. Link user to tenant (if not already linked)
5. Create site and return `site_id` + `site_secret`

---

### POST /api/auth/signup-with-license (Optional - Manual Signup)

**Request**:
```json
{
  "license_key": "ABC123-DEF456-GHI789",
  "email": "customer@example.com",
  "password": "secure-password"
}
```

**Platform Actions**:
1. Find license by `license_key`
2. Verify `email` matches `customer_email` in license
3. Create user account
4. Link user to tenant with 'owner' role
5. Return success

**Use Case**: Alternative flow if customer wants to manually create account before activating plugin.

---

## Database Queries Reference

### Query 1: Find License by Email

```sql
SELECT 
    l.id,
    l.license_key,
    l.customer_email,
    l.status,
    l.tenant_id,
    t.name as tenant_name,
    t.slug as tenant_slug
FROM licenses l
JOIN tenants t ON l.tenant_id = t.id
WHERE l.customer_email = 'customer@example.com'
AND l.status = 'active';
```

### Query 2: Find User Accounts for a License

```sql
SELECT 
    u.id as user_id,
    u.email,
    ut.role,
    ut.tenant_id,
    l.license_key
FROM licenses l
JOIN tenants t ON l.tenant_id = t.id
JOIN user_tenants ut ON ut.tenant_id = t.id
JOIN auth.users u ON u.id = ut.user_id
WHERE l.license_key = 'ABC123-DEF456-GHI789';
```

### Query 3: Check if User Exists for License Email

```sql
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    ut.role,
    ut.tenant_id
FROM auth.users u
LEFT JOIN user_tenants ut ON ut.user_id = u.id
WHERE u.email = 'customer@example.com';
```

---

## Security Considerations

1. **Email Validation**: Always validate `customer_email` format before inserting
2. **Email Uniqueness**: Ensure `customer_email` is stored correctly (case-insensitive)
3. **License Key Security**: Never expose `license_key` in client-side code
4. **Auto Account Creation**: Only create accounts for valid, active licenses
5. **Role Assignment**: First user linked to tenant should be 'owner'
6. **Email Confirmation**: Auto-confirm email for accounts created via license activation

---

## Error Scenarios

### Scenario 1: License Missing customer_email

**Situation**: Old license without `customer_email`  
**Handling**: 
- Show warning in `/api/license/activate` response
- Provide manual signup flow with `license_key` verification
- Optionally: Prompt admin to update license with email

### Scenario 2: Email Mismatch

**Situation**: User tries to signup with different email than `customer_email`  
**Handling**:
- Reject signup attempt
- Return error: "Email does not match license. Please use the email associated with your purchase."

### Scenario 3: Multiple Licenses Same Email

**Situation**: Customer has multiple licenses with same email  
**Handling**:
- Link user to all tenants (multiple `user_tenants` entries)
- User can switch between tenants in dashboard
- All licenses accessible from same account

---

## Testing Checklist

- [ ] Create license with `customer_email`
- [ ] Activate plugin with `license_key`
- [ ] Verify user account created automatically
- [ ] Verify user linked to tenant with 'owner' role
- [ ] Verify welcome email sent
- [ ] Test login with `customer_email`
- [ ] Test signup flow with `license_key`
- [ ] Test email mismatch scenario
- [ ] Test multiple licenses same email
- [ ] Test backward compatibility (license without `customer_email`)

---

## Migration Notes

### Backward Compatibility

Licenses created before this migration will have `customer_email = NULL`. Handle gracefully:

```typescript
if (!license.customer_email) {
  // Show manual signup option
  // Or prompt for email during activation
  // Or require email update before activation
}
```

### Data Migration (if needed)

If you have existing licenses without emails:

```sql
-- Update licenses with customer emails (if you have source data)
UPDATE licenses
SET customer_email = 'customer@example.com'
WHERE id = 'license-uuid'
AND customer_email IS NULL;
```

---

## Summary

**Key Points**:
1. `customer_email` is stored in `licenses` table when license is created
2. Platform uses `customer_email` to auto-create user accounts on plugin activation
3. User accounts are linked to tenants via `user_tenants` table
4. First user for a tenant gets 'owner' role
5. Dashboard access requires user account linked to tenant

**Flow**:
```
Purchase → Create License (with customer_email) 
         → Send License to Customer 
         → Plugin Activation → Auto-create User Account 
         → Link User to Tenant 
         → Dashboard Access ✅
```

---

**Document Status**: ✅ ACTIVE  
**Last Reviewed**: 2024-01-16
