# Fix za Warning: Constant AI_WOO_CHAT_SAAS_URL already defined

## Problem
Dobijate warning jer je konstanta `AI_WOO_CHAT_SAAS_URL` definisana dva puta.

## Rešenje

### Opcija 1: Ukloni konstantu iz wp-config.php (Preporučeno)

Ako ste dodali u `wp-config.php`:
```php
define( 'AI_WOO_CHAT_SAAS_URL', 'https://your-saas-url.com' );
```

**UKLONITE OVO** jer je URL već postavljen u bazi podataka i plugin će ga koristiti.

### Opcija 2: Ostavi konstantu u wp-config.php

Ako želite da koristite konstantu iz `wp-config.php`, onda uklonite definiciju iz plugin fajla (ali to nije preporučeno jer će se izgubiti pri update-u plugina).

## Status

✅ URL je ispravno postavljen u bazi
✅ Plugin je ažuriran da proverava da li konstanta već postoji

## Provera

Nakon uklanjanja konstante iz `wp-config.php`:

1. Osvežite WordPress admin panel
2. Warning bi trebalo da nestane
3. Idite na AI Woo Chat > Settings
4. Trebalo bi da vidite vaš SaaS Platform URL
5. Pokušajte aktivaciju sa license key: `TEST-25CD3013D429-E19AF68A701C`

## Debug (Opciono)

Ako želite da vidite šta plugin koristi, uključite debug u `wp-config.php`:

```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
```

Zatim proverite `wp-content/debug.log` - trebalo bi da vidite:
```
AI Woo Chat: get_saas_url() returning: [your-saas-url]
AI Woo Chat: Database option: [your-saas-url]
AI Woo Chat: Constant defined: NOT DEFINED (ili vrednost ako je definisana)
```
