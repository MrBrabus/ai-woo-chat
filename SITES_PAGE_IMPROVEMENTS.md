# Sites Page - Predložena Poboljšanja

## ✅ Implementirano

### 1. License Information
- ✅ Datum isteka licence (`expires_at`)
- ✅ Status licence (active, expired, revoked, suspended)
- ✅ License key (skraćeno)
- ✅ Plan limits (tokens/day, requests/day, max sites)
- ✅ Warning ako licence ističe uskoro (< 30 dana)
- ✅ Error ako je licence istekla

## 💡 Predložene Dodatne Opcije

### 1. Usage Statistics (Real-time)
**Korisno za:**
- Praćenje potrošnje tokena
- Provera da li su limiti blizu
- Planiranje upgrade-a

**Implementacija:**
```typescript
// Dodati u Site interface:
usage_today?: {
  tokens: number;
  requests: number;
  tokens_remaining: number;
  requests_remaining: number;
}
```

**Prikaz:**
- Progress bar za tokens (used / limit)
- Progress bar za requests (used / limit)
- Warning ako je > 80% iskorišćeno
- Error ako je limit dostignut

### 2. Site Health Indicators
**Korisno za:**
- Brza provera da li site radi
- Detekcija problema

**Indikatori:**
- ✅ **Active** - Site je aktivan i prima zahteve
- ⚠️ **Warning** - Nema aktivnosti u poslednjih 24h
- ❌ **Error** - Site ne odgovara ili ima greške
- 🔒 **Disabled** - Site je onemogućen

**Implementacija:**
- Proveriti poslednji chat request (iz `conversations.last_message_at`)
- Proveriti poslednji ingestion event
- Proveriti da li je license aktivan

### 3. Quick Actions
**Korisno za:**
- Brze akcije bez navigacije

**Akcije:**
- 🔄 **Rotate Secret** - Rotacija site secret-a
- 📊 **View Analytics** - Link ka Analytics stranici
- ⚙️ **Settings** - Link ka Settings stranicama
- 📝 **View Conversations** - Link ka Conversations stranici
- 🔗 **Copy Site ID** - Kopiranje site_id u clipboard

### 4. Activity Summary
**Korisno za:**
- Brz pregled aktivnosti

**Podaci:**
- Poslednja konverzacija (kada)
- Ukupno konverzacija (danas / ovaj mesec)
- Ukupno poruka (danas / ovaj mesec)
- Poslednji ingestion event

### 5. Filter & Search
**Korisno za:**
- Lako pronalaženje site-ova

**Filteri:**
- Status (active, disabled, revoked)
- Environment (production, staging)
- License status (active, expired, revoked)
- Sortiranje (last activity, created, name)

**Search:**
- Pretraga po site URL
- Pretraga po site name
- Pretraga po license key

### 6. Bulk Actions
**Korisno za:**
- Upravljanje više site-ova odjednom

**Akcije:**
- Bulk detach
- Bulk enable/disable
- Export site list (CSV)

### 7. Site Details Modal/Expansion
**Korisno za:**
- Više detalja bez navigacije

**Detalji:**
- Full license key
- Allowed origins (CORS)
- Secret rotated at
- Usage history (grafik)
- Recent conversations (link)
- Recent errors (ako postoje)

### 8. Notifications/Alerts
**Korisno za:**
- Obaveštenja o važnim događajima

**Alerti:**
- ⚠️ License ističe uskoro (< 30 dana)
- ❌ License istekla
- ⚠️ Usage limit blizu (> 80%)
- ❌ Usage limit dostignut
- ⚠️ Nema aktivnosti (> 7 dana)
- ⚠️ Site disabled

### 9. Usage Charts (Mini)
**Korisno za:**
- Vizuelni prikaz trendova

**Grafik:**
- Mini chart za tokens usage (poslednjih 7 dana)
- Mini chart za requests (poslednjih 7 dana)
- Click za full Analytics stranicu

### 10. Site Status Badge Colors
**Korisno za:**
- Brza vizuelna identifikacija

**Boje:**
- 🟢 Green - Active, license active, usage OK
- 🟡 Yellow - Warning (expires soon, usage high, no activity)
- 🔴 Red - Error (expired, revoked, limit reached, disabled)
- ⚪ Gray - Inactive/Staging

## 📊 Prioriteti

### 🔴 High Priority (Korisno odmah)
1. ✅ License expiration date
2. ⚠️ Usage statistics (tokens/requests today)
3. ⚠️ Site health indicators
4. ⚠️ Quick actions (rotate secret, view analytics)

### 🟡 Medium Priority (Korisno kasnije)
5. Activity summary
6. Filter & search
7. Notifications/alerts

### 🟢 Low Priority (Nice to have)
8. Bulk actions
9. Site details modal
10. Usage charts (mini)

---

**Kreirano:** 2024-01-20  
**Status:** ✅ License info implementirano, ostalo predloženo
