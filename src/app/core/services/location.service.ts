import { Injectable, signal, PLATFORM_ID, REQUEST, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { GeoLocation } from '../models/location.model';
import { WeatherService } from './weather.service';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly request = inject(REQUEST, { optional: true });
  private readonly weatherService = inject(WeatherService);
  private readonly http = inject(HttpClient);
  private readonly randomLocationsUrl = '/api/v1/locations/random?count=50';
  private readonly selectedLocationStore = 'selected-location';
  private readonly savedLocationsStore = 'saved-locations';
  private locationLoadPromise?: Promise<GeoLocation[]>;
  private initialLocationPromise?: Promise<GeoLocation>;
  private resolvedInitialLocation?: GeoLocation;
  private geolocationPromise?: Promise<GeoLocation | null>;
  readonly randomLocations = signal<GeoLocation[]>([]);
  readonly locations = signal<GeoLocation[]>([]);
  readonly selectedLocation = signal<GeoLocation>({ id: 'initializing', name: 'Current location', country: 'Location', countryCode: '', flag: '📍', latitude: 0, longitude: 0, timezone: 'UTC', isCustom: true });
  readonly watchlist = signal<GeoLocation[]>([]);
  readonly isLocating = signal<boolean>(false);
  readonly locationError = signal<string | null>(null);

  constructor() {
    if (this.isBrowser) {
      void this.restoreStoredLocations().catch(() => undefined);
    }
  }

  async loadLocations(): Promise<GeoLocation[]> {
    if (this.locations().length > 0) return this.locations();
    if (this.locationLoadPromise) return this.locationLoadPromise;
    this.locationLoadPromise = firstValueFrom(this.http.get<{ locations?: GeoLocation[] }>(this.apiUrl(this.randomLocationsUrl)))
      .then(data => {
        const locations = Array.isArray(data.locations) ? data.locations : [];
        this.locations.set(locations);
        this.randomLocations.set(locations);
        this.locationError.set(null);
        return locations;
      })
      .catch(() => {
        this.locations.set([]);
        this.randomLocations.set([]);
        this.locationError.set(null);
        return [];
      })
      .finally(() => {
        this.locationLoadPromise = undefined;
      });
    return this.locationLoadPromise;
  }

  async getLocation(identifier: string): Promise<GeoLocation | null> {
    const normalized = identifier.trim().toLowerCase();
    if (!normalized) return null;
    const local = this.locations().find(location =>
      location.id.toLowerCase() === normalized ||
      this.getLocationSlug(location).toLowerCase() === normalized ||
      location.name.toLowerCase() === normalized
    );
    if (local) return local;
    try {
      const data = await firstValueFrom(this.http.get<{ location?: GeoLocation }>(this.apiUrl('/api/v1/locations/' + encodeURIComponent(normalized))));
      return data.location ?? null;
    } catch {
      return null;
    }
  }

  getLocationSlug(location: GeoLocation): string {
    return this.slugify(location.country) + '/' + this.slugify(location.name);
  }

  getLocationPath(location: GeoLocation, section?: string): string[] {
    const path = this.getLocationSlug(location).split('/');
    return section ? [...path, section] : path;
  }

  private slugify(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async ensureInitialLocation(): Promise<GeoLocation> {
    if (this.resolvedInitialLocation) return this.resolvedInitialLocation;
    if (this.initialLocationPromise) return this.initialLocationPromise;

    this.initialLocationPromise = this.resolveInitialLocation()
      .then(location => {
        this.resolvedInitialLocation = location;
        return location;
      })
      .finally(() => {
        this.initialLocationPromise = undefined;
      });

    return this.initialLocationPromise;
  }

  private async resolveInitialLocation(): Promise<GeoLocation> {
    const current = this.selectedLocation();
    try {
      if (this.isBrowser) {
        const saved = await this.readSelectedLocation();
        if (saved) {
          this.selectedLocation.set(saved);
          return saved;
        }
        const detected = await this.detectUserLocation();
        if (detected) return detected;
      }
    } catch {
      // Fall through to catalogue or timezone match
    }

    let locations: GeoLocation[] = [];
    try {
      locations = await this.loadLocations();
    } catch {
      locations = [];
    }

    const timezone = this.isBrowser ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '') : '';
    const fallback = (timezone ? locations.find((location: GeoLocation) => location.timezone === timezone) : null) ??
      locations[0] ?? current;

    this.selectedLocation.set(fallback);
    if (this.isBrowser) {
      void this.persistSelectedLocation(fallback).catch(() => undefined);
    }
    return fallback;
  }

  selectLocation(loc: GeoLocation): void { this.weatherService.clearOverride(); this.selectedLocation.set(loc); this.locationError.set(null); if (this.isBrowser) void this.persistSelectedLocation(loc); }

  setCustomCoordinates(name: string, lat: number, lng: number, timezone?: string): void {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    this.selectLocation({ id: 'custom-' + Date.now(), name: name || 'Custom (' + lat.toFixed(2) + '°, ' + lng.toFixed(2) + '°)', country: 'Coordinates', countryCode: '🌐', flag: '📍', latitude: lat, longitude: lng, timezone: tz, isCustom: true });
  }

  detectUserLocation(): Promise<GeoLocation | null> {
    if (this.geolocationPromise) return this.geolocationPromise;
    if (!this.isBrowser || !navigator.geolocation) {
      this.locationError.set('Geolocation is not supported by your browser.');
      return Promise.resolve(null);
    }

    this.isLocating.set(true);
    this.locationError.set(null);
    this.geolocationPromise = new Promise<GeoLocation | null>(resolve => navigator.geolocation.getCurrentPosition(
      async pos => {
        const latitude = Math.round(pos.coords.latitude * 10000) / 10000;
        const longitude = Math.round(pos.coords.longitude * 10000) / 10000;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

        try {
          const data = await firstValueFrom(this.http.get<{ location?: GeoLocation }>(this.apiUrl('/api/v1/locations/nearest?latitude=' + latitude + '&longitude=' + longitude)));
          if (data.location) {
            this.isLocating.set(false);
            this.selectLocation(data.location);
            resolve(data.location);
            return;
          }
        } catch (error) {
          void error;
          // Fall back to the exact GPS coordinates when the city catalogue is unavailable.
        }

        this.isLocating.set(false);
        const userLoc: GeoLocation = {
          id: 'current-location',
          name: 'Current Location',
          country: 'GPS Detected',
          countryCode: 'GPS',
          flag: '📍',
          latitude,
          longitude,
          timezone,
          elevationMeters: pos.coords.altitude || 10,
          isCustom: true
        };
        this.selectLocation(userLoc);
        resolve(userLoc);
      },
      err => { this.isLocating.set(false); this.locationError.set(err.message || 'Unable to retrieve location.'); resolve(null); },
      { timeout: 5000, enableHighAccuracy: false }
    )).finally(() => {
      this.geolocationPromise = undefined;
    });

    return this.geolocationPromise;
  }

  refreshRandomLocations(): void { this.locationLoadPromise = undefined; this.locations.set([]); void this.loadLocations().catch(() => undefined); }
  addToWatchlist(loc: GeoLocation): void { if (!this.watchlist().some(item => item.id === loc.id)) { this.watchlist.update(list => [...list, loc]); void this.persistWatchlist(); } }
  removeFromWatchlist(locId: string): void { this.watchlist.update(list => list.filter(item => item.id !== locId)); void this.persistWatchlist(); }
  getCountryFlag(countryCode: string): string { if (!countryCode || countryCode.length !== 2) return countryCode === 'GPS' ? '📍' : '🌐'; try { return String.fromCodePoint(...countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0))); } catch { return '🏳️'; } }
  private apiUrl(path: string): string {
    if (this.isBrowser) return path;
    const requestUrl = this.request?.url;
    return requestUrl ? new URL(path, requestUrl).toString() : path;
  }

  private async restoreStoredLocations(): Promise<void> {
    try {
      const [selected, saved] = await Promise.all([
        this.readSelectedLocation(),
        this.readSavedLocations()
      ]);

      if (selected) {
        // Catalogue locations are re-resolved so persisted data cannot carry a
        // stale timezone after the underlying city/timezone dataset changes.
        const canonical = selected.isCustom ? null : await this.getLocation(selected.id);
        const restored = canonical ?? selected;
        this.selectedLocation.set(restored);
        if (this.isBrowser) await this.persistSelectedLocation(restored);
      }

      const canonicalWatchlist = await Promise.all(
        saved.map(async location => {
          if (location.isCustom) return location;
          return (await this.getLocation(location.id)) ?? location;
        })
      );
      this.watchlist.set(canonicalWatchlist);
    } catch {
      // Ignore local storage / indexedDB restore errors
    }
  }
  private openDatabase(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open('2piClockLocations', 1); request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(this.selectedLocationStore)) db.createObjectStore(this.selectedLocationStore); if (!db.objectStoreNames.contains(this.savedLocationsStore)) db.createObjectStore(this.savedLocationsStore, { keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable')); }); }
  private async readSelectedLocation(): Promise<GeoLocation | null> { try { const db = await this.openDatabase(); return await new Promise(resolve => { const request = db.transaction(this.selectedLocationStore, 'readonly').objectStore(this.selectedLocationStore).get('current'); request.onsuccess = () => resolve((request.result as GeoLocation | undefined) ?? null); request.onerror = () => resolve(null); }); } catch { return null; } }
  private async persistSelectedLocation(location: GeoLocation): Promise<void> { try { const db = await this.openDatabase(); await new Promise<void>((resolve, reject) => { const request = db.transaction(this.selectedLocationStore, 'readwrite').objectStore(this.selectedLocationStore).put(location, 'current'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); } catch { /* Optional local persistence. */ } }
  private async readSavedLocations(): Promise<GeoLocation[]> { try { const db = await this.openDatabase(); return await new Promise(resolve => { const request = db.transaction(this.savedLocationsStore, 'readonly').objectStore(this.savedLocationsStore).getAll(); request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result as GeoLocation[] : []); request.onerror = () => resolve([]); }); } catch { return []; } }
  private async persistWatchlist(): Promise<void> { try { const db = await this.openDatabase(); const store = db.transaction(this.savedLocationsStore, 'readwrite').objectStore(this.savedLocationsStore); store.clear(); for (const location of this.watchlist()) if (!location.isCustom) store.put(location); } catch { /* Optional local persistence. */ } }
}
