import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { GeoLocation, PRESET_LOCATIONS } from '../models/location.model';

@Injectable({
  providedIn: 'root'
})
export class LocationService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  readonly allPresets: GeoLocation[] = PRESET_LOCATIONS;
  readonly selectedLocation = signal<GeoLocation>(PRESET_LOCATIONS[0]); // Default to Tokyo or local
  readonly watchlist = signal<GeoLocation[]>([
    PRESET_LOCATIONS[0], // Tokyo
    PRESET_LOCATIONS[1], // London
    PRESET_LOCATIONS[2], // New York
    PRESET_LOCATIONS[3], // Paris
    PRESET_LOCATIONS[4], // Casablanca
    PRESET_LOCATIONS[7]  // Reykjavik
  ]);

  readonly isLocating = signal<boolean>(false);
  readonly locationError = signal<string | null>(null);

  constructor() {
    if (this.isBrowser) {
      try {
        const savedLocId = localStorage.getItem('2piclock_selected_location');
        if (savedLocId) {
          const found = this.allPresets.find(l => l.id === savedLocId);
          if (found) {
            this.selectedLocation.set(found);
          } else {
            const custom = JSON.parse(savedLocId);
            if (custom && custom.latitude && custom.longitude) {
              this.selectedLocation.set(custom);
            }
          }
        }
      } catch {
        // Fallback to default
      }
    }
  }

  selectLocation(loc: GeoLocation): void {
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
   * otherwise try browser GPS, then use a deterministic preset fallback.
   */
  async ensureInitialLocation(): Promise<GeoLocation> {
    const current = this.selectedLocation();
    if (this.isBrowser) {
      const saved = localStorage.getItem('2piclock_selected_location');
      if (saved) return current;
      const detected = await this.detectUserLocation();
      if (detected) return detected;
    }

    const fallback = this.allPresets[Math.floor(Math.random() * this.allPresets.length)] ?? this.allPresets[0];
    // Do not persist an automatic random fallback; a later visit should get
    // another GPS opportunity. Explicit user choices are persisted by selectLocation().
    this.selectedLocation.set(fallback);
    return fallback;
  }

  addToWatchlist(loc: GeoLocation): void {
    if (!this.watchlist().some(l => l.id === loc.id)) {
      this.watchlist.update(list => [...list, loc]);
    }
  }

  removeFromWatchlist(locId: string): void {
    this.watchlist.update(list => list.filter(l => l.id !== locId));
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
