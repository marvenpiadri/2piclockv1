import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { Routes, CanActivateFn, Router } from '@angular/router';
import { LocationService } from './core/services/location.service';
import { SkyHomeComponent } from './features/sky-view/sky-home';
import { WorldClocksComponent } from './features/world-clocks/world-clocks';
import { WorldViewComponent } from './shared/components/world-view/world-view';
import { CelestialEphemerisComponent } from './features/celestial-ephemeris/celestial-ephemeris';
import { WeatherAtmosphereComponent } from './features/weather-atmosphere/weather-atmosphere';
import { MeetingPlannerComponent } from './features/meeting-planner/meeting-planner';
import { SpaceViewComponent } from './shared/components/space-view/space-view';
import { TonightComponent } from './features/tonight/tonight';
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
import { ApiDocsComponent } from './features/api-docs/api-docs';
import { SleepCalculatorComponent } from './features/sleep-calculator/sleep-calculator';

const resolveRootLocation: CanActivateFn = async () => {
  const locationService = inject(LocationService);
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) return true;
  try {
    const location = await locationService.ensureInitialLocation();
    if (!location || location.isCustom) return true;
    const slug = locationService.getLocationSlug(location);
    if (!slug) return true;
    return router.createUrlTree(['/', ...slug.split('/')]);
  } catch {
    return true;
  }
};

const validSeoLocationGuard: CanActivateFn = async (route) => {
  const locationService = inject(LocationService);
  const router = inject(Router);
  const country = route.paramMap.get('country');
  const city = route.paramMap.get('city');
  if (!country || !city) return router.createUrlTree(['/']);
  try {
    const location = await locationService.getLocation(country + '/' + city);
    if (!location) return router.createUrlTree(['/']);
    const canonical = locationService.getLocationSlug(location);
    if (country + '/' + city !== canonical) {
      return router.createUrlTree(['/', ...canonical.split('/')]);
    }
    if (locationService.selectedLocation().id !== location.id) {
      locationService.selectLocation(location);
    }
    return true;
  } catch {
    return router.createUrlTree(['/']);
  }
};

export const routes: Routes = [
  // The root is the entry point only. Resolve a concrete location before rendering
  // the living experience so every location page has a stable country/city URL.
  { path: '', pathMatch: 'full', canActivate: [resolveRootLocation], component: SkyHomeComponent, data: { skyPage: 'time' } },
  { path: 'weather', component: SkyHomeComponent, data: { skyPage: 'weather' } },
  { path: 'astronomy', component: AstronomySuiteComponent },
  { path: 'tonight', component: TonightComponent },
  { path: 'events', component: WorldEventsComponent },
  { path: 'api', component: ApiDocsComponent },
  { path: 'sleep-calculator', component: SleepCalculatorComponent },

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

  // Canonical SEO location URLs
  { path: ':country/:city/weather', component: SkyHomeComponent, canActivate: [validSeoLocationGuard], data: { skyPage: 'weather' } },
  { path: ':country/:city/time', component: SkyHomeComponent, canActivate: [validSeoLocationGuard], data: { skyPage: 'time' } },
  { path: ':country/:city/tonight', component: TonightComponent, canActivate: [validSeoLocationGuard] },
  { path: ':country/:city/sun', component: AstronomySuiteComponent, canActivate: [validSeoLocationGuard], data: { tab: 'daylight' } },
  { path: ':country/:city/moon', component: AstronomySuiteComponent, canActivate: [validSeoLocationGuard], data: { tab: 'moon' } },
  { path: ':country/:city/astronomy', component: AstronomySuiteComponent, canActivate: [validSeoLocationGuard], data: { tab: 'overview' } },
  { path: ':country/:city/events', component: WorldEventsComponent, canActivate: [validSeoLocationGuard] },
  { path: ':country/:city/alerts', component: AlertsComponent, canActivate: [validSeoLocationGuard] },
  { path: ':country/:city/stargazing', component: StargazingPlannerComponent, canActivate: [validSeoLocationGuard] },
  { path: ':country/:city/eclipses', component: EclipsePredictorComponent, canActivate: [validSeoLocationGuard] },
  { path: ':country/:city/satellites', component: SatelliteTrackerComponent, canActivate: [validSeoLocationGuard] },
  { path: ':country/:city', component: SkyHomeComponent, canActivate: [validSeoLocationGuard], data: { skyPage: 'time' } },

  // Canonical location URLs are universally country/city based.
  { path: '**', redirectTo: '' }
];
