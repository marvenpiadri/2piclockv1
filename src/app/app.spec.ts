import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { Injector, PLATFORM_ID, provideZonelessChangeDetection, runInInjectionContext, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { App } from './app';
import { LocationService } from './core/services/location.service';
import { TimeControlService } from './core/services/time-control.service';
import { PrecisionAstronomyService } from './core/services/precision-astronomy.service';
import { CelestialService } from './core/services/celestial.service';
import { WeatherService } from './core/services/weather.service';
import { GeocodingService } from './core/services/geocoding.service';
import { ObservatoryViewService } from './core/services/observatory-view.service';
import { SeoService } from './core/services/seo.service';
import { GlassThemeService } from './core/services/glass-theme.service';
import { ErrorHandlerService } from './core/services/error-handler.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { PRESET_LOCATIONS } from './core/models/location.model';
import { MoonPhaseIndicator } from './shared/components/moon-phase-indicator/moon-phase-indicator';
import { AstronomyDetails } from './shared/components/astronomy-details/astronomy-details';

describe('App Component and System Architecture Unit Tests (Jasmine / Karma compliant)', () => {
  const createTestInjector = () => {
    return Injector.create({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'server' },
        {
          provide: DOCUMENT,
          useValue: {
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            querySelector: () => null,
            body: {
              classList: {
                add: () => undefined,
                remove: () => undefined,
                toggle: () => undefined,
                contains: () => false
              }
            }
          }
        },
        { provide: Title, useValue: { setTitle: () => undefined } },
        { provide: Meta, useValue: { updateTag: () => undefined } },
        { provide: HttpClient, useValue: { get: () => of({}) } },
        {
          provide: Router,
          useValue: {
            events: of(),
            url: '/',
            navigate: () => Promise.resolve(true),
            navigateByUrl: () => Promise.resolve(true),
            createUrlTree: () => ({}),
            serializeUrl: () => ''
          }
        },
        {
          provide: GlassThemeService,
          useValue: {
            isGlassEnabled: signal<boolean>(true),
            toggleGlassMode: () => undefined,
            setGlassMode: () => undefined
          }
        },
        WeatherService,
        LocationService,
        TimeControlService,
        PrecisionAstronomyService,
        CelestialService,
        GeocodingService,
        ObservatoryViewService,
        SeoService,
        ErrorHandlerService
      ]
    });
  };

  it('should initialize LocationService with valid default presets and dependencies', () => {
    const injector = createTestInjector();
    const locationService = injector.get(LocationService);
    expect(locationService).toBeTruthy();
    expect(locationService.allPresets.length).toBeGreaterThan(0);
    expect(locationService.selectedLocation()).toEqual(PRESET_LOCATIONS[0]);
  });

  it('should instantiate the App component and initialize default state', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const app = new App();
      expect(app).toBeTruthy();
      expect(app.selectedLocation()).toBeDefined();
      expect(app.allLocations.length).toBeGreaterThan(0);
      expect(app.showLocationDropdown()).toBe(false);
      expect(app.searchQuery()).toBe('');
      expect(app.filteredLocations().length).toBeGreaterThan(0);
    });
  });

  it('should filter locations accurately in App based on search query', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const app = new App();
      app.searchQuery.set('Tokyo');
      const filtered = app.filteredLocations();
      expect(filtered.length).toBeGreaterThan(0);
      expect(filtered[0].name.toLowerCase()).toContain('tokyo');

      app.searchQuery.set('NonExistentPlaceXYZ123');
      expect(app.filteredLocations().length).toBe(0);
    });
  });

  it('should select a location, close dropdown, and reset atmospheric overrides', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const app = new App();
      const locationService = injector.get(LocationService);
      const weatherService = injector.get(WeatherService);

      const target = PRESET_LOCATIONS[1];
      weatherService.setOverride({ condition: 'thunderstorm' });
      expect(weatherService.overrideConfig().active).toBe(true);

      app.showLocationDropdown.set(true);
      app.selectLocation(target);

      expect(locationService.selectedLocation().id).toBe(target.id);
      expect(app.showLocationDropdown()).toBe(false);
      expect(weatherService.overrideConfig().active).toBe(false);
    });
  });

  it('should wire error handler and allow notification dismissal', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const app = new App();
      expect(app.errorHandler).toBeDefined();

      app.errorHandler.showNotification('Unit test warning notification', 'warning');
      expect(app.errorHandler.activeNotifications().length).toBe(1);

      const notifId = app.errorHandler.activeNotifications()[0].id;
      app.errorHandler.dismissNotification(notifId);
      expect(app.errorHandler.activeNotifications().length).toBe(0);
    });
  });

  it('should calculate solar cross-check and planetary positions in PrecisionAstronomyService', () => {
    const injector = createTestInjector();
    const astroService = injector.get(PrecisionAstronomyService);
    expect(astroService).toBeTruthy();

    const crossCheck = astroService.crossCheckSun(new Date(), 35.6762, 139.6503);
    expect(crossCheck).toBeDefined();
    expect(crossCheck.altitudeDeltaDeg).toBeLessThan(1.0);
    expect(crossCheck.isValidated).toBe(true);

    const planets = astroService.getPlanetaryPositions(new Date(), 35.6762, 139.6503);
    expect(planets.length).toBe(7);
  });

  it('should derive precise sunrise, sunset, and solar noon via CelestialService in AstronomyDetails', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const details = new AstronomyDetails();
      expect(details).toBeTruthy();

      const events = details.solarEvents();
      expect(events).toBeDefined();
      expect(events.sunrise).toBeInstanceOf(Date);
      expect(events.solarNoon).toBeInstanceOf(Date);
      expect(events.sunset).toBeInstanceOf(Date);

      expect(details.formattedSunrise()).toMatch(/\d{2}:\d{2}/);
      expect(details.formattedSolarNoon()).toMatch(/\d{2}:\d{2}/);
      expect(details.formattedSunset()).toMatch(/\d{2}:\d{2}/);

      const progress = details.daylightProgressPct();
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  it('should compute lunar illumination fraction and path in MoonPhaseIndicator', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const moonIndicator = new MoonPhaseIndicator();
      expect(moonIndicator).toBeTruthy();

      const fraction = moonIndicator.illuminationFraction();
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(1);

      const age = moonIndicator.ageDays();
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThanOrEqual(30);

      const milestone = moonIndicator.nextPhaseMilestone();
      expect(['New Moon', 'First Quarter', 'Full Moon', 'Third Quarter']).toContain(milestone.target);
    });
  });
});
