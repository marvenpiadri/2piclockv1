import { Injectable, REQUEST, inject } from '@angular/core';
import { Observable, catchError, from, map, of, shareReplay } from 'rxjs';
import { GeoLocation } from '../models/location.model';

interface LocationResponse { locations?: GeoLocation[]; }

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly request = inject(REQUEST, { optional: true });
  private readonly isBrowser = typeof window !== 'undefined';
  private readonly cache = new Map<string, GeoLocation[]>();
  private readonly randomLocations$ = from(fetch(this.apiUrl('/api/v1/locations/random?count=50')).then(async response => {
    if (!response.ok) throw new Error('Location discovery unavailable');
    const data = await response.json() as LocationResponse;
    return data.locations ?? [];
  })).pipe(shareReplay({ bufferSize: 1, refCount: true }));

  search(query: string, count = 50): Observable<GeoLocation[]> {
    const term = query.trim();
    if (term.length < 2) return of([]);
    const limit = Math.min(50, Math.max(1, count));
    const key = term.toLocaleLowerCase() + ':' + limit;
    const cached = this.cache.get(key);
    if (cached) return of(cached);
    return from(fetch(this.apiUrl('/api/v1/locations/search?q=' + encodeURIComponent(term) + '&count=' + limit)).then(async response => {
      if (!response.ok) throw new Error('Location search unavailable');
      return await response.json() as LocationResponse;
    })).pipe(
      map(data => data.locations ?? []),
      map(locations => { this.cache.set(key, locations); return locations; }),
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

  getRandomLocations(): Observable<GeoLocation[]> { return this.randomLocations$; }

  getMapLocations(limit = 2500): Observable<GeoLocation[]> {
    const safeLimit = Math.min(5000, Math.max(500, limit));
    return from(fetch(this.apiUrl('/api/v1/locations/map?count=' + safeLimit)).then(async response => {
      if (!response.ok) throw new Error('Map locations unavailable');
      const data = await response.json() as LocationResponse;
      return data.locations ?? [];
    })).pipe(catchError(() => of([])));
  }
}
