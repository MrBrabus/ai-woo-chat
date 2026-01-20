# Troubleshooting Guide

Ovaj dokument sadrži česte probleme i njihova rešenja koja su se pojavila tokom razvoja i deployment-a AI Woo Chat platforme.

## Problem: "Tenant or user not found" (XX000) greška

### Simptomi
- Chat widget se učita, bootstrap radi, poruka se upiše u bazu
- Kada se pokuša generisati AI odgovor, dobija se `500 Internal Server Error`
- U server logu (`stderr.log`): `error: Tenant or user not found` sa kodom `XX000`
- Greška se javlja u RAG pipeline-u kada pokušava da query-uje embeddings

### Uzrok
1. **Tenant check query u RAG pipeline-u**: Direktni Postgres query (`pg` connection) koji proverava da li tenant postoji u bazi, ali Supabase pooler validira tenant kroz username format (`postgres.<project-ref>`). Kada direktni query nema `auth.uid()`, pooler odbija konekciju sa "Tenant or user not found".

2. **RLS (Row-Level Security) blokira direktne Postgres konekcije**: Direktne `pg` konekcije (za pgvector operacije) nemaju `auth.uid()` kontekst, pa RLS policy-ji blokiraju pristup `embeddings` tabeli.

### Rešenje

#### 1. Ukloni tenant check query iz RAG pipeline-a
**Fajl:** `src/lib/rag/retrieval.ts`

**Problem:** Query koji proverava da li tenant postoji (`SELECT id FROM tenants WHERE id = $1::uuid LIMIT 1`) uzrokuje grešku jer Supabase pooler validira tenant kroz connection string, ne kroz SQL query.

**Rešenje:** Ukloni tenant check query. Tenant je već validiran u `route.ts` pre poziva RAG pipeline-a.

```typescript
// ❌ UKLONI OVO:
// Verify tenant exists in database before querying embeddings
const tenantCheck = await query('SELECT id FROM tenants WHERE id = $1::uuid LIMIT 1', [tenantId]);
if (!tenantCheck.rows || tenantCheck.rows.length === 0) {
  throw new Error('Tenant not found');
}

// ✅ Tenant je već validiran u route.ts pre poziva RAG pipeline-a
```

#### 2. Dodaj graceful error handling u RAG pipeline
**Fajl:** `src/lib/rag/retrieval.ts`

**Rešenje:** Ako embeddings query padne zbog RLS ili connection problema, vrati prazan array umesto da baci grešku. Ovo omogućava chat-u da radi i bez RAG context-a.

```typescript
try {
  // Try SECURITY DEFINER function first
  result = await query(`SELECT * FROM search_embeddings(...)`);
} catch (error: any) {
  if (error.code === 'XX000' || error.message?.includes('Tenant or user not found')) {
    console.warn('[RAG Retrieval] Query blocked by RLS, returning empty results');
    return []; // Return empty array - chat can still work
  }
  // For other errors, also return empty array
  return [];
}
```

#### 3. Dodaj try-catch oko RAG pipeline poziva
**Fajl:** `src/lib/chat/message-handler.ts`

**Rešenje:** Ako RAG pipeline padne, nastavi bez RAG context-a.

```typescript
let ragResult: Awaited<ReturnType<typeof runRAGPipeline>>;
try {
  ragResult = await runRAGPipeline({...});
} catch (ragError: any) {
  logger.warn('RAG pipeline failed, continuing without RAG context');
  // Create empty RAG result so chat can still work
  ragResult = {
    chunks: [],
    contextBlocks: [],
    evidence: [],
    prompts: {
      systemPrompt: 'You are a helpful AI assistant...',
      userPrompt: message,
      fullPrompt: message,
    },
  };
}
```

#### 4. SQL migracije za RLS (opciono)
**Fajl:** `supabase/migrations/20240120000003_allow_direct_pg_embeddings.sql`

Dodaj RLS policy koji dozvoljava `postgres` roli (direktne konekcije) da čita embeddings:

```sql
CREATE POLICY "Direct Postgres connections can read embeddings"
    ON embeddings FOR SELECT
    TO postgres
    USING (true);
```

**Fajl:** `supabase/migrations/20240120000004_create_embeddings_search_function.sql`

Kreiraj `SECURITY DEFINER` funkciju koja zaobilaazi RLS:

```sql
CREATE OR REPLACE FUNCTION search_embeddings(
    p_query_vector vector,
    p_tenant_id uuid,
    p_site_id uuid,
    p_allowed_types text[],
    p_limit int,
    p_threshold float
)
RETURNS TABLE(...)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Function body
END;
$$;
```

### Reference
- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)

---

## Problem: "site_id is not defined" ReferenceError

### Simptomi
- `500 Internal Server Error` sa `details: "site_id is not defined"`
- U server logu: `ReferenceError: site_id is not defined`

### Uzrok
Korišćenje shorthand property syntax-a u objektima (`site_id` umesto `site_id: siteId`) kada varijabla `site_id` ne postoji u scope-u. Varijabla se zove `siteId` (camelCase), ne `site_id`.

### Rešenje

**Fajl:** `src/lib/chat/message-handler.ts`

**Problem:**
```typescript
logger.info('Starting RAG pipeline', {
  tenant_id: site.tenant_id,
  site_id,  // ❌ GREŠKA: site_id varijabla ne postoji!
  ...
});
```

**Rešenje:**
```typescript
logger.info('Starting RAG pipeline', {
  tenant_id: site.tenant_id,
  site_id: siteId,  // ✅ Koristi siteId varijablu
  ...
});
```

**Sve lokacije koje treba popraviti:**
- `src/lib/chat/message-handler.ts` linija ~241: `site_id,` → `site_id: siteId,`
- `src/lib/chat/message-handler.ts` linija ~275: `site_id,` → `site_id: siteId,`

### Reference
- [JavaScript Object Shorthand Properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Object_initializer#property_definitions)

---

## Problem: 406 Not Acceptable (PGRST116) u Supabase logu

### Simptomi
- U Supabase logu se pojavljuje `406` status kod sa `PGRST116` greškom
- Request: `GET /rest/v1/usage_daily?select=chat_requests&site_id=eq.xxx&date=eq.2026-01-18`
- Greška se javlja kada pokušava da pročita `usage_daily` tabelu

### Uzrok
PostgREST `.single()` metoda očekuje tačno jedan red. Kada red ne postoji (npr. prvi put za taj datum), PostgREST vraća `406 Not Acceptable` sa `PGRST116` greškom umesto da vrati `null` ili prazan rezultat.

### Rešenje

**Fajl:** `src/lib/usage-tracking.ts`

**Problem:**
```typescript
const { data: current } = await supabase
  .from('usage_daily')
  .select('*')
  .eq('date', today)
  .eq('site_id', site_id)
  .single();  // ❌ Baca 406 ako red ne postoji
```

**Rešenje:**
```typescript
const { data: currentData, error: currentError } = await supabase
  .from('usage_daily')
  .select('*')
  .eq('date', today)
  .eq('site_id', site_id)
  .maybeSingle();  // ✅ Vraća null ako red ne postoji

const current = currentError ? null : currentData;
```

**Sve lokacije koje treba popraviti:**
- `src/lib/usage-tracking.ts` `updateDailyUsage()` funkcija: `.single()` → `.maybeSingle()`
- `src/lib/usage-tracking.ts` `checkUsageLimits()` funkcija: `.single()` → `.maybeSingle()`

### Reference
- [Supabase JavaScript Client - maybeSingle()](https://supabase.com/docs/reference/javascript/select#maybeSingle)
- [PostgREST Error Codes](https://postgrest.org/en/stable/api.html#errors)

---

## Problem: Diagnostika "Tenant or user not found" greške

### Metodologija dijagnostike (preuzeto sa interneta)

Kada se javi "Tenant or user not found" greška, proveri sledeće:

#### 1. Proveri da li postoji user u Supabase auth kontekstu
**Problem:** Widget radi na tuđem WooCommerce sajtu, nema Supabase session cookie, pa `supabase.auth.getUser()` vraća `null`.

**Rešenje:** Za widget nemoj zahtevati Supabase auth user-a. Koristi:
- `site_id + license_key` za identifikaciju tenant-a
- `visitor_id` (cookie/localStorage) za identifikaciju posetioca

#### 2. Proveri tenant lookup
**SQL provera:**
```sql
-- 1) Da li site postoji i ima tenant_id?
SELECT id, tenant_id, site_url
FROM sites
WHERE id = '<SITE_ID_FROM_REQUEST>';

-- 2) Da li tenant postoji?
SELECT id, name
FROM tenants
WHERE id = '<TENANT_ID>';

-- 3) Ako koristiš license:
SELECT id, tenant_id, site_id, status
FROM licenses
WHERE license_key = '<LICENSE_KEY_FROM_WIDGET>';
```

#### 3. Proveri RLS policies
**Problem:** INSERT u `conversations` radi (ima policy za anon INSERT), ali SELECT za `tenants`/`sites`/`embeddings` ne radi jer koristi anon key umesto service role.

**Rešenje:** U server-side handler-ima (`/api/chat/message`) koristi Service Role key (`createAdminClient()`) za lookup tenant/site/license + za OpenAI flow.

#### 4. Dodaj detaljno logovanje
**Fajl:** `src/app/api/chat/message/route.ts`

Dodaj log tačke:
```typescript
// 1. Loguj šta stiže
logger.info('Chat message received', {
  site_id: body.site_id,
  visitor_id: body.visitor_id,
  conversation_id: body.conversation_id,
});

// 2. Loguj rezultat site lookup-a
logger.info('Site lookup result', {
  site_id: body.site_id,
  site_found: !!site,
  site_tenant_id: site?.tenant_id || null,
});

// 3. Loguj rezultat tenant lookup-a
logger.info('Tenant lookup result', {
  tenant_id: site.tenant_id,
  tenant_found: !!tenant,
});
```

**Fajl:** `src/lib/rag/retrieval.ts`

Dodaj logovanje pre i posle query-ja:
```typescript
console.log('[RAG Retrieval] Starting embeddings query', {
  tenant_id: tenantId,
  site_id: siteId,
});

try {
  result = await query(...);
  console.log('[RAG Retrieval] Query succeeded', {
    rows_count: result.rows?.length || 0,
  });
} catch (error: any) {
  console.error('[RAG Retrieval] Query failed', {
    error_message: error.message,
    error_code: error.code,
    tenant_id: tenantId,
    site_id: siteId,
  });
}
```

---

## Checklist za debugging

Kada se javi greška, proveri:

- [ ] Da li je `site_id` validan UUID?
- [ ] Da li site postoji u bazi i ima `tenant_id`?
- [ ] Da li tenant postoji u bazi?
- [ ] Da li se koristi `createAdminClient()` (service role) umesto `createClient()` (anon key)?
- [ ] Da li RLS policy dozvoljava pristup tabeli?
- [ ] Da li se koristi `.maybeSingle()` umesto `.single()` kada red možda ne postoji?
- [ ] Da li su sve varijable definisane pre upotrebe (nema shorthand properties sa nepostojećim varijablama)?
- [ ] Da li je RAG pipeline wrapped u try-catch da ne pada ceo endpoint?

---

## Korisni SQL upiti za debugging

```sql
-- Proveri site i tenant
SELECT s.id, s.site_url, s.tenant_id, t.name as tenant_name
FROM sites s
LEFT JOIN tenants t ON t.id = s.tenant_id
WHERE s.id = '<SITE_ID>';

-- Proveri da li postoje embeddings za tenant/site
SELECT COUNT(*) as embedding_count
FROM embeddings
WHERE tenant_id = '<TENANT_ID>' AND site_id = '<SITE_ID>';

-- Proveri RLS policies na embeddings tabeli
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'embeddings';

-- Proveri da li postoji SECURITY DEFINER funkcija
SELECT proname, prosecdef
FROM pg_proc
WHERE proname = 'search_embeddings';
```

---

## Reference

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Supabase JavaScript Client - maybeSingle()](https://supabase.com/docs/reference/javascript/select#maybeSingle)
- [PostgREST Error Codes](https://postgrest.org/en/stable/api.html#errors)
