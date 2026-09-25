import { CelestialState } from './celestial.model';
import { GeoLocation } from './location.model';
import { WeatherData } from './weather.model';

export interface WorldState {
  instant: Date;
  location: GeoLocation;
  timezone: string;
  localTime: string;
  localDate: string;
  utcTime: string;
  utcOffsetMinutes: number;
  celestial: CelestialState;
  weather: WeatherData;
  sunPhase: CelestialState['twilightState'];
  isDaylight: boolean;
  isAstronomicalNight: boolean;
  timeOfDayFraction: number;
  solarIntensity: number;
  lunarIllumination: number;
  skyVisibility: number;
}
