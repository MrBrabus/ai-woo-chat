# Kako da pristupite Supabase Dashboard-u

Ovaj guide objašnjava kako da pristupite Supabase Dashboard-u i pronađete vaš projekat.

## 🌐 Šta je Supabase Dashboard?

Supabase Dashboard je **web aplikacija** koja vam omogućava da:
- Upravljate bazom podataka (tabele, SQL queries)
- Upravljate korisnicima (Authentication)
- Upravljate API keys
- Gledate logove i analitiku

**URL:** https://supabase.com

## 📋 Korak-po-korak uputstvo

### Opcija 1: Ako već imate Supabase nalog i projekat

#### Korak 1: Pronađite URL vašeg Supabase projekta

1. **Proverite `.env.local` fajl u projektu:**
   ```
   C:\xampp\htdocs\AI Woo Chat\.env.local
   ```
   
   Ili proverite environment varijable:
   - `NEXT_PUBLIC_SUPABASE_URL` - URL vašeg projekta
   - Primer: `https://abcdefghijklmnop.supabase.co`

2. **Ako nemate `.env.local` fajl:**
   - Proverite da li možete da pristupite projektu na `http://localhost:3000`
   - Ako aplikacija radi, verovatno su environment varijable postavljene
   - Možete ih proveriti u `next.config.js` ili u terminalu gde je pokrenut server

#### Korak 2: Pristupite Supabase Dashboard-u

1. **Otvorite browser i idite na:**
   ```
   https://supabase.com/dashboard
   ```

2. **Prijavite se:**
   - Unesite email i password koji ste koristili za Supabase
   - Ili kliknite "Sign in with GitHub" / "Sign in with Google" (ako ste koristili OAuth)

3. **Pronađite vaš projekat:**
   - Na dashboard-u ćete videti listu svih vaših projekata
   - Kliknite na projekat koji odgovara `NEXT_PUBLIC_SUPABASE_URL` iz `.env.local`
   - Ili tražite projekat po nazivu

4. **Proverite da li je to pravi projekat:**
   - Idite na **Settings > API**
   - Proverite da li se **Project URL** podudara sa `NEXT_PUBLIC_SUPABASE_URL` iz vašeg projekta

### Opcija 2: Ako nemate Supabase nalog ili projekat

#### Korak 1: Kreirajte Supabase nalog

1. **Idite na:**
   ```
   https://supabase.com
   ```

2. **Kliknite "Start your project" ili "Sign in"**

3. **Kreirajte nalog:**
   - Možete koristiti email/password
   - Ili "Sign in with GitHub" / "Sign in with Google"

4. **Prijavite se**

#### Korak 2: Kreirajte novi Supabase projekat

1. **Kliknite "New Project"** na Supabase Dashboard-u

2. **Unesite podatke:**
   - **Organization:** Odaberite organizaciju (ili kreirajte novu)
   - **Name:** Unesite naziv projekta (npr. "AI Woo Chat")
   - **Database Password:** Unesite jak password (zapišite ga!)
   - **Region:** Odaberite region najbliži vama

3. **Kliknite "Create new project"**

4. **Sačekajte da se projekat kreira** (~2 minuta)

#### Korak 3: Konfigurišite environment varijable

1. **Idite na Settings > API** u vašem Supabase projektu

2. **Kopirajte sledeće vrednosti:**
   - **Project URL** (npr. `https://abcdefghijklmnop.supabase.co`)
   - **anon public** key (pod "Project API keys")
   - **service_role** key (pod "Project API keys") - ⚠️ VAŽNO: Ne delite ovo javno!

3. **Kreirajte `.env.local` fajl u projektu:**
   ```
   C:\xampp\htdocs\AI Woo Chat\.env.local
   ```

4. **Dodajte sledeće linije:**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
   OPENAI_API_KEY=your_openai_key_here
   RESEND_API_KEY=your_resend_key_here
   SAAS_URL=http://localhost:3000
   ```

5. **Zamenite `YOUR_PROJECT_ID` i ključeve** sa stvarnim vrednostima iz Supabase Dashboard-a

#### Korak 4: Primenite migracije

1. **Idite na SQL Editor** u Supabase Dashboard-u

2. **Kreirajte tabele:**
   - Otvorite fajlove iz `supabase/migrations/` foldera
   - Kopirajte SQL kod redom (po datumu):
     - `20240101000001_enable_pgvector.sql`
     - `20240101000002_create_tenants.sql`
     - `20240101000003_create_licenses.sql`
     - ... i tako dalje redom
   - Izvršite svaki SQL query u Supabase SQL Editor-u

3. **Ili koristite Supabase CLI** (ako imate instaliran):
   ```bash
   npx supabase db push
   ```

## 🎯 Nakon što pristupite Dashboard-u

### Gde da idete za testiranje:

1. **Authentication > Users:**
   - Za kreiranje test korisnika (Korak 1 iz `TESTING_SETUP_GUIDE.md`)

2. **SQL Editor:**
   - Za izvršavanje SQL skripti (`SETUP_TEST_DATA.sql`)
   - Za proveru podataka

3. **Settings > API:**
   - Za pristup API keys
   - Za proveru Project URL-a

4. **Table Editor:**
   - Za pregled podataka u tabelama
   - Za ručno dodavanje/izmenu podataka

## ❌ Troubleshooting

### Problem: Ne mogu da se prijavim na Supabase

**Rešenje:**
1. Proverite da li koristite ispravan email/password
2. Pokušajte "Forgot password" opciju
3. Proverite da li imate internet konekciju

### Problem: Ne vidim projekat u listi

**Rešenje:**
1. Proverite da li ste se prijavili sa pravim nalogom
2. Proverite da li je projekat možda u drugoj organizaciji
3. Kliknite "All projects" ili tražite po nazivu

### Problem: Ne mogu da pronađem Project URL

**Rešenje:**
1. Idite na **Settings > API** u projektu
2. **Project URL** je prikazan na vrhu stranice
3. Primer formata: `https://abcdefghijklmnop.supabase.co`

### Problem: Ne mogu da pristupim projektu na localhost:3000

**Rešenje:**
1. Proverite da li je `.env.local` fajl kreiran
2. Proverite da li su environment varijable ispravno postavljene
3. Restartujte Next.js development server (`npm run dev`)

### Problem: "Invalid API key" greška

**Rešenje:**
1. Proverite da li su API keys ispravno kopirani iz Supabase Dashboard-a
2. Proverite da li nema dodatnih razmaka u `.env.local` fajlu
3. Restartujte development server

## ✅ Provera da li je sve OK

1. ✅ Možete se prijaviti na https://supabase.com/dashboard
2. ✅ Vidite vaš projekat u listi
3. ✅ Možete pristupiti SQL Editor-u
4. ✅ Možete pristupiti Authentication > Users
5. ✅ Vaš Next.js projekat radi na `http://localhost:3000`

## 🎯 Sledeći koraci

Nakon što pristupite Supabase Dashboard-u:

1. **Pratite `TESTING_SETUP_GUIDE.md`** za kreiranje test podataka
2. **Kreirajte test korisnika** (Authentication > Users)
3. **Izvršite SQL skripte** (`SETUP_TEST_DATA.sql`)
4. **Testirajte Settings stranice**

---

**URL Supabase Dashboard-a:** https://supabase.com/dashboard  
**Podrška:** https://supabase.com/docs/guides/getting-started
