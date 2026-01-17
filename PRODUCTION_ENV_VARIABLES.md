# Production Environment Variables

Ovaj dokument opisuje sve environment variables potrebne za production deployment.

## 🔒 Security Notes

**⚠️ VAŽNO:**
- **NIKADA** ne commit-ujte `.env.local` ili `.env.production` u git
- **NIKADA** ne eksportujte service role keys ili API keys na client-side
- Koristite environment variables u hosting platformi (Vercel, Railway, itd.)

## 📋 Required Environment Variables

### 1. Supabase Configuration

```bash
# Public (može biti na client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Private (SAMO server-side)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Gde da dobijete:**
- Supabase Dashboard → Project Settings → API
- `NEXT_PUBLIC_SUPABASE_URL`: Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `anon` `public` key
- `SUPABASE_SERVICE_ROLE_KEY`: `service_role` `secret` key ⚠️ **NE DELITI**

**Provera:**
- ✅ `NEXT_PUBLIC_*` varijable su u `next.config.js` (OK za client-side)
- ✅ `SUPABASE_SERVICE_ROLE_KEY` se koristi samo u `src/lib/supabase/server.ts` (server-side only)

---

### 2. OpenAI Configuration

```bash
# Private (SAMO server-side)
OPENAI_API_KEY=sk-...
```

**Gde da dobijete:**
- OpenAI Dashboard → API Keys → Create new secret key
- https://platform.openai.com/api-keys

**Korišćenje:**
- `src/lib/chat/message-handler.ts` - chat completions
- `src/lib/embeddings/openai.ts` - embeddings

**Provera:**
- ✅ Koristi se samo u server-side fajlovima
- ✅ NIKADA nije eksportovan na client-side

---

### 3. Resend (Email Service)

```bash
# Private (SAMO server-side)
RESEND_API_KEY=re_...
```

**Gde da dobijete:**
- Resend Dashboard → API Keys → Create API Key
- https://resend.com/api-keys

**Korišćenje:**
- `src/lib/email/resend-client.ts` - email sending

**Provera:**
- ✅ Koristi se samo u server-side fajlovima
- ✅ NIKADA nije eksportovan na client-side

---

### 4. SaaS Platform URL

```bash
# Public (može biti na client-side)
SAAS_URL=https://api.aiwoochat.com
```

**Opis:**
- Production URL SaaS platforme
- Koristi se za generisanje linkova i API endpoint-a
- Može biti eksportovan na client-side (nije osetljiv)

**Provera:**
- ✅ Nije osetljiv podatak
- ✅ Može biti public

---

### 5. Node Environment

```bash
# System variable
NODE_ENV=production
```

**Opis:**
- Next.js automatski postavlja na `production` u production build-u
- Može biti eksplicitno postavljen za sigurnost

---

## 📝 Complete .env.production Example

```bash
# Supabase (Public)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase (Private - Server-only)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OpenAI (Private - Server-only)
OPENAI_API_KEY=sk-proj-...

# Resend (Private - Server-only)
RESEND_API_KEY=re_...

# SaaS Platform URL (Public)
SAAS_URL=https://api.aiwoochat.com

# Node Environment
NODE_ENV=production
```

---

## 🚀 Deployment Platforms

### Vercel

1. **Idite na:** Project Settings → Environment Variables
2. **Dodajte sve varijable:**
   - Production environment
   - Development environment (opciono)
3. **Redeploy** aplikaciju

**Vercel automatski:**
- Postavlja `NODE_ENV=production`
- Eksportuje `NEXT_PUBLIC_*` varijable na client-side
- Skriva private varijable (server-side only)

### Railway

1. **Idite na:** Project → Variables
2. **Dodajte sve varijable**
3. **Redeploy** aplikaciju

### Self-Hosted (VPS/Server)

1. **Kreirajte `.env.production` fajl:**
   ```bash
   nano .env.production
   ```

2. **Dodajte sve varijable** (kao u primeru iznad)

3. **Proverite da li je fajl u `.gitignore`:**
   ```bash
   echo ".env.production" >> .gitignore
   ```

4. **Restartujte aplikaciju:**
   ```bash
   pm2 restart ai-woo-chat
   # ili
   systemctl restart ai-woo-chat
   ```

---

## ✅ Verification Checklist

### Pre Deployment

- [ ] Sve environment variables su postavljene
- [ ] `SUPABASE_SERVICE_ROLE_KEY` je postavljen (server-only)
- [ ] `OPENAI_API_KEY` je postavljen (server-only)
- [ ] `RESEND_API_KEY` je postavljen (server-only)
- [ ] `SAAS_URL` pokazuje na production domen
- [ ] `.env.production` je u `.gitignore` (ako self-hosted)

### Post Deployment

- [ ] Aplikacija se build-uje bez grešaka
- [ ] Login radi (Supabase auth)
- [ ] API endpoint-i rade (proveriti u Network tab)
- [ ] Email sending radi (test email)
- [ ] Chat widget se učitava (proveriti CORS)

---

## 🔍 Troubleshooting

### Problem: "Missing Supabase environment variables"

**Uzrok:** `NEXT_PUBLIC_SUPABASE_URL` ili `NEXT_PUBLIC_SUPABASE_ANON_KEY` nisu postavljeni

**Rešenje:**
1. Proverite da li su varijable postavljene u hosting platformi
2. Proverite da li su `NEXT_PUBLIC_*` prefiksovane
3. Redeploy aplikaciju

### Problem: "OpenAI API error"

**Uzrok:** `OPENAI_API_KEY` nije postavljen ili je nevažeći

**Rešenje:**
1. Proverite da li je API key postavljen
2. Proverite da li je API key validan u OpenAI dashboard-u
3. Proverite da li imate dovoljno credits

### Problem: "Resend API error"

**Uzrok:** `RESEND_API_KEY` nije postavljen ili je nevažeći

**Rešenje:**
1. Proverite da li je API key postavljen
2. Proverite da li je API key validan u Resend dashboard-u
3. Proverite da li je verified domain (za production)

---

## 📚 Additional Resources

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Supabase Environment Variables](https://supabase.com/docs/guides/getting-started/local-development#environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Railway Environment Variables](https://docs.railway.app/develop/variables)

---

**Kreirano:** 2024-01-20  
**Status:** ✅ Spreman za production deployment
