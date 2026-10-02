import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';
import { TimeControlService } from '../../core/services/time-control.service';
import { WorldEvent, WorldEventsService } from '../../core/services/world-events.service';

type EventFilter = 'all' | 'civil' | 'religious' | 'seasonal' | 'sky' | 'prayer';

@Component({
  selector: 'app-world-events',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './world-events.html',
  styleUrl: './world-events.css'
})
export class WorldEventsComponent {
  private readonly locationService = inject(LocationService);
  private readonly timeControl = inject(TimeControlService);
  readonly eventsService = inject(WorldEventsService);
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly activeDate = this.timeControl.currentActiveDate;
  readonly filter = signal<EventFilter>('all');

  readonly observatoryEvents = computed<WorldEvent[]>(() => {
    const windows = this.eventsService.solarWindows();
    const items: WorldEvent[] = [];
    const add = (id: string, title: string, value: string | null, description: string) => {
      if (!value) return;
      const instant = new Date(value);
      if (!Number.isFinite(instant.getTime())) return;
      items.push({
        id,
        category: 'solar',
        title,
        time: instant.toISOString(),
        date: instant.toISOString().slice(0, 10),
        description,
        source: 'Astronomy Engine'
      });
    };
    add('sky-blue-morning', 'Blue hour begins', windows.blueMorning, 'Deep pre-sunrise twilight: the sky is brightening before the Sun reaches the horizon.');
    add('sky-golden-morning', 'Golden hour begins', windows.goldenMorning, 'Low solar altitude produces the warmest directional light of the day.');
    add('sky-sunrise', 'Sunrise', windows.sunrise, 'The Sun crosses the local horizon.');
    add('sky-golden-evening', 'Golden hour begins', windows.goldenEvening, 'Evening low-angle sunlight creates the second golden-light window.');
    add('sky-sunset', 'Sunset', windows.sunset, 'The Sun crosses below the local horizon.');
    add('sky-blue-evening', 'Blue hour begins', windows.blueEvening, 'Post-sunset twilight: the sky remains illuminated after the Sun has set.');
    return items;
  });

  readonly prayerEvents = computed<WorldEvent[]>(() => {
    const prayer = this.eventsService.prayerTimes();
    const names: Record<string, string> = {
      Fajr: 'Fajr', Sunrise: 'Sunrise', Dhuhr: 'Dhuhr', Asr: 'Asr', Maghrib: 'Maghrib', Isha: 'Isha'
    };
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: this.selectedLocation().timezone }).format(this.activeDate());
    return Object.entries(names).flatMap(([key, title]) => {
      const value = prayer[key];
      if (!value || !/^\d{1,2}:\d{2}/.test(value)) return [];
      const [hour, minute] = value.split(':').map(Number);
      const instant = this.createZonedInstant(today, hour, minute, this.selectedLocation().timezone);
      return [{
        id: `prayer-${key}-${today}`,
        category: 'time' as const,
        title,
        time: instant.toISOString(),
        date: today,
        description: `${title} local time for ${this.selectedLocation().name}.`,
        source: 'AlAdhan',
        allDay: false
      }];
    });
  });

  readonly allEvents = computed<WorldEvent[]>(() => {
    const civil = this.eventsService.holidayEvents();
    const religious = this.eventsService.religiousEvents();
    const seasonal = this.eventsService.seasonalEvents();
    const unique = new Map<string, WorldEvent>();
    [...civil, ...religious, ...seasonal, ...this.observatoryEvents(), ...this.prayerEvents()].forEach(event => unique.set(event.id, event));
    return [...unique.values()].sort((a, b) => this.eventTime(a) - this.eventTime(b));
  });

  readonly upcomingEvents = computed(() => {
    const now = this.activeDate().getTime();
    return this.allEvents().filter(event => this.eventTime(event) >= now - 86400000).slice(0, 18);
  });

  readonly nextEvent = computed<WorldEvent | null>(() => {
    const now = this.activeDate().getTime();
    return this.allEvents().find(event => this.eventTime(event) >= now) ?? null;
  });

  readonly visibleEvents = computed(() => {
    const selected = this.filter();
    return this.upcomingEvents().filter(event => {
      if (selected === 'all') return true;
      if (selected === 'seasonal') return event.category === 'solar' && event.id.startsWith('season-');
      if (selected === 'sky') return event.category === 'solar' && (event.id.startsWith('sky-'));
      if (selected === 'prayer') return event.category === 'time';
      return event.category === selected;
    });
  });

  constructor() {
    effect(() => this.eventsService.loadForLocation(this.selectedLocation(), this.activeDate()));
  }

  setFilter(filter: EventFilter): void { this.filter.set(filter); }

  private createZonedInstant(date: string, hour: number, minute: number, timeZone: string): Date {
    const parts = date.split('-').map(Number);
    let guess = Date.UTC(parts[0], parts[1] - 1, parts[2], hour, minute);
    for (let i = 0; i < 3; i++) {
      const local = new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).formatToParts(new Date(guess));
      const value = (type: string) => Number(local.find(part => part.type === type)?.value ?? 0);
      const actual = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'));
      const target = Date.UTC(parts[0], parts[1] - 1, parts[2], hour, minute);
      guess -= actual - target;
    }
    return new Date(guess);
  }

  eventIcon(event: WorldEvent): string {
    if (event.category === 'civil') return 'flag';
    if (event.category === 'time') return event.title === 'Fajr' || event.title === 'Isha' ? 'nights_stay' : 'schedule';
    if (event.id.startsWith('sky-')) return event.title.toLowerCase().includes('sun') ? 'wb_sunny' : 'brightness_6';
    if (event.category === 'solar') return 'wb_sunny';
    const title = event.title.toLowerCase();
    if (title.includes('ramadan')) return 'nights_stay';
    if (title.includes('christmas')) return 'celebration';
    if (title.includes('easter')) return 'egg_alt';
    if (title.includes('eid')) return 'nights_stay';
    return 'event';
  }

  eventTime(event: WorldEvent): number {
    if (!event.date) return Number.POSITIVE_INFINITY;
    const value = event.time && event.time.includes('T') ? event.time : event.date + 'T00:00:00';
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
  }

  formatEventDate(event: WorldEvent): string {
    if (!event.date) return 'Date unavailable';
    const parsed = new Date(event.date.includes('T') ? event.date : event.date + 'T12:00:00');
    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.selectedLocation().timezone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    }).format(parsed);
  }

  formatEventTime(event: WorldEvent): string {
    if (event.allDay || !event.time || !event.time.includes('T')) return 'All day';
    const parsed = new Date(event.time);
    if (Number.isNaN(parsed.getTime())) return '—';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.selectedLocation().timezone, hour: '2-digit', minute: '2-digit', hour12: false
    }).format(parsed);
  }

  daysAway(event: WorldEvent): number {
    const target = event.date?.slice(0, 10);
    if (!target) return 0;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: this.selectedLocation().timezone }).format(this.activeDate());
    return Math.round((new Date(target + 'T00:00:00Z').getTime() - new Date(today + 'T00:00:00Z').getTime()) / 86400000);
  }
}
