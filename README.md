# 2πClock · Living Celestial Clock & Astronomical Observatory

> High-precision diurnal radian clock, atmospheric telemetry, solar/lunar ephemeris, and global temporal synchronization engine.

## Stack

- Angular 22 with server-side rendering and hydration
- Cloudflare Workers for edge SSR, API routes, redirects and SEO endpoints
- Cloudflare Workers Assets for browser bundles and the generated location catalogue
- Bun 1.4.2 and Node.js 24 for builds

## Cloudflare architecture

2πClock runs as one Cloudflare Worker. Angular's platform-neutral SSR engine renders application routes at the edge. The Worker handles `/api/v1/*`, canonical redirects and `robots.txt`; static browser assets are served through the Worker's `ASSETS` binding.

The location catalogue is generated during the build and shipped as a static asset. The API implementation is shared from `src/server/api.ts` so there is one production API implementation.

There is no Vercel runtime, Express request server, or Pages Functions deployment in the production request path.

## Deploy

Connect this repository to **Cloudflare Workers Builds** (not the legacy Pages build flow).

- Production branch: `main`
- Build command: `bun run build`
- Deploy command: `bunx wrangler deploy`
- Build environment: Node.js 24 and Bun 1.4.2
- Wrangler entry point: `dist/server/server.mjs`
- Static assets: `dist/browser`

## Local development

```bash
bun install
bun run dev
```

## Local Cloudflare runtime preview

```bash
bun run preview:cloudflare
```

## Manual deployment

```bash
bun run deploy:cloudflare
```
