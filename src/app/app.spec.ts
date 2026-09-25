import '@angular/compiler';
import { describe, it, expect } from 'vitest';
import { Injector, PLATFORM_ID, provideZonelessChangeDetection, runInInjectionContext } from '@angular/core';
import { LocationService } from './core/services/location.service';
import { TimeControlService } from './core/services/time-control.service';
import { PrecisionAstronomyService } from './core/services/precision-astronomy.service';
import { CelestialService } from './core/services/celestial.service';
import { WeatherService } from './core/services/weather.service';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { PRESET_LOCATIONS } from './core/models/location.model';
import { MoonPhaseIndicator } from './shared/components/moon-phase-indicator/moon-phase-indicator';
import { AstronomyDetails } from './shared/components/astronomy-details/astronomy-details';

describe('2PiClock Core Services Architecture', () => {
  it('should initialize LocationService with valid default presets', () => {
    const injector = Injector.create({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        LocationService
      ]
    });

    const locationService = injector.get(LocationService);
    expect(locationService).toBeTruthy();
    expect(locationService.allPresets.length).toBeGreaterThan(0);
    expect(locationService.selectedLocation()).toEqual(PRESET_LOCATIONS[0]);
  });

  it('should initialize TimeControlService with live active date', () => {
    const injector = Injector.create({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        TimeControlService
      ]
    });

    const timeService = injector.get(TimeControlService);
    expect(timeService).toBeTruthy();
    expect(timeService.currentActiveDate()).toBeInstanceOf(Date);
    expect(timeService.isLive()).toBe(true);
  });

  it('should initialize PrecisionAstronomyService and calculate solar cross-check', () => {
    const injector = Injector.create({
      providers: [
        PrecisionAstronomyService
      ]
    });

    const astroService = injector.get(PrecisionAstronomyService);
    expect(astroService).toBeTruthy();

    const crossCheck = astroService.crossCheckSun(new Date(), 35.6762, 139.6503);
    expect(crossCheck).toBeDefined();
    expect(crossCheck.altitudeDeltaDeg).toBeLessThan(1.0);
    expect(crossCheck.isValidated).toBe(true);

    const planets = astroService.getPlanetaryPositions(new Date(), 35.6762, 139.6503);
    expect(planets.length).toBe(7); // Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune
  });

  it('should derive precise sunrise, sunset, and solar noon via CelestialService in AstronomyDetails', () => {
    const injector = Injector.create({
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

    runInInjectionContext(injector, () => {
      const details = new AstronomyDetails();
      expect(details).toBeTruthy();

      const events = details.solarEvents();
      expect(events).toBeDefined();
      expect(events.sunrise).toBeInstanceOf(Date);
      expect(events.solarNoon).toBeInstanceOf(Date);
      expect(events.sunset).toBeInstanceOf(Date);

      // Verify sunrise is before noon, and noon is before sunset
      if (events.sunrise && events.solarNoon && events.sunset) {
        expect(events.sunrise.getTime()).toBeLessThan(events.solarNoon.getTime());
        expect(events.solarNoon.getTime()).toBeLessThan(events.sunset.getTime());
      }

      // Check formatted output strings
      expect(details.formattedSunrise()).toMatch(/\d{2}:\d{2}/);
      expect(details.formattedSolarNoon()).toMatch(/\d{2}:\d{2}/);
      expect(details.formattedSunset()).toMatch(/\d{2}:\d{2}/);

      // Verify daylight progress is within 0-100%
      const progress = details.daylightProgressPct();
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  it('should compute lunar illumination fraction, age, and SVG path in MoonPhaseIndicator', () => {
    const injector = Injector.create({
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

    runInInjectionContext(injector, () => {
      const moonIndicator = new MoonPhaseIndicator();
      expect(moonIndicator).toBeTruthy();

      const fraction = moonIndicator.illuminationFraction();
      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(1);

      const age = moonIndicator.ageDays();
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThanOrEqual(30);

      const path = moonIndicator.svgLitPath();
      expect(typeof path).toBe('string');
      // Non-empty string unless exact new moon
      if (fraction > 0.01) {
        expect(path.length).toBeGreaterThan(0);
        expect(path).toContain('M 0 -44');
      }

      // Milestone check
      const milestone = moonIndicator.nextPhaseMilestone();
      expect(['New Moon', 'First Quarter', 'Full Moon', 'Third Quarter']).toContain(milestone.target);
      expect(parseFloat(milestone.inDays)).toBeGreaterThanOrEqual(0);
    });
  });
});
