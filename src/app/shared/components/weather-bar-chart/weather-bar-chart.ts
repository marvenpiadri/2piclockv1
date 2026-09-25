import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import * as d3 from 'd3';
import { WeatherService } from '../../../core/services/weather.service';
import { CelestialService } from '../../../core/services/celestial.service';
import { TimeControlService } from '../../../core/services/time-control.service';

export type ChartMode = 'metrics' | 'hourly';

export interface BarDatum {
  label: string;
  value: number;
  unit: string;
  color: string;
  secondaryColor?: string;
  category: 'humidity' | 'visibility' | 'cloud' | 'precip' | 'wind' | 'pressure';
  description: string;
}

export interface HourlyGroupDatum {
  timeLabel: string;
  humidity: number;
  visibility: number;
}

@Component({
  selector: 'app-weather-bar-chart',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="weather-bar-card bg-slate-950/80 border border-white/10 rounded-2xl p-3.5 sm:p-4 text-white shadow-xl w-full select-none overflow-hidden flex flex-col gap-3">
      
      <!-- Top Title & Mode Selector Bar -->
      <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <div class="flex items-center gap-2">
          <mat-icon class="text-sky-400 text-base">bar_chart</mat-icon>
          <span class="text-xs font-extrabold uppercase font-mono tracking-wider text-slate-200">Atmospheric Bar Visualizer</span>
        </div>

        <!-- Mode Toggle Segmented Control -->
        <div class="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
          <button 
            type="button" 
            (click)="chartMode.set('metrics')"
            class="px-2 py-1 text-[10px] font-mono font-bold rounded-lg transition-colors cursor-pointer"
            [class.bg-sky-500]="chartMode() === 'metrics'"
            [class.text-slate-950]="chartMode() === 'metrics'"
            [class.text-slate-400]="chartMode() !== 'metrics'"
            [class.hover:text-white]="chartMode() !== 'metrics'">
            Metrics
          </button>
          <button 
            type="button" 
            (click)="chartMode.set('hourly')"
            class="px-2 py-1 text-[10px] font-mono font-bold rounded-lg transition-colors cursor-pointer"
            [class.bg-sky-500]="chartMode() === 'hourly'"
            [class.text-slate-950]="chartMode() === 'hourly'"
            [class.text-slate-400]="chartMode() !== 'hourly'"
            [class.hover:text-white]="chartMode() !== 'hourly'">
            12h Trend
          </button>
        </div>
      </div>

      <!-- Quick Summary Stats Header -->
      <div class="grid grid-cols-2 gap-2 text-xs font-mono">
        <div class="bg-sky-500/10 border border-sky-500/20 rounded-xl p-2 flex items-center justify-between">
          <span class="text-slate-400 text-[10px] uppercase">Humidity</span>
          <span class="font-bold text-sky-300 text-sm">{{ currentHumidity() }}%</span>
        </div>
        <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-2 flex items-center justify-between">
          <span class="text-slate-400 text-[10px] uppercase">Visibility</span>
          <span class="font-bold text-emerald-300 text-sm">{{ currentVisibility() }} km</span>
        </div>
      </div>

      <!-- SVG D3 Bar Chart Canvas Container -->
      <div class="chart-container relative w-full h-[180px] sm:h-[200px]">
        <svg #d3Svg class="w-full h-full overflow-visible" viewBox="0 0 380 200" preserveAspectRatio="none">
          <defs>
            <linearGradient id="humidityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#38bdf8" stop-opacity="1" />
              <stop offset="100%" stop-color="#0284c7" stop-opacity="0.6" />
            </linearGradient>
            <linearGradient id="visibilityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#34d399" stop-opacity="1" />
              <stop offset="100%" stop-color="#059669" stop-opacity="0.6" />
            </linearGradient>
            <linearGradient id="cloudGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#94a3b8" stop-opacity="1" />
              <stop offset="100%" stop-color="#475569" stop-opacity="0.6" />
            </linearGradient>
            <linearGradient id="precipGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#818cf8" stop-opacity="1" />
              <stop offset="100%" stop-color="#4f46e5" stop-opacity="0.6" />
            </linearGradient>
            <linearGradient id="windGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#fbbf24" stop-opacity="1" />
              <stop offset="100%" stop-color="#d97706" stop-opacity="0.6" />
            </linearGradient>
            <linearGradient id="pressureGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#c084fc" stop-opacity="1" />
              <stop offset="100%" stop-color="#7e22ce" stop-opacity="0.6" />
            </linearGradient>
          </defs>
          <g class="chart-group" transform="translate(30, 20)"></g>
        </svg>

        <!-- Hover Tooltip Banner -->
        @if (hoveredInfo(); as info) {
          <div class="absolute bottom-1 left-2 right-2 bg-slate-900/95 border border-sky-400/30 rounded-lg p-1.5 px-2.5 text-[11px] font-mono flex items-center justify-between text-slate-200 pointer-events-none backdrop-blur-md shadow-lg z-20">
            <span class="font-bold text-sky-300">{{ info.title }}</span>
            <span class="text-slate-400 text-[10px]">{{ info.description }}</span>
          </div>
        }
      </div>

      <!-- Chart Footer Legend / Meta -->
      <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-white/5">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-sky-400"></span>
            <span>Humidity (%)</span>
          </div>
          <div class="flex items-center gap-1">
            <span class="w-2 h-2 rounded-sm bg-emerald-400"></span>
            <span>Visibility (km)</span>
          </div>
        </div>
        <span>D3.js Bar Engine</span>
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
export class WeatherBarChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('d3Svg', { static: false }) d3SvgRef!: ElementRef<SVGSVGElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly weatherService = inject(WeatherService);
  private readonly celestialService = inject(CelestialService);
  private readonly timeControl = inject(TimeControlService);

  readonly chartMode = signal<ChartMode>('metrics');
  readonly hoveredInfo = signal<{ title: string; description: string } | null>(null);

  readonly currentWeather = computed(() => this.weatherService.currentWeather());
  readonly hourlyData = computed(() => this.weatherService.hourlyForecasts());

  readonly currentHumidity = computed(() => this.currentWeather().humidityPct);
  readonly currentVisibility = computed(() => this.currentWeather().visibilityKm);

  constructor() {
    effect(() => {
      // Trigger chart re-render whenever weather, mode, or hourly data changes
      this.chartMode();
      this.currentWeather();
      this.hourlyData();

      if (isPlatformBrowser(this.platformId) && this.d3SvgRef) {
        this.renderChart();
      }
    });
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.renderChart();
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId) && this.d3SvgRef) {
      d3.select(this.d3SvgRef.nativeElement).selectAll('.chart-group > *').remove();
    }
  }

  private renderChart(): void {
    if (!this.d3SvgRef?.nativeElement) return;

    const svg = d3.select(this.d3SvgRef.nativeElement);
    const group = svg.select<SVGGElement>('.chart-group');
    group.selectAll('*').remove();

    const width = 330;  // 380 - 50 margin
    const height = 150; // 200 - 50 margin

    if (this.chartMode() === 'metrics') {
      this.renderMetricsChart(group, width, height);
    } else {
      this.renderHourlyChart(group, width, height);
    }
  }

  private renderMetricsChart(
    group: d3.Selection<SVGGElement, unknown, null, undefined>,
    width: number,
    height: number
  ): void {
    const w = this.currentWeather();

    const data: BarDatum[] = [
      {
        label: 'Humidity',
        value: w.humidityPct,
        unit: '%',
        color: 'url(#humidityGrad)',
        category: 'humidity',
        description: `${w.humidityPct}% Relative Humidity`
      },
      {
        label: 'Visibility',
        value: Math.min(100, (w.visibilityKm / 10) * 100), // Normalized to % scale for chart
        unit: 'km',
        color: 'url(#visibilityGrad)',
        category: 'visibility',
        description: `${w.visibilityKm} km Transmittance Range`
      },
      {
        label: 'Cloud Cover',
        value: w.cloudCoverPct,
        unit: '%',
        color: 'url(#cloudGrad)',
        category: 'cloud',
        description: `${w.cloudCoverPct}% Sky Cloudiness`
      },
      {
        label: 'Rain Prob',
        value: w.precipitationPct,
        unit: '%',
        color: 'url(#precipGrad)',
        category: 'precip',
        description: `${w.precipitationPct}% Precipitation Chance`
      },
      {
        label: 'Wind Speed',
        value: Math.min(100, (w.windSpeedKmh / 80) * 100), // Normalized to % scale
        unit: 'km/h',
        color: 'url(#windGrad)',
        category: 'wind',
        description: `${w.windSpeedKmh} km/h Surface Velocity`
      },
      {
        label: 'Pressure',
        value: Math.min(100, Math.max(0, ((w.pressureHpa - 970) / 70) * 100)), // Normalized pressure
        unit: 'hPa',
        color: 'url(#pressureGrad)',
        category: 'pressure',
        description: `${w.pressureHpa} hPa Surface Pressure`
      }
    ];

    const xScale = d3.scaleBand()
      .domain(data.map(d => d.label))
      .range([0, width])
      .padding(0.3);

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    // Gridlines
    group.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data([25, 50, 75, 100])
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-dasharray', '3 3');

    // Bars
    const bars = group.selectAll('.bar-rect')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'bar-group')
      .style('cursor', 'pointer');

    bars.append('rect')
      .attr('class', 'bar-rect')
      .attr('x', d => xScale(d.label) || 0)
      .attr('width', xScale.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('rx', 4)
      .attr('fill', d => d.color)
      .on('mouseenter', (_event, d) => {
        const rawVal = d.category === 'visibility' ? `${w.visibilityKm} km` :
                       d.category === 'wind' ? `${w.windSpeedKmh} km/h` :
                       d.category === 'pressure' ? `${w.pressureHpa} hPa` : `${Math.round(d.value)}${d.unit}`;
        this.hoveredInfo.set({
          title: `${d.label}: ${rawVal}`,
          description: d.description
        });
      })
      .on('mouseleave', () => {
        this.hoveredInfo.set(null);
      })
      .transition()
      .duration(500)
      .delay((_d, i) => i * 60)
      .attr('y', d => yScale(d.value))
      .attr('height', d => height - yScale(d.value));

    // Value Labels on Top of Bars
    bars.append('text')
      .attr('x', d => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.value) - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e2e8f0')
      .attr('font-size', '9px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold')
      .text(d => {
        if (d.category === 'visibility') return `${w.visibilityKm}k`;
        if (d.category === 'wind') return `${w.windSpeedKmh}`;
        if (d.category === 'pressure') return `${w.pressureHpa}`;
        return `${Math.round(d.value)}%`;
      });

    // X Axis
    const xAxis = d3.axisBottom(xScale);
    group.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('dy', '10px');

    group.selectAll('.domain, .tick line').attr('stroke', 'rgba(255,255,255,0.1)');
  }

  private renderHourlyChart(
    group: d3.Selection<SVGGElement, unknown, null, undefined>,
    width: number,
    height: number
  ): void {
    const hourly = this.hourlyData();
    const activeDate = this.timeControl.currentActiveDate();
    const loc = this.celestialService.selectedLocation();
    const currentW = this.currentWeather();

    // Prepare 8 two-hour interval groups for 12-16 hour trend
    const groupData: HourlyGroupDatum[] = [];
    const startMs = activeDate.getTime();

    for (let i = 0; i < 8; i++) {
      const targetTime = new Date(startMs + i * 2 * 3600000);
      const match = hourly.find(h => Math.abs(h.timeMs - targetTime.getTime()) < 3600000)?.weather;

      const timeLabel = i === 0 ? 'Now' : targetTime.toLocaleTimeString('en-US', {
        timeZone: loc.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).slice(0, 5);

      const humidity = match ? match.humidityPct : Math.min(100, Math.max(20, Math.round(currentW.humidityPct + Math.sin(i) * 10)));
      const visibility = match ? match.visibilityKm : Math.max(1, Math.round(currentW.visibilityKm + Math.cos(i) * 2));

      groupData.push({
        timeLabel,
        humidity,
        visibility
      });
    }

    const x0Scale = d3.scaleBand()
      .domain(groupData.map(d => d.timeLabel))
      .range([0, width])
      .padding(0.25);

    const x1Scale = d3.scaleBand()
      .domain(['humidity', 'visibility'])
      .range([0, x0Scale.bandwidth()])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([height, 0]);

    // Gridlines
    group.append('g')
      .attr('class', 'grid')
      .selectAll('line')
      .data([25, 50, 75, 100])
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', width)
      .attr('y1', d => yScale(d))
      .attr('y2', d => yScale(d))
      .attr('stroke', 'rgba(255,255,255,0.08)')
      .attr('stroke-dasharray', '3 3');

    // Grouped Bars
    const groupGroups = group.selectAll('.hour-group')
      .data(groupData)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${x0Scale(d.timeLabel) || 0}, 0)`);

    // Humidity Bar
    groupGroups.append('rect')
      .attr('x', x1Scale('humidity') || 0)
      .attr('width', x1Scale.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('rx', 3)
      .attr('fill', 'url(#humidityGrad)')
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => {
        this.hoveredInfo.set({
          title: `${d.timeLabel} Humidity: ${d.humidity}%`,
          description: `Relative humidity at ${d.timeLabel}`
        });
      })
      .on('mouseleave', () => this.hoveredInfo.set(null))
      .transition()
      .duration(450)
      .delay((_d, i) => i * 40)
      .attr('y', d => yScale(d.humidity))
      .attr('height', d => height - yScale(d.humidity));

    // Visibility Bar (Normalized 0-10km -> 0-100%)
    groupGroups.append('rect')
      .attr('x', x1Scale('visibility') || 0)
      .attr('width', x1Scale.bandwidth())
      .attr('y', height)
      .attr('height', 0)
      .attr('rx', 3)
      .attr('fill', 'url(#visibilityGrad)')
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => {
        this.hoveredInfo.set({
          title: `${d.timeLabel} Visibility: ${d.visibility} km`,
          description: `Atmospheric transmittance range at ${d.timeLabel}`
        });
      })
      .on('mouseleave', () => this.hoveredInfo.set(null))
      .transition()
      .duration(450)
      .delay((_d, i) => i * 40 + 20)
      .attr('y', d => yScale(Math.min(100, (d.visibility / 10) * 100)))
      .attr('height', d => height - yScale(Math.min(100, (d.visibility / 10) * 100)));

    // X Axis
    const xAxis = d3.axisBottom(x0Scale);
    group.append('g')
      .attr('transform', `translate(0, ${height})`)
      .call(xAxis)
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '8px')
      .attr('font-family', 'monospace')
      .attr('dy', '10px');

    group.selectAll('.domain, .tick line').attr('stroke', 'rgba(255,255,255,0.1)');
  }
}
