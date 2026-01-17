# Testing Setup Guide - Kompletno uputstvo za testiranje

Ovaj guide objašnjava kako da postavite okruženje za testiranje Settings API-ja.

## 📋 Preduvjeti

- ✅ Next.js aplikacija pokrenuta (`npm run dev`)
- ✅ Supabase projekat konfigurisan
- ✅ WordPress plugin instaliran

## 🚀 Koraci za setup

### Korak 1: Kreiranje test korisnika (Supabase Auth)

1. **Otvorite Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT
   ```

2. **Idite na Authentication > Users:**
   - Kliknite "Add user" ili "Create new user"
   - Unesite:
     - **Email:** `test@example.com` (ili bilo koji email)
     - **Password:** `TestPassword123!` (ili bilo koji jak password)
   - Kliknite "Create user"
   
3. **Zapišite:**
   - Email: `_____________________`
   - Password: `_____________________`

### Korak 2: Kreiranje test podataka (Supabase SQL Editor)

1. **Otvorite SQL Editor u Supabase Dashboard**

2. **Kopirajte i izvršite SQL iz `SETUP_TEST_DATA.sql`:**

   ```sql
   -- Kreiranje tenant-a
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
   ```

3. **Pronađite user_id i tenant_id:**

   ```sql
   -- Pronađite user_id
   SELECT id, email FROM auth.users WHERE email = 'test@example.com';
   
   -- Pronađite tenant_id
   SELECT id, name, slug FROM tenants WHERE slug LIKE 'test-tenant-%';
   ```

4. **Povežite korisnika sa tenant-om:**

   ```sql
   -- Zamenite USER_ID i TENANT_ID sa stvarnim vrednostima
   INSERT INTO user_tenants (user_id, tenant_id, role, created_at, updated_at)
   VALUES (
     'USER_ID_FROM_ABOVE',  -- Zamenite
     'TENANT_ID_FROM_ABOVE', -- Zamenite
     'owner',
     NOW(),
     NOW()
   )
   ON CONFLICT (user_id, tenant_id) DO NOTHING;
   ```

5. **Kreirajte test license key:**

   ```sql
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
     (SELECT id FROM tenants WHERE slug LIKE 'test-tenant-%' ORDER BY created_at DESC LIMIT 1),
     'TEST-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 12)) || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 12)),
     'active',
     10,
     '{
       "max_tokens_per_day": 1000000,
       "max_chat_requests_per_day": 1000,
       "max_embedding_tokens_per_day": 100000,
       "detach_cooldown_hours": 24,
       "max_detach_per_month": 3
     }'::jsonb,
     NULL,
     NOW(),
     NOW()
   )
   ON CONFLICT (license_key) DO NOTHING
   RETURNING license_key, id as license_id, tenant_id, status, max_sites;
   ```

6. **⚠️ VAŽNO: Zapišite license_key iz rezultata!**
   ```
   License Key: ________________________________
   ```

### Korak 3: Pristup Dashboard-u

1. **Otvorite browser i idite na:**
   ```
   http://localhost:3000/login
   ```

2. **Prijavite se:**
   - **Email:** (email iz Koraka 1)
   - **Password:** (password iz Koraka 1)
   - Kliknite "Sign in"

3. **Trebalo bi da budete preusmereni na:**
   ```
   http://localhost:3000/dashboard
   ```

4. **Proverite da li vidite Dashboard:**
   - ✅ Ako vidite "Welcome to AI Woo Chat dashboard" - uspešno!
   - ❌ Ako vidite "Authentication required" - proverite Korak 1 i 2

### Korak 4: Aktivacija WordPress plugina

1. **Otvorite WordPress admin panel**

2. **Idite na AI Woo Chat plugin settings**

3. **Unesite:**
   - **License Key:** (license_key iz Koraka 2, Korak 5)
   - **SaaS Platform URL:** `http://localhost:3000` (ili vaš dev URL)
   - **Site URL:** Vaš WordPress URL (npr. `http://localhost/wordpress`)

4. **Kliknite "Activate" ili "Save"**

5. **Proverite da li je aktivacija uspešna:**
   - Plugin će pozvati: `POST http://localhost:3000/api/license/activate`
   - Trebalo bi da dobijete: `site_id` i `site_secret`

6. **⚠️ VAŽNO: Zapišite site_id iz response-a!**
   ```
   Site ID: ________________________________
   ```

### Korak 5: Testiranje Settings stranica

Sada možete testirati sve tri settings stranice!

#### 5.1 Testiranje Voice Settings

1. **Idite na:**
   ```
   http://localhost:3000/dashboard/settings/voice?site_id=YOUR_SITE_ID
   ```

2. **Testirajte:**
   - ✅ Stranica se učitava
   - ✅ Vidi se form sa poljima (Tone, Style, Language, Personality)
   - ✅ Promenite Tone na "professional"
   - ✅ Unesite tekst u Personality
   - ✅ Kliknite "Save Settings"
   - ✅ Vidi se "Settings saved successfully"
   - ✅ Osvežite stranicu (F5)
   - ✅ Promene su sačuvane

#### 5.2 Testiranje Sales Settings

1. **Idite na:**
   ```
   http://localhost:3000/dashboard/settings/sales?site_id=YOUR_SITE_ID
   ```

2. **Testirajte:**
   - ✅ Stranica se učitava
   - ✅ Vidi se form sa checkbox-ovima i poljima
   - ✅ Promenite Max Recommendations na 5
   - ✅ Uključite "Upsell Enabled"
   - ✅ Kliknite "Save Settings"
   - ✅ Vidi se "Settings saved successfully"
   - ✅ Osvežite stranicu (F5)
   - ✅ Promene su sačuvane

#### 5.3 Testiranje Knowledge Settings

1. **Idite na:**
   ```
   http://localhost:3000/dashboard/settings/knowledge?site_id=YOUR_SITE_ID
   ```

2. **Testirajte:**
   - ✅ Stranica se učitava
   - ✅ Vidi se form sa checkbox-ovima i poljima
   - ✅ Promenite Chunk Size na 1500
   - ✅ Promenite Top-K Results na 10
   - ✅ Uključite "Include FAQ"
   - ✅ Kliknite "Save Settings"
   - ✅ Vidi se "Settings saved successfully"
   - ✅ Osvežite stranicu (F5)
   - ✅ Promene su sačuvane

### Korak 6: Provera u Bazi Podataka (Optional)

1. **Otvorite Supabase Dashboard > SQL Editor**

2. **Proverite da li su settings sačuvani:**

   ```sql
   -- Proverite sve settings za site
   SELECT 
     key,
     value,
     version,
     is_active,
     created_at,
     updated_at
   FROM settings
   WHERE site_id = 'YOUR_SITE_ID'  -- Zamenite sa site_id iz Koraka 4
     AND key IN ('voice', 'sales', 'knowledge')
   ORDER BY key, version DESC;
   ```

3. **Očekivani rezultat:**
   - Trebalo bi da vidite redove sa `key = 'voice'`, `key = 'sales'`, `key = 'knowledge'`
   - `is_active = true` za najnovije verzije
   - `value` JSONB kolona sadrži postavke

## ❌ Troubleshooting

### Problem: "Authentication required" na dashboard-u

**Uzrok:** Korisnik nije prijavljen ili session je istekao

**Rešenje:**
1. Proverite da li ste prijavljeni na `/login`
2. Proverite da li korisnik postoji u `auth.users` tabeli
3. Proverite da li je korisnik povezan sa tenant-om u `user_tenants` tabeli

### Problem: "License key not found" u WordPress pluginu

**Uzrok:** License key ne postoji u `licenses` tabeli

**Rešenje:**
1. Proverite da li je license_key kreiran u Supabase
2. Proverite da li je `status = 'active'`
3. Proverite da li je format ispravan (TEST-XXXXXXXX-XXXXXXXX)

### Problem: "Site not found" na settings stranicama

**Uzrok:** Site nije aktiviran kroz WordPress plugin

**Rešenje:**
1. Proverite da li je plugin aktiviran uspešno
2. Proverite da li `site_id` postoji u `sites` tabeli u Supabase
3. Proverite da li je `status = 'active'` u `sites` tabeli

### Problem: "Settings saved successfully" ali se ne čuvaju

**Uzrok:** Možda problem sa RLS policies ili grants

**Rešenje:**
1. Proverite server logs u terminalu za greške
2. Proverite RLS policies u Supabase
3. Proverite da li authenticated korisnici imaju INSERT/UPDATE prava na `settings` tabelu

### Problem: Dashboard se ne učitava

**Uzrok:** Server možda nije pokrenut ili ima grešku

**Rešenje:**
1. Proverite da li server radi: `http://localhost:3000`
2. Proverite terminal za greške
3. Proverite browser console (F12) za JavaScript greške

## ✅ Success Checklist

- [ ] Test korisnik kreiran u Supabase Auth
- [ ] Test tenant kreiran
- [ ] Korisnik povezan sa tenant-om (user_tenants)
- [ ] Test license key kreiran
- [ ] Možete se prijaviti na dashboard (`/login`)
- [ ] WordPress plugin aktiviran uspešno
- [ ] Site_id dobijen iz aktivacije
- [ ] Voice Settings stranica radi (GET/PUT)
- [ ] Sales Settings stranica radi (GET/PUT)
- [ ] Knowledge Settings stranica radi (GET/PUT)
- [ ] Settings se čuvaju u bazu podataka

## 🎯 Sledeći koraci

Nakon uspešnog setup-a i testiranja:

1. **Testirajte edge cases** (nevalidni podaci, itd.)
2. **Testirajte sa više site-ova**
3. **Code review** - Proverite kod za poboljšanja
4. **Production deployment** - Nakon odobrenja

---

**Kreirano:** 2024-01-XX  
**Status:** ✅ Spreman za testiranje  
**Trajanje setup-a:** ~15-20 minuta
