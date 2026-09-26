import { Injectable, inject, computed, effect, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { LocationService } from './location.service';
import { TimeControlService } from './time-control.service';
import { WeatherService } from './weather.service';
import { PrecisionAstronomyService, SolarCrossCheck, PlanetaryPosition } from './precision-astronomy.service';
import { getCelestialState, get24HourSolarCurve } from '../astronomy/astronomy-engine';
import { CelestialState } from '../models/celestial.model';
import { AtmosphericState, Season } from '../models/weather.model';
import * as Astronomy from 'astronomy-engine';
interface VisibleConstellation {
  name: string;
  altitudeDeg: number;
  azimuthDeg: number;
  season: string;
}



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
      let previousLocKey = '';
      // Location is the single trigger for weather refresh. Keeping this here
      // prevents LocationService and CelestialService from issuing competing requests.
      effect(() => {
        const loc = this.selectedLocation();
        if (loc) {
          const key = `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}`;
          if (previousLocKey && previousLocKey !== key) {
            this.weatherService.clearOverride();
          }
          previousLocKey = key;
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

  /**
   * Authoritative layered Atmospheric State derived from location, date, astronomy, season, and weather
   */
  readonly atmosphericState = computed<AtmosphericState>(() => {
    const loc = this.selectedLocation();
    const date = this.activeDate();
    const w = this.currentWeather();
    const c = this.celestialState();

    // 1. Natural astronomical season from date + latitude
    let season: Season = this.weatherService.getSeason(date, loc.latitude);
    let seasonalBias = 0;
    if (season === 'winter') seasonalBias = -8;
    else if (season === 'summer') seasonalBias = +8;
    else if (season === 'spring') seasonalBias = -1;
    else seasonalBias = +1;

    // Preset / condition overrides for season
    if (w.condition === 'winter_clear' || w.condition === 'winter_overcast') {
      season = 'winter';
      seasonalBias = -10;
    } else if (w.condition === 'summer_heat_haze') {
      season = 'summer';
      seasonalBias = +12;
    } else if (w.condition === 'spring_mist') {
      season = 'spring';
      seasonalBias = 0;
    } else if (w.condition === 'autumn_haze') {
      season = 'autumn';
      seasonalBias = +2;
    }

    // 2. Cloud coverage (0 to 1) & Cloud Type
    let cloudCoverage = Math.max(0, Math.min(1, w.cloudCoverPct / 100));
    let cloudType: AtmosphericState['cloudType'] = 'cumulus';
    let cloudAltitude = 0.45;

    if (
      w.condition === 'thunderstorm' ||
      w.condition === 'severe_storm' ||
      w.condition === 'severe_thunderstorm' ||
      w.condition === 'monsoon' ||
      w.condition === 'tropical_storm'
    ) {
      cloudType = 'cumulonimbus';
      cloudCoverage = Math.max(0.85, cloudCoverage);
      cloudAltitude = 0.5;
    } else if (w.condition === 'low_clouds') {
      cloudType = 'low_stratus';
      cloudAltitude = 0.18;
    } else if (w.condition === 'broken_clouds') {
      cloudType = 'broken';
      cloudAltitude = 0.5;
    } else if (w.condition === 'cloudy' || w.condition === 'overcast' || w.condition === 'winter_overcast') {
      cloudType = 'stratus';
      cloudAltitude = 0.4;
    } else if (w.condition === 'fog' || w.condition === 'freezing_fog') {
      cloudType = 'low_stratus';
      cloudAltitude = 0.08;
    } else if (w.condition === 'spring_mist' || w.condition === 'autumn_haze' || w.condition === 'clear_dry') {
      cloudType = 'cirrus';
      cloudAltitude = 0.7;
    }

    // 3. Visibility
    let visibilityKm = Math.max(0.1, Math.min(50, w.visibilityKm));
    if (w.condition === 'fog' || w.condition === 'freezing_fog') {
      visibilityKm = Math.min(visibilityKm, 1.2);
    } else if (w.condition === 'clear' || w.condition === 'clear_dry') {
      visibilityKm = Math.max(visibilityKm, 35);
    }

    // 4. Haze, Dust, Heat Shimmer, Freezing Frost
    const haze =
      w.condition === 'haze' || w.condition === 'autumn_haze'
        ? 0.8
        : Math.max(0, (1 - Math.min(1, visibilityKm / 25)) * 0.65);
    const dustAerosols = w.condition === 'dust_haze' ? 0.9 : 0;
    const heatShimmer =
      w.condition === 'heat_haze' || w.condition === 'summer_heat_haze'
        ? 0.85
        : w.temperatureC >= 28 && c.sun.altitudeDeg > 12 && cloudCoverage < 0.45
        ? Math.min(0.75, (w.temperatureC - 28) * 0.1)
        : 0;
    const freezingFrost =
      w.condition === 'freezing_fog' || w.condition === 'winter_clear' || w.condition === 'blizzard'
        ? 0.85
        : w.temperatureC <= 0
        ? Math.min(0.9, Math.abs(w.temperatureC) * 0.08 + 0.15)
        : 0;

    // 5. Precipitation
    let precipType: AtmosphericState['precipitationType'] = 'none';
    let precipIntensity = Math.max(0, Math.min(1, w.precipitationPct / 100));

    if (w.condition === 'drizzle') {
      precipType = 'drizzle';
      precipIntensity = Math.max(0.25, precipIntensity);
    } else if (w.condition === 'rain') {
      precipType = 'rain';
      precipIntensity = Math.max(0.45, precipIntensity);
    } else if (w.condition === 'heavy_rain') {
      precipType = 'rain';
      precipIntensity = Math.max(0.85, precipIntensity);
    } else if (w.condition === 'heavy_downpour' || w.condition === 'monsoon') {
      precipType = 'downpour';
      precipIntensity = 1.0;
    } else if (w.condition === 'snow_flurries') {
      precipType = 'flurries';
      precipIntensity = Math.max(0.2, precipIntensity);
    } else if (w.condition === 'snow') {
      precipType = 'snow';
      precipIntensity = Math.max(0.45, precipIntensity);
    } else if (w.condition === 'heavy_snow') {
      precipType = 'snow';
      precipIntensity = Math.max(0.85, precipIntensity);
    } else if (w.condition === 'blizzard') {
      precipType = 'blizzard';
      precipIntensity = 1.0;
    } else if (w.condition === 'sleet' || w.condition === 'freezing_rain') {
      precipType = 'sleet';
      precipIntensity = Math.max(0.5, precipIntensity);
    } else if (
      w.condition === 'thunderstorm' ||
      w.condition === 'severe_storm' ||
      w.condition === 'severe_thunderstorm' ||
      w.condition === 'tropical_storm'
    ) {
      precipType = (w.condition === 'severe_storm' || w.condition === 'tropical_storm') ? 'downpour' : 'rain';
      precipIntensity = Math.max(0.85, precipIntensity);
    }

    // 6. Storm activity (electrical potential)
    let stormActivity = 0;
    if (w.condition === 'severe_storm' || w.condition === 'severe_thunderstorm') stormActivity = 1.0;
    else if (w.condition === 'thunderstorm') stormActivity = 0.85;
    else if (w.condition === 'tropical_storm') stormActivity = 0.7;
    else if (w.condition === 'monsoon') stormActivity = 0.55;

    // 7. Aurora
    let auroraActivity = 0;
    if (w.condition === 'aurora') {
      auroraActivity = 1.0;
    } else if (Math.abs(loc.latitude) >= 53 && c.sun.altitudeDeg < -12 && cloudCoverage < 0.5) {
      auroraActivity = 0.5;
    }

    // 8. Eclipses
    let isEclipse = false;
    let eclipseType: 'solar' | 'lunar' | undefined = undefined;
    let eclipseObscuration = 0;
    if (w.condition === 'solar_eclipse') {
      isEclipse = true;
      eclipseType = 'solar';
      eclipseObscuration = 0.96;
    } else if (w.condition === 'lunar_eclipse') {
      isEclipse = true;
      eclipseType = 'lunar';
      eclipseObscuration = 1.0;
    }

    return {
      season,
      seasonalTemperatureBias: seasonalBias,
      cloudCoverage,
      cloudType,
      cloudAltitude,
      humidity: Math.max(0, Math.min(1, w.humidityPct / 100)),
      visibilityKm,
      haze,
      dustAerosols,
      heatShimmer,
      freezingFrost,
      precipitationType: precipType,
      precipitationIntensity: precipIntensity,
      windSpeedKmh: w.windSpeedKmh,
      windDirectionDeg: w.windDirectionDeg,
      stormActivity,
      auroraActivity,
      isEclipse,
      eclipseType,
      eclipseObscuration
    };
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

  /**
   * Returns a compact observing list based on representative constellation
   * coordinates. This is intentionally a guide for Tonight, not a dense chart.
   */
  getVisibleConstellations(
    date: Date,
    latitude: number,
    longitude: number,
    minAltitudeDeg = 8
  ): VisibleConstellation[] {
    const observer = new Astronomy.Observer(latitude, longitude, 0);
    const catalog: { name: string; ra: number; dec: number; season: string }[] = [
      { name: 'Orion', ra: 83.8, dec: 0.0, season: 'Winter' },
      { name: 'Taurus', ra: 68.0, dec: 15.0, season: 'Winter' },
      { name: 'Gemini', ra: 102.5, dec: 22.0, season: 'Winter' },
      { name: 'Leo', ra: 168.0, dec: 15.0, season: 'Spring' },
      { name: 'Virgo', ra: 190.0, dec: -2.0, season: 'Spring' },
      { name: 'Scorpius', ra: 250.0, dec: -30.0, season: 'Summer' },
      { name: 'Sagittarius', ra: 280.0, dec: -25.0, season: 'Summer' },
      { name: 'Cygnus', ra: 305.0, dec: 40.0, season: 'Summer' },
      { name: 'Lyra', ra: 280.0, dec: 40.0, season: 'Summer' },
      { name: 'Aquila', ra: 296.0, dec: 5.0, season: 'Summer' },
      { name: 'Pegasus', ra: 350.0, dec: 20.0, season: 'Autumn' },
      { name: 'Andromeda', ra: 10.0, dec: 35.0, season: 'Autumn' },
      { name: 'Cassiopeia', ra: 10.0, dec: 60.0, season: 'Autumn' },
      { name: 'Ursa Major', ra: 165.0, dec: 55.0, season: 'Spring' },
      { name: 'Canis Major', ra: 101.0, dec: -23.0, season: 'Winter' }
    ];

    return catalog
      .map(item => {
        const horizontal = Astronomy.Horizon(
          date,
          observer,
          item.ra / 15,
          item.dec,
          'normal'
        );
        return {
          name: item.name,
          altitudeDeg: horizontal.altitude,
          azimuthDeg: horizontal.azimuth,
          season: item.season
        };
      })
      .filter(item => item.altitudeDeg >= minAltitudeDeg)
      .sort((a, b) => b.altitudeDeg - a.altitudeDeg);
  }

  getPlanetRiseSet(
    body: PlanetaryPosition['body'],
    date: Date,
    latitude: number,
    longitude: number,
    elevationMeters = 0
  ): { rise: Date | null; set: Date | null } {
    return this.precisionAstronomy.getRiseSet(body, date, latitude, longitude, elevationMeters);
  }

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
