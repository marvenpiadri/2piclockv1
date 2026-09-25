import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  ViewChild,
  inject,
  PLATFORM_ID,
  effect
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { calculateSubsolarPoint } from '../../../core/astronomy/astronomy-engine';
import { LocationService } from '../../../core/services/location.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { GeoLocation } from '../../../core/models/location.model';

interface RibbonCity {
  location: GeoLocation;
  name: string;
  flag: string;
  normX: number; // [0, 1] normalized x along longitude
  normY: number; // [0, 1] normalized y along latitude
  tier: number;
}

@Component({
  selector: 'app-terminator-ribbon',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="terminator-container glass-panel">
      <div class="terminator-header flex justify-between items-center mb-2">
        <span class="font-mono text-xs text-amber-400 tracking-widest uppercase flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          Dynamic Terminator Line World Ribbon
        </span>
        <span class="font-mono text-xs text-slate-400">{{ currentDateString }}</span>
      </div>
      <div 
        class="canvas-wrapper relative w-full h-24 overflow-hidden rounded-xl border border-amber-500/20 bg-slate-950/80 cursor-pointer shadow-inner" 
        (click)="onRibbonClick($event)" 
        title="Click ribbon to jump to closest planetary meridian">
        <canvas #ribbonCanvas class="w-full h-full block"></canvas>
      </div>
    </div>
  `,
  styles: [`
    .terminator-container {
      padding: 1.25rem;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(245, 158, 11, 0.25);
      border-radius: 1rem;
    }
  `]
})
export class TerminatorRibbonComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('ribbonCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() activeDate?: Date;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly locationService = inject(LocationService);
  private readonly timeControlService = inject(TimeControlService);

  private renderPending = false;
  private animFrameId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Pre-calculated static city projections (Data calculation separation)
  private precalculatedCities: RibbonCity[] = [];
  private cachedSubsolar: { latitude: number; longitude: number } | null = null;
  private lastSubsolarDateMs = 0;

  get currentDate(): Date {
    return this.activeDate ?? this.timeControlService.currentActiveDate();
  }

  get currentDateString(): string {
    return this.currentDate.toUTCString().slice(0, 22);
  }

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      // Reactively schedule a redraw frame when active date updates
      effect(() => {
        // Track the current date signal
        this.timeControlService.currentActiveDate();
        this.scheduleRender();
      });
    }
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.initCityProjections();
      this.initResizeObserver();
      this.scheduleRender();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeDate']) {
      this.scheduleRender();
    }
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  /**
   * Pre-calculates normalized coordinates for all cities once
   */
  private initCityProjections(): void {
    const presets = this.locationService.allPresets;
    this.precalculatedCities = presets.map(city => ({
      location: city,
      name: city.name,
      flag: city.flag,
      normX: (city.longitude + 180) / 360,
      normY: 0.5 - (city.latitude / 90) * 0.35,
      tier: city.tier ?? 2
    }));
  }

  private initResizeObserver(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      this.scheduleRender();
    });
    this.resizeObserver.observe(canvas);
  }

  /**
   * Schedules a single, debounced render frame (Visual rendering separation)
   */
  private scheduleRender(): void {
    if (this.renderPending || !isPlatformBrowser(this.platformId)) return;
    this.renderPending = true;

    this.animFrameId = requestAnimationFrame(() => {
      this.renderPending = false;
      this.animFrameId = null;
      this.drawRibbon();
    });
  }

  private drawRibbon(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(rect.width * dpr);
    const h = Math.round(rect.height * dpr);

    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    if (w === 0 || h === 0) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    // 1. DATA CALCULATION: Subsolar point calculation (throttled / memoized)
    const date = this.currentDate;
    const dateMs = date.getTime();
    if (!this.cachedSubsolar || Math.abs(dateMs - this.lastSubsolarDateMs) >= 1000) {
      this.cachedSubsolar = calculateSubsolarPoint(date);
      this.lastSubsolarDateMs = dateMs;
    }
    const subsolar = this.cachedSubsolar;
    const subsolarX = ((subsolar.longitude + 180) / 360) * width;

    // 2. BACKGROUND: Longitudinal day/night gradient
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    const steps = 18; // Reduced stop count from 25 to 18 for faster GPU upload
    for (let i = 0; i <= steps; i++) {
      const stopPos = i / steps;
      const lng = stopPos * 360 - 180;
      let diff = Math.abs(lng - subsolar.longitude);
      if (diff > 180) diff = 360 - diff;

      let alpha = 0.85;
      let r = 2, g = 6, b = 23;

      if (diff < 80) {
        r = 14; g = 116; b = 144;
        alpha = 0.4 + (1 - diff / 80) * 0.4;
      } else if (diff >= 80 && diff <= 100) {
        r = 245; g = 158; b = 11;
        alpha = 0.8;
      }

      grad.addColorStop(stopPos, `rgba(${r}, ${g}, ${b}, ${alpha})`);
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 3. EQUATOR LINE
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. SUBSOLAR MARKER
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(subsolarX, height / 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 5. CITIES: Render dots in a single batch
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (const city of this.precalculatedCities) {
      const cx = city.normX * width;
      const cy = city.normY * height;
      ctx.moveTo(cx + 2, cy);
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    }
    ctx.fill();

    // 6. LABELS: Only render labels for major global hubs with collision spacing
    ctx.fillStyle = 'rgba(245, 158, 11, 0.95)';
    ctx.font = '9px monospace';
    const minLabelSpacingPx = 64;
    let lastLabeledX = -minLabelSpacingPx;

    // Sort tier 1 cities by longitude so spatial spacing works cleanly
    const tier1Cities = this.precalculatedCities
      .filter(c => c.tier === 1)
      .sort((a, b) => a.normX - b.normX);

    for (const city of tier1Cities) {
      const cx = city.normX * width;
      const cy = city.normY * height;

      if (cx - lastLabeledX >= minLabelSpacingPx && cx < width - 50) {
        lastLabeledX = cx;
        ctx.fillText(`${city.flag} ${city.name.slice(0, 8)}`, cx + 4, cy + 3);
      }
    }

    // 7. TELEMETRY BADGE
    ctx.fillStyle = 'rgba(251, 191, 36, 0.95)';
    ctx.font = '10px monospace';
    const latStr = subsolar.latitude >= 0 ? `${subsolar.latitude.toFixed(1)}°N` : `${(-subsolar.latitude).toFixed(1)}°S`;
    const lngStr = subsolar.longitude >= 0 ? `${subsolar.longitude.toFixed(1)}°E` : `${(-subsolar.longitude).toFixed(1)}°W`;
    ctx.fillText(`☉ Subsolar Zenith: Lat ${latStr} | Lng ${lngStr}`, 12, 18);

    ctx.restore();
  }

  onRibbonClick(event: MouseEvent): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const ratio = x / rect.width;
    const clickedLng = ratio * 360 - 180;
    const presets = this.locationService.allPresets;

    let closest = presets[0];
    let minDiff = 360;
    for (const p of presets) {
      const diff = Math.abs(p.longitude - clickedLng);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }

    if (closest) {
      this.locationService.selectLocation(closest);
    }
  }
}
