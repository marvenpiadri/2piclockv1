import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Output, ViewChild, inject, PLATFORM_ID, AfterViewInit, signal, Input } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../../core/services/location.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { WeatherService } from '../../../core/services/weather.service';
import { CelestialService } from '../../../core/services/celestial.service';
import { getCelestialState } from '../../../core/astronomy/astronomy-engine';

export type ShareCardType = 'city' | 'tomorrow' | 'sleep';

export interface ShareSleepPlan {
  bedtime: Date;
  wakeTime: Date;
  sleepMinutes: number;
  cycles: number;
  inBedMinutes?: number;
}

@Component({
  selector: 'app-share-export-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="share-backdrop" (click)="dismissModal.emit()">
      <section class="share-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-label="Create a 2piClock share card">
        <button class="close" type="button" (click)="dismissModal.emit()" aria-label="Close"><mat-icon>close</mat-icon></button>

        <div class="heading">
          <span class="eyebrow">2π SHARE CARD</span>
          <h2>{{ cardTitle() }}</h2>
          <p>{{ cardDescription() }}</p>
        </div>

        @if (cardType === 'city') {
          <div class="share-tabs" role="tablist" aria-label="Share card type">
            <button type="button" [class.active]="activeCard() === 'city'" (click)="selectCard('city')">Now</button>
            <button type="button" [class.active]="activeCard() === 'tomorrow'" (click)="selectCard('tomorrow')">Tomorrow</button>
          </div>
        }

        <div class="canvas-frame">
          <canvas #exportCanvas></canvas>
        </div>

        <div class="actions">
          <button type="button" class="secondary" (click)="copySkyLink()">
            <mat-icon>{{ linkCopied() ? 'check' : 'link' }}</mat-icon>
            {{ linkCopied() ? 'Link copied' : 'Copy link' }}
          </button>
          <button type="button" class="primary" (click)="downloadPng()">
            <mat-icon>download</mat-icon>
            Download PNG
          </button>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .share-backdrop{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(2,6,15,.58);backdrop-filter:blur(14px)}
    .share-modal{width:min(760px,100%);max-height:calc(100vh - 32px);overflow:auto;position:relative;padding:24px;border:1px solid var(--color-border);border-radius:22px;background:var(--color-surface-modal);box-shadow:var(--shadow-modal);color:var(--color-text-main)}
    .close{position:absolute;top:12px;right:12px;width:32px;height:32px;display:grid;place-items:center;border:0;border-radius:50%;background:var(--color-surface-hover);color:var(--color-text-muted);cursor:pointer}
    .close mat-icon{font-size:17px;width:17px;height:17px}
    .heading{padding-right:42px;margin-bottom:14px}.eyebrow{color:var(--color-accent-strong);font:700 10px/1.4 var(--font-mono);letter-spacing:.16em}
    h2{margin:3px 0 4px;font:700 24px/1.1 var(--font-sans);letter-spacing:-.035em}p{margin:0;color:var(--color-text-muted);font-size:12px;line-height:1.5}
    .share-tabs{display:flex;gap:4px;width:max-content;padding:3px;margin:0 0 12px;border:1px solid var(--color-border);border-radius:10px;background:var(--color-surface-hover)}
    .share-tabs button{border:0;border-radius:7px;padding:7px 14px;background:transparent;color:var(--color-text-secondary);font:700 10px var(--font-mono);cursor:pointer}
    .share-tabs button.active{background:var(--color-amber-gradient);color:var(--color-text-on-accent)}
    .canvas-frame{width:100%;aspect-ratio:1200/760;overflow:hidden;background:var(--color-midnight-900);border:0;border-radius:14px}
    canvas{display:block;width:100%;height:100%}
    .actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.actions button{height:38px;border-radius:9px;padding:0 13px;display:flex;align-items:center;gap:6px;border:1px solid var(--color-border);font:700 10px var(--font-mono);cursor:pointer}
    .actions mat-icon{font-size:16px;width:16px;height:16px}.secondary{background:var(--color-surface-hover);color:var(--color-text-secondary)}.primary{background:var(--color-amber-gradient);color:var(--color-text-on-accent);border-color:transparent!important}
    @media(max-width:520px){.share-modal{padding:16px;border-radius:18px}.actions{flex-wrap:wrap}.actions button{flex:1;justify-content:center}}
  `]
})
export class ShareExportModalComponent implements AfterViewInit {
  @Input() cardType: ShareCardType = 'city';
  @Input() sleepPlan: ShareSleepPlan | null = null;
  @Output() dismissModal = new EventEmitter<void>();
  @ViewChild('exportCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly locationService = inject(LocationService);
  private readonly timeControlService = inject(TimeControlService);
  private readonly weatherService = inject(WeatherService);
  private readonly celestialService = inject(CelestialService);
  readonly linkCopied = signal(false);
  readonly activeCard = signal<'city' | 'tomorrow'>('city');

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) setTimeout(() => this.renderExportCard(), 30);
  }

  selectCard(type: 'city' | 'tomorrow'): void {
    this.activeCard.set(type);
    setTimeout(() => this.renderExportCard(), 0);
  }

  cardTitle(): string {
    if (this.cardType === 'sleep') return 'Your Night Plan';
    return this.activeCard() === 'tomorrow' ? 'Tomorrow' : 'Your City, Now';
  }

  cardDescription(): string {
    if (this.cardType === 'sleep') return 'A shareable sleep plan connected to your local night, sunrise and tomorrow morning.';
    return this.activeCard() === 'tomorrow'
      ? 'A compact forecast and daylight snapshot for the next local day.'
      : 'Save a polished snapshot of this place, time, weather and sky.';
  }

  private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
  }

  private formatEvent(date: Date | null, timezone: string): string {
    if (!date) return '—';
    return date.toLocaleTimeString('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false });
  }

  private formatDate(date: Date, timezone: string): string {
    return date.toLocaleDateString('en-US', { timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
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

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Image failed to load'));
      image.src = src;
    });
  }

  private async drawWeatherIcon(ctx: CanvasRenderingContext2D, condition: string, isDay: boolean, x: number, y: number, size: number): Promise<void> {
    try { const image = await this.loadImage(this.weatherIconUrl(condition, isDay)); ctx.drawImage(image, x, y, size, size); } catch { /* Ignore non-fatal export asset errors. */ }
  }

  private async drawCountryFlag(ctx: CanvasRenderingContext2D, countryCode: string, x: number, y: number, width: number, height: number): Promise<void> {
    const code = countryCode.trim().toLowerCase();
    if (!/^[a-z]{2}$/.test(code)) return;
    try {
      const image = await this.loadImage(`/api/v1/assets/flag/${code}`);
      ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, width, height, 5); ctx.clip(); ctx.drawImage(image, x, y, width, height); ctx.restore();
    } catch { /* Ignore non-fatal export asset errors. */ }
  }

  private drawMetric(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number, width: number): void {
    ctx.fillStyle='rgba(148,163,184,.72)'; ctx.font='700 12px ui-monospace,monospace'; ctx.fillText(label,x,y);
    ctx.fillStyle='#f8fafc'; ctx.font='600 23px system-ui,sans-serif'; ctx.fillText(value,x,y+31);
    ctx.strokeStyle='rgba(255,255,255,.07)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(x,y+52); ctx.lineTo(x+width,y+52); ctx.stroke();
  }

  private setupCanvas(): CanvasRenderingContext2D | null {
    const canvas=this.canvasRef.nativeElement; const ctx=canvas.getContext('2d'); if(!ctx)return null;
    canvas.width=1200; canvas.height=760;
    const bg=ctx.createLinearGradient(0,0,1200,760); bg.addColorStop(0,'#07111f'); bg.addColorStop(.52,'#0b1729'); bg.addColorStop(1,'#020617');
    ctx.fillStyle=bg; ctx.fillRect(0,0,1200,760);
    return ctx;
  }

  private async drawHeader(ctx: CanvasRenderingContext2D, label: string, date: Date, showTime = true): Promise<void> {
    const loc=this.locationService.selectedLocation();
    await this.drawCountryFlag(ctx,loc.countryCode,62,66,38,25);
    ctx.textAlign='left'; ctx.fillStyle='#f8fafc'; ctx.font='700 34px system-ui,sans-serif'; ctx.fillText(loc.name,112,91);
    ctx.fillStyle='#94a3b8'; ctx.font='500 15px system-ui,sans-serif'; ctx.fillText(loc.country+' · '+loc.timezone,114,118);
    ctx.fillStyle='#f59e0b'; ctx.font='700 11px ui-monospace,monospace'; ctx.fillText(label,62,160);
    ctx.textAlign='right'; ctx.fillStyle='#f8fafc'; ctx.font='700 30px ui-monospace,monospace';
    ctx.fillText(showTime ? date.toLocaleTimeString('en-US',{timeZone:loc.timezone,hour:'2-digit',minute:'2-digit',hour12:false}) : this.formatDate(date,loc.timezone),1138,91);
    ctx.fillStyle='#94a3b8'; ctx.font='500 13px ui-monospace,monospace'; ctx.fillText(this.formatDate(date,loc.timezone),1138,117);
    ctx.textAlign='left';
  }

  private drawFooter(ctx: CanvasRenderingContext2D, source: string): void {
    ctx.fillStyle='rgba(148,163,184,.72)'; ctx.font='500 12px ui-monospace,monospace'; ctx.fillText(source,62,690);
    ctx.textAlign='right'; ctx.fillStyle='#f59e0b'; ctx.font='700 16px ui-monospace,monospace'; ctx.fillText('2piclock.com',1138,690); ctx.textAlign='left';
  }

  private async renderCityCard(): Promise<void> {
    const ctx=this.setupCanvas(); if(!ctx)return;
    const loc=this.locationService.selectedLocation(); const date=this.timeControlService.currentActiveDate();
    const weather=this.weatherService.currentWeather(); const celestial=this.celestialService.celestialState();
        await this.drawHeader(ctx,'CITY STATUS · NOW',date,true);
    ctx.fillStyle='#f8fafc'; ctx.font='700 68px system-ui,sans-serif'; ctx.fillText(date.toLocaleTimeString('en-US',{timeZone:loc.timezone,hour:'2-digit',minute:'2-digit',hour12:false}),62,250);
    ctx.fillStyle='#e2e8f0'; ctx.font='600 22px system-ui,sans-serif'; ctx.fillText(weather.conditionLabel,62,286);
    await this.drawWeatherIcon(ctx,weather.condition,weather.isDay,1000,180,130);
    ctx.fillStyle='#f59e0b'; ctx.font='700 11px ui-monospace,monospace'; ctx.fillText('WEATHER',62,340);
    ctx.fillStyle='#f8fafc'; ctx.font='600 26px system-ui,sans-serif'; ctx.fillText(Math.round(weather.temperatureC)+'°C · '+weather.conditionLabel,62,372);
    ctx.fillStyle='#94a3b8'; ctx.font='500 14px system-ui,sans-serif'; ctx.fillText('Feels '+Math.round(weather.feelsLikeC)+'° · Rain '+weather.precipitationPct+'% · Wind '+Math.round(weather.windSpeedKmh)+' km/h',62,398);
    const events=celestial.solarEvents;
    this.drawMetric(ctx,'SUNRISE',this.formatEvent(events.sunrise,loc.timezone),62,448,240);
    this.drawMetric(ctx,'SUNSET',this.formatEvent(events.sunset,loc.timezone),322,448,240);
    this.drawMetric(ctx,'MOON',celestial.moon.phaseName+' · '+Math.round(celestial.moon.illuminationFraction*100)+'%',582,448,280);
    this.drawMetric(ctx,'DAYLIGHT',events.sunrise&&events.sunset?this.formatDuration(Math.round((events.sunset.getTime()-events.sunrise.getTime())/60000)):'—',882,448,220);
    this.drawFooter(ctx,'Local time · weather · solar · lunar context');
  }

  private getLocalDateParts(date: Date, timezone: string): {year:number;month:number;day:number;hour:number} {
    const parts=new Intl.DateTimeFormat('en-US',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(date);
    const get=(type:string)=>Number(parts.find(p=>p.type===type)?.value??0);
    return {year:get('year'),month:get('month'),day:get('day'),hour:get('hour')};
  }

  private getTomorrowInstant(timezone: string): Date {
    const p=this.getLocalDateParts(this.timeControlService.currentActiveDate(),timezone);
    const carrier=new Date(Date.UTC(p.year,p.month-1,p.day+1));
    return TimeControlService.createExactZonedDateTime(carrier.getUTCFullYear(),carrier.getUTCMonth()+1,carrier.getUTCDate(),12,0,0,timezone);
  }

  private async renderTomorrowCard(): Promise<void> {
    const ctx=this.setupCanvas(); if(!ctx)return;
    const loc=this.locationService.selectedLocation(); const tomorrow=this.getTomorrowInstant(loc.timezone);
    const forecast=this.weatherService.hourlyForecasts().filter(item=>{
      const p=this.getLocalDateParts(new Date(item.timeMs),loc.timezone);
      const t=this.getLocalDateParts(tomorrow,loc.timezone);
      return p.year===t.year&&p.month===t.month&&p.day===t.day;
    });
    const values=forecast.length?forecast.map(x=>x.weather):[this.weatherService.currentWeather()];
    const high=Math.max(...values.map(v=>v.temperatureC)); const low=Math.min(...values.map(v=>v.temperatureC));
    const precip=Math.max(...values.map(v=>v.precipitationPct)); const wind=Math.max(...values.map(v=>v.windSpeedKmh));
    const representative=values[Math.max(0,Math.min(values.length-1,Math.floor(values.length/2)))];
    const celestial=getCelestialState(tomorrow,loc.latitude,loc.longitude,loc.timezone);
    await this.drawHeader(ctx,'TOMORROW · OUTLOOK',tomorrow,false);
    ctx.fillStyle='#f8fafc'; ctx.font='700 48px system-ui,sans-serif'; ctx.fillText(this.formatDate(tomorrow,loc.timezone),62,225);
    ctx.fillStyle='#e2e8f0'; ctx.font='600 22px system-ui,sans-serif'; ctx.fillText(representative.conditionLabel,62,260);
    await this.drawWeatherIcon(ctx,representative.condition,representative.isDay,1000,170,135);
    this.drawMetric(ctx,'HIGH',Math.round(high)+'°C',62,332,245);
    this.drawMetric(ctx,'LOW',Math.round(low)+'°C',322,332,245);
    this.drawMetric(ctx,'RAIN',Math.round(precip)+'%',582,332,245);
    this.drawMetric(ctx,'WIND',Math.round(wind)+' km/h',842,332,240);
    const events=celestial.solarEvents;
    ctx.fillStyle='rgba(255,255,255,.055)'; this.roundedRect(ctx,62,450,1076,165,20); ctx.fill();
    ctx.fillStyle='#f59e0b'; ctx.font='700 11px ui-monospace,monospace'; ctx.fillText('DAYLIGHT',88,485);
    ctx.fillStyle='#f8fafc'; ctx.font='600 22px system-ui,sans-serif';
    ctx.fillText('Sunrise '+this.formatEvent(events.sunrise,loc.timezone)+'  ·  Sunset '+this.formatEvent(events.sunset,loc.timezone),88,520);
    const daylight=events.sunrise&&events.sunset?Math.round((events.sunset.getTime()-events.sunrise.getTime())/60000):null;
    ctx.fillStyle='#94a3b8'; ctx.font='500 14px system-ui,sans-serif'; ctx.fillText(daylight===null?'Daylight duration unavailable':this.formatDuration(daylight)+' of daylight',88,550);
    ctx.fillText('Moon '+celestial.moon.phaseName+' · '+Math.round(celestial.moon.illuminationFraction*100)+'% illuminated',88,578);
    this.drawFooter(ctx,'Forecast outlook · daylight · lunar context');
  }

  private async renderSleepCard(): Promise<void> {
    const ctx=this.setupCanvas(); if(!ctx)return;
    const loc=this.locationService.selectedLocation(); const plan=this.sleepPlan;
    if(!plan){this.drawFooter(ctx,'Open Sleep Calculator to create a plan');return;}
    const bed=getCelestialState(plan.bedtime,loc.latitude,loc.longitude,loc.timezone);
    const wake=getCelestialState(plan.wakeTime,loc.latitude,loc.longitude,loc.timezone);
    await this.drawHeader(ctx,'SLEEP · NIGHT PLAN',plan.bedtime,true);
    ctx.fillStyle='#f8fafc'; ctx.font='700 50px system-ui,sans-serif';
    ctx.fillText(this.formatEvent(plan.bedtime,loc.timezone)+' → '+this.formatEvent(plan.wakeTime,loc.timezone),62,230);
    ctx.fillStyle='#e2e8f0'; ctx.font='600 22px system-ui,sans-serif'; ctx.fillText(this.formatDuration(plan.sleepMinutes)+' asleep · '+plan.cycles+' cycles',62,267);
    this.drawMetric(ctx,'IN BED',this.formatDuration(plan.inBedMinutes ?? plan.sleepMinutes),62,330,250);
    this.drawMetric(ctx,'SUNSET',this.formatEvent(bed.solarEvents.sunset,loc.timezone),332,330,250);
    this.drawMetric(ctx,'SUNRISE',this.formatEvent(wake.solarEvents.sunrise,loc.timezone),602,330,250);
    this.drawMetric(ctx,'MOON',wake.moon.phaseName+' · '+Math.round(wake.moon.illuminationFraction*100)+'%',872,330,240);
    ctx.fillStyle='rgba(255,255,255,.055)'; this.roundedRect(ctx,62,455,1076,150,20); ctx.fill();
    ctx.fillStyle='#f59e0b'; ctx.font='700 11px ui-monospace,monospace'; ctx.fillText('LOCAL NIGHT',88,490);
    ctx.fillStyle='#f8fafc'; ctx.font='600 21px system-ui,sans-serif'; ctx.fillText('Darkness and daylight are shown as context, not as a sleep prescription.',88,530);
    ctx.fillStyle='#94a3b8'; ctx.font='500 14px system-ui,sans-serif'; ctx.fillText('2pi uses transparent planning math rather than claiming sleep cycles are exact.',88,558);
    this.drawFooter(ctx,'Sleep planning · solar timing · lunar context');
  }

  private formatDuration(minutes:number):string {
    const h=Math.floor(minutes/60); const m=minutes%60; return h+'h'+(m?' '+m+'m':'');
  }

  async renderExportCard(): Promise<void> {
    if (this.cardType==='sleep') return this.renderSleepCard();
    if (this.activeCard()==='tomorrow') return this.renderTomorrowCard();
    return this.renderCityCard();
  }

  async copySkyLink(): Promise<void> {
    if(!isPlatformBrowser(this.platformId))return;
    const loc=this.locationService.selectedLocation();
    let path='/'+this.locationService.getLocationSlug(loc);
    if(this.cardType==='sleep') path='/sleep-calculator';
    else if(this.activeCard()==='tomorrow') path='/'+this.locationService.getLocationSlug(loc)+'/weather';
    const instant=this.cardType==='sleep' ? null : (this.activeCard()==='tomorrow' ? this.getTomorrowInstant(loc.timezone) : this.timeControlService.currentActiveDate());
    const url=window.location.origin+path+(instant?'?at='+encodeURIComponent(instant.toISOString()):'');
    try{await navigator.clipboard.writeText(url);this.linkCopied.set(true);window.setTimeout(()=>this.linkCopied.set(false),2200);}catch { /* Ignore non-fatal local persistence errors. */ }
  }

  downloadPng(): void {
    if(!isPlatformBrowser(this.platformId))return;
    const canvas=this.canvasRef.nativeElement; const loc=this.locationService.selectedLocation();
    const kind=this.cardType==='sleep'?'sleep':this.activeCard();
    const link=document.createElement('a'); link.download=`2piclock-${kind}-${this.locationService.getLocationSlug(loc).replace('/', '-')}.png`; link.href=canvas.toDataURL('image/png'); link.click();
  }
}
