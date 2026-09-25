import { Injectable } from '@angular/core';
import { GeoLocation } from '../models/location.model';
import { calculateLunarPosition, calculateSolarEvents, calculateSolarPosition } from '../astronomy/astronomy-engine';

export type WorldEventCategory = 'civil' | 'solar' | 'lunar' | 'religious' | 'weather' | 'astronomy';

export interface WorldEventItem {
  id: string;
  category: WorldEventCategory;
  title: string;
  instant: Date | null;
  localTime: string | null;
  description: string;
  available: boolean;
}

export interface WorldEventContext {
  location: GeoLocation;
  date: Date;
  localTime: string;
  utcOffset: string;
  dayOfWeek: string;
  isDST: boolean;
  solar: {
    sunrise: Date | null;
    sunset: Date | null;
    solarNoon: Date | null;
    civilDawn: Date | null;
    civilDusk: Date | null;
    nauticalDawn: Date | null;
    nauticalDusk: Date | null;
    astronomicalDawn: Date | null;
    astronomicalDusk: Date | null;
    goldenHourMorning: { start: Date | null; end: Date | null };
    goldenHourEvening: { start: Date | null; end: Date | null };
    blueHourMorning: { start: Date | null; end: Date | null };
    blueHourEvening: { start: Date | null; end: Date | null };
    dayLengthMinutes: number;
    isPolarDay: boolean;
    isPolarNight: boolean;
  };
  lunar: {
    phaseName: string;
    illuminationPercent: number;
    ageDays: number;
    distanceKm: number;
    altitudeDeg: number;
    azimuthDeg: number;
  };
  events: WorldEventItem[];
}

@Injectable({ providedIn: 'root' })
export class WorldEventEngineService {
  buildContext(location: GeoLocation, date: Date): WorldEventContext {
    const solarPosition = calculateSolarPosition(date, location.latitude, location.longitude);
    const solar = calculateSolarEvents(date, location.latitude, location.longitude, location.timezone);
    const lunar = calculateLunarPosition(date, location.latitude, location.longitude, solarPosition);

    const events = [
      this.event('sunrise', 'solar', 'Sunrise', solar.sunrise, 'Sun crosses the local horizon.', location.timezone),
      this.event('solar-noon', 'solar', 'Solar noon', solar.solarNoon, 'The Sun reaches its highest altitude for the day.', location.timezone),
      this.event('sunset', 'solar', 'Sunset', solar.sunset, 'Sunset at the local horizon.', location.timezone),
      this.event('golden-morning', 'solar', 'Morning golden hour', solar.goldenHourMorning.start, 'Warm low-angle sunlight after sunrise.', location.timezone),
      this.event('golden-evening', 'solar', 'Evening golden hour', solar.goldenHourEvening.start, 'Warm low-angle sunlight before sunset.', location.timezone),
      this.event('blue-morning', 'solar', 'Morning blue hour', solar.blueHourMorning.start, 'Deep blue twilight before civil dawn.', location.timezone),
      this.event('blue-evening', 'solar', 'Evening blue hour', solar.blueHourEvening.start, 'Deep blue twilight after civil dusk.', location.timezone),
      this.event('moon-position', 'lunar', lunar.phaseName, date, Math.round(lunar.illuminationFraction * 100) + '% illuminated · ' + Math.round(lunar.distanceKm) + ' km away.', location.timezone)
    ];

    return {
      location,
      date,
      localTime: this.localTime(date, location.timezone, true),
      utcOffset: this.utcOffset(date, location.timezone),
      dayOfWeek: new Intl.DateTimeFormat('en-US', { timeZone: location.timezone, weekday: 'long' }).format(date),
      isDST: this.isDST(date, location.timezone),
      solar,
      lunar: {
        phaseName: lunar.phaseName,
        illuminationPercent: Math.round(lunar.illuminationFraction * 100),
        ageDays: Math.round(lunar.ageDays * 10) / 10,
        distanceKm: Math.round(lunar.distanceKm),
        altitudeDeg: Math.round(lunar.altitudeDeg * 10) / 10,
        azimuthDeg: Math.round(lunar.azimuthDeg * 10) / 10
      },
      events
    };
  }

  private event(id: string, category: WorldEventCategory, title: string, instant: Date | null, description: string, timezone: string): WorldEventItem {
    return {
      id,
      category,
      title,
      instant,
      localTime: instant ? this.localTime(instant, timezone, false) : null,
      description,
      available: !!instant
    };
  }


  private localTime(date: Date, timezone: string, seconds: boolean): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      ...(seconds ? { second: '2-digit' } : {}),
      hourCycle: 'h23'
    }).format(date);
  }

  private utcOffset(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'shortOffset' })
      .formatToParts(date).find(part => part.type === 'timeZoneName')?.value ?? 'UTC';
  }

  private isDST(date: Date, timezone: string): boolean {
    const january = new Date(Date.UTC(date.getUTCFullYear(), 0, 15));
    const july = new Date(Date.UTC(date.getUTCFullYear(), 6, 15));
    const current = this.offsetMinutes(date, timezone);
    const winter = this.offsetMinutes(january, timezone);
    const summer = this.offsetMinutes(july, timezone);
    return current !== Math.min(winter, summer);
  }

  private offsetMinutes(date: Date, timezone: string): number {
    const value = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' })
      .formatToParts(date).find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
    const match = value.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    if (!match) return 0;
    const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
    return match[1] === '-' ? -minutes : minutes;
  }
}
