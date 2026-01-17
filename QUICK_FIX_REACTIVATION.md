# Quick Fix: Site Reactivation

## Problem
WordPress plugin dobija 409 Conflict "Site is already active" jer site već postoji u bazi.

## Rešenje 1: Deploy Izmena (Preporučeno)

Endpoint je već izmenjen da vraća credentials umesto 409. Treba samo deploy:

```bash
# 1. Commit izmene
git add .
git commit -m "Fix: Allow re-activation of existing active sites"
git push origin main

# 2. Deploy na server
ssh user@server
cd ~/app.aiwoochat.com/app
git pull origin main
npm run build
# LiteSpeed automatski reloaduje
```

## Rešenje 2: Ručno Unos Credentials (Brzo)

Ako ne možeš odmah da deploy-uješ, možeš ručno uneti credentials u WordPress plugin:

### U Supabase bazi, dohvati credentials:

```sql
SELECT 
  s.id as site_id,
  s.site_secret,
  s.status
FROM sites s
JOIN licenses l ON l.id = s.license_id
WHERE l.license_key = 'TEST-25CD3013D429-E19AF68A701C'
  AND s.site_url = 'https://bex.mrbrabus.com';
```

### U WordPress plugin-u:

Ako plugin ima opciju da se ručno unese `site_id` i `site_secret`, unesi ih direktno.

Ili ažuriraj WordPress database direktno:

```sql
-- U WordPress database-u
UPDATE wp_options 
SET option_value = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'  -- site_id iz Supabase
WHERE option_name = 'ai_woo_chat_site_id';

UPDATE wp_options 
SET option_value = 'sec_...'  -- site_secret iz Supabase
WHERE option_name = 'ai_woo_chat_site_secret';

UPDATE wp_options 
SET option_value = 'active'
WHERE option_name = 'ai_woo_chat_status';
```

## Rešenje 3: Privremeni Endpoint (Ako treba)

Možemo kreirati privremeni endpoint koji vraća credentials za postojeći site bez aktivacije.
