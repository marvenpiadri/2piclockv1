import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { GeoLocation } from '../models/location.model';
import * as Astronomy from 'astronomy-engine';
import { WorldEventEngineService } from './world-event-engine.service';

export interface WorldEvent {
  id: string;
  category: 'religious' | 'civil' | 'solar' | 'lunar' | 'time';
  title: string;
  time: string | null;
  date: string | null;
  description: string;
  source: string;
  allDay?: boolean;
  tentative?: boolean;
}

@Injectable({ providedIn: 'root' })
export class WorldEventsService {
  private readonly http = inject(HttpClient);
  private readonly engine = inject(WorldEventEngineService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly isLoading = signal(false);
  readonly prayerTimes = signal<Record<string,string>>({});
  readonly shabbatEvents = signal<{ title: string; date: string; category: string }[]>([]);
  readonly holidayEvents = signal<WorldEvent[]>([]);
  readonly religiousEvents = signal<WorldEvent[]>([]);
  readonly seasonalEvents = signal<WorldEvent[]>([]);
  readonly solarWindows = signal<{
    sunrise: string | null; sunset: string | null;
    goldenMorning: string | null; goldenEvening: string | null;
    blueMorning: string | null; blueEvening: string | null;
  }>({ sunrise:null, sunset:null, goldenMorning:null, goldenEvening:null, blueMorning:null, blueEvening:null });

  private lastKey = '';
  private requestGeneration = 0;

  loadForLocation(loc: GeoLocation, date = new Date()): void {
    if (!this.isBrowser) return;

    const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: loc.timezone }).format(date);
    const key = `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)},${loc.timezone},${dateKey}`;
    if (key === this.lastKey) return;

    const generation = ++this.requestGeneration;
    this.lastKey = key;
    this.isLoading.set(true);

    this.loadPrayerTimes(loc, dateKey, generation);
    this.loadCivilHolidays(loc, date, generation);
    this.loadReligiousAndSeasonalEvents(loc, date, generation);
    this.loadIslamicCalendar(date, generation);
    this.loadHebrewEvents(loc, date, generation);

    const context = this.engine.buildContext(loc, date);
    this.solarWindows.set({
      sunrise: context.solar.sunrise ? context.solar.sunrise.toISOString() : null,
      sunset: context.solar.sunset ? context.solar.sunset.toISOString() : null,
      goldenMorning: context.solar.goldenHourMorning.start ? context.solar.goldenHourMorning.start.toISOString() : null,
      goldenEvening: context.solar.goldenHourEvening.start ? context.solar.goldenHourEvening.start.toISOString() : null,
      blueMorning: context.solar.blueHourMorning.start ? context.solar.blueHourMorning.start.toISOString() : null,
      blueEvening: context.solar.blueHourEvening.start ? context.solar.blueHourEvening.start.toISOString() : null
    });

    // API failures are intentionally isolated. Astronomy/clock/weather remain usable.
    this.isLoading.set(false);
  }

  private loadPrayerTimes(loc: GeoLocation, dateKey: string, generation: number): void {
    const params = new HttpParams()
      .set('latitude', loc.latitude)
      .set('longitude', loc.longitude)
      .set('method', '3')
      .set('school', '0')
      .set('date', dateKey)
      .set('iso8601', 'true');

    this.http.get<any>('https://api.aladhan.com/v1/timings', { params }).subscribe({
      next: data => {
        if (generation === this.requestGeneration) this.prayerTimes.set(data?.data?.timings ?? {});
      },
      error: () => {
        if (generation === this.requestGeneration) this.prayerTimes.set({});
      }
    });
  }

  private loadCivilHolidays(loc: GeoLocation, date: Date, generation: number): void {
    const countryCode = (loc.countryCode || '').toUpperCase();
    if (countryCode.length !== 2) {
      this.holidayEvents.set([]);
      return;
    }

    const year = this.localYear(date, loc.timezone);
    this.http.get<any[]>(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`).subscribe({
      next: data => {
        if (generation !== this.requestGeneration) return;
        const events = (Array.isArray(data) ? data : [])
          .filter(item => item?.date && (item.global !== false || (item.types ?? []).includes('Public')))
          .map(item => ({
            id: `civil-${item.date}-${item.name}`,
            category: 'civil' as const,
            title: item.localName || item.name,
            time: null,
            date: item.date,
            description: item.name || item.localName || 'Public holiday',
            source: 'Nager.Date',
            allDay: true
          }));
        this.holidayEvents.set(events);
      },
      error: () => {
        if (generation === this.requestGeneration) this.holidayEvents.set([]);
      }
    });
  }

  private loadReligiousAndSeasonalEvents(loc: GeoLocation, date: Date, generation: number): void {
    const year = this.localYear(date, loc.timezone);
    const seasons = Astronomy.Seasons(year);
    const events: WorldEvent[] = [
      this.instantEvent('season-march-equinox', 'March equinox', new Date(seasons.mar_equinox.date), 'Astronomical beginning of spring in the Northern Hemisphere.', 'Astronomy Engine'),
      this.instantEvent('season-june-solstice', 'June solstice', new Date(seasons.jun_solstice.date), 'Astronomical beginning of summer in the Northern Hemisphere.', 'Astronomy Engine'),
      this.instantEvent('season-september-equinox', 'September equinox', new Date(seasons.sep_equinox.date), 'Astronomical beginning of autumn in the Northern Hemisphere.', 'Astronomy Engine'),
      this.instantEvent('season-december-solstice', 'December solstice / Winter begins', new Date(seasons.dec_solstice.date), 'Astronomical beginning of winter in the Northern Hemisphere.', 'Astronomy Engine')
    ];

    // Christmas is a global calendar observance, while civil/public status is
    // supplied separately by Nager.Date for the selected country.
    const christmas = new Date(Date.UTC(year, 11, 25));
    events.push({
      id: 'christmas-' + year,
      category: 'religious',
      title: 'Christmas Day',
      time: null,
      date: christmas.toISOString().slice(0, 10),
      description: 'Christian Christmas observance.',
      source: '2piClock calendar',
      allDay: true
    });

    const easter = this.calculateWesternEaster(year);
    events.push({
      id: 'easter-' + year,
      category: 'religious',
      title: 'Easter Sunday',
      time: null,
      date: easter.toISOString().slice(0, 10),
      description: 'Western Christian Easter observance.',
      source: '2piClock calendar',
      allDay: true
    });

    if (generation === this.requestGeneration) {
      this.seasonalEvents.set(events.filter(e => e.category === 'solar'));
      this.religiousEvents.set(events.filter(e => e.category === 'religious'));
    }
  }

  private instantEvent(id: string, title: string, instant: Date, description: string, source: string): WorldEvent {
    return {
      id,
      category: 'solar',
      title,
      time: instant.toISOString(),
      date: instant.toISOString().slice(0, 10),
      description,
      source,
      allDay: false
    };
  }

  private calculateWesternEaster(year: number): Date {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
  }

  private loadIslamicCalendar(date: Date, generation: number): void {
    this.http.get<any>('https://api.aladhan.com/v1/currentIslamicYear').subscribe({
      next: yearResponse => {
        const hijriYear = Number(yearResponse?.data);
        if (!hijriYear) return;

        this.http.get<any>(`https://api.aladhan.com/v1/hToGCalendar/9/${hijriYear}?calendarMethod=HJCoSA`).subscribe({
          next: calendar => {
            if (generation !== this.requestGeneration) return;
            const rows = Array.isArray(calendar?.data) ? calendar.data : [];
            const events: WorldEvent[] = [];
            const add = (row: any, title: string, description: string, tentative = true) => {
              if (!row?.gregorian?.date) return;
              const iso = this.parseDmy(row.gregorian.date);
              events.push({
                id: `islamic-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${iso}`,
                category: 'religious',
                title,
                time: null,
                date: iso,
                description,
                source: 'AlAdhan',
                allDay: true,
                tentative
              });
            };

            const first = rows.find((row: any) => Number(row?.hijri?.day) === 1);
            add(first, 'Ramadan begins', 'First day of Ramadan by the selected Hijri calculation method.', true);

            this.loadIslamicMonth(hijriYear, 10, 'Eid al-Fitr', 'Start of Shawwal and Eid al-Fitr.', generation, events);
          },
          error: () => {
            if (generation === this.requestGeneration) this.religiousEvents.set([]);
          }
        });
      },
      error: () => {
        if (generation === this.requestGeneration) this.islamicEvents.set([]);
      }
    });

    // The launch product explicitly calls out Ramadan/Eid timing; prayer data is
    // loaded separately so Fajr/Maghrib remain useful during Ramadan.
    void date;
  }

  private loadIslamicMonth(
    hijriYear: number,
    month: number,
    title: string,
    description: string,
    generation: number,
    seed: WorldEvent[]
  ): void {
    this.http.get<any>(`https://api.aladhan.com/v1/hToGCalendar/${month}/${hijriYear}?calendarMethod=HJCoSA`).subscribe({
      next: calendar => {
        if (generation !== this.requestGeneration) return;
        const rows = Array.isArray(calendar?.data) ? calendar.data : [];
        const first = rows.find((row: any) => Number(row?.hijri?.day) === 1);
        if (first?.gregorian?.date) {
          seed.push({
            id: `islamic-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${this.parseDmy(first.gregorian.date)}`,
            category: 'religious',
            title,
            time: null,
            date: this.parseDmy(first.gregorian.date),
            description,
            source: 'AlAdhan',
            allDay: true,
            tentative: true
          });
        }
        this.religiousEvents.update(existing => [...existing, ...seed].sort((a,b) => (a.date ?? '').localeCompare(b.date ?? '')));
      },
      error: () => {
        if (generation === this.requestGeneration) this.religiousEvents.update(existing => [...existing, ...seed]);
      }
    });
  }

  private loadHebrewEvents(loc: GeoLocation, date: Date, generation: number): void {
    const year = this.localYear(date, loc.timezone);
    const hebcal = new HttpParams()
      .set('cfg', 'json')
      .set('geo', 'pos')
      .set('latitude', loc.latitude)
      .set('longitude', loc.longitude)
      .set('tzid', loc.timezone)
      .set('M', 'on')
      .set('m', '50');

    this.http.get<any>('https://www.hebcal.com/shabbat', { params: hebcal }).subscribe({
      next: data => {
        if (generation !== this.requestGeneration) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        this.shabbatEvents.set(items
          .filter((item:any) => item.category === 'candles' || item.category === 'havdalah')
          .map((item:any) => ({ title: item.title, date: item.date, category: item.category })));

        const jewish = items
          .filter((item:any) => item.category === 'holiday')
          .map((item:any) => ({
            id: `jewish-${item.eventId || item.title}-${item.date}`,
            category: 'religious' as const,
            title: item.title,
            time: item.date ? this.formatTime(item.date, loc.timezone) : null,
            date: item.date ? String(item.date).slice(0,10) : null,
            description: 'Jewish calendar event from Hebcal.',
            source: 'Hebcal',
            allDay: !item.date?.includes('T')
          }));
        if (jewish.length) {
          this.religiousEvents.update(existing => [...existing, ...jewish]);
        }
      },
      error: () => {
        if (generation === this.requestGeneration) this.shabbatEvents.set([]);
      }
    });
    void year;
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
    const localParts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
    const minutesNow = Number(localParts.find(p => p.type === 'hour')?.value ?? 0) * 60 + Number(localParts.find(p => p.type === 'minute')?.value ?? 0);
    for (const p of entries) {
      const [h,m] = p.time.split(':').map(Number);
      if (h * 60 + m >= minutesNow) return { name:p.name, time:p.time };
    }
    return entries[0] ? { name: 'Fajr', time: entries[0].time! } : null;
  }

  private localYear(date: Date, timezone: string): number {
    return Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric' }).format(date));
  }

  private parseDmy(value: string): string {
    const [day, month, year] = value.split('-').map(Number);
    return `${year.toString().padStart(4,'0')}-${month.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
  }
}
