# Quick Fix - 404 na /login i Next.js Warning

## ✅ Problem 1: Next.js Warning - Ispravljeno!

✅ **Već ispravljeno:** Uklonjen `experimental.serverActions` iz `next.config.js`

**Ako i dalje vidite warning:**
- Restartujte development server (Ctrl+C pa `npm run dev`)

## ❌ Problem 2: 404 na /login - Treba da kreirate .env.local

**Uzrok:** `.env.local` fajl ne postoji, pa environment varijable nisu postavljene.

**Rešenje:**

### Korak 1: Kreirajte .env.local fajl

1. **Kreirajte novi fajl:**
   ```
   C:\xampp\htdocs\AI Woo Chat\.env.local
   ```

2. **Kopirajte sledeći sadržaj:**
   ```env
   # Supabase Configuration
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   
   # OpenAI API Key
   OPENAI_API_KEY=your-openai-key-here
   
   # Resend API Key (optional)
   RESEND_API_KEY=
   
   # SaaS Platform URL
   SAAS_URL=http://localhost:3000
   ```

3. **Zamenite vrednosti:**
   - **NEXT_PUBLIC_SUPABASE_URL:** URL vašeg Supabase projekta
   - **NEXT_PUBLIC_SUPABASE_ANON_KEY:** anon key iz Supabase Dashboard-a
   - **SUPABASE_SERVICE_ROLE_KEY:** service_role key iz Supabase Dashboard-a
   - **OPENAI_API_KEY:** vaš OpenAI API key (opciono za sada, može biti prazan)

### Korak 2: Pronađite Supabase podatke

1. **Idite na Supabase Dashboard:**
   ```
   https://supabase.com/dashboard
   ```

2. **Prijavite se** (ili kreirajte nalog ako nemate)

3. **Otvorite vaš projekat** (ili kreirajte novi)

4. **Idite na Settings > API:**
   - Kopirajte **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - Kopirajte **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Kopirajte **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

### Korak 3: Restartujte server

1. **Zaustavite server** (Ctrl+C u terminalu)

2. **Pokrenite ponovo:**
   ```bash
   npm run dev
   ```

3. **Proverite da li radi:**
   ```
   http://localhost:3000
   ```

4. **Idite na login:**
   ```
   http://localhost:3000/login
   ```

### Korak 4: Ako i dalje ne radi

**Proverite:**

1. **Da li je `.env.local` fajl kreiran?**
   - Fajl mora biti u root folderu projekta
   - Ime mora biti tačno `.env.local` (sa tačkom na početku)

2. **Da li su environment varijable ispravno postavljene?**
   - Proverite da nema dodatnih razmaka
   - Proverite da nema navodnika oko vrednosti (osim ako su deo vrednosti)

3. **Da li je server restartovan?**
   - Next.js učitava environment varijable samo pri pokretanju

4. **Proverite terminal za greške:**
   - Možda vidite greške koje pokazuju koji problem postoji

## 📝 Primer .env.local fajla

```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzOTY5NjAwMCwiZXhwIjoxOTU1Mjc2MDAwfQ.abcdefghijklmnopqrstuvwxyz1234567890
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNjM5Njk2MDAwLCJleHAiOjE5NTUyNzYwMDB9.abcdefghijklmnopqrstuvwxyz1234567890
OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwxyz1234567890
RESEND_API_KEY=
SAAS_URL=http://localhost:3000
```

## ⚠️ Važno

- **Nikada ne commit-ujte `.env.local` fajl** (već je u `.gitignore`)
- **Nikada ne delite service_role key** - to je osetljiv podatak!
- **Za testiranje, možete koristiti privremene vrednosti** - važno je samo da fajl postoji

## ✅ Success Checklist

- [ ] `.env.local` fajl kreiran
- [ ] Supabase URL i keys uneti
- [ ] Server restartovan
- [ ] Warning nestao iz terminala
- [ ] `/login` stranica se učitava (bez 404)
- [ ] Home page (`/`) radi

---

**Nakon ove izmene, pratite `SUPABASE_ACCESS_GUIDE.md` za pristup Supabase Dashboard-u!**
