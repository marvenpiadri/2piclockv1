import '@angular/compiler';
import { describe, it, expect, vi } from 'vitest';
import { Injector, PLATFORM_ID, provideZonelessChangeDetection, runInInjectionContext } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';

import { TonightComponent } from './tonight';
import { LocationService } from '../../core/services/location.service';
import { CelestialService } from '../../core/services/celestial.service';
import { WeatherService } from '../../core/services/weather.service';
import { PrecisionAstronomyService } from '../../core/services/precision-astronomy.service';
import { TimeControlService } from '../../core/services/time-control.service';
import { GeocodingService } from '../../core/services/geocoding.service';
import { PRESET_LOCATIONS } from '../../core/models/location.model';

describe('TonightComponent Architecture & Almanac Engine Unit Tests', () => {
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
            body: { classList: { add: () => undefined, remove: () => undefined } }
          }
        },
        { provide: Title, useValue: { setTitle: vi.fn() } },
        { provide: Meta, useValue: { updateTag: vi.fn() } },
        { provide: HttpClient, useValue: { get: () => of({}) } },
        {
          provide: Router,
          useValue: {
            events: of(),
            url: '/tonight',
            navigate: vi.fn().mockResolvedValue(true),
            createUrlTree: () => ({}),
            serializeUrl: () => ''
          }
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: { get: () => null },
              data: {}
            },
            params: of({})
          }
        },
        LocationService,
        TimeControlService,
        WeatherService,
        PrecisionAstronomyService,
        CelestialService,
        GeocodingService
      ]
    });
  };

  it('should instantiate TonightComponent cleanly and initialize default signals', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const comp = new TonightComponent();
      expect(comp).toBeTruthy();
      expect(comp.selectedLocation()).toEqual(PRESET_LOCATIONS[0]);
      expect(comp.isLiveMode()).toBe(true);
      expect(comp.manualTimeOffsetMinutes()).toBe(0);
    });
  });

  it('should compute valid astronomical milestones for tonight', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const comp = new TonightComponent();
      const ms = comp.tonightSolarMilestones();
      expect(ms).toBeDefined();
      expect(typeof ms.sunsetFormatted).toBe('string');
      expect(typeof ms.darkHoursFormatted).toBe('string');
      expect(ms.totalNightMinutes).toBeGreaterThan(0);
    });
  });

  it('should compute moon detail and luminance interference without throwing', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const comp = new TonightComponent();
      const moon = comp.moonDetail();
      expect(moon).toBeDefined();
      expect(moon.illuminationPct).toBeGreaterThanOrEqual(0);
      expect(moon.illuminationPct).toBeLessThanOrEqual(100);
      expect(typeof moon.phaseName).toBe('string');
      expect(typeof moon.interferenceRating).toBe('string');
    });
  });

  it('should generate planets list with valid horizontal coordinates and magnitudes', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const comp = new TonightComponent();
      const planets = comp.planetsTonight();
      expect(planets.length).toBeGreaterThanOrEqual(5);
      const jupiter = planets.find(p => p.name === 'Jupiter');
      expect(jupiter).toBeDefined();
      expect(typeof jupiter?.magnitude).toBe('number');
      expect(typeof jupiter?.viewingStatus).toBe('string');
    });
  });

  it('should allow scrubbing time and resetting to live mode', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const comp = new TonightComponent();
      expect(comp.isLiveMode()).toBe(true);

      comp.jumpToMilestone(240);
      expect(comp.isLiveMode()).toBe(false);
      expect(comp.manualTimeOffsetMinutes()).toBe(240);

      comp.resetToLive();
      expect(comp.isLiveMode()).toBe(true);
      expect(comp.manualTimeOffsetMinutes()).toBe(0);
    });
  });

  it('should compute 12-hour altitude curve points and valid SVG paths', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const comp = new TonightComponent();
      const curves = comp.altitudeCurves();
      expect(curves.length).toBeGreaterThan(5);

      const paths = comp.svgCurvePaths();
      expect(paths.sun).toContain('M');
      expect(paths.moon).toContain('M');
      expect(typeof paths.zeroAltY).toBe('number');
      expect(typeof paths.thirtyAltY).toBe('number');
    });
  });

  it('should toggle targets checklist and update inspection telemetry', () => {
    const injector = createTestInjector();
    runInInjectionContext(injector, () => {
      const comp = new TonightComponent();
      const targets = comp.deepSkyTargets();
      expect(targets.length).toBeGreaterThan(0);

      const firstId = targets[0].id;
      expect(comp.checkedTargetIds().has(firstId)).toBe(false);

      comp.toggleTarget(firstId);
      expect(comp.checkedTargetIds().has(firstId)).toBe(true);

      comp.toggleTarget(firstId);
      expect(comp.checkedTargetIds().has(firstId)).toBe(false);

      comp.selectPlanisphereObject('moon');
      expect(comp.selectedPlanisphereObject()).toBe('moon');
      expect(comp.selectedBodyInfo()?.name).toBe('The Moon');

      comp.selectPlanisphereObject('moon');
      expect(comp.selectedPlanisphereObject()).toBeNull();
      expect(comp.selectedBodyInfo()).toBeNull();
    });
  });
});
