# 2piClock V2 Roadmap

V2 is being built as a sequence of focused releases. Each phase must be visually coherent, astronomically consistent with the shared engine, and stable before the next phase starts.

## V2.0 — Astronomical Sky
Goal: make the Living Sky a real astronomical scene.

- [x] Real bright-star positions tied to date + observer location
- [x] Subtle constellation geometry
- [x] Real planetary ephemeris available through CelestialService
- [x] Real planets projected into Living Sky
- [ ] Expand the bright-star catalogue
- [ ] Milky Way band
- [ ] Better horizon extinction
- [ ] Moonlight wash over the night sky
- [ ] Weather/cloud occlusion for stars, Moon and planets
- [ ] Celestial render QA across day/night, locations and polar conditions

**Exit condition:** the same date/location produces a consistent Sun, Moon, star and planet sky across the Living Sky and astronomy experiences.

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

**Exit condition:** changing weather materially changes the rendered sky while preserving astronomical positions.

## V2.2 — Tonight
Goal: turn Tonight into a practical nightly observing experience.

- [ ] Visible planets with rise/set information
- [ ] Visible constellation list
- [ ] Moon observing conditions
- [ ] Astronomical darkness timeline
- [ ] Stargazing score based on sky conditions
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

## V2.6 — Platform
Goal: expose the 2piClock engine beyond the main website.

- [ ] PWA
- [ ] Widgets
- [ ] Embeddable sky
- [ ] Public API
- [ ] Shareable sky URLs
