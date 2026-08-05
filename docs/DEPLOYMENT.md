# Deployment (free tier)

Zero-cost production stack — no credit card required:

| Layer | Service | Free plan | Notes |
|---|---|---|---|
| Frontend (Vite SPA) | **Vercel** | Free | Static hosting, automatic TLS, SPA rewrite |
| API (Node/Express) | **Render** | Free web service (Docker) | Sleeps after 15 min idle, cold-starts on next hit |
| Database | **MongoDB Atlas** | M0 | 512 MB storage, shared |
| Cache | **Upstash Redis** | Free | ~10k commands/day — fine for a demo |
| CI | **GitHub Actions** | Free | Typecheck + build + Docker build |

```
Vercel (https://smarturl-frontend.vercel.app)
   │  axios → https://smarturl-api.onrender.com/api/*   (VITE_API_URL)
   ▼
Render API (Docker image from backend/Dockerfile)
   │  MONGODB_URI (Atlas)   │  REDIS_URL (Upstash)
   ▼                        ▼
 MongoDB Atlas M0          Upstash Redis
```

Short links are built from `BASE_URL`, so they look like
`https://smarturl-api.onrender.com/<code>` (works without a domain).
If you add a domain later, point a subdomain (e.g. `s.yourdomain.com`) at the
Render service and set `BASE_URL` to it.

---

## 1. Push the repo to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
gh repo create smarturl --public --push   # or create it on github.com and push
```

Pushing starts the CI workflow (`.github/workflows/ci.yml`). It must be green
before you deploy — it validates that the Dockerfile builds.

## 2. MongoDB Atlas (M0 free)

1. Sign up at https://www.mongodb.com/cloud/atlas → create a **Free (M0)** cluster.
2. **Database Access** → add a user (e.g. `smarturl`) with a strong password.
3. **Network Access** → add `0.0.0.0/0` (public) — the render.com IPs vary.
4. **Connect → Drivers** → copy the `mongodb+srv://...` string.

## 3. Upstash Redis (free)

1. Sign up at https://console.upstash.com → **Create Database** (free).
2. Copy the `rediss://<token>@<endpoint>:6379` URL.
   (`rediss://` is TLS; if it isn't available, `redis://` works but is plaintext.)

## 4. API on Render (free Docker web service)

Easiest path — **Blueprint**:

1. Render Dashboard → **New → Blueprint** → select this repo.
2. Render reads `render.yaml` at the repo root. It will create `smarturl-api`
   (Docker, free) and pause for the manual env vars.
3. Set the manual vars (`sync: false`) in the service's **Environment** tab:

   | Key | Value |
   |---|---|
   | `BASE_URL` | `https://<your-service>.onrender.com` (shown on the service page) |
   | `CLIENT_URL` | `https://<your-frontend>.vercel.app` |
   | `MONGODB_URI` | Atlas SRV string from step 2 |
   | `REDIS_URL` | Upstash `rediss://...` from step 3 |
   | `JWT_ACCESS_SECRET` | `openssl rand -base64 48` |
   | `JWT_REFRESH_SECRET` | `openssl rand -base64 48` |

4. **Deploy**. Health check hits `/api/health` automatically
   (defined in `render.yaml`). Verify:

   ```bash
   curl https://<your-service>.onrender.com/api/health
   # {"status":"ok", ...}
   ```

> The production env validation (`backend/src/config/env.ts`) refuses to boot
> with the dev defaults (`localhost`, `dev_*`, `change_me_*`), so a
> misconfigured deploy fails loudly at startup instead of silently running
> with weak secrets.

### Manual (no blueprint) alternative

- New **Web Service** → connect repo → **Runtime: Docker** →
  **Dockerfile path**: `backend/Dockerfile`, **Context**: `backend`,
  **Health check path**: `/api/health`, **Instance type**: Free.
- Add the same env vars in the **Environment** tab.

## 5. Frontend on Vercel (free)

1. Sign up at https://vercel.com → **Add New Project** → import this repo.
2. **Root Directory**: `frontend`.
3. Framework preset: **Vite**. Build command: `npm run build`, output `dist`.
4. Environment variable (build-time): `VITE_API_URL = https://<your-service>.onrender.com/api`
   (note: the app uses this value verbatim as its API base — it must include the
   `/api` prefix, exactly like the dev `/api` proxy path).
5. Deploy → you get `https://<project>.vercel.app`.

`frontend/vercel.json` already provides the SPA rewrite (so `/dashboard`,
`/links/:id`, `/link-unavailable?...` work on refresh) plus security and
asset-caching headers.

## 6. Wire the two together

- In **Vercel**: set `VITE_API_URL` to the Render origin (step 5.4).
- In **Render**: set `CLIENT_URL` to the Vercel origin (step 4.3).

The cookie is `httpOnly`, `secure` (prod), `sameSite: none` on `/api/auth`, and
CORS allows exactly `CLIENT_URL` — this is the cross-origin setup that makes
login/refresh work across the two domains.

## 7. Verify end-to-end

1. `https://<frontend>.vercel.app` → register an account.
2. Create a link → copy `shortUrl` (`https://<api>.onrender.com/<code>`).
3. Open it in an incognito tab → it redirects; the analytics page shows a click.

---

## Free-tier gotchas

- **Render sleep/cold-start**: after 15 min idle the API sleeps; the next
  request takes a few seconds (sometimes ~30s) to wake. Fine for a demo.
- **Upstash free limits**: if your redirect cache keys expire frequently you
  can approach the daily command budget; the app degrades gracefully to
  DB-only if Redis is unavailable.
- **Ephemeral disk**: the Render free instance has no persistent disk — it
  doesn't matter here because all state lives in Atlas/Upstash.
- **Rate limits**: `RATE_LIMIT_MAX` is 100/min/IP on `/api`; lower it if you
  get 429s during demo testing.

## Production hardening checklist (all already in code)

- [x] Docker runs as a non-root user, `NODE_ENV=production`, `HEALTHCHECK` on `/api/health`
- [x] Fail-fast env validation (refuses dev defaults in production)
- [x] Graceful shutdown on SIGTERM/SIGINT
- [x] `helmet`, scoped CORS + credentials, mongo-sanitize, per-endpoint rate limiting
- [x] `httpOnly` + `secure` + `sameSite: none` refresh cookie
- [x] Redis degrades to DB-only; analytics failures never break redirects
- [x] CI gates every push (typecheck + build + Docker build)

## Manual deploy (no platform) — Docker Compose

For a single VPS, build the image and run it against managed Atlas/Upstash:

```bash
docker build -t smarturl-api backend
docker run -d --name smarturl-api -p 5000:5000 \
  --env-file backend/.env.production.example \
  --restart unless-stopped smarturl-api
```

For the frontend, serve `frontend/dist` behind any static host (or nginx with
an SPA `try_files` rule and the headers from `frontend/vercel.json`).
