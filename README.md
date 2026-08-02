# SmartURL

A production-ready, full-stack URL shortener with analytics, built as a clean-architecture monorepo.

- **Frontend:** React 18 + TypeScript + Vite 5 + Tailwind CSS, shadcn/ui-style components, TanStack Query, Recharts, dark mode, code-split pages.
- **Backend:** Node.js + Express 4 + TypeScript, layered Clean Architecture, MongoDB (Mongoose) + Redis (ioredis), JWT auth with rotating refresh tokens.

![stack](https://img.shields.io/badge/stack-React%20%2B%20Node%20%2B%20MongoDB%20%2B%20Redis-3b82f6)

---

## Features

### Core
- Shorten long URLs with auto-generated Base62 codes or custom aliases
- Optional expiration date and max-clicks click budget
- Enable/disable links, search, filter and paginate your link inventory
- QR-code download per link

### Analytics
- Click counts, unique visitors, daily trend chart
- Breakdowns by browser, device, OS, country and referrer
- Per-link stats and a recent activity feed

### Performance
- Redis **cache-aside** on the redirect hot path (`~1ms` cache hits, no DB I/O)
- **Negative caching** of unknown slugs to absorb hot 404 traffic
- Redis **sets** for O(1) unique-visitor dedup
- Fire-and-forget click recording so telemetry never blocks redirects
- Graceful degradation to DB-only lookups if Redis is unavailable
- Mongo indexes aligned to every query pattern; TTL index cleans refresh tokens

### Security
- `bcryptjs` password hashing
- JWT **access (15m)** + **refresh (7d)** tokens; refresh tokens stored **hashed** and rotated on every use
- `httpOnly` refresh-token cookie, scoped to `/api/auth`
- Rate limiting on auth and shorten endpoints; Helmet, CORS, mongo-sanitize, compression
- Private redirect-cache invalidation on every mutation

---

## Repository layout

```
.
├── backend/                 # Express REST API (Clean Architecture)
│   └── src/
│       ├── config/          # env, constants, database, redis
│       ├── controllers/     # HTTP layer
│       ├── middlewares/     # auth, validate, rate limit, error handler
│       ├── models/          # Mongoose schemas + indexes
│       ├── repositories/    # data-access layer
│       ├── routes/          # route definitions
│       ├── services/        # business logic
│       ├── utils/           # ApiError, base62, geo, device, serializers
│       └── validators/      # express-validator chains
├── frontend/                # React SPA (Vite)
│   └── src/
│       ├── api/             # axios client + endpoint modules
│       ├── components/      # ui primitives + feature components
│       ├── context/         # auth context
│       ├── hooks/           # TanStack Query hooks
│       ├── lib/             # helpers + constants
│       ├── pages/           # route-level pages
│       └── types/           # shared API contract types
└── docs/                    # architecture, API, env, deployment guides
```

---

## Quick start

### Prerequisites
- Node.js >= 18
- Docker (for local MongoDB + Redis) — or your own instances

### 1. Infrastructure (MongoDB + Redis)

```bash
docker run -d --name smarturl-mongo -p 27017:27017 mongo:7
docker run -d --name smarturl-redis -p 6379:6379 redis:7-alpine
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env   # defaults work for local Docker infra
npm run dev            # http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev            # http://localhost:5173
```

Vite proxies `/api` → `http://localhost:5000` in development, so no `VITE_API_URL` is needed locally.

Open http://localhost:5173, register an account, and shorten your first link.

---

## Scripts

| Workspace | Command | Description |
|---|---|---|
| backend | `npm run dev` | Start API with hot reload (tsx watch) |
| backend | `npm run build` | Compile TypeScript to `dist/` |
| backend | `npm run start` | Run compiled `dist/server.js` |
| backend | `npm run typecheck` | Type-check without emitting |
| frontend | `npm run dev` | Start Vite dev server |
| frontend | `npm run build` | Production build to `dist/` |
| frontend | `npm run typecheck` | Type-check without emitting |

---

## Documentation

- [Architecture](./docs/ARCHITECTURE.md) — layered design, request flows, caching, security model
- [API Reference](./docs/API.md) — every endpoint with request/response examples
- [Environment Variables](./docs/ENVIRONMENT.md) — all config for both apps
- [Deployment](./docs/DEPLOYMENT.md) — Docker, Render, Vercel, MongoDB Atlas, Upstash

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, Tailwind CSS, Radix UI, TanStack Query, Recharts, Sonner, lucide-react |
| Backend | Node.js, Express 4, TypeScript, Mongoose, ioredis, jsonwebtoken, bcryptjs, express-validator, express-rate-limit, helmet, geoip-lite, ua-parser-js |
| Data | MongoDB, Redis |
| Auth | JWT access + refresh, httpOnly cookie, hashed refresh tokens |
