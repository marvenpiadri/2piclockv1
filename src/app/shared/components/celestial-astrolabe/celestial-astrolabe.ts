import { ChangeDetectionStrategy, Component, Input, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CelestialService } from '../../../core/services/celestial.service';
import { TimeControlService } from '../../../core/services/time-control.service';

@Component({
  selector: 'app-celestial-astrolabe',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './celestial-astrolabe.html',
  styleUrl: './celestial-astrolabe.css',

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
  /*
   * V2.0 astronomical sky layer.
   * These are bright, named reference stars (J2000 RA/Dec). Their positions
   * are recomputed from UTC, longitude and observer latitude, so the field
   * rotates with the actual sky instead of using decorative random dots.
   */
  private readonly brightStars = [
    { name: 'Sirius', ra: 6.75248, dec: -16.7161, mag: -1.46 },
    { name: 'Canopus', ra: 6.39920, dec: -52.6957, mag: -0.74 },
    { name: 'Arcturus', ra: 14.26103, dec: 19.1825, mag: -0.05 },
    { name: 'Vega', ra: 18.61565, dec: 38.7837, mag: 0.03 },
    { name: 'Capella', ra: 5.27815, dec: 45.9980, mag: 0.08 },
    { name: 'Rigel', ra: 5.24230, dec: -8.2016, mag: 0.13 },
    { name: 'Procyon', ra: 7.65503, dec: 5.2250, mag: 0.34 },
    { name: 'Achernar', ra: 1.62857, dec: -57.2368, mag: 0.46 },
    { name: 'Betelgeuse', ra: 5.91953, dec: 7.4070, mag: 0.50 },
    { name: 'Hadar', ra: 14.06373, dec: -60.3730, mag: 0.61 },
    { name: 'Altair', ra: 19.84639, dec: 8.8683, mag: 0.77 },
    { name: 'Aldebaran', ra: 4.59868, dec: 16.5093, mag: 0.85 },
    { name: 'Spica', ra: 13.41988, dec: -11.1614, mag: 0.97 },
    { name: 'Antares', ra: 16.49013, dec: -26.4320, mag: 1.06 },
    { name: 'Pollux', ra: 7.75525, dec: 28.0262, mag: 1.14 },
    { name: 'Fomalhaut', ra: 22.96085, dec: -29.6222, mag: 1.16 },
    { name: 'Deneb', ra: 20.69053, dec: 45.2803, mag: 1.25 },
    { name: 'Regulus', ra: 10.13953, dec: 11.9672, mag: 1.35 },
    { name: 'Castor', ra: 7.57667, dec: 31.8883, mag: 1.58 },
    { name: 'Bellatrix', ra: 5.41885, dec: 6.3497, mag: 1.64 }
  ] as const;

  readonly visibleStars = computed(() => {
    const d = this.activeDateValue();
    const lat = this.latitude;
    const lon = this.longitude;
    const jd = this.julianDate(d);
    const centuries = (jd - 2451545.0) / 36525;
    const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545.0)
      + 0.000387933 * centuries * centuries
      - centuries * centuries * centuries / 38710000) % 360;
    const lst = (gmst + lon + 360) % 360;
    const latRad = lat * Math.PI / 180;

    return this.brightStars.flatMap(star => {
      const decRad = star.dec * Math.PI / 180;
      const hourAngle = ((lst - star.ra * 15 + 540) % 360) - 180;
      const haRad = hourAngle * Math.PI / 180;
      const sinAlt = Math.sin(latRad) * Math.sin(decRad)
        + Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad);
      const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;

      if (altitude < -8) return [];

      const azimuth = Math.atan2(
        Math.sin(haRad),
        Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad)
      ) * 180 / Math.PI + 180;

      // Project the local sky dome: horizon near the outer ring, zenith toward center.
      const radius = 118 - Math.max(-8, Math.min(90, altitude)) * 0.43;
      const azRad = azimuth * Math.PI / 180;
      const x = Math.sin(azRad) * radius;
      const y = -Math.cos(azRad) * radius;

      // Apparent brightness: brighter stars get a larger point and remain visible
      // without turning the watch into a dense planetarium.
      const radiusPx = Math.max(0.65, Math.min(2.0, 1.8 - star.mag * 0.35));
      const altitudeFade = altitude < 5 ? Math.max(0.16, (altitude + 8) / 13) : 1;
      const opacity = Math.max(0.18, Math.min(0.92, (1.55 - star.mag * 0.16) * altitudeFade));

      return [{ name: star.name, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), radius: Number(radiusPx.toFixed(2)), opacity: Number(opacity.toFixed(2)) }];
    });
  });

  private julianDate(date: Date): number {
    return date.getTime() / 86400000 + 2440587.5;
  }

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
