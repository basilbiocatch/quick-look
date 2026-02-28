# Quicklook

Session recording product: SDK, API server, and session viewer app. All runs on localhost for development; separate release pipeline for server and app.

## Structure

- **quicklook-sdk/** — Browser SDK (script tag). Records DOM/CSS and interactions via rrweb; sends compressed chunks to the API.
- **quicklook-server/** — Standalone Express API. Connects to QUICKLOOK_DB (MongoDB), stores sessions and chunks, runs retention job.
- **quicklook-app/** — Session viewer (React + Vite). Dark theme. Lists sessions and replays them with rrweb-player.

## Localhost dev

1. **Server** (port 3080)
   ```bash
   cd quick-look/quicklook-server
   cp .env.example .env
   # Set QUICKLOOK_DB in .env
   npm install && npm run dev
   ```

2. **App** (port 5174)
   ```bash
   cd quick-look/quicklook-app
   cp .env.example .env
   # VITE_API_BASE_URL=http://localhost:3080
   npm install && npm run dev
   ```

3. **SDK** (build for script tag)
   ```bash
   cd quick-look/quicklook-sdk
   npm install && npm run build
   ```
   Serve `dist/quicklook-sdk.js` and `dist/compress.worker.js` from any host. On a test page:
   ```html
   <script src="http://localhost:3080/quicklook-sdk.js"></script>
   <script>window.quicklook('init', 'MY_PROJECT_KEY', { apiUrl: 'http://localhost:3080' });</script>
   ```

4. **Localinteractive project** (optional) — Create project id, project key, and API key for the localinteractive user so their sessions show in the dashboard:
   ```bash
   cd quick-look/quicklook-server
   npm run seed:localinteractive
   ```
   Use the printed **project key** in the SDK (`init('localinteractive', ...)`) and in the app when filtering sessions. Optionally set the printed **API key** in server and app `.env` for read auth.

## Env

- **quicklook-server:** `QUICKLOOK_DB`, `PORT` (default 3080), optional `QUICKLOOK_API_KEY`.
- **quicklook-app:** `VITE_API_BASE_URL` (default http://localhost:3080), optional `VITE_QUICKLOOK_API_KEY`.

## Release

Separate build and deploy for quicklook-server and quicklook-app (e.g. own App Engine services or Docker). No shared pipeline with nobex-interactive.
