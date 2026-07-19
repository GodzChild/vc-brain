# Deploying Profound (VC Brain)

**Architecture:** frontend (static React build) on **Cloudflare Pages** → backend (FastAPI in Docker) on **Render**. The frontend calls the backend directly over CORS.

All the config below is already in the repo. What's left is the account/auth steps, which only you can do (I can't log into your GitHub/Render/Cloudflare).

---

## 0. Commit & push the deploy config

These files were added: `Dockerfile`, `.dockerignore`, `render.yaml`, `.gitignore`, `frontend/src/vite-env.d.ts`, and the `VITE_API_BASE` change in `frontend/src/services/api.ts`.

```bash
git add Dockerfile .dockerignore render.yaml .gitignore DEPLOY.md \
        frontend/src/vite-env.d.ts frontend/src/services/api.ts
git commit -m "Add Render + Cloudflare Pages deploy config"
git push
```

> ⚠️ Do **not** `git add -A` blindly — your `.venv/` is already tracked in this repo (see cleanup note at the bottom). Add files explicitly as above. Your API keys live in `backend/.env`, which is gitignored and will not be pushed.

---

## 1. Backend → Render

1. Render dashboard → **New → Blueprint** → connect the GitHub repo `Bibekipynb/VC_Brain`. It reads `render.yaml` and proposes a Docker web service named `vc-brain-api`.
2. When prompted, set the secret env vars (these are `sync: false` in the blueprint, so Render asks for them):
   - `OPENAI_API_KEY` = your key
   - `TAVILY_API_KEY` = your key
   - `CORS_ORIGINS` = leave blank for now (set in step 3 once you know the Pages URL)
3. Deploy. First build takes a few minutes (Docker image). When live you get a URL like `https://vc-brain-api.onrender.com`.
4. Sanity check: open `https://vc-brain-api.onrender.com/api/health` → should return `{"status":"ok",...}`.

**Free-tier caveat:** the instance sleeps after ~15 min idle, so the first request after a nap cold-starts (~30–60s) — on top of the ~100s a live query already takes. For a month-long judged demo, consider the paid "Starter" instance to keep it warm, or pre-warm it before showing.

---

## 2. Frontend → Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git** → pick the same repo.
2. Build settings:
   - **Framework preset:** Vite
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. **Environment variables** (Production): add
   - `VITE_API_BASE` = your Render URL from step 1 (e.g. `https://vc-brain-api.onrender.com`) — no trailing slash.
4. Deploy → you get a stable URL like `https://vc-brain.pages.dev`.

---

## 3. Wire CORS and verify

1. Back in Render → `vc-brain-api` → Environment → set `CORS_ORIGINS` = your Pages URL (e.g. `https://vc-brain.pages.dev`). Save → it redeploys.
2. Open the Pages URL, run a query, and confirm results load. If the browser console shows a CORS error, double-check `CORS_ORIGINS` exactly matches the Pages origin (scheme + host, no path, no trailing slash).

To change the frontend's backend URL later, update `VITE_API_BASE` in Pages and re-deploy (it's baked in at build time).

---

## Notes / recommendations

- **Rate limiting:** `/api/query` is public and each call spends OpenAI + Tavily quota. Even on free keys, a scraped URL can exhaust it over a month. Consider adding a simple per-IP rate limit or a shared secret header before the demo goes wide.
- **Ephemeral storage:** Render's filesystem resets on each deploy/restart, so founders crawled at runtime (`backend/data/live/founders.json`) and the Chroma store don't persist. The committed seed data reloads on every boot — fine for a demo, but not a durable DB.
- **Repo cleanup (recommended):** the whole `.venv/` and runtime `backend/data/chroma/` are committed, bloating the repo. To untrack them going forward (kept locally, removed from git):
  ```bash
  git rm -r --cached .venv backend/data/chroma
  git commit -m "Stop tracking .venv and runtime chroma data"
  git push
  ```
  `.gitignore` already lists them, so they won't be re-added.
