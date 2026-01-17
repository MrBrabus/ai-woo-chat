-- ============================================================================
-- TEST DATA SETUP SCRIPT
-- ============================================================================
-- Ovaj script kreira test podatke potrebne za testiranje:
-- 1. Test korisnik (email/password)
-- 2. Test tenant
-- 3. Test license key
-- ============================================================================
-- ⚠️ IMPORTANT: Koristite ovo samo za development/test okruženje!
-- ============================================================================

-- ============================================================================
-- KORAK 1: Kreiranje test korisnika u Supabase Auth
-- ============================================================================
-- Ne možemo kreirati korisnika direktno u SQL-u jer Supabase Auth koristi
-- posebnu tabelu. Morate ga kreirati kroz Supabase Dashboard:
--
-- 1. Otvorite Supabase Dashboard
-- 2. Idite na Authentication > Users
-- 3. Kliknite "Add user" > "Create new user"
-- 4. Unesite:
--    - Email: test@example.com (ili bilo koji email)
--    - Password: TestPassword123! (ili bilo koji password)
-- 5. Kliknite "Create user"
--
-- ILI koristite SQL:
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, role)
-- VALUES (
--   gen_random_uuid(),
--   'test@example.com',
--   crypt('TestPassword123!', gen_salt('bf')),
--   NOW(),
--   NOW(),
--   NOW(),
--   '{"provider":"email","providers":["email"]}'::jsonb,
--   '{}'::jsonb,
--   false,
--   'authenticated'
-- );
-- ============================================================================

-- ============================================================================
-- KORAK 2: Kreiranje test tenant-a
-- ============================================================================
-- Prvo proverite da li već postoji tenant, ako ne, kreirajte ga:
-- 
-- SELECT id, name, email FROM tenants;
--
-- Ako nema rezultata, kreirajte tenant:
-- ============================================================================

INSERT INTO tenants (id, name, slug, status, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'Test Tenant',
  'test-tenant-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8),
  'active',
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING
RETURNING id as tenant_id, name, slug;

-- Zapamtite tenant_id iz rezultata!

-- ============================================================================
-- KORAK 3: Povezivanje korisnika sa tenant-om (user_tenants tabela)
-- ============================================================================
-- Morate pronaći user_id iz auth.users tabele:
-- SELECT id, email FROM auth.users WHERE email = 'test@example.com';
--
-- Zatim povežite korisnika sa tenant-om:
-- ============================================================================

-- ⚠️ Zamenite USER_ID i TENANT_ID sa stvarnim vrednostima!
-- INSERT INTO user_tenants (user_id, tenant_id, role, created_at, updated_at)
-- VALUES (
--   'USER_ID_FROM_AUTH_USERS',  -- Zamenite sa stvarnim user_id
--   'TENANT_ID_FROM_ABOVE',     -- Zamenite sa tenant_id iz gornjeg INSERT-a
--   'owner',
--   NOW(),
--   NOW()
-- )
-- ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- ============================================================================
-- KORAK 4: Kreiranje test license key-a
-- ============================================================================
-- Kreirajte license key za aktivaciju WordPress plugina:
-- ============================================================================

-- ⚠️ Zamenite TENANT_ID sa stvarnim tenant_id!
INSERT INTO licenses (
  id,
  tenant_id,
  license_key,
  status,
  max_sites,
  plan_limits,
  expires_at,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM tenants WHERE slug LIKE 'test-tenant-%' ORDER BY created_at DESC LIMIT 1), -- Automatski pronađi tenant_id
  'TEST-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 12)) || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 12)),
  'active',
  10, -- max_sites
  '{
    "max_tokens_per_day": 1000000,
    "max_chat_requests_per_day": 1000,
    "max_embedding_tokens_per_day": 100000,
    "detach_cooldown_hours": 24,
    "max_detach_per_month": 3
  }'::jsonb,
  NULL, -- expires_at (NULL = ne ističe)
  NOW(),
  NOW()
)
ON CONFLICT (license_key) DO NOTHING
RETURNING license_key, id as license_id, tenant_id, status, max_sites;

-- ⚠️ VAŽNO: Zapišite license_key iz rezultata - trebate ga za WordPress plugin!

-- ============================================================================
-- PROVERA: Proverite da li je sve korektno kreirano
-- ============================================================================

-- Proverite tenant:
SELECT id, name, slug, status FROM tenants WHERE slug LIKE 'test-tenant-%';

-- Proverite license:
SELECT id, tenant_id, license_key, status, max_sites, expires_at 
FROM licenses 
WHERE tenant_id = (SELECT id FROM tenants WHERE slug LIKE 'test-tenant-%' ORDER BY created_at DESC LIMIT 1);

-- Proverite user_tenants (ako postoji):
-- SELECT ut.*, u.email 
-- FROM user_tenants ut
-- JOIN auth.users u ON u.id = ut.user_id
-- WHERE u.email = 'test@example.com';

-- ============================================================================
-- BRZI TEST: Proverite da li možete da pristupite dashboard-u
-- ============================================================================
-- 1. Otvorite http://localhost:3000/login
-- 2. Prijavite se sa:
--    - Email: test@example.com (ili email koji ste kreirali)
--    - Password: TestPassword123! (ili password koji ste postavili)
-- 3. Trebalo bi da budete preusmereni na /dashboard
-- ============================================================================

-- ============================================================================
-- KORAK 5: Aktivacija WordPress plugina
-- ============================================================================
-- Nakon što dobijete license_key, možete aktivirati WordPress plugin:
--
-- 1. Otvorite WordPress admin panel
-- 2. Idite na AI Woo Chat plugin settings
-- 3. Unesite:
--    - License Key: (license_key iz gornjeg INSERT-a)
--    - SaaS Platform URL: http://localhost:3000 (ili vaš dev URL)
-- 4. Kliknite "Activate"
--
-- Plugin će pozvati: POST /api/license/activate
-- Sa body:
-- {
--   "license_key": "VAŠ_LICENSE_KEY",
--   "site_url": "http://localhost/wordpress",  -- Vaš WordPress URL
--   "site_name": "Test Site"
-- }
--
-- Response će vratiti:
-- {
--   "site_id": "...",
--   "site_secret": "...",
--   "status": "active"
-- }
-- ============================================================================

-- ============================================================================
-- KORAK 6: Testiranje Settings stranica
-- ============================================================================
-- Nakon aktivacije plugina, dobijate site_id.
-- Možete testirati settings stranice:
--
-- 1. Prijavite se na dashboard: http://localhost:3000/login
-- 2. Idite na settings:
--    - Voice: http://localhost:3000/dashboard/settings/voice?site_id=YOUR_SITE_ID
--    - Sales: http://localhost:3000/dashboard/settings/sales?site_id=YOUR_SITE_ID
--    - Knowledge: http://localhost:3000/dashboard/settings/knowledge?site_id=YOUR_SITE_ID
--
-- 3. Testirajte GET i PUT operacije (vidi QUICK_TEST.md)
-- ============================================================================

-- ============================================================================
-- TROUBLESHOOTING
-- ============================================================================
--
-- Problem: "User not found" u user_tenants
-- Rešenje: Proverite da li je korisnik kreiran u auth.users i da je povezan
--          sa tenant-om u user_tenants tabeli.
--
-- Problem: "License key not found"
-- Rešenje: Proverite da li je license_key ispravno kreiran u licenses tabeli.
--
-- Problem: "Site not found" na settings stranicama
-- Rešenje: Proverite da li je site aktiviran kroz WordPress plugin aktivaciju.
--          site_id mora postojati u sites tabeli.
--
-- Problem: "Authentication required"
-- Rešenje: Proverite da li ste prijavljeni na dashboard. Osvežite session.
-- ============================================================================
