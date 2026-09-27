import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, from } from 'rxjs';
import { GeoLocation } from '../models/location.model';
import { LocationService } from './location.service';

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly locationService = inject(LocationService);
  private readonly cache = new Map<string, GeoLocation[]>();
  private countries$?: Observable<GeoLocation[]>;

  /** The generated catalogue is the single authoritative location source for the app. */
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

    return this.getAllLocations().pipe(
      map(locations => this.filterCatalogue(locations, term, count)),
      map(locations => {
        this.cache.set(key, locations);
        return locations;
      }),
      catchError(() => of([]))
    );
  }

  private filterCatalogue(locations: GeoLocation[], query: string, count: number): GeoLocation[] {
    const normalized = this.normalize(query);

    return locations
      .filter(location => [
        location.name,
        location.country,
        location.countryCode,
        location.timezone
      ].some(value => this.normalize(String(value)).includes(normalized)))
      .sort((a, b) => {
        const aName = this.normalize(a.name);
        const bName = this.normalize(b.name);
        const aExact = aName === normalized;
        const bExact = bName === normalized;
        const aPrefix = aName.startsWith(normalized);
        const bPrefix = bName.startsWith(normalized);

        return Number(bExact) - Number(aExact)
          || Number(bPrefix) - Number(aPrefix)
          || a.name.localeCompare(b.name);
      })
      .slice(0, count);
  }

  private normalize(value: string): string {
    return value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .trim();
  }
}
