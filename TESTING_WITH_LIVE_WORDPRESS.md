# Testiranje sa Live WordPress Sajtom

## Problem
Live WordPress sajt ne može pristupiti `localhost:3001` jer je to lokalna adresa. Plugin pokušava da se poveže sa `https://api.aiwoochat.com` koji ne postoji.

## Rešenje 1: Postavi SaaS URL u WordPress

### Korak 1: Postavi SaaS URL u WordPress Admin Panelu
1. Idite u WordPress Admin > AI Woo Chat > Settings
2. Unesite SaaS Platform URL (npr. `https://api.aiwoochat.com`)
3. Sačuvaj postavke

**ILI** direktno u bazi podataka:
```sql
UPDATE tEvZ4_options 
SET option_value = 'https://your-saas-url.com' 
WHERE option_name = 'ai_woo_chat_saas_url';
```

### Korak 5: Testiraj aktivaciju
1. Idite u WordPress Admin > AI Woo Chat
2. Unesite license key: `TEST-25CD3013D429-E19AF68A701C`
3. Kliknite "Activate License"

## Rešenje 2: Dodati SaaS URL polje u Admin Panel

Ako želite da dodate polje za SaaS URL u admin panelu, treba da modifikujete plugin.

## Rešenje 2: Koristiti wp-config.php

Dodajte u `wp-config.php`:
```php
define( 'AI_WOO_CHAT_SAAS_URL', 'https://your-saas-url.com' );
```

## Važne napomene

**Produkcija**: Za produkciju, trebate:
   - Deploy-ovati Next.js aplikaciju na server (VPS, Heroku, Vercel, itd.)
   - Postaviti domen (npr. `api.aiwoochat.com`)
   - Konfigurisati SSL sertifikat

## Troubleshooting

### Problem: "cURL error 6: Could not resolve host"
- Proverite da li je SaaS platform dostupna
- Proverite da li je URL ispravno postavljen
- Proverite da li WordPress može pristupiti internetu

### Problem: "Connection timeout"
- Proverite da li je SaaS platform pokrenuta
- Proverite da li je URL ispravan

### Problem: "SSL certificate error"
- Proverite da li SaaS platform koristi validan SSL sertifikat
