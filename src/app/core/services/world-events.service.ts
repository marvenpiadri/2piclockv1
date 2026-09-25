import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { GeoLocation } from '../models/location.model';
import { WorldEventEngineService } from './world-event-engine.service';

export interface WorldEvent {
  id: string;
  category: 'religious' | 'solar' | 'time';
  title: string;
  time: string | null;
  description: string;
  source: string;
}

@Injectable({ providedIn: 'root' })
export class WorldEventsService {
  private readonly http = inject(HttpClient);
  private readonly engine = inject(WorldEventEngineService);
  private activeTimezone = 'UTC';

  readonly isLoading = signal(false);
  readonly prayerTimes = signal<Record<string,string>>({});
  readonly shabbatEvents = signal<{ title: string; date: string; category: string }[]>([]);
  readonly solarWindows = signal<{
    sunrise: string | null; sunset: string | null;
    goldenMorning: string | null; goldenEvening: string | null;
    blueMorning: string | null; blueEvening: string | null;
  }>({ sunrise:null, sunset:null, goldenMorning:null, goldenEvening:null, blueMorning:null, blueEvening:null });

  private lastKey = '';

  loadForLocation(loc: GeoLocation, date = new Date()): void {
    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: loc.timezone }).format(date);
    const key = `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)},${loc.timezone},${dateKey}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.isLoading.set(true);

    const params = new HttpParams()
      .set('latitude', loc.latitude)
      .set('longitude', loc.longitude)
      .set('method', '3')
      .set('school', '0')
      .set('date', dateKey)
      .set('iso8601', 'true');

    this.http.get<any>('https://api.aladhan.com/v1/timings', { params }).subscribe({
      next: data => this.prayerTimes.set(data?.data?.timings ?? {}),
      error: () => this.prayerTimes.set({})
    });

    const hebcal = new HttpParams()
      .set('cfg', 'json')
      .set('geo', 'pos')
      .set('latitude', loc.latitude)
      .set('longitude', loc.longitude)
      .set('tzid', loc.timezone)
      .set('M', 'on')
      .set('m', '50');

    this.http.get<any>('https://www.hebcal.com/shabbat', { params: hebcal }).subscribe({
      next: data => this.shabbatEvents.set((data?.items ?? []).filter((item:any) => item.category === 'candles' || item.category === 'havdalah').map((item:any) => ({
        title: item.title,
        date: item.date,
        category: item.category
      }))),
      error: () => this.shabbatEvents.set([])
    });

    const context = this.engine.buildContext(loc, date);
    this.solarWindows.set({
      sunrise: context.solar.sunrise ? context.solar.sunrise.toISOString() : null,
      sunset: context.solar.sunset ? context.solar.sunset.toISOString() : null,
      goldenMorning: context.solar.goldenHourMorning.start ? context.solar.goldenHourMorning.start.toISOString() : null,
      goldenEvening: context.solar.goldenHourEvening.start ? context.solar.goldenHourEvening.start.toISOString() : null,
      blueMorning: context.solar.blueHourMorning.start ? context.solar.blueHourMorning.start.toISOString() : null,
      blueEvening: context.solar.blueHourEvening.start ? context.solar.blueHourEvening.start.toISOString() : null
    });
    this.activeTimezone = loc.timezone;
    this.isLoading.set(false);

  }

  formatTime(value: string | null, timezone?: string): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-GB', { timeZone: timezone, hour:'2-digit', minute:'2-digit' });
  }

  timezoneOffsetMinutes(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset' }).formatToParts(date);
    const value = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
    const m = value.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!m) return 0;
    const minutes = Number(m[2]) * 60 + Number(m[3]);
    return m[1] === '-' ? -minutes : minutes;
  }

  nextPrayer(now = new Date()): { name:string; time:string } | null {
    const entries = ['Fajr','Sunrise','Dhuhr','Asr','Maghrib','Isha']
      .map(name => ({ name, time: this.prayerTimes()[name] }))
      .filter(x => !!x.time);
    const localParts = new Intl.DateTimeFormat('en-US', { timeZone: this.activeTimezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const minutesNow = Number(localParts.find(p => p.type === 'hour')?.value ?? 0) * 60 + Number(localParts.find(p => p.type === 'minute')?.value ?? 0);
    for (const p of entries) {
      const [h,m] = p.time.split(':').map(Number);
      if (h * 60 + m >= minutesNow) return { name:p.name, time:p.time };
    }
    return entries[0] ? { name: 'Fajr', time: entries[0].time! } : null;
  }
}
