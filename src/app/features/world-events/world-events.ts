import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';
import { TimeControlService } from '../../core/services/time-control.service';
import { WorldEvent, WorldEventsService } from '../../core/services/world-events.service';

type EventFilter = 'all' | 'civil' | 'religious' | 'seasonal';

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

  readonly allEvents = computed<WorldEvent[]>(() => {
    const civil = this.eventsService.holidayEvents();
    const religious = this.eventsService.religiousEvents();
    const seasonal = this.eventsService.seasonalEvents();
    const unique = new Map<string, WorldEvent>();
    [...civil, ...religious, ...seasonal].forEach(event => unique.set(event.id, event));
    return [...unique.values()].sort((a, b) => this.eventTime(a) - this.eventTime(b));
  });

  readonly upcomingEvents = computed(() => {
    const now = this.activeDate().getTime();
    return this.allEvents().filter(event => this.eventTime(event) >= now - 86400000).slice(0, 18);
  });

  readonly visibleEvents = computed(() => {
    const selected = this.filter();
    return this.upcomingEvents().filter(event =>
      selected === 'all' ? true : selected === 'seasonal' ? event.category === 'solar' : event.category === selected
    );
  });

  constructor() {
    effect(() => this.eventsService.loadForLocation(this.selectedLocation(), this.activeDate()));
  }

  setFilter(filter: EventFilter): void { this.filter.set(filter); }

  eventIcon(event: WorldEvent): string {
    if (event.category === 'civil') return 'flag';
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
