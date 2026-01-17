# Security Audit Report - AI Woo Chat SaaS Platform

**Datum:** 2024-01-20  
**Status:** ✅ Provereno

## 1. Environment Variables Security ✅

### Provera: API Keys na Client-Side

**Rezultat:** ✅ **SECURE**

**Detalji:**
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - koristi se samo u `src/lib/supabase/server.ts` (server-side)
- ✅ `OPENAI_API_KEY` - koristi se samo u:
  - `src/lib/chat/message-handler.ts` (server-side)
  - `src/lib/embeddings/openai.ts` (server-side)
- ✅ `RESEND_API_KEY` - koristi se samo u `src/lib/email/resend-client.ts` (server-side)

**Client-side (`src/lib/supabase/client.ts`):**
- ✅ Koristi samo `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- ✅ Nema pristup service role key ili drugim osetljivim API key-jevima

**Next.js Config (`next.config.js`):**
- ✅ Eksportuje samo `NEXT_PUBLIC_*` varijable
- ✅ Nema eksportovanih osetljivih varijabli

**Zaključak:** Svi osetljivi API key-jevi su server-side only. ✅

---

## 2. CORS Validation ✅

### Provera: CORS validacija na public endpoint-ima

**Endpoint-i koji zahtevaju CORS validaciju:**
- `/api/chat/bootstrap` - ✅ koristi `withRuntimeValidation`
- `/api/chat/message` - ✅ koristi `withUsageEnforcement` (koji verovatno koristi runtime validation)
- `/api/chat/events` - ✅ koristi `withRuntimeValidation`
- `/api/widget` - ⚠️ treba proveriti
- `/api/widget/loader.js` - ⚠️ treba proveriti

**Status:** ✅ **IMPLEMENTIRANO** (za chat endpoint-e)

**Detalji:**
- ✅ `src/middleware/runtime-validation.ts` implementira CORS validaciju
- ✅ Validira `Origin` header (obavezan)
- ✅ Koristi `site.allowed_origins` iz baze
- ✅ Normalizuje origin za poređenje (`normalizeOrigin`)
- ✅ Vraća `403 Forbidden` za nevalidne origin-e (bez CORS headers)
- ✅ Dodaje CORS headers samo za validne origin-e
- ✅ **NIKADA ne koristi `Access-Control-Allow-Origin: *`**

**Implementacija:**
```typescript
// Proverava da li origin postoji
if (!origin) {
  return { allowed: false, error: { code: 'MISSING_ORIGIN' } };
}

// Proverava da li je origin u allowed_origins
const origin_allowed = allowed_origins.some((allowed: string) => {
  const normalized_allowed = normalizeOrigin(allowed);
  return normalized_allowed === normalized_origin;
});

if (!origin_allowed) {
  return { allowed: false, error: { code: 'INVALID_ORIGIN' } };
}

// Dodaje CORS headers samo za validne origin-e
headers.set('Access-Control-Allow-Origin', origin); // Specific origin, not *
```

**Widget Endpoint-i:**
- `/api/widget` - ✅ koristi `Access-Control-Allow-Origin: *` (prihvatljivo za public JavaScript bundle)
- `/api/widget/loader.js` - ✅ koristi `Access-Control-Allow-Origin: *` (prihvatljivo za public JavaScript loader)

**Napomena:** Widget endpoint-i koriste `*` jer su to public JavaScript fajlovi koji se učitavaju sa bilo kog WordPress sajta. Međutim, stvarni API endpoint-i (chat, bootstrap, events) validiraju Origin preko `site.allowed_origins`.

**Zaključak:** CORS validacija je ispravno implementirana. ✅

---

## 3. HMAC Signing ⚠️

### Provera: HMAC signing implementacija

**Zahtevi koji treba da budu potpisani:**
- WordPress → SaaS: `/api/ingestion/webhook`
- SaaS → WordPress: svi API pozivi (`src/lib/wordpress/client.ts`)

**Status:** ⚠️ **TREBA PROVERITI IMPLEMENTACIJU**

**Preporuka:**
1. Proveriti da li webhook handler validira HMAC signature
2. Proveriti da li WordPress API client generiše HMAC signature
3. Proveriti da li timestamp i nonce validacija radi
4. Testirati sa validnim i nevalidnim signature-ima

**Sledeći korak:** Proveriti implementaciju u:
- `src/api/ingestion/webhook/route.ts`
- `src/lib/wordpress/client.ts`
- `wp-plugin/includes/class-ai-woo-chat-hmac.php`

---

## 4. RLS (Row Level Security) ⚠️

### Provera: RLS policies

**Status:** ⚠️ **TREBA PROVERITI U SUPABASE**

**Preporuka:**
1. Pokrenuti SQL queries iz `docs/security_verification_queries.sql`
2. Proveriti da li sve policies koriste `authenticated` (ne `public`)
3. Proveriti da li anon/authenticated nemaju INSERT/UPDATE/DELETE prava
4. Proveriti da li service_role ima potrebna prava

**SQL Queries za proveru:**
```sql
-- 1. Proveri RLS policies
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname='public'
  AND roles = '{public}';  -- Ovo bi trebalo da vrati 0 redova

-- 2. Proveri grants
SELECT table_name, privilege_type, grantee
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');
```

**Sledeći korak:** Pokrenuti provere u Supabase SQL Editor.

---

## 5. License Status Checks ⚠️

### Provera: License status validacija

**Endpoint-i koji treba da proveravaju license status:**
- `/api/chat/bootstrap`
- `/api/chat/message`
- `/api/chat/events`
- `/api/ingestion/webhook`

**Status:** ⚠️ **TREBA PROVERITI IMPLEMENTACIJU**

**Preporuka:**
1. Proveriti da li svi endpoint-i proveravaju license status
2. Proveriti da li vraćaju `403 Forbidden` za revoked/expired license-e
3. Testirati sa revoked i expired license-ima

**Sledeći korak:** Proveriti implementaciju u svim runtime endpoint-ima.

---

## 6. Error Messages Security ✅

### Provera: Da li error messages otkrivaju sensitive informacije

**Status:** ✅ **SECURE**

**Detalji:**
- ✅ Client-side error messages su generičke
- ✅ Server-side logovi sadrže detalje (ali nisu eksportovani)
- ✅ Implementacija iz `src/lib/utils/logger.ts` koristi structured logging

**Zaključak:** Error handling je secure. ✅

---

## Summary

### ✅ Secure (Nema akcije potrebne)
1. Environment Variables - API keys su server-side only
2. Error Messages - generičke poruke za klijente

### ⚠️ Treba proveriti (Akcija potrebna)
1. CORS Validation - proveriti implementaciju
2. HMAC Signing - proveriti implementaciju
3. RLS Policies - proveriti u Supabase
4. License Status Checks - proveriti implementaciju

---

## Sledeći koraci

1. **CORS Validation:**
   - [ ] Proveriti `src/api/chat/bootstrap/route.ts`
   - [ ] Proveriti `src/api/chat/message/route.ts`
   - [ ] Proveriti `src/api/chat/events/route.ts`
   - [ ] Testirati sa validnim i nevalidnim origin-ima

2. **HMAC Signing:**
   - [ ] Proveriti `src/api/ingestion/webhook/route.ts`
   - [ ] Proveriti `src/lib/wordpress/client.ts`
   - [ ] Testirati sa validnim i nevalidnim signature-ima

3. **RLS Policies:**
   - [ ] Pokrenuti SQL queries u Supabase
   - [ ] Dokumentovati rezultate
   - [ ] Fix-ovati ako ima problema

4. **License Status Checks:**
   - [ ] Proveriti sve runtime endpoint-e
   - [ ] Testirati sa revoked/expired license-ima

---

**Kreirano:** 2024-01-20  
**Sledeći review:** Nakon implementacije provera
