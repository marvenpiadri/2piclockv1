# 2πClock · Living Celestial Clock & Astronomical Observatory

> High-precision diurnal radian clock, atmospheric telemetry, solar/lunar ephemeris, and global temporal synchronization engine.

## Key features

- **2π Radian Horizon Clock (/sky):** Real-time diurnal radian vector simulation, optical twilight gradients, and living sky window.
- **Solar & Daylight Calculator (/astronomy):** Solar coordinates, golden-hour boundaries, twilight regimes, and astronomical query solver.
- **Lunar Ephemeris (/astronomy):** Moon phase, illumination, and upcoming milestone dates.
- **World Radio & Earth Audio (/radio):** Live terrestrial broadcasts synchronized with local diurnal solar cycles.
- **World Clocks (/world-clocks):** Multi-city time dashboard with daylight-saving awareness.
- **Stargazing Planner (/stargazing):** Dark-sky calculations, moon interference, and astrophotography windows.
- **3D Celestial Orrery (/space):** Interactive 3D space visualization.

## Stack

- Angular 22, zoneless change detection, signals
- Angular application builder
- Cloudflare Pages for the web application and Pages Functions for `/api/v1/*`
- Astronomy calculations based on NOAA and Meeus methods

## Cloudflare Pages deployment

This is a Cloudflare Pages application. The default `build` script builds the Cloudflare Pages target.

Configure the Cloudflare Pages project:

- **Production branch:** `main`
- **Build command:** `bun run build`
- **Build output directory:** `dist/cloudflare`
- **Root directory:** `/`
- **Build environment:** Node.js 24 and Bun 1.4.2

Do not configure a custom deploy command such as `npx wrangler deploy`. Cloudflare Pages Git integration builds and deploys the output directory automatically. For a manual deployment, use:

```bash
bun run deploy:cloudflare
```

API endpoints under `/api/v1/*` are Cloudflare Pages Functions in the root `functions/` directory. The `public/_routes.json` file limits Function invocation to API requests so static assets are served directly.

## Local development

```bash
bun install
bun run dev
```

## Local Pages preview

```bash
bun run build
bun run preview:cloudflare
```
