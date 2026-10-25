# 2piClock · Living Celestial Clock & Astronomical Observatory

> High-precision diurnal radian clock, atmospheric telemetry, solar/lunar ephemeris, and global temporal synchronization engine built with Angular 21, Zoneless Signals, and Tailwind CSS.

---

## 🌟 Key Features & Product Modules

- **2π Radian Horizon Clock (`/sky`)**: Real-time diurnal radian vector simulation, optical twilight gradients, and living sky window.
- **Solar & Daylight Calculator (`/astronomy`)**: Precise NOAA solar coordinates, golden hour boundaries, twilight regimes, and "When Is?" astronomical query solver.
- **Lunar Ephemeris & Phase Indicator (`/astronomy`)**: High-accuracy synodic moon phase terminator, illumination fraction, and upcoming milestone dates.
- **World Radio & Earth Audio (`/radio`)**: Live terrestrial broadcasts synchronized with local diurnal solar cycles.
- **World Clocks Grid (`/world-clocks`)**: Synchronized multi-city time dashboard with DST awareness.
- **Stargazing & Dark Sky Planner (`/stargazing`)**: Bortle dark sky index calculations, moon interference, and astrophotography window predictor.
- **3D Celestial Orrery & Space View (`/space`)**: Interactive 3D deep space canvas with realistic multi-frequency star twinkling, constellation anchors, and meteors.

---

## 🚀 Tech Stack

- **Framework**: Angular 21 (Zoneless, OnPush Change Detection, Signals)
- **Styling**: Tailwind CSS 4 & Custom Glassmorphism UI
- **Build System**: Angular Application Builder (`@angular/build`) & Vite
- **Astronomy & Math**: Astronomical algorithms based on NOAA and Meeus ephemeris formulas.


---

## Cloudflare Pages deployment

This repository has a dedicated static build target for Cloudflare Pages. The existing Vercel SSR build and `vercel.json` remain unchanged.

### Cloudflare Pages settings

- **Production branch:** `main`
- **Build command:** `bun run build:cloudflare`
- **Build output directory:** `dist/cloudflare`
- **Build environment:** Node.js 24 and Bun 1.4.2

The Pages build uses Angular's static output and client-side routing. API routes under `/api/v1/*` run as Cloudflare Pages Functions from the root `functions/` directory. Static assets are excluded from Function invocations through the generated `_routes.json` file.

### Local preview

```bash
bun install
bun run build:cloudflare
bun run preview:cloudflare
```

The Cloudflare target currently uses client-side rendering. The original Node/Express SSR entry is retained for Vercel; it is not executed by Pages. If request-time HTML rendering is required on Cloudflare, migrate that server to a Cloudflare Worker-compatible Angular SSR runtime rather than attempting to run the Express server inside Pages Functions.
