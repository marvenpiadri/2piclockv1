import { ChangeDetectionStrategy, Component, computed, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';
import {
  AstronomicalCalculatorService,
  DaylightAnalysis,
  SolarCalculatorResult,
  MoonCalculatorResult,
  AstronomicalEventItem
} from '../../core/services/astronomical-calculator.service';
import { GeoLocation } from '../../core/models/location.model';
import { MoonPhaseIndicator } from '../../shared/components/moon-phase-indicator/moon-phase-indicator';
import { Title, Meta } from '@angular/platform-browser';

export type AstronomyTab = 'overview' | 'solar' | 'daylight' | 'moon' | 'events';

@Component({
  selector: 'app-astronomy-suite',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MoonPhaseIndicator
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './astronomy-suite.html',
  styleUrl: './astronomy-suite.css'
})
export class AstronomySuiteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private locationService = inject(LocationService);
  private astroCalc = inject(AstronomicalCalculatorService);
  private title = inject(Title);
  private meta = inject(Meta);

  readonly allPresets = this.locationService.allPresets;
  readonly activeTab = signal<AstronomyTab>('overview');
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly selectedDate = signal<string>(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: this.locationService.selectedLocation().timezone
    }).format(new Date())
  );
  readonly selectedTime = signal<string>('12:00');
  readonly selectedYear = signal<number>(new Date().getFullYear());
  readonly copyNotification = signal<string | null>(null);
  readonly selectedHour = computed(() => {
    const hour = parseInt(this.selectedTime().slice(0, 2), 10);
    return Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 12;
  });

  // "When Is?" query selector
  readonly whenIsQuery = signal<'next-full-moon' | 'next-new-moon' | 'spring-equinox' | 'summer-solstice' | 'autumn-equinox' | 'winter-solstice' | 'solar-noon'>('next-full-moon');

  /**
   * Interpret the form's date/time as wall-clock time in the selected location.
   * The astronomy engine works with real UTC instants, so this conversion must
   * happen before any solar/lunar calculation. In particular, 00:00 must stay
   * midnight rather than being treated as a falsy value and becoming 12:00.
   */
  readonly parsedInstant = computed<Date>(() => {
    const [y, m, d] = this.selectedDate().split('-').map(Number);
    const [h, min] = this.selectedTime().split(':').map(Number);
    const year = Number.isFinite(y) ? y : new Date().getFullYear();
    const month = Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1;
    const day = Number.isFinite(d) && d >= 1 && d <= 31 ? d : 1;
    const hour = Number.isFinite(h) && h >= 0 && h <= 23 ? h : 12;
    const minute = Number.isFinite(min) && min >= 0 && min <= 59 ? min : 0;

    return this.getZonedDateTime(year, month, day, hour, minute, 0, this.selectedLocation().timezone);
  });

  // --- Calculations ---
  readonly solarResult = computed<SolarCalculatorResult>(() => {
    return this.astroCalc.calculateSolar(this.selectedLocation(), this.parsedInstant());
  });

  readonly daylightResult = computed<DaylightAnalysis>(() => {
    return this.astroCalc.calculateDaylight(this.selectedLocation(), this.parsedInstant());
  });

  readonly moonResult = computed<MoonCalculatorResult>(() => {
    return this.astroCalc.calculateMoon(this.selectedLocation(), this.parsedInstant());
  });

  readonly eventsResult = computed<AstronomicalEventItem[]>(() => {
    return this.astroCalc.calculateYearlyEvents(this.selectedYear(), this.selectedLocation());
  });

  readonly whenIsResult = computed(() => {
    return this.astroCalc.solveWhenIs(this.whenIsQuery(), this.selectedLocation(), this.selectedYear());
  });

  constructor() {
    effect(() => {
      const location = this.selectedLocation();
      const tab = this.activeTab();
      const labels: Record<AstronomyTab, string> = {
        overview: 'Astronomy',
        solar: 'Sun Position',
        daylight: 'Daylight & Twilight',
        moon: 'Moon',
        events: 'Astronomical Events'
      };
      const title = `${labels[tab]} in ${location.name} | 2piClock`;
      const description = `Live ${labels[tab].toLowerCase()} for ${location.name}, ${location.country}, including precise solar and lunar calculations.`;
      this.title.setTitle(title);
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ property: 'og:description', content: description });
    });

    // Sync selectedDate with local timezone of the selected location
    effect(() => {
      const timezone = this.selectedLocation().timezone;
      this.selectedDate.set(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone
        }).format(new Date())
      );
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('location');
      if (slug) {
        const found = this.allPresets.find(p => p.id === slug);
        if (found) {
          this.locationService.selectLocation(found);
          this.selectedDate.set(new Intl.DateTimeFormat('en-CA', {
            timeZone: found.timezone
          }).format(new Date()));
        }
      }
    });

    this.route.data.subscribe(data => {
      const tab = data['tab'];
      if (tab && this.isValidTab(tab)) this.activeTab.set(tab as AstronomyTab);
    });

    this.route.queryParams.subscribe(params => {
      if (params['tab'] && this.isValidTab(params['tab'])) {
        this.activeTab.set(params['tab'] as AstronomyTab);
      }
      if (params['loc']) {
        const found = this.allPresets.find(p => p.id === params['loc'] || p.name.toLowerCase() === params['loc'].toLowerCase());
        if (found) this.locationService.selectLocation(found);
      }
      if (params['date']) {
        this.selectedDate.set(params['date']);
      }
      if (params['time']) {
        this.selectedTime.set(params['time']);
      }
    });
  }

  setTab(tab: AstronomyTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  private isValidTab(tab: string): boolean {
    return ['overview', 'solar', 'daylight', 'moon', 'events'].includes(tab);
  }

  setLocation(loc: GeoLocation): void {
    this.locationService.selectLocation(loc);
  }

  setLocationById(id: string): void {
    const loc = this.allPresets.find(p => p.id === id);
    if (loc) {
      this.locationService.selectLocation(loc);
    }
  }

  setWhenIsQuery(query: 'next-full-moon' | 'next-new-moon' | 'spring-equinox' | 'summer-solstice' | 'autumn-equinox' | 'winter-solstice' | 'solar-noon'): void {
    this.whenIsQuery.set(query);
  }

  private getZonedDateTime(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    timeZone: string,
    millisecond = 0
  ): Date {
    const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

    const getOffsetMinutes = (instant: Date): number => {
      const value = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'longOffset'
      }).formatToParts(instant).find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
      const match = value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
      if (!match) return 0;
      const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
      return match[1] === '+' ? minutes : -minutes;
    };

    let instant = new Date(wallClockUtc - getOffsetMinutes(new Date(wallClockUtc)) * 60000);
    const correctedOffset = getOffsetMinutes(instant);
    if (correctedOffset !== getOffsetMinutes(new Date(wallClockUtc))) {
      instant = new Date(wallClockUtc - correctedOffset * 60000);
    }
    return instant;
  }

  formatTime(date: Date | null): string {
    if (!date) return '--:--';
    return date.toLocaleTimeString('en-US', {
      timeZone: this.selectedLocation().timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  horizonLeft(azimuthDeg: number): number {
    return Math.max(4, Math.min(96, (azimuthDeg / 360) * 92 + 4));
  }

  horizonBottom(altitudeDeg: number): number {
    return Math.max(6, Math.min(88, ((altitudeDeg + 5) / 95) * 82 + 6));
  }

  sunAltitudePercent(altitudeDeg: number): number {
    return Math.max(0, Math.min(100, ((altitudeDeg + 90) / 180) * 100));
  }

  trajectoryX(hour: number): number {
    return Math.max(3, Math.min(97, (hour / 23) * 94 + 3));
  }

  trajectoryY(altitude: number): number {
    const normalized = Math.max(-90, Math.min(90, altitude));
    return 50 - (normalized / 90) * 42;
  }

  getCompassHeading(azimuthDeg: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(azimuthDeg / 22.5) % 16;
    return directions[idx] || 'N';
  }

  copyShareLink(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.copyNotification.set('Astronomical calculation link copied!');
      setTimeout(() => this.copyNotification.set(null), 3500);
    });
  }
}
