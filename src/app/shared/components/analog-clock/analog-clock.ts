import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { CelestialService } from '../../../core/services/celestial.service';

@Component({
  selector: 'app-analog-clock',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="analog-face" [style.--analog-clock-size]="size + 'px'" role="img" [attr.aria-label]="ariaLabel">
      <svg class="analog-svg" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="94" class="face" />
        @if (showTicks) {
          @for (tick of minuteTicks; track tick.index) {
            <line
              [attr.x1]="tick.x1" [attr.y1]="tick.y1"
              [attr.x2]="tick.x2" [attr.y2]="tick.y2"
              class="tick"
              [class.major]="tick.isMajor" />
          }
        }

        @if (showNumbers) {
          <text x="100" y="31" class="number" text-anchor="middle" dominant-baseline="central">12</text>
          <text x="169" y="100" class="number" text-anchor="middle" dominant-baseline="central">3</text>
          <text x="100" y="169" class="number" text-anchor="middle" dominant-baseline="central">6</text>
          <text x="31" y="100" class="number" text-anchor="middle" dominant-baseline="central">9</text>
        }

        @if (showCelestialMarkers) {
          <g [attr.transform]="'translate(' + sunMarker().x + ',' + sunMarker().y + ')'">
            <circle r="5" class="sun-marker" />
          </g>
          <g [attr.transform]="'translate(' + moonMarker().x + ',' + moonMarker().y + ')'">
            <circle r="5" class="moon-marker" />
          </g>
        }

        <!-- Simple rounded hands: no arrows or pointer heads. -->
        <line x1="100" y1="105" [attr.x2]="hourHand().x" [attr.y2]="hourHand().y" class="hour-hand" />
        <line x1="100" y1="106" [attr.x2]="minuteHand().x" [attr.y2]="minuteHand().y" class="minute-hand" />

        @if (showSeconds) {
          <line x1="100" y1="108" [attr.x2]="secondHand().x" [attr.y2]="secondHand().y" class="second-hand" />
        }

        <circle cx="100" cy="100" r="5" class="center-pin" />
        <circle cx="100" cy="100" r="1.7" class="center-core" />
      </svg>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }
    .analog-face {
      width: min(100%, var(--analog-clock-size, 180px));
      aspect-ratio: 1;
      margin: 0 auto;
    }
    .analog-svg { width: 100%; height: 100%; display: block; overflow: visible; }
    .face { fill: rgba(255,255,255,.045); stroke: rgba(255,255,255,.28); stroke-width: 1.2; }
    .tick { stroke: rgba(255,255,255,.34); stroke-width: 1; stroke-linecap: round; }
    .tick.major { stroke: rgba(245,158,11,.82); stroke-width: 2; }
    .number { fill: rgba(255,255,255,.82); font: 700 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
    .hour-hand { stroke: rgba(255,255,255,.96); stroke-width: 5; stroke-linecap: round; }
    .minute-hand { stroke: #f59e0b; stroke-width: 3; stroke-linecap: round; }
    .second-hand { stroke: rgba(255,255,255,.72); stroke-width: 1.2; stroke-linecap: round; }
    .center-pin { fill: #f59e0b; }
    .center-core { fill: #fff8dc; }
    .sun-marker { fill: #f59e0b; opacity: .9; }
    .moon-marker { fill: #cbd5e1; stroke: rgba(255,255,255,.6); stroke-width: .7; }
  `]
})
export class AnalogClockComponent {
  private readonly celestialService = inject(CelestialService);
  private readonly timezoneValue = signal('UTC');
  private readonly activeDateValue = signal<Date>(new Date());

  @Input({ required: true })
  set timezone(value: string) { this.timezoneValue.set(value || 'UTC'); }
  get timezone(): string { return this.timezoneValue(); }

  @Input()
  set activeDate(value: Date) {
    this.activeDateValue.set(value instanceof Date ? value : new Date(value));
  }
  get activeDate(): Date { return this.activeDateValue(); }

  @Input() size = 180;
  @Input() showSeconds = true;
  @Input() showNumbers = true;
  @Input() showTicks = true;
  @Input() showCelestialMarkers = false;
  @Input() latitude = 0;
  @Input() longitude = 0;
  @Input() ariaLabel = 'Analog clock';

  readonly minuteTicks = (() => {
    const ticks = [];
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2;
      const major = i % 5 === 0;
      const outer = 89;
      const inner = major ? 80 : 85;
      ticks.push({
        index: i,
        isMajor: major,
        x1: 100 + Math.sin(angle) * outer,
        y1: 100 - Math.cos(angle) * outer,
        x2: 100 + Math.sin(angle) * inner,
        y2: 100 - Math.cos(angle) * inner
      });
    }
    return ticks;
  })();

  private parsedTime = computed(() => {
    const d = this.activeDateValue();
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: this.timezoneValue(),
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      }).formatToParts(d);
      const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0);
      const hours = get('hour');
      return { hour: hours % 12, minute: get('minute'), second: get('second') };
    } catch {
      return { hour: d.getHours() % 12, minute: d.getMinutes(), second: d.getSeconds() };
    }
  });

  readonly hourHand = computed(() => {
    const t = this.parsedTime();
    const angle = ((t.hour + t.minute / 60 + t.second / 3600) / 12) * Math.PI * 2;
    return { x: 100 + Math.sin(angle) * 50, y: 100 - Math.cos(angle) * 50 };
  });

  readonly minuteHand = computed(() => {
    const t = this.parsedTime();
    const angle = ((t.minute + t.second / 60) / 60) * Math.PI * 2;
    return { x: 100 + Math.sin(angle) * 70, y: 100 - Math.cos(angle) * 70 };
  });

  readonly secondHand = computed(() => {
    const t = this.parsedTime();
    const angle = (t.second / 60) * Math.PI * 2;
    return { x: 100 + Math.sin(angle) * 78, y: 100 - Math.cos(angle) * 78 };
  });

  private marker(azimuthDeg: number, altitudeDeg: number, outerRadius: number) {
    const altitude = Math.max(-90, Math.min(90, altitudeDeg));
    const radius = outerRadius - ((altitude + 90) / 180) * (outerRadius - 52);
    const angle = (azimuthDeg / 360) * Math.PI * 2;
    return { x: 100 + Math.sin(angle) * radius, y: 100 - Math.cos(angle) * radius };
  }

  readonly sunMarker = computed(() => {
    const s=this.celestialService.celestialState().sun;
    return this.marker(s.azimuthDeg,s.altitudeDeg,78);
  });
  readonly moonMarker = computed(() => {
    const m=this.celestialService.celestialState().moon;
    return this.marker(m.azimuthDeg,m.altitudeDeg,68);
  });
}
