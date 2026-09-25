import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';
import { TimeCalculationService, TimezoneConversionResult, TimeDifferenceResult, DurationResult, DateDifferenceResult, AddSubtractResult, CountdownState, UnixConversionResult, WorldComparisonRow } from '../../core/services/time-calculation.service';
import { GeoLocation } from '../../core/models/location.model';

export type TimeToolTab = 'converter' | 'difference' | 'duration' | 'date-difference' | 'add-subtract' | 'countdown' | 'unix' | 'world-comparison';

@Component({
  selector: 'app-time-suite',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './time-suite.html',
  styleUrl: './time-suite.css'
})
export class TimeSuiteComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private locationService = inject(LocationService);
  private timeCalc = inject(TimeCalculationService);
  private title = inject(Title);
  private meta = inject(Meta);

  readonly allPresets = this.locationService.allPresets;
  readonly activeTab = signal<TimeToolTab>('converter');
  readonly copyNotification = signal<string | null>(null);

  // Live timer tick for countdowns / current clocks
  readonly liveTick = signal<number>(Date.now());
  private timerId: ReturnType<typeof setInterval> | null = null;

  // --- 1. TIME ZONE CONVERTER STATE ---
  readonly converterSourceLoc = signal<GeoLocation>(this.allPresets[0]);
  readonly converterDate = signal<string>(new Date().toISOString().slice(0, 10));
  readonly converterTime = signal<string>('14:30');
  readonly converterTargets = signal<GeoLocation[]>([
    this.allPresets.find(p => p.id === 'london') || this.allPresets[2],
    this.allPresets.find(p => p.id === 'new-york') || this.allPresets[1],
    this.allPresets.find(p => p.id === 'tokyo') || this.allPresets[3],
    this.allPresets.find(p => p.id === 'dubai') || this.allPresets[7] || this.allPresets[0],
    this.allPresets.find(p => p.id === 'sydney') || this.allPresets[5] || this.allPresets[0]
  ]);

  readonly conversionResults = computed<{ sourceInstant: Date; conversions: TimezoneConversionResult[] }>(() => {
    const src = this.converterSourceLoc();
    const [y, m, d] = this.converterDate().split('-').map(Number);
    const [h, min] = this.converterTime().split(':').map(Number);
    return this.timeCalc.convertTimezones(src, y || 2026, m || 1, d || 1, h || 0, min || 0, 0, this.converterTargets());
  });

  // --- 2. TIME DIFFERENCE CALCULATOR STATE ---
  readonly diffLocA = signal<GeoLocation>(this.allPresets[0]);
  readonly diffLocB = signal<GeoLocation>(this.allPresets.find(p => p.id === 'tokyo') || this.allPresets[3]);
  readonly diffDate = signal<string>(new Date().toISOString().slice(0, 10));

  readonly timeDifferenceResult = computed<TimeDifferenceResult>(() => {
    const [y, m, d] = this.diffDate().split('-').map(Number);
    const date = new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1, 12, 0, 0));
    return this.timeCalc.calculateTimeDifference(this.diffLocA(), this.diffLocB(), date);
  });

  // --- 3. TIME DURATION CALCULATOR STATE ---
  readonly durationStartDateTime = signal<string>(new Date(Date.now() - 3600000 * 5.5).toISOString().slice(0, 16));
  readonly durationEndDateTime = signal<string>(new Date(Date.now() + 3600000 * 18.25).toISOString().slice(0, 16));

  readonly durationResult = computed<DurationResult>(() => {
    const s = new Date(this.durationStartDateTime());
    const e = new Date(this.durationEndDateTime());
    return this.timeCalc.calculateDuration(s, e);
  });

  // --- 4. DATE DIFFERENCE CALCULATOR STATE ---
  readonly dateDiffStart = signal<string>('2026-01-01');
  readonly dateDiffEnd = signal<string>(new Date().toISOString().slice(0, 10));
  readonly dateDiffIncludeEnd = signal<boolean>(false);

  readonly dateDifferenceResult = computed<DateDifferenceResult>(() => {
    const s = new Date(this.dateDiffStart());
    const e = new Date(this.dateDiffEnd());
    return this.timeCalc.calculateDateDifference(s, e, this.dateDiffIncludeEnd());
  });

  // --- 5. ADD / SUBTRACT TIME STATE ---
  readonly addSubBaseDate = signal<string>(new Date().toISOString().slice(0, 16));
  readonly addSubOp = signal<'add' | 'subtract'>('add');
  readonly addSubYears = signal<number>(0);
  readonly addSubMonths = signal<number>(1);
  readonly addSubDays = signal<number>(14);
  readonly addSubHours = signal<number>(8);
  readonly addSubMinutes = signal<number>(30);
  readonly addSubSeconds = signal<number>(0);

  readonly addSubResult = computed<AddSubtractResult>(() => {
    const base = new Date(this.addSubBaseDate());
    return this.timeCalc.addSubtractTime(base, this.addSubOp(), {
      years: this.addSubYears(),
      months: this.addSubMonths(),
      days: this.addSubDays(),
      hours: this.addSubHours(),
      minutes: this.addSubMinutes(),
      seconds: this.addSubSeconds()
    });
  });

  // --- 6. COUNTDOWN / COUNT-UP STATE ---
  readonly countdownTargetDate = signal<string>(new Date(Date.now() + 86400000 * 12 + 3600000 * 7).toISOString().slice(0, 16));
  readonly countdownTitle = signal<string>('Mars Rover Launch Window');
  readonly countdownStartDate = signal<Date>(new Date(Date.now() - 86400000 * 3));

  readonly countdownResult = computed<CountdownState>(() => {
    this.liveTick(); // Subscribe to 1s tick
    const target = new Date(this.countdownTargetDate());
    return this.timeCalc.calculateCountdown(target, new Date(), this.countdownStartDate());
  });

  // Count-up
  readonly countUpStartDate = signal<string>(new Date(Date.now() - (86400000 * 142 + 3600000 * 16)).toISOString().slice(0, 16));
  readonly countUpTitle = signal<string>('Mission Elapsed Time (MET)');

  readonly countUpResult = computed<DurationResult>(() => {
    this.liveTick();
    const start = new Date(this.countUpStartDate());
    return this.timeCalc.calculateDuration(start, new Date());
  });

  // --- 7. UNIX TIMESTAMP STATE ---
  readonly unixInput = signal<string>(Math.floor(Date.now() / 1000).toString());
  readonly unixMode = signal<'seconds' | 'milliseconds' | 'iso'>('seconds');

  readonly unixResult = computed<UnixConversionResult>(() => {
    return this.timeCalc.convertUnixTimestamp(this.unixInput(), this.unixMode());
  });

  // --- 8. WORLD TIME MATRIX STATE ---
  readonly matrixReferenceCity = signal<GeoLocation>(this.allPresets[0]);
  readonly matrixCities = signal<GeoLocation[]>([...this.allPresets.slice(0, 12)]);

  readonly worldMatrixRows = computed<WorldComparisonRow[]>(() => {
    this.liveTick();
    return this.timeCalc.calculateWorldComparisonMatrix(
      this.matrixCities(),
      this.matrixReferenceCity(),
      new Date()
    );
  });

  ngOnInit(): void {
    // The URL path is the canonical product identity. Query params remain useful
    // for calculation state, but each calculator has its own crawlable /time/:slug path.
    this.route.data.subscribe(data => {
      const tool = data['tool'] as string | undefined;
      if (tool && this.isValidTab(tool)) {
        this.activeTab.set(tool as TimeToolTab);
        this.updateSeo(tool as TimeToolTab);
      }
    });

    // Parse query params for calculation state / older shared links.
    this.route.queryParams.subscribe(params => {
      if (params['tab'] && this.isValidTab(params['tab'])) {
        this.activeTab.set(params['tab'] as TimeToolTab);
      }
      if (params['from']) {
        const found = this.allPresets.find(p => p.id === params['from'] || p.name.toLowerCase() === params['from'].toLowerCase());
        if (found) this.converterSourceLoc.set(found);
      }
      if (params['time']) {
        this.converterTime.set(params['time']);
      }
      if (params['date']) {
        this.converterDate.set(params['date']);
      }
    });

    // Start 1-second live ticker
    this.timerId = setInterval(() => {
      this.liveTick.set(Date.now());
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  setTab(tab: TimeToolTab): void {
    this.activeTab.set(tab);
    this.updateSeo(tab);
    const queryParams = { ...this.route.snapshot.queryParams };
    delete queryParams['tab'];
    this.router.navigate(['/time', this.toolSlug(tab)], {
      queryParams
    });
  }

  private toolSlug(tab: TimeToolTab): string {
    return {
      converter: 'converter',
      difference: 'difference',
      duration: 'duration',
      'date-difference': 'date-difference',
      'add-subtract': 'add-subtract',
      countdown: 'countdown',
      unix: 'unix-timestamp',
      'world-comparison': 'world-matrix'
    }[tab];
  }

  private updateSeo(tab: TimeToolTab): void {
    const seo: Record<TimeToolTab, { title: string; description: string }> = {
      converter: {
        title: 'Time Zone Converter | 2piClock',
        description: 'Convert a date and time between cities and IANA time zones with precise local results.'
      },
      difference: {
        title: 'Time Difference Calculator | 2piClock',
        description: 'Calculate the exact time difference between two cities and time zones.'
      },
      duration: {
        title: 'Time Duration Calculator | 2piClock',
        description: 'Calculate the exact duration between two dates and times in days, hours, minutes and seconds.'
      },
      'date-difference': {
        title: 'Date Difference Calculator | 2piClock',
        description: 'Calculate calendar days, weeks, business days and weekends between two dates.'
      },
      'add-subtract': {
        title: 'Add or Subtract Time | 2piClock',
        description: 'Add or subtract years, months, days, hours, minutes and seconds from a date and time.'
      },
      countdown: {
        title: 'Countdown & Count-Up Calculator | 2piClock',
        description: 'Create a live countdown to an event or measure elapsed time from a starting instant.'
      },
      unix: {
        title: 'Unix Timestamp Converter | 2piClock',
        description: 'Convert Unix timestamps between seconds, milliseconds, ISO and local date-time formats.'
      },
      'world-comparison': {
        title: 'World Time Matrix | 2piClock',
        description: 'Compare local times, UTC offsets and day status across cities around the world.'
      }
    };
    this.title.setTitle(seo[tab].title);
    this.meta.updateTag({ name: 'description', content: seo[tab].description });
    this.meta.updateTag({ property: 'og:title', content: seo[tab].title });
    this.meta.updateTag({ property: 'og:description', content: seo[tab].description });
  }

  private isValidTab(tab: string): boolean {
    return ['converter', 'difference', 'duration', 'date-difference', 'add-subtract', 'countdown', 'unix', 'world-comparison'].includes(tab);
  }

  // --- Converter Helpers ---
  setConverterSource(loc: GeoLocation): void {
    this.converterSourceLoc.set(loc);
  }

  setConverterSourceById(id: string): void {
    const loc = this.allPresets.find(p => p.id === id);
    if (loc) this.converterSourceLoc.set(loc);
  }

  setDiffLocAById(id: string): void {
    const loc = this.allPresets.find(p => p.id === id);
    if (loc) this.diffLocA.set(loc);
  }

  setDiffLocBById(id: string): void {
    const loc = this.allPresets.find(p => p.id === id);
    if (loc) this.diffLocB.set(loc);
  }

  setMatrixReferenceCityById(id: string): void {
    const loc = this.allPresets.find(p => p.id === id);
    if (loc) this.matrixReferenceCity.set(loc);
  }

  addTargetCity(loc: GeoLocation): void {
    if (!this.converterTargets().some(c => c.id === loc.id)) {
      this.converterTargets.update(list => [...list, loc]);
    }
  }

  removeTargetCity(id: string): void {
    this.converterTargets.update(list => list.filter(c => c.id !== id));
  }

  swapDifferenceCities(): void {
    const a = this.diffLocA();
    const b = this.diffLocB();
    this.diffLocA.set(b);
    this.diffLocB.set(a);
  }

  setUnixToNow(): void {
    if (this.unixMode() === 'seconds') {
      this.unixInput.set(Math.floor(Date.now() / 1000).toString());
    } else if (this.unixMode() === 'milliseconds') {
      this.unixInput.set(Date.now().toString());
    } else {
      this.unixInput.set(new Date().toISOString());
    }
  }

  copyShareLink(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.copyNotification.set('Shareable calculation link copied to clipboard!');
      setTimeout(() => this.copyNotification.set(null), 3500);
    });
  }
}
