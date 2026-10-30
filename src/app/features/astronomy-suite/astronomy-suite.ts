import { ChangeDetectionStrategy, Component, DestroyRef, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import * as Astronomy from 'astronomy-engine';
import { LocationService } from '../../core/services/location.service';
import { AstronomicalCalculatorService } from '../../core/services/astronomical-calculator.service';
import { PrecisionAstronomyService } from '../../core/services/precision-astronomy.service';
import { equatorialJ2000ToHorizontal, zonedDateTimeToInstant } from '../../core/astronomy/astronomy-engine';
import { CONSTELLATIONS, DEEP_SKY, STARS } from '../../core/astronomy/sky-catalogue';
import { MoonPhaseIndicator } from '../../shared/components/moon-phase-indicator/moon-phase-indicator';
import { SkyChartComponent, SkyLine, SkyObject } from './sky-chart';

export const ASTRONOMY_TABS = [
  { id: 'sky', label: 'Sky' },
  { id: 'sun', label: 'Sun' },
  { id: 'moon', label: 'Moon' },
  { id: 'planets', label: 'Planets' },
  { id: 'events', label: 'Events' }
] as const;
export type AstronomyTab = typeof ASTRONOMY_TABS[number]['id'];

type WhenIs = 'next-full-moon' | 'next-new-moon' | 'spring-equinox' | 'summer-solstice' | 'autumn-equinox' | 'winter-solstice' | 'solar-noon';

const KIND_NOTE = { sun: 'Our star', moon: 'Earth’s moon', planet: '', star: 'Bright star', 'deep-sky': '' } as const;
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

@Component({
  selector: 'app-astronomy-suite',
  standalone: true,
  imports: [FormsModule, MoonPhaseIndicator, SkyChartComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './astronomy-suite.html',
  styleUrl: './astronomy-suite.css'
})
export class AstronomySuiteComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly locationService = inject(LocationService);
  private readonly calc = inject(AstronomicalCalculatorService);
  private readonly precision = inject(PrecisionAstronomyService);

  readonly tabs = ASTRONOMY_TABS;
  readonly whenIsOptions: { id: WhenIs; label: string }[] = [
    { id: 'next-full-moon', label: 'Next full moon' },
    { id: 'next-new-moon', label: 'Next new moon' },
    { id: 'spring-equinox', label: 'March equinox' },
    { id: 'summer-solstice', label: 'Longest day' },
    { id: 'autumn-equinox', label: 'September equinox' },
    { id: 'winter-solstice', label: 'Shortest day' },
    { id: 'solar-noon', label: 'Solar noon today' }
  ];

  readonly location = this.locationService.selectedLocation;
  readonly tab = signal<AstronomyTab>('sky');
  readonly now = signal(new Date());
  /** Set once the person picks a date or time; null means follow the clock. */
  readonly pinned = signal<{ date: string; time: string } | null>(null);
  readonly selectedId = signal<string | null>('sun');
  readonly year = signal(new Date().getFullYear());
  readonly whenIs = signal<WhenIs>('next-full-moon');
  readonly showFigures = signal(true);
  readonly showDeepSky = signal(true);

  private wallClock(date: Date): { date: string; time: string } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.location().timezone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date);
    const v = (t: string) => parts.find(p => p.type === t)!.value;
    return { date: `${v('year')}-${v('month')}-${v('day')}`, time: `${v('hour')}:${v('minute')}` };
  }

  readonly fields = computed(() => this.pinned() ?? this.wallClock(this.now()));

  readonly instant = computed(() => {
    const p = this.pinned();
    if (!p) return this.now();
    const [y, m, d] = p.date.split('-').map(Number);
    const [h, min] = p.time.split(':').map(Number);
    if ([y, m, d, h, min].some(n => !Number.isFinite(n))) return this.now();
    return zonedDateTimeToInstant(y, m, d, h, min, 0, this.location().timezone);
  });

  readonly daylight = computed(() => this.calc.calculateDaylight(this.location(), this.instant()));
  readonly solar = computed(() => this.calc.calculateSolar(this.location(), this.instant()));
  readonly moon = computed(() => this.calc.calculateMoon(this.location(), this.instant()));
  readonly events = computed(() => this.calc.calculateYearlyEvents(this.year(), this.location()));
  readonly whenIsResult = computed(() => this.calc.solveWhenIs(this.whenIs(), this.location(), this.year()));

  readonly moonTimes = computed(() => this.riseSet(Astronomy.Body.Moon));

  readonly planets = computed(() => {
    const loc = this.location();
    return this.precision.getPlanetaryPositions(this.instant(), loc.latitude, loc.longitude, loc.elevationMeters ?? 0)
      .map(p => ({ ...p, ...this.riseSet(p.body) }));
  });

  readonly sunUp = computed(() => this.solar().solarPos.altitudeDeg > -0.833);

  readonly skyObjects = computed<SkyObject[]>(() => {
    const { latitude, longitude } = this.location();
    const when = this.instant();
    const sun = this.solar().solarPos;
    const moon = this.moon().lunarPos;
    const horizontal = (ra: number, dec: number) => equatorialJ2000ToHorizontal(ra, dec, when, latitude, longitude);
    const objects: SkyObject[] = [
      { id: 'sun', label: 'Sun', kind: 'sun', altitudeDeg: sun.altitudeDeg, azimuthDeg: sun.azimuthDeg, magnitude: -26.7 },
      { id: 'moon', label: 'Moon', kind: 'moon', altitudeDeg: moon.altitudeDeg, azimuthDeg: moon.azimuthDeg, magnitude: -12 },
      ...this.planets().map(p => ({ id: p.name, label: p.name, kind: 'planet' as const, altitudeDeg: p.altitudeDeg, azimuthDeg: p.azimuthDeg, magnitude: p.magnitude }))
    ];
    for (const s of STARS) {
      const h = horizontal(s.raDeg, s.decDeg);
      objects.push({ id: s.name, label: s.name, kind: 'star', altitudeDeg: h.altitudeDeg, azimuthDeg: h.azimuthDeg, magnitude: s.magnitude, tint: s.tint });
    }
    if (this.showDeepSky()) {
      for (const d of DEEP_SKY) {
        const h = horizontal(d.raDeg, d.decDeg);
        objects.push({ id: d.id, label: d.name, kind: 'deep-sky', altitudeDeg: h.altitudeDeg, azimuthDeg: h.azimuthDeg, magnitude: d.magnitude });
      }
    }
    return objects;
  });

  readonly figureLines = computed<SkyLine[]>(() =>
    this.showFigures() ? CONSTELLATIONS.flatMap(c => c.lines.map(([from, to]) => ({ from, to }))) : []
  );

  readonly selected = computed(() => {
    const o = this.skyObjects().find(x => x.id === this.selectedId());
    if (!o) return null;
    const deep = DEEP_SKY.find(d => d.id === o.id);
    const planet = this.planets().find(p => p.name === o.id);
    const figure = CONSTELLATIONS.filter(c => c.lines.some(l => l.includes(o.id))).map(c => c.name);
    return {
      ...o,
      compass: this.compass(o.azimuthDeg),
      up: o.altitudeDeg >= 0,
      note: deep ? `${deep.type}, ${deep.catalog}, ${deep.size}` : figure.length ? `Part of ${figure.join(' and ')}` : planet ? `${planet.distanceAu.toFixed(2)} AU from Earth` : KIND_NOTE[o.kind],
      rise: planet?.rise ?? null,
      set: planet?.set ?? null
    };
  });

  readonly aboveHorizonCount = computed(() => this.skyObjects().filter(o => o.altitudeDeg >= 0 && o.kind !== 'star').length);

  /** Sun altitude through the local day as an SVG path in a 600x170 box. */
  readonly sunCurve = computed(() => {
    const pts = this.solar().hourlySolarTrajectory;
    const x = (h: number) => (h / 23) * 600;
    const y = (alt: number) => 120 - (Math.max(-35, Math.min(90, alt)) / 90) * 120;
    return {
      line: pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.hour).toFixed(1)} ${y(p.altitude).toFixed(1)}`).join(' '),
      horizonY: y(0)
    };
  });

  readonly daySegments = computed(() => {
    const t = this.daylight().timelinePercentages;
    return [
      { cls: 'seg-night', label: 'Night', pct: t.nightPre + t.nightPost },
      { cls: 'seg-astro', label: 'Astronomical twilight', pct: t.astronomicalDawn + t.astronomicalDusk },
      { cls: 'seg-nautical', label: 'Nautical twilight', pct: t.nauticalDawn + t.nauticalDusk },
      { cls: 'seg-civil', label: 'Civil twilight', pct: t.civilDawn + t.civilDusk },
      { cls: 'seg-day', label: 'Daylight', pct: t.daylight }
    ];
  });

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const routeTab = this.route.snapshot.data['tab'];
    const wanted = params.get('tab') ?? routeTab;
    if (this.isTab(wanted)) this.tab.set(wanted);
    const date = params.get('date');
    const time = params.get('time');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) this.pinned.set({ date, time: time && /^\d{2}:\d{2}$/.test(time) ? time : '21:00' });

    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const id = setInterval(() => this.now.set(new Date()), 30000);
      inject(DestroyRef).onDestroy(() => clearInterval(id));
    }

    effect(() => {
      const label = ASTRONOMY_TABS.find(t => t.id === this.tab())!.label;
      const loc = this.location();
      const title = `${label} in ${loc.name} | 2piClock`;
      const description = `Sun, Moon, planets and bright stars for ${loc.name}, ${loc.country}, calculated for the time you choose.`;
      this.title.setTitle(title);
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ property: 'og:description', content: description });
    });
  }

  private isTab(v: unknown): v is AstronomyTab {
    return ASTRONOMY_TABS.some(t => t.id === v);
  }

  private riseSet(body: Astronomy.Body): { rise: Date | null; set: Date | null } {
    const loc = this.location();
    // Search from local midnight so "today" means the calendar day at the location.
    const [y, m, d] = this.fields().date.split('-').map(Number);
    const start = zonedDateTimeToInstant(y, m, d, 0, 0, 0, loc.timezone);
    return this.precision.getRiseSet(body, start, loc.latitude, loc.longitude, loc.elevationMeters ?? 0);
  }

  compass(az: number): string {
    return COMPASS[Math.round(az / 22.5) % 16];
  }

  clock(date: Date | null): string {
    return date ? date.toLocaleTimeString('en-GB', { timeZone: this.location().timezone, hour: '2-digit', minute: '2-digit' }) : 'none';
  }

  setTab(tab: AstronomyTab): void {
    this.tab.set(tab);
    this.syncUrl();
  }

  setDate(date: string): void {
    if (!date) return;
    this.pinned.set({ date, time: this.fields().time });
    this.year.set(Number(date.slice(0, 4)));
    this.syncUrl();
  }

  setTime(time: string): void {
    if (!time) return;
    this.pinned.set({ date: this.fields().date, time });
    this.syncUrl();
  }

  followClock(): void {
    this.pinned.set(null);
    this.now.set(new Date());
    this.year.set(new Date().getFullYear());
    this.syncUrl();
  }

  shiftYear(delta: number): void {
    this.year.update(y => y + delta);
  }

  /** Date, time and tab live in the URL so a shared link shows the same sky. */
  private syncUrl(): void {
    const p = this.pinned();
    void this.router.navigate([], {
      relativeTo: this.route,
      replaceUrl: true,
      queryParams: { tab: this.tab(), date: p?.date ?? null, time: p?.time ?? null }
    });
  }
}
