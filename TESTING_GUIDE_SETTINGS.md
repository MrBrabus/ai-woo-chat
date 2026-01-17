# Testing Guide - Voice/Sales/Knowledge Settings

Ovaj guide objašnjava kako da testirate novu implementaciju settings API-ja za Voice, Sales i Knowledge.

## ✅ Šta je implementirano

### Backend API Rute
- ✅ `/api/voice/settings` (GET, PUT)
- ✅ `/api/sales/settings` (GET, PUT)
- ✅ `/api/knowledge/settings` (GET, PUT)

### Frontend Stranice
- ✅ `/dashboard/settings/voice`
- ✅ `/dashboard/settings/sales`
- ✅ `/dashboard/settings/knowledge`

## 🚀 Pre početka testiranja

### 1. Proverite da li server radi

```bash
# Server bi trebalo da radi na http://localhost:3000
# Proverite u terminalu da li se vidi:
# ✓ Ready in X.Xs
# ○ Local: http://localhost:3000
```

### 2. Pripremite test podatke

Trebate:
- **Valid site_id** - UUID iz `sites` tabele u Supabase
- **Authenticated user** - Korisnik koji ima pristup tom site-u

**Kako da dobijete site_id:**
1. Otvorite Supabase Dashboard
2. Idite na `sites` tabelu
3. Kopirajte `id` nekog site-a (UUID format)

## 📝 Metode testiranja

### Metoda 1: Testiranje kroz Frontend UI (Preporučeno)

Ovo je najlakši način jer automatski rešava autentifikaciju.

#### Korak 1: Prijavite se na dashboard

1. Otvorite `http://localhost:3000` u browseru
2. Prijavite se sa validnim kredencijalima
3. Navigirajte do settings sekcije

#### Korak 2: Testiranje Voice Settings

1. Idite na: `http://localhost:3000/dashboard/settings/voice?site_id=YOUR_SITE_ID`
2. **Proverite GET:**
   - Stranica bi trebalo da učita default vrednosti:
     - Tone: "friendly"
     - Style: "professional"
     - Language: "en"
     - Personality: ""
   - Ili postojeće vrednosti iz baze ako već postoje

3. **Proverite PUT:**
   - Promenite Tone na "professional"
   - Promenite Style na "conversational"
   - Unesite tekst u Personality field
   - Kliknite "Save Settings"
   - Trebalo bi da vidi poruku "Settings saved successfully"

4. **Verifikujte čuvanje:**
   - Osvežite stranicu (F5)
   - Proverite da li se nove vrednosti učitali

#### Korak 3: Testiranje Sales Settings

1. Idite na: `http://localhost:3000/dashboard/settings/sales?site_id=YOUR_SITE_ID`
2. **Proverite GET:**
   - Stranica bi trebalo da učita default vrednosti:
     - Enable Product Recommendations: true
     - Max Recommendations: 3
     - Upsell Enabled: false
     - Cross-sell Enabled: true
     - Urgency Messages: false
     - Discount Prompts: false

3. **Proverite PUT:**
   - Promenite neke checkbox-ove
   - Promenite Max Recommendations na 5
   - Kliknite "Save Settings"
   - Trebalo bi da vidi poruku "Settings saved successfully"

4. **Verifikujte čuvanje:**
   - Osvežite stranicu
   - Proverite da li se nove vrednosti učitali

#### Korak 4: Testiranje Knowledge Settings

1. Idite na: `http://localhost:3000/dashboard/settings/knowledge?site_id=YOUR_SITE_ID`
2. **Proverite GET:**
   - Stranica bi trebalo da učita default vrednosti:
     - Include Products: true
     - Include Pages: true
     - Include Policies: true
     - Include FAQ: false
     - Auto-index Enabled: true
     - Chunk Size: 1000
     - Top-K Results: 5

3. **Proverite PUT:**
   - Promenite neke checkbox-ove
   - Promenite Chunk Size na 1500
   - Promenite Top-K Results na 10
   - Kliknite "Save Settings"
   - Trebalo bi da vidi poruku "Settings saved successfully"

4. **Verifikujte čuvanje:**
   - Osvežite stranicu
   - Proverite da li se nove vrednosti učitali

### Metoda 2: Testiranje API-ja direktno (Advanced)

Ako želite da testirate API direktno, trebate pristupiti authenticated session cookie.

#### Korak 1: Dobijte session cookie

1. Otvorite browser Developer Tools (F12)
2. Prijavite se na dashboard
3. Idite na Network tab
4. Pronađite bilo koji request ka API-ju
5. Kopirajte `Cookie` header (sadrži Supabase auth token)

#### Korak 2: Testiranje GET endpointa

```bash
# Voice Settings
curl -X GET "http://localhost:3000/api/voice/settings?site_id=YOUR_SITE_ID" \
  -H "Cookie: YOUR_SESSION_COOKIE"

# Sales Settings
curl -X GET "http://localhost:3000/api/sales/settings?site_id=YOUR_SITE_ID" \
  -H "Cookie: YOUR_SESSION_COOKIE"

# Knowledge Settings
curl -X GET "http://localhost:3000/api/knowledge/settings?site_id=YOUR_SITE_ID" \
  -H "Cookie: YOUR_SESSION_COOKIE"
```

**Očekivani response (200 OK):**
```json
{
  "tone": "friendly",
  "style": "professional",
  "language": "en",
  "personality": ""
}
```

#### Korak 3: Testiranje PUT endpointa

```bash
# Voice Settings
curl -X PUT "http://localhost:3000/api/voice/settings" \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "site_id": "YOUR_SITE_ID",
    "tone": "professional",
    "style": "conversational",
    "language": "en",
    "personality": "Helpful and knowledgeable assistant"
  }'

# Sales Settings
curl -X PUT "http://localhost:3000/api/sales/settings" \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "site_id": "YOUR_SITE_ID",
    "enable_product_recommendations": true,
    "max_recommendations": 5,
    "upsell_enabled": true,
    "cross_sell_enabled": true,
    "urgency_messages": true,
    "discount_prompts": false
  }'

# Knowledge Settings
curl -X PUT "http://localhost:3000/api/knowledge/settings" \
  -H "Content-Type: application/json" \
  -H "Cookie: YOUR_SESSION_COOKIE" \
  -d '{
    "site_id": "YOUR_SITE_ID",
    "include_products": true,
    "include_pages": true,
    "include_policies": true,
    "include_faq": true,
    "auto_index_enabled": true,
    "chunk_size": 1500,
    "top_k_results": 10
  }'
```

**Očekivani response (200 OK):**
```json
{
  "success": true
}
```

### Metoda 3: Provera u Supabase bazi podataka

#### Korak 1: Otvorite Supabase Dashboard

1. Idite na vaš Supabase projekt
2. Otvorite SQL Editor

#### Korak 2: Proverite da li su settings sačuvani

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
WHERE site_id = 'YOUR_SITE_ID'
  AND key IN ('voice', 'sales', 'knowledge')
ORDER BY key, version DESC;
```

**Očekivani rezultat:**
- Trebalo bi da vidite redove sa `key = 'voice'`, `key = 'sales'`, `key = 'knowledge'`
- `is_active = true` za najnovije verzije
- `version` se povećava sa svakom izmenom

#### Korak 3: Proverite settings history

```sql
-- Proverite history za versioning
SELECT 
  sh.key,
  sh.value,
  sh.version,
  sh.created_at,
  sh.changed_by
FROM settings_history sh
JOIN settings s ON sh.settings_id = s.id
WHERE s.site_id = 'YOUR_SITE_ID'
  AND s.key IN ('voice', 'sales', 'knowledge')
ORDER BY sh.key, sh.version DESC
LIMIT 20;
```

## 🐛 Česti problemi i rešenja

### Problem 1: "Authentication required" greška

**Uzrok:** Niste prijavljeni ili session je istekao

**Rešenje:**
- Prijavite se ponovo na dashboard
- Proverite da li je cookie validan

### Problem 2: "Site not found" greška

**Uzrok:** Nevalidan site_id

**Rešenje:**
- Proverite da li site_id postoji u `sites` tabeli
- Proverite da li korisnik ima pristup tom site-u (tenant_id provera)

### Problem 3: Settings se ne čuvaju

**Uzrok:** Možda problem sa RLS policies ili grants

**Rešenje:**
- Proverite da li `settings` tabela dozvoljava INSERT/UPDATE za authenticated korisnike
- Proverite RLS policies u Supabase

### Problem 4: Default vrednosti se ne vraćaju

**Uzrok:** Možda problem sa API logikom

**Rešenje:**
- Proverite server logs za greške
- Proverite da li GET endpoint vraća default vrednosti kada nema podataka u bazi

## ✅ Checklist za testiranje

### Voice Settings
- [ ] Stranica se učitava bez grešaka
- [ ] Default vrednosti se prikazuju kada nema postavki
- [ ] Postojeće postavke se učitavaju iz baze
- [ ] Izmene se mogu sačuvati
- [ ] Sačuvane izmene se učestaljuju nakon osvežavanja
- [ ] Greške se prikazuju korisno (npr. "Site ID is required")

### Sales Settings
- [ ] Stranica se učitava bez grešaka
- [ ] Default vrednosti se prikazuju kada nema postavki
- [ ] Postojeće postavke se učitavaju iz baze
- [ ] Izmene se mogu sačuvati
- [ ] Sačuvane izmene se učestaljuju nakon osvežavanja
- [ ] Checkbox-ovi rade ispravno
- [ ] Number input validacija radi

### Knowledge Settings
- [ ] Stranica se učitava bez grešaka
- [ ] Default vrednosti se prikazuju kada nema postavki
- [ ] Postojeće postavke se učitavaju iz baze
- [ ] Izmene se mogu sačuvati
- [ ] Sačuvane izmene se učestaljuju nakon osvežavanja
- [ ] Checkbox-ovi rade ispravno
- [ ] Number input validacija radi (chunk_size, top_k_results)

### Baza podataka
- [ ] Settings se čuvaju u `settings` tabelu
- [ ] Versioning radi (version se povećava)
- [ ] Stare verzije se deaktiviraju (is_active = false)
- [ ] History se čuva u `settings_history` tabeli

## 📊 Logovi za praćenje

### Server logs (Terminal)

Proverite terminal gde je pokrenut `npm run dev` za:
- Request/response logove
- Greške sa stack trace-om
- Database query logove

### Browser Console (F12)

Proverite Console tab u Developer Tools za:
- JavaScript greške
- Network request status
- API response greške

## 🎯 Sledeći koraci

Nakon uspešnog testiranja:

1. **Code Review** - Proverite kod za potencijalne poboljšanja
2. **Performance Testing** - Testirajte sa više site-ova
3. **Error Handling** - Testirajte edge cases (nevalidni podaci, itd.)
4. **Production Deployment** - Nakon odobrenja, deploy na production

---

**Kreirano:** 2024-01-XX
**Status:** ✅ Implementacija završena, sprema za testiranje
