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

- [ ] Multi-layer cloud depth and coverage
- [ ] Cloud occlusion of celestial objects
- [ ] Haze and visibility response
- [ ] Humidity-driven atmospheric softness
- [ ] Rain/snow density tied to weather intensity
- [ ] Storm-light behavior
- [ ] Weather-driven horizon and twilight scattering
- [ ] Forecast-to-sky transition preview
- [ ] Weather failure/loading states that never break the sky

**Visual rule:** weather should modify the atmosphere, not cover it with effects.

**Exit condition:** changing weather materially changes the rendered sky while preserving astronomical positions.

## V2.2 — Tonight
Goal: turn Tonight into a practical nightly observing experience without turning the Living Sky into an astronomy interface.

- [ ] Visible planets with rise/set information
- [ ] Visible constellation list
- [ ] Moon observing conditions
- [ ] Astronomical darkness timeline
- [ ] Stargazing conditions based on sky factors
- [ ] Upcoming celestial events
- [ ] Personalized nightly timeline
- [ ] Shareable "Tonight under your sky" state

## V2.3 — My Sky
Goal: make the experience personal.

- [ ] Saved locations
- [ ] Personal observatories
- [ ] Fast location switching
- [ ] Location-specific sky preferences
- [ ] Persistent sky state

## V2.4 — Earth
Goal: connect the local sky to the planet.

- [ ] Live day/night map
- [ ] Twilight terminator
- [ ] Global sunrise/sunset
- [ ] World weather integration
- [ ] World clocks integration

## V2.5 — Time Machine
Goal: let users explore the sky across time.

- [ ] Arbitrary date/time
- [ ] Historical skies
- [ ] Future skies
- [ ] Date comparison
- [ ] Celestial event exploration
- [ ] Shareable sky states

## V2.6 — Astronomy
Goal: give advanced astronomical exploration its own dedicated experience instead of making the Living Sky carry too much information.

- [ ] Interactive Solar System view
- [ ] Planetary orbits and positions
- [ ] Earth/Moon/Sun relationship view
- [ ] Celestial coordinate exploration
- [ ] Detailed constellation map
- [ ] Deep-sky object exploration
- [ ] Planet rise/set and observing information
- [ ] Celestial events and alignments
- [ ] Historical/future astronomical exploration
- [ ] Optional Milky Way / galactic visualization here, where a denser astronomical view is appropriate

## V2.7 — Platform
Goal: expose the 2piClock engine beyond the main website.

- [ ] PWA
- [ ] Widgets
- [ ] Embeddable sky
- [ ] Public API
- [ ] Shareable sky URLs
