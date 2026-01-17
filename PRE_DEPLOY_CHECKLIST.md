# Pre-Deploy Checklist - AI Woo Chat SaaS Platform

Ovaj dokument sadrži sve što treba proveriti i uraditi pre deploy-a na live production server.

## 📋 Status Implementacije

✅ **Sve osnovne funkcionalnosti su implementirane:**
- ✅ Ingestion Service (webhook, embeddings, pgvector)
- ✅ RAG Core (retrieval, context building)
- ✅ Chat Runtime (bootstrap, message, events)
- ✅ Widget Frontend (React widget, loader)
- ✅ Email Service (Resend integration)
- ✅ Dashboard Basic (conversations, settings)
- ✅ Stabilization improvements (retry, reconnect, timeouts)
- ✅ Security fixes (RLS policies, grants)

## 🔒 1. Security Provere

### 1.1 RLS (Row Level Security) Verifikacija

**Proverite u Supabase SQL Editor:**

```sql
-- 1. Proverite da li su sve RLS policies koriste 'authenticated' (ne 'public')
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname='public'
  AND roles = '{public}';  -- Ovo bi trebalo da vrati 0 redova

-- 2. Proverite da li anon/authenticated imaju INSERT/UPDATE/DELETE prava
SELECT table_name, privilege_type, grantee
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND grantee IN ('anon', 'authenticated')
  AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  AND table_name NOT IN ('visitors', 'conversations', 'messages', 'chat_events');
-- Ovo bi trebalo da vrati 0 redova (runtime tabele su OK)

-- 3. Proverite da li je RLS omogućen na svim tabelama
SELECT relname, relrowsecurity
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE nspname = 'public'
  AND relkind = 'r'
  AND relrowsecurity = false;
-- Ovo bi trebalo da vrati samo tabele koje ne treba da imaju RLS (ako ih ima)
```

**Fajl za proveru:** `docs/security_verification_queries.sql`

### 1.2 Environment Variables Security

**Proverite da li su sve osetljive vrednosti postavljene:**

```bash
# Obavezno postaviti u production:
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # ⚠️ NIKADA na client-side
OPENAI_API_KEY=sk-...  # ⚠️ NIKADA na client-side
RESEND_API_KEY=re_...  # ⚠️ NIKADA na client-side
SAAS_URL=https://api.aiwoochat.com  # Production URL
```

**⚠️ VAŽNO:**
- `SUPABASE_SERVICE_ROLE_KEY` - **NIKADA** ne eksportovati na client-side
- `OPENAI_API_KEY` - **NIKADA** ne eksportovati na client-side
- `RESEND_API_KEY` - **NIKADA** ne eksportovati na client-side
- Proverite da li `next.config.js` ne eksportuje osetljive varijable

### 1.3 CORS Validation

**Proverite da li su svi public endpoints validiraju Origin:**

- ✅ `/api/chat/bootstrap` - validira Origin
- ✅ `/api/chat/message` - validira Origin
- ✅ `/api/chat/events` - validira Origin
- ✅ `/api/widget` - CORS headers postavljeni
- ✅ `/api/widget/loader.js` - CORS headers postavljeni

**Proverite kod:**
- `src/api/chat/bootstrap/route.ts`
- `src/api/chat/message/route.ts`
- `src/api/chat/events/route.ts`

**⚠️ NIKADA ne koristiti `Access-Control-Allow-Origin: *`**

### 1.4 HMAC Signing

**Proverite da li su svi zahtevi između SaaS i WordPress potpisani:**

- ✅ WordPress → SaaS webhook (`/api/ingestion/webhook`)
- ✅ SaaS → WordPress API calls (`src/lib/wordpress/client.ts`)

**Testirajte:**
- Valid HMAC signature → 200 OK
- Invalid signature → 403 Forbidden
- Missing headers → 400 Bad Request

## 🚀 2. Environment Configuration

### 2.1 Environment Variables Checklist

**Production Environment Variables:**

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...  # Server-only

# OpenAI
OPENAI_API_KEY=sk-...

# Resend (Email)
RESEND_API_KEY=re_...

# SaaS Platform
SAAS_URL=https://api.aiwoochat.com  # Production URL

# Node Environment
NODE_ENV=production
```

**Proverite:**
- [ ] Sve varijable su postavljene u production environment
- [ ] `SAAS_URL` pokazuje na production domen
- [ ] `NODE_ENV=production` je postavljen
- [ ] Nema hardcoded development URL-ova u kodu

### 2.2 Next.js Configuration

**Proverite `next.config.js`:**

```javascript
// ✅ React Strict Mode omogućen
reactStrictMode: true

// ✅ Samo public env vars eksportovane
env: {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
}
```

**⚠️ Proverite da li nema:**
- Hardcoded API keys
- Development URLs
- Debug flags

## 🧪 3. Testing Checklist

### 3.1 Functional Testing

**Dashboard:**
- [ ] Login/Signup radi
- [ ] Dashboard se učitava
- [ ] Sidebar navigacija radi (sa site_id parametrom)
- [ ] Settings stranice (Voice, Sales, Knowledge, Email) rade
- [ ] Conversations stranica radi
- [ ] Sites stranica radi

**API Endpoints:**
- [ ] `/api/license/activate` - aktivacija license key
- [ ] `/api/chat/bootstrap` - bootstrap chat session
- [ ] `/api/chat/message` - slanje poruke
- [ ] `/api/chat/events` - tracking events
- [ ] `/api/ingestion/webhook` - webhook za ingestion
- [ ] `/api/widget` - widget bundle
- [ ] `/api/widget/loader.js` - widget loader

**WordPress Plugin:**
- [ ] Plugin se aktivira sa license key
- [ ] Widget se učitava na frontend-u
- [ ] Chat widget radi (otvara se, prima poruke)
- [ ] Webhook se šalje kada se proizvod ažurira

### 3.2 Security Testing

- [ ] RLS policies blokiraju neautorizovani pristup
- [ ] CORS validacija blokira nevalidne origin-e
- [ ] HMAC signing blokira nepotpisane zahteve
- [ ] License status check blokira revoked/expired license-e
- [ ] Rate limiting radi (ako je implementiran)

### 3.3 Error Handling

- [ ] Network greške se obrađuju gracefully
- [ ] OpenAI API greške se loguju i vraćaju generičke poruke
- [ ] WordPress API timeout-i se retry-uju
- [ ] Widget reconnect radi nakon network failure
- [ ] Partial messages se čuvaju na abort

### 3.4 Performance Testing

- [ ] Dashboard se učitava brzo (< 2s)
- [ ] Chat poruke se šalju brzo (< 3s za response)
- [ ] Embeddings se procesiraju u batch-ovima
- [ ] RAG retrieval je brz (< 1s)
- [ ] Widget se učitava brzo (< 1s)

## 📊 4. Monitoring & Logging

### 4.1 Structured Logging

**Proverite da li se logovi pišu u JSON formatu:**

```typescript
// Primer iz src/lib/utils/logger.ts
{
  "timestamp": "2024-01-20T10:30:00Z",
  "level": "error",
  "message": "OpenAI API error",
  "context": {
    "request_id": "req_abc123",
    "site_id": "...",
    "conversation_id": "..."
  },
  "error": { ... }
}
```

**Proverite:**
- [ ] Svi logovi imaju `request_id`
- [ ] Error logovi imaju full context
- [ ] Logovi su u JSON formatu (machine-readable)

### 4.2 Error Tracking

**Preporučeno za production:**
- [ ] Integracija sa error tracking servisom (Sentry, LogRocket, itd.)
- [ ] Alerts za kritične greške
- [ ] Dashboard za monitoring API health

### 4.3 Performance Monitoring

**Preporučeno:**
- [ ] APM tool (New Relic, Datadog, itd.)
- [ ] Database query monitoring
- [ ] API response time tracking
- [ ] OpenAI API usage tracking

## 🔧 5. Database & Migrations

### 5.1 Migration Status

**Proverite da li su sve migracije primenjene:**

```sql
-- Proverite migration history u Supabase
SELECT * FROM supabase_migrations.schema_migrations
ORDER BY version DESC;
```

**Fajl za proveru:** `MIGRATION_STATUS.md`

**Proverite:**
- [ ] Sve 20 migracija su primenjene
- [ ] pgvector extension je omogućen
- [ ] Sve tabele postoje
- [ ] RLS policies su postavljene
- [ ] Indexi su kreirani

### 5.2 Database Indexes

**Proverite da li postoje indexi za:**
- [ ] `embeddings.embedding` (pgvector index)
- [ ] `conversations.site_id`
- [ ] `messages.conversation_id`
- [ ] `settings.site_id, key`
- [ ] `usage_events.site_id, created_at`

### 5.3 Database Backups

**Preporučeno:**
- [ ] Automatski backup-ovi su konfigurisani u Supabase
- [ ] Backup retention policy je postavljen
- [ ] Test restore procedure je testirana

## 🌐 6. Deployment Configuration

### 6.1 Build Configuration

**Proverite production build:**

```bash
# Test build lokalno
npm run build

# Proverite da li build uspeva bez grešaka
# Proverite da li su sve environment variables dostupne
```

**Proverite:**
- [ ] Build uspeva bez grešaka
- [ ] TypeScript type checking prođe (`npm run type-check`)
- [ ] ESLint prođe (`npm run lint`)
- [ ] Nema console.error/console.warn u production build-u

### 6.2 Server Configuration

**Za VPS/Server deployment:**

- [ ] Node.js 18+ instaliran
- [ ] PM2 ili systemd service konfigurisan
- [ ] Reverse proxy (Nginx) konfigurisan
- [ ] SSL sertifikat konfigurisan (Let's Encrypt)
- [ ] Firewall rules postavljene
- [ ] Port 3000 (ili custom) je otvoren

**Za Vercel/Netlify deployment:**

- [ ] Environment variables postavljene u dashboard
- [ ] Custom domain konfigurisan
- [ ] SSL automatski konfigurisan

### 6.3 Domain & DNS

- [ ] Production domain je konfigurisan (`api.aiwoochat.com`)
- [ ] DNS A/CNAME recordi su postavljeni
- [ ] SSL sertifikat je validan
- [ ] CORS allowed origins su ažurirani u `sites.allowed_origins`

## 📝 7. Documentation

### 7.1 API Documentation

- [ ] API contract dokumentacija je ažurirana (`docs/api-contract-v1.md`)
- [ ] Endpoint dokumentacija je tačna
- [ ] Error response format je dokumentovan

### 7.2 User Documentation

- [ ] WordPress plugin installation guide
- [ ] Dashboard user guide
- [ ] Troubleshooting guide

## 🚨 8. Critical Pre-Deploy Checks

### 8.1 Final Security Audit

- [ ] **RLS policies** - sve koriste `authenticated`, ne `public`
- [ ] **Grants** - anon/authenticated nemaju write access
- [ ] **CORS** - nema `*` wildcard, sve validiraju Origin
- [ ] **HMAC** - svi zahtevi su potpisani
- [ ] **API Keys** - nisu eksportovane na client-side
- [ ] **Error messages** - ne otkrivaju sensitive informacije

### 8.2 Performance Audit

- [ ] **Database queries** - optimizovane, sa indexima
- [ ] **API responses** - brzi, sa caching gde je moguće
- [ ] **Widget loading** - brz, sa retry logic
- [ ] **OpenAI calls** - batch-ovani, sa retry logic

### 8.3 Error Handling Audit

- [ ] **Network errors** - retry sa exponential backoff
- [ ] **OpenAI errors** - graceful fallback
- [ ] **WordPress API errors** - retry sa timeout
- [ ] **Widget errors** - fallback UI, reconnect logic

## ✅ 9. Deployment Steps

### 9.1 Pre-Deployment

1. [ ] Final code review
2. [ ] Test build lokalno (`npm run build`)
3. [ ] Test production build lokalno (`npm run start`)
4. [ ] Backup production database (ako postoji)
5. [ ] Ažuriraj environment variables u production

### 9.2 Deployment

1. [ ] Deploy code na production server
2. [ ] Restart application server
3. [ ] Proveri da li aplikacija radi (`curl https://api.aiwoochat.com/api/health`)
4. [ ] Proveri da li su svi endpoint-i dostupni
5. [ ] Testiraj login na dashboard
6. [ ] Testiraj widget loading na test WordPress sajtu

### 9.3 Post-Deployment

1. [ ] Monitor error logs prvih 24h
2. [ ] Proveri da li su svi API pozivi uspešni
3. [ ] Proveri da li widget radi na production WordPress sajtovima
4. [ ] Proveri da li ingestion webhook-i rade
5. [ ] Proveri da li email sending radi

## 📋 10. Rollback Plan

**Ako nešto pođe po zlu:**

1. [ ] Rollback code na prethodnu verziju
2. [ ] Restart application server
3. [ ] Proveri da li aplikacija radi
4. [ ] Analiziraj error logs
5. [ ] Fix issues pre ponovnog deploy-a

## 🎯 Prioriteti

### 🔴 Critical (Mora biti urađeno pre deploy-a)

1. ✅ RLS security provere
2. ✅ Environment variables security
3. ✅ CORS validation
4. ✅ HMAC signing
5. ✅ Database migrations
6. ✅ Production build test

### 🟡 Important (Preporučeno pre deploy-a)

1. ⚠️ Error tracking setup
2. ⚠️ Performance monitoring
3. ⚠️ Database backups
4. ⚠️ Rate limiting (ako nije implementiran)
5. ⚠️ Comprehensive testing

### 🟢 Nice to Have (Može posle deploy-a)

1. 📝 User documentation
2. 📝 API documentation updates
3. 📝 Advanced monitoring dashboards

---

**Kreirano:** 2024-01-20  
**Status:** ✅ Spreman za review  
**Sledeći korak:** Final code review i security audit
