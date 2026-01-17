# Quick Test Guide - Settings API

Brzi vodič za testiranje novih Settings API-ja.

## ✅ Server Status

1. **Proverite da li server radi:**
   ```bash
   # U terminalu gde je pokrenut npm run dev, trebalo bi da vidite:
   ✓ Ready in X.Xs
   ○ Local: http://localhost:3000
   ```

2. **Ili otvorite browser i idite na:**
   ```
   http://localhost:3000
   ```

## 🚀 Brzo Testiranje (5 minuta)

### Korak 1: Prijavite se na Dashboard

1. Otvorite `http://localhost:3000` u browseru
2. Prijavite se sa validnim kredencijalima

### Korak 2: Dobijte Site ID

1. Otvorite Supabase Dashboard
2. Idite na `sites` tabelu
3. Kopirajte `id` prvog site-a (UUID format)

### Korak 3: Testirajte Voice Settings

**URL:** `http://localhost:3000/dashboard/settings/voice?site_id=YOUR_SITE_ID`

**Test koraci:**
1. ✅ Stranica se učitava bez grešaka
2. ✅ Vidi se form sa default vrednostima
3. ✅ Promenite Tone na "professional"
4. ✅ Promenite Personality na "Helpful assistant"
5. ✅ Kliknite "Save Settings"
6. ✅ Vidi se "Settings saved successfully"
7. ✅ Osvežite stranicu (F5)
8. ✅ Promene su sačuvane

### Korak 4: Testirajte Sales Settings

**URL:** `http://localhost:3000/dashboard/settings/sales?site_id=YOUR_SITE_ID`

**Test koraci:**
1. ✅ Stranica se učitava bez grešaka
2. ✅ Vidi se form sa default vrednostima
3. ✅ Promenite Max Recommendations na 5
4. ✅ Uključite "Upsell Enabled"
5. ✅ Kliknite "Save Settings"
6. ✅ Vidi se "Settings saved successfully"
7. ✅ Osvežite stranicu (F5)
8. ✅ Promene su sačuvane

### Korak 5: Testirajte Knowledge Settings

**URL:** `http://localhost:3000/dashboard/settings/knowledge?site_id=YOUR_SITE_ID`

**Test koraci:**
1. ✅ Stranica se učitava bez grešaka
2. ✅ Vidi se form sa default vrednostima
3. ✅ Promenite Chunk Size na 1500
4. ✅ Promenite Top-K Results na 10
5. ✅ Uključite "Include FAQ"
6. ✅ Kliknite "Save Settings"
7. ✅ Vidi se "Settings saved successfully"
8. ✅ Osvežite stranicu (F5)
9. ✅ Promene su sačuvane

## 🔍 Provera u Bazi (Optional)

### SQL Query u Supabase

```sql
-- Proverite da li su settings sačuvani
SELECT 
  key,
  value,
  version,
  is_active,
  created_at
FROM settings
WHERE site_id = 'YOUR_SITE_ID'
  AND key IN ('voice', 'sales', 'knowledge')
ORDER BY key, version DESC;
```

**Očekivani rezultat:**
- Trebalo bi da vidite 3 reda (po jedan za voice, sales, knowledge)
- `is_active = true` za najnovije verzije
- `value` JSONB kolona sadrži postavke

## ❌ Česti Problemi

### Problem: "Authentication required"
**Rešenje:** Prijavite se ponovo na dashboard

### Problem: "Site not found"
**Rešenje:** Proverite da li site_id postoji u Supabase

### Problem: Stranica se ne učitava
**Rešenje:** 
- Proverite da li server radi
- Proverite browser console za greške (F12)
- Proverite network tab za failed requests

### Problem: "Failed to save settings"
**Rešenje:**
- Proverite server logs u terminalu
- Proverite da li imate prava za INSERT/UPDATE u Supabase

## ✅ Success Criteria

Sve je OK ako:
- ✅ Sve tri stranice se učitavaju bez grešaka
- ✅ Default vrednosti se prikazuju kada nema postavki
- ✅ Izmene se mogu sačuvati
- ✅ Sačuvane izmene se učestaljuju nakon osvežavanja
- ✅ Settings se čuvaju u bazu (provera u Supabase)

---

**Vreme potrebno:** ~5-10 minuta  
**Težina:** Lako  
**Status:** ✅ Spreman za testiranje
