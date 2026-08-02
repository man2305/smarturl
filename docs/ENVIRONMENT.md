# Environment Variables

## Backend (`backend/.env`)

Copy from `backend/.env.example` for local development, or `backend/.env.production.example` for production (see [docs/DEPLOYMENT.md](./DEPLOYMENT.md)).

> **Production fail-fast:** when `NODE_ENV=production`, the app refuses to boot
> if a required variable is missing or still set to a development default
> (`localhost` origins, `dev_*` / `change_me_*` JWT secrets, the local Mongo URI).
> This is intentional — misconfiguration should fail loudly at startup, not
> silently in production.

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `5000` | API listen port |
| `BASE_URL` | `http://localhost:5000` | Public origin of the API (used to build `shortUrl`) |
| `CLIENT_URL` | `http://localhost:5173` | Frontend origin (redirect target for expired/inactive links, CORS allowlist) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/smarturl` | MongoDB connection string |
| `REDIS_URL` | *(empty → Redis disabled)* | `redis://127.0.0.1:6379`. If empty, the app degrades to DB-only lookups and per-IP first-visit queries. **Set this in production.** |
| `CACHE_TTL` | `86400` | Seconds to cache a resolved short link |
| `JWT_ACCESS_SECRET` | `dev_access_secret` | **Change in production** — signs access tokens |
| `JWT_REFRESH_SECRET` | `dev_refresh_secret` | **Change in production** — signs refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | Access-token lifetime (`jsonwebtoken` notation) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh-token lifetime |
| `JWT_ISSUER` | `smarturl` | `iss` claim |
| `JWT_AUDIENCE` | `smarturl-api` | `aud` claim |

> **Production checklist:** strong random secrets (`openssl rand -base64 48`), `NODE_ENV=production`, `REDIS_URL` set, `CLIENT_URL`/`BASE_URL` pointing at real domains, `app.set('trust proxy', 1)` already enabled so rate limiting sees real client IPs.

## Frontend (`frontend/.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | *(empty)* | Base URL for the API. Leave empty in development — Vite proxies `/api` → `http://localhost:5000`. Set to `https://api.your-domain.com` for production builds. |
