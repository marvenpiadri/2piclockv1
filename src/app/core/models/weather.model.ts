export type WeatherCondition =
  // Clear
  | 'clear'
  | 'clear_dry'
  // Clouds
  | 'partly_cloudy'
  | 'broken_clouds'
  | 'cloudy'
  | 'overcast'
  | 'low_clouds'
  // Moisture & Visibility
  | 'haze'
  | 'dust_haze'
  | 'fog'
  | 'freezing_fog'
  | 'heat_haze'
  // Rain
  | 'drizzle'
  | 'rain'
  | 'heavy_rain'
  | 'heavy_downpour'
  | 'thunderstorm'
  | 'severe_storm'
  | 'severe_thunderstorm'
  // Snow & Winter
  | 'snow_flurries'
  | 'snow'
  | 'heavy_snow'
  | 'blizzard'
  | 'sleet'
  | 'freezing_rain'
  | 'hail'
  | 'winter_clear'
  | 'winter_overcast'
  // Seasonal
  | 'spring_mist'
  | 'summer_heat_haze'
  | 'autumn_haze'
  // Special
  | 'monsoon'
  | 'tropical_storm'
  | 'aurora'
  | 'solar_eclipse'
  | 'lunar_eclipse';

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';

export interface AtmosphericState {
  season: Season;
  seasonalTemperatureBias: number;
  cloudCoverage: number; // 0 to 1
  cloudType: 'cumulus' | 'stratus' | 'cirrus' | 'cumulonimbus' | 'low_stratus' | 'broken';
  cloudAltitude: number; // 0 to 1
  humidity: number; // 0 to 1
  visibilityKm: number; // 0.1 to 50
  haze: number; // 0 to 1
  dustAerosols: number; // 0 to 1 (amber warm particulate scattering)
  heatShimmer: number; // 0 to 1 (convective horizon distortion)
  freezingFrost: number; // 0 to 1 (ice crystal scintillation, pale sky)
  precipitationType: 'none' | 'rain' | 'drizzle' | 'downpour' | 'snow' | 'flurries' | 'blizzard' | 'sleet';
  precipitationIntensity: number; // 0 to 1
  windSpeedKmh: number;
  windDirectionDeg: number;
  stormActivity: number; // 0 to 1 (lightning potential)
  auroraActivity: number; // 0 to 1
  isEclipse: boolean;
  eclipseType?: 'solar' | 'lunar';
  eclipseObscuration?: number; // 0 to 1
}

export type WeatherAggressivenessLevel =
  | 'Calm'
  | 'Gentle'
  | 'Active'
  | 'Vigorous'
  | 'Severe Storm'
  | 'Violent Blizzard';

export interface WeatherAlert {
  id: string;
  severity: 'warning' | 'advisory' | 'watch';
  title: string;
  category: 'storm' | 'wind' | 'rain' | 'snow' | 'fog' | 'heat' | 'cold';
  description: string;
  issuedAt: Date;
  metricLabel?: string;
}

export interface WeatherData {
  condition: WeatherCondition;
  conditionLabel: string;
  temperatureC: number;
  temperatureF: number;
  feelsLikeC: number;
  feelsLikeF: number;
  humidityPct: number;
  cloudCoverPct: number;
  precipitationPct: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windGustKmh?: number;
  visibilityKm: number;
  uvIndex: number;
  dewPointC: number;
  precipitationMm: number;
  rainMm: number;
  showersMm: number;
  snowfallCm: number;
  snowDepthCm: number;
  cloudCoverLowPct: number;
  cloudCoverMidPct: number;
  cloudCoverHighPct: number;
  freezingLevelM: number;
  isDay: boolean;
  pressureHpa: number;
  seaLevelPressureHpa?: number;
  aggressivenessIndex: number; // 0 to 100 severity rating
  aggressivenessLabel: WeatherAggressivenessLevel;
  lightningFrequencyPerMin?: number;
  winterFrostLevel?: number; // 0 to 100
  snowAccumulationCm?: number;
  dataSource?: 'open-meteo' | 'fallback' | 'simulation';
  isSimulated: boolean;
  updatedAt: Date;
}

export interface WeatherOverrideConfig {
  active: boolean;
  condition?: WeatherCondition;
  cloudCoverPct?: number;
  precipitationPct?: number;
  windSpeedKmh?: number;
  aggressivenessBoost?: number;
  fogDensity?: number;
}
