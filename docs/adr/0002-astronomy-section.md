# ADR-0002: Astronomy section built on one catalogue and the ephemeris library

**Status:** Accepted

## Context
The Astronomy page mixed three sources of truth: hard-coded equinox and solstice times (4–11 h off), a mean-month moon-phase table (up to 24 h off), and a hand-rolled alt/az projection duplicated across four components. Its planet table ignored the date picked on the page, the share link dropped date and place, and the Overview tab was 4,200 px of mostly empty charts.

## Decision
- `core/astronomy/sky-catalogue.ts` is the only star, constellation and deep-sky list. Living Sky and the Astronomy page both read it.
- `equatorialJ2000ToHorizontal` (astronomy-engine.ts) is the only catalogue-to-horizon projection. It precesses J2000 to the date first.
- Seasons, moon quarters, apsides, eclipses and supermoons come from `astronomy-engine`. Supermoon means a full moon closer than 361,000 km.
- The page is five tabs (Sky, Sun, Moon, Planets, Events). Tab, date and time live in the URL. With no date in the URL it follows the clock.

## Consequences
- Dates and times on the page are now checked by tests against real 2026 events (March equinox, 3 March lunar eclipse, 12 August solar eclipse).
- Constellations and the star list are small (47 stars, 6 figures, 10 deep-sky objects). Growing them means editing one file.
- `keplerian-engine` still drives the 3D orrery, so its planet positions can differ slightly from this page. Replace it when the orrery is next touched.
