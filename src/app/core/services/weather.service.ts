import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Season, WeatherAggressivenessLevel, WeatherCondition, WeatherData, WeatherOverrideConfig } from '../models/weather.model';
import { GeoLocation } from '../models/location.model';

export interface WorldWeatherSnapshot {
  locationId: string;
  temperatureC: number;
  condition: WeatherCondition;
  cloudCoverPct: number;
  windSpeedKmh: number;
  precipitationPct: number;
}

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private isBrowser = isPlatformBrowser(this.platformId);

  readonly rawWeather = signal<WeatherData>(this.getDefaultWeatherData());
  readonly hourlyForecasts = signal<{ timeMs: number; weather: WeatherData }[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly overrideConfig = signal<WeatherOverrideConfig>({ active: false });
  readonly isFahrenheit = signal<boolean>(false);
  readonly worldWeather = signal<Record<string, WorldWeatherSnapshot>>({});
  private worldWeatherFetchedAt = 0;


  fetchWorldWeather(locations: GeoLocation[]): void {
    if (!this.isBrowser || locations.length === 0) return;
    const now = Date.now();
    if (now - this.worldWeatherFetchedAt < 10 * 60 * 1000 && Object.keys(this.worldWeather()).length > 0) return;

    const params = new HttpParams()
      .set('latitude', locations.map(loc => loc.latitude.toFixed(4)).join(','))
      .set('longitude', locations.map(loc => loc.longitude.toFixed(4)).join(','))
      .set('current', 'temperature_2m,precipitation,weather_code,cloud_cover,wind_speed_10m')
      .set('timezone', 'UTC');

    this.http.get<any>('/api/v1/weather', { params }).subscribe({
      next: (data) => {
        const rows = Array.isArray(data) ? data : [data];
        const next: Record<string, WorldWeatherSnapshot> = {};
        rows.forEach((row: any, index: number) => {
          const loc = locations[index];
          if (!loc || !row?.current) return;
          const current = row.current;
          const condition = this.mapWmoCodeToCondition(Number(current.weather_code ?? 0));
          next[loc.id] = {
            locationId: loc.id,
            temperatureC: Math.round(Number(current.temperature_2m ?? 0) * 10) / 10,
            condition,
            cloudCoverPct: Math.round(Number(current.cloud_cover ?? 0)),
            windSpeedKmh: Math.round(Number(current.wind_speed_10m ?? 0)),
            precipitationPct: Number(current.precipitation ?? 0) > 0 ? 100 : 0
          };
        });
        this.worldWeather.set(next);
        this.worldWeatherFetchedAt = Date.now();
      }
    });
  }

  toggleFahrenheit(): void {
    this.isFahrenheit.update(v => !v);
  }

  readonly activeAlerts = computed(() => {
    const w = this.rawWeather();
    const alerts: { id: string; title: string; category: string; severity: 'Warning' | 'Advisory' | 'Watch'; description: string; issuedAt: string }[] = [];

    if (w.condition === 'thunderstorm' || w.condition === 'severe_thunderstorm') {
      alerts.push({
        id: 'alert-lightning',
        title: 'Thunderstorm & Lightning Warning',
        category: 'Convective Storm',
        severity: 'Warning',
        description: 'Active cloud-to-ground lightning activity and convective gust fronts detected.',
        issuedAt: 'Live Telemetry'
      });
    }

    if (w.windSpeedKmh > 40 || (w.windGustKmh ?? 0) > 55) {
      alerts.push({
        id: 'alert-wind',
        title: 'High Wind & Gale Advisory',
        category: 'Atmosphere Flow',
        severity: 'Advisory',
        description: `Sustained surface winds exceeding ${w.windSpeedKmh} km/h with gusts up to ${w.windGustKmh ?? w.windSpeedKmh} km/h.`,
        issuedAt: 'Live Telemetry'
      });
    }

    if (w.condition === 'heavy_rain') {
      alerts.push({
        id: 'alert-rain',
        title: 'Heavy Rain & Flash Flood Watch',
        category: 'Precipitation',
        severity: 'Watch',
        description: 'Intense rain rate with reduced visibility.',
        issuedAt: 'Live Telemetry'
      });
    }

    if (w.condition === 'blizzard' || w.condition === 'heavy_snow') {
      alerts.push({
        id: 'alert-snow',
        title: 'Winter Blizzard Warning',
        category: 'Winter Weather',
        severity: 'Warning',
        description: 'Blowing snow and severe freeze conditions.',
        issuedAt: 'Live Telemetry'
      });
    }

    return alerts;
  });

  // Compute weather status for any specific simulated date & time
  getWeatherForInstant(date: Date, _loc?: GeoLocation): WeatherData {
    const ovr = this.overrideConfig();
    const hourly = this.hourlyForecasts();

    // If manual override is active
    if (ovr.active) {
      const raw = this.rawWeather();
      const condition = ovr.condition || raw.condition;
      const cloudCoverPct = ovr.cloudCoverPct !== undefined ? ovr.cloudCoverPct : this.getConditionDefaultCloud(condition);
      const precipitationPct = ovr.precipitationPct !== undefined ? ovr.precipitationPct : this.getConditionDefaultPrecip(condition);
      const windSpeedKmh = ovr.windSpeedKmh !== undefined ? ovr.windSpeedKmh : (condition === 'blizzard' ? 55 : ((condition === 'severe_thunderstorm' || condition === 'thunderstorm') ? 42 : raw.windSpeedKmh));
      const windGustKmh = Math.round(windSpeedKmh * 1.45);
      const { score, label } = this.calculateAggressiveness(condition, windSpeedKmh, windGustKmh, precipitationPct, raw.temperatureC);

      return {
        ...raw,
        condition,
        conditionLabel: this.formatConditionLabel(condition),
        cloudCoverPct,
        precipitationPct,
        windSpeedKmh,
        windGustKmh,
        aggressivenessIndex: Math.min(100, Math.max(0, score + (ovr.aggressivenessBoost || 0))),
        aggressivenessLabel: label,
        isSimulated: true
      };
    }

    // Try finding exact hourly forecast match for this simulated time
    if (hourly.length > 0) {
      const targetMs = date.getTime();
      let closest = hourly[0];
      let minDiff = Math.abs(targetMs - closest.timeMs);

      for (let i = 1; i < hourly.length; i++) {
        const diff = Math.abs(targetMs - hourly[i].timeMs);
        if (diff < minDiff) {
          minDiff = diff;
          closest = hourly[i];
        }
      }

      // If closest forecast is within 2 hours
      if (minDiff <= 7200000) {
        return closest.weather;
      }
    }

    // Default: use current raw weather
    return this.rawWeather();
  }

  // Active combined weather accounting for manual overrides
  readonly currentWeather = computed<WeatherData>(() => {
    const raw = this.rawWeather();
    const override = this.overrideConfig();
    if (!override.active) return raw;
    const condition = override.condition || raw.condition;
    return {
      ...raw,
      condition,
      conditionLabel: this.formatConditionLabel(condition),
      cloudCoverPct: override.cloudCoverPct ?? raw.cloudCoverPct,
      precipitationPct: override.precipitationPct ?? raw.precipitationPct,
      windSpeedKmh: override.windSpeedKmh ?? raw.windSpeedKmh,
      windGustKmh: override.windSpeedKmh !== undefined ? Math.round(override.windSpeedKmh * 1.45) : raw.windGustKmh,
      isSimulated: true
    };
  });

  private lastFetchedKey = '';
  private lastRequestedKey = '';
  private weatherCache = new Map<string, { weather: WeatherData; hourly: { timeMs: number; weather: WeatherData }[]; timestamp: number }>();
  private pendingKeys = new Set<string>();
  private requestSequence = 0;
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

  fetchWeatherForLocation(loc: GeoLocation): void {
    ++this.requestSequence;
    const key = `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}`;
    if (this.lastRequestedKey && this.lastRequestedKey !== key) {
      this.clearOverride();
    }
    this.lastRequestedKey = key;

    // Check memory cache first
    const cached = this.weatherCache.get(key);
    const now = Date.now();
    if (cached && (now - cached.timestamp < this.CACHE_TTL_MS)) {
      this.rawWeather.set(cached.weather);
      this.hourlyForecasts.set(cached.hourly);
      this.lastFetchedKey = key;
      return;
    }

    if (this.lastFetchedKey === key && !this.rawWeather().isSimulated) {
      return;
    }

    // Prevent concurrent duplicate requests for the same location
    if (this.pendingKeys.has(key)) {
      return;
    }

    if (!this.isBrowser) {
      this.rawWeather.set(this.generateRealisticWeather(loc));
      return;
    }

    this.pendingKeys.add(key);
    this.isLoading.set(true);
    const params = new HttpParams()
      .set('latitude', loc.latitude)
      .set('longitude', loc.longitude)
      .set('current', 'temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,rain,showers,snowfall,snow_depth,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,pressure_msl,visibility,uv_index,is_day')
      .set('hourly', 'temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,snow_depth,weather_code,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,pressure_msl,visibility,uv_index,is_day,freezing_level_height')
      .set('forecast_days', '7')
      .set('timezone', 'UTC');

    this.http.get<any>('https://api.open-meteo.com/v1/forecast', { params })
      .subscribe({
        next: (data) => {
          this.isLoading.set(false);
          if (key !== this.lastRequestedKey) {
            this.pendingKeys.delete(key);
            return;
          }
          if (data && data.current) {
            const c = data.current;
            const condition = this.mapWmoCodeToCondition(c.weather_code);
            const tempC = c.temperature_2m || 20;
            const tempF = Math.round((tempC * 9 / 5 + 32) * 10) / 10;
            const feelsC = c.apparent_temperature || tempC;
            const feelsF = Math.round((feelsC * 9 / 5 + 32) * 10) / 10;
            const windSpeedKmh = Math.round(c.wind_speed_10m || 10);
            const windGustKmh = Math.round(c.wind_gusts_10m || c.wind_speed_10m || 10);
            const precipitationPct = c.precipitation > 0 ? Math.min(100, Math.round(c.precipitation * 20)) : 0;

            const { score, label } = this.calculateAggressiveness(condition, windSpeedKmh, windGustKmh, precipitationPct, tempC);

            const weather: WeatherData = {
              condition,
              conditionLabel: this.formatConditionLabel(condition),
              temperatureC: Math.round(tempC * 10) / 10,
              temperatureF: tempF,
              feelsLikeC: Math.round(feelsC * 10) / 10,
              feelsLikeF: feelsF,
              humidityPct: c.relative_humidity_2m || 50,
              cloudCoverPct: c.cloud_cover !== undefined ? c.cloud_cover : this.getConditionDefaultCloud(condition),
              precipitationPct,
              windSpeedKmh,
              windDirectionDeg: c.wind_direction_10m ?? 180,
              windGustKmh,
              visibilityKm: Number.isFinite(c.visibility) ? Math.max(0.1, Math.round((c.visibility / 1000) * 10) / 10) : (condition === 'fog' ? 1.5 : (condition === 'heavy_rain' ? 4 : 18)),
              uvIndex: Number.isFinite(c.uv_index) ? Math.round(c.uv_index * 10) / 10 : 0,
              dewPointC: Number.isFinite(c.dew_point_2m) ? Math.round(c.dew_point_2m * 10) / 10 : tempC,
              precipitationMm: Number(c.precipitation || 0), rainMm: Number(c.rain || 0), showersMm: Number(c.showers || 0),
              snowfallCm: Number(c.snowfall || 0), snowDepthCm: Number(c.snow_depth || 0),
              cloudCoverLowPct: Number(c.cloud_cover_low ?? c.cloud_cover ?? 0), cloudCoverMidPct: Number(c.cloud_cover_mid ?? c.cloud_cover ?? 0), cloudCoverHighPct: Number(c.cloud_cover_high ?? c.cloud_cover ?? 0),
              freezingLevelM: 0, isDay: c.is_day !== undefined ? !!c.is_day : true,
              pressureHpa: Math.round(c.surface_pressure || 1013),
              seaLevelPressureHpa: Number.isFinite(c.pressure_msl) ? Math.round(c.pressure_msl) : undefined,
              aggressivenessIndex: score,
              aggressivenessLabel: label,
              lightningFrequencyPerMin: condition === 'thunderstorm' ? 6 : 0,
              winterFrostLevel: tempC <= 0 ? Math.min(100, Math.round((0 - tempC) * 5 + 30)) : 0,
              snowAccumulationCm: (condition === 'snow' || condition === 'blizzard') ? (condition === 'blizzard' ? 18 : 4) : 0,
              dataSource: 'open-meteo',
              isSimulated: false,
              updatedAt: new Date()
            };

            this.rawWeather.set(weather);
            this.lastFetchedKey = key;

            // Parse 7-day hourly forecast series
            if (data.hourly && Array.isArray(data.hourly.time)) {
              const times: string[] = data.hourly.time;
              const hTemps = data.hourly.temperature_2m || [];
              const hCodes = data.hourly.weather_code || [];
              const hClouds = data.hourly.cloud_cover || [];
              const hWinds = data.hourly.wind_speed_10m || [];
              const hPrecip = data.hourly.precipitation_probability || [];
              const hHumid = data.hourly.relative_humidity_2m || [];
              const hPress = data.hourly.surface_pressure || [];

              const parsed: { timeMs: number; weather: WeatherData }[] = [];
              for (let i = 0; i < times.length; i++) {
                const tMs = new Date(times[i]).getTime();
                if (!isNaN(tMs)) {
                  const hCond = this.mapWmoCodeToCondition(hCodes[i] ?? 0);
                  const hTC = Math.round((hTemps[i] ?? tempC) * 10) / 10;
                  const hTF = Math.round((hTC * 9 / 5 + 32) * 10) / 10;
                  const hWind = Math.round(hWinds[i] ?? 10);
                  const hPrecipPct = hPrecip[i] ?? 0;
                  const { score: hScore, label: hLabel } = this.calculateAggressiveness(hCond, hWind, Math.round(hWind * 1.3), hPrecipPct, hTC);

                  parsed.push({
                    timeMs: tMs,
                    weather: {
                      condition: hCond,
                      conditionLabel: this.formatConditionLabel(hCond),
                      temperatureC: hTC,
                      temperatureF: hTF,
                      feelsLikeC: hTC,
                      feelsLikeF: hTF,
                      humidityPct: hHumid[i] ?? 50,
                      cloudCoverPct: hClouds[i] ?? 20,
                      precipitationPct: hPrecipPct,
                      windSpeedKmh: hWind,
                      windDirectionDeg: 180,
                      windGustKmh: Math.round(hWind * 1.3),
                      visibilityKm: 16,
                      uvIndex: 4,
                      dewPointC: Number.isFinite(data.hourly.dew_point_2m?.[i]) ? Math.round(data.hourly.dew_point_2m[i] * 10) / 10 : hTC,
                      precipitationMm: Number(data.hourly.precipitation?.[i] ?? 0), rainMm: Number(data.hourly.rain?.[i] ?? 0), showersMm: Number(data.hourly.showers?.[i] ?? 0),
                      snowfallCm: Number(data.hourly.snowfall?.[i] ?? 0), snowDepthCm: Number(data.hourly.snow_depth?.[i] ?? 0),
                      cloudCoverLowPct: Number(data.hourly.cloud_cover_low?.[i] ?? hClouds[i] ?? 0), cloudCoverMidPct: Number(data.hourly.cloud_cover_mid?.[i] ?? hClouds[i] ?? 0), cloudCoverHighPct: Number(data.hourly.cloud_cover_high?.[i] ?? hClouds[i] ?? 0),
                      freezingLevelM: Number(data.hourly.freezing_level_height?.[i] ?? 0), isDay: data.hourly.is_day?.[i] !== undefined ? !!data.hourly.is_day[i] : true,
                      pressureHpa: Math.round(hPress[i] ?? 1013),
                      seaLevelPressureHpa: Number.isFinite(data.hourly.pressure_msl?.[i]) ? Math.round(data.hourly.pressure_msl[i]) : undefined,
                      aggressivenessIndex: hScore,
                      aggressivenessLabel: hLabel,
                      lightningFrequencyPerMin: hCond === 'thunderstorm' ? 5 : 0,
                      winterFrostLevel: hTC <= 0 ? 30 : 0,
                      snowAccumulationCm: 0,
                      dataSource: 'open-meteo',
                      isSimulated: true,
                      updatedAt: new Date()
                    }
                  });
                }
              }
              this.hourlyForecasts.set(parsed);
              this.weatherCache.set(key, {
                weather,
                hourly: parsed,
                timestamp: Date.now()
              });
            } else {
              this.weatherCache.set(key, {
                weather,
                hourly: [],
                timestamp: Date.now()
              });
            }

          } else {
            this.rawWeather.set(this.generateRealisticWeather(loc));
          }
          this.pendingKeys.delete(key);
        },
        error: () => {
          this.pendingKeys.delete(key);
          if (key !== this.lastRequestedKey) return;
          this.isLoading.set(false);
          this.rawWeather.set(this.generateRealisticWeather(loc));
        }
      });
  }

  setOverride(config: Partial<WeatherOverrideConfig>): void {
    this.overrideConfig.update(prev => ({
      ...prev,
      ...config,
      active: true
    }));
  }

  clearOverride(): void {
    this.overrideConfig.set({ active: false });
  }

  private calculateAggressiveness(
    cond: WeatherCondition,
    windKmh: number,
    gustKmh: number,
    precipPct: number,
    tempC: number
  ): { score: number; label: WeatherAggressivenessLevel } {
    let base = 10;
    if (cond === 'clear' || cond === 'clear_dry') base = 5;
    else if (cond === 'haze' || cond === 'dust_haze' || cond === 'heat_haze') base = 20;
    else if (cond === 'partly_cloudy' || cond === 'broken_clouds') base = 15;
    else if (cond === 'cloudy' || cond === 'overcast' || cond === 'low_clouds') base = 25;
    else if (cond === 'fog' || cond === 'freezing_fog') base = 35;
    else if (cond === 'drizzle' || cond === 'snow_flurries') base = 30;
    else if (cond === 'rain' || cond === 'sleet') base = 45;
    else if (cond === 'snow') base = 50;
    else if (cond === 'heavy_snow') base = 72;
    else if (cond === 'heavy_rain' || cond === 'heavy_downpour') base = 75;
    else if (cond === 'blizzard') base = 85;
    else if (cond === 'thunderstorm') base = 88;
    else if (cond === 'severe_thunderstorm' || cond === 'severe_storm' || cond === 'monsoon' || cond === 'tropical_storm') base = 96;
    else if (cond === 'winter_clear' || cond === 'winter_overcast') base = 40;
    else if (cond === 'aurora' || cond === 'solar_eclipse' || cond === 'lunar_eclipse') base = 15;

    // Wind component
    const windScore = Math.min(30, (windKmh / 60) * 20 + (gustKmh / 80) * 10);
    // Precip component
    const precipScore = (precipPct / 100) * 15;
    // Cold winter intensity factor
    const freezeScore = tempC < -5 ? Math.min(15, (-5 - tempC) * 0.8) : 0;

    const total = Math.min(100, Math.round(base + windScore + precipScore + freezeScore));

    let label: WeatherAggressivenessLevel = 'Calm';
    if (total >= 85) label = cond === 'blizzard' || cond === 'heavy_snow' || tempC < -5 ? 'Violent Blizzard' : 'Severe Storm';
    else if (total >= 65) label = 'Severe Storm';
    else if (total >= 45) label = 'Vigorous';
    else if (total >= 30) label = 'Active';
    else if (total >= 15) label = 'Gentle';
    else label = 'Calm';

    return { score: total, label };
  }

  private mapWmoCodeToCondition(code: number): WeatherCondition {
    if (code === 0) return 'clear';
    if (code === 1 || code === 2) return 'partly_cloudy';
    if (code === 3) return 'overcast';
    if (code >= 45 && code <= 48) return 'fog';
    if (code >= 51 && code <= 57) return 'drizzle';
    if (code >= 58 && code <= 65) return 'rain';
    if (code >= 66 && code <= 67) return 'freezing_rain';
    if (code >= 71 && code <= 75) return 'snow';
    if (code >= 76 && code <= 77) return 'heavy_snow';
    if (code >= 80 && code <= 82) return 'heavy_rain';
    if (code >= 85 && code <= 86) return 'snow';
    if (code === 95) return 'thunderstorm';
    if (code >= 96 && code <= 99) return 'severe_thunderstorm';
    return 'partly_cloudy';
  }

  formatConditionLabel(c: WeatherCondition): string {
    switch (c) {
      case 'clear': return 'Crystal Clear';
      case 'clear_dry': return 'Clear & Dry';
      case 'partly_cloudy': return 'Partly Cloudy';
      case 'broken_clouds': return 'Broken Clouds';
      case 'cloudy': return 'Cloudy';
      case 'overcast': return 'Overcast';
      case 'low_clouds': return 'Low Clouds';
      case 'drizzle': return 'Drizzle';
      case 'rain': return 'Light Rain';
      case 'freezing_rain': return 'Freezing Rain';
      case 'hail': return 'Hail';
      case 'heavy_rain': return 'Heavy Rain';
      case 'heavy_downpour': return 'Heavy Downpour';
      case 'thunderstorm': return 'Thunderstorm';
      case 'severe_storm':
      case 'severe_thunderstorm': return 'Severe Storm';
      case 'snow_flurries': return 'Snow Flurries';
      case 'snow': return 'Light Snow';
      case 'heavy_snow': return 'Heavy Snowfall';
      case 'blizzard': return 'Winter Blizzard';
      case 'sleet': return 'Sleet & Ice Rain';
      case 'fog': return 'Atmospheric Fog';
      case 'freezing_fog': return 'Freezing Fog';
      case 'haze': return 'Hazy';
      case 'dust_haze': return 'Dust & Sand Haze';
      case 'heat_haze': return 'Heat Haze';
      case 'winter_clear': return 'Winter Clear';
      case 'winter_overcast': return 'Winter Overcast';
      case 'spring_mist': return 'Spring Mist';
      case 'summer_heat_haze': return 'Summer Heat Haze';
      case 'autumn_haze': return 'Autumn Haze';
      case 'monsoon': return 'Monsoon';
      case 'tropical_storm': return 'Tropical Storm';
      case 'aurora': return 'Aurora Borealis';
      case 'solar_eclipse': return 'Solar Eclipse';
      case 'lunar_eclipse': return 'Lunar Eclipse';
      default: return 'Clear Sky';
    }
  }

  getConditionDefaultCloud(c: WeatherCondition): number {
    switch (c) {
      case 'clear':
      case 'clear_dry':
      case 'winter_clear':
      case 'heat_haze':
      case 'summer_heat_haze':
      case 'aurora':
      case 'solar_eclipse':
      case 'lunar_eclipse': return 5;
      case 'dust_haze':
      case 'spring_mist':
      case 'autumn_haze':
      case 'haze': return 25;
      case 'partly_cloudy': return 35;
      case 'snow_flurries': return 45;
      case 'broken_clouds': return 60;
      case 'low_clouds':
      case 'drizzle':
      case 'fog':
      case 'freezing_fog': return 75;
      case 'cloudy': return 80;
      case 'rain':
      case 'snow':
      case 'sleet':
      case 'freezing_rain': return 85;
      case 'overcast':
      case 'winter_overcast':
      case 'heavy_snow': return 95;
      case 'heavy_rain':
      case 'heavy_downpour':
      case 'thunderstorm':
      case 'severe_storm':
      case 'severe_thunderstorm':
      case 'blizzard':
      case 'monsoon':
      case 'tropical_storm': return 100;
      default: return 20;
    }
  }

  getConditionDefaultPrecip(c: WeatherCondition): number {
    switch (c) {
      case 'snow_flurries': return 20;
      case 'drizzle': return 35;
      case 'rain':
      case 'snow': return 60;
      case 'sleet':
      case 'freezing_rain': return 70;
      case 'heavy_rain':
      case 'heavy_snow': return 88;
      case 'thunderstorm': return 92;
      case 'heavy_downpour':
      case 'blizzard':
      case 'severe_storm':
      case 'severe_thunderstorm':
      case 'monsoon':
      case 'tropical_storm': return 100;
      default: return 0;
    }
  }

  /**
   * Determine astronomical season based on local calendar date and hemisphere
   */
  getSeason(date: Date, latitude: number, timezone = 'UTC'): Season {
    const localDateParts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).formatToParts(date);
    const month = Number(localDateParts.find(part => part.type === 'month')?.value ?? date.getUTCMonth() + 1) - 1;
    const isNorthern = latitude >= 0;

    // Northern hemisphere:
    // Dec(11), Jan(0), Feb(1) => winter
    // Mar(2), Apr(3), May(4) => spring
    // Jun(5), Jul(6), Aug(7) => summer
    // Sep(8), Oct(9), Nov(10) => autumn
    let northernSeason: 'winter' | 'spring' | 'summer' | 'autumn';
    if (month === 11 || month === 0 || month === 1) {
      northernSeason = 'winter';
    } else if (month >= 2 && month <= 4) {
      northernSeason = 'spring';
    } else if (month >= 5 && month <= 7) {
      northernSeason = 'summer';
    } else {
      northernSeason = 'autumn';
    }

    if (isNorthern) {
      return northernSeason;
    }

    // Invert for southern hemisphere
    const opposite: Record<'winter' | 'spring' | 'summer' | 'autumn', 'winter' | 'spring' | 'summer' | 'autumn'> = {
      winter: 'summer',
      spring: 'autumn',
      summer: 'winter',
      autumn: 'spring'
    };
    return opposite[northernSeason];
  }

  private generateRealisticWeather(loc: GeoLocation): WeatherData {
    const latAbs = Math.abs(loc.latitude);
    let tempC = 22 - (latAbs * 0.35);
    tempC = Math.round(tempC * 10) / 10;
    const tempF = Math.round((tempC * 9 / 5 + 32) * 10) / 10;
    const windSpeedKmh = 14;
    const windGustKmh = 22;

    const { score, label } = this.calculateAggressiveness('partly_cloudy', windSpeedKmh, windGustKmh, 0, tempC);

    return {
      condition: 'partly_cloudy',
      conditionLabel: 'Partly Cloudy',
      temperatureC: tempC,
      temperatureF: tempF,
      feelsLikeC: tempC,
      feelsLikeF: tempF,
      humidityPct: 58,
      cloudCoverPct: 35,
      precipitationPct: 0,
      windSpeedKmh,
      windDirectionDeg: 210,
      windGustKmh,
      visibilityKm: 16,
      uvIndex: 5,
      dewPointC: 13.2, precipitationMm: 0, rainMm: 0, showersMm: 0, snowfallCm: 0, snowDepthCm: 0,
      cloudCoverLowPct: 35, cloudCoverMidPct: 20, cloudCoverHighPct: 15, freezingLevelM: 3200, isDay: true,
      pressureHpa: 1014, seaLevelPressureHpa: 1014,
      aggressivenessIndex: score,
      aggressivenessLabel: label,
      lightningFrequencyPerMin: 0,
      winterFrostLevel: tempC <= 0 ? 40 : 0,
      snowAccumulationCm: 0,
      dataSource: 'fallback',
      isSimulated: true,
      updatedAt: new Date()
    };
  }

  private getDefaultWeatherData(): WeatherData {
    return {
      condition: 'clear',
      conditionLabel: 'Clear Sky',
      temperatureC: 21.5,
      temperatureF: 70.7,
      feelsLikeC: 21.5,
      feelsLikeF: 70.7,
      humidityPct: 50,
      cloudCoverPct: 15,
      precipitationPct: 0,
      windSpeedKmh: 12,
      windDirectionDeg: 180,
      windGustKmh: 16,
      visibilityKm: 18,
      uvIndex: 5.2,
      dewPointC: 10.8, precipitationMm: 0, rainMm: 0, showersMm: 0, snowfallCm: 0, snowDepthCm: 0,
      cloudCoverLowPct: 15, cloudCoverMidPct: 10, cloudCoverHighPct: 8, freezingLevelM: 3300, isDay: true,
      pressureHpa: 1015, seaLevelPressureHpa: 1015,
      aggressivenessIndex: 12,
      aggressivenessLabel: 'Calm',
      lightningFrequencyPerMin: 0,
      winterFrostLevel: 0,
      snowAccumulationCm: 0,
      isSimulated: true,
      updatedAt: new Date()
    };
  }
}
