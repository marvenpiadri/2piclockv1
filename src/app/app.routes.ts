import { inject } from '@angular/core';
import { Routes, CanActivateFn, Router } from '@angular/router';
import { LocationService } from './core/services/location.service';
import { GeoLocation } from './core/models/location.model';
import { SkyHomeComponent } from './features/sky-view/sky-home';
import { WorldClocksComponent } from './features/world-clocks/world-clocks';
import { WorldViewComponent } from './shared/components/world-view/world-view';
import { CelestialEphemerisComponent } from './features/celestial-ephemeris/celestial-ephemeris';
import { WeatherAtmosphereComponent } from './features/weather-atmosphere/weather-atmosphere';
import { MeetingPlannerComponent } from './features/meeting-planner/meeting-planner';
import { SpaceViewComponent } from './shared/components/space-view/space-view';
import { TimeSuiteComponent } from './features/time-suite/time-suite';
import { AstronomySuiteComponent } from './features/astronomy-suite/astronomy-suite';
import { WorldRadioComponent } from './features/world-radio/world-radio';
import { StargazingPlannerComponent } from './features/stargazing/stargazing-planner';
import { EclipsePredictorComponent } from './features/eclipses/eclipse-predictor';
import { SatelliteTrackerComponent } from './features/satellites/satellite-tracker';
import { DashboardComponent } from './features/dashboard/dashboard';
import { WidgetGeneratorComponent } from './features/widget-generator/widget-generator';
import { WidgetEmbedComponent } from './features/widget-generator/widget-embed';
import { WorldEventsComponent } from './features/world-events/world-events';
import { AlertsComponent } from './features/alerts/alerts';

const resolveRootLocation: CanActivateFn = async () => {
  const locationService = inject(LocationService);
  const router = inject(Router);
  const location = await locationService.ensureInitialLocation();
  return router.createUrlTree(['/', location.id]);
};

const validLocationGuard: CanActivateFn = (route) => {
  const locationService = inject(LocationService);
  const router = inject(Router);
  const slug = route.paramMap.get('location');
  const preset = slug
    ? locationService.allPresets.find((loc: GeoLocation) => loc.id === slug)
    : undefined;

  if (preset) {
    // The URL is authoritative for location-scoped pages. Keep the global
    // location signal synchronized before the component renders so every
    // downstream service (timezone, astronomy, weather, events) follows it.
    if (locationService.selectedLocation().id !== preset.id) {
      locationService.selectLocation(preset);
    }
    return true;
  }

  // Custom/GPS locations are only valid when they are already the active
  // location; they are persisted by LocationService rather than encoded as
  // a public preset slug.
  const validCurrent = slug === locationService.selectedLocation().id;
  return validCurrent ? true : router.createUrlTree(['/']);
};

export const routes: Routes = [
  // The root is the entry point only. Resolve a concrete location before rendering
  // the living experience so every normal page has a stable /:location URL.
  { path: '', pathMatch: 'full', canActivate: [resolveRootLocation], component: SkyHomeComponent, data: { skyPage: 'time' } },
  { path: 'weather', component: SkyHomeComponent, data: { skyPage: 'weather' } },
  { path: 'astronomy', component: AstronomySuiteComponent },
  { path: 'tonight', component: SkyHomeComponent, data: { skyPage: 'tonight' } },
  { path: 'events', component: WorldEventsComponent },

  // Astronomical & Stargazing Suites (Option B)
  { path: 'stargazing', component: StargazingPlannerComponent },
  { path: 'eclipses', component: EclipsePredictorComponent },
  { path: 'satellites', component: SatelliteTrackerComponent },

  // Multi-City Dashboard & Widget Generator (Option C)
  { path: 'dashboard', component: DashboardComponent },
  { path: 'widget', component: WidgetGeneratorComponent },
  { path: 'widget/embed/:location', component: WidgetEmbedComponent },

  // Product directories: each product gets a crawlable child URL.
  { path: 'time', pathMatch: 'full', redirectTo: 'time/converter' },
  { path: 'time/converter', component: TimeSuiteComponent, data: { tool: 'converter' } },
  { path: 'time/difference', component: TimeSuiteComponent, data: { tool: 'difference' } },
  { path: 'time/duration', component: TimeSuiteComponent, data: { tool: 'duration' } },
  { path: 'time/date-difference', component: TimeSuiteComponent, data: { tool: 'date-difference' } },
  { path: 'time/add-subtract', component: TimeSuiteComponent, data: { tool: 'add-subtract' } },
  { path: 'time/countdown', component: TimeSuiteComponent, data: { tool: 'countdown' } },
  { path: 'time/unix-timestamp', component: TimeSuiteComponent, data: { tool: 'unix' } },
  { path: 'time/world-matrix', component: TimeSuiteComponent, data: { tool: 'world-comparison' } },

  // Maps are a directory of distinct map products
  { path: 'maps', pathMatch: 'full', redirectTo: 'maps/clocks' },
  { path: 'maps/clocks', component: WorldViewComponent, data: { mapMode: 'clocks' } },
  { path: 'maps/radio', component: WorldRadioComponent, data: { tab: 'map' } },

  // World Radio directory
  { path: 'radio', pathMatch: 'full', redirectTo: 'radio/stations' },
  { path: 'radio/stations', component: WorldRadioComponent, data: { tab: 'explore' } },
  { path: 'radio/map', component: WorldRadioComponent, data: { tab: 'map' } },
  { path: 'radio/favorites', component: WorldRadioComponent, data: { tab: 'favorites' } },
  { path: 'radio/recent', component: WorldRadioComponent, data: { tab: 'recents' } },

  // World & Space routes
  { path: 'world', component: WorldViewComponent },
  { path: 'world-clocks', component: WorldClocksComponent },
  { path: 'space', component: SpaceViewComponent },
  { path: 'atmosphere', component: WeatherAtmosphereComponent },
  { path: 'alerts', component: AlertsComponent },
  { path: 'ephemeris', component: CelestialEphemerisComponent },
  { path: 'planner', component: MeetingPlannerComponent },

  // Location-first living experience
  { path: ':location/weather', component: SkyHomeComponent, canActivate: [validLocationGuard], data: { skyPage: 'weather' } },
  { path: ':location/time', component: SkyHomeComponent, canActivate: [validLocationGuard], data: { skyPage: 'time' } },
  { path: ':location/tonight', component: SkyHomeComponent, canActivate: [validLocationGuard], data: { skyPage: 'tonight' } },
  { path: ':location/sun', component: AstronomySuiteComponent, canActivate: [validLocationGuard], data: { tab: 'daylight' } },
  { path: ':location/moon', component: AstronomySuiteComponent, canActivate: [validLocationGuard], data: { tab: 'moon' } },
  { path: ':location/astronomy', component: AstronomySuiteComponent, canActivate: [validLocationGuard], data: { tab: 'overview' } },
  { path: ':location/events', component: WorldEventsComponent, canActivate: [validLocationGuard] },
  { path: ':location/alerts', component: AlertsComponent, canActivate: [validLocationGuard] },
  { path: ':location/stargazing', component: StargazingPlannerComponent, canActivate: [validLocationGuard] },
  { path: ':location/eclipses', component: EclipsePredictorComponent, canActivate: [validLocationGuard] },
  { path: ':location/satellites', component: SatelliteTrackerComponent, canActivate: [validLocationGuard] },
  { path: ':location', component: SkyHomeComponent, canActivate: [validLocationGuard], data: { skyPage: 'time' } },
  { path: '**', redirectTo: '' }
];
