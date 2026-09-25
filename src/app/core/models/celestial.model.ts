export type TwilightState =
  | 'day'
  | 'golden_hour'
  | 'civil_twilight'
  | 'nautical_twilight'
  | 'astronomical_twilight'
  | 'night';

export type MoonPhaseName =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Third Quarter'
  | 'Waning Crescent';

export interface SolarPosition {
  altitudeDeg: number;       // Elevation angle above horizon (-90 to +90)
  azimuthDeg: number;        // Compass bearing (0 = North, 90 = East, 180 = South, 270 = West)
  zenithDeg: number;         // 90 - altitude
  declinationDeg: number;
  rightAscensionDeg: number;
  equationOfTimeMinutes: number;
  isAboveHorizon: boolean;
  distanceAU: number;
}

export interface SolarEvents {
  astronomicalDawn: Date | null;
  nauticalDawn: Date | null;
  civilDawn: Date | null;
  sunrise: Date | null;
  solarNoon: Date | null;
  sunset: Date | null;
  civilDusk: Date | null;
  nauticalDusk: Date | null;
  astronomicalDusk: Date | null;
  goldenHourMorning: { start: Date | null; end: Date | null };
  goldenHourEvening: { start: Date | null; end: Date | null };
  blueHourMorning: { start: Date | null; end: Date | null };
  blueHourEvening: { start: Date | null; end: Date | null };
  dayLengthMinutes: number;
  isPolarDay: boolean;
  isPolarNight: boolean;
}

export interface LunarPosition {
  altitudeDeg: number;       // Elevation angle above horizon (-90 to +90)
  azimuthDeg: number;        // Compass bearing (0 to 360)
  phaseName: MoonPhaseName;
  illuminationFraction: number; // 0.0 to 1.0 (e.g. 0.5 for Quarter, 1.0 for Full)
  phaseAngleDeg: number;     // 0 to 180
  ageDays: number;           // 0 to 29.53
  brightLimbAngleDeg: number; // Angle chi of bright limb relative to celestial zenith
  parallaxDeg: number;
  distanceKm: number;
  isAboveHorizon: boolean;
}

export interface CelestialState {
  timestamp: Date;
  localTimeString: string;
  utcTimeString: string;
  dayOfYear: number;
  season: 'spring' | 'summer' | 'autumn' | 'winter';
  twilightState: TwilightState;
  daylightProgress: number; // 0.0 (midnight) to 1.0 (next midnight)
  sun: SolarPosition;
  solarEvents: SolarEvents;
  moon: LunarPosition;
  starVisibilityFraction: number; // 0.0 (daytime/cloudy) to 1.0 (crystal clear night)
  atmosphericScatteringIntensity: number; // 0.0 to 1.0
  solarHourAngleDeg: number;
}
