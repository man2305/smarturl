# API Reference

Base URL: `http://localhost:5000` (development). All JSON bodies use UTF-8.

## Response envelope

Every response (except the redirect and health endpoints) uses a consistent shape:

```json
{
  "success": true,
  "message": "Optional human-readable message",
  "data": { },
  "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 }
}
```

Errors:

```json
{
  "success": false,
  "message": "Short link not found",
  "errors": [ { "field": "expiresAt", "message": "Expiry must be a valid date" } ]
}
```

| Code | Meaning |
|---|---|
| 200 / 201 | Success |
| 400 | Validation error (`errors[]` explains which fields) |
| 401 | Missing/invalid credentials or access token |
| 403 | Forbidden (resource owned by another user) |
| 404 | Resource not found |
| 409 | Conflict (e.g. alias already taken) |
| 429 | Rate limit exceeded |
| 500 | Internal error |

---

## Health

### `GET /api/health`

Public. Used by load balancers / uptime checks.

```json
{ "status": "ok", "uptime": 31.8, "timestamp": "2026-08-02T18:30:52.416Z" }
```

---

## Auth

Rate-limited (strict) on `register` and `login`.

### `POST /api/auth/register`

```json
{ "name": "Jane Doe", "email": "jane@example.com", "password": "StrongPass123!" }
```

Returns the user (sans hash) and an access token; also sets the `smarturl_refresh` httpOnly cookie.

### `POST /api/auth/login`

```json
{ "email": "jane@example.com", "password": "StrongPass123!" }
```

Returns the user + access token; sets the refresh cookie.

### `POST /api/auth/refresh`

No body — reads the `smarturl_refresh` cookie. Rotates the refresh token and returns a new access token. Use this to transparently recover from an expired access token.

### `POST /api/auth/logout`

No body — clears the refresh cookie and revokes the current refresh token.

### `GET /api/auth/me`

Protected. Returns the authenticated user.

---

## URLs

All endpoints below are protected — send `Authorization: Bearer <accessToken>`.

### `GET /api/urls`

List the caller's links.

Query params:

| Param | Default | Description |
|---|---|---|
| `page` | `1` | 1-based page number |
| `limit` | `10` | Items per page (max 100) |
| `search` | — | Case-insensitive match on `originalUrl` / `shortCode` |
| `status` | `all` | `all` \| `active` \| `expired` |
| `sortBy` | `createdAt` | `createdAt` \| `updatedAt` \| `clicks` \| `uniqueVisitors` |
| `sortOrder` | `desc` | `asc` \| `desc` |

Response: `data` is an array of `ShortUrl`, `meta` carries pagination.

### `POST /api/urls`

Create a short link (rate-limited).

```json
{
  "originalUrl": "https://example.com/very/long/path",
  "customAlias": "my-link",
  "expiresAt": "2027-01-01T00:00:00Z",
  "maxClicks": 1000
}
```

| Field | Required | Rules |
|---|---|---|
| `originalUrl` | yes | valid `http`/`https` URL |
| `customAlias` | no | 3–32 chars, `[a-zA-Z0-9_-]`; 409 if taken |
| `expiresAt` | no | ISO-8601, must be in the future |
| `maxClicks` | no | integer 1–1,000,000 |

Without `customAlias` a random 7-char Base62 code is generated (collision-safe with up to 5 retries).

### `GET /api/urls/:id`

Get one link (with click counters).

### `PATCH /api/urls/:id`

Update any subset of `originalUrl`, `customAlias`, `expiresAt`, `maxClicks`, `isActive`. Pass `null` for `expiresAt`/`maxClicks` to clear them.

### `DELETE /api/urls/:id`

Delete a link and its analytics rows.

### `ShortUrl` object

```json
{
  "id": "6a6f8d287409fe95ea72d3b2",
  "originalUrl": "https://example.com/path",
  "shortCode": "my-link",
  "shortUrl": "http://localhost:5000/my-link",
  "isCustom": true,
  "clicks": 12,
  "uniqueVisitors": 9,
  "isActive": true,
  "expiresAt": null,
  "maxClicks": null,
  "createdAt": "2026-08-02T18:32:08.801Z",
  "updatedAt": "2026-08-02T18:32:08.801Z"
}
```

---

## Analytics

Protected.

### `GET /api/analytics/overview`

Dashboard aggregate for the current user:

```json
{
  "overview": { "totalClicks": 3, "totalUniqueVisitors": 2, "totalLinks": 2, "activeLinks": 2 },
  "topLinks": [ "ShortUrl", "..." ],
  "daily": [ { "date": "2026-08-02", "clicks": 3 } ],
  "browsers": [ { "name": "Chrome", "value": 2 } ],
  "devices": [ { "name": "desktop", "value": 3 } ],
  "os": [ { "name": "Windows", "value": 3 } ],
  "countries": [ { "name": "India" } ],
  "recentActivity": [ { "shortCode": "my-link", "originalUrl": "...", "browser": "Chrome", "os": "Windows", "country": "India", "device": "desktop", "clickedAt": "..." } ]
}
```

### `GET /api/analytics/urls/:id?days=30`

Per-link analytics for the last `days` (1–365, default 30):

```json
{
  "url": { "ShortUrl" },
  "totalClicks": 12,
  "daily": [ { "date": "2026-08-02", "clicks": 2 } ],
  "browsers": [ { "name": "Chrome", "value": 7 } ],
  "devices": [ { "name": "mobile", "value": 5 } ],
  "os": [ { "name": "Android", "value": 4 } ],
  "countries": [ { "name": "United States" } ],
  "referrers": [ { "name": "https://example.com" } ]
}
```

Only the owning user can read a link's analytics (403 otherwise).

---

## Redirect (public)

### `GET /:shortCode`

Public, unauthenticated, **no-store**. Resolves the code and:

- **200-series reality:** issues a `302 Found` to the destination URL.
- **Expired link:** `302` → `${CLIENT_URL}/link-unavailable?reason=expired`.
- **Inactive link:** `302` → `${CLIENT_URL}/link-unavailable?reason=inactive`.
- **Unknown code:** `404` JSON (negative-cached to protect the DB).
