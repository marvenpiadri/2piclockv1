import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LocationService } from '../../core/services/location.service';
import { TimeControlService } from '../../core/services/time-control.service';
import { GeoLocation } from '../../core/models/location.model';
import { CountryFlagComponent } from '../../shared/components';
import { getCelestialState } from '../../core/astronomy/astronomy-engine';

const TAU = 2 * Math.PI;
const CENTER = 60;
const RADIUS = 50;

/** Local wall-clock hours (0-24) of an instant in an IANA zone. */
function localHours(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23'
  }).formatToParts(date);
  const n = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
  return n('hour') + n('minute') / 60 + n('second') / 3600;
}

/** Point on the dial. Same face as the main clock: noon at the top, midnight at the bottom. */
function dialPoint(hours: number, radius: number): { x: number; y: number } {
  const angle = ((hours - 12) / 24) * TAU;
  return { x: CENTER + radius * Math.sin(angle), y: CENTER - radius * Math.cos(angle) };
}

const TWILIGHT_LABEL: Record<string, string> = {
  day: 'Daytime',
  golden_hour: 'Golden hour',
  civil_twilight: 'Civil twilight',
  nautical_twilight: 'Nautical twilight',
  astronomical_twilight: 'Astronomical twilight',
  night: 'Night'
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterModule, FormsModule, CountryFlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dash">
      <header class="dash-head">
        <div>
          <h1>Cities</h1>
          <p>Each dial is one local day, noon at the top and midnight at the bottom. The amber arc is daylight.</p>
        </div>
        <select
          class="pin"
          aria-label="Pin a city"
          [disabled]="availableToAdd().length === 0"
          [ngModel]="selectedAddId()"
          (ngModelChange)="addCityById($event)">
          <option value="" disabled selected>Pin a city</option>
          @for (loc of availableToAdd(); track loc.id) {
            <option [value]="loc.id">{{ loc.name }}, {{ loc.country }}</option>
          }
        </select>
      </header>

      <div class="grid">
        @for (card of cityCards(); track card.loc.id) {
          <article class="city" [class.is-night]="!card.isDay">
            <svg class="dial" viewBox="0 0 120 120" role="img" [attr.aria-label]="card.dialLabel">
              <circle class="track" cx="60" cy="60" r="50" />
              @if (card.arc) {
                <path class="daylight" [attr.d]="card.arc" />
              } @else if (card.polarDay) {
                <circle class="daylight" cx="60" cy="60" r="50" />
              }
              @for (tick of ticks; track tick.x1) {
                <line class="tick" [attr.x1]="tick.x1" [attr.y1]="tick.y1" [attr.x2]="tick.x2" [attr.y2]="tick.y2" />
              }
              <line class="hand" x1="60" y1="60" [attr.x2]="card.hand.x" [attr.y2]="card.hand.y" />
              <circle class="sun" [attr.cx]="card.marker.x" [attr.cy]="card.marker.y" r="4.5" />
              <circle class="hub" cx="60" cy="60" r="2.5" />
            </svg>

            <div class="body">
              <h2>
                <app-country-flag [countryCode]="card.loc.countryCode" [customClass]="'flag'"></app-country-flag>
                {{ card.loc.name }}
              </h2>
              <p class="where">{{ card.loc.country }}, {{ card.loc.timezone }}</p>
              <p class="time">{{ card.timeStr }}</p>
              <p class="phase">{{ card.phase }}. Sun {{ card.altitudeText }}.</p>
              <dl class="events">
                <div><dt>Sunrise</dt><dd>{{ card.sunrise }}</dd></div>
                <div><dt>Sunset</dt><dd>{{ card.sunset }}</dd></div>
              </dl>
              <a class="open" [routerLink]="cityPath(card.loc)">Open sky</a>
            </div>

            @if (card.removable) {
              <button type="button" class="unpin" (click)="removeCity(card.loc.id)"
                      [attr.aria-label]="'Unpin ' + card.loc.name">×</button>
            }
          </article>
        }
      </div>

      @if (cityCards().length === 1) {
        <p class="hint">Pin more cities to compare their days side by side.</p>
      }
    </div>
  `,
  styles: [`
    .dash { max-width: 1200px; margin: 0 auto; padding: 28px 16px 48px; color: var(--color-text-main); font-family: var(--font-sans); }
    .dash-head { display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; }
    .dash-head p { margin: 6px 0 0; max-width: 52ch; color: var(--color-text-secondary); font-size: 0.9rem; line-height: 1.5; }
    .pin { padding: 9px 12px; border-radius: 10px; border: 1px solid var(--color-input-border); background: var(--color-input-bg); color: var(--color-input-text); font-size: 0.9rem; }
    .pin:disabled { opacity: 0.5; }
    .pin:focus-visible, .open:focus-visible, .unpin:focus-visible { outline: 2px solid var(--color-border-focus); outline-offset: 2px; }

    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-top: 24px; }
    .city { position: relative; display: flex; gap: 18px; align-items: center; padding: 20px; border-radius: 22px 22px 22px 6px; background: var(--color-surface-elevated); border: 1px solid var(--color-border); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); }
    .city.is-night { background: var(--color-surface-modal); }

    .dial { flex: 0 0 116px; width: 116px; height: 116px; }
    .dial .track { fill: none; stroke: rgba(240, 246, 252, 0.14); stroke-width: 8; }
    .dial .daylight { fill: none; stroke: #f59e0b; stroke-width: 8; stroke-linecap: round; }
    .dial .tick { stroke: rgba(240, 246, 252, 0.4); stroke-width: 1.5; }
    .dial .hand { stroke: var(--color-text-main); stroke-width: 2; stroke-linecap: round; }
    .dial .sun { fill: #fde68a; stroke: #050b14; stroke-width: 2; }
    .is-night .dial .sun { fill: #cbd5e1; }
    .dial .hub { fill: var(--color-text-main); }

    .body { min-width: 0; }
    h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1.05rem; font-weight: 700; }
    :host ::ng-deep .flag { width: 20px; height: 14px; border-radius: 2px; }
    .where { margin: 2px 0 0; color: var(--color-text-secondary); font-size: 0.78rem; overflow-wrap: anywhere; }
    .time { margin: 10px 0 0; font-size: 1.9rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
    .phase { margin: 2px 0 0; color: var(--color-text-secondary); font-size: 0.85rem; }
    .events { display: flex; gap: 20px; margin: 10px 0 0; }
    .events dt { color: var(--color-text-muted); font-size: 0.75rem; }
    .events dd { margin: 0; font-size: 0.95rem; font-variant-numeric: tabular-nums; }
    .open { display: inline-block; margin-top: 12px; color: var(--color-header-link-active); font-weight: 600; font-size: 0.9rem; text-decoration: none; }
    .open:hover { text-decoration: underline; }
    .unpin { position: absolute; top: 10px; right: 12px; width: 28px; height: 28px; border: 0; border-radius: 50%; background: transparent; color: var(--color-text-secondary); font-size: 1.25rem; line-height: 1; cursor: pointer; }
    .unpin:hover { background: var(--color-surface-hover); color: var(--color-text-main); }
    .hint { margin: 20px 0 0; color: var(--color-text-secondary); font-size: 0.9rem; }

    @media (max-width: 420px) {
      .grid { grid-template-columns: 1fr; }
      .city { flex-direction: column; align-items: flex-start; }
    }
  `]
})
export class DashboardComponent {
  private locationService = inject(LocationService);
  private timeControl = inject(TimeControlService);

  readonly allLocations = this.locationService.locations;
  readonly selectedAddId = signal<string>('');

  // Quarter-day ticks at noon, 18:00, midnight and 06:00.
  readonly ticks = [12, 18, 0, 6].map(h => {
    const a = dialPoint(h, RADIUS - 8);
    const b = dialPoint(h, RADIUS + 8);
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  });

  // The active city is always shown; the persisted watchlist supplies the rest.
  readonly pinned = computed(() => {
    const current = this.locationService.selectedLocation();
    return [current, ...this.locationService.watchlist().filter(l => l.id !== current.id)];
  });

  readonly availableToAdd = computed(() => {
    const pinned = new Set(this.pinned().map(l => l.id));
    return this.allLocations().filter(p => !pinned.has(p.id));
  });

  constructor() {
    void this.locationService.loadLocations().catch(() => undefined);
  }

  cityPath(loc: GeoLocation): string[] {
    return ['/', ...this.locationService.getLocationPath(loc)];
  }

  readonly cityCards = computed(() => {
    const now = this.timeControl.currentActiveDate();
    const currentId = this.locationService.selectedLocation().id;
    return this.pinned().map(loc => {
      const state = getCelestialState(now, loc.latitude, loc.longitude, loc.timezone);
      const clock = (d: Date) => d.toLocaleTimeString('en-GB', { timeZone: loc.timezone, hour: '2-digit', minute: '2-digit' });
      const { sunrise, sunset, isPolarDay } = state.solarEvents;
      const nowHours = localHours(now, loc.timezone);

      let arc: string | null = null;
      if (sunrise && sunset) {
        const from = localHours(sunrise, loc.timezone);
        const to = localHours(sunset, loc.timezone);
        const start = dialPoint(from, RADIUS);
        const end = dialPoint(to, RADIUS);
        const large = (to - from + 24) % 24 > 12 ? 1 : 0;
        arc = `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${end.x} ${end.y}`;
      }

      const altitude = state.sun.altitudeDeg;
      return {
        loc,
        removable: loc.id !== currentId,
        isDay: altitude > 0,
        timeStr: now.toLocaleTimeString('en-GB', { timeZone: loc.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        phase: TWILIGHT_LABEL[state.twilightState],
        altitudeText: `${Math.abs(altitude).toFixed(1)}° ${altitude >= 0 ? 'above' : 'below'} the horizon`,
        sunrise: sunrise ? clock(sunrise) : 'none today',
        sunset: sunset ? clock(sunset) : 'none today',
        arc,
        polarDay: isPolarDay,
        hand: dialPoint(nowHours, RADIUS - 14),
        marker: dialPoint(nowHours, RADIUS),
        dialLabel: sunrise && sunset
          ? `${loc.name} daylight from ${clock(sunrise)} to ${clock(sunset)}`
          : `${loc.name} has no sunrise or sunset today`
      };
    });
  });

  addCityById(id: string): void {
    const loc = this.allLocations().find(l => l.id === id);
    if (loc) this.locationService.addToWatchlist(loc);
    this.selectedAddId.set('');
  }

  removeCity(id: string): void {
    this.locationService.removeFromWatchlist(id);
  }
}
