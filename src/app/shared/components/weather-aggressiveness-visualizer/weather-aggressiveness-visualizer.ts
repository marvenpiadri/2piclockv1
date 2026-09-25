import { 
  ChangeDetectionStrategy, 
  Component, 
  ElementRef, 
  inject, 
  OnDestroy, 
  OnInit, 
  signal, 
  viewChild 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WeatherService } from '../../../core/services/weather.service';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  length?: number;
  rotation?: number;
  spinSpeed?: number;
}

@Component({
  selector: 'app-weather-aggressiveness-visualizer',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="aggressiveness-visualizer-card w-full rounded-3xl bg-slate-950/90 border border-white/15 backdrop-blur-2xl shadow-2xl p-4 sm:p-6 text-slate-100 flex flex-col gap-6 relative overflow-hidden select-none">
      
      <!-- Top Title & Severity Badge Row -->
      <div class="flex items-center justify-between flex-wrap gap-3 z-10">
        <div class="flex items-center gap-3">
          <div 
            class="w-12 h-12 rounded-2xl flex items-center justify-center font-bold border transition-all duration-300"
            [ngClass]="getSeverityBgClass(weather().aggressivenessIndex)">
            <mat-icon class="text-2xl">{{ getSeverityIcon(weather().condition) }}</mat-icon>
          </div>

          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <h2 class="text-base sm:text-lg font-extrabold text-white tracking-tight leading-tight">
                Weather Aggressiveness Dynamics
              </h2>
              <span class="text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold uppercase tracking-wider"
                [ngClass]="getSeverityBadgeClass(weather().aggressivenessIndex)">
                {{ weather().aggressivenessLabel }}
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              Live Particle Canvas Physics & Multi-Factor Troposphere Intensity Breakdown
            </p>
          </div>
        </div>

        <!-- Overall Score Ring Badge -->
        <div class="flex items-center gap-3 bg-white/[0.04] p-2.5 px-4 rounded-2xl border border-white/10">
          <div class="flex flex-col text-right">
            <span class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Aggressiveness Score</span>
            <span class="text-2xl font-extrabold font-mono tracking-tight" [ngClass]="getSeverityTextClass(weather().aggressivenessIndex)">
              {{ weather().aggressivenessIndex }}<span class="text-xs text-slate-400 font-normal">/100</span>
            </span>
          </div>

          <div class="w-10 h-10 rounded-full border-4 flex items-center justify-center font-mono font-bold text-xs"
            [style.borderColor]="getSeverityColorHex(weather().aggressivenessIndex)">
            {{ weather().aggressivenessIndex }}%
          </div>
        </div>
      </div>

      <!-- Main Canvas Particle Simulation Stage -->
      <div class="relative w-full h-64 sm:h-72 rounded-2xl overflow-hidden border border-white/15 bg-slate-900/80 shadow-inner group">
        
        <!-- HTML5 Animated Physics Canvas -->
        <canvas #particleCanvas class="w-full h-full block absolute inset-0"></canvas>

        <!-- Dynamic Frost Vignette Effect overlay when Frost Level > 0 -->
        @if (weather().winterFrostLevel && weather().winterFrostLevel! > 0) {
          <div 
            class="frost-vignette pointer-events-none absolute inset-0 transition-opacity duration-500"
            [style.opacity]="(weather().winterFrostLevel! / 100) * 0.85">
          </div>
        }

        <!-- Canvas HUD Overlay Stats -->
        <div class="absolute top-3 left-3 flex items-center gap-2 pointer-events-none z-10">
          <div class="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/80 border border-white/10 text-[11px] font-mono font-semibold text-slate-200 backdrop-blur-md">
            <span class="w-2 h-2 rounded-full animate-ping" [style.backgroundColor]="getSeverityColorHex(weather().aggressivenessIndex)"></span>
            <span>SIMULATING: {{ weather().conditionLabel }}</span>
          </div>

          @if (weather().aggressivenessIndex >= 70) {
            <div class="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-[10px] font-mono font-bold text-rose-300 animate-pulse backdrop-blur-md">
              <mat-icon class="text-xs">warning</mat-icon>
              <span>HIGH TURBULENCE</span>
            </div>
          }
        </div>

        <div class="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-none z-10">
          <div class="px-2.5 py-1 rounded-xl bg-slate-950/80 border border-white/10 text-[10px] font-mono text-amber-300 backdrop-blur-md">
            Particle Count: {{ activeParticleCount() }}
          </div>
        </div>
      </div>

      <!-- Color-Coded Multi-Factor Weather Intensity Bars -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 z-10">
        
        <!-- Bar 1: Precipitation Load -->
        <div class="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-1.5 text-slate-300 font-semibold">
              <mat-icon class="text-sky-400 text-sm">water_drop</mat-icon>
              <span>Precipitation</span>
            </span>
            <span class="font-mono font-bold text-sky-300">{{ weather().precipitationPct }}%</span>
          </div>

          <div class="w-full h-2.5 rounded-full bg-white/10 overflow-hidden relative">
            <div 
              class="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-sky-500 to-blue-400"
              [style.width.%]="weather().precipitationPct">
            </div>
          </div>
          <span class="text-[9px] font-mono text-slate-400 text-right">
            {{ weather().precipitationPct > 70 ? 'Torrential Downpour' : (weather().precipitationPct > 30 ? 'Moderate Rain' : 'Dry / Minimal') }}
          </span>
        </div>

        <!-- Bar 2: Storm Electrical Power -->
        <div class="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-1.5 text-slate-300 font-semibold">
              <mat-icon class="text-amber-400 text-sm">thunderstorm</mat-icon>
              <span>Electrical Activity</span>
            </span>
            <span class="font-mono font-bold text-amber-300">
              {{ weather().lightningFrequencyPerMin ? weather().lightningFrequencyPerMin + ' discharges/min' : '0/min' }}
            </span>
          </div>

          <div class="w-full h-2.5 rounded-full bg-white/10 overflow-hidden relative">
            <div 
              class="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 to-yellow-300"
              [style.width.%]="weather().condition === 'thunderstorm' ? 90 : (weather().aggressivenessIndex > 60 ? 45 : 5)">
            </div>
          </div>
          <span class="text-[9px] font-mono text-slate-400 text-right">
            {{ weather().condition === 'thunderstorm' ? 'Active Sheet Lightning' : 'Stable Ionosphere' }}
          </span>
        </div>

        <!-- Bar 3: Wind Shear & Gusts -->
        <div class="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-1.5 text-slate-300 font-semibold">
              <mat-icon class="text-cyan-400 text-sm">air</mat-icon>
              <span>Wind Shear</span>
            </span>
            <span class="font-mono font-bold text-cyan-300">{{ weather().windSpeedKmh }} km/h</span>
          </div>

          <div class="w-full h-2.5 rounded-full bg-white/10 overflow-hidden relative">
            <div 
              class="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-cyan-500 to-emerald-400"
              [style.width.%]="Math.min(100, (weather().windSpeedKmh / 100) * 100)">
            </div>
          </div>
          <span class="text-[9px] font-mono text-slate-400 text-right">
            Gusts: {{ weather().windGustKmh || weather().windSpeedKmh }} km/h
          </span>
        </div>

        <!-- Bar 4: Frost / Freeze Risk -->
        <div class="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs">
            <span class="flex items-center gap-1.5 text-slate-300 font-semibold">
              <mat-icon class="text-indigo-300 text-sm">ac_unit</mat-icon>
              <span>Frost & Freeze</span>
            </span>
            <span class="font-mono font-bold text-indigo-300">
              {{ weather().winterFrostLevel || 0 }}%
            </span>
          </div>

          <div class="w-full h-2.5 rounded-full bg-white/10 overflow-hidden relative">
            <div 
              class="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-purple-400"
              [style.width.%]="weather().winterFrostLevel || 0">
            </div>
          </div>
          <span class="text-[9px] font-mono text-slate-400 text-right">
            {{ (weather().winterFrostLevel || 0) > 50 ? 'Sub-Zero Icing Hazard' : 'No Freezing Threat' }}
          </span>
        </div>

      </div>

      <!-- Quick Aggressiveness Intensity Boost Controller -->
      <div class="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3 z-10">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <span class="text-xs font-bold text-white flex items-center gap-2 font-mono">
            <mat-icon class="text-amber-400 text-base">speed</mat-icon>
            <span>AGGRESSIVENESS INTENSITY PRESETS</span>
          </span>

          <div class="flex items-center gap-1.5 flex-wrap">
            <button 
              type="button" 
              (click)="setIntensityPreset('calm')"
              class="px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-emerald-500/20 hover:text-emerald-300 text-xs font-mono font-semibold border border-white/10 transition-all cursor-pointer">
              Calm (10%)
            </button>
            <button 
              type="button" 
              (click)="setIntensityPreset('active')"
              class="px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-sky-500/20 hover:text-sky-300 text-xs font-mono font-semibold border border-white/10 transition-all cursor-pointer">
              Active (45%)
            </button>
            <button 
              type="button" 
              (click)="setIntensityPreset('squall')"
              class="px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-amber-500/20 hover:text-amber-300 text-xs font-mono font-semibold border border-white/10 transition-all cursor-pointer">
              Squall (75%)
            </button>
            <button 
              type="button" 
              (click)="setIntensityPreset('typhoon')"
              class="px-2.5 py-1 rounded-xl bg-white/[0.06] hover:bg-rose-500/20 hover:text-rose-300 text-xs font-mono font-semibold border border-white/10 transition-all cursor-pointer">
              Typhoon (95%)
            </button>
          </div>
        </div>
      </div>

    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
    .frost-vignette {
      background: radial-gradient(circle, transparent 40%, rgba(186, 230, 253, 0.4) 80%, rgba(147, 197, 253, 0.8) 100%);
      box-shadow: inset 0 0 40px rgba(186, 230, 253, 0.6);
    }
  `]
})
export class WeatherAggressivenessVisualizerComponent implements OnInit, OnDestroy {
  private weatherService = inject(WeatherService);
  
  canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('particleCanvas');
  readonly Math = Math;

  readonly weather = this.weatherService.currentWeather;
  readonly activeParticleCount = signal<number>(0);

  private animFrameId: number | null = null;
  private particles: Particle[] = [];
  private lightningFlashAlpha = 0;

  ngOnInit(): void {
    setTimeout(() => {
      this.initCanvasLoop();
    }, 50);
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
  }

  setIntensityPreset(preset: 'calm' | 'active' | 'squall' | 'typhoon'): void {
    switch (preset) {
      case 'calm':
        this.weatherService.setOverride({ condition: 'clear', aggressivenessBoost: -30, windSpeedKmh: 8, precipitationPct: 0 });
        break;
      case 'active':
        this.weatherService.setOverride({ condition: 'rain', aggressivenessBoost: 10, windSpeedKmh: 28, precipitationPct: 50 });
        break;
      case 'squall':
        this.weatherService.setOverride({ condition: 'heavy_rain', aggressivenessBoost: 35, windSpeedKmh: 55, precipitationPct: 85 });
        break;
      case 'typhoon':
        this.weatherService.setOverride({ condition: 'thunderstorm', aggressivenessBoost: 55, windSpeedKmh: 95, precipitationPct: 100 });
        break;
    }
  }

  private initCanvasLoop(): void {
    const canvasEl = this.canvasRef()?.nativeElement;
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const rect = canvasEl.parentElement?.getBoundingClientRect();
      if (rect) {
        canvasEl.width = rect.width;
        canvasEl.height = rect.height;
      }
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      this.updateAndDrawParticles(ctx, canvasEl.width, canvasEl.height);
      this.animFrameId = requestAnimationFrame(render);
    };

    render();
  }

  private updateAndDrawParticles(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.clearRect(0, 0, width, height);

    const currentData = this.weather();
    const condition = currentData.condition;
    const aggIndex = currentData.aggressivenessIndex;
    const windSpeed = currentData.windSpeedKmh;

    // Target particle count based on condition and aggressiveness
    let targetCount = 30;
    if (condition === 'rain') targetCount = 120 + Math.round(aggIndex * 1.5);
    else if (condition === 'heavy_rain') targetCount = 280 + Math.round(aggIndex * 2.5);
    else if (condition === 'thunderstorm') targetCount = 350 + Math.round(aggIndex * 3);
    else if (condition === 'snow' || condition === 'blizzard') targetCount = 150 + Math.round(aggIndex * 2);
    else if (condition === 'fog') targetCount = 60;

    this.activeParticleCount.set(this.particles.length);

    // Adjust particle array length
    while (this.particles.length < targetCount) {
      this.particles.push(this.createParticle(width, height, condition, windSpeed));
    }
    if (this.particles.length > targetCount) {
      this.particles.length = targetCount;
    }

    // Render Lightning Flash in background if thunderstorm
    if (condition === 'thunderstorm') {
      if (Math.random() < 0.015 + (aggIndex / 2000)) {
        this.lightningFlashAlpha = 0.85;
      }
      if (this.lightningFlashAlpha > 0) {
        ctx.fillStyle = `rgba(254, 240, 138, ${this.lightningFlashAlpha})`;
        ctx.fillRect(0, 0, width, height);
        this.lightningFlashAlpha *= 0.88;
      }
    }

    // Render Particles
    for (const p of this.particles) {
      if (condition === 'rain' || condition === 'heavy_rain' || condition === 'thunderstorm') {
        // Rain streak
        p.y += p.vy;
        p.x += p.vx;

        ctx.strokeStyle = condition === 'thunderstorm' ? `rgba(254, 240, 138, ${p.alpha})` : `rgba(186, 230, 253, ${p.alpha})`;
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 2, p.y + (p.length || 12));
        ctx.stroke();

        // Respawn if off screen
        if (p.y > height || p.x > width || p.x < -20) {
          p.y = -20;
          p.x = Math.random() * (width + 40) - 20;
        }
      } else if (condition === 'snow' || condition === 'blizzard') {
        // Snowflake particle
        p.y += p.vy;
        p.x += Math.sin(p.y * 0.03) * 1.5 + p.vx;

        ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.y > height) {
          p.y = -10;
          p.x = Math.random() * width;
        }
      } else if (condition === 'fog') {
        // Soft rolling haze cloud
        p.x += p.vx;
        if (p.x > width + 50) p.x = -50;

        ctx.fillStyle = `rgba(226, 232, 240, ${p.alpha * 0.2})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Ambient solar dust motes
        p.y -= 0.3;
        p.x += Math.sin(p.y * 0.02) * 0.4;

        ctx.fillStyle = `rgba(251, 191, 36, ${p.alpha * 0.6})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
      }
    }
  }

  private createParticle(width: number, height: number, condition: string, windSpeed: number): Particle {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (windSpeed / 30) + Math.random() * 2,
      vy: condition === 'heavy_rain' ? 14 + Math.random() * 8 : (condition === 'rain' ? 8 + Math.random() * 5 : (condition === 'snow' ? 1.5 + Math.random() * 2 : 3)),
      size: condition === 'snow' ? 2 + Math.random() * 3 : (condition === 'fog' ? 15 + Math.random() * 25 : 1.2 + Math.random() * 1.5),
      alpha: 0.3 + Math.random() * 0.6,
      length: 10 + Math.random() * 18
    };
  }

  getSeverityBgClass(index: number): string {
    if (index >= 75) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (index >= 50) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (index >= 25) return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  }

  getSeverityBadgeClass(index: number): string {
    if (index >= 75) return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (index >= 50) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (index >= 25) return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  }

  getSeverityTextClass(index: number): string {
    if (index >= 75) return 'text-rose-400';
    if (index >= 50) return 'text-amber-400';
    if (index >= 25) return 'text-sky-400';
    return 'text-emerald-400';
  }

  getSeverityColorHex(index: number): string {
    if (index >= 75) return '#f43f5e';
    if (index >= 50) return '#f59e0b';
    if (index >= 25) return '#38bdf8';
    return '#34d399';
  }

  getSeverityIcon(condition: string): string {
    switch (condition) {
      case 'rain': return 'grain';
      case 'heavy_rain': return 'thunderstorm';
      case 'thunderstorm': return 'bolt';
      case 'snow': return 'ac_unit';
      case 'blizzard': return 'ac_unit';
      case 'fog': return 'blur_on';
      default: return 'wb_sunny';
    }
  }
}
