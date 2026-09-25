import { Injectable, computed, inject } from '@angular/core';
import { CelestialService } from './celestial.service';
import { LocationService } from './location.service';
import { WeatherService } from './weather.service';
import { WorldState } from '../models/world-state.model';

@Injectable({ providedIn: 'root' })
export class WorldStateService {
  private readonly locationService = inject(LocationService);
  private readonly celestialService = inject(CelestialService);
  private readonly weatherService = inject(WeatherService);

  readonly state = computed<WorldState>(() => {
    const loc = this.locationService.selectedLocation();
    const instant = this.celestialService.activeDate();
    const celestial = this.celestialService.celestialState();
    const weather = this.weatherService.currentWeather();

    return {
      instant,
      location: loc,
      timezone: loc.timezone,
      localTime: celestial.localTimeString,
      localDate: this.formatLocalDate(instant, loc.timezone),
      utcTime: celestial.utcTimeString,
      utcOffsetMinutes: this.getUtcOffsetMinutes(instant, loc.timezone),
      celestial,
      weather,
      sunPhase: celestial.twilightState,
      isDaylight: celestial.sun.altitudeDeg > 0,
      isAstronomicalNight: celestial.sun.altitudeDeg <= -18,
      timeOfDayFraction: this.getLocalDayFraction(instant, loc.timezone),
      solarIntensity: Math.max(0, Math.min(1, (celestial.sun.altitudeDeg + 6) / 60)),
      lunarIllumination: celestial.moon.illuminationFraction,
      skyVisibility: Math.max(
        0,
        Math.min(
          1,
          celestial.starVisibilityFraction *
            (1 - weather.cloudCoverPct / 100) *
            Math.min(1, weather.visibilityKm / 20)
        )
      )
    };
  });

  readonly selectedLocation = computed(() => this.state().location);
  readonly weather = computed(() => this.state().weather);
  readonly celestial = computed(() => this.state().celestial);

  private formatLocalDate(date: Date, timezone: string): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  }

  private getLocalDayFraction(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
      hourCycle: 'h23'
    }).formatToParts(date);

    const value = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
    return (value('hour') * 3600000 + value('minute') * 60000 + value('second') * 1000 + value('fractionalSecond')) / 86400000;
  }

  private getUtcOffsetMinutes(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
      hour: '2-digit'
    }).formatToParts(date);
    const offset = parts.find(p => p.type === 'timeZoneName')?.value ?? 'GMT';
    const match = offset.match(/GMT([+-])(\d{2}):?(\d{2})?/);
    if (!match) return 0;
    const sign = match[1] === '+' ? 1 : -1;
    return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
  }
}
