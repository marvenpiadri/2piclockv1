import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CelestialService } from '../../../core/services/celestial.service';
import { TimeControlService } from '../../../core/services/time-control.service';

@Component({
  selector: 'app-celestial-astrolabe',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="watch-viewport" role="img" aria-label="2piClock celestial watch">
      <svg class="watch-svg" viewBox="-160 -160 320 320" aria-hidden="true">
        <defs>
          <radialGradient id="watchFace" cx="50%" cy="42%" r="68%">
            <stop offset="0%" [attr.stop-color]="skyGradientColors().inner" />
            <stop offset="68%" [attr.stop-color]="skyGradientColors().mid" />
            <stop offset="100%" [attr.stop-color]="skyGradientColors().outer" />
          </radialGradient>
          <radialGradient id="watchSun" cx="32%" cy="28%" r="70%">
            <stop offset="0%" stop-color="#fff8cf" />
            <stop offset="35%" stop-color="#ffd86a" />
            <stop offset="72%" stop-color="#f4a51c" />
            <stop offset="100%" stop-color="#c97812" />
          </radialGradient>
          <radialGradient id="watchMoon" cx="32%" cy="28%" r="70%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="45%" stop-color="#e8edf2" />
            <stop offset="100%" stop-color="#9aa7b5" />
          </radialGradient>
          <filter id="watchGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <!-- One clean celestial bezel -->
        <circle r="153" fill="rgba(5,8,13,.78)" stroke="rgba(245,158,11,.32)" stroke-width="1.5" />
        <circle r="148" fill="url(#watchFace)" stroke="rgba(255,255,255,.10)" stroke-width="1" />
        <circle r="126" fill="none" stroke="rgba(255,255,255,.10)" stroke-width=".8" />
        <circle r="101" fill="none" stroke="rgba(255,255,255,.055)" stroke-width=".7" />

        <!-- 24-hour celestial ring: small, quiet, useful -->
        @for (hour of hourTicks; track hour.index) {
          <g [attr.transform]="'rotate(' + hour.angle + ')'">
            <line x1="0" [attr.y1]="hour.isMajor ? '-148' : '-145'" x2="0" y2="-140"
              [attr.stroke]="hour.isQuarter ? 'rgba(245,158,11,.75)' : 'rgba(255,255,255,.24)'"
              [attr.stroke-width]="hour.isQuarter ? '1.4' : '.8'" />
          </g>
        }

        <!-- Cardinal time anchors -->
        <text x="0" y="-132" fill="rgba(255,220,130,.82)" font-size="7" font-family="monospace" text-anchor="middle">12</text>
        <text x="132" y="2.5" fill="rgba(255,220,130,.65)" font-size="7" font-family="monospace" text-anchor="middle">18</text>
        <text x="0" y="137" fill="rgba(255,220,130,.65)" font-size="7" font-family="monospace" text-anchor="middle">00</text>
        <text x="-132" y="2.5" fill="rgba(255,220,130,.65)" font-size="7" font-family="monospace" text-anchor="middle">06</text>

        <!-- Actual celestial positions -->
        <line x1="0" y1="0" [attr.x2]="sunCoords().x" [attr.y2]="sunCoords().y"
          stroke="rgba(245,158,11,.16)" stroke-width="1" />
        <line x1="0" y1="0" [attr.x2]="moonCoords().x" [attr.y2]="moonCoords().y"
          stroke="rgba(226,232,240,.12)" stroke-width="1" />

        <g [attr.transform]="'translate(' + sunCoords().x + ',' + sunCoords().y + ')'">
          <circle r="13" fill="rgba(245,158,11,.16)" filter="url(#watchGlow)" />
          <circle r="6.5" fill="url(#watchSun)" stroke="rgba(255,232,160,.9)" stroke-width=".8" />
        </g>

        <g [attr.transform]="'translate(' + moonCoords().x + ',' + moonCoords().y + ')'">
          <circle r="11" fill="rgba(226,232,240,.12)" filter="url(#watchGlow)" />
          <circle r="6.2" fill="url(#watchMoon)" stroke="rgba(255,255,255,.6)" stroke-width=".7" />
          <path [attr.d]="moonTerminatorPath()" fill="rgba(20,27,38,.86)" />
        </g>

        <!-- Actual watch hands -->
        <g class="watch-hands">
          <line x1="0" y1="7" x2="0" y2="-57"
            [attr.transform]="'rotate(' + (localDayFraction() * 720) + ')'"
            stroke="#fffdf5" stroke-width="3.2" stroke-linecap="round" />
          <line x1="0" y1="8" x2="0" y2="-82"
            [attr.transform]="'rotate(' + (localDayFraction() * 8640) + ')'"
            stroke="#f4b52b" stroke-width="2" stroke-linecap="round" />
          <line x1="0" y1="10" x2="0" y2="-91"
            [attr.transform]="'rotate(' + secondHandAngle() + ')'"
            stroke="rgba(255,255,255,.7)" stroke-width=".8" stroke-linecap="round" />
          <circle r="4.5" fill="#f5ad20" stroke="#fff4c4" stroke-width=".8" />
          <circle r="1.6" fill="#1b1408" />
        </g>

        <!-- Quiet center readout -->
        <text x="0" y="28" class="watch-time" text-anchor="middle">{{ localTimeLabel() }}</text>
        <text x="0" y="40" class="watch-state" text-anchor="middle">{{ twilightStateLabel() }}</text>

        <!-- 2pi identity, integrated rather than branded as a telemetry label -->
        <text x="0" y="-27" class="watch-mark" text-anchor="middle">2π</text>

        <!-- Small astronomical context -->
        <text x="-92" y="116" class="watch-context" text-anchor="middle">SUN {{ sunAltitude().toFixed(0) }}°</text>
        <text x="92" y="116" class="watch-context" text-anchor="middle">MOON {{ moonAltitude().toFixed(0) }}°</text>
      </svg>
    </div>
  `,
  styles: [`
    :host { display:block; width:100%; max-width:520px; margin:0 auto; }
    .watch-viewport { width:100%; aspect-ratio:1; display:grid; place-items:center; position:relative; user-select:none; }
    .watch-svg { width:100%; height:100%; display:block; overflow:visible; filter:drop-shadow(0 18px 38px rgba(0,0,0,.42)); }
    .watch-hands line { transform-origin:0 0; }
    .watch-time { fill:#fffdf7; font:600 15px/1 "Dekatron", ui-monospace, monospace; letter-spacing:.04em; }
    .watch-state { fill:rgba(255,220,145,.72); font:600 5.5px/1 ui-monospace, monospace; letter-spacing:.16em; text-transform:uppercase; }
    .watch-mark { fill:rgba(255,224,145,.92); font:600 9px/1 "Dekatron", ui-monospace, monospace; letter-spacing:-.08em; }
    .watch-context { fill:rgba(226,232,240,.48); font:500 5px/1 ui-monospace, monospace; letter-spacing:.08em; }
    @media (prefers-reduced-motion: reduce) {
      .watch-svg { filter:none; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CelestialAstrolabeComponent {
  private celestialService = inject(CelestialService);
  private timeControlService = inject(TimeControlService);

  readonly celestial = this.celestialService.celestialState;
  private readonly timezoneValue = signal<string>('UTC');
  private readonly activeDateValue = signal<Date>(new Date());

  @Input()
  set timezone(value: string) {
    this.timezoneValue.set(value || 'UTC');
  }
  get timezone(): string {
    return this.timezoneValue();
  }

  @Input()
  set activeDate(value: Date) {
    this.activeDateValue.set(value instanceof Date ? value : new Date(value));
  }
  get activeDate(): Date {
    return this.activeDateValue();
  }

  @Input() latitude = 0;
  @Input() longitude = 0;

  readonly sunAltitude = computed(() => this.celestial().sun.altitudeDeg);
  readonly sunAzimuth = computed(() => this.celestial().sun.azimuthDeg);
  readonly moonAltitude = computed(() => this.celestial().moon.altitudeDeg);
  readonly moonAzimuth = computed(() => this.celestial().moon.azimuthDeg);

  readonly localDayFraction = computed(() => {
    const d = this.activeDateValue();
    const zone = this.timezoneValue();
    const parts = this.getLocalDateParts(d, zone);
    return (parts.hour * 3600000 + parts.minute * 60000 + parts.second * 1000 + d.getMilliseconds()) / 86400000;
  });

  readonly solarRadianAngle = computed(() => {
    return (this.localDayFraction() * 2 * Math.PI).toFixed(2);
  });

  readonly hourTicks = (() => {
    const ticks = [];
    for (let i = 0; i < 24; i++) {
      ticks.push({
        index: i,
        angle: i * 15,
        isMajor: i % 3 === 0,
        isQuarter: i % 6 === 0
      });
    }
    return ticks;
  })();

  // True Solar Coordinates on Astrolabe Coordinate Ring
  readonly sunCoords = computed(() => {
    // 24-hour solar rotation angle around limbus (Noon = top / 0 deg, 18:00 = right / 90 deg, Midnight = bottom / 180 deg)
    const solarFraction = this.localDayFraction();
    const solarAngleRad = (solarFraction * 360 - 180) * (Math.PI / 180);
    
    // Radius dynamically adapts to solar altitude: higher above horizon = closer to zenith/center, lower = closer to outer horizon
    const alt = Math.max(-90, Math.min(90, this.sunAltitude()));
    // Distance from center: Horizon = 126, Zenith (+90°) = 80, Nadir (-90°) = 142
    const radius = 126 - (alt / 90) * 44;

    return {
      x: Math.round(Math.sin(solarAngleRad) * radius * 10) / 10,
      y: Math.round(-Math.cos(solarAngleRad) * radius * 10) / 10
    };
  });

  // True Lunar Coordinates on Astrolabe Coordinate Ring
  readonly moonCoords = computed(() => {
    const m = this.celestial().moon;
    
    // Lunar position calculation combining solar phase elongation angle with lunar azimuth
    const solarFraction = this.localDayFraction();
    // Angular difference between Sun and Moon in 24h cycle
    const phaseOffsetDeg = (m.phaseAngleDeg || 0) * (m.phaseName.startsWith('Waning') ? -1 : 1);
    const moonAngleRad = ((solarFraction * 360 - 180) + phaseOffsetDeg) * (Math.PI / 180);

    const alt = Math.max(-90, Math.min(90, this.moonAltitude()));
    const radius = 126 - (alt / 90) * 44;

    return {
      x: Math.round(Math.sin(moonAngleRad) * radius * 10) / 10,
      y: Math.round(-Math.cos(moonAngleRad) * radius * 10) / 10
    };
  });

  // The second hand is deliberately discrete: one exact 6° move per second.
  // It must never chase animation frames or fractional milliseconds.
  readonly secondHandAngle = computed(() => {
    const totalSeconds = Math.floor(this.localDayFraction() * 86400);
    return (totalSeconds % 60) * 6;
  });

  readonly solarRaySpin = computed(() => {
    return Math.round(this.localDayFraction() * 720) % 360;
  });

  // Realistic Moon Phase SVG Terminator Path
  readonly moonTerminatorPath = computed(() => {
    const m = this.celestial().moon;
    const r = 8.5;
    const k = Math.max(-1, Math.min(1, Math.cos((m.phaseAngleDeg * Math.PI) / 180)));
    const sweep = m.phaseName.startsWith('Waning') ? 0 : 1;
    const x = k * r;
    return `M 0,-${r} A ${r},${r} 0 0,1 0,${r} A ${Math.abs(x || 0.05)},${r} 0 0,${sweep} 0,-${r} Z`;
  });

  // Sky Dome Gradient Colors reacting to Solar Altitude
  readonly skyGradientColors = computed(() => {
    const alt = this.sunAltitude();
    if (alt > 15) {
      // High Daylight
      return { inner: 'rgba(14, 38, 74, 0.95)', mid: 'rgba(9, 24, 48, 0.95)', outer: 'rgba(4, 10, 20, 0.98)' };
    } else if (alt > 0) {
      // Golden Hour / Horizon
      return { inner: 'rgba(64, 36, 16, 0.95)', mid: 'rgba(28, 18, 30, 0.95)', outer: 'rgba(7, 8, 16, 0.98)' };
    } else if (alt > -6) {
      // Civil Twilight
      return { inner: 'rgba(38, 22, 54, 0.95)', mid: 'rgba(18, 14, 36, 0.95)', outer: 'rgba(5, 6, 14, 0.98)' };
    } else if (alt > -12) {
      // Nautical Twilight
      return { inner: 'rgba(16, 20, 42, 0.95)', mid: 'rgba(10, 12, 26, 0.95)', outer: 'rgba(4, 5, 10, 0.98)' };
    }
    // Deep Astronomical Night
    return { inner: 'rgba(8, 12, 20, 0.96)', mid: 'rgba(5, 7, 12, 0.96)', outer: 'rgba(2, 3, 6, 0.98)' };
  });

  readonly twilightStateLabel = computed(() => {
    const state = this.celestial().twilightState;
    switch (state) {
      case 'day': return 'DAYLIGHT';
      case 'golden_hour': return 'GOLDEN HOUR';
      case 'civil_twilight': return 'CIVIL TWILIGHT';
      case 'nautical_twilight': return 'NAUTICAL TWILIGHT';
      case 'astronomical_twilight': return 'ASTRO TWILIGHT';
      default: return 'DEEP NIGHT';
    }
  });

  readonly twilightBadgeColor = computed(() => {
    const state = this.celestial().twilightState;
    switch (state) {
      case 'day':
        return { bg: 'rgba(245, 158, 11, 0.16)', border: 'rgba(245, 158, 11, 0.5)', dot: '#f59e0b', text: '#fbbf24' };
      case 'golden_hour':
        return { bg: 'rgba(251, 146, 60, 0.2)', border: 'rgba(251, 146, 60, 0.6)', dot: '#fb923c', text: '#fed7aa' };
      case 'civil_twilight':
        return { bg: 'rgba(192, 132, 252, 0.16)', border: 'rgba(192, 132, 252, 0.45)', dot: '#c084fc', text: '#e9d5ff' };
      case 'nautical_twilight':
      case 'astronomical_twilight':
        return { bg: 'rgba(56, 189, 248, 0.14)', border: 'rgba(56, 189, 248, 0.4)', dot: '#38bdf8', text: '#bae6fd' };
      default:
        return { bg: 'rgba(148, 163, 184, 0.12)', border: 'rgba(148, 163, 184, 0.3)', dot: '#94a3b8', text: '#e2e8f0' };
    }
  });

  readonly localTimeLabel = computed(() => {
    const d = this.activeDateValue();
    const zone = this.timezoneValue();
    const p = this.getLocalDateParts(d, zone);
    return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}:${String(p.second).padStart(2, '0')}`;
  });

  readonly localDateLabel = computed(() => {
    const d = this.activeDateValue();
    const zone = this.timezoneValue();
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }).format(d).toUpperCase();
    } catch {
      return 'TODAY';
    }
  });

  readonly timezoneDisplay = computed(() => {
    const zone = this.timezoneValue();
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(this.activeDateValue());
      return parts.find(p => p.type === 'timeZoneName')?.value || zone;
    } catch {
      return zone;
    }
  });

  private getLocalDateParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(date);

      const value = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
      return {
        year: value('year'),
        month: value('month'),
        day: value('day'),
        hour: value('hour'),
        minute: value('minute'),
        second: value('second')
      };
    } catch {
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds()
      };
    }
  }
}
