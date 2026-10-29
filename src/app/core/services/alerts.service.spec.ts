import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, PLATFORM_ID, runInInjectionContext } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { AlertsService } from './alerts.service';
import { LocationService } from './location.service';
import { TimeControlService } from './time-control.service';
import { CelestialService } from './celestial.service';
import { WeatherService } from './weather.service';
import { PrecisionAstronomyService } from './precision-astronomy.service';

describe('AlertsService Unit Tests', () => {
  let injector: Injector;
  let service: AlertsService;

  beforeEach(() => {
    injector = Injector.create({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: HttpClient, useValue: { get: () => of({}), post: () => of({}) } },
        LocationService,
        TimeControlService,
        WeatherService,
        PrecisionAstronomyService,
        CelestialService,
        AlertsService
      ]
    });

    service = injector.get(AlertsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should provide liveAlerts array signal', () => {
    runInInjectionContext(injector, () => {
      const alerts = service.liveAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });

  it('should compute critical alerts count', () => {
    runInInjectionContext(injector, () => {
      const count = service.criticalCount();
      expect(typeof count).toBe('number');
    });
  });

  it('should allow toggling audio enabled setting', () => {
    runInInjectionContext(injector, () => {
      expect(service.audioEnabled()).toBe(false);
      service.toggleAudio();
      expect(service.audioEnabled()).toBe(true);
      service.toggleAudio();
      expect(service.audioEnabled()).toBe(false);
    });
  });

  it('should support setting and clearing simulated alerts', () => {
    runInInjectionContext(injector, () => {
      service.setSimulatedAlert({
        id: 'test-sim',
        title: 'Test Geomagnetic Storm',
        category: 'space_weather',
        categoryLabel: 'Space Weather',
        severity: 'critical',
        severityLabel: 'Critical Warning',
        description: 'Simulated storm for testing',
        safetyAdvice: 'Take precautions',
        metricLabel: 'Kp',
        metricValue: 'Kp 8',
        issuedAt: new Date(),
        locationName: 'Test City',
        coordinates: '0, 0',
        icon: 'flare',
        badgeBg: 'red',
        badgeColor: 'white',
        cardBorderColor: 'red',
        isSimulated: true
      });

      let alerts = service.liveAlerts();
      expect(alerts.some(a => a.id === 'test-sim')).toBe(true);

      service.clearSimulatedAlert();
      alerts = service.liveAlerts();
      expect(alerts.some(a => a.id === 'test-sim')).toBe(false);
    });
  });
});
