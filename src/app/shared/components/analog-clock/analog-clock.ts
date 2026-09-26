import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CelestialService } from '../../../core/services/celestial.service';

@Component({
  selector: 'app-analog-clock',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="analog-face">
      <svg class="analog-svg" viewBox="0 0 200 200">
        <!-- Pure Outer & Inner Dial Circle -->
        <circle cx="100" cy="100" r="94" fill="#090b10" stroke="rgba(255, 255, 255, 0.16)" stroke-width="2" />

        @if (showCelestialMarkers) {
          <circle cx="100" cy="100" r="82" fill="none" stroke="rgba(245,158,11,.20)" stroke-width="1" stroke-dasharray="2 4" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="1" />
        }

        <!-- Dial Tick Marks / Stripes -->
        <!-- Fine stripes in WHITE, Big hour stripes in AMBER -->
        @for (tick of minuteTicks; track tick.angle) {
          <line
            [attr.x1]="tick.x1"
            [attr.y1]="tick.y1"
            [attr.x2]="tick.x2"
            [attr.y2]="tick.y2"
            [attr.stroke]="tick.isMajor ? '#f59e0b' : 'rgba(255, 255, 255, 0.5)'"
            [attr.stroke-width]="tick.isMajor ? '2.5' : '1.0'"
            stroke-linecap="round"
          />
        }

        <!-- Dial Numbers (Clean TimeAndDate Style) -->
        <text x="100" y="32" fill="#f59e0b" font-size="13" font-family="monospace" font-weight="800" text-anchor="middle" dominant-baseline="central">12</text>
        <text x="168" y="100" fill="#f59e0b" font-size="13" font-family="monospace" font-weight="800" text-anchor="middle" dominant-baseline="central">3</text>
        <text x="100" y="168" fill="#f59e0b" font-size="13" font-family="monospace" font-weight="800" text-anchor="middle" dominant-baseline="central">6</text>
        <text x="32" y="100" fill="#f59e0b" font-size="13" font-family="monospace" font-weight="800" text-anchor="middle" dominant-baseline="central">9</text>

        @if (showCelestialMarkers) {
          <line x1="100" y1="100" [attr.x2]="sunMarker().x" [attr.y2]="sunMarker().y" stroke="rgba(245,158,11,.55)" stroke-width="1.5" stroke-dasharray="4 4" />
          <g [attr.transform]="'translate(' + sunMarker().x + ',' + sunMarker().y + ')'">
            <circle r="9" fill="#f59e0b" opacity=".20" /> <circle r="6" fill="#f59e0b" /> <circle r="2.2" fill="#fff7d6" />
          </g>
          <line x1="100" y1="100" [attr.x2]="moonMarker().x" [attr.y2]="moonMarker().y" stroke="rgba(186,230,253,.38)" stroke-width="1.2" stroke-dasharray="3 3" />
          <g [attr.transform]="'translate(' + moonMarker().x + ',' + moonMarker().y + ')'">
            <circle r="9" fill="#dbeafe" opacity=".10" /> <circle r="6" fill="#dbeafe" stroke="rgba(255,255,255,.45)" stroke-width=".7" />
            <path [attr.d]="moonPhasePath()" fill="#090b10" opacity=".94" />
          </g>
        }

        <!-- Hour Hand (WHITE Arrow) -->
        <g>
          <line
            [attr.x1]="100"
            [attr.y1]="100"
            [attr.x2]="hourHandCoords().x"
            [attr.y2]="hourHandCoords().y"
            stroke="#ffffff"
            stroke-width="4.5"
            stroke-linecap="round"
          />
          <!-- Hour Hand Arrow Head -->
          <polygon
            [attr.points]="hourArrowHead()"
            fill="#ffffff"
          />
        </g>

        <!-- Minute Hand (AMBER Color Arrow) -->
        <g>
          <line
            [attr.x1]="100"
            [attr.y1]="100"
            [attr.x2]="minuteHandCoords().x"
            [attr.y2]="minuteHandCoords().y"
            stroke="#f59e0b"
            stroke-width="3"
            stroke-linecap="round"
          />
          <!-- Minute Hand Arrow Head -->
          <polygon
            [attr.points]="minuteArrowHead()"
            fill="#f59e0b"
          />
        </g>

        <!-- Second Hand (Rotating RED Arrow Hand) -->
        <g>
          <line
            [attr.x1]="100"
            [attr.y1]="100"
            [attr.x2]="secondHandCoords().x"
            [attr.y2]="secondHandCoords().y"
            stroke="#ef4444"
            stroke-width="1.5"
            stroke-linecap="round"
          />
          <!-- Counter-weight tail -->
          <line
            [attr.x1]="100"
            [attr.y1]="100"
            [attr.x2]="secondTailCoords().x"
            [attr.y2]="secondTailCoords().y"
            stroke="#ef4444"
            stroke-width="2.5"
            stroke-linecap="round"
          />
          <!-- Rotating Red Arrow Pointer -->
          <polygon
            [attr.points]="secondArrowHead()"
            fill="#ef4444"
          />
        </g>

        @if (showDigitalReadout) {
          <g class="analog-digital-readout">
            <rect x="55" y="82" width="90" height="36" rx="10" fill="rgba(7,9,13,.90)" stroke="rgba(255,255,255,.14)" />
            <text x="100" y="98" fill="#f8fafc" font-size="13" font-family="monospace" font-weight="800" text-anchor="middle">{{ localTimeLabel() }}</text>
            <text x="100" y="110" fill="#f59e0b" font-size="5.5" font-family="monospace" font-weight="700" text-anchor="middle">{{ twilightLabel() }}</text>
          </g>
        }

        <!-- Center Pin -->
        <circle cx="100" cy="100" r="4" fill="#ef4444" />
        <circle cx="100" cy="100" r="1.5" fill="#ffffff" />
      </svg>
    </div>
  `,
  styles: [`
    :host { display:block; width:100%; }
    .analog-face { width:min(100%,var(--analog-clock-size,220px)); aspect-ratio:1; margin:auto; border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; }
    .analog-svg { width: 100%; height: 100%; overflow: visible; display: block; }
  `]
})
export class AnalogClockComponent {
  private readonly celestialService = inject(CelestialService);
  readonly celestial = this.celestialService.celestialState;
  private readonly timezoneValue = signal('UTC');
  private readonly activeDateValue = signal<Date>(new Date());

  @Input({ required: true })
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
  @Input() showCelestialMarkers = false;
  @Input() showDigitalReadout = false;

  readonly minuteTicks = (() => {
    const ticks = [];
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const isMajor = i % 5 === 0;
      const rOuter = 88;
      const rInner = isMajor ? 76 : 82;
      ticks.push({
        angle: i,
        isMajor,
        x1: 100 + Math.sin(angle) * rOuter,
        y1: 100 - Math.cos(angle) * rOuter,
        x2: 100 + Math.sin(angle) * rInner,
        y2: 100 - Math.cos(angle) * rInner
      });
    }
    return ticks;
  })();

  readonly localTimeLabel = computed(() => {
    const t = this.parsedTime();
    return String(t.rawHours).padStart(2, '0') + ':' + String(t.minutes).padStart(2, '0') + ':' + String(t.seconds).padStart(2, '0');
  });

  readonly twilightLabel = computed(() => this.celestial().twilightState.replaceAll('_', ' '));

  private celestialMarker(azimuthDeg: number, altitudeDeg: number, outerRadius: number) {
    const altitude = Math.max(-90, Math.min(90, altitudeDeg));
    const radius = outerRadius - ((altitude + 90) / 180) * (outerRadius - 52);
    const angle = (azimuthDeg / 360) * Math.PI * 2;
    return { x: 100 + Math.sin(angle) * radius, y: 100 - Math.cos(angle) * radius };
  }

  readonly sunMarker = computed(() => {
    const c = this.celestial();
    return this.celestialMarker(c.sun.azimuthDeg, c.sun.altitudeDeg, 78);
  });

  readonly moonMarker = computed(() => {
    const c = this.celestial();
    return this.celestialMarker(c.moon.azimuthDeg, c.moon.altitudeDeg, 66);
  });

  readonly moonPhasePath = computed(() => {
    const m = this.celestial().moon;
    const r = 6;
    const k = Math.max(-1, Math.min(1, Math.cos((m.phaseAngleDeg * Math.PI) / 180)));
    const sweep = m.phaseName.startsWith('Waning') ? 0 : 1;
    const x = k * r;
    return 'M 0,-' + r + ' A ' + r + ',' + r + ' 0 0,1 0,' + r + ' A ' + Math.abs(x || 0.05) + ',' + r + ' 0 0,' + sweep + ' 0,-' + r + ' Z';
  });

  private parsedTime = computed(() => {
    const d = this.activeDateValue();
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: this.timezoneValue(),
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      };
      const formatter = new Intl.DateTimeFormat('en-US', options);
      const parts = formatter.formatToParts(d);
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      for (const p of parts) {
        if (p.type === 'hour') hours = parseInt(p.value, 10);
        if (p.type === 'minute') minutes = parseInt(p.value, 10);
        if (p.type === 'second') seconds = parseInt(p.value, 10);
      }
      return { hours: hours % 12, minutes, seconds, rawHours: hours };
    } catch {
      return { hours: d.getHours() % 12, minutes: d.getMinutes(), seconds: d.getSeconds(), rawHours: d.getHours() };
    }
  });

  readonly hourHandCoords = computed(() => {
    const t = this.parsedTime();
    const totalHours = t.hours + t.minutes / 60 + t.seconds / 3600;
    const angle = (totalHours / 12) * Math.PI * 2;
    const length = 46;
    return {
      angle,
      x: 100 + Math.sin(angle) * length,
      y: 100 - Math.cos(angle) * length
    };
  });

  readonly hourArrowHead = computed(() => {
    const { angle, x, y } = this.hourHandCoords();
    const size = 7;
    const p1x = x + Math.sin(angle) * size;
    const p1y = y - Math.cos(angle) * size;
    const p2x = x + Math.sin(angle + (Math.PI * 0.75)) * size;
    const p2y = y - Math.cos(angle + (Math.PI * 0.75)) * size;
    const p3x = x + Math.sin(angle - (Math.PI * 0.75)) * size;
    const p3y = y - Math.cos(angle - (Math.PI * 0.75)) * size;
    return `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`;
  });

  readonly minuteHandCoords = computed(() => {
    const t = this.parsedTime();
    const totalMinutes = t.minutes + t.seconds / 60;
    const angle = (totalMinutes / 60) * Math.PI * 2;
    const length = 62;
    return {
      angle,
      x: 100 + Math.sin(angle) * length,
      y: 100 - Math.cos(angle) * length
    };
  });

  readonly minuteArrowHead = computed(() => {
    const { angle, x, y } = this.minuteHandCoords();
    const size = 6;
    const p1x = x + Math.sin(angle) * size;
    const p1y = y - Math.cos(angle) * size;
    const p2x = x + Math.sin(angle + (Math.PI * 0.75)) * size;
    const p2y = y - Math.cos(angle + (Math.PI * 0.75)) * size;
    const p3x = x + Math.sin(angle - (Math.PI * 0.75)) * size;
    const p3y = y - Math.cos(angle - (Math.PI * 0.75)) * size;
    return `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`;
  });

  readonly secondHandCoords = computed(() => {
    const t = this.parsedTime();
    const angle = (t.seconds / 60) * Math.PI * 2;
    const length = 72;
    return {
      angle,
      x: 100 + Math.sin(angle) * length,
      y: 100 - Math.cos(angle) * length
    };
  });

  readonly secondTailCoords = computed(() => {
    const t = this.parsedTime();
    const angle = (t.seconds / 60) * Math.PI * 2;
    const length = -14;
    return {
      x: 100 + Math.sin(angle) * length,
      y: 100 - Math.cos(angle) * length
    };
  });

  readonly secondArrowHead = computed(() => {
    const { angle, x, y } = this.secondHandCoords();
    const size = 5;
    const p1x = x + Math.sin(angle) * size;
    const p1y = y - Math.cos(angle) * size;
    const p2x = x + Math.sin(angle + (Math.PI * 0.8)) * size;
    const p2y = y - Math.cos(angle + (Math.PI * 0.8)) * size;
    const p3x = x + Math.sin(angle - (Math.PI * 0.8)) * size;
    const p3y = y - Math.cos(angle - (Math.PI * 0.8)) * size;
    return `${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`;
  });
}

