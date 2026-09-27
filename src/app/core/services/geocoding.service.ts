import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, from } from 'rxjs';
import { GeoLocation } from '../models/location.model';
import { LocationService } from './location.service';

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
  private readonly locationService = inject(LocationService);
  private readonly cache = new Map<string, GeoLocation[]>();
  private readonly endpoint = '/api/v1/locations/search';
  private countries$?: Observable<GeoLocation[]>;

  /** Return the complete internal location catalogue when a feature needs to browse it. */
  getAllLocations(): Observable<GeoLocation[]> {
    if (!this.countries$) {
      this.countries$ = from(this.locationService.loadLocations()).pipe(
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.countries$;
  }

  getCountries(): Observable<GeoLocation[]> {
    return this.getAllLocations();
  }

  search(query: string, count = 50): Observable<GeoLocation[]> {
    const term = query.trim();
    if (term.length < 2) return of([]);

    const key = term.toLocaleLowerCase();
    const cached = this.cache.get(key);
    if (cached) return of(cached.slice(0, count));

    const params = new HttpParams()
      .set('q', term)
      .set('count', Math.min(50, Math.max(1, count)));

    return this.http.get<InternalLocationSearchResponse>(this.endpoint, { params }).pipe(
      map(response => (response.locations ?? []).slice(0, count)),
      catchError(() => this.getAllLocations().pipe(
        map(locations => this.filterCatalogue(locations, term, count))
      )),
      map(locations => {
        this.cache.set(key, locations);
        return locations;
      })
    );
  }

  private filterCatalogue(locations: GeoLocation[], query: string, count: number): GeoLocation[] {
    const normalized = query.normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase();
    return locations
      .filter(location => [location.name, location.country, location.countryCode, location.timezone]
        .some(value => String(value).normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').toLocaleLowerCase().includes(normalized)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, count);
  }
}
