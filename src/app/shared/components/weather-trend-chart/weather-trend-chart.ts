import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CelestialService } from '../../../core/services/celestial.service';
import { WeatherService } from '../../../core/services/weather.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { WeatherData } from '../../../core/models/weather.model';

export interface HourlyTrendPoint {
  timeLabel: string;
  hourNum: number;
  tempC: number;
  tempF: number;
  humidityPct: number;
  conditionLabel: string;
  condition: string;
  windSpeedKmh: number;
  timeMs: number;
}

@Component({
  selector: 'app-weather-trend-chart',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="weather-trend-card bg-neutral-900/90 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl text-white select-none w-full max-w-full overflow-hidden">
      
      <!-- Top Title & Legend Bar -->
      <div class="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-white/10">
        <div class="flex items-center gap-2">
          <div class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></div>
          <span class="text-xs font-bold uppercase tracking-wider text-neutral-200">12-Hour Weather Trend</span>
          <span class="text-[10px] font-mono text-neutral-400 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
            {{ locationName() }}
          </span>
        </div>

        <div class="flex items-center gap-3 text-[11px] font-mono">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]"></span>
            <span class="text-amber-300 font-semibold">Temp ({{ isFahrenheit ? '°F' : '°C' }})</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]"></span>
            <span class="text-sky-300 font-semibold">Humidity (%)</span>
          </div>
        </div>
      </div>

      <!-- Quick Summary Stats Pill Bar -->
      <div class="grid grid-cols-3 gap-2 mb-3">
        <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 flex flex-col items-center text-center">
          <span class="text-[9px] uppercase font-mono text-amber-300/80">12h High Temp</span>
          <span class="text-sm font-black font-mono text-amber-400 mt-0.5">
            {{ isFahrenheit ? maxTempF() + '°F' : maxTempC() + '°C' }}
          </span>
        </div>

        <div class="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 flex flex-col items-center text-center">
          <span class="text-[9px] uppercase font-mono text-amber-300/80">12h Low Temp</span>
          <span class="text-sm font-black font-mono text-amber-200 mt-0.5">
            {{ isFahrenheit ? minTempF() + '°F' : minTempC() + '°C' }}
          </span>
        </div>

        <div class="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2 flex flex-col items-center text-center">
          <span class="text-[9px] uppercase font-mono text-sky-300/80">Peak Humidity</span>
          <span class="text-sm font-black font-mono text-sky-400 mt-0.5">
            {{ maxHumidity() }}%
          </span>
        </div>
      </div>

      <!-- SVG Chart Canvas Container -->
      <div class="relative w-full h-[150px] sm:h-[170px] mt-2 group" (mouseleave)="hoveredIndex.set(null)">
        
        <!-- Interactive Vertical Hover Cursor Line & Tooltip -->
        @if (activeHoverPoint(); as point) {
          <div 
            class="absolute top-0 bottom-6 border-l-2 border-dashed border-amber-400/80 pointer-events-none transition-all duration-75 z-20"
            [style.left.%]="activeHoverXPercent()">
            
            <!-- Floating Hover Tooltip -->
            <div 
              class="absolute -top-12 -translate-x-1/2 bg-neutral-950/95 border border-amber-400/40 rounded-lg px-2.5 py-1 text-center shadow-xl shadow-black/80 pointer-events-none whitespace-nowrap z-30 flex items-center gap-2">
              <span class="text-xs font-mono font-black text-amber-400">{{ point.timeLabel }}</span>
              <span class="text-neutral-500">|</span>
              <span class="text-xs font-mono font-bold text-amber-300">
                {{ isFahrenheit ? point.tempF + '°F' : point.tempC + '°C' }}
              </span>
              <span class="text-xs font-mono font-bold text-sky-400">
                {{ point.humidityPct }}% RH
              </span>
              <span class="text-[10px] text-neutral-300 font-sans">
                ({{ point.conditionLabel }})
              </span>
            </div>
          </div>
        }

        <svg 
          class="w-full h-full overflow-visible" 
          viewBox="0 0 500 150" 
          preserveAspectRatio="none">
          <defs>
            <!-- Temp Area Gradient -->
            <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.35" />
              <stop offset="100%" stop-color="#fbbf24" stop-opacity="0.0" />
            </linearGradient>

            <!-- Humidity Area Gradient -->
            <linearGradient id="humidityGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.25" />
              <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.0" />
            </linearGradient>

            <filter id="glowGold" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <!-- Horizontal Reference Grid Lines -->
          <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 4" />
          <line x1="0" y1="65" x2="500" y2="65" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 4" />
          <line x1="0" y1="110" x2="500" y2="110" stroke="rgba(255,255,255,0.06)" stroke-dasharray="4 4" />

          <!-- Humidity Fill Area -->
          <path [attr.d]="humidityAreaPath()" fill="url(#humidityGradient)" />

          <!-- Humidity Line -->
          <path 
            [attr.d]="humidityLinePath()" 
            fill="none" 
            stroke="#38bdf8" 
            stroke-width="2.5" 
            stroke-linecap="round" 
            stroke-linejoin="round" />

          <!-- Temperature Fill Area -->
          <path [attr.d]="tempAreaPath()" fill="url(#tempGradient)" />

          <!-- Temperature Line -->
          <path 
            [attr.d]="tempLinePath()" 
            fill="none" 
            stroke="#fbbf24" 
            stroke-width="3" 
            filter="url(#glowGold)" 
            stroke-linecap="round" 
            stroke-linejoin="round" />

          <!-- Data Points & Interactive Touch Target Columns -->
          @for (pt of chartCoordinates(); track $index) {
            <!-- Humidity Circles -->
            <circle 
              [attr.cx]="pt.x" 
              [attr.cy]="pt.humidityY" 
              r="3.5" 
              fill="#0284c7" 
              stroke="#38bdf8" 
              stroke-width="1.5" />

            <!-- Temperature Circles -->
            <circle 
              [attr.cx]="pt.x" 
              [attr.cy]="pt.tempY" 
              [attr.r]="hoveredIndex() === $index ? 6 : 4" 
              [attr.fill]="hoveredIndex() === $index ? '#ffffff' : '#fbbf24'" 
              stroke="#f59e0b" 
              stroke-width="2" 
              class="transition-all duration-150" />

            <!-- Invisible Column Hover Hitboxes -->
            <rect 
              [attr.x]="pt.x - 20" 
              y="0" 
              width="40" 
              height="150" 
              fill="transparent" 
              class="cursor-pointer" 
              (mouseenter)="hoveredIndex.set($index)" />
          }
        </svg>

        <!-- X-Axis Labels (Time) -->
        <div class="flex justify-between w-full px-1 mt-1 text-[10px] font-mono text-neutral-400">
          @for (pt of trendPoints(); track $index) {
            <div class="text-center w-8 -ml-4 flex flex-col items-center">
              <span [class.text-amber-400]="hoveredIndex() === $index" [class.font-bold]="hoveredIndex() === $index">
                {{ pt.timeLabel }}
              </span>
            </div>
          }
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }
  `]
})
export class WeatherTrendChartComponent {
  @Input() isFahrenheit = false;

  private celestialService = inject(CelestialService);
  private weatherService = inject(WeatherService);
  private timeControlService = inject(TimeControlService);

  readonly hoveredIndex = signal<number | null>(null);

  readonly locationName = computed(() => this.celestialService.selectedLocation().name);
  readonly activeDate = computed(() => this.timeControlService.currentActiveDate());

  // Extract 12 hourly forecast data points starting from activeDate
  readonly trendPoints = computed<HourlyTrendPoint[]>(() => {
    const active = this.activeDate();
    const loc = this.celestialService.selectedLocation();
    const hourly = this.weatherService.hourlyForecasts();
    const startMs = active.getTime();
    const points: HourlyTrendPoint[] = [];

    // Base fallback generator if hourly array is empty
    const currentW = this.weatherService.currentWeather();

    for (let i = 0; i < 12; i++) {
      const targetTime = new Date(startMs + i * 3600000);
      let match = this.findClosestHourlyForecast(hourly, targetTime.getTime());

      if (!match) {
        // Fallback simulation based on sine wave diurnal cycle
        const hour = targetTime.getHours();
        const diurnalFactor = Math.sin(((hour - 8) / 24) * 2 * Math.PI);
        const tempC = Math.round((currentW.temperatureC + diurnalFactor * 3.5) * 10) / 10;
        const tempF = Math.round((tempC * 9 / 5 + 32) * 10) / 10;
        const humidityPct = Math.min(100, Math.max(20, Math.round(currentW.humidityPct - diurnalFactor * 12)));

        match = {
          ...currentW,
          condition: currentW.condition,
          conditionLabel: currentW.conditionLabel,
          temperatureC: tempC,
          temperatureF: tempF,
          feelsLikeC: tempC,
          feelsLikeF: tempF,
          humidityPct,
          dewPointC: currentW.dewPointC,
          precipitationMm: currentW.precipitationMm,
          rainMm: currentW.rainMm,
          showersMm: currentW.showersMm,
          snowfallCm: currentW.snowfallCm,
          snowDepthCm: currentW.snowDepthCm,
          cloudCoverLowPct: currentW.cloudCoverLowPct,
          cloudCoverMidPct: currentW.cloudCoverMidPct,
          cloudCoverHighPct: currentW.cloudCoverHighPct,
          freezingLevelM: currentW.freezingLevelM,
          isDay: currentW.isDay,
          cloudCoverPct: currentW.cloudCoverPct,
          precipitationPct: currentW.precipitationPct,
          windSpeedKmh: currentW.windSpeedKmh,
          windDirectionDeg: currentW.windDirectionDeg,
          windGustKmh: currentW.windGustKmh,
          visibilityKm: currentW.visibilityKm,
          uvIndex: currentW.uvIndex,
          pressureHpa: currentW.pressureHpa,
          aggressivenessIndex: currentW.aggressivenessIndex,
          aggressivenessLabel: currentW.aggressivenessLabel,
          lightningFrequencyPerMin: currentW.lightningFrequencyPerMin,
          winterFrostLevel: currentW.winterFrostLevel,
          snowAccumulationCm: currentW.snowAccumulationCm,
          dataSource: 'open-meteo',
          isSimulated: true,
          updatedAt: targetTime
        };
      }
      if (!match) continue;

      const hourLabel = targetTime.toLocaleTimeString('en-US', {
        timeZone: loc.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).slice(0, 5);

      points.push({
        timeLabel: i === 0 ? 'Now' : hourLabel,
        hourNum: targetTime.getHours(),
        tempC: match.temperatureC,
        tempF: match.temperatureF,
        humidityPct: match.humidityPct,
        conditionLabel: match.conditionLabel,
        condition: match.condition,
        windSpeedKmh: match.windSpeedKmh,
        timeMs: targetTime.getTime()
      });
    }

    return points;
  });

  private findClosestHourlyForecast(hourly: { timeMs: number; weather: WeatherData }[], targetMs: number): WeatherData | null {
    if (!hourly || hourly.length === 0) return null;
    let closest = hourly[0];
    let minDiff = Math.abs(targetMs - closest.timeMs);

    for (let i = 1; i < hourly.length; i++) {
      const diff = Math.abs(targetMs - hourly[i].timeMs);
      if (diff < minDiff) {
        minDiff = diff;
        closest = hourly[i];
      }
    }
    return minDiff <= 7200000 ? closest.weather : null;
  }

  readonly maxTempC = computed(() => Math.max(...this.trendPoints().map((p: HourlyTrendPoint) => p.tempC)));
  readonly minTempC = computed(() => Math.min(...this.trendPoints().map((p: HourlyTrendPoint) => p.tempC)));
  readonly maxTempF = computed(() => Math.max(...this.trendPoints().map((p: HourlyTrendPoint) => p.tempF)));
  readonly minTempF = computed(() => Math.min(...this.trendPoints().map((p: HourlyTrendPoint) => p.tempF)));
  readonly maxHumidity = computed(() => Math.max(...this.trendPoints().map((p: HourlyTrendPoint) => p.humidityPct)));

  // SVG Chart Normalized Coordinates mapping
  readonly chartCoordinates = computed(() => {
    const pts = this.trendPoints();
    if (pts.length === 0) return [];

    const isF = this.isFahrenheit;
    const temps = pts.map((p: HourlyTrendPoint) => isF ? p.tempF : p.tempC);
    let minT = Math.min(...temps);
    let maxT = Math.max(...temps);

    // Padding for temperature Y scaling
    if (maxT === minT) {
      maxT += 5;
      minT -= 5;
    } else {
      const range = maxT - minT;
      maxT += range * 0.15;
      minT -= range * 0.15;
    }

    const svgWidth = 500;
    const svgHeight = 120; // Leave 30px for bottom padding
    const stepX = svgWidth / (pts.length - 1);

    return pts.map((pt: HourlyTrendPoint, i: number) => {
      const x = i * stepX;
      const tVal = isF ? pt.tempF : pt.tempC;
      // Invert Y axis for SVG (0 at top, 120 at bottom)
      const tempY = svgHeight - ((tVal - minT) / (maxT - minT)) * (svgHeight - 25) - 10;
      const humidityY = svgHeight - (pt.humidityPct / 100) * (svgHeight - 20) - 10;

      return {
        x: Math.round(x * 10) / 10,
        tempY: Math.round(tempY * 10) / 10,
        humidityY: Math.round(humidityY * 10) / 10,
        point: pt
      };
    });
  });

  readonly tempLinePath = computed(() => this.buildBezierPath(this.chartCoordinates().map((c: { x: number; tempY: number }) => ({ x: c.x, y: c.tempY }))));
  readonly humidityLinePath = computed(() => this.buildBezierPath(this.chartCoordinates().map((c: { x: number; humidityY: number }) => ({ x: c.x, y: c.humidityY }))));

  readonly tempAreaPath = computed(() => {
    const line = this.tempLinePath();
    if (!line) return '';
    return `${line} L 500 130 L 0 130 Z`;
  });

  readonly humidityAreaPath = computed(() => {
    const line = this.humidityLinePath();
    if (!line) return '';
    return `${line} L 500 130 L 0 130 Z`;
  });

  readonly activeHoverPoint = computed(() => {
    const idx = this.hoveredIndex();
    if (idx === null || idx < 0) return null;
    return this.trendPoints()[idx] || null;
  });

  readonly activeHoverXPercent = computed(() => {
    const idx = this.hoveredIndex();
    if (idx === null || idx < 0) return 0;
    return (idx / (this.trendPoints().length - 1)) * 100;
  });

  private buildBezierPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? i : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  }
}
