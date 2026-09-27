import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GeoLocation } from '../models/location.model';
import { WeatherService } from './weather.service';

@Injectable({ providedIn: 'root' })
export class LocationService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly weatherService = inject(WeatherService);
  private readonly randomLocationsUrl = '/api/v1/locations/random?count=50';
  private readonly selectedLocationStore = 'selected-location';
  private readonly savedLocationsStore = 'saved-locations';
  private locationLoadPromise?: Promise<GeoLocation[]>;
  readonly randomLocations = signal<GeoLocation[]>([]);
  readonly locations = signal<GeoLocation[]>([]);
  readonly selectedLocation = signal<GeoLocation>(this.createNeutralLocation());
  readonly watchlist = signal<GeoLocation[]>([]);
  readonly isLocating = signal<boolean>(false);
  readonly locationError = signal<string | null>(null);

  constructor() { if (this.isBrowser) void this.restoreStoredLocations(); }

  async loadLocations(): Promise<GeoLocation[]> {
    if (this.locations().length > 0) return this.locations();
    if (this.locationLoadPromise) return this.locationLoadPromise;
    this.locationLoadPromise = fetch(this.randomLocationsUrl).then(async response => {
      if (!response.ok) throw new Error('Location discovery unavailable');
      const data = await response.json() as { locations?: GeoLocation[] };
      const locations = Array.isArray(data.locations) ? data.locations : [];
      if (!locations.length) throw new Error('Location discovery returned no cities');
      this.locations.set(locations); this.randomLocations.set(locations); this.locationError.set(null); return locations;
    }).catch(error => { this.locationLoadPromise = undefined; this.locationError.set(error instanceof Error ? error.message : 'Location discovery is temporarily unavailable.'); throw error; });
    return this.locationLoadPromise;
  }

  async getLocation(id: string): Promise<GeoLocation | null> {
    const normalizedId = id.trim(); if (!normalizedId) return null;
    const local = this.locations().find(location => location.id === normalizedId); if (local) return local;
    try { const response = await fetch('/api/v1/locations/' + encodeURIComponent(normalizedId)); if (!response.ok) return null; const data = await response.json() as { location?: GeoLocation }; return data.location ?? null; } catch { return null; }
  }

  async ensureInitialLocation(): Promise<GeoLocation> {
    const current = this.selectedLocation();
    if (this.isBrowser) { const saved = await this.readSelectedLocation(); if (saved) { this.selectedLocation.set(saved); return saved; } const detected = await this.detectUserLocation(); if (detected) return detected; }
    const locations = await this.loadLocations();
    const timezone = this.isBrowser ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
    const fallback = locations.find(location => location.timezone === timezone) ?? locations[0] ?? current;
    this.selectedLocation.set(fallback); if (this.isBrowser) await this.persistSelectedLocation(fallback); return fallback;
  }

  selectLocation(loc: GeoLocation): void { this.weatherService.clearOverride(); this.selectedLocation.set(loc); this.locationError.set(null); if (this.isBrowser) void this.persistSelectedLocation(loc); }

  setCustomCoordinates(name: string, lat: number, lng: number, timezone?: string): void {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    this.selectLocation({ id: 'custom-' + Date.now(), name: name || 'Custom (' + lat.toFixed(2) + '°, ' + lng.toFixed(2) + '°)', country: 'Coordinates', countryCode: '🌐', flag: '📍', latitude: lat, longitude: lng, timezone: tz, isCustom: true });
  }

  detectUserLocation(): Promise<GeoLocation | null> {
    if (!this.isBrowser || !navigator.geolocation) { this.locationError.set('Geolocation is not supported by your browser.'); return Promise.resolve(null); }
    this.isLocating.set(true); this.locationError.set(null);
    return new Promise(resolve => navigator.geolocation.getCurrentPosition(
      pos => { this.isLocating.set(false); const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; const userLoc: GeoLocation = { id: 'current-location', name: 'Current Location', country: 'GPS Detected', countryCode: 'GPS', flag: '📍', latitude: Math.round(pos.coords.latitude * 10000) / 10000, longitude: Math.round(pos.coords.longitude * 10000) / 10000, timezone: tz, elevationMeters: pos.coords.altitude || 10, isCustom: true }; this.selectLocation(userLoc); resolve(userLoc); },
      err => { this.isLocating.set(false); this.locationError.set(err.message || 'Unable to retrieve location.'); resolve(null); },
      { timeout: 5000, enableHighAccuracy: false }
    ));
  }

  refreshRandomLocations(): void { this.locationLoadPromise = undefined; this.locations.set([]); void this.loadLocations().catch(() => undefined); }
  addToWatchlist(loc: GeoLocation): void { if (!this.watchlist().some(item => item.id === loc.id)) { this.watchlist.update(list => [...list, loc]); void this.persistWatchlist(); } }
  removeFromWatchlist(locId: string): void { this.watchlist.update(list => list.filter(item => item.id !== locId)); void this.persistWatchlist(); }
  getCountryFlag(countryCode: string): string { if (!countryCode || countryCode.length !== 2) return countryCode === 'GPS' ? '📍' : '🌐'; try { return String.fromCodePoint(...countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0))); } catch { return '🏳️'; } }
  private createNeutralLocation(): GeoLocation { return { id: 'initializing', name: 'Current location', country: 'Location', countryCode: '', flag: '📍', latitude: 0, longitude: 0, timezone: 'UTC', isCustom: true }; }
  private async restoreStoredLocations(): Promise<void> { const [selected, saved] = await Promise.all([this.readSelectedLocation(), this.readSavedLocations()]); if (selected) this.selectedLocation.set(selected); this.watchlist.set(saved); }
  private openDatabase(): Promise<IDBDatabase> { return new Promise((resolve, reject) => { const request = indexedDB.open('2piClockLocations', 1); request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(this.selectedLocationStore)) db.createObjectStore(this.selectedLocationStore); if (!db.objectStoreNames.contains(this.savedLocationsStore)) db.createObjectStore(this.savedLocationsStore, { keyPath: 'id' }); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable')); }); }
  private async readSelectedLocation(): Promise<GeoLocation | null> { try { const db = await this.openDatabase(); return await new Promise(resolve => { const request = db.transaction(this.selectedLocationStore, 'readonly').objectStore(this.selectedLocationStore).get('current'); request.onsuccess = () => resolve((request.result as GeoLocation | undefined) ?? null); request.onerror = () => resolve(null); }); } catch { return null; } }
  private async persistSelectedLocation(location: GeoLocation): Promise<void> { try { const db = await this.openDatabase(); await new Promise<void>((resolve, reject) => { const request = db.transaction(this.selectedLocationStore, 'readwrite').objectStore(this.selectedLocationStore).put(location, 'current'); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); }); } catch { /* Optional local persistence. */ } }
  private async readSavedLocations(): Promise<GeoLocation[]> { try { const db = await this.openDatabase(); return await new Promise(resolve => { const request = db.transaction(this.savedLocationsStore, 'readonly').objectStore(this.savedLocationsStore).getAll(); request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result as GeoLocation[] : []); request.onerror = () => resolve([]); }); } catch { return []; } }
  private async persistWatchlist(): Promise<void> { try { const db = await this.openDatabase(); const store = db.transaction(this.savedLocationsStore, 'readwrite').objectStore(this.savedLocationsStore); store.clear(); for (const location of this.watchlist()) if (!location.isCustom) store.put(location); } catch { /* Optional local persistence. */ } }
}
