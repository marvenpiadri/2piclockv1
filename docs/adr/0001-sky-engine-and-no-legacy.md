# ADR-0001: Sky engine ephemeris and a no-legacy codebase

**Status:** Accepted
**Date:** 2026-10-29
**Deciders:** marvenpiadri

## Context
The Living Sky and every astronomy page share one engine (`core/astronomy/astronomy-engine.ts`).
The Moon came from a 10-term truncated Meeus series with phase names taken from *mean*
elongation, while the project already ships the full `astronomy-engine` library for planets.
The star renderer rebuilt sidereal time once per star per frame and used J2000 positions as
if they were current. This version is a new app, not a migration, so old paths add cost with no users.

## Decision
1. The Sun keeps the NOAA algorithm (cross-checked against SunCalc). The Moon, its phase and
   illumination come from `astronomy-engine`. The public `LunarPosition` shape is unchanged.
2. The renderer computes local sidereal time once per frame and precesses the J2000 star
   catalogue to the displayed instant once per minute.
3. No legacy routes, ids, components or fallback chains. Code is removed, not kept "just in case".
   Weather icons ship with the app; there is no CDN fallback.

## Options Considered
| Option | Assessment |
|--------|------------|
| A. Keep the truncated Meeus Moon | Smallest diff, but visibly wrong phases and positions at the minutes level, and a second lunar model to maintain |
| B. Use `astronomy-engine` for the Moon (chosen) | No new dependency, one source of truth with the planets, accurate far from 2000 |
| C. Replace the Sun too | Larger change; the NOAA Sun already agrees with SunCalc within 0.03 degrees, so no gain |

## Consequences
- Easier: one ephemeris for Moon and planets; correct skies in the Time Machine across centuries.
- Harder: the Moon now depends on the library's runtime cost on every tick (measured negligible).
- Revisit: SunCalc is still used only as a cross-check; drop it if the NOAA Sun is trusted outright.
- Altitude cross-checks are only valid with the Sun up, because SunCalc applies horizon refraction at every altitude below it.

## Action Items
1. [x] Moon from `astronomy-engine`, with a test against known 2000-01 new and full moons
2. [x] Per-frame sidereal time and catalogue precession in the renderer
3. [x] Remove legacy id redirect, dead components, Pages-era routes and stale specs
4. [ ] Run `ng test` in CI
