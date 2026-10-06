import { Injectable, REQUEST, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, defer, map, of, shareReplay } from 'rxjs';
import { GeoLocation, DEFAULT_LOCATIONS } from '../models/location.model';

interface LocationResponse { locations?: GeoLocation[]; }

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly request = inject(REQUEST, { optional: true });
  private readonly http = inject(HttpClient);
  private readonly isBrowser = typeof window !== 'undefined';
  private readonly cache = new Map<string, GeoLocation[]>();

  private readonly randomLocations$ = defer(() =>
    this.http.get<LocationResponse>(this.apiUrl('/api/v1/locations/random?count=50')).pipe(
      map(data => Array.isArray(data.locations) && data.locations.length > 0 ? data.locations : DEFAULT_LOCATIONS),
      catchError(() => of(DEFAULT_LOCATIONS))
    )
  ).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  search(query: string, count = 50): Observable<GeoLocation[]> {
    const term = query.trim();
    if (term.length < 2) return of([]);

    const limit = Math.min(50, Math.max(1, count));
    const key = term.toLocaleLowerCase() + ':' + limit;
    const cached = this.cache.get(key);
    if (cached) return of(cached);

    const params = new HttpParams()
      .set('q', term)
      .set('count', limit);

    return this.http.get<LocationResponse>(this.apiUrl('/api/v1/locations/search'), { params }).pipe(
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

  private apiUrl(path: string): string {
    if (this.isBrowser) return path;
    const requestUrl = this.request?.url;
    return requestUrl ? new URL(path, requestUrl).toString() : path;
  }

  getCountries(): Observable<GeoLocation[]> {
    return this.getRandomLocations();
  }

  getRandomLocations(): Observable<GeoLocation[]> {
    return this.randomLocations$;
  }

  getMapLocations(limit = 2500): Observable<GeoLocation[]> {
    const safeLimit = Math.min(5000, Math.max(500, limit));
    return this.http.get<LocationResponse>(
      this.apiUrl('/api/v1/locations/map?count=' + safeLimit)
    ).pipe(
      map(data => Array.isArray(data.locations) && data.locations.length > 0 ? data.locations : DEFAULT_LOCATIONS),
      catchError(() => of(DEFAULT_LOCATIONS))
    );
  }
}
