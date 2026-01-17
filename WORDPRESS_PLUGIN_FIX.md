# WordPress Plugin Fix - SaaS URL Problem

## Problem
Plugin i dalje koristi default URL umesto URL-a koji ste uneli.

## Rešenje 1: Proverite da li je URL sačuvan

U WordPress bazi podataka, proverite:

```sql
SELECT option_name, option_value 
FROM tEvZ4_options 
WHERE option_name = 'ai_woo_chat_saas_url';
```

Ako je prazno ili ima stari URL, postavite ga direktno:

```sql
UPDATE tEvZ4_options 
SET option_value = 'https://your-saas-url.com' 
WHERE option_name = 'ai_woo_chat_saas_url';
```

## Rešenje 2: Osvežite Plugin

1. Deaktivirajte plugin
2. Aktivirajte ponovo
3. Unesite SaaS URL i License Key ponovo

## Rešenje 3: Proverite WordPress Debug Log

U `wp-config.php` dodajte:

```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
```

Zatim proverite `wp-content/debug.log` - trebalo bi da vidite:
```
AI Woo Chat: get_saas_url() returning: [your-saas-url]
AI Woo Chat: Activating with SaaS URL: [your-saas-url]
```

## Rešenje 4: Direktno u wp-config.php

Dodajte u `wp-config.php` (pre `/* That's all, stop editing! */`):

```php
define( 'AI_WOO_CHAT_SAAS_URL', 'https://your-saas-url.com' );
```

Ovo će override-ovati sve ostale postavke.

## Provera

Nakon bilo kog rešenja, proverite u WordPress admin panelu:
- AI Woo Chat > Settings
- Trebalo bi da vidite vaš SaaS Platform URL

## Ako i dalje ne radi

1. Proverite da li je SaaS platform dostupna
2. Proverite da li je URL ispravno postavljen
3. Proverite WordPress debug log za detalje
