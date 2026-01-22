# Analiza i Poboljšanja Chat Sistema - Uvid u Sajt

## Pregled Trenutnog Stanja

### ✅ Šta Radi Dobro

1. **RAG Pipeline**
   - Koristi embeddings za pronalaženje relevantnih proizvoda/stranica
   - Similarity search sa threshold-om 0.7
   - Live data verification za proizvode (cena, stock status)
   - Chunking sa overlap-om za bolji kontekst

2. **Ingestion Proces**
   - Automatski webhook-ovi za product/page updates
   - Content hash deduplication
   - Batch processing za efikasnost
   - Versioning za embeddings

3. **Product Data**
   - Koristi title, summary, categories, tags, brand, attributes
   - Live data verification (price, stock, variations)
   - Product recommendations u chat-u

### ❌ Kritični Propusti

## 1. Site Context se Ne Koristi

**Problem**: Site context (contact info, working hours, policies, shop info) se nikad ne dohvata i ne koristi u chat-u.

**Šta nedostaje**:
- Contact email/phone
- Working hours
- Support emails
- Policy URLs (shipping, returns, terms, privacy)
- Shop info (currency, timezone)

**Impact**: Chat ne može da odgovori na pitanja tipa:
- "Kada radite?"
- "Kako mogu da vas kontaktiraju?"
- "Koja je vaša politika povrata?"
- "Koja je valuta?"

**Rešenje**: 
- Dohvatiti site context pri inicijalizaciji sajta ili čuvati u bazi
- Dodati site context u system prompt
- Ažurirati site context kada se promeni (webhook ili periodic sync)

## 2. Varijacije Proizvoda se Ne Koriste u Embeddings

**Problem**: Varijacije proizvoda (npr. različite boje, veličine) se ne uključuju u product text za embedding.

**Trenutno**: `buildProductText` koristi samo `variation_attributes` (lista atributa), ali ne konkretne varijacije.

**Šta nedostaje**:
- Konkretne varijacije sa njihovim atributima
- Cene varijacija
- Stock status varijacija

**Impact**: Chat ne može da prepozna specifične varijacije proizvoda.

**Rešenje**: 
- Dodati varijacije u `buildProductText` funkciju
- Format: "Variations: Black/Size M ($99.99, in stock), White/Size L ($109.99, in stock)"

## 3. Availability/Location Data se Ne Koristi

**Problem**: Endpoint `/product/{id}/availability` postoji u API contract-u, ali se nikad ne poziva.

**Šta nedostaje**:
- Pickup locations
- Inventory per location
- Store hours per location

**Impact**: Chat ne može da odgovori na pitanja tipa:
- "Gde mogu da pokupim ovaj proizvod?"
- "Da li imate ovaj proizvod u [lokaciji]?"

**Rešenje**: 
- Dodati poziv `getProductAvailability` u WordPress client
- Koristiti availability data u live verification
- Dodati availability info u product recommendations

## 4. Policy Stranice se Ne Procesiraju Optimalno

**Problem**: Policy stranice se detektuju i šalju webhook-ovi, ali:
- Ne koriste se eksplicitno u system prompt-u
- Ne dodaju se automatski u context za policy pitanja

**Šta nedostaje**:
- Eksplicitno referisanje policy stranica u system prompt-u
- Automatsko uključivanje policy context-a za relevantna pitanja

**Rešenje**: 
- Dodati policy URLs u site context
- Dodati policy info u system prompt
- Povećati prioritet policy chunks za policy pitanja

## 5. Product Images se Ne Koriste

**Problem**: Product images se čuvaju u metadata, ali se ne koriste u chat-u.

**Šta nedostaje**:
- Slike proizvoda u product recommendations
- Visual context za AI (ako koristi vision model)

**Rešenje**: 
- Dodati image URLs u product recommendations
- Razmotriti korišćenje vision model-a za image analysis

## 6. FAQ Content se Ne Koristi

**Problem**: FAQ content se ne procesira eksplicitno.

**Šta nedostaje**:
- FAQ stranice se tretiraju kao obične stranice
- Nema eksplicitne FAQ kategorije

**Rešenje**: 
- Dodati FAQ kao poseban entity type
- Kreirati FAQ-specific embeddings
- Dodati FAQ u system prompt

## 7. Order Status se Ne Koristi u Chat-u

**Problem**: Endpoint `/order/status` postoji, ali se ne koristi u chat-u.

**Šta nedostaje**:
- Chat ne može da proveri status narudžbe
- Nema integracije sa order tracking

**Rešenje**: 
- Dodati order status check u chat message handler
- Detektovati pitanja o narudžbama
- Pozvati order status endpoint kada je relevantno

## Predložena Poboljšanja

### Prioritet 1: Site Context Integration

```typescript
// 1. Dohvatiti site context pri aktivaciji sajta
// 2. Čuvati u sites tabeli ili settings
// 3. Koristiti u system prompt-u

const siteContext = await wpClient.getSiteContext();
const systemPrompt = buildSystemPromptWithContext(
  ragResult.prompts.systemPrompt,
  siteContext
);
```

### Prioritet 2: Poboljšati Product Embeddings

```typescript
// Dodati varijacije u product text
export function buildProductText(product: ProductCard): string {
  // ... existing code ...
  
  // Add variations
  if (product.variations && product.variations.length > 0) {
    const variationTexts = product.variations.map(v => 
      `${v.attributes}: ${v.price} (${v.stock_status})`
    );
    parts.push(`Variations: ${variationTexts.join(', ')}`);
  }
  
  return parts.join('\n');
}
```

### Prioritet 3: Dodati Availability Data

```typescript
// Koristiti availability data u live verification
const availability = await wpClient.getProductAvailability(productId);
if (availability.locations.length > 0) {
  // Dodati availability info u product recommendation
}
```

### Prioritet 4: Poboljšati System Prompt

```typescript
const SYSTEM_PROMPT_TEMPLATE = `You are a helpful AI assistant for {site_name}.

Store Information:
- Contact: {contact_email}, {contact_phone}
- Working Hours: {working_hours}
- Currency: {currency}
- Policies: Shipping ({shipping_url}), Returns ({returns_url}), Terms ({terms_url})

{rag_context}

Guidelines:
- Use store information when answering questions
- Reference policy pages for policy questions
- Include contact info when relevant
...`;
```

## Implementacioni Plan

### Faza 1: Site Context (Kritično)
1. ✅ Kreirati ingestion za site context pri aktivaciji
2. ✅ Čuvati site context u sites tabeli ili settings
3. ✅ Dodati site context u system prompt
4. ✅ Ažurirati site context kada se promeni

### Faza 2: Product Improvements
1. ✅ Dodati varijacije u product embeddings
2. ✅ Dodati availability data u live verification
3. ✅ Dodati images u product recommendations

### Faza 3: Policy & FAQ
1. ✅ Eksplicitno koristiti policy stranice u system prompt-u
2. ✅ Dodati FAQ kao poseban entity type
3. ✅ Poboljšati policy detection

### Faza 4: Order Status
1. ✅ Detektovati pitanja o narudžbama
2. ✅ Integrisati order status check
3. ✅ Dodati order tracking u chat

## Metrike za Praćenje

- **Site Context Usage**: Koliko puta se site context koristi u odgovorima
- **Variation Recognition**: Koliko puta se varijacije prepoznaju
- **Availability Queries**: Koliko pitanja o availability-u
- **Policy References**: Koliko puta se reference policy stranice
- **Order Status Checks**: Koliko puta se proverava order status

## Zaključak

Glavni problem je što **site context se ne koristi**, što značajno ograničava chat-ovu sposobnost da odgovori na osnovna pitanja o sajtu. Takođe, varijacije proizvoda i availability data se ne koriste optimalno.

Prioritet je integracija site context-a u system prompt, što će značajno poboljšati chat-ovu sposobnost da odgovori na pitanja o sajtu.
