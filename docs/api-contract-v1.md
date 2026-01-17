# AI Woo Chat API Contract v1.0

**Source of Truth**: This document defines the complete API contract between the WordPress plugin and the SaaS platform.

**Version**: 1.0  
**Last Updated**: 2024-01-15  
**Status**: ✅ FROZEN - Source of Truth

**Versioning Policy**: This document is frozen as the source of truth. Breaking changes require a new version (v1.1, v2.0, etc.). All implementations must conform to this contract.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Security](#authentication--security)
3. [WordPress Plugin Endpoints](#wordpress-plugin-endpoints)
4. [SaaS Platform Endpoints](#saas-platform-endpoints)
5. [Error Responses](#error-responses)
6. [Rate Limiting](#rate-limiting)

---

## Overview

### Base URLs

- **WordPress Plugin**: `{site_url}/wp-json/ai-chat/v1`
- **SaaS Platform**: `{saas_url}/api`

### General Principles

- All timestamps are in ISO 8601 format (UTC): `YYYY-MM-DDTHH:MM:SSZ`
- All monetary values use decimal representation (e.g., `129.99`)
- All UUIDs are v4 format
- Content-Type headers: `application/json` for JSON payloads
- Character encoding: UTF-8

---

## Authentication & Security

### HMAC Signing (SaaS → WP & WP → SaaS)

All requests from SaaS to WordPress and WordPress to SaaS use HMAC-SHA256 signing.

#### Required Headers

```
X-AI-Site: {site_id}
X-AI-Ts: {unix_timestamp}
X-AI-Nonce: {random_uuid}
X-AI-Sign: {base64_encoded_signature}
```

#### Signature Generation

1. **Canonical String Format**:
   ```
   {METHOD}\n{PATH}\n{TS}\n{NONCE}\n{BODY_HASH}
   ```
   - `METHOD`: HTTP method (uppercase): `GET`, `POST`, etc.
   - `PATH`: Request path including query string (e.g., `/wp-json/ai-chat/v1/product/123`)
   - `TS`: Unix timestamp (same as X-AI-Ts header)
   - `NONCE`: Random UUID (same as X-AI-Nonce header)
   - `BODY_HASH`: SHA256 hash of request body (hex lowercase). For GET requests or empty bodies, use empty string.

2. **Signing Process**:
   ```
   signature = HMAC_SHA256(canonical_string, site_secret)
   X-AI-Sign = base64_encode(signature)
   ```

3. **Validation Rules**:
   - Timestamp must be within ±5 minutes of server time
   - Nonce must be unique and not reused within 10 minutes (stored in transient/cache)
   - Signature must match computed signature
   - Site ID must exist and be active

#### Example (POST Request)

```
Method: POST
Path: /wp-json/ai-chat/v1/order/status
Body: {"order_id":"12345","billing_email":"customer@example.com","order_key":"wc_order_abc123"}
Body Hash: sha256(body) = "abc123def456..."

Canonical String:
POST
/wp-json/ai-chat/v1/order/status
1705326000
550e8400-e29b-41d4-a716-446655440000
abc123def456...

Signature = base64(hmac_sha256(canonical_string, site_secret))
```

### CORS Validation

All public SaaS endpoints (chat, bootstrap, events) must validate the `Origin` header:

- **Required**: Origin header must be present
- **Validation**: Origin must match one of the values in `site.allowed_origins` (exact match, no wildcards)
- **Never allow**: `"*"` wildcard is prohibited
- **Response**: If validation fails, return `403 Forbidden` with no CORS headers

### License Status Checks

All SaaS runtime endpoints (chat, ingestion) must verify license status:
- License status must be `active`
- If `revoked` or `expired`: return `403 Forbidden` with message indicating license issue

---

## WordPress Plugin Endpoints

All endpoints are prefixed with `/wp-json/ai-chat/v1`

### 1. GET /site/context

Returns site context information for knowledge base indexing.

**Authentication**: HMAC (required)

**Headers**: Standard HMAC headers

**Response**: `200 OK`

```json
{
  "site_url": "https://store.example.com",
  "site_name": "My WooCommerce Store",
  "contact": {
    "email": "support@example.com",
    "phone": "+1234567890"
  },
  "working_hours": "Mon-Fri 9AM-5PM EST",
  "support_emails": ["support@example.com"],
  "policies": {
    "shipping": "https://store.example.com/shipping",
    "returns": "https://store.example.com/returns",
    "terms": "https://store.example.com/terms",
    "privacy": "https://store.example.com/privacy"
  },
  "shop_info": {
    "currency": "USD",
    "currency_symbol": "$",
    "timezone": "America/New_York"
  }
}
```

**Error Responses**: See [Error Responses](#error-responses)

---

### 2. GET /products/changed

Returns a paginated list of products that have been updated after a given timestamp.

**Authentication**: HMAC (required)

**Headers**: Standard HMAC headers

**Query Parameters**:
- `updated_after` (required, ISO 8601): Only return products updated after this timestamp
- `page` (optional, integer, default: 1): Page number
- `per_page` (optional, integer, default: 50, max: 100): Items per page

**Response**: `200 OK`

```json
{
  "products": [
    {
      "id": 123,
      "updated_at": "2024-01-15T10:30:00Z"
    },
    {
      "id": 456,
      "updated_at": "2024-01-15T11:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 150,
    "total_pages": 3
  }
}
```

**Error Responses**: See [Error Responses](#error-responses)

---

### 3. POST /products/batch

Returns product card data for multiple products in a single request.

**Authentication**: HMAC (required)

**Headers**: Standard HMAC headers  
**Content-Type**: `application/json`

**Request Body**:

```json
{
  "product_ids": [123, 456, 789]
}
```

**Response**: `200 OK`

```json
{
  "products": [
    {
      "id": 123,
      "title": "Premium Wireless Headphones",
      "url": "https://store.example.com/product/premium-headphones",
      "sku": "WH-001",
      "summary": "High-quality wireless headphones with noise cancellation...",
      "attributes": {
        "color": ["Black", "White"],
        "size": ["One Size"]
      },
      "categories": ["Electronics", "Audio"],
      "tags": ["wireless", "premium", "noise-cancelling"],
      "brand": "TechBrand",
      "price_range": {
        "min": 99.99,
        "max": 149.99,
        "currency": "USD"
      },
      "stock_status": "instock",
      "shipping_class": "standard",
      "images": [
        "https://store.example.com/wp-content/uploads/headphones-1.jpg"
      ],
      "variation_attributes": ["color", "size"],
      "updated_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

**Note**: Products that don't exist are omitted from the response (no error).

**Error Responses**: See [Error Responses](#error-responses)

---

### 4. GET /product/{id}

Returns product card data for indexing (summary, not live data).

**Authentication**: HMAC (required)

**Headers**: Standard HMAC headers

**Path Parameters**:
- `id` (required, integer): Product ID

**Response**: `200 OK`

```json
{
  "id": 123,
  "title": "Premium Wireless Headphones",
  "url": "https://store.example.com/product/premium-headphones",
  "sku": "WH-001",
  "summary": "High-quality wireless headphones with noise cancellation...",
  "attributes": {
    "color": ["Black", "White"],
    "size": ["One Size"]
  },
  "categories": ["Electronics", "Audio"],
  "tags": ["wireless", "premium", "noise-cancelling"],
  "brand": "TechBrand",
  "price_range": {
    "min": 99.99,
    "max": 149.99,
    "currency": "USD"
  },
  "stock_status": "instock",
  "shipping_class": "standard",
  "images": [
    "https://store.example.com/wp-content/uploads/headphones-1.jpg"
  ],
  "variation_attributes": ["color", "size"],
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Product not found
- See [Error Responses](#error-responses)

---

### 5. GET /product/{id}/live

Returns live product data (current price, stock, variations availability).

**Authentication**: HMAC (required)

**Headers**: Standard HMAC headers

**Path Parameters**:
- `id` (required, integer): Product ID

**Response**: `200 OK`

```json
{
  "id": 123,
  "price": 129.99,
  "sale_price": null,
  "regular_price": 149.99,
  "stock_status": "instock",
  "stock_quantity": 25,
  "variations": [
    {
      "id": 456,
      "attributes": {
        "color": "Black",
        "size": "One Size"
      },
      "price": 129.99,
      "stock_status": "instock",
      "stock_quantity": 15,
      "purchasable": true
    },
    {
      "id": 457,
      "attributes": {
        "color": "White",
        "size": "One Size"
      },
      "price": 129.99,
      "stock_status": "instock",
      "stock_quantity": 10,
      "purchasable": true
    }
  ],
  "purchasable": true,
  "updated_at": "2024-01-15T14:22:00Z"
}
```

**Error Responses**:
- `404 Not Found`: Product not found
- See [Error Responses](#error-responses)

---

### 6. GET /product/{id}/availability

Returns store availability (pickup locations, inventory per location).

**Authentication**: HMAC (required)

**Headers**: Standard HMAC headers

**Path Parameters**:
- `id` (required, integer): Product ID

**Response**: `200 OK`

```json
{
  "id": 123,
  "locations": [
    {
      "location_id": "store-1",
      "name": "Downtown Store",
      "address": "123 Main St, City, State 12345",
      "available": true,
      "quantity": 5,
      "hours": "Mon-Sat 10AM-8PM"
    },
    {
      "location_id": "store-2",
      "name": "Uptown Store",
      "address": "456 Oak Ave, City, State 12345",
      "available": false,
      "quantity": 0,
      "hours": "Mon-Fri 9AM-6PM"
    }
  ]
}
```

**Note**: If no locations/availability data exists, return empty array: `{"id": 123, "locations": []}`

**Error Responses**:
- `404 Not Found`: Product not found
- See [Error Responses](#error-responses)

---

### 7. POST /order/status

Returns order status and tracking information.

**Authentication**: HMAC (required)  
**Rate Limiting**: Strict (see [Rate Limiting](#rate-limiting))

**Headers**: Standard HMAC headers  
**Content-Type**: `application/json`

**Request Body**:

```json
{
  "order_id": "12345",
  "billing_email": "customer@example.com",
  "order_key": "wc_order_abc123"
}
```

**Alternative Request Body** (if order_key not available):

```json
{
  "order_id": "12345",
  "billing_email": "customer@example.com",
  "billing_postcode": "12345"
}
```

**Validation Rules**:
- Must provide `order_id` + `billing_email` + (`order_key` OR `billing_postcode`)
- Order must match provided email and key/postcode

**Response**: `200 OK`

```json
{
  "order_id": "12345",
  "status": "processing",
  "status_label": "Processing",
  "tracking": {
    "url": "https://tracking.example.com/track/ABC123",
    "number": "ABC123",
    "carrier": "UPS"
  },
  "last_update": "2024-01-15T12:00:00Z",
  "eta": "2024-01-20",
  "items": [
    {
      "name": "Premium Wireless Headphones",
      "quantity": 2
    }
  ]
}
```

**Response (No Tracking)**:

```json
{
  "order_id": "12345",
  "status": "processing",
  "status_label": "Processing",
  "tracking": null,
  "last_update": "2024-01-15T12:00:00Z",
  "eta": null,
  "items": [
    {
      "name": "Premium Wireless Headphones",
      "quantity": 2
    }
  ]
}
```

**Error Responses**:
- `400 Bad Request`: Missing required fields or invalid combination
- `404 Not Found`: Order not found
- `403 Forbidden`: Order doesn't match provided credentials
- `429 Too Many Requests`: Rate limit exceeded (see [Rate Limiting](#rate-limiting))
- See [Error Responses](#error-responses)

---

## SaaS Platform Endpoints

All endpoints are prefixed with `/api`

### 1. POST /license/activate

Activates a license and pairs a WordPress site with the SaaS platform.

**Authentication**: None (public endpoint)  
**Rate Limiting**: Recommended (see [Rate Limiting](#rate-limiting))

**Content-Type**: `application/json`

**Request Body**:

```json
{
  "license_key": "abc123-def456-ghi789",
  "site_url": "https://store.example.com",
  "site_name": "My WooCommerce Store"
}
```

**Response**: `200 OK`

```json
{
  "site_id": "550e8400-e29b-41d4-a716-446655440000",
  "site_secret": "sec_abc123def456ghi789...",
  "status": "active",
  "expires_at": null
}
```

**Error Responses**:
- `400 Bad Request`: Invalid license key format
- `404 Not Found`: License key not found
- `403 Forbidden`: License revoked/expired
- `409 Conflict`: License already at max sites
- `429 Too Many Requests`: Rate limit exceeded
- See [Error Responses](#error-responses)

---

### 2. POST /chat/bootstrap

Initializes a chat session and returns visitor/conversation IDs.

**Authentication**: None (public, CORS-validated)  
**CORS**: Origin must match `site.allowed_origins`

**Headers**:
- `Origin` (required): Must match one of `site.allowed_origins`

**Content-Type**: `application/json`

**Request Body**:

```json
{
  "site_id": "550e8400-e29b-41d4-a716-446655440000",
  "visitor_id": "vis_abc123" (optional),
  "conversation_id": "conv_xyz789" (optional)
}
```

**Response**: `200 OK`

```json
{
  "visitor_id": "550e8400-e29b-41d4-a716-446655440001",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440002",
  "welcome_back": false,
  "session": {
    "first_seen_at": "2024-01-10T10:00:00Z",
    "last_seen_at": "2024-01-14T10:00:00Z",
    "conversation_count": 3
  }
}
```

**Response (Returning Visitor)**:

```json
{
  "visitor_id": "550e8400-e29b-41d4-a716-446655440001",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440002",
  "welcome_back": true,
  "session": {
    "first_seen_at": "2024-01-10T10:00:00Z",
    "last_seen_at": "2024-01-14T10:00:00Z",
    "conversation_count": 3
  }
}
```

**Error Responses**:
- `400 Bad Request`: Invalid site_id
- `403 Forbidden`: License revoked/expired OR Origin not in allowed_origins
- `404 Not Found`: Site not found
- See [Error Responses](#error-responses)

---

### 3. POST /chat/message

Sends a chat message and streams the AI response via Server-Sent Events (SSE).

**Authentication**: None (public, CORS-validated)  
**CORS**: Origin must match `site.allowed_origins`

**Headers**:
- `Origin` (required): Must match one of `site.allowed_origins`
- `Accept`: `text/event-stream` (for SSE)

**Content-Type**: `application/json`

**Request Body**:

```json
{
  "site_id": "550e8400-e29b-41d4-a716-446655440000",
  "visitor_id": "550e8400-e29b-41d4-a716-446655440001",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440002",
  "message": "Do you have wireless headphones?"
}
```

**Response**: `200 OK` (SSE Stream)

**Content-Type**: `text/event-stream`

```
data: {"type":"chunk","content":"Yes, we have"}

data: {"type":"chunk","content":" several wireless"}

data: {"type":"chunk","content":" headphones available."}

data: {"type":"product","id":123,"title":"Premium Wireless Headphones","url":"https://store.example.com/product/premium-headphones","price":129.99,"stock_status":"instock"}

data: {"type":"product","id":456,"title":"Budget Wireless Earbuds","url":"https://store.example.com/product/budget-earbuds","price":49.99,"stock_status":"instock"}

data: {"type":"done"}

```

**SSE Event Types**:
- `chunk`: Text chunk of the response
- `product`: Product recommendation (includes id, title, url, price, stock_status)
- `done`: Stream complete

**Error Responses**:
- `400 Bad Request`: Invalid request body
- `403 Forbidden`: License revoked/expired OR Origin not in allowed_origins
- `404 Not Found`: Site, visitor, or conversation not found
- `500 Internal Server Error`: AI service error
- See [Error Responses](#error-responses)

---

### 4. POST /chat/events

Records user events (view, click, add_to_cart).

**Authentication**: None (public, CORS-validated)  
**CORS**: Origin must match `site.allowed_origins`

**Headers**:
- `Origin` (required): Must match one of `site.allowed_origins`

**Content-Type**: `application/json`

**Request Body**:

```json
{
  "site_id": "550e8400-e29b-41d4-a716-446655440000",
  "visitor_id": "550e8400-e29b-41d4-a716-446655440001",
  "conversation_id": "550e8400-e29b-41d4-a716-446655440002",
  "type": "view",
  "payload": {
    "product_id": 123,
    "url": "https://store.example.com/product/premium-headphones"
  }
}
```

**Event Types**:
- `view`: Product page viewed
- `click`: Link clicked
- `add_to_cart`: Product added to cart

**Response**: `200 OK`

```json
{
  "status": "recorded"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid event type or payload
- `403 Forbidden`: License revoked/expired OR Origin not in allowed_origins
- `404 Not Found`: Site, visitor, or conversation not found
- See [Error Responses](#error-responses)

---

### 5. POST /ingestion/webhook

Receives webhook notifications from WordPress about content changes.

**Authentication**: HMAC (required, from WordPress)

**Headers**: Standard HMAC headers (see [HMAC Signing](#hmac-signing-saas--wp--wp--saas))

**Content-Type**: `application/json`

**Request Body**:

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event": "product.updated",
  "entity_type": "product",
  "entity_id": "123",
  "occurred_at": "2024-01-15T10:30:00Z"
}
```

**Event Types**:
- `product.updated`: Product created or updated
- `product.deleted`: Product deleted
- `page.updated`: Page created or updated
- `page.deleted`: Page deleted
- `policy.updated`: Policy/setting page updated

**Idempotency**:
- `event_id` must be unique (UUID)
- Duplicate `event_id` values are rejected (no processing, returns success)
- Store `event_id` in `ingestion_events` table for deduplication

**Response**: `200 OK`

```json
{
  "status": "processed",
  "event_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response (Duplicate Event)**:

```json
{
  "status": "duplicate",
  "event_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid event type or missing required fields
- `403 Forbidden`: Invalid HMAC signature
- `404 Not Found`: Site not found
- `409 Conflict`: Event processing conflict
- See [Error Responses](#error-responses)

---

## Error Responses

All error responses follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} (optional, additional context)
  }
}
```

### HTTP Status Codes

- `200 OK`: Success
- `400 Bad Request`: Invalid request parameters or body
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Valid authentication but insufficient permissions (license revoked, CORS failure, etc.)
- `404 Not Found`: Resource not found
- `409 Conflict`: Conflict with current state (duplicate, already exists, etc.)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Service temporarily unavailable

### Common Error Codes

#### Authentication Errors

- `INVALID_SIGNATURE`: HMAC signature validation failed
- `INVALID_TIMESTAMP`: Timestamp outside ±5 minute window
- `NONCE_REUSED`: Nonce has been used before (replay attack)
- `SITE_NOT_FOUND`: Site ID not found or inactive
- `LICENSE_REVOKED`: License has been revoked
- `LICENSE_EXPIRED`: License has expired

#### Validation Errors

- `MISSING_REQUIRED_FIELD`: Required field missing
- `INVALID_FORMAT`: Field format invalid
- `INVALID_ORIGIN`: Origin not in allowed_origins
- `ORDER_MISMATCH`: Order credentials don't match

#### Resource Errors

- `PRODUCT_NOT_FOUND`: Product not found
- `ORDER_NOT_FOUND`: Order not found
- `CONVERSATION_NOT_FOUND`: Conversation not found

#### Rate Limiting

- `RATE_LIMIT_EXCEEDED`: Too many requests in time window

### Example Error Responses

**403 Forbidden (Invalid Signature)**:

```json
{
  "error": {
    "code": "INVALID_SIGNATURE",
    "message": "HMAC signature validation failed"
  }
}
```

**400 Bad Request (Missing Field)**:

```json
{
  "error": {
    "code": "MISSING_REQUIRED_FIELD",
    "message": "Required field 'billing_email' is missing",
    "details": {
      "field": "billing_email"
    }
  }
}
```

**403 Forbidden (CORS)**:

```json
{
  "error": {
    "code": "INVALID_ORIGIN",
    "message": "Origin not allowed. Contact support to add your domain."
  }
}
```

**403 Forbidden (License Revoked)**:

```json
{
  "error": {
    "code": "LICENSE_REVOKED",
    "message": "License has been revoked. Please contact support."
  }
}
```

---

## Rate Limiting

Rate limiting recommendations (implementation-specific):

### POST /license/activate

- **Recommended**: 5 requests per hour per IP address
- **Response**: `429 Too Many Requests` with `Retry-After` header

### POST /order/status (WordPress)

- **Recommended**: 10 requests per minute per IP address
- **Stricter**: Consider 5 requests per minute for enhanced security
- **Response**: `429 Too Many Requests` with `Retry-After` header

### POST /chat/message

- **Recommended**: 60 requests per minute per visitor_id
- **Response**: `429 Too Many Requests` with `Retry-After` header

### POST /chat/events

- **Recommended**: 100 requests per minute per visitor_id
- **Response**: `429 Too Many Requests` with `Retry-After` header

### All Other Endpoints

- **Recommended**: 100 requests per minute per IP/site_id
- **Response**: `429 Too Many Requests` with `Retry-After` header

**Rate Limit Headers** (if implemented):

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705326060
Retry-After: 15
```

---

## Webhook Events

### Event Types

The WordPress plugin should emit webhooks for the following events:

1. **product.updated**: Product created or updated
2. **product.deleted**: Product deleted
3. **page.updated**: Page created or updated (includes posts, pages, policies)
4. **page.deleted**: Page deleted
5. **policy.updated**: Policy/setting page updated (shipping, returns, terms, privacy)

### Webhook Payload Format

All webhooks must include:

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event": "product.updated",
  "entity_type": "product",
  "entity_id": "123",
  "occurred_at": "2024-01-15T10:30:00Z"
}
```

- `event_id`: Unique UUID (v4) for idempotency
- `event`: Event type string
- `entity_type`: Entity type (`product`, `page`, `policy`)
- `entity_id`: Entity ID (string representation)
- `occurred_at`: ISO 8601 timestamp of when the event occurred

### Webhook Delivery

- WordPress plugin sends webhook to SaaS `/api/ingestion/webhook`
- Must include HMAC headers (see [HMAC Signing](#hmac-signing-saas--wp--wp--saas))
- SaaS validates HMAC signature
- SaaS checks `event_id` for duplicates (idempotency)
- SaaS processes event and triggers ingestion

---

## Notes

### Batch Operations

- Use `GET /products/changed` for delta ingestion (only changed products)
- Use `POST /products/batch` for bulk retrieval (avoid N+1 queries)
- Batch endpoint should handle missing products gracefully (omit from response)

### Live Data vs Indexed Data

- `GET /product/{id}`: Returns indexed/summary data (for knowledge base)
- `GET /product/{id}/live`: Returns live data (current prices, stock, variations)
- Chat runtime should use indexed data for RAG, then verify with live data for top candidates

### Order Status Security

- Always require `order_id` + `billing_email` + (`order_key` OR `billing_postcode`)
- Never rely on order_id alone
- Implement strict rate limiting
- Consider IP-based rate limiting in addition to request-based

### CORS Policy

- Never use `Access-Control-Allow-Origin: *`
- Always validate Origin against `site.allowed_origins`
- Reject requests with invalid origins (403 Forbidden)
- Include CORS headers only for valid origins

---

## Version History

- **v1.0** (2024-01-15): Initial API contract document

---

**Document Status**: ✅ FROZEN - Source of Truth  
**Versioning Policy**: Breaking changes require version bump. All implementations must conform to this contract.
