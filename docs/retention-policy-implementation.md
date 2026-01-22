# Retention Policy Implementation

## Pregled

Implementirana je retention policy sa dnevnom rotacijom koja automatski briše stare podatke iz baze, održavajući 90 dana istorije. Ovo rešenje sprečava rast baze podataka i održava performanse na optimalnom nivou.

## Problem

Kada se aplikacija komercijalizuje i koristi na mnogo sajtova sa velikim brojem korisnika, baza podataka može brzo da raste:
- Svaka chat poruka se upisuje u `messages` tabelu
- Svaka konverzacija se upisuje u `conversations` tabelu
- Chat eventi se upisuju u `chat_events` tabelu
- Usage tracking se upisuje u `usage_events` tabelu

Bez retention policy, baza može da raste neograničeno, što dovodi do:
- Povećanih troškova storage-a
- Sporijih query-ja
- Problema sa skalabilnošću

## Rešenje

Implementirana je retention policy sa **dnevnom rotacijom**:
- Svakog dana se briše podatak za **jedan dan** (90. dan unazad)
- Ovo održava tačno 90 dana istorije
- Brisanje se dešava postepeno, bez velikog opterećenja na bazu

### Primer:
- Danas: 21. januar 2024
- 90 dana unazad: 23. oktobar 2023
- Funkcija briše sve podatke za **23. oktobar 2023**
- Sutra će obrisati podatke za **24. oktobar 2023**, itd.

## Implementacija

### Migracija
**Fajl**: `supabase/migrations/20240121000001_create_retention_policy.sql`

### Funkcija: `cleanup_old_data()`

Funkcija koja briše podatke za jedan dan (90 dana unazad):

```sql
SELECT cleanup_old_data();
```

**Povratna vrednost:**
```sql
table_name    | deleted_count | target_date
--------------+--------------+-------------
messages      | 1523         | 2023-10-23
conversations | 89           | 2023-10-23
chat_events   | 2341         | 2023-10-23
usage_events  | 4567         | 2023-10-23
```

**Tabele koje se čiste:**
1. `messages` - sve poruke za taj dan
2. `conversations` - konverzacije bez poruka (orphaned) za taj dan
3. `chat_events` - svi eventi za taj dan
4. `usage_events` - svi usage eventi za taj dan

**Napomena:** `usage_daily` agregati se **ne brišu** - zadržavaju se za analytics.

### Automatsko Pokretanje

Migracija pokušava da omogući `pg_cron` ekstenziju i kreira scheduled job koji poziva funkciju svakog dana u 3:00 AM UTC.

**Ako pg_cron nije dostupan u Supabase:**
- Migracija neće pasti, ali će ispisati upozorenje
- Potrebno je podesiti eksterni cron job

## Opcije za Automatsko Pokretanje

### 1. Supabase pg_cron (Ako je dostupan)
Ako Supabase podržava `pg_cron`, job je već podešen:
```sql
-- Proveri da li je job kreiran
SELECT * FROM cron.job WHERE jobname = 'cleanup-old-data-daily';
```

### 2. GitHub Actions (Preporučeno)
Kreiraj `.github/workflows/cleanup-db.yml`:
```yaml
name: Database Cleanup
on:
  schedule:
    - cron: '0 3 * * *'  # Daily at 3 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run cleanup
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
        run: |
          psql "$SUPABASE_DB_URL" -c "SELECT cleanup_old_data();"
```

### 3. Vercel Cron Jobs
Ako aplikacija radi na Vercel-u, kreiraj `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/cleanup",
    "schedule": "0 3 * * *"
  }]
}
```

I kreiraj API endpoint `src/app/api/cron/cleanup/route.ts`:
```typescript
import { query } from '@/lib/db/postgres';

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await query('SELECT cleanup_old_data()');
  return Response.json(result.rows);
}
```

### 4. Server Cron (Ako imaš dedicated server)
Dodaj u crontab:
```bash
0 3 * * * psql "$SUPABASE_DB_URL" -c "SELECT cleanup_old_data();"
```

### 5. Supabase Edge Functions
Kreiraj Edge Function koja poziva funkciju i podesi scheduled trigger.

## Ručno Pokretanje

Funkciju možeš pozvati ručno bilo kada:

```sql
-- Pozovi funkciju direktno
SELECT cleanup_old_data();

-- Ili preko Supabase SQL Editor
SELECT * FROM cleanup_old_data();
```

## Monitoring

### Proveri koliko podataka ima za brisanje:
```sql
-- Poruke starije od 90 dana
SELECT COUNT(*) FROM messages 
WHERE created_at < NOW() - INTERVAL '90 days';

-- Konverzacije starije od 90 dana
SELECT COUNT(*) FROM conversations 
WHERE last_message_at < NOW() - INTERVAL '90 days';
```

### Proveri da li funkcija radi:
```sql
-- Poslednji put kada je funkcija pokrenuta (ako loguješ)
SELECT * FROM cleanup_old_data();
```

## Konfiguracija

### Promena retention perioda (npr. na 60 dana)

Ako želiš da promeniš retention period sa 90 na 60 dana:

1. Izmeni funkciju:
```sql
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE (...)
AS $$
DECLARE
    v_target_date DATE;
BEGIN
    -- Promeni sa 90 na 60 dana
    v_target_date := (CURRENT_DATE - INTERVAL '60 days')::DATE;
    -- ... rest of function
END;
$$;
```

2. Ažuriraj cron job ako je potrebno

## Bezbednost

- Funkcija koristi `SECURITY DEFINER` - pokreće se sa privilegijama vlasnika
- Funkcija je bezbedna jer briše samo podatke starije od 90 dana
- Ne briše `usage_daily` agregate (važni za analytics)
- Ne briše `embeddings` (potrebni za RAG)

## Testiranje

Pre primene na produkciju, testiraj funkciju:

```sql
-- Proveri koliko će se obrisati
SELECT 
    'messages' as table_name,
    COUNT(*) as count_to_delete
FROM messages 
WHERE DATE_TRUNC('day', created_at)::DATE = (CURRENT_DATE - INTERVAL '90 days')::DATE
UNION ALL
SELECT 
    'conversations' as table_name,
    COUNT(*) as count_to_delete
FROM conversations 
WHERE DATE_TRUNC('day', last_message_at)::DATE = (CURRENT_DATE - INTERVAL '90 days')::DATE;

-- Pokreni funkciju
SELECT cleanup_old_data();

-- Proveri rezultate
SELECT * FROM cleanup_old_data();
```

## Status

- ✅ Migracija kreirana
- ✅ Funkcija `cleanup_old_data()` implementirana
- ⚠️ pg_cron job - zavisi od Supabase podrške
- 📝 Dokumentacija dodata

## Napomene

1. **Particionisanje tabela** - Za sada nije implementirano. Ako baza poraste preko 50GB, razmotri particionisanje po mesecima.

2. **Arhiviranje** - Trenutno se podaci brišu. U budućnosti možemo razmotriti arhiviranje u S3 pre brisanja.

3. **Monitoring** - Preporučeno je dodati alerting kada baza pređe određenu veličinu (npr. 80% limita).

## Datum Implementacije

**21. januar 2024**

## Autor

Implementirano kao deo retention policy strategije za skalabilnost aplikacije.
