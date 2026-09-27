import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import { GeoLocation } from '../models/location.model';

interface InternalLocationSearchResponse {
  locations?: GeoLocation[];
}

/**
 * Internal-first global location catalogue.
 *
 * The application owns its canonical location index and exposes it through
 * the versioned server API. This keeps normal location search independent of
 * third-party geocoding APIs. External geocoding can be reintroduced later
 * only as an explicit fallback for locations outside the internal catalogue.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, GeoLocation[]>();
  private readonly endpoint = '/api/v1/locations/search';
  private countries$?: Observable<GeoLocation[]>;

  getCountries(): Observable<GeoLocation[]> {
    if (!this.countries$) {
      this.countries$ = this.http.get<{ locations?: GeoLocation[] }>('/api/v1/locations').pipe(
        map(response => response.locations ?? []),
        shareReplay({ bufferSize: 1, refCount: true }),
        catchError(() => of([]))
      );
    }
    return this.countries$;
  }

  search(query: string, count = 8): Observable<GeoLocation[]> {
    const term = query.trim();
    if (term.length < 2) return of([]);

    const key = term.toLocaleLowerCase();
    const cached = this.cache.get(key);
    if (cached) return of(cached.slice(0, count));

    const params = new HttpParams()
      .set('q', term)
      .set('count', Math.min(20, Math.max(1, count)));

    return this.http.get<InternalLocationSearchResponse>(this.endpoint, { params }).pipe(
      map(response => {
        const locations = (response.locations ?? []).slice(0, count);
        this.cache.set(key, locations);
        return locations;
      }),
      catchError(() => of([]))
    );
  }
}
