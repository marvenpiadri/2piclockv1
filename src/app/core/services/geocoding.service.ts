import { Injectable } from '@angular/core';
import { Observable, catchError, defer, from, map, of, shareReplay } from 'rxjs';
import { GeoLocation, DEFAULT_LOCATIONS } from '../models/location.model';

interface LocationResponse { locations?: GeoLocation[]; }

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly isBrowser = typeof window !== 'undefined';
  private readonly cache = new Map<string, GeoLocation[]>();

  private readonly randomLocations$ = defer(() => from(
    fetch(this.apiUrl('/api/v1/locations/random?count=50'))
      .then(async response => {
        if (!response.ok) return DEFAULT_LOCATIONS;
        const data = await response.json() as LocationResponse;
        return (Array.isArray(data.locations) && data.locations.length > 0) ? data.locations : DEFAULT_LOCATIONS;
      })
      .catch(() => DEFAULT_LOCATIONS)
  )).pipe(
    catchError(() => of(DEFAULT_LOCATIONS)),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  search(query: string, count = 50): Observable<GeoLocation[]> {
    const term = query.trim();
    if (term.length < 2) return of([]);
    const limit = Math.min(50, Math.max(1, count));
    const key = term.toLocaleLowerCase() + ':' + limit;
    const cached = this.cache.get(key);
    if (cached) return of(cached);

    return from(
      fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(term) + '&count=' + limit + '&language=en&format=json')
        .then(async response => {
          if (!response.ok) return { results: [] };
          const data = await response.json() as { results?: Array<Record<string, unknown>> };
          return {
            locations: (data.results ?? []).map((item, index): GeoLocation => ({
              id: String(item['id'] ?? `geocoded-${index}-${String(item['latitude'])}-${String(item['longitude'])}`),
              name: String(item['name'] ?? term),
              country: String(item['country'] ?? ''),
              countryCode: String(item['country_code'] ?? '').toUpperCase(),
              flag: this.countryFlag(String(item['country_code'] ?? '')),
              latitude: Number(item['latitude']),
              longitude: Number(item['longitude']),
              timezone: String(item['timezone'] ?? 'UTC')
            }))
          } as LocationResponse;
        })
        .catch(() => ({ locations: [] } as LocationResponse))
    ).pipe(
      map(data => {
        const locations = data.locations ?? [];
        if (!locations.length) {
          const lower = term.toLowerCase();
          const fallbackMatches = DEFAULT_LOCATIONS.filter(l =>
            l.name.toLowerCase().includes(lower) ||
            l.country.toLowerCase().includes(lower) ||
            l.countryCode.toLowerCase().includes(lower)
          );
          if (fallbackMatches.length) return fallbackMatches.slice(0, limit);
        }
        return locations;
      }),
      map(locations => {
        this.cache.set(key, locations);
        return locations;
      }),
      catchError(() => of([]))
    );
  }

  private countryFlag(countryCode: string): string {
    if (!/^[a-z]{2}$/i.test(countryCode)) return '🌐';
    return String.fromCodePoint(...countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt(0)));
  }

  getCountries(): Observable<GeoLocation[]> {
    return this.getRandomLocations();
  }

  getRandomLocations(): Observable<GeoLocation[]> { return this.randomLocations$; }

  getMapLocations(_limit = 2500): Observable<GeoLocation[]> {
    return of(DEFAULT_LOCATIONS);
  }
}
