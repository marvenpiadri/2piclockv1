import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Output, ViewChild, inject, PLATFORM_ID, AfterViewInit, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../../core/services/location.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { WeatherService } from '../../../core/services/weather.service';
import { CelestialService } from '../../../core/services/celestial.service';
import { calculateSolarPosition } from '../../../core/astronomy/astronomy-engine';

@Component({
  selector: 'app-share-export-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="share-backdrop" (click)="dismissModal.emit()">
      <section class="share-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Share your 2piClock">
        <button class="close" type="button" (click)="dismissModal.emit()" aria-label="Close"><mat-icon>close</mat-icon></button>
        <div class="heading">
          <span class="eyebrow">SHARE YOUR SKY</span>
          <h2>Create a 2piClock picture</h2>
          <p>Save a polished snapshot of this place, time, weather and sky. It is designed to look good when shared online.</p>
        </div>

        <div class="canvas-frame">
          <canvas #exportCanvas></canvas>
        </div>

        <div class="actions">
          <button type="button" class="secondary" (click)="copySkyLink()">
            <mat-icon>{{ linkCopied() ? 'check' : 'link' }}</mat-icon>
            {{ linkCopied() ? 'Link copied' : 'Copy sky link' }}
          </button>
          <button type="button" class="secondary" (click)="dismissModal.emit()">Close</button>
          <button type="button" class="primary" (click)="shareOrDownload()">
            <mat-icon>{{ canShare() ? 'ios_share' : 'download' }}</mat-icon>
            {{ canShare() ? 'Share picture' : 'Save picture' }}
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .share-backdrop { position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(2,6,15,.58); backdrop-filter:blur(14px); }
    .share-modal { width:min(760px,100%); max-height:calc(100vh - 32px); overflow:auto; position:relative; padding:22px; border:1px solid rgba(255,255,255,.18); border-radius:22px; background:rgba(10,16,27,.72); backdrop-filter:blur(28px); box-shadow:0 30px 90px rgba(0,0,0,.3); color:#fff; }
    .close { position:absolute; top:14px; right:14px; width:32px; height:32px; display:grid; place-items:center; border:0; border-radius:50%; background:rgba(255,255,255,.08); color:rgba(255,255,255,.7); cursor:pointer; }
    .close mat-icon { font-size:17px; width:17px; height:17px; }
    .heading { padding-right:42px; margin-bottom:16px; }
    .eyebrow { color:#f59e0b; font:700 9px ui-monospace,monospace; letter-spacing:.16em; }
    h2 { margin:6px 0 6px; font:700 24px/1.1 system-ui,sans-serif; letter-spacing:-.035em; }
    p { margin:0; color:rgba(255,255,255,.58); font-size:11px; line-height:1.5; }
    .canvas-frame { width:min(100%,680px); margin:0 auto; aspect-ratio:1200/760; border-radius:16px; overflow:hidden; background:#0b1220; border:1px solid rgba(255,255,255,.12); box-shadow:0 18px 55px rgba(0,0,0,.22); }
    canvas { display:block; width:100%; height:100%; }
    .actions { display:flex; justify-content:flex-end; gap:8px; margin-top:15px; }
    .actions button { height:38px; border-radius:10px; padding:0 13px; display:flex; align-items:center; gap:7px; border:1px solid rgba(255,255,255,.12); font:700 10px ui-monospace,monospace; cursor:pointer; }
    .actions mat-icon { font-size:16px; width:16px; height:16px; }
    .secondary { background:rgba(255,255,255,.06); color:rgba(255,255,255,.72); }
    .primary { background:#f59e0b; color:#251300; border-color:#f59e0b!important; }
    @media(max-width:520px){ .share-modal{padding:16px;border-radius:18px}.heading{margin-bottom:12px}.actions button{flex:1;justify-content:center} }
  `]
})
export class ShareExportModalComponent implements AfterViewInit {
  @Output() dismissModal = new EventEmitter<void>();
  @ViewChild('exportCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly locationService = inject(LocationService);
  private readonly timeControlService = inject(TimeControlService);
  private readonly weatherService = inject(WeatherService);
  private readonly celestialService = inject(CelestialService);
  readonly linkCopied = signal(false);

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) setTimeout(() => this.renderExportCard(), 30);
  }


  private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  private drawMetric(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number): void {
    ctx.fillStyle = 'rgba(148,163,184,.72)';
    ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(label, x, y);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 23px system-ui, -apple-system, sans-serif';
    ctx.fillText(value, x, y + 31);
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 52);
    ctx.lineTo(x + width, y + 52);
    ctx.stroke();
  }

  renderExportCard(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Compact landscape business-card format: information first, no analog clock, no slogans.
    const w = 1200;
    const h = 760;
    canvas.width = w;
    canvas.height = h;

    const loc = this.locationService.selectedLocation();
    const date = this.timeControlService.currentActiveDate();
    const weather = this.weatherService.currentWeather();
    const celestial = this.celestialService.celestialState();
    const sun = calculateSolarPosition(date, loc.latitude, loc.longitude);
    const moon = celestial.moon;

    // Solid DooMath-like dark foundation with a restrained 2pi amber accent.
    ctx.fillStyle = '#111827';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#0f172a';
    this.roundedRect(ctx, 24, 24, w - 48, h - 48, 28);
    ctx.fill();

    const glow = ctx.createRadialGradient(1010, 80, 10, 1010, 80, 360);
    glow.addColorStop(0, sun.altitudeDeg >= 0 ? 'rgba(245,158,11,.16)' : 'rgba(148,163,184,.11)');
    glow.addColorStop(1, 'rgba(15,23,42,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(24, 24, w - 48, h - 48);

    ctx.strokeStyle = 'rgba(245,158,11,.28)';
    ctx.lineWidth = 2;
    this.roundedRect(ctx, 24, 24, w - 48, h - 48, 28);
    ctx.stroke();

    // Location header with the real country flag.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '34px "Apple Color Emoji","Segoe UI Emoji",sans-serif';
    ctx.fillText(loc.flag, 62, 93);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 34px system-ui, -apple-system, sans-serif';
    ctx.fillText(loc.name, 112, 91);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 15px system-ui, -apple-system, sans-serif';
    ctx.fillText(loc.country + ' · ' + loc.timezone, 114, 118);

    const timeStr = date.toLocaleTimeString('en-US', { timeZone: loc.timezone, hour: '2-digit', minute: '2-digit', hour12: false });
    const dateStr = date.toLocaleDateString('en-US', { timeZone: loc.timezone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 32px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(timeStr, 1138, 91);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(dateStr, 1138, 117);

    // Weather headline.
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('CURRENT WEATHER', 62, 176);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 68px system-ui, -apple-system, sans-serif';
    ctx.fillText(Math.round(weather.temperatureC) + '°', 62, 244);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 22px system-ui, -apple-system, sans-serif';
    ctx.fillText(weather.conditionLabel, 215, 239);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      Math.round(weather.feelsLikeC) + '°C feels like · ' + weather.precipitationPct + '% rain · ' + weather.visibilityKm.toFixed(1) + ' km visibility',
      215,
      264
    );

    const weatherY = 310;
    const colW = 245;
    this.drawMetric(ctx, 'HUMIDITY', weather.humidityPct + '%', 62, weatherY, colW - 25);
    this.drawMetric(ctx, 'WIND', Math.round(weather.windSpeedKmh) + ' km/h', 62 + colW, weatherY, colW - 25);
    this.drawMetric(ctx, 'CLOUD COVER', weather.cloudCoverPct + '%', 62 + colW * 2, weatherY, colW - 25);
    this.drawMetric(ctx, 'UV INDEX', weather.uvIndex.toFixed(1), 62 + colW * 3, weatherY, colW - 25);

    // Sun + Moon: the two most important astronomical facts.
    const sectionY = 420;
    ctx.fillStyle = 'rgba(255,255,255,.055)';
    this.roundedRect(ctx, 62, sectionY, 1076, 190, 20);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('SUN', 88, sectionY + 35);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 21px system-ui, -apple-system, sans-serif';
    ctx.fillText(sun.altitudeDeg.toFixed(1) + '° altitude · ' + sun.azimuthDeg.toFixed(0) + '° azimuth', 88, sectionY + 68);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      'Sunrise ' + this.formatEvent(celestial.solarEvents?.sunrise ?? null, loc.timezone) +
      '  ·  Sunset ' + this.formatEvent(celestial.solarEvents?.sunset ?? null, loc.timezone),
      88,
      sectionY + 96
    );

    ctx.strokeStyle = 'rgba(255,255,255,.09)';
    ctx.beginPath();
    ctx.moveTo(600, sectionY + 28);
    ctx.lineTo(600, sectionY + 160);
    ctx.stroke();

    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('MOON', 636, sectionY + 35);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '600 21px system-ui, -apple-system, sans-serif';
    ctx.fillText(moon.phaseName + ' · ' + Math.round(moon.illuminationFraction * 100) + '% illuminated', 636, sectionY + 68);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      moon.altitudeDeg.toFixed(1) + '° altitude · ' + moon.azimuthDeg.toFixed(0) + '° azimuth · ' +
      Math.round(moon.distanceKm).toLocaleString() + ' km',
      636,
      sectionY + 96
    );

    // Minimal footer: domain only, no marketing slogan.
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(148,163,184,.72)';
    ctx.font = '500 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('Local sky conditions · astronomical calculations', 62, 690);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 16px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('2piclock.com', 1138, 690);
  }

  async copySkyLink(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const location = this.locationService.selectedLocation();
    const instant = this.timeControlService.currentActiveDate().toISOString();
    const pathname = window.location.pathname;
    const experience = pathname === '/weather' ? 'weather' : pathname === '/tonight' ? 'tonight' : 'time';
    const path = pathname.startsWith('/' + location.id) ? pathname : '/' + location.id + '/' + experience;
    const url = window.location.origin + path + '?at=' + encodeURIComponent(instant);

    try {
      await navigator.clipboard.writeText(url);
      this.linkCopied.set(true);
      window.setTimeout(() => this.linkCopied.set(false), 2200);
    } catch {
      // Clipboard access can be blocked; the picture share/download remains available.
    }
  }

  canShare(): boolean {
    return isPlatformBrowser(this.platformId) && typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  }

  async shareOrDownload(): Promise<void> {
    if(!isPlatformBrowser(this.platformId)) return;
    const canvas=this.canvasRef.nativeElement;
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/png',1));
    if(!blob) return;
    const loc=this.locationService.selectedLocation();
    const file=new File([blob],`2piclock-${loc.id}.png`,{type:'image/png'});
    if(this.canShare() && typeof navigator.canShare === 'function' && navigator.canShare({files:[file]})){
      try { await navigator.share({title:`2piClock · ${loc.name}`,text:`Live sky snapshot from 2piClock.com · ${loc.name}`,files:[file]}); return; } catch { /* user cancelled or browser declined */ }
    }
    const link=document.createElement('a');link.download=`2piclock-${loc.id}.png`;link.href=canvas.toDataURL('image/png');link.click();
  }
}
