import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, PLATFORM_ID, provideZonelessChangeDetection, runInInjectionContext } from '@angular/core';
import { CelestialService } from './celestial.service';
import { LocationService } from './location.service';
import { TimeControlService } from './time-control.service';
import { WeatherService } from './weather.service';
import { PrecisionAstronomyService } from './precision-astronomy.service';
import { get24HourSolarCurve } from '../astronomy/astronomy-engine';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

describe('CelestialService Unit Tests (Jasmine / Karma compliant)', () => {
  let injector: Injector;
  let celestialService: CelestialService;
  let timeControlService: TimeControlService;
  let precisionAstronomy: PrecisionAstronomyService;

  beforeEach(() => {
    injector = Injector.create({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: HttpClient, useValue: { get: () => of({}) } },
        LocationService,
        TimeControlService,
        WeatherService,
        PrecisionAstronomyService,
        CelestialService
      ]
    });

    celestialService = injector.get(CelestialService);
    timeControlService = injector.get(TimeControlService);
    precisionAstronomy = injector.get(PrecisionAstronomyService);
  });

  it('should create CelestialService and compute initial celestialState', () => {
    expect(celestialService).toBeTruthy();
    const state = celestialService.celestialState();
    expect(state).toBeDefined();
    expect(state.sun).toBeDefined();
    expect(state.moon).toBeDefined();
    expect(typeof state.sun.altitudeDeg).toBe('number');
    expect(typeof state.moon.altitudeDeg).toBe('number');
    expect(typeof state.moon.illuminationFraction).toBe('number');
  });

  it('should react to time changes and recompute solar and lunar altitudes', () => {
    runInInjectionContext(injector, () => {
      // Set to midday UTC
      const noon = new Date(Date.UTC(2026, 5, 21, 12, 0, 0));
      timeControlService.setSpecificInstant(noon);
      const stateNoon = celestialService.celestialState();
      
      // Set to midnight UTC
      const midnight = new Date(Date.UTC(2026, 5, 21, 0, 0, 0));
      timeControlService.setSpecificInstant(midnight);
      const stateMidnight = celestialService.celestialState();

      // Changing time alters celestial altitude
      expect(stateNoon.sun.altitudeDeg).not.toEqual(stateMidnight.sun.altitudeDeg);
    });
  });

  it('should compute comprehensive atmosphericState derived from astronomy and weather', () => {
    runInInjectionContext(injector, () => {
      const atmo = celestialService.atmosphericState();
      expect(atmo).toBeDefined();
      expect(['spring', 'summer', 'autumn', 'winter']).toContain(atmo.season);
      expect(atmo.cloudCoverage).toBeGreaterThanOrEqual(0);
      expect(atmo.cloudCoverage).toBeLessThanOrEqual(1);
      expect(atmo.visibilityKm).toBeGreaterThan(0);
    });
  });

  it('should compute 24-hour solar curve points for any valid location and instant', () => {
    runInInjectionContext(injector, () => {
      const loc = celestialService.selectedLocation();
      const date = celestialService.activeDate();
      const points = get24HourSolarCurve(date, loc.latitude, loc.longitude, loc.timezone);
      expect(points).toBeDefined();
      expect(Array.isArray(points)).toBe(true);
      expect(points.length).toBeGreaterThan(0);
      expect(points[0].timeString).toBeTruthy();
      expect(typeof points[0].altitude).toBe('number');
    });
  });

  it('should retrieve solar cross check and planetary coordinates via PrecisionAstronomyService', () => {
    runInInjectionContext(injector, () => {
      const loc = celestialService.selectedLocation();
      const date = celestialService.activeDate();

      const cross = precisionAstronomy.crossCheckSun(date, loc.latitude, loc.longitude);
      expect(cross).toBeDefined();
      expect(typeof cross.astronomyEngineAltitudeDeg).toBe('number');
      expect(typeof cross.sunCalcAltitudeDeg).toBe('number');
      expect(cross.isValidated).toBe(true);

      const planets = precisionAstronomy.getPlanetaryPositions(date, loc.latitude, loc.longitude);
      expect(Array.isArray(planets)).toBe(true);
      expect(planets.length).toBe(7);
      expect(planets[0].name).toBeTruthy();
    });
  });

  it('should compute formatted local time and date in selected timezone', () => {
    runInInjectionContext(injector, () => {
      expect(celestialService.formattedLocalTime()).toMatch(/\d{2}:\d{2}:\d{2}/);
      expect(celestialService.formattedLocalDate()).toBeTruthy();
      expect(celestialService.timezoneDisplay()).toBeTruthy();
    });
  });
});
