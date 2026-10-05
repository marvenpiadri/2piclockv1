import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { LocationService } from '../../../core/services/location.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { CelestialService } from '../../../core/services/celestial.service';
import { WeatherService } from '../../../core/services/weather.service';
import { RadioService } from '../../../core/services/radio.service';
import { MapBackboneService } from '../../../core/services/map-backbone.service';
import { RadioStation } from '../../../core/models/radio.model';
import { GeoLocation } from '../../../core/models/location.model';
import { GeocodingService } from '../../../core/services/geocoding.service';
import {
  calculateSubsolarPoint,
  calculateSublunarPoint,
  calculateSolarPosition,
  calculateSolarEvents
} from '../../../core/astronomy/astronomy-engine';
import { Map as MapLibreMap, Marker, GeoJSONSource } from 'maplibre-gl';

export interface WorldHubStatus {
  location: GeoLocation;
  localTime: string;
  localTimeWithSeconds: string;
  solarAltitude: number;
  solarAzimuth: number;
  isDaylight: boolean;
  astroState: 'day' | 'civil-twilight' | 'nautical-twilight' | 'astro-twilight' | 'night';
  statusLabel: string;
  utcOffset: string;
  sunriseTime: string;
  sunsetTime: string;
  solarNoonTime: string;
  dayLengthMinutes: number;
  twoPiPhaseRad: number;
  twoPiPhasePercent: number;
}

export interface MapProbePoint {
  latitude: number;
  longitude: number;
  name: string;
  solarAltitude: number;
  solarAzimuth: number;
  isDaylight: boolean;
  statusLabel: string;
  sunrise: string;
  solarNoon: string;
  sunset: string;
  dayLengthMinutes: number;
  distanceFromObserverKm: number;
  bearingFromObserverDeg: number;
}

export interface ObservatoryPreset {
  id: string;
  name: string;
  subname: string;
  icon: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevationM: number;
}

export type MapThemeMode = 'nasa' | 'midnight' | 'blueprint';

const MAP_THEMES: Record<MapThemeMode, any> = {
  nasa: {
    version: 8,
    name: '2PiClock NASA Scientific Earth',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet'
      }
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#0a1628' }
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': '#0d2242', 'fill-opacity': 0.98 }
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: { 'fill-color': '#182638', 'fill-opacity': 0.95 }
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        paint: { 'fill-color': '#182638', 'fill-opacity': 0.95 }
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': '#1a3a60', 'line-width': 0.8, 'line-opacity': 0.6 }
      },
      {
        id: 'boundary_country',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: { 'line-color': '#334863', 'line-width': 0.8, 'line-opacity': 0.55 }
      },
      {
        id: 'boundary_state',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['>', 'admin_level', 2],
        minzoom: 4,
        paint: { 'line-color': '#24354a', 'line-width': 0.5, 'line-opacity': 0.3 }
      }
    ]
  },
  midnight: {
    version: 8,
    name: '2PiClock Midnight Cosmic',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet'
      }
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#030712' }
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': '#090e24', 'fill-opacity': 0.98 }
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: { 'fill-color': '#111827', 'fill-opacity': 0.95 }
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        paint: { 'fill-color': '#111827', 'fill-opacity': 0.95 }
      },
      {
        id: 'boundary_country',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: { 'line-color': '#4f46e5', 'line-width': 0.9, 'line-opacity': 0.5 }
      }
    ]
  },
  blueprint: {
    version: 8,
    name: '2PiClock Astro Blueprint',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet'
      }
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#061727' }
      },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': '#08253d', 'fill-opacity': 0.98 }
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: { 'fill-color': '#0b3552', 'fill-opacity': 0.95 }
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        paint: { 'fill-color': '#0b3552', 'fill-opacity': 0.95 }
      },
      {
        id: 'boundary_country',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: { 'line-color': '#38bdf8', 'line-width': 0.9, 'line-opacity': 0.55 }
      }
    ]
  }
};

export const FAMOUS_OBSERVATORIES: ObservatoryPreset[] = [
  {
    id: 'mauna-kea',
    name: 'Mauna Kea Observatory',
    subname: 'Hawaii, USA',
    icon: 'volcano',
    latitude: 19.823,
    longitude: -155.468,
    timezone: 'Pacific/Honolulu',
    elevationM: 4205
  },
  {
    id: 'alma',
    name: 'ALMA / Paranal Observatory',
    subname: 'Atacama Desert, Chile',
    icon: 'radar',
    latitude: -24.627,
    longitude: -70.404,
    timezone: 'America/Santiago',
    elevationM: 5058
  },
  {
    id: 'greenwich',
    name: 'Royal Observatory Greenwich',
    subname: 'Prime Meridian, UK',
    icon: 'schedule',
    latitude: 51.4769,
    longitude: 0.0005,
    timezone: 'Europe/London',
    elevationM: 48
  },
  {
    id: 'canary-islands',
    name: 'Roque de los Muchachos',
    subname: 'La Palma, Spain',
    icon: 'wb_twilight',
    latitude: 28.761,
    longitude: -17.893,
    timezone: 'Atlantic/Canary',
    elevationM: 2396
  },
  {
    id: 'south-pole',
    name: 'Amundsen-Scott South Pole',
    subname: 'Antarctica',
    icon: 'ac_unit',
    latitude: -90.0,
    longitude: 0.0,
    timezone: 'Antarctica/South_Pole',
    elevationM: 2835
  },
  {
    id: 'tokyo-naoj',
    name: 'National Astro Observatory',
    subname: 'Mitaka, Tokyo, Japan',
    icon: 'satellite_alt',
    latitude: 35.675,
    longitude: 139.538,
    timezone: 'Asia/Tokyo',
    elevationM: 60
  }
];

import { CountryFlagComponent } from '../country-flag/country-flag';

@Component({
  selector: 'app-world-view',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule, CountryFlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './world-view.html',
  styleUrl: './world-view.css'
})
export class WorldViewComponent implements OnInit, OnDestroy {
  @ViewChild('globeContainer', { static: false }) globeContainerRef?: ElementRef<HTMLDivElement>;

  private platformId = inject(PLATFORM_ID);
  readonly isBrowser = isPlatformBrowser(this.platformId);

  private locationService = inject(LocationService);
  private timeControlService = inject(TimeControlService);
  private celestialService = inject(CelestialService);
  private weatherService = inject(WeatherService);
  private geocodingService = inject(GeocodingService);
  readonly radioService = inject(RadioService);
  private readonly mapBackbone = inject(MapBackboneService);

  readonly selectedLocation = this.locationService.selectedLocation;
  readonly activeDate = this.timeControlService.currentActiveDate;
  readonly celestial = this.celestialService.celestialState;
  readonly localTime = this.celestialService.formattedLocalTime;
  readonly isLive = this.timeControlService.isLive;
  readonly currentWeather = this.weatherService.currentWeather;

  // View Display Toggles
  readonly showCityLabels = signal<boolean>(true);
  readonly showTimezoneGrid = signal<boolean>(false);
  readonly showCelestialGrid = signal<boolean>(true);
  readonly showSolarTrack = signal<boolean>(true);
  readonly showMoonZenith = signal<boolean>(true);
  readonly showWorldWeather = signal<boolean>(false);
  readonly currentMapTheme = signal<MapThemeMode>('nasa');
  readonly isMapLoaded = signal<boolean>(false);

  readonly isSearchOpen = signal(false);
  readonly searchQuery = signal('');
  readonly inspectedLocation = signal<GeoLocation | null>(null);
  private map: MapLibreMap | null = null;
  private readonly cityMarkers = new Map<string, Marker>();
  private allMapLocations: GeoLocation[] = [];
  private readonly mapLocationById = new Map<string, GeoLocation>();
  private observerMarker: Marker | null = null;
  private subsolarMarker: Marker | null = null;
  private sublunarMarker: Marker | null = null;
  private probeMarker: Marker | null = null;
  readonly probePoint = signal<MapProbePoint | null>(null);

  private lastLocationId = '';

  // Subsolar Point Calculation (Point where Sun is directly at Zenith Alt 90°)
  readonly subsolarPoint = computed(() => {
    return calculateSubsolarPoint(this.activeDate());
  });

  // Sublunar Point Calculation (Point where Moon is directly Overhead)
  readonly sublunarPoint = computed(() => {
    return calculateSublunarPoint(this.activeDate());
  });

  // Filtered Cities for Search Autocomplete
  readonly remoteSearchResults = signal<GeoLocation[]>([]);
  readonly isRemoteSearching = signal(false);
  private remoteSearchTimer: ReturnType<typeof setTimeout> | null = null;

  readonly observatories = FAMOUS_OBSERVATORIES;
  private worldWeatherSourceReady = false;

  /**
   * Search results come from the complete server-side city catalogue.
   * Presets are only defaults/watchlist data and must never limit map search.
   */
  readonly searchResults = computed<GeoLocation[]>(() => {
    if (this.searchQuery().trim().length < 2) return [];
    return this.remoteSearchResults().slice(0, 20);
  });

  onSearchQueryChange(value: string): void {
    this.searchQuery.set(value);
    if (this.remoteSearchTimer) clearTimeout(this.remoteSearchTimer);
    if (value.trim().length < 2) {
      this.remoteSearchResults.set([]);
      this.isRemoteSearching.set(false);
      return;
    }
    this.remoteSearchTimer = setTimeout(() => {
      this.isRemoteSearching.set(true);
      this.geocodingService.search(value, 50).subscribe(results => {
        this.remoteSearchResults.set(results);
        this.isRemoteSearching.set(false);
      });
    }, 250);
  }

  private markerRenderState = new Map<string, string>();
  private lastSolarTrackLat: number | null = null;

  // Calculates complete WorldHubStatus for a single location on demand
  private calculateLocationStatus(loc: GeoLocation, date: Date): WorldHubStatus {
    const sun = calculateSolarPosition(date, loc.latitude, loc.longitude);
    const sunTimes = calculateSolarEvents(date, loc.latitude, loc.longitude);

    let timeStr: string;
    let timeSecStr: string;
    let utcOffset: string;

    try {
      timeStr = new Intl.DateTimeFormat('en-US', {
        timeZone: loc.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date);

      timeSecStr = new Intl.DateTimeFormat('en-US', {
        timeZone: loc.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(date);

      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: loc.timezone,
        timeZoneName: 'shortOffset'
      }).formatToParts(date);
      const tzPart = parts.find(p => p.type === 'timeZoneName');
      utcOffset = tzPart ? tzPart.value : 'UTC';
    } catch {
      timeStr = '--:--';
    }

    const alt = sun.altitudeDeg;
    const astroState: WorldHubStatus['astroState'] = alt > 0 ? 'day' : alt > -6 ? 'civil-twilight' : alt > -12 ? 'nautical-twilight' : alt > -18 ? 'astro-twilight' : 'night';
    const statusLabel = alt > 6 ? 'Full Daylight' : alt > 0 ? 'Golden Hour' : alt > -6 ? 'Civil Twilight' : alt > -12 ? 'Nautical Twilight' : alt > -18 ? 'Astronomical Twilight' : 'Deep Night';

    // Calculate 2Pi Diurnal Phase [0, 2π] based on local time
    const timeParts = timeSecStr.split(':');
    const h = parseInt(timeParts[0], 10) || 0;
    const m = parseInt(timeParts[1], 10) || 0;
    const s = parseInt(timeParts[2], 10) || 0;
    const secondsSinceMidnight = h * 3600 + m * 60 + s;
    const twoPiPhasePercent = (secondsSinceMidnight / 86400);
    const twoPiPhaseRad = twoPiPhasePercent * 2 * Math.PI;

    return {
      location: loc,
      localTime: timeStr,
      localTimeWithSeconds: timeSecStr,
      solarAltitude: Math.round(alt * 10) / 10,
      solarAzimuth: Math.round(sun.azimuthDeg * 10) / 10,
      isDaylight: alt > 0,
      astroState,
      statusLabel,
      utcOffset,
      sunriseTime: sunTimes.sunrise ? this.formatTimeOnly(sunTimes.sunrise, loc.timezone) : '--:--',
      sunsetTime: sunTimes.sunset ? this.formatTimeOnly(sunTimes.sunset, loc.timezone) : '--:--',
      solarNoonTime: sunTimes.solarNoon ? this.formatTimeOnly(sunTimes.solarNoon, loc.timezone) : '--:--',
      dayLengthMinutes: Math.round(sunTimes.dayLengthMinutes),
      twoPiPhaseRad: Math.round(twoPiPhaseRad * 100) / 100,
      twoPiPhasePercent: Math.round(twoPiPhasePercent * 100)
    };
  }

  // Currently Focused Location Details (either selected observer or inspected city)
  readonly activeCardLocation = computed(() => {
    return this.inspectedLocation() || this.selectedLocation();
  });

  // Focused location status computed directly for the single active card (O(1) instead of O(N))
  readonly activeCardStatus = computed<WorldHubStatus>(() => {
    const loc = this.activeCardLocation();
    const date = this.activeDate();
    return this.calculateLocationStatus(loc, date);
  });

  readonly activeCityStations = computed<RadioStation[]>(() => {
    const loc = this.activeCardLocation();
    return this.radioService.getStationsForLocation(loc.name, loc.country);
  });

  playRadioStation(station: RadioStation): void {
    this.radioService.playStation(station);
  }

  readonly worldHubStatuses = computed<WorldHubStatus[]>(() => [this.activeCardStatus()]);

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const date = this.activeDate();
        const loc = this.selectedLocation();
        const showTz = this.showTimezoneGrid();
        const showCel = this.showCelestialGrid();
        const showTrack = this.showSolarTrack();
        const showWeather = this.showWorldWeather();

        if (this.map && this.isMapLoaded()) {
          this.updateTimezoneLayer(showTz);
          this.updateCelestialGridLayer(showCel);
          this.updateSolarTrackLayer(date, showTrack);
          this.updateWorldWeatherLayer(showWeather);
          this.updateSubsolarMarker();
          this.updateSublunarMarker();
          this.updateObserverMarker(loc);
          this.updateCityMarkerLabels();

          if (loc.id !== this.lastLocationId) this.lastLocationId = loc.id;
        }
      });
    }
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      setTimeout(() => {
        this.initMapLibreMap();
      }, 40);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.cityMarkers.forEach(m => m.remove());
      this.cityMarkers.clear();
      if (this.observerMarker) this.observerMarker.remove();
      if (this.subsolarMarker) this.subsolarMarker.remove();
      if (this.sublunarMarker) this.sublunarMarker.remove();
      if (this.probeMarker) this.probeMarker.remove();
      this.map.remove();
      this.map = null;
    }
  }

  /**
   * Initializes MapLibre with NASA Scientific Blue Earth style (zero API keys required)
   */
  private initMapLibreMap(): void {
    if (!this.globeContainerRef?.nativeElement) return;

    const loc = this.selectedLocation();
    this.lastLocationId = loc.id;
    const map = this.mapBackbone.createMap(
      this.globeContainerRef.nativeElement,
      [loc.longitude, loc.latitude],
      1.8,
      'world'
    );

    this.map = map;

    map.on('load', () => {
      if (!this.map) return;
      this.isMapLoaded.set(true);

      // Add Timezone Meridians Grid
      this.initTimezoneSource();

      // Add Celestial Reference Grid (Equator, Tropics, Polar Circles)
      this.initCelestialGridSource();

      // Add Solar Ground Track
      this.initSolarTrackSource();
      this.initWorldWeatherSource();

      // Add Subsolar Marker
      this.initSubsolarMarker();

      // Add Sublunar Marker
      this.initSublunarMarker();

      // Add Observer Location Marker
      this.initObserverMarker();

      // Render curated labels plus the complete internal city catalogue.
      this.initGlobalCityCatalogue();

      // Update on zoom change for level-of-detail rendering
      map.on('zoom', () => {
        this.updateCityMarkerLabels();
      });

      // Initial update
      this.updateTimezoneLayer(this.showTimezoneGrid());
      this.updateCelestialGridLayer(this.showCelestialGrid());
      this.updateSolarTrackLayer(this.activeDate(), this.showSolarTrack());
      this.updateWorldWeatherLayer(this.showWorldWeather());
      // Fetch weather for initial location
      this.weatherService.fetchWeatherForLocation(loc);
    });

    // Allow user to click anywhere on the map to inspect coordinates & solar geometry
    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      const normalizedLng = ((((lng + 180) % 360) + 360) % 360) - 180;
      this.handleMapCoordinateClick(lat, normalizedLng);
    });
  }

  /**
   * Set theme (NASA Earth, Midnight Cosmic, Blueprint)
   */
  setTheme(theme: MapThemeMode): void {
    if (this.currentMapTheme() === theme) return;
    this.currentMapTheme.set(theme);

    if (this.map) {
      this.isMapLoaded.set(false);
      this.map.setStyle(MAP_THEMES[theme]);
      this.map.once('style.load', () => {
        this.isMapLoaded.set(true);
        this.initTimezoneSource();
        this.initCelestialGridSource();
        this.initSolarTrackSource();
        this.initWorldWeatherSource();
        this.updateTimezoneLayer(this.showTimezoneGrid());
        this.updateCelestialGridLayer(this.showCelestialGrid());
        this.updateSolarTrackLayer(this.activeDate(), this.showSolarTrack());
      });
    }
  }

  private initWorldWeatherSource(): void {
    if (!this.map) return;
    if (!this.map.getSource('world-weather-source')) {
      this.map.addSource('world-weather-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] } as any
      });
    }
    if (!this.map.getLayer('world-weather-points')) {
      this.map.addLayer({
        id: 'world-weather-points',
        type: 'circle',
        source: 'world-weather-source',
        minzoom: 1.5,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1.5, 3, 5, 5],
          'circle-color': [
            'match', ['get', 'condition'],
            'clear', '#fbbf24',
            'partly_cloudy', '#cbd5e1',
            'overcast', '#94a3b8',
            'fog', '#a8b4c2',
            'rain', '#60a5fa',
            'heavy_rain', '#3b82f6',
            'snow', '#e2e8f0',
            'heavy_snow', '#f8fafc',
            'thunderstorm', '#a78bfa',
            'severe_thunderstorm', '#c084fc',
            '#94a3b8'
          ],
          'circle-opacity': 0.82,
          'circle-stroke-color': '#07111f',
          'circle-stroke-width': 1
        }
      });
    }
    this.worldWeatherSourceReady = true;
    this.refreshWorldWeatherSource();
  }

  private refreshWorldWeatherSource(): void {
    if (!this.map || !this.worldWeatherSourceReady) return;
    const weather = this.weatherService.worldWeather();
    const features = this.allMapLocations
      .filter(loc => weather[loc.id])
      .map(loc => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [loc.longitude, loc.latitude] },
        properties: {
          id: loc.id,
          condition: weather[loc.id].condition,
          temperatureC: weather[loc.id].temperatureC,
          cloudCoverPct: weather[loc.id].cloudCoverPct,
          windSpeedKmh: weather[loc.id].windSpeedKmh
        }
      }));
    const source = this.map.getSource('world-weather-source') as GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features } as any);
  }

  private updateWorldWeatherLayer(show: boolean): void {
    if (!this.map || !this.map.getLayer('world-weather-points')) return;
    this.refreshWorldWeatherSource();
    this.map.setPaintProperty('world-weather-points', 'circle-opacity', show ? 0.82 : 0);
  }

  private initTimezoneSource(): void {
    if (!this.map) return;

    const tzGeoJson = this.buildTimezoneMeridianGeoJson();

    if (!this.map.getSource('timezone-meridians-source')) {
      this.map.addSource('timezone-meridians-source', {
        type: 'geojson',
        data: tzGeoJson as any
      });
    }

    if (!this.map.getLayer('timezone-meridians-line')) {
      this.map.addLayer({
        id: 'timezone-meridians-line',
        type: 'line',
        source: 'timezone-meridians-source',
        paint: {
          'line-color': '#38bdf8',
          'line-width': 0.9,
          'line-opacity': 0.25,
          'line-dasharray': [3, 3]
        }
      });
    }
  }

  private buildTimezoneMeridianGeoJson(): { type: 'FeatureCollection'; features: unknown[] } {
    const features: unknown[] = [];

    for (let lng = -180; lng <= 180; lng += 15) {
      const offsetHours = lng / 15;
      const offsetStr = offsetHours >= 0 ? `+${offsetHours}` : `${offsetHours}`;

      features.push({
        type: 'Feature',
        properties: {
          utcOffset: offsetHours,
          label: `UTC${offsetStr}`
        },
        geometry: {
          type: 'LineString',
          coordinates: [
            [lng, -85],
            [lng, 85]
          ]
        }
      });
    }

    return {
      type: 'FeatureCollection',
      features
    };
  }

  private updateTimezoneLayer(show: boolean): void {
    if (!this.map) return;
    if (this.map.getLayer('timezone-meridians-line')) {
      this.map.setPaintProperty('timezone-meridians-line', 'line-opacity', show ? 0.25 : 0);
    }
  }

  /**
   * Initializes Celestial Reference Lines: Equator, Tropics, Polar Circles
   */
  private initCelestialGridSource(): void {
    if (!this.map) return;

    const gridGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { lineType: 'equator', label: 'Equator (0°)' },
          geometry: {
            type: 'LineString',
            coordinates: [[-180, 0], [180, 0]]
          }
        },
        {
          type: 'Feature',
          properties: { lineType: 'tropic', label: 'Tropic of Cancer (+23.44°)' },
          geometry: {
            type: 'LineString',
            coordinates: [[-180, 23.4366], [180, 23.4366]]
          }
        },
        {
          type: 'Feature',
          properties: { lineType: 'tropic', label: 'Tropic of Capricorn (-23.44°)' },
          geometry: {
            type: 'LineString',
            coordinates: [[-180, -23.4366], [180, -23.4366]]
          }
        },
        {
          type: 'Feature',
          properties: { lineType: 'polar', label: 'Arctic Circle (+66.56°)' },
          geometry: {
            type: 'LineString',
            coordinates: [[-180, 66.5634], [180, 66.5634]]
          }
        },
        {
          type: 'Feature',
          properties: { lineType: 'polar', label: 'Antarctic Circle (-66.56°)' },
          geometry: {
            type: 'LineString',
            coordinates: [[-180, -66.5634], [180, -66.5634]]
          }
        }
      ]
    };

    if (!this.map.getSource('celestial-grid-source')) {
      this.map.addSource('celestial-grid-source', {
        type: 'geojson',
        data: gridGeoJson as any
      });
    }

    if (!this.map.getLayer('celestial-equator-line')) {
      this.map.addLayer({
        id: 'celestial-equator-line',
        type: 'line',
        source: 'celestial-grid-source',
        filter: ['==', 'lineType', 'equator'],
        paint: {
          'line-color': '#10b981',
          'line-width': 1.2,
          'line-opacity': 0.45
        }
      });
    }

    if (!this.map.getLayer('celestial-tropics-line')) {
      this.map.addLayer({
        id: 'celestial-tropics-line',
        type: 'line',
        source: 'celestial-grid-source',
        filter: ['==', 'lineType', 'tropic'],
        paint: {
          'line-color': '#f59e0b',
          'line-width': 0.8,
          'line-opacity': 0.35,
          'line-dasharray': [4, 4]
        }
      });
    }

    if (!this.map.getLayer('celestial-polar-line')) {
      this.map.addLayer({
        id: 'celestial-polar-line',
        type: 'line',
        source: 'celestial-grid-source',
        filter: ['==', 'lineType', 'polar'],
        paint: {
          'line-color': '#06b6d4',
          'line-width': 0.8,
          'line-opacity': 0.35,
          'line-dasharray': [2, 2]
        }
      });
    }
  }

  private updateCelestialGridLayer(show: boolean): void {
    if (!this.map) return;
    const op = show ? 1 : 0;
    if (this.map.getLayer('celestial-equator-line')) {
      this.map.setPaintProperty('celestial-equator-line', 'line-opacity', 0.45 * op);
    }
    if (this.map.getLayer('celestial-tropics-line')) {
      this.map.setPaintProperty('celestial-tropics-line', 'line-opacity', 0.35 * op);
    }
    if (this.map.getLayer('celestial-polar-line')) {
      this.map.setPaintProperty('celestial-polar-line', 'line-opacity', 0.35 * op);
    }
  }

  /**
   * Initializes Daily Solar Ground Track (Subsolar Latitude Parallel)
   */
  private initSolarTrackSource(): void {
    if (!this.map) return;

    const sub = this.subsolarPoint();
    const trackGeoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { lineType: 'solar-track' },
          geometry: {
            type: 'LineString',
            coordinates: [[-180, sub.latitude], [180, sub.latitude]]
          }
        }
      ]
    };

    if (!this.map.getSource('solar-track-source')) {
      this.map.addSource('solar-track-source', {
        type: 'geojson',
        data: trackGeoJson as any
      });
    }

    if (!this.map.getLayer('solar-track-line')) {
      this.map.addLayer({
        id: 'solar-track-line',
        type: 'line',
        source: 'solar-track-source',
        paint: {
          'line-color': '#fbbf24',
          'line-width': 1.2,
          'line-opacity': 0.45,
          'line-dasharray': [6, 4]
        }
      });
    }
  }

  private updateSolarTrackLayer(date: Date, show: boolean): void {
    if (!this.map || !this.map.getSource('solar-track-source')) return;
    const sub = calculateSubsolarPoint(date);
    if (this.lastSolarTrackLat === null || Math.abs(sub.latitude - this.lastSolarTrackLat) > 0.02) {
      this.lastSolarTrackLat = sub.latitude;
      const source = this.map.getSource('solar-track-source') as GeoJSONSource;
      if (source) {
        source.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { lineType: 'solar-track' },
              geometry: {
                type: 'LineString',
                coordinates: [[-180, sub.latitude], [180, sub.latitude]]
              }
            }
          ]
        } as any);
      }
    }

    if (this.map.getLayer('solar-track-line')) {
      this.map.setPaintProperty('solar-track-line', 'line-opacity', show ? 0.45 : 0);
    }
  }

  /**
   * Initializes the Subsolar Point Zenith Marker (☉)
   */
  private initSubsolarMarker(): void {
    if (!this.map) return;

    const el = document.createElement('div');
    el.className = 'subsolar-marker-anchor';
    el.innerHTML = `
      <div class="subsolar-inner flex flex-col items-center select-none cursor-pointer">
        <div class="subsolar-pulse-ring"></div>
        <div class="subsolar-sun-dot flex items-center justify-center font-bold text-slate-950 shadow-lg">☉</div>
        <div class="subsolar-tooltip font-mono text-[10px] bg-amber-950/90 text-amber-200 border border-amber-500/40 px-2 py-0.5 rounded-full whitespace-nowrap shadow-xl">
          Subsolar Zenith (Alt 90°)
        </div>
      </div>
    `;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.flyToSubsolar();
    });

    const subsolar = this.subsolarPoint();
    this.subsolarMarker = new Marker({ element: el, anchor: 'center' })
      .setLngLat([subsolar.longitude, subsolar.latitude])
      .addTo(this.map);
  }

  private updateSubsolarMarker(): void {
    if (!this.subsolarMarker) return;
    const subsolar = this.subsolarPoint();
    this.subsolarMarker.setLngLat([subsolar.longitude, subsolar.latitude]);
  }

  /**
   * Initializes the Sublunar Overhead Point Marker (☽)
   */
  private initSublunarMarker(): void {
    if (!this.map) return;

    const el = document.createElement('div');
    el.className = 'sublunar-marker-anchor';
    el.innerHTML = `
      <div class="sublunar-inner flex flex-col items-center select-none cursor-pointer">
        <div class="sublunar-pulse-ring"></div>
        <div class="sublunar-moon-dot flex items-center justify-center font-bold text-slate-950 shadow-lg">☽</div>
        <div class="sublunar-tooltip font-mono text-[10px] bg-slate-950/95 text-sky-200 border border-sky-400/40 px-2 py-0.5 rounded-full whitespace-nowrap shadow-xl">
          Sublunar Point
        </div>
      </div>
    `;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.flyToSublunar();
    });

    const sublunar = this.sublunarPoint();
    this.sublunarMarker = new Marker({ element: el, anchor: 'center' })
      .setLngLat([sublunar.longitude, sublunar.latitude])
      .addTo(this.map);
  }

  private updateSublunarMarker(): void {
    if (!this.sublunarMarker) return;
    const sublunar = this.sublunarPoint();
    this.sublunarMarker.setLngLat([sublunar.longitude, sublunar.latitude]);

    const el = this.sublunarMarker.getElement();
    const tt = el.querySelector('.sublunar-tooltip');
    if (tt) {
      tt.textContent = `☽ Moon Zenith (${Math.round(sublunar.illuminationFraction * 100)}%)`;
    }
  }

  /**
   * Initializes the selected Observer Location Beacon Marker
   */
  private initObserverMarker(): void {
    if (!this.map) return;

    const loc = this.selectedLocation();
    const el = document.createElement('div');
    el.className = 'observer-marker-anchor';
    el.innerHTML = `
      <div class="observer-inner flex flex-col items-center select-none cursor-pointer">
        <div class="observer-beacon-pulse"></div>
        <div class="observer-beacon-core flex items-center justify-center text-xs shadow-lg">📍</div>
        <div class="observer-label-box font-mono text-[11px] bg-slate-950/95 text-white border border-emerald-400/60 px-2.5 py-1 rounded-xl shadow-2xl flex items-center gap-1.5 whitespace-nowrap backdrop-blur-md">
          <span>${loc.flag}</span>
          <span class="font-bold text-emerald-300">${loc.name}</span>
        </div>
      </div>
    `;

    el.addEventListener('click', (e) => {
      e.stopPropagation();
      this.flyToObserver();
    });

    this.observerMarker = new Marker({ element: el, anchor: 'center' })
      .setLngLat([loc.longitude, loc.latitude])
      .addTo(this.map);
  }

  private updateObserverMarker(loc: GeoLocation): void {
    if (!this.observerMarker) return;
    this.observerMarker.setLngLat([loc.longitude, loc.latitude]);

    const el = this.observerMarker.getElement();
    const label = el.querySelector('.observer-label-box');
    if (label) {
      label.innerHTML = `
        <span>${loc.flag}</span>
        <span class="font-bold text-emerald-300">${loc.name}</span>
      `;
    }
  }

  /**
   * Initializes Global City Markers with progressive Level-Of-Detail
   */
  private initGlobalCityCatalogue(): void {
    if (!this.map) return;

    this.geocodingService.getMapLocations().subscribe(locations => {
      if (!this.map || !locations.length) return;

      this.allMapLocations = locations;
      if (this.showWorldWeather()) this.weatherService.fetchWorldWeather(locations);
      this.mapLocationById.clear();
      for (const location of locations) this.mapLocationById.set(location.id, location);

      const data = {
        type: 'FeatureCollection' as const,
        features: locations.map(location => ({
          type: 'Feature' as const,
          id: location.id,
          properties: {
            id: location.id,
            name: location.name,
            country: location.country
          },
          geometry: {
            type: 'Point' as const,
            coordinates: [location.longitude, location.latitude]
          }
        }))
      };

      this.map.addSource('global-city-catalogue', {
        type: 'geojson',
        data: data as any,
        cluster: true,
        clusterMaxZoom: 5,
        clusterRadius: 42
      });

      this.map.addLayer({
        id: 'global-city-clusters',
        type: 'circle',
        source: 'global-city-catalogue',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#f59e0b',
          'circle-opacity': 0.72,
          'circle-radius': ['step', ['get', 'point_count'], 11, 25, 15, 100, 20],
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fde68a',
          'circle-stroke-opacity': 0.55
        }
      });

      this.map.addLayer({
        id: 'global-city-cluster-count',
        type: 'symbol',
        source: 'global-city-catalogue',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 10,
          'text-allow-overlap': true
        },
        paint: { 'text-color': '#111827' }
      });

      this.map.addLayer({
        id: 'global-city-points',
        type: 'circle',
        source: 'global-city-catalogue',
        minzoom: 3.5,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3.5, 1.5, 7, 3, 10, 4],
          'circle-color': '#fbbf24',
          'circle-opacity': 0.72,
          'circle-stroke-width': 0.6,
          'circle-stroke-color': '#fff7ed',
          'circle-stroke-opacity': 0.55
        }
      });

      this.map.addLayer({
        id: 'global-city-labels',
        type: 'symbol',
        source: 'global-city-catalogue',
        minzoom: 6,
        filter: ['!', ['has', 'point_count']],
        layout: {
          'text-field': ['get', 'name'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 6, 9, 10, 12],
          'text-offset': [0, 0.9],
          'text-anchor': 'top',
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#fef3c7',
          'text-halo-color': '#07111f',
          'text-halo-width': 1.4
        }
      });

      this.map.on('click', 'global-city-clusters', async event => {
        const feature = event.features?.[0];
        if (!feature) return;
        const clusterId = feature.properties?.['cluster_id'];
        const source = this.map?.getSource('global-city-catalogue') as GeoJSONSource | undefined;
        if (!source || clusterId == null) return;
        const zoom = await source.getClusterExpansionZoom(Number(clusterId));
        const coordinates = (feature.geometry as any).coordinates as [number, number];
        this.map?.easeTo({ center: coordinates, zoom });
      });

      this.map.on('click', 'global-city-points', event => {
        const feature = event.features?.[0];
        const id = String(feature?.properties?.['id'] ?? '');
        const location = this.mapLocationById.get(id);
        if (location) this.selectLocation(location);
      });

      for (const layerId of ['global-city-clusters', 'global-city-points']) {
        this.map.on('mouseenter', layerId, () => {
          if (this.map) this.map.getCanvas().style.cursor = 'pointer';
        });
        this.map.on('mouseleave', layerId, () => {
          if (this.map) this.map.getCanvas().style.cursor = '';
        });
      }
    });
  }

  private initCityMarkers(): void {
    if (!this.map) return;

    this.allMapLocations.forEach(loc => {
      const el = document.createElement('div');
      el.className = 'city-marker-anchor';
      el.dataset['cityId'] = loc.id;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectLocation(loc);
      });

      el.addEventListener('mouseenter', () => {
        this.inspectedLocation.set(loc);
      });

      el.addEventListener('mouseleave', () => {
        this.inspectedLocation.set(null);
      });

      const marker = new Marker({ element: el, anchor: 'center' })
        .setLngLat([loc.longitude, loc.latitude])
        .addTo(this.map!);

      this.cityMarkers.set(loc.id, marker);
    });

    this.updateCityMarkerLabels();
  }

  private updateCityMarkerLabels(): void {
    const date = this.activeDate();
    const activeLocId = this.selectedLocation().id;
    const showLabels = this.showCityLabels();
    const currentZoom = this.map ? this.map.getZoom() : 2;
    const minuteBucket = Math.floor(date.getTime() / 60000);

    for (const loc of this.allMapLocations) {
      const marker = this.cityMarkers.get(loc.id);
      if (!marker) continue;

      const el = marker.getElement();
      const isSelected = loc.id === activeLocId;
      const tier = loc.tier ?? 2;

      const isVisible = isSelected || (currentZoom < 2.5 ? tier === 1 : currentZoom < 4.5 ? tier <= 2 : true);

      if (!isVisible && !isSelected) {
        if (el.style.display !== 'none') {
          el.style.display = 'none';
        }
        continue;
      }
      if (el.style.display !== 'block') {
        el.style.display = 'block';
      }

      const sun = calculateSolarPosition(date, loc.latitude, loc.longitude);
      const alt = sun.altitudeDeg;
      let astroState: WorldHubStatus['astroState'] = 'night';
      if (alt > 6) {
        astroState = 'day';
      } else if (alt > 0) {
        astroState = 'day';
      } else if (alt > -6) {
        astroState = 'civil-twilight';
      } else if (alt > -12) {
        astroState = 'nautical-twilight';
      } else if (alt > -18) {
        astroState = 'astro-twilight';
      }

      const { dotColorClass, badgeTimeClass } = astroState === 'day'
        ? { dotColorClass: 'bg-amber-400 shadow-amber-400/80', badgeTimeClass: 'text-amber-300' }
        : astroState === 'civil-twilight'
          ? { dotColorClass: 'bg-purple-400 shadow-purple-400/80', badgeTimeClass: 'text-purple-300' }
          : astroState === 'nautical-twilight'
            ? { dotColorClass: 'bg-indigo-400 shadow-indigo-400/80', badgeTimeClass: 'text-indigo-300' }
            : { dotColorClass: 'bg-sky-400 shadow-sky-400/80', badgeTimeClass: 'text-sky-300' };

      el.classList.toggle('is-selected', isSelected);

      if (isSelected) {
        const timeSecStr = new Intl.DateTimeFormat('en-US', {
          timeZone: loc.timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(date);
        let utcOffset: string;
        try {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: loc.timezone,
            timeZoneName: 'shortOffset'
          }).formatToParts(date);
          const tzPart = parts.find(p => p.type === 'timeZoneName');
          utcOffset = tzPart ? tzPart.value : 'UTC';
        } catch {
          utcOffset = 'UTC';
        }

        el.innerHTML = `
          <div class="city-inner flex items-center justify-center cursor-pointer select-none">
            <div class="city-pill-selected flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] bg-slate-950/95 border-2 border-emerald-400 text-white shadow-2xl backdrop-blur-md ring-4 ring-emerald-500/20 whitespace-nowrap">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span class="text-xs">${loc.flag}</span>
              <span class="font-bold text-emerald-300 font-sans tracking-wide uppercase">${loc.name}</span>
              <span class="font-bold font-mono text-white">${timeSecStr}</span>
              <span class="text-[9px] px-1 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-mono">${utcOffset}</span>
            </div>
          </div>
        `;
      } else if (!showLabels) {
        const stateKey = `dot_${dotColorClass}`;
        if (this.markerRenderState.get(loc.id) !== stateKey) {
          this.markerRenderState.set(loc.id, stateKey);
          el.innerHTML = `
            <div class="city-inner flex items-center justify-center cursor-pointer select-none">
              <div class="city-dot ${dotColorClass}"></div>
            </div>
          `;
        }
      } else {
        const stateKey = `label_${dotColorClass}_${minuteBucket}`;
        if (this.markerRenderState.get(loc.id) !== stateKey) {
          this.markerRenderState.set(loc.id, stateKey);
          let localTime: string;
          try {
            localTime = new Intl.DateTimeFormat('en-US', {
              timeZone: loc.timezone,
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            }).format(date);
          } catch {
            localTime = '--:--';
          }

          el.innerHTML = `
            <div class="city-inner flex items-center justify-center cursor-pointer select-none">
              <div class="city-pill flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[10px] bg-slate-950/90 border border-white/10 hover:border-amber-400/60 transition-all backdrop-blur-md shadow-lg group whitespace-nowrap">
                <span class="city-status-indicator w-1.5 h-1.5 rounded-full ${dotColorClass}"></span>
                <span class="city-name font-sans text-slate-300 font-medium tracking-tight uppercase">${loc.name}</span>
                <span class="city-time font-bold ${badgeTimeClass}">${localTime}</span>
              </div>
            </div>
          `;
        }
      }
    }
  }

  /**
   * Handles Interactive Map Coordinate Click (Pinpoint probe)
   */
  private handleMapCoordinateClick(lat: number, lng: number): void {
    const roundedLat = Math.round(lat * 100) / 100;
    const roundedLng = Math.round(lng * 100) / 100;
    const date = this.activeDate();
    const obs = this.selectedLocation();

    // Calculate solar metrics for clicked point
    const sun = calculateSolarPosition(date, roundedLat, roundedLng);
    const sunTimes = calculateSolarEvents(date, roundedLat, roundedLng);

    // Calculate distance and initial bearing from observer using Haversine
    const dKm = this.calculateGreatCircleDistance(obs.latitude, obs.longitude, roundedLat, roundedLng);
    const bearing = this.calculateInitialBearing(obs.latitude, obs.longitude, roundedLat, roundedLng);

    const alt = sun.altitudeDeg;
    let statusLabel = 'Night';
    if (alt > 0) statusLabel = 'Daylight';
    else if (alt > -6) statusLabel = 'Civil Twilight';
    else if (alt > -12) statusLabel = 'Nautical Twilight';
    else if (alt > -18) statusLabel = 'Astronomical Twilight';

    const latStr = `${Math.abs(roundedLat)}°${roundedLat >= 0 ? 'N' : 'S'}`;
    const lngStr = `${Math.abs(roundedLng)}°${roundedLng >= 0 ? 'E' : 'W'}`;
    const name = `Probe (${latStr}, ${lngStr})`;

    const probe: MapProbePoint = {
      latitude: roundedLat,
      longitude: roundedLng,
      name,
      solarAltitude: Math.round(alt * 10) / 10,
      solarAzimuth: Math.round(sun.azimuthDeg * 10) / 10,
      isDaylight: alt > 0,
      statusLabel,
      sunrise: sunTimes.sunrise ? this.formatTimeUtc(sunTimes.sunrise) : '--:--',
      solarNoon: sunTimes.solarNoon ? this.formatTimeUtc(sunTimes.solarNoon) : '--:--',
      sunset: sunTimes.sunset ? this.formatTimeUtc(sunTimes.sunset) : '--:--',
      dayLengthMinutes: Math.round(sunTimes.dayLengthMinutes),
      distanceFromObserverKm: Math.round(dKm),
      bearingFromObserverDeg: Math.round(bearing)
    };

    this.probePoint.set(probe);

    // Place or move probe marker
    if (this.map) {
      if (this.probeMarker) {
        this.probeMarker.setLngLat([roundedLng, roundedLat]);
      } else {
        const el = document.createElement('div');
        el.className = 'probe-marker-anchor';
        el.innerHTML = `
          <div class="probe-inner flex items-center justify-center select-none">
            <div class="probe-target-pulse"></div>
            <div class="probe-crosshair font-mono text-[10px] text-amber-400 font-bold">⊕</div>
          </div>
        `;
        this.probeMarker = new Marker({ element: el, anchor: 'center' })
          .setLngLat([roundedLng, roundedLat])
          .addTo(this.map);
      }
    }
  }

  setProbeAsObserver(): void {
    const probe = this.probePoint();
    if (!probe) return;
    this.locationService.setCustomCoordinates(probe.name, probe.latitude, probe.longitude);
    this.probePoint.set(null);
    if (this.probeMarker) {
      this.probeMarker.remove();
      this.probeMarker = null;
    }
  }

  dismissProbe(): void {
    this.probePoint.set(null);
    if (this.probeMarker) {
      this.probeMarker.remove();
      this.probeMarker = null;
    }
  }

  selectObservatory(obs: ObservatoryPreset): void {
    this.locationService.setCustomCoordinates(obs.name, obs.latitude, obs.longitude, obs.timezone);
    if (this.map) {
      this.map.flyTo({
        center: [obs.longitude, obs.latitude],
        zoom: 4.5,
        speed: 1.2,
        curve: 1.4,
        essential: true
      });
    }
  }

  /**
   * Great circle distance in kilometers
   */
  private calculateGreatCircleDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's mean radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private calculateInitialBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const y = Math.sin(((lon2 - lon1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
    const x =
      Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
      Math.sin((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.cos(((lon2 - lon1) * Math.PI) / 180);
    const b = (Math.atan2(y, x) * 180) / Math.PI;
    return (b + 360) % 360;
  }

  /**
   * Interactive Camera and Control Methods
   */
  selectLocation(loc: GeoLocation): void {
    this.locationService.selectLocation(loc);
    this.inspectedLocation.set(null);
    this.searchQuery.set('');
    this.isSearchOpen.set(false);

    if (this.map) {
      this.map.flyTo({
        center: [loc.longitude, loc.latitude],
        zoom: Math.max(this.map.getZoom(), 3.2),
        speed: 1.2,
        curve: 1.4,
        essential: true
      });
    }
  }

  flyToObserver(): void {
    const loc = this.selectedLocation();
    if (this.map) {
      this.map.flyTo({
        center: [loc.longitude, loc.latitude],
        zoom: Math.max(this.map.getZoom(), 3.0),
        speed: 1.2,
        curve: 1.4,
        essential: true
      });
    }
  }

  flyToSubsolar(): void {
    const sub = this.subsolarPoint();
    if (this.map) {
      this.map.flyTo({
        center: [sub.longitude, sub.latitude],
        zoom: Math.max(this.map.getZoom(), 2.5),
        speed: 1.2,
        curve: 1.4,
        essential: true
      });
    }
  }

  flyToSublunar(): void {
    const sub = this.sublunarPoint();
    if (this.map) {
      this.map.flyTo({
        center: [sub.longitude, sub.latitude],
        zoom: Math.max(this.map.getZoom(), 2.5),
        speed: 1.2,
        curve: 1.4,
        essential: true
      });
    }
  }

  resetWorldView(): void {
    if (this.map) {
      this.map.flyTo({
        center: [0, 20],
        zoom: 1.6,
        pitch: 0,
        bearing: 0,
        speed: 1.2,
        curve: 1.4,
        essential: true
      });
    }
  }

  toggleCityLabels(): void {
    this.showCityLabels.update(v => !v);
    this.updateCityMarkerLabels();
  }

  toggleTimezoneGrid(): void {
    this.showTimezoneGrid.update(v => !v);
  }

  toggleCelestialGrid(): void {
    this.showCelestialGrid.update(v => !v);
  }

  toggleSolarTrack(): void {
    this.showSolarTrack.update(v => !v);
  }

  toggleMoon(): void {
    this.showMoonZenith.update(v => !v);
    if (this.sublunarMarker) {
      const el = this.sublunarMarker.getElement();
      el.style.display = this.showMoonZenith() ? 'block' : 'none';
    }
  }

  toggleWorldWeather(): void {
    const enabled = !this.showWorldWeather();
    this.showWorldWeather.set(enabled);
    if (enabled) this.weatherService.fetchWorldWeather(this.allMapLocations);
    this.updateWorldWeatherLayer(enabled);
  }

  private formatTimeOnly(date: Date, timezone: string): string {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date);
    } catch {
      return '--:--';
    }
  }

  private formatTimeUtc(date: Date): string {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(date) + ' UTC';
    } catch {
      return '--:--';
    }
  }
}
