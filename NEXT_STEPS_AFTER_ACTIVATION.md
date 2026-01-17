# Sledeći Koraci Nakon Aktivacije Plugina

## ✅ Status
- **Site ID**: `c26e9dc8-8ab2-4d27-a752-ee81879ee1f9`
- **Site URL**: `https://bex.mrbrabus.com`
- **Status**: Active
- **SaaS Platform**: `https://api.aiwoochat.com` (ili vaš custom URL)

## 🎯 Korak 1: Testiranje Dashboard Settings

### 1.1 Prijavite se na Dashboard

1. Otvorite: `http://localhost:3001/login`
2. Prijavite se sa: `brabus.ivan@gmail.com`
3. Trebalo bi da vidite dashboard

### 1.2 Testiranje Settings Stranica

**Voice Settings:**
```
http://localhost:3001/dashboard/settings/voice?site_id=c26e9dc8-8ab2-4d27-a752-ee81879ee1f9
```

**Sales Settings:**
```
http://localhost:3001/dashboard/settings/sales?site_id=c26e9dc8-8ab2-4d27-a752-ee81879ee1f9
```

**Knowledge Settings:**
```
http://localhost:3001/dashboard/settings/knowledge?site_id=c26e9dc8-8ab2-4d27-a752-ee81879ee1f9
```

**Email Settings:**
```
http://localhost:3001/dashboard/settings/email?site_id=c26e9dc8-8ab2-4d27-a752-ee81879ee1f9
```

### 1.3 Testiranje

1. Otvorite bilo koju settings stranicu
2. Proverite da li se učitavaju default vrednosti
3. Promenite neke postavke
4. Kliknite "Save Settings"
5. Osvežite stranicu i proverite da li su izmene sačuvane

## 🎯 Korak 2: Provera Chat Widget-a na WordPress Sajtu

### 2.1 Proverite da li je Widget Učitan

1. Otvorite vaš WordPress sajt: `https://bex.mrbrabus.com`
2. Otvorite browser Developer Tools (F12)
3. Idite na Console tab
4. Trebalo bi da vidite da se widget loader učitava

### 2.2 Provera Widget Loader-a

U browser Console, proverite da li se učitava widget loader sa vašeg SaaS URL-a.

### 2.3 Testiranje Chat-a

1. Na WordPress sajtu, trebalo bi da vidite chat widget (obično u donjem desnom uglu)
2. Kliknite na chat widget
3. Pokušajte da pošaljete poruku
4. Proverite da li se poruka prikazuje

**Napomena**: Chat možda neće raditi potpuno jer zahteva:
- OpenAI API key konfigurisan
- Knowledge base sa embedded proizvodima
- CORS podešavanja

## 🎯 Korak 3: Provera u Supabase

### 3.1 Proverite Site Podatke

```sql
SELECT 
  id,
  site_url,
  site_name,
  status,
  environment,
  allowed_origins,
  created_at
FROM sites
WHERE id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9';
```

### 3.2 Proverite Settings

```sql
SELECT 
  key,
  value,
  version,
  is_active,
  created_at,
  updated_at
FROM settings
WHERE site_id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9'
ORDER BY key, version DESC;
```

### 3.3 Proverite License

```sql
SELECT 
  l.license_key,
  l.status,
  l.max_sites,
  s.site_url,
  s.site_name
FROM licenses l
JOIN sites s ON s.license_id = l.id
WHERE s.id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9';
```

## 🎯 Korak 4: Testiranje API Endpoints

### 4.1 Testiranje Chat Bootstrap

```bash
curl -X POST "https://your-saas-url.com/api/chat/bootstrap" \
  -H "Content-Type: application/json" \
  -H "Origin: https://bex.mrbrabus.com" \
  -d '{
    "site_id": "c26e9dc8-8ab2-4d27-a752-ee81879ee1f9"
  }'
```

**Očekivani response:**
```json
{
  "visitor_id": "...",
  "conversation_id": "...",
  "welcome_back": false,
  "session": {...}
}
```

### 4.2 Testiranje Settings GET

```bash
curl -X GET "http://localhost:3001/api/voice/settings?site_id=c26e9dc8-8ab2-4d27-a752-ee81879ee1f9" \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

## 🎯 Korak 5: Konfiguracija CORS-a

### 5.1 Dodajte WordPress URL u Allowed Origins

U Supabase, pokrenite:

```sql
UPDATE sites
SET allowed_origins = ARRAY['https://bex.mrbrabus.com']
WHERE id = 'c26e9dc8-8ab2-4d27-a752-ee81879ee1f9';
```

Ovo omogućava chat widget-u da komunicira sa SaaS platformom.

## 🎯 Korak 6: Testiranje Ingestion (Opciono)

Ako imate WooCommerce proizvode, možete testirati ingestion:

1. WordPress plugin bi trebalo automatski da šalje webhook-e kada se proizvod ažurira
2. Proverite u Supabase `ingestion_events` tabeli da li se eventi primaju
3. Proverite `embeddings` tabelu da li se kreiraju embedding-ovi

## 📋 Checklist

- [ ] Dashboard settings stranice se učitavaju
- [ ] Settings se mogu čuvati i učitavati
- [ ] Chat widget se učitava na WordPress sajtu
- [ ] CORS je konfigurisan (allowed_origins)
- [ ] Site podaci su ispravni u Supabase
- [ ] License je povezana sa site-om

## 🐛 Troubleshooting

### Problem: Chat widget se ne učitava
- Proverite da li je SaaS platform dostupna
- Proverite browser Console za greške
- Proverite da li je `allowed_origins` postavljen

### Problem: Settings se ne čuvaju
- Proverite da li ste prijavljeni na dashboard
- Proverite browser Console za greške
- Proverite server logs

### Problem: CORS greška
- Proverite da li je WordPress URL u `allowed_origins`
- Proverite da li SaaS platform radi
- Proverite da li je Origin header ispravan

## 🚀 Sledeći Koraci za Produkciju

1. **Deploy Next.js aplikacije** na server (VPS, Heroku, Vercel)
2. **Postavite domen** (npr. `api.aiwoochat.com`)
3. **Konfigurišite SSL** sertifikat
4. **Ažurirajte SaaS URL** u WordPress plugin-u
5. **Konfigurišite OpenAI API key** u environment varijablama
6. **Testirajte end-to-end** funkcionalnost
