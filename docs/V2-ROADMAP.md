# 2piClock V2 Roadmap

V2 is built around a strict separation between two experiences that share the same astronomical engine:

- **Living Sky** — what the sky looks and feels like from Earth.
- **Astronomy** — a separate, deeper exploration of what is happening beyond the atmosphere.

The Living Sky must remain light, atmospheric and beautiful. Astronomical depth belongs in the dedicated Astronomy experience rather than being layered into the sky renderer.

## V2.0 — Living Sky: Astronomical Foundation
Goal: make the Living Sky a more accurate real-world sky without making it visually heavy.

- [x] Real bright-star positions tied to date + observer location
- [x] Subtle constellation geometry
- [x] Real planetary ephemeris available through CelestialService
- [x] Real planets projected into Living Sky
- [x] Expand the star catalogue carefully, prioritizing useful visible stars
- [x] Better horizon extinction
- [x] Moonlight wash over the night sky
- [x] Weather/cloud occlusion for stars, Moon and planets
- [x] Refine atmospheric visibility, haze and dust interaction
- [ ] Celestial render QA across day/night, locations and polar conditions

### Visual rule
The Living Sky should feel like looking upward, not opening an astronomy dashboard.

Astronomical objects may be added when they make the sky feel **more alive**. They should not be added when they make it feel **heavier, denser or more technical**.

**Do not add a Milky Way layer to the Living Sky.** The stars, Moon, planets, atmosphere and weather already provide the astronomical texture we need.

**Implementation complete.** The remaining V2.0 exit task is visual/browser QA across day/night, locations and polar conditions before V2.1 begins.

## V2.1 — Weather × Sky
Goal: make weather visibly change the atmosphere rather than only the information cards.

- [x] Multi-layer cloud depth and coverage
- [x] Cloud occlusion of celestial objects
- [x] Haze and visibility response
- [x] Humidity-driven atmospheric softness
- [x] Rain/snow density tied to weather intensity
- [x] Storm-light behavior
- [x] Weather-driven horizon and twilight scattering
- [x] Forecast-to-sky transition preview
- [x] Weather failure/loading states that never break the sky

**Visual rule:** weather should modify the atmosphere, not cover it with effects.

**Exit condition:** changing weather materially changes the rendered sky while preserving astronomical positions.

## V2.2 — Tonight
Goal: turn Tonight into a practical nightly observing experience without turning the Living Sky into an astronomy interface.

- [x] Visible planets with rise/set information
- [x] Visible constellation list
- [x] Moon observing conditions
- [x] Astronomical darkness timeline
- [x] Stargazing conditions based on sky factors
- [x] Upcoming celestial events
- [x] Personalized nightly timeline
- [x] Shareable "Tonight under your sky" state

V2.2 implementation is complete. Tonight now combines the local sky, Moon observing conditions, visible constellations, darkness boundaries, stargazing factors, a personalized timeline, upcoming celestial events, and share state.

## V2.3 — My Sky
Goal: make the experience personal.

- [x] Saved locations
- [ ] Personal observatories
- [x] Fast location switching
- [ ] Location-specific sky preferences
- [x] Persistent sky state

My Sky foundation is in place through the persistent watchlist and location-first routing. Observatory profiles and per-location preferences remain for the next pass.

## V2.4 — Earth
Goal: connect the local sky to the planet.

- [x] Live day/night map
- [x] Twilight terminator
- [x] Global sunrise/sunset
- [x] World weather integration
- [x] World clocks integration

V2.4 Earth is now implemented as the global Earth instrument: the MapLibre world view follows the exact active instant, renders the day/night boundary and twilight bands, exposes global solar state and world-clock locations, and provides an opt-in live weather layer.

## V2.5 — Time Machine
Goal: let users explore the sky across time.

The Living Sky time engine already supports exact historical/future instants; the compact date navigator now exposes this directly from the main experience.

- [x] Arbitrary date/time
- [x] Historical skies
- [x] Future skies
- [x] Date comparison
- [x] Celestial event exploration
- [x] Shareable sky states

V2.5 core implementation is now complete. The Time Machine supports arbitrary dates, historical/future skies, compact date comparison with sunrise/sunset/daylight differences, existing celestial event exploration, and shareable sky state.

## V2.6 — Astronomy
Goal: give advanced astronomical exploration its own dedicated experience instead of making the Living Sky carry too much information.

- [x] Interactive Solar System view
- [x] Planetary orbits and positions
- [x] Earth/Moon/Sun relationship view
- [x] Celestial coordinate exploration
- [x] Detailed constellation map
- [x] Deep-sky object exploration
- [x] Planet rise/set and observing information
- [x] Celestial events and alignments
- [x] Historical/future astronomical exploration
- [ ] Optional Milky Way / galactic visualization here, where a denser astronomical view is appropriate

V2.6 now includes the Solar System explorer, planetary observing data, Earth/Moon/Sun geometry, coordinate exploration, constellation atlas, and the Deep Sky Atlas. The remaining Milky Way/galactic visualization is intentionally optional and can be added later without affecting the core Astronomy experience.

## V2.7 — Platform
Goal: expose the 2piClock engine beyond the main website.

- [ ] PWA
- [ ] Widgets
- [ ] Embeddable sky
- [ ] Public API
- [ ] Shareable sky URLs
