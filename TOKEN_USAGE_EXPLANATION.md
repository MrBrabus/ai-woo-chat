# Token Usage - Kako Funkcioniše u Produkciji

## ✅ Da, Token Usage će biti Realan u Produkciji

### Kako se Token Usage Čuva

1. **OpenAI Streaming Response**
   - OpenAI šalje `usage` objekat u **finalnom chunk-u** streaming response-a
   - `usage` objekat sadrži:
     - `prompt_tokens` - broj tokena u prompt-u
     - `completion_tokens` - broj tokena u odgovoru
     - `total_tokens` - ukupan broj tokena

2. **Čitanje iz Stream-a**
   ```typescript
   // src/lib/chat/message-handler.ts (linija 388-391)
   if (chunk.usage) {
     promptTokens = chunk.usage.prompt_tokens || 0;
     completionTokens = chunk.usage.completion_tokens || 0;
     totalTokens = chunk.usage.total_tokens || 0;
   }
   ```

3. **Čuvanje u Bazi**
   ```typescript
   // src/lib/chat/message-handler.ts (linija 507-513)
   token_usage: tokenUsage
     ? {
         prompt_tokens: tokenUsage.promptTokens,
         completion_tokens: tokenUsage.completionTokens,
         total_tokens: tokenUsage.totalTokens,
       }
     : null,
   ```

4. **Poziv iz API Route**
   ```typescript
   // src/app/api/chat/message/route.ts (linija 152-161)
   saveMessage(
     site_id,
     conversation_id,
     'assistant',
     fullResponse,
     { evidence },
     tokenUsage,  // ← Realni podaci iz OpenAI
     'gpt-4o',
     evidence
   );
   ```

## 📊 Test Podaci vs Realni Podaci

### Test Podaci (SQL Skripta)
```sql
'{"prompt_tokens": 160, "completion_tokens": 70, "total_tokens": 230}'::jsonb
```
- Ovo su **samo primer vrednosti** za testiranje UI-a
- Koriste se samo kada ručno dodajete test konverzacije

### Realni Podaci (Produkcija)
- Token usage se **automatski čita** iz OpenAI streaming response-a
- Vrednosti zavise od:
  - Dužine prompt-a (uključujući RAG context)
  - Dužine AI odgovora
  - Modela koji se koristi (`gpt-4o`)

## 🔍 Primer Realnih Vrednosti

### Kratka Poruka
```
User: "Do you have headphones?"
Assistant: "Yes, we have several wireless headphones available..."

Token Usage:
  Prompt: ~150-200 tokens (system prompt + RAG context + user message)
  Completion: ~50-100 tokens (AI odgovor)
  Total: ~200-300 tokens
```

### Duga Poruka sa RAG Context-om
```
User: "Tell me about your return policy and shipping options"
Assistant: [Dugačak odgovor sa detaljima o return policy i shipping]

Token Usage:
  Prompt: ~500-800 tokens (system prompt + RAG context sa policy/shipping info + user message)
  Completion: ~200-400 tokens (detaljan AI odgovor)
  Total: ~700-1200 tokens
```

## ⚠️ Edge Cases

### 1. Stream Prekine Pre Završetka
- Ako stream prekine pre nego što OpenAI pošalje finalni chunk sa `usage`
- Token usage može biti `null` ili `0`
- **Rešenje:** Kod već ima fallback na `0` ako `usage` nije dostupan

### 2. Abort Signal
- Ako korisnik zatvori chat widget pre završetka
- Token usage će biti ono što je OpenAI poslao do trenutka prekida
- **Rešenje:** Partial response se čuva sa dostupnim token usage-om

## ✅ Zaključak

**Token usage će biti 100% realan u produkciji** jer:
1. ✅ Čita se direktno iz OpenAI API response-a
2. ✅ Čuva se u bazi kada se poruka snimi
3. ✅ Prikazuje se u dashboard-u iz baze podataka

**Test podaci u SQL skripti su samo za UI testiranje** - ne utiču na produkciju.

---

**Kreirano:** 2024-01-20  
**Status:** ✅ Potvrđeno - Realni podaci u produkciji
