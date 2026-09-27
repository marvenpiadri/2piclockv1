import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GeoLocation } from '../models/location.model';
import { WeatherService } from './weather.service';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private weatherService = inject(WeatherService);

  private readonly catalogueUrl = '/api/v1/locations';
  private catalogue?: GeoLocation[];
  readonly selectedLocation = signal<GeoLocation>(this.createNeutralLocation());
  readonly watchlist = signal<GeoLocation[]>([]);

  readonly isLocating = signal<boolean>(false);
  readonly locationError = signal<string | null>(null);

  constructor() {
    if (this.isBrowser) {
      try {
        const savedWatchlist = localStorage.getItem('2piclock_watchlist');
        if (savedWatchlist) {
          try {
            const ids = JSON.parse(savedWatchlist) as string[];
            void this.loadCatalogue().then(() => {
              const restored = ids
                .map(id => this.catalogue?.find(loc => loc.id === id))
                .filter((loc): loc is GeoLocation => Boolean(loc));
              if (restored.length > 0) this.watchlist.set(restored);
            });
          } catch {
            // Ignore malformed watchlist data.
          }
        }

        const savedLocId = localStorage.getItem('2piclock_selected_location');
        if (savedLocId) {
          try {
            const custom = JSON.parse(savedLocId) as GeoLocation;
            if (custom && Number.isFinite(Number(custom.latitude)) && Number.isFinite(Number(custom.longitude)) && custom.isCustom) {
              this.selectedLocation.set(custom);
            } else {
              void this.loadCatalogue().then(() => {
                const found = this.catalogue?.find(l => l.id === savedLocId);
                if (found) this.selectedLocation.set(found);
              });
            }
          } catch {
            void this.loadCatalogue().then(() => {
              const found = this.catalogue?.find(l => l.id === savedLocId);
              if (found) this.selectedLocation.set(found);
            });
          }
        }
      } catch {
        // Fallback to default
      }
    }
  }

  selectLocation(loc: GeoLocation): void {
    // A manual atmosphere belongs to the previous location. Clear it here;
    // CelestialService remains responsible for the single weather fetch trigger.
    this.weatherService.clearOverride();
    this.selectedLocation.set(loc);
    this.locationError.set(null);
    if (this.isBrowser) {
      try {
        if (loc.isCustom) {
          localStorage.setItem('2piclock_selected_location', JSON.stringify(loc));
        } else {
          localStorage.setItem('2piclock_selected_location', loc.id);
        }
      } catch {
        // Ignore storage error
      }
    }
  }

  setCustomCoordinates(name: string, lat: number, lng: number, timezone?: string): void {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const customLoc: GeoLocation = {
      id: `custom-${Date.now()}`,
      name: name || `Custom (${lat.toFixed(2)}°, ${lng.toFixed(2)}°)`,
      country: 'Coordinates',
      countryCode: '🌐',
      flag: '📍',
      latitude: lat,
      longitude: lng,
      timezone: tz,
      isCustom: true
    };
    this.selectLocation(customLoc);
  }

  detectUserLocation(): Promise<GeoLocation | null> {
    if (!this.isBrowser || !navigator.geolocation) {
      this.locationError.set('Geolocation is not supported by your browser.');
      return Promise.resolve(null);
    }

    this.isLocating.set(true);
    this.locationError.set(null);

    return new Promise(resolve => navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.isLocating.set(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

        const userLoc: GeoLocation = {
          id: 'current-location',
          name: 'Current Location',
          country: 'GPS Detected',
          countryCode: 'GPS',
          flag: '📍',
          latitude: Math.round(lat * 10000) / 10000,
          longitude: Math.round(lng * 10000) / 10000,
          timezone: tz,
          elevationMeters: pos.coords.altitude || 10,
          isCustom: true
        };

        this.selectLocation(userLoc);
        resolve(userLoc);
      },
      (err) => {
        this.isLocating.set(false);
        this.locationError.set(err.message || 'Unable to retrieve location.');
        resolve(null);
      },
      { timeout: 5000, enableHighAccuracy: false }
    ));
  }

  /**
   * Resolve a usable location for the root experience. A saved choice wins;
   * otherwise try browser GPS, then use the library catalogue.
   */
  async ensureInitialLocation(): Promise<GeoLocation> {
    const current = this.selectedLocation();
    if (this.isBrowser) {
      try {
        const saved = localStorage.getItem('2piclock_selected_location');
        if (saved) return current;
      } catch {
        // Storage can be unavailable in private/restricted browser contexts.
      }

      const detected = await this.detectUserLocation();
      if (detected) return detected;
    }

    // Keep the no-GPS fallback deterministic by selecting a city from the library catalogue.
    const catalogue = await this.loadCatalogue();
    const timezone = this.isBrowser ? Intl.DateTimeFormat().resolvedOptions().timeZone : '';
    const fallback = catalogue.find(loc => loc.timezone === timezone) ?? catalogue[0] ?? current;
    this.selectedLocation.set(fallback);
    return fallback;
  }

  private createNeutralLocation(): GeoLocation {
    return {
      id: 'initializing',
      name: 'Current location',
      country: 'Location',
      countryCode: '',
      flag: '📍',
      latitude: 0,
      longitude: 0,
      timezone: 'UTC',
      isCustom: true
    };
  }

  private async loadCatalogue(): Promise<GeoLocation[]> {
    if (this.catalogue) return this.catalogue;
    try {
      const response = await fetch(this.catalogueUrl);
      if (!response.ok) throw new Error('Location catalogue unavailable');
      const data = await response.json() as { locations?: GeoLocation[] };
      this.catalogue = data.locations ?? [];
    } catch {
      this.catalogue = [];
    }
    return this.catalogue;
  }

  addToWatchlist(loc: GeoLocation): void {
    if (!this.watchlist().some(l => l.id === loc.id)) {
      this.watchlist.update(list => [...list, loc]);
      this.persistWatchlist();
    }
  }

  removeFromWatchlist(locId: string): void {
    this.watchlist.update(list => list.filter(l => l.id !== locId));
    this.persistWatchlist();
  }

  private persistWatchlist(): void {
    if (!this.isBrowser) return;
    try {
      localStorage.setItem(
        '2piclock_watchlist',
        JSON.stringify(this.watchlist().filter(loc => !loc.isCustom).map(loc => loc.id))
      );
    } catch {
      // Ignore storage errors.
    }
  }

  getCountryFlag(countryCode: string): string {
    if (!countryCode || countryCode.length !== 2) {
      return countryCode === 'GPS' ? '📍' : '🌐';
    }
    try {
      const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
      return String.fromCodePoint(...codePoints);
    } catch {
      return '🏳️';
    }
  }
}
