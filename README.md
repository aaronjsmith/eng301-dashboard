# Student Outcomes Dashboard

React + TypeScript dashboard for ENG 301 student outcomes metrics. Built with Vite and deployable as a Cloudflare Worker with static assets.

## Development

```bash
npm install
npm run dev
```

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

This builds the SPA and deploys it via Wrangler. SPA routing is configured with `assets.not_found_handling: "single-page-application"` in `wrangler.jsonc`.

To add a Worker API later, set `"main"` in `wrangler.jsonc` to a Worker entry (for example `./worker/index.ts`) and use the assets binding as needed.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Vite dev server (Cloudflare plugin) |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview production build |
| `npm run deploy` | Build and deploy to Cloudflare Workers |
| `npm run lint` | Oxlint |
