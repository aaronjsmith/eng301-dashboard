# ENG 301 Student Outcomes Dashboard

React + TypeScript SPA (Vite) for Ensign College ENG 201 core competency throughput. Deployable as a Cloudflare Worker with static assets.

## Local development

```bash
npm install
npm run dev
```

Or use the platform launchers: `win_run.bat`, `mac_run.command`, `linux_run.sh`.

## Build

```bash
npm run build
npm run preview
```

## Deploy to Cloudflare Workers

Requires a Cloudflare account and Wrangler auth (`npx wrangler login`).

```bash
npm run deploy
```

This builds the SPA and deploys it via Wrangler. SPA routing uses `assets.not_found_handling: "single-page-application"` in `wrangler.jsonc`.

To add a Worker API later, set `"main"` in `wrangler.jsonc` to a Worker entry (for example `./worker/index.ts`).

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server (Cloudflare plugin) |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run deploy` | Build and deploy to Cloudflare Workers |
| `npm run cf-typegen` | Generate Worker types from Wrangler |
| `npm run lint` | Oxlint |
