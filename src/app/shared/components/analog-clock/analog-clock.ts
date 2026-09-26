import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

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

        <!-- Center Pin -->
        <circle cx="100" cy="100" r="4" fill="#ef4444" />
        <circle cx="100" cy="100" r="1.5" fill="#ffffff" />
      </svg>
    </div>
  `,
  styles: [`
    :host { display:block; width:100%; }
    .analog-face { width:min(100%,220px); aspect-ratio:1; margin:auto; border-radius:50%; display:flex; align-items:center; justify-content:center; overflow:hidden; }
    .analog-svg { width: 100%; height: 100%; overflow: visible; display: block; }
  `]
})
export class AnalogClockComponent {
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

