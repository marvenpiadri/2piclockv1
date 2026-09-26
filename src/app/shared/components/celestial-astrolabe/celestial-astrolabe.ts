import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CelestialService } from '../../../core/services/celestial.service';
import { TimeControlService } from '../../../core/services/time-control.service';

@Component({
  selector: 'app-celestial-astrolabe',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="astrolabe-viewport" role="region" aria-label="Celestial Astrolabe of Time and Space">
      <svg class="astrolabe-svg" viewBox="-160 -160 320 320" aria-hidden="true">
        <defs>
          <!-- Sun Glow Corona Filter -->
          <filter id="astrolabeSunGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <!-- Moon Glow Filter -->
          <filter id="astrolabeMoonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <!-- Central Hub Metallic Gradient -->
          <radialGradient id="astrolabeHubGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="#0e131d" />
            <stop offset="75%" stop-color="#080a0f" />
            <stop offset="100%" stop-color="#040508" />
          </radialGradient>

          <!-- Sun Body Radiant Gradient -->
          <radialGradient id="astrolabeSunGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="25%" stop-color="#fef08a" />
            <stop offset="60%" stop-color="#f59e0b" />
            <stop offset="100%" stop-color="#d97706" />
          </radialGradient>

          <!-- Moon Body Gradient -->
          <radialGradient id="astrolabeMoonGrad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stop-color="#ffffff" />
            <stop offset="45%" stop-color="#e2e8f0" />
            <stop offset="80%" stop-color="#94a3b8" />
            <stop offset="100%" stop-color="#475569" />
          </radialGradient>

          <!-- Sky Vault Background Gradient (Reacts dynamically to solar altitude) -->
          <radialGradient id="astrolabeSkyGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" [attr.stop-color]="skyGradientColors().inner" />
            <stop offset="70%" [attr.stop-color]="skyGradientColors().mid" />
            <stop offset="100%" [attr.stop-color]="skyGradientColors().outer" />
          </radialGradient>
        </defs>

        <!-- ================= 1. THE MATER / BASE VAULT ================= -->
        <!-- Outer Limbus Foundation -->
        <circle cx="0" cy="0" r="154" fill="rgba(4, 6, 10, 0.96)" stroke="rgba(245, 158, 11, 0.35)" stroke-width="1.8" />
        <circle cx="0" cy="0" r="150" fill="url(#astrolabeSkyGrad)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="0.8" />

        <!-- Star Map Micro-Constellations -->
        <g opacity="0.45">
          <circle cx="-90" cy="-65" r="0.9" fill="#ffffff" />
          <circle cx="-65" cy="-95" r="1.2" fill="#bae6fd" opacity="0.9" />
          <circle cx="85" cy="-80" r="1.1" fill="#fef08a" opacity="0.8" />
          <circle cx="110" cy="-45" r="0.8" fill="#ffffff" />
          <circle cx="-105" cy="40" r="1.3" fill="#ffffff" opacity="0.85" />
          <circle cx="95" cy="55" r="0.9" fill="#93c5fd" />
          <circle cx="-45" cy="105" r="1.0" fill="#ffffff" opacity="0.7" />
          <circle cx="60" cy="95" r="1.2" fill="#fde68a" />
          <circle cx="0" cy="-115" r="0.8" fill="#ffffff" />
          <circle cx="-115" cy="-15" r="1.1" fill="#e0e7ff" />
        </g>

        <!-- ================= 2. ALMUCANTARS & COORDINATE RINGS (TYMPAN) ================= -->
        <!-- 0° Horizon Ring (Golden Threshold) -->
        <circle cx="0" cy="0" r="126" fill="none" stroke="rgba(245, 158, 11, 0.32)" stroke-width="1.2" stroke-dasharray="3 3" />
        
        <!-- Civil Twilight (-6°) & Nautical (-12°) Thresholds -->
        <circle cx="0" cy="0" r="136" fill="none" stroke="rgba(148, 163, 184, 0.18)" stroke-width="0.8" stroke-dasharray="2 4" />
        <circle cx="0" cy="0" r="144" fill="none" stroke="rgba(148, 163, 184, 0.10)" stroke-width="0.6" stroke-dasharray="1 5" />

        <!-- Altitude +30° & +60° Circles -->
        <circle cx="0" cy="0" r="98" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="0.8" />
        <circle cx="0" cy="0" r="74" fill="none" stroke="rgba(255, 255, 255, 0.08)" stroke-width="0.8" />

        <!-- Cardinal Meridian Axis Lines -->
        <line x1="0" y1="-148" x2="0" y2="148" stroke="rgba(255, 255, 255, 0.12)" stroke-width="0.8" stroke-dasharray="4 4" />
        <line x1="-148" y1="0" x2="148" y2="0" stroke="rgba(245, 158, 11, 0.28)" stroke-width="1" stroke-dasharray="4 4" />

        <!-- Horizon E/W & Zenith/Nadir Inscriptions -->
        <text x="-144" y="-4" fill="#f59e0b" font-size="6.5" font-family="monospace" font-weight="800">EAST (SUNRISE)</text>
        <text x="144" y="-4" fill="#f59e0b" font-size="6.5" font-family="monospace" font-weight="800" text-anchor="end">WEST (SUNSET)</text>
        <text x="0" y="-136" fill="#f8fafc" font-size="6.5" font-family="monospace" font-weight="700" text-anchor="middle" opacity="0.6">ZENITH / NOON</text>
        <text x="0" y="142" fill="#f8fafc" font-size="6.5" font-family="monospace" font-weight="700" text-anchor="middle" opacity="0.6">NADIR / MIDNIGHT</text>

        <!-- ================= 3. ASTROLABE 24-HOUR SOLAR LIMB GRADUATIONS ================= -->
        <!-- 24-Hour Tick Marks (15° increments) -->
        @for (hour of hourTicks; track hour.index) {
          <g [attr.transform]="'rotate(' + hour.angle + ')'">
            <line 
              x1="0" 
              [attr.y1]="hour.isMajor ? '-150' : '-146'" 
              x2="0" 
              y2="-138" 
              [attr.stroke]="hour.isQuarter ? 'rgba(245, 158, 11, 0.95)' : (hour.isMajor ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.18)')" 
              [attr.stroke-width]="hour.isQuarter ? '1.8' : (hour.isMajor ? '1.2' : '0.7')" />
          </g>
        }

        <!-- 24-Hour Solar Time Labels around Rim -->
        <text x="0" y="-140" fill="#fbbf24" font-size="8.5" font-family="monospace" font-weight="800" text-anchor="middle">12:00</text>
        <text x="136" y="3" fill="#fbbf24" font-size="8.5" font-family="monospace" font-weight="800" text-anchor="end">18:00</text>
        <text x="0" y="148" fill="#fbbf24" font-size="8.5" font-family="monospace" font-weight="800" text-anchor="middle">00:00</text>
        <text x="-136" y="3" fill="#fbbf24" font-size="8.5" font-family="monospace" font-weight="800" text-anchor="start">06:00</text>

        <!-- Intermediate Solar Hour Markings -->
        <text x="96" y="-92" fill="#cbd5e1" font-size="6.5" font-family="monospace" font-weight="700" text-anchor="middle">15:00</text>
        <text x="96" y="98" fill="#cbd5e1" font-size="6.5" font-family="monospace" font-weight="700" text-anchor="middle">21:00</text>
        <text x="-96" y="98" fill="#cbd5e1" font-size="6.5" font-family="monospace" font-weight="700" text-anchor="middle">03:00</text>
        <text x="-96" y="-92" fill="#cbd5e1" font-size="6.5" font-family="monospace" font-weight="700" text-anchor="middle">09:00</text>

        <!-- ================= 4. CELESTIAL ALIDADE / SOLAR-LUNAR RAYS ================= -->
        <!-- Sun-Moon Angular Separation Chord Arc -->
        <line 
          [attr.x1]="sunCoords().x" 
          [attr.y1]="sunCoords().y" 
          [attr.x2]="moonCoords().x" 
          [attr.y2]="moonCoords().y" 
          stroke="rgba(255, 255, 255, 0.22)" 
          stroke-width="1.2" 
          stroke-dasharray="3 3" />

        <!-- Solar Ray Beam from Center to Sun -->
        <line 
          x1="0" 
          y1="0" 
          [attr.x2]="sunCoords().x" 
          [attr.y2]="sunCoords().y" 
          stroke="rgba(245, 158, 11, 0.45)" 
          stroke-width="1.5" 
          stroke-dasharray="4 3" />

        <!-- Lunar Ray Beam from Center to Moon -->
        <line 
          x1="0" 
          y1="0" 
          [attr.x2]="moonCoords().x" 
          [attr.y2]="moonCoords().y" 
          stroke="rgba(186, 230, 253, 0.35)" 
          stroke-width="1.2" 
          stroke-dasharray="3 3" />

        <!-- ================= 5. THE RADIANT SUN ================= -->
        <g [attr.transform]="'translate(' + sunCoords().x + ',' + sunCoords().y + ')'" class="astrolabe-body sun-body">
          <!-- Radiant Solar Flare Crown -->
          <circle cx="0" cy="0" r="18" fill="rgba(245, 158, 11, 0.22)" filter="url(#astrolabeSunGlow)" />
          
          <!-- Sun Rays -->
          @for (ray of [0, 45, 90, 135, 180, 225, 270, 315]; track ray) {
            <line 
              x1="0" 
              y1="-10" 
              x2="0" 
              y2="-15" 
              [attr.transform]="'rotate(' + (ray + solarRaySpin()) + ')'" 
              stroke="#fbbf24" 
              stroke-width="1.4" 
              stroke-linecap="round" 
              opacity="0.85" />
          }

          <!-- Sun Disc -->
          <circle cx="0" cy="0" r="9.5" fill="url(#astrolabeSunGrad)" stroke="#fef08a" stroke-width="0.8" />
          <circle cx="0" cy="0" r="3.2" fill="#ffffff" />

          <!-- Floating Solar Telemetry Tag -->
          <g transform="translate(0, 19)">
            <rect x="-30" y="-7" width="60" height="14" rx="4" fill="rgba(10, 14, 22, 0.88)" stroke="rgba(245, 158, 11, 0.45)" stroke-width="0.7" />
            <text x="0" y="2.8" fill="#fbbf24" font-size="6" font-family="monospace" font-weight="800" text-anchor="middle">
              SUN {{ sunAltitude() >= 0 ? '+' : '' }}{{ sunAltitude().toFixed(1) }}°
            </text>
          </g>
        </g>

        <!-- ================= 6. THE LIVING MOON ================= -->
        <g [attr.transform]="'translate(' + moonCoords().x + ',' + moonCoords().y + ')'" class="astrolabe-body moon-body">
          <!-- Lunar Glow Halo -->
          <circle cx="0" cy="0" r="15" fill="rgba(186, 230, 253, 0.18)" filter="url(#astrolabeMoonGlow)" />
          
          <!-- Base Lunar Disc -->
          <circle cx="0" cy="0" r="8.5" fill="url(#astrolabeMoonGrad)" stroke="rgba(255, 255, 255, 0.5)" stroke-width="0.7" />
          
          <!-- Dynamic Moon Phase Shadow Mask / Terminator Curve -->
          <path [attr.d]="moonTerminatorPath()" fill="#090d16" opacity="0.92" />

          <!-- Subtle Lunar Core Glint -->
          <circle cx="0" cy="0" r="2" fill="#ffffff" opacity="0.8" />

          <!-- Floating Lunar Telemetry Tag -->
          <g transform="translate(0, 18)">
            <rect x="-34" y="-7" width="68" height="14" rx="4" fill="rgba(10, 14, 22, 0.88)" stroke="rgba(186, 230, 253, 0.35)" stroke-width="0.7" />
            <text x="0" y="2.8" fill="#bae6fd" font-size="6" font-family="monospace" font-weight="700" text-anchor="middle">
              MOON {{ (celestial().moon.illuminationFraction * 100).toFixed(0) }}% · {{ moonAltitude() >= 0 ? '+' : '' }}{{ moonAltitude().toFixed(0) }}°
            </text>
          </g>
        </g>

        <!-- ================= 7. CENTER ASTROLABE HUB (DIGITAL CLOCK FOR TIME & SPACE) ================= -->
        <!-- Outer Brass Bezel with Rivets -->
        <circle cx="0" cy="0" r="54" fill="url(#astrolabeHubGrad)" stroke="rgba(245, 158, 11, 0.55)" stroke-width="1.8" />
        <circle cx="0" cy="0" r="50" fill="none" stroke="rgba(255, 255, 255, 0.14)" stroke-width="0.8" stroke-dasharray="2 2" />

        <!-- 8 Micro Rivets around Hub Rim -->
        @for (rivet of [0, 45, 90, 135, 180, 225, 270, 315]; track rivet) {
          <g [attr.transform]="'rotate(' + rivet + ')'">
            <circle cx="0" cy="-52" r="1.1" fill="#f59e0b" opacity="0.85" />
          </g>
        }

        <!-- Center Hub Inner Content: Digital Clock & Astrolabe Readout -->
        <!-- Twilight State / Space Condition Badge -->
        <g transform="translate(0, -32)">
          <rect x="-38" y="-7" width="76" height="14" rx="5" [attr.fill]="twilightBadgeColor().bg" [attr.stroke]="twilightBadgeColor().border" stroke-width="0.8" />
          <circle cx="-30" cy="0" r="2.2" [attr.fill]="twilightBadgeColor().dot" />
          <text x="3" y="3.2" [attr.fill]="twilightBadgeColor().text" font-size="6.5" font-family="monospace" font-weight="800" text-anchor="middle" letter-spacing="0.06em">
            {{ twilightStateLabel() }}
          </text>
        </g>

        <!-- Large Monospace / Dekatron Digital Time Readout -->
        <text x="0" y="-6" fill="#ffffff" font-size="18" font-family="monospace, ui-monospace, sans-serif" font-weight="800" text-anchor="middle" letter-spacing="0.04em" class="astrolabe-digital-time">
          {{ localTimeLabel() }}
        </text>

        <!-- Seconds Readout Sub-Bar or Millisecond Progress Arc -->
        <g transform="translate(0, 10)">
          <!-- 2π Radian Coordinate & Azimuth Angle -->
          <text x="0" y="0" fill="#f59e0b" font-size="7" font-family="monospace" font-weight="700" text-anchor="middle">
            2π · {{ solarRadianAngle() }} rad · {{ (localDayFraction() * 360).toFixed(1) }}°
          </text>
        </g>

        <!-- Location Timezone & Calendar Date Badge -->
        <g transform="translate(0, 26)">
          <text x="0" y="0" fill="#94a3b8" font-size="6.5" font-family="monospace" font-weight="700" text-anchor="middle">
            {{ localDateLabel() }} · {{ timezoneDisplay() }}
          </text>
          <text x="0" y="9" fill="#64748b" font-size="5.5" font-family="monospace" font-weight="600" text-anchor="middle">
            ASTRONOMICAL ASTROLABE
          </text>
        </g>

        <!-- Center Pivot Pin -->
        <circle cx="0" cy="0" r="2.5" fill="#f59e0b" stroke="#ffffff" stroke-width="0.8" />
      </svg>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      max-width: 520px;
      margin: 0 auto;
    }

    .astrolabe-viewport {
      width: 100%;
      aspect-ratio: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      user-select: none;
      filter: drop-shadow(0 16px 36px rgba(0, 0, 0, 0.65));
    }

    .astrolabe-svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      display: block;
    }

    .astrolabe-digital-time {
      filter: drop-shadow(0 2px 8px rgba(255, 255, 255, 0.35));
    }

    .astrolabe-body {
      transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
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
