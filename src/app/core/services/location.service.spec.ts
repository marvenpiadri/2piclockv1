import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { LocationService } from './location.service';
import { WeatherService } from './weather.service';
import { HttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { PRESET_LOCATIONS, GeoLocation } from '../models/location.model';

describe('LocationService Unit Tests (Jasmine / Karma compliant)', () => {
  let locationService: LocationService;
  let weatherService: WeatherService;

  beforeEach(() => {
    const injector = Injector.create({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: HttpClient, useValue: { get: () => of({}) } },
        WeatherService,
        LocationService
      ]
    });

    locationService = injector.get(LocationService);
    weatherService = injector.get(WeatherService);
  });

  it('should create the LocationService instance and populate initial presets', () => {
    expect(locationService).toBeTruthy();
    expect(locationService.allPresets.length).toBeGreaterThan(0);
    expect(locationService.selectedLocation()).toBeDefined();
    expect(locationService.selectedLocation().name).toBeTruthy();
  });

  it('should select a new location and reset atmospheric override', () => {
    const london: GeoLocation = PRESET_LOCATIONS.find(l => l.countryCode === 'GB') || PRESET_LOCATIONS[1];
    
    // Set an override first
    weatherService.setOverride({ condition: 'thunderstorm', temperatureC: 30 });
    expect(weatherService.overrideConfig().active).toBe(true);

    // Now select location
    locationService.selectLocation(london);
    expect(locationService.selectedLocation().name).toBe(london.name);
    expect(locationService.selectedLocation().countryCode).toBe(london.countryCode);
    
    // Weather override should be cleared
    expect(weatherService.overrideConfig().active).toBe(false);
  });

  it('should set custom coordinates correctly with appropriate defaults', () => {
    const customLat = 48.8566;
    const customLng = 2.3522;
    const customName = 'Paris Custom Spot';

    locationService.setCustomCoordinates(customName, customLat, customLng, 'Europe/Paris');

    const selected = locationService.selectedLocation();
    expect(selected.name).toBe(customName);
    expect(selected.latitude).toBe(customLat);
    expect(selected.longitude).toBe(customLng);
    expect(selected.timezone).toBe('Europe/Paris');
    expect(selected.isCustom).toBe(true);
  });

  it('should manage the location watchlist correctly', () => {
    const loc1 = PRESET_LOCATIONS[0];
    const loc2 = PRESET_LOCATIONS[1];

    locationService.addToWatchlist(loc1);
    expect(locationService.watchlist().some(l => l.id === loc1.id)).toBe(true);

    locationService.addToWatchlist(loc2);
    expect(locationService.watchlist().length).toBeGreaterThanOrEqual(2);

    locationService.removeFromWatchlist(loc1.id);
    expect(locationService.watchlist().some(l => l.id === loc1.id)).toBe(false);
  });

  it('should return appropriate country flags or fallback indicators', () => {
    expect(locationService.getCountryFlag('JP')).toBeTruthy();
    expect(locationService.getCountryFlag('GPS')).toBe('📍');
    expect(locationService.getCountryFlag('')).toBe('🌐');
  });
});
