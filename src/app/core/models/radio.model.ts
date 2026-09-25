export interface RadioStation {
  id: string;
  stationuuid?: string;
  name: string;
  url: string;
  urlResolved?: string;
  homepage?: string;
  favicon?: string;
  country: string;
  countryCode: string;
  state?: string;
  city: string;
  language?: string;
  tags: string[];
  votes?: number;
  clickCount?: number;
  codec?: string;
  bitrate?: number;
  latitude: number;
  longitude: number;
  timezone: string;
  isFavorite?: boolean;
}

export interface StationSearchParams {
  query?: string;
  country?: string;
  city?: string;
  tag?: string;
  language?: string;
  limit?: number;
}

export interface PlayingLocationContext {
  station: RadioStation;
  localTime: string;
  utcOffset: string;
  solarAltitude: number;
  isDaylight: boolean;
  astroState: 'day' | 'twilight' | 'night';
  moonPhaseName: string;
  moonIllumination: number;
  weatherSummary?: string;
  temperatureC?: number;
}
