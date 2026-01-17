# Brzi SQL Fix za SaaS URL

## Vaš WordPress Table Prefix: `tEvZ4_`

### Provera trenutnog URL-a

```sql
SELECT option_name, option_value 
FROM tEvZ4_options 
WHERE option_name = 'ai_woo_chat_saas_url';
```

### Postavljanje SaaS URL-a

```sql
UPDATE tEvZ4_options 
SET option_value = 'https://api.aiwoochat.com' 
WHERE option_name = 'ai_woo_chat_saas_url';
```

### Ako opcija ne postoji, kreirajte je

```sql
INSERT INTO tEvZ4_options (option_name, option_value, autoload) 
VALUES ('ai_woo_chat_saas_url', 'https://api.aiwoochat.com', 'yes')
ON DUPLICATE KEY UPDATE option_value = 'https://api.aiwoochat.com';
```

### Provera svih AI Woo Chat opcija

```sql
SELECT option_name, option_value 
FROM tEvZ4_options 
WHERE option_name LIKE 'ai_woo_chat_%';
```

## Nakon izvršavanja

1. Osvežite WordPress admin panel
2. Idite na AI Woo Chat > Settings
3. Trebalo bi da vidite novi URL
4. Pokušajte ponovo aktivaciju sa license key: `TEST-25CD3013D429-E19AF68A701C`
