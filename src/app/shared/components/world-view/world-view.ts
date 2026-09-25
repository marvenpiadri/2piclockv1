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
  readonly allPresets = this.locationService.allPresets;
  readonly activeDate = this.timeControlService.currentActiveDate;
  readonly celestial = this.celestialService.celestialState;
  readonly localTime = this.celestialService.formattedLocalTime;
  readonly isLive = this.timeControlService.isLive;
  readonly currentWeather = this.weatherService.currentWeather;

  // View Display Toggles
  readonly showNightTerminator = signal<boolean>(true);
  readonly showTwilightBands = signal<boolean>(true);
  readonly showCityLabels = signal<boolean>(true);
  readonly showTimezoneGrid = signal<boolean>(false);
  readonly showCelestialGrid = signal<boolean>(true);
  readonly showSolarTrack = signal<boolean>(true);
  readonly showMoonZenith = signal<boolean>(true);
  readonly showWindVectors = signal<boolean>(false);
  readonly currentMapTheme = signal<MapThemeMode>('nasa');
  readonly isMapLoaded = signal<boolean>(false);

  @ViewChild('windCanvas', { static: false }) windCanvasRef?: ElementRef<HTMLCanvasElement>;

  private windParticles: { lat: number; lng: number; age: number; maxAge: number }[] = [];
  private windAnimFrameId: number | null = null;

  // Search & Inspection State
  readonly searchQuery = signal<string>('');
  readonly isSearchOpen = signal<boolean>(false);
  readonly inspectedLocation = signal<GeoLocation | null>(null);
  readonly probePoint = signal<MapProbePoint | null>(null);

  readonly observatories = FAMOUS_OBSERVATORIES;

  private map: MapLibreMap | null = null;
  private observerMarker: Marker | null = null;
  private subsolarMarker: Marker | null = null;
  private sublunarMarker: Marker | null = null;
  private probeMarker: Marker | null = null;
  private cityMarkers = new Map<string, Marker>();
  private countryLocations: GeoLocation[] = [];
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

  readonly searchResults = computed<GeoLocation[]>(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return [];
    const local = this.allPresets.filter(loc =>
      loc.name.toLowerCase().includes(q) ||
      loc.country.toLowerCase().includes(q) ||
      loc.timezone.toLowerCase().includes(q)
    );
    const seen = new Set(local.map(loc => loc.id));
    return [...local, ...this.remoteSearchResults().filter(loc => !seen.has(loc.id))].slice(0, 12);
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
      this.geocodingService.search(value, 10).subscribe(results => {
        this.remoteSearchResults.set(results);
        this.isRemoteSearching.set(false);
      });
    }, 250);
  }

  private markerRenderState = new Map<string, string>();
  private lastTerminatorDateMs = 0;
  private lastSolarTrackLat: number | null = null;

  // Calculates complete WorldHubStatus for a single location on demand
  private calculateLocationStatus(loc: GeoLocation, date: Date): WorldHubStatus {
    const sun = calculateSolarPosition(date, loc.latitude, loc.longitude);
    const sunTimes = calculateSolarEvents(date, loc.latitude, loc.longitude);

    let timeStr = '--:--';
    let timeSecStr = '--:--:--';
    let utcOffset = 'UTC';

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
    let astroState: WorldHubStatus['astroState'] = 'night';
    let statusLabel = 'Deep Night';

    if (alt > 6) {
      astroState = 'day';
      statusLabel = 'Full Daylight';
    } else if (alt > 0) {
      astroState = 'day';
      statusLabel = 'Golden Hour';
    } else if (alt > -6) {
      astroState = 'civil-twilight';
      statusLabel = 'Civil Twilight';
    } else if (alt > -12) {
      astroState = 'nautical-twilight';
      statusLabel = 'Nautical Twilight';
    } else if (alt > -18) {
      astroState = 'astro-twilight';
      statusLabel = 'Astronomical Twilight';
    } else {
      astroState = 'night';
      statusLabel = 'Deep Night';
    }

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
        const showNight = this.showNightTerminator();
        const showTwilight = this.showTwilightBands();
        const showTz = this.showTimezoneGrid();
        const showCel = this.showCelestialGrid();
        const showTrack = this.showSolarTrack();

        if (this.map && this.isMapLoaded()) {
          this.updateTerminatorLayers(date, showNight, showTwilight);
          this.updateTimezoneLayer(showTz);
          this.updateCelestialGridLayer(showCel);
          this.updateSolarTrackLayer(date, showTrack);
          this.updateSubsolarMarker();
          this.updateSublunarMarker();
          this.updateObserverMarker(loc);
          this.updateCityMarkerLabels();

          if (loc.id !== this.lastLocationId) {
            this.lastLocationId = loc.id;
            if (this.showWindVectors()) {
              this.weatherService.fetchWeatherForLocation(loc);
            }
          }
        }
      });
    }
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      setTimeout(() => {
        this.initMapLibreMap();
        if (this.showWindVectors()) {
          this.startWindParticleLoop();
        }
      }, 40);
    }
  }

  ngOnDestroy(): void {
    this.stopWindParticleLoop();
    if (this.map) {
      this.cityMarkers.forEach(m => m.remove());
      this.cityMarkers.clear();
      if (this.observerMarker) this.observerMarker.remove();
      if (this.subsolarMarker) this.subsolarMarker.remove();
      if (this.sublunarMarker) this.sublunarMarker.remove();
      if (this.probeMarker) this.probeMarker.remove();
      this.countryLocations = [];
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

      // Add Day/Night Terminator and Twilight Multi-band GeoJSON Source & Layers
      this.initTerminatorSource();

      // Add Timezone Meridians Grid
      this.initTimezoneSource();

      // Add Celestial Reference Grid (Equator, Tropics, Polar Circles)
      this.initCelestialGridSource();

      // Add Solar Ground Track
      this.initSolarTrackSource();

      // Add Subsolar Marker
      this.initSubsolarMarker();

      // Add Sublunar Marker
      this.initSublunarMarker();

      // Add Observer Location Marker
      this.initObserverMarker();

      // Add global country database pins first, then the curated city hubs.
      this.initCountryPins();
      this.initCityMarkers();

      // Update on zoom change for level-of-detail rendering
      map.on('zoom', () => {
        this.updateCityMarkerLabels();
      });

      // Initial update
      this.updateTerminatorLayers(this.activeDate(), this.showNightTerminator(), this.showTwilightBands());
      this.updateTimezoneLayer(this.showTimezoneGrid());
      this.updateCelestialGridLayer(this.showCelestialGrid());
      this.updateSolarTrackLayer(this.activeDate(), this.showSolarTrack());

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
        this.initTerminatorSource();
        this.initTimezoneSource();
        this.initCelestialGridSource();
        this.initSolarTrackSource();
        this.updateTerminatorLayers(this.activeDate(), this.showNightTerminator(), this.showTwilightBands());
        this.updateTimezoneLayer(this.showTimezoneGrid());
        this.updateCelestialGridLayer(this.showCelestialGrid());
        this.updateSolarTrackLayer(this.activeDate(), this.showSolarTrack());
      });
    }
  }

  /**
   * Initializes Day/Night Terminator and Multi-stage Twilight Layers
   */
  private initTerminatorSource(): void {
    if (!this.map) return;

    const initialGeoJson = this.buildTerminatorGeoJson(this.activeDate());

    if (!this.map.getSource('terminator-source')) {
      this.map.addSource('terminator-source', {
        type: 'geojson',
        data: initialGeoJson as any
      });
    }

    // Deep Night Fill Layer (Dark translucent shadow)
    if (!this.map.getLayer('terminator-night-fill')) {
      this.map.addLayer({
        id: 'terminator-night-fill',
        type: 'fill',
        source: 'terminator-source',
        filter: ['==', 'layerType', 'night'],
        paint: {
          'fill-color': '#020617',
          'fill-opacity': 0.68
        }
      });
    }

    // Astronomical Twilight Layer (-18° to -12°)
    if (!this.map.getLayer('twilight-astro-fill')) {
      this.map.addLayer({
        id: 'twilight-astro-fill',
        type: 'fill',
        source: 'terminator-source',
        filter: ['==', 'layerType', 'twilight-astro'],
        paint: {
          'fill-color': '#030712',
          'fill-opacity': 0.45
        }
      });
    }

    // Nautical Twilight Layer (-12° to -6°)
    if (!this.map.getLayer('twilight-naut-fill')) {
      this.map.addLayer({
        id: 'twilight-naut-fill',
        type: 'fill',
        source: 'terminator-source',
        filter: ['==', 'layerType', 'twilight-naut'],
        paint: {
          'fill-color': '#0f172a',
          'fill-opacity': 0.35
        }
      });
    }

    // Civil Twilight Layer (-6° to 0°)
    if (!this.map.getLayer('twilight-civil-fill')) {
      this.map.addLayer({
        id: 'twilight-civil-fill',
        type: 'fill',
        source: 'terminator-source',
        filter: ['==', 'layerType', 'twilight-civil'],
        paint: {
          'fill-color': '#1e1b4b',
          'fill-opacity': 0.25
        }
      });
    }

    // Atmospheric Glow Line
    if (!this.map.getLayer('terminator-glow-line')) {
      this.map.addLayer({
        id: 'terminator-glow-line',
        type: 'line',
        source: 'terminator-source',
        filter: ['==', 'layerType', 'terminator-line'],
        paint: {
          'line-color': '#fbbf24',
          'line-width': 7,
          'line-opacity': 0.35,
          'line-blur': 3.5
        }
      });
    }

    // Golden Solar Terminator Boundary Line (Day/Night dividing line)
    if (!this.map.getLayer('terminator-boundary-line')) {
      this.map.addLayer({
        id: 'terminator-boundary-line',
        type: 'line',
        source: 'terminator-source',
        filter: ['==', 'layerType', 'terminator-line'],
        paint: {
          'line-color': '#f59e0b',
          'line-width': 2.0,
          'line-opacity': 0.95
        }
      });
    }
  }

  /**
   * Generates continuous spherical geometry for the Solar Terminator & Twilight Bands
   * Uses analytical hour-angle transformation along longitude to guarantee zero self-intersections,
   * zero antimeridian crossing glitches, and exact polar day/night handling.
   */
  private buildTerminatorGeoJson(date: Date): { type: 'FeatureCollection'; features: unknown[] } {
    const subsolar = calculateSubsolarPoint(date);
    const decDeg = subsolar.latitude;
    const subLngDeg = subsolar.longitude;
    const decRad = (decDeg * Math.PI) / 180;
    const isNorthIlluminated = decDeg >= 0;

    const clampLat = (lat: number): number => Math.max(-85.0511, Math.min(85.0511, lat));

    // Computes continuous latitude array for longitude from -180 to +180 in 1° steps
    const computeTerminatorCurve = (zenithAngleDeg: number): [number, number][] => {
      const zRad = (zenithAngleDeg * Math.PI) / 180;
      const R = Math.cos(zRad);
      const sinDec = Math.sin(decRad);
      const cosDec = Math.cos(decRad);

      const points: [number, number][] = [];

      for (let lng = -180; lng <= 180; lng += 1) {
        // Local Hour Angle H = lng - subLngDeg in radians
        let dLng = (lng - subLngDeg) % 360;
        if (dLng > 180) dLng -= 360;
        if (dLng < -180) dLng += 360;
        const H = (dLng * Math.PI) / 180;

        const A = sinDec;
        const B = cosDec * Math.cos(H);
        const C = Math.sqrt(A * A + B * B);

        let lat: number;
        if (C < 0.0001) {
          lat = isNorthIlluminated ? -85.0511 : 85.0511;
        } else if (R > C) {
          lat = isNorthIlluminated ? -85.0511 : 85.0511;
        } else if (R < -C) {
          lat = isNorthIlluminated ? 85.0511 : -85.0511;
        } else {
          const gamma = Math.atan2(B, A);
          const alpha = Math.asin(Math.max(-1, Math.min(1, R / C)));
          const latRad = alpha - gamma;
          lat = (latRad * 180) / Math.PI;

          if (lat > 90) lat = 180 - lat;
          if (lat < -90) lat = -180 - lat;
        }

        points.push([lng, clampLat(lat)]);
      }

      return points;
    };

    const makeNightPolygon = (curve: [number, number][]): [number, number][] => {
      if (curve.length === 0) return [];
      const poly: [number, number][] = [];

      if (isNorthIlluminated) {
        for (let i = curve.length - 1; i >= 0; i--) {
          poly.push(curve[i]);
        }
        poly.push([-180, -85.0511]);
        poly.push([180, -85.0511]);
        poly.push(curve[curve.length - 1]);
      } else {
        for (const pt of curve) {
          poly.push(pt);
        }
        poly.push([180, 85.0511]);
        poly.push([-180, 85.0511]);
        poly.push(curve[0]);
      }

      return poly;
    };

    const geometricCurve = computeTerminatorCurve(90.833);
    const civilCurve = computeTerminatorCurve(96.0);
    const nautCurve = computeTerminatorCurve(102.0);
    const astroCurve = computeTerminatorCurve(108.0);

    const nightPolygon = makeNightPolygon(geometricCurve);
    const civilPolygon = makeNightPolygon(civilCurve);
    const nautPolygon = makeNightPolygon(nautCurve);
    const astroPolygon = makeNightPolygon(astroCurve);

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { layerType: 'twilight-astro' },
          geometry: { type: 'Polygon', coordinates: [astroPolygon] }
        },
        {
          type: 'Feature',
          properties: { layerType: 'twilight-naut' },
          geometry: { type: 'Polygon', coordinates: [nautPolygon] }
        },
        {
          type: 'Feature',
          properties: { layerType: 'twilight-civil' },
          geometry: { type: 'Polygon', coordinates: [civilPolygon] }
        },
        {
          type: 'Feature',
          properties: { layerType: 'night' },
          geometry: { type: 'Polygon', coordinates: [nightPolygon] }
        },
        {
          type: 'Feature',
          properties: { layerType: 'terminator-line' },
          geometry: { type: 'LineString', coordinates: geometricCurve }
        }
      ]
    };
  }

  private updateTerminatorLayers(date: Date, showNight: boolean, showTwilight: boolean): void {
    if (!this.map || !this.map.getSource('terminator-source')) return;

    const dateMs = date.getTime();
    if (Math.abs(dateMs - this.lastTerminatorDateMs) >= 2000) {
      this.lastTerminatorDateMs = dateMs;
      const source = this.map.getSource('terminator-source') as GeoJSONSource;
      if (source) {
        const data = this.buildTerminatorGeoJson(date);
        source.setData(data as any);
      }
    }

    const nightFill = showNight ? 0.68 : 0;
    const boundaryLine = showNight ? 0.95 : 0;
    const twilightOpacity = (showNight && showTwilight) ? 0.32 : 0;

    if (this.map.getLayer('terminator-night-fill')) {
      this.map.setPaintProperty('terminator-night-fill', 'fill-opacity', nightFill);
    }
    if (this.map.getLayer('terminator-boundary-line')) {
      this.map.setPaintProperty('terminator-boundary-line', 'line-opacity', boundaryLine);
    }
    if (this.map.getLayer('terminator-glow-line')) {
      this.map.setPaintProperty('terminator-glow-line', 'line-opacity', boundaryLine * 0.35);
    }
    if (this.map.getLayer('twilight-civil-fill')) {
      this.map.setPaintProperty('twilight-civil-fill', 'fill-opacity', twilightOpacity * 0.8);
    }
    if (this.map.getLayer('twilight-naut-fill')) {
      this.map.setPaintProperty('twilight-naut-fill', 'fill-opacity', twilightOpacity);
    }
    if (this.map.getLayer('twilight-astro-fill')) {
      this.map.setPaintProperty('twilight-astro-fill', 'fill-opacity', twilightOpacity * 1.15);
    }
  }

  /**
   * Initializes the UTC Timezone Meridian Lines GeoJSON Source & Layer
   */
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
  private initCountryPins(): void {
    if (!this.map) return;

    this.geocodingService.getCountries().subscribe(countries => {
      if (!this.map || !this.isMapLoaded()) return;
      this.countryLocations = countries;
      const sourceData = {
        type: 'FeatureCollection',
        features: countries.map(loc => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [loc.longitude, loc.latitude] },
          properties: { id: loc.id, name: loc.country, flag: loc.flag, countryCode: loc.countryCode }
        }))
      };

      if (this.map.getSource('country-pins')) {
        (this.map.getSource('country-pins') as GeoJSONSource).setData(sourceData as any);
      } else {
        this.map.addSource('country-pins', { type: 'geojson', data: sourceData as any });
        this.map.addLayer({
          id: 'country-pins',
          type: 'circle',
          source: 'country-pins',
          minzoom: 1,
          maxzoom: 3.8,
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.2, 3.5, 3.8],
            'circle-color': '#fbbf24',
            'circle-opacity': 0.82,
            'circle-stroke-color': '#0a1628',
            'circle-stroke-width': 1
          }
        });
      }

      this.map.on('click', 'country-pins', event => {
        const feature = event.features?.[0];
        const id = feature?.properties?.['id'];
        const country = this.countryLocations.find(loc => loc.id === id);
        if (country) this.selectLocation(country);
      });
      this.map.on('mouseenter', 'country-pins', () => {
        if (this.map) this.map.getCanvas().style.cursor = 'pointer';
      });
      this.map.on('mouseleave', 'country-pins', () => {
        if (this.map) this.map.getCanvas().style.cursor = '';
      });
    });
  }

  private initCityMarkers(): void {
    if (!this.map) return;

    this.allPresets.forEach(loc => {
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

    for (const loc of this.allPresets) {
      const marker = this.cityMarkers.get(loc.id);
      if (!marker) continue;

      const el = marker.getElement();
      const isSelected = loc.id === activeLocId;
      const tier = loc.tier ?? 2;

      let isVisible = false;
      if (isSelected) {
        isVisible = true;
      } else if (currentZoom < 2.5) {
        isVisible = tier === 1;
      } else if (currentZoom < 4.5) {
        isVisible = tier <= 2;
      } else {
        isVisible = true;
      }

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

      let dotColorClass = 'bg-sky-400';
      let badgeTimeClass = 'text-sky-300';
      if (astroState === 'day') {
        dotColorClass = 'bg-amber-400 shadow-amber-400/80';
        badgeTimeClass = 'text-amber-300';
      } else if (astroState === 'civil-twilight') {
        dotColorClass = 'bg-purple-400 shadow-purple-400/80';
        badgeTimeClass = 'text-purple-300';
      } else if (astroState === 'nautical-twilight') {
        dotColorClass = 'bg-indigo-400 shadow-indigo-400/80';
        badgeTimeClass = 'text-indigo-300';
      } else {
        dotColorClass = 'bg-sky-400 shadow-sky-400/80';
        badgeTimeClass = 'text-sky-300';
      }

      el.classList.toggle('is-selected', isSelected);

      if (isSelected) {
        const timeSecStr = new Intl.DateTimeFormat('en-US', {
          timeZone: loc.timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(date);
        let utcOffset = 'UTC';
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
          let localTime = '--:--';
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

  toggleTerminator(): void {
    this.showNightTerminator.update(v => !v);
  }

  toggleTwilight(): void {
    this.showTwilightBands.update(v => !v);
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

  toggleWindVectors(): void {
    const enabled = !this.showWindVectors();
    this.showWindVectors.set(enabled);

    if (enabled) {
      // Weather is an opt-in analytical layer on the World Map.
      this.weatherService.fetchWeatherForLocation(this.selectedLocation());
      this.startWindParticleLoop();
    } else {
      this.stopWindParticleLoop();
    }
  }

  private stopWindParticleLoop(): void {
    if (this.windAnimFrameId !== null && this.isBrowser) {
      cancelAnimationFrame(this.windAnimFrameId);
      this.windAnimFrameId = null;
    }
    const canvas = this.windCanvasRef?.nativeElement;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private startWindParticleLoop(): void {
    if (this.windAnimFrameId !== null || !this.isBrowser) return;
    const loop = () => {
      if (!this.showWindVectors()) {
        this.stopWindParticleLoop();
        return;
      }
      this.renderWindFrame();
      this.windAnimFrameId = requestAnimationFrame(loop);
    };
    this.windAnimFrameId = requestAnimationFrame(loop);
  }

  private initWindParticles(west: number, east: number, south: number, north: number): void {
    this.windParticles = [];
    const particleCount = 160;
    for (let i = 0; i < particleCount; i++) {
      this.windParticles.push({
        lng: west + Math.random() * (east - west),
        lat: south + Math.random() * (north - south),
        age: Math.floor(Math.random() * 80),
        maxAge: 50 + Math.floor(Math.random() * 60)
      });
    }
  }

  private renderWindFrame(): void {
    const canvas = this.windCanvasRef?.nativeElement;
    if (!canvas || !this.map || !this.showWindVectors() || !this.isMapLoaded()) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    if (canvas.width !== rect.width || canvas.height !== rect.height) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      const bounds = this.map.getBounds();
      this.initWindParticles(bounds.getWest(), bounds.getEast(), bounds.getSouth(), bounds.getNorth());
    }

    // Fading background fill creates Windy.com motion trail streamlines
    ctx.fillStyle = 'rgba(10, 22, 40, 0.2)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const bounds = this.map.getBounds();
    const west = bounds.getWest();
    const east = bounds.getEast();
    const south = bounds.getSouth();
    const north = bounds.getNorth();

    if (this.windParticles.length === 0) {
      this.initWindParticles(west, east, south, north);
    }

    const currentW = this.currentWeather();
    const baseSpeed = currentW.windSpeedKmh || 18;
    const baseDeg = currentW.windDirectionDeg || 210;
    const zoom = this.map.getZoom();

    for (const p of this.windParticles) {
      p.age++;

      if (p.age > p.maxAge || p.lng < west || p.lng > east || p.lat < south || p.lat > north) {
        p.lng = west + Math.random() * (east - west);
        p.lat = south + Math.random() * (north - south);
        p.age = 0;
        p.maxAge = 50 + Math.floor(Math.random() * 60);
        continue;
      }

      // Convert Lat/Lng to Canvas pixel screen coordinates
      const pxCurr = this.map.project([p.lng, p.lat]);

      // Local regional wave modulation across lat/lng for realistic Windy.com fluid flow
      const waveDeg = Math.sin(p.lat * 0.12 + p.lng * 0.08) * 20 + Math.cos(p.lat * 0.05) * 15;
      const localDeg = (baseDeg + waveDeg + 360) % 360;
      const localSpeed = Math.max(6, baseSpeed + Math.sin(p.lng * 0.1) * 8);

      // Meteorology wind direction is "coming FROM". Flow is towards (deg + 180)
      const flowRad = ((localDeg + 180) % 360) * (Math.PI / 180);

      // Scale geographic step for map zoom level
      const stepScale = 0.012 / Math.pow(1.4, Math.max(0, zoom - 2));
      const dLng = localSpeed * Math.sin(flowRad) * stepScale;
      const dLat = localSpeed * Math.cos(flowRad) * stepScale;

      p.lng += dLng;
      p.lat += dLat;

      const pxNext = this.map.project([p.lng, p.lat]);

      // Render vector streamline
      ctx.beginPath();
      ctx.moveTo(pxCurr.x, pxCurr.y);
      ctx.lineTo(pxNext.x, pxNext.y);

      // Windy.com Color Palette according to velocity
      if (localSpeed >= 70) {
        ctx.strokeStyle = 'rgba(225, 29, 72, 0.9)'; // Crimson (> 70 km/h)
        ctx.lineWidth = 2.4;
      } else if (localSpeed >= 50) {
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.85)'; // Orange (50 - 70 km/h)
        ctx.lineWidth = 2.0;
      } else if (localSpeed >= 30) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)'; // Amber (30 - 50 km/h)
        ctx.lineWidth = 1.6;
      } else if (localSpeed >= 15) {
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)'; // Emerald (15 - 30 km/h)
        ctx.lineWidth = 1.4;
      } else {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'; // Sky Blue (< 15 km/h)
        ctx.lineWidth = 1.2;
      }

      ctx.stroke();

      // Vector head dot
      if (p.age % 10 === 0) {
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(pxNext.x, pxNext.y, ctx.lineWidth * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
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
