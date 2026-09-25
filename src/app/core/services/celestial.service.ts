import { Injectable, inject, computed, effect, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LocationService } from './location.service';
import { TimeControlService } from './time-control.service';
import { WeatherService } from './weather.service';
import { PrecisionAstronomyService, SolarCrossCheck, PlanetaryPosition } from './precision-astronomy.service';
import { getCelestialState, get24HourSolarCurve } from '../astronomy/astronomy-engine';
import { CelestialState } from '../models/celestial.model';

@Injectable({
  providedIn: 'root'
})
export class CelestialService {
  private platformId = inject(PLATFORM_ID);
  private locationService = inject(LocationService);
  private timeControlService = inject(TimeControlService);
  private weatherService = inject(WeatherService);
  private precisionAstronomy = inject(PrecisionAstronomyService);

  readonly selectedLocation = this.locationService.selectedLocation;
  readonly activeDate = this.timeControlService.currentActiveDate;
  readonly currentWeather = computed(() => {
    const d = this.activeDate();
    const loc = this.selectedLocation();
    return this.weatherService.getWeatherForInstant(d, loc);
  });
  readonly isWeatherLoading = this.weatherService.isLoading;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Eagerly keep weather up to date when the active location changes
      effect(() => {
        const loc = this.selectedLocation();
        if (loc) {
          this.weatherService.fetchWeatherForLocation(loc);
        }
      });
    }
  }

  // Active Astronomical & Celestial State computed from Date + Location
  readonly celestialState = computed<CelestialState>(() => {
    const loc = this.selectedLocation();
    const date = this.activeDate();
    return getCelestialState(date, loc.latitude, loc.longitude, loc.timezone);
  });

  private lastCrossCheckKey = '';
  private cachedSolarCrossCheck: SolarCrossCheck | null = null;

  // Dual-Engine Solar Validation Cross-Check (NOAA/Meeus/AstronomyEngine vs SunCalc)
  readonly solarCrossCheck = computed<SolarCrossCheck>(() => {
    const loc = this.selectedLocation();
    const date = this.activeDate();
    const minuteEpoch = Math.floor(date.getTime() / 60000);
    const key = `${minuteEpoch}_${loc.id}`;
    if (key === this.lastCrossCheckKey && this.cachedSolarCrossCheck) {
      return this.cachedSolarCrossCheck;
    }
    this.lastCrossCheckKey = key;
    this.cachedSolarCrossCheck = this.precisionAstronomy.crossCheckSun(date, loc.latitude, loc.longitude);
    return this.cachedSolarCrossCheck;
  });

  private lastPlanetaryKey = '';
  private cachedPlanetaryPositions: PlanetaryPosition[] = [];

  // Ephemeris planetary positions (Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune)
  readonly planetaryPositions = computed<PlanetaryPosition[]>(() => {
    const loc = this.selectedLocation();
    const date = this.activeDate();
    const minuteEpoch = Math.floor(date.getTime() / 60000);
    const key = `${minuteEpoch}_${loc.id}`;
    if (key === this.lastPlanetaryKey && this.cachedPlanetaryPositions.length > 0) {
      return this.cachedPlanetaryPositions;
    }
    this.lastPlanetaryKey = key;
    this.cachedPlanetaryPositions = this.precisionAstronomy.getPlanetaryPositions(
      date,
      loc.latitude,
      loc.longitude,
      loc.elevationMeters ?? 0
    );
    return this.cachedPlanetaryPositions;
  });

  // 24-hour Solar Elevation curve for the active day/location
  readonly solarCurve = computed(() => {
    const loc = this.selectedLocation();
    const date = this.activeDate();
    return get24HourSolarCurve(date, loc.latitude, loc.longitude, loc.timezone);
  });

  // 2Pi Clock Polar Angles (0 to 2*PI radians)
  readonly polarClockAngles = computed(() => {
    const state = this.celestialState();
    const date = this.activeDate();
    const timezone = this.selectedLocation().timezone;

    // 2π is the local civil-day dial for the selected location.
    // Astronomy remains instant/UTC based; only this visualization is localized.
    const localHourFraction = (instant: Date): number => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(instant);

      const get = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
      return get('hour') + get('minute') / 60 + get('second') / 3600;
    };

    const timeAngleRad = (localHourFraction(date) / 24) * 2 * Math.PI;
    const events = state.solarEvents;
    const sunriseAngleRad = events.sunrise
      ? (localHourFraction(events.sunrise) / 24) * 2 * Math.PI
      : null;
    const sunsetAngleRad = events.sunset
      ? (localHourFraction(events.sunset) / 24) * 2 * Math.PI
      : null;

    return {
      timeAngleRad,
      sunriseAngleRad,
      sunsetAngleRad,
      sunAltitude: state.sun.altitudeDeg,
      sunAzimuth: state.sun.azimuthDeg,
      moonAltitude: state.moon.altitudeDeg,
      moonAzimuth: state.moon.azimuthDeg
    };
  });

  // Formatted city local time
  readonly formattedLocalTime = computed(() => {
    const loc = this.selectedLocation();
    const date = this.activeDate();
    try {
      return date.toLocaleTimeString('en-US', {
        timeZone: loc.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return date.toTimeString().slice(0, 8);
    }
  });

  // Formatted date string in local timezone
  readonly formattedLocalDate = computed(() => {
    const loc = this.selectedLocation();
    const date = this.activeDate();
    try {
      return date.toLocaleDateString('en-US', {
        timeZone: loc.timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return date.toDateString();
    }
  });

  // Timezone display (e.g. UTC+9 / JST)
  readonly timezoneDisplay = computed(() => {
    const loc = this.selectedLocation();
    const date = this.activeDate();
    try {
      const str = new Intl.DateTimeFormat('en-US', {
        timeZone: loc.timezone,
        timeZoneName: 'shortOffset'
      }).format(date);
      const parts = str.split(' ');
      return parts[parts.length - 1] || loc.timezone;
    } catch {
      return loc.timezone;
    }
  });

  // Derived atmospheric brightness for UI contrast adaptation
  readonly isBrightSky = computed(() => {
    return this.celestialState().sun.altitudeDeg > 6;
  });

  readonly skyLuminance = computed(() => {
    // 0.0 (pitch black night) to 1.0 (noon daylight)
    const alt = this.celestialState().sun.altitudeDeg;
    return Math.max(0, Math.min(1, (alt + 12) / 36));
  });

  readonly twilightState = computed(() => this.celestialState().twilightState);
}
