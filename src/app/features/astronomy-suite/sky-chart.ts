import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type SkyObjectKind = 'sun' | 'moon' | 'planet' | 'star' | 'deep-sky';

export interface SkyObject {
  id: string;
  label: string;
  kind: SkyObjectKind;
  altitudeDeg: number;
  azimuthDeg: number;
  magnitude: number;
  tint?: string;
}

export interface SkyLine { from: string; to: string; }

const R = 46;
const C = 50;

/** Everything above the horizon, as seen looking straight up: zenith in the middle, north at the top, east on the left. */
@Component({
  selector: 'app-sky-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 100 100" role="group" [attr.aria-label]="summary()">
      <defs>
        <radialGradient id="dome" cx="50%" cy="50%" r="50%">
          <stop offset="0%" [attr.stop-color]="daylight() ? '#3b82c4' : '#0b1530'" />
          <stop offset="100%" [attr.stop-color]="daylight() ? '#9cc7ec' : '#1a2a52'" />
        </radialGradient>
      </defs>
      <circle class="dome" [attr.cx]="c" [attr.cy]="c" [attr.r]="r" fill="url(#dome)" />
      @for (ring of rings; track ring) {
        <circle class="ring" [attr.cx]="c" [attr.cy]="c" [attr.r]="r * ring / 90" />
      }
      <line class="axis" [attr.x1]="c" [attr.y1]="c - r" [attr.x2]="c" [attr.y2]="c + r" />
      <line class="axis" [attr.x1]="c - r" [attr.y1]="c" [attr.x2]="c + r" [attr.y2]="c" />
      <circle class="horizon" [attr.cx]="c" [attr.cy]="c" [attr.r]="r" />
      <text class="cardinal" [attr.x]="c" y="3.6" text-anchor="middle">N</text>
      <text class="cardinal" [attr.x]="c" y="99" text-anchor="middle">S</text>
      <text class="cardinal" x="1.6" [attr.y]="c + 1.4">E</text>
      <text class="cardinal" x="98.4" [attr.y]="c + 1.4" text-anchor="end">W</text>

      @for (line of drawnLines(); track line.key) {
        <line class="figure" [attr.x1]="line.x1" [attr.y1]="line.y1" [attr.x2]="line.x2" [attr.y2]="line.y2" />
      }

      @for (p of placed(); track p.o.id) {
        <g class="obj" [class.is-selected]="p.o.id === selectedId()" tabindex="0" role="button"
           [attr.aria-label]="p.o.label + ', ' + p.o.altitudeDeg.toFixed(0) + ' degrees up'"
           (click)="pick.emit(p.o.id)" (keydown.enter)="pick.emit(p.o.id)" (keydown.space)="pick.emit(p.o.id); $event.preventDefault()">
          @switch (p.o.kind) {
            @case ('sun') { <circle [attr.cx]="p.x" [attr.cy]="p.y" r="2" fill="#fde68a" stroke="#f59e0b" stroke-width="0.6" /> }
            @case ('moon') { <circle [attr.cx]="p.x" [attr.cy]="p.y" r="1.7" fill="#e2e8f0" stroke="#94a3b8" stroke-width="0.5" /> }
            @case ('planet') { <circle [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="p.size" fill="#fbbf24" /> }
            @case ('deep-sky') { <rect [attr.x]="p.x - 1.2" [attr.y]="p.y - 1.2" width="2.4" height="2.4" fill="none" stroke="#7dd3fc" stroke-width="0.5" [attr.transform]="'rotate(45 ' + p.x + ' ' + p.y + ')'" /> }
            @default { <circle [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="p.size" [attr.fill]="'rgb(' + (p.o.tint ?? '235,245,255') + ')'" /> }
          }
          <circle class="hit" [attr.cx]="p.x" [attr.cy]="p.y" r="2.4" />
          @if (p.labelled) {
            <text class="name" [attr.x]="p.x + 2.2" [attr.y]="p.y + 1">{{ p.o.label }}</text>
          }
        </g>
      }
    </svg>
  `,
  styles: [`
    :host { display: block; }
    svg { width: 100%; height: auto; display: block; max-height: 78vh; overflow: visible; }
    .ring { fill: none; stroke: rgba(255,255,255,0.12); stroke-width: 0.25; }
    .axis { stroke: rgba(255,255,255,0.1); stroke-width: 0.25; }
    .horizon { fill: none; stroke: rgba(255,255,255,0.55); stroke-width: 0.5; }
    .cardinal { fill: var(--color-text-secondary); font-size: 2.8px; font-weight: 700; }
    .figure { stroke: rgba(226,232,240,0.38); stroke-width: 0.3; }
    .name { fill: #f1f5f9; font-size: 1.9px; paint-order: stroke; stroke: rgba(5,11,20,0.7); stroke-width: 0.5px; pointer-events: none; }
    .obj { cursor: pointer; outline: none; }
    .hit { fill: transparent; }
    .obj:focus-visible .hit, .is-selected .hit { stroke: #fbbf24; stroke-width: 0.5; }
  `]
})
export class SkyChartComponent {
  readonly objects = input.required<readonly SkyObject[]>();
  readonly lines = input<readonly SkyLine[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly daylight = input(false);
  readonly pick = output<string>();

  readonly c = C;
  readonly r = R;
  readonly rings = [30, 60];

  readonly placed = computed(() =>
    this.objects()
      .filter(o => o.altitudeDeg >= 0)
      .map(o => {
        const radius = (90 - o.altitudeDeg) / 90 * R;
        const az = o.azimuthDeg * Math.PI / 180;
        return {
          o,
          x: C - radius * Math.sin(az),
          y: C - radius * Math.cos(az),
          size: Math.max(0.3, Math.min(1.1, 0.95 - o.magnitude * 0.18)),
          labelled: o.kind !== 'star' || o.magnitude < 1.6
        };
      })
  );

  readonly drawnLines = computed(() => {
    const byId = new Map(this.placed().map(p => [p.o.id, p]));
    return this.lines().flatMap(l => {
      const a = byId.get(l.from);
      const b = byId.get(l.to);
      return a && b ? [{ key: l.from + l.to, x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : [];
    });
  });

  readonly summary = computed(() => `Sky chart with ${this.placed().length} objects above the horizon`);
}
