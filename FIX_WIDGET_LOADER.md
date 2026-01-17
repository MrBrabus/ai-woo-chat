# Fix Widget Loader - ERR_BLOCKED_BY_ORB

## Problem
Widget loader se ne učitava zbog `ERR_BLOCKED_BY_ORB` (Cross-Origin Read Blocking) greške.

## Rešenja primenjena

### 1. CORS Headers
Dodati su potpuni CORS headeri u API endpoint:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`
- `Cross-Origin-Resource-Policy: cross-origin`

### 2. Content-Type
Promenjen sa `text/javascript` na `application/javascript` (browseri preferiraju ovaj format).

### 3. OPTIONS Handler
Dodat OPTIONS handler za preflight zahteve.

### 4. Widget Loader Implementation
WordPress plugin sada dinamički kreira script tag sa `crossOrigin = 'anonymous'` atributom i koristi fetch API za učitavanje widget-a.

## Provera

1. **Restartujte Next.js dev server**:
   ```bash
   npm run dev
   ```

2. **Upload-ujte ažurirani WordPress plugin fajl**:
   - `wp-plugin/includes/class-ai-woo-chat-frontend.php`

3. **Proverite endpoint direktno u browseru**:
   ```
   https://your-saas-url.com/api/widget/loader.js
   ```
   Trebalo bi da vidite JavaScript kod, ne HTML.

4. **Proverite u WordPress browser Console**:
   - Ne bi trebalo da bude `ERR_BLOCKED_BY_ORB` greške
   - Trebalo bi da vidite: "AI Woo Chat: Widget loader loaded successfully"

## Ako i dalje ne radi

### Opcija 1: Proverite Network tab
U browser Developer Tools → Network tab:
- Kliknite na `loader.js` zahtev
- Proverite Response Headers - trebalo bi da vidite `Content-Type: application/javascript`
- Proverite da li je status 200 OK

### Opcija 2: Testirajte direktno
Otvorite u novom tabu:
```
https://your-saas-url.com/api/widget/loader.js
```
Ako vidite JavaScript kod, endpoint radi. Problem je verovatno u CORS-u.

## Alternativno rešenje

Ako i dalje ne radi, možemo da koristimo inline script umesto eksternog loader-a. Javite ako treba da implementiramo ovo.
