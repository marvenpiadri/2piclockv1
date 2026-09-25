import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Output, ViewChild, inject, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../../core/services/location.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { WeatherService } from '../../../core/services/weather.service';
import { calculateSolarPosition } from '../../../core/astronomy/astronomy-engine';

@Component({
  selector: 'app-share-export-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div class="glass-panel w-full max-w-2xl bg-slate-950/90 border border-amber-500/30 rounded-2xl p-6 shadow-2xl relative">
        
        <button (click)="dismissModal.emit()" class="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
          <mat-icon>close</mat-icon>
        </button>

        <div class="mb-4">
          <h2 class="font-mono text-lg font-bold text-amber-400 flex items-center gap-2">
            <mat-icon class="text-amber-500">camera_alt</mat-icon>
            One-Tap Atmospheric Infographic Exporter
          </h2>
          <p class="text-xs text-slate-400">Generate and download a high-res preview card capturing your live amber sky state & world times.</p>
        </div>

        <!-- Canvas Preview Card -->
        <div class="relative w-full aspect-[16/9] rounded-xl overflow-hidden border border-amber-500/30 shadow-2xl mb-5 bg-slate-900">
          <canvas #exportCanvas class="w-full h-full block"></canvas>
        </div>

        <!-- Action Buttons -->
        <div class="flex justify-end gap-3">
          <button (click)="dismissModal.emit()" class="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-mono text-xs hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button (click)="downloadCard()" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-mono text-xs font-bold flex items-center gap-2 shadow-lg shadow-amber-500/25 transition-all">
            <mat-icon class="text-sm">download</mat-icon>
            Download Amber Infographic (PNG)
          </button>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .animate-fadeIn {
      animation: fadeIn 0.2s ease-out forwards;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})
export class ShareExportModalComponent implements AfterViewInit {
  @Output() dismissModal = new EventEmitter<void>();
  @ViewChild('exportCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  private locationService = inject(LocationService);
  private timeControlService = inject(TimeControlService);
  private weatherService = inject(WeatherService);

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.renderExportCard(), 50);
    }
  }

  renderExportCard(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = 1200;
    const h = 675;
    canvas.width = w;
    canvas.height = h;

    const loc = this.locationService.selectedLocation();
    const date = this.timeControlService.currentActiveDate();
    const weather = this.weatherService.currentWeather();
    const sun = calculateSolarPosition(date, loc.latitude, loc.longitude);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (sun.altitudeDeg > 6) {
      bgGrad.addColorStop(0, '#0369a1');
      bgGrad.addColorStop(0.6, '#0284c7');
      bgGrad.addColorStop(1, '#0f172a');
    } else if (sun.altitudeDeg > 0) {
      bgGrad.addColorStop(0, '#7c2d12');
      bgGrad.addColorStop(0.5, '#b45309');
      bgGrad.addColorStop(1, '#1e1b4b');
    } else {
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(0.6, '#090d16');
      bgGrad.addColorStop(1, '#020617');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(w - 180, h / 2, 220, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w - 180, h / 2, 140, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('2πclock.com', 64, 75);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px monospace';
    ctx.fillText('THE AMBER SIMULATION SUITE', 64, 105);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(64, 140, 650, 430, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px monospace';
    ctx.fillText(`${loc.flag} ${loc.name}`, 104, 205);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '20px monospace';
    ctx.fillText(`${loc.country} • Lat ${loc.latitude.toFixed(1)}° Lng ${loc.longitude.toFixed(1)}°`, 104, 240);

    let timeStr = '12:00:00';
    let dateStr = 'Mon, Sep 22';
    try {
      timeStr = date.toLocaleTimeString('en-US', { timeZone: loc.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      dateStr = date.toLocaleDateString('en-US', { timeZone: loc.timezone, weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      // Fallback format if timezone fails
    }

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 64px monospace';
    ctx.fillText(timeStr, 104, 335);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px monospace';
    ctx.fillText(dateStr, 104, 375);

    ctx.fillStyle = 'rgba(30, 41, 59, 0.7)';
    ctx.beginPath();
    ctx.roundRect(104, 415, 570, 115, 16);
    ctx.fill();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '16px monospace';
    ctx.fillText(`🌡️ Temp: ${weather.temperatureC}°C`, 130, 455);
    ctx.fillText(`💨 Wind: ${weather.windSpeedKmh} km/h`, 360, 455);
    ctx.fillText(`☀️ Solar Elev: ${sun.altitudeDeg.toFixed(1)}°`, 130, 495);
    ctx.fillText(`☁️ Sky: ${weather.condition}`, 360, 495);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.beginPath();
    ctx.roundRect(740, 140, 396, 430, 24);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('GLOBAL OBSERVATORY', 780, 190);

    const presets = this.locationService.allPresets.slice(0, 4);
    let startY = 230;
    presets.forEach((p: any) => {
      let pTime = '';
      try {
        pTime = date.toLocaleTimeString('en-US', { timeZone: p.timezone, hour: '2-digit', minute: '2-digit', hour12: false });
      } catch {
        pTime = '12:00';
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(`${p.flag} ${p.name}`, 780, startY);

      ctx.fillStyle = '#fbbf24';
      ctx.font = '18px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(pTime, 1100, startY);
      ctx.textAlign = 'left';

      ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
      ctx.fillRect(780, startY + 15, 320, 1);

      startY += 85;
    });

    ctx.fillStyle = '#64748b';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Generated live via 2PiClock.com • The Amber Simulation Suite • Yadeus SARL Enterprise', w / 2, h - 30);
    ctx.textAlign = 'left';
  }

  downloadCard(): void {
    const canvas = this.canvasRef.nativeElement;
    const link = document.createElement('a');
    link.download = `2piclock-atmospheric-card-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
}
