import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Output, ViewChild, inject, PLATFORM_ID, AfterViewInit, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../../core/services/location.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { WeatherService } from '../../../core/services/weather.service';
import { CelestialService } from '../../../core/services/celestial.service';
import { calculateSolarPosition } from '../../../core/astronomy/astronomy-engine';
const METEOCONS_CDN = 'https://cdn.jsdelivr.net/npm/@meteocons/svg@0.1.0/fill';

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
          <button type="button" class="primary" (click)="downloadPng()">
            <mat-icon>download</mat-icon>
            Download PNG
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .share-backdrop { position:fixed; inset:0; z-index:100; display:flex; align-items:center; justify-content:center; padding:16px; background:rgba(2,6,15,.58); backdrop-filter:blur(14px); }
    .share-modal { width:min(760px,100%); max-height:calc(100vh - 32px); overflow:auto; position:relative; padding:var(--space-6); border:1px solid var(--color-border); border-radius:var(--radius-2xl); background:var(--color-surface-modal); box-shadow:var(--shadow-modal); color:var(--color-text-main); }
    .close { position:absolute; top:var(--space-3); right:var(--space-3); width:32px; height:32px; display:grid; place-items:center; border:0; border-radius:var(--radius-full); background:var(--color-surface-hover); color:var(--color-text-muted); cursor:pointer; }
    .close mat-icon { font-size:17px; width:17px; height:17px; }
    .heading { padding-right:42px; margin-bottom:var(--space-4); }
    .eyebrow { color:var(--color-math-orange); font:700 var(--text-xs) var(--font-mono); letter-spacing:.16em; }
    h2 { margin:var(--space-1) 0 var(--space-1); font:700 var(--text-2xl)/1.1 var(--font-sans); letter-spacing:-.035em; }
    p { margin:0; color:var(--color-text-muted); font-size:var(--text-xs); line-height:1.5; }
    .canvas-frame { width:100%; margin:0; aspect-ratio:1200/760; overflow:hidden; background:var(--color-midnight-900); border:0; border-radius:0; box-shadow:none; padding:0; }
    canvas { display:block; width:100%; height:100%; }
    .actions { display:flex; justify-content:flex-end; gap:var(--space-2); margin-top:var(--space-3); }
    .actions button { height:38px; border-radius:var(--radius-md); padding:0 var(--space-3); display:flex; align-items:center; gap:var(--space-1); border:1px solid var(--color-border); font:700 var(--text-xs) var(--font-mono); cursor:pointer; }
    .actions mat-icon { font-size:16px; width:16px; height:16px; }
    .secondary { background:var(--color-surface-hover); color:var(--color-text-secondary); }
    .primary { background:var(--color-math-orange); color:var(--color-text-inverse); border-color:var(--color-math-orange)!important; }
    @media(max-width:520px){ .share-modal{padding:var(--space-4);border-radius:var(--radius-xl)}.heading{margin-bottom:var(--space-3)}.actions button{flex:1;justify-content:center} }
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

  private formatEvent(date: Date | null, timezone: string): string {
    if (!date) return '—';
    return date.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private weatherIconUrl(condition: string, isDay: boolean): string {
    const key = condition.toLowerCase();
    let slug = isDay ? 'partly-cloudy-day' : 'partly-cloudy-night';
    if (key === 'clear') slug = isDay ? 'clear-day' : 'clear-night';
    else if (key === 'partly_cloudy') slug = isDay ? 'partly-cloudy-day' : 'partly-cloudy-night';
    else if (key === 'overcast') slug = 'overcast';
    else if (key === 'fog') slug = 'fog';
    else if (key === 'drizzle') slug = 'drizzle';
    else if (key === 'rain' || key === 'heavy_rain' || key === 'freezing_rain') slug = 'rain';
    else if (key === 'snow' || key === 'heavy_snow' || key === 'blizzard') slug = 'snow';
    else if (key === 'thunderstorm' || key === 'severe_thunderstorm') slug = 'thunderstorms-day-rain';
    return `/api/v1/assets/meteocon/${slug}`;
  }

  private loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      if (crossOrigin) image.crossOrigin = 'anonymous';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image failed to load'));
      image.src = src;
    });
  }

  private async drawWeatherIcon(
    ctx: CanvasRenderingContext2D,
    condition: string,
    isDay: boolean,
    x: number,
    y: number,
    size: number
  ): Promise<void> {
    try {
      const image = await this.loadImage(this.weatherIconUrl(condition, isDay));
      ctx.drawImage(image, x, y, size, size);
    } catch {
      // Keep export generation resilient if an icon asset cannot be decoded.
    }
  }

  private async drawCountryFlag(
    ctx: CanvasRenderingContext2D,
    countryCode: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<void> {
    const code = countryCode.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) return;
    try {
      const image = await this.loadImage(`/api/v1/assets/flag/${code}`);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, 5);
      ctx.clip();
      ctx.drawImage(image, x, y, width, height);
      ctx.restore();
    } catch {
      // Do not replace the export with an emoji if the real flag cannot load.
    }
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

  async renderExportCard(): Promise<void> {
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

    // Theme-native export: midnight-blue canvas with an amber atmospheric glow.
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#07111f');
    bg.addColorStop(0.52, '#0b1729');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const glow = ctx.createRadialGradient(1010, 80, 10, 1010, 80, 360);
    glow.addColorStop(0, sun.altitudeDeg >= 0 ? 'rgba(249,115,22,.16)' : 'rgba(148,163,184,.11)');
    glow.addColorStop(1, 'rgba(13,17,23,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // Location header with the same real country flag source used by the app.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    await this.drawCountryFlag(ctx, loc.countryCode, 62, 66, 38, 25);
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

    ctx.fillStyle = 'rgba(251,191,36,.12)';
    ctx.beginPath();
    ctx.arc(1035, 226, 82, 0, Math.PI * 2);
    ctx.fill();
    await this.drawWeatherIcon(ctx, weather.condition, weather.isDay, 975, 170, 120);



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
    const locationPath = this.locationService.getLocationSlug(location);
    const path = pathname.startsWith('/' + locationPath) ? pathname : '/' + locationPath + '/' + experience;
    const url = window.location.origin + path + '?at=' + encodeURIComponent(instant);

    try {
      await navigator.clipboard.writeText(url);
      this.linkCopied.set(true);
      window.setTimeout(() => this.linkCopied.set(false), 2200);
    } catch {
      // Clipboard access can be blocked; the picture share/download remains available.
    }
  }

  downloadPng(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const canvas = this.canvasRef.nativeElement;
    const loc = this.locationService.selectedLocation();
    const link = document.createElement('a');
    link.download = `2piclock-${this.locationService.getLocationSlug(loc).replace('/', '-')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }
}
