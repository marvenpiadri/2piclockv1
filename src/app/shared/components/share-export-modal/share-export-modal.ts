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
    .share-modal { width:min(560px,100%); max-height:calc(100vh - 32px); overflow:auto; position:relative; padding:22px; border:1px solid rgba(255,255,255,.18); border-radius:22px; background:rgba(10,16,27,.72); backdrop-filter:blur(28px); box-shadow:0 30px 90px rgba(0,0,0,.3); color:#fff; }
    .close { position:absolute; top:14px; right:14px; width:32px; height:32px; display:grid; place-items:center; border:0; border-radius:50%; background:rgba(255,255,255,.08); color:rgba(255,255,255,.7); cursor:pointer; }
    .close mat-icon { font-size:17px; width:17px; height:17px; }
    .heading { padding-right:42px; margin-bottom:16px; }
    .eyebrow { color:#f59e0b; font:700 9px ui-monospace,monospace; letter-spacing:.16em; }
    h2 { margin:6px 0 6px; font:700 24px/1.1 system-ui,sans-serif; letter-spacing:-.035em; }
    p { margin:0; color:rgba(255,255,255,.58); font-size:11px; line-height:1.5; }
    .canvas-frame { width:min(100%,432px); margin:0 auto; aspect-ratio:4/5; border-radius:16px; overflow:hidden; background:#0b1220; border:1px solid rgba(255,255,255,.12); box-shadow:0 18px 55px rgba(0,0,0,.22); }
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

  private roundedRect(ctx: CanvasRenderingContext2D, x:number, y:number, w:number, h:number, r:number):void {
    ctx.beginPath();
    ctx.roundRect(x,y,w,h,r);
  }

  private drawLogo(ctx: CanvasRenderingContext2D, x:number, y:number, day:boolean, size:number):void {
    ctx.fillStyle = day ? '#f59e0b' : '#cbd5e1';
    ctx.beginPath(); ctx.arc(x,y,size,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = day ? '#451a03' : '#64748b';
    ctx.font = `700 ${Math.max(12,size*.62)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('2π',x,y+.5);
  }

  private drawAnalog(ctx: CanvasRenderingContext2D, cx:number, cy:number, radius:number, hour:number, minute:number, second:number):void {
    ctx.strokeStyle='rgba(255,255,255,.25)'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2); ctx.stroke();
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6, inner=radius-10, outer=radius-3;
      ctx.strokeStyle=i%3===0?'rgba(245,158,11,.9)':'rgba(255,255,255,.38)';
      ctx.lineWidth=i%3===0?3:1.5; ctx.beginPath();
      ctx.moveTo(cx+Math.sin(a)*inner,cy-Math.cos(a)*inner);
      ctx.lineTo(cx+Math.sin(a)*outer,cy-Math.cos(a)*outer); ctx.stroke();
    }
    const hands=[{a:((hour+minute/60)/12)*Math.PI*2,l:radius*.48,w:7,c:'#fff'},{a:((minute+second/60)/60)*Math.PI*2,l:radius*.69,w:4,c:'#f59e0b'},{a:(second/60)*Math.PI*2,l:radius*.76,w:1.5,c:'rgba(255,255,255,.75)'}];
    for(const h of hands){ctx.strokeStyle=h.c;ctx.lineWidth=h.w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+Math.sin(h.a)*h.l,cy-Math.cos(h.a)*h.l);ctx.stroke();}
    ctx.fillStyle='#f59e0b';ctx.beginPath();ctx.arc(cx,cy,6,0,Math.PI*2);ctx.fill();
  }

  renderExportCard(): void {
    const canvas=this.canvasRef.nativeElement, ctx=canvas.getContext('2d');
    if(!ctx) return;
    const w=1080,h=1350; canvas.width=w;canvas.height=h;
    const loc=this.locationService.selectedLocation();
    const date=this.timeControlService.currentActiveDate();
    const weather=this.weatherService.currentWeather();
    const sun=calculateSolarPosition(date,loc.latitude,loc.longitude);
    const day=sun.altitudeDeg>=0;
    const bg=ctx.createLinearGradient(0,0,w,h);
    if(sun.altitudeDeg>6){bg.addColorStop(0,'#78b9d5');bg.addColorStop(.45,'#d5c18b');bg.addColorStop(1,'#36526d');}
    else if(sun.altitudeDeg>-6){bg.addColorStop(0,'#7b5161');bg.addColorStop(.48,'#c8874b');bg.addColorStop(1,'#26364f');}
    else {bg.addColorStop(0,'#071222');bg.addColorStop(.55,'#101d31');bg.addColorStop(1,'#18283b');}
    ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);

    const haze=ctx.createRadialGradient(day?w*.72:w*.78,h*.18,10,day?w*.72:w*.78,h*.18,430);
    haze.addColorStop(0,day?'rgba(255,220,125,.35)':'rgba(210,225,245,.2)');haze.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=haze;ctx.fillRect(0,0,w,h);

    // Atmospheric weather texture, deliberately subtle.
    const cloudCount=Math.min(26,Math.max(8,Math.round(weather.cloudCoverPct/4)));
    ctx.fillStyle='rgba(255,255,255,.045)';
    for(let i=0;i<cloudCount;i++){const x=(i*173)%w,y=130+(i*97)%(h-260),r=20+(i%5)*11;ctx.beginPath();ctx.ellipse(x,y,r*2.2,r*.55,0,0,Math.PI*2);ctx.fill();}

    ctx.fillStyle='rgba(3,8,18,.22)';this.roundedRect(ctx,54,54,w-108,h-108,34);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=1;this.roundedRect(ctx,54,54,w-108,h-108,34);ctx.stroke();

    this.drawLogo(ctx,104,108,day,28);
    ctx.textAlign='left';ctx.textBaseline='alphabetic';
    ctx.fillStyle='rgba(255,255,255,.86)';ctx.font='700 19px system-ui,-apple-system,sans-serif';ctx.fillText('2piClock',146,115);
    ctx.fillStyle='rgba(255,255,255,.52)';ctx.font='11px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillText('LIVE SKY SNAPSHOT',146,133);

    ctx.fillStyle='#fff';ctx.font='700 64px ui-monospace,SFMono-Regular,Menlo,monospace';
    const timeStr=date.toLocaleTimeString('en-US',{timeZone:loc.timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
    ctx.fillText(timeStr,94,235);
    ctx.fillStyle='rgba(255,255,255,.65)';ctx.font='16px ui-monospace,SFMono-Regular,Menlo,monospace';
    ctx.fillText(date.toLocaleDateString('en-US',{timeZone:loc.timezone,weekday:'long',month:'long',day:'numeric',year:'numeric'}),98,267);

    ctx.fillStyle='#fff';ctx.font='700 30px system-ui,-apple-system,sans-serif';ctx.fillText(loc.name,98,325);
    ctx.fillStyle='rgba(255,255,255,.58)';ctx.font='13px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillText(`${loc.country} · ${loc.timezone}`,98,348);

    this.drawAnalog(ctx,840,248,142,Number(timeStr.slice(0,2))%12,Number(timeStr.slice(3,5)),Number(timeStr.slice(6,8)));

    // Main weather panel.
    ctx.fillStyle='rgba(255,255,255,.075)';this.roundedRect(ctx,90,405,900,250,24);ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.12)';this.roundedRect(ctx,90,405,900,250,24);ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.52)';ctx.font='700 10px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillText('CURRENT WEATHER',120,440);
    ctx.fillStyle='#fff';ctx.font='700 58px system-ui,-apple-system,sans-serif';ctx.fillText(`${weather.temperatureC}°`,120,505);
    ctx.fillStyle='rgba(255,255,255,.72)';ctx.font='600 17px system-ui,-apple-system,sans-serif';ctx.fillText(weather.conditionLabel,120,537);
    const metrics=[['FEELS LIKE',`${weather.feelsLikeC}°C`],['HUMIDITY',`${weather.humidityPct}%`],['WIND',`${weather.windSpeedKmh} km/h`],['CLOUD',`${weather.cloudCoverPct}%`]];
    metrics.forEach((m,i)=>{const x=430+(i%2)*250,y=475+Math.floor(i/2)*75;ctx.fillStyle='rgba(255,255,255,.45)';ctx.font='9px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillText(m[0],x,y);ctx.fillStyle='#fff';ctx.font='600 18px system-ui,-apple-system,sans-serif';ctx.fillText(m[1],x,y+23);});

    // Solar and lunar context.
    ctx.fillStyle='rgba(255,255,255,.075)';this.roundedRect(ctx,90,690,900,260,24);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.52)';ctx.font='700 10px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillText('SKY & ASTRONOMY',120,725);
    const rows=[
      ['SUN',`${sun.altitudeDeg.toFixed(1)}° altitude · ${sun.azimuthDeg.toFixed(0)}° azimuth`],
      ['MOON',`${this.locationService.selectedLocation().timezone ? this.weatherService.currentWeather() && '' : ''}${this.getMoonPhaseLabel()}`],
      ['SUNRISE',this.formatEvent(this.celestialEvent('sunrise'),loc.timezone)],
      ['SUNSET',this.formatEvent(this.celestialEvent('sunset'),loc.timezone)]
    ];
    rows.forEach((r,i)=>{const y=770+i*42;ctx.fillStyle='#f59e0b';ctx.font='700 9px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillText(r[0],120,y);ctx.fillStyle='rgba(255,255,255,.82)';ctx.font='14px system-ui,-apple-system,sans-serif';ctx.fillText(r[1],230,y);});

    ctx.fillStyle='rgba(255,255,255,.48)';ctx.font='11px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillText('Time, weather and astronomy calculated for this location.',98,1015);

    ctx.fillStyle='rgba(255,255,255,.08)';this.roundedRect(ctx,90,1055,900,145,22);ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='700 9px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillText('2PICLOCK.COM',120,1090);
    ctx.fillStyle='#fff';ctx.font='600 21px system-ui,-apple-system,sans-serif';ctx.fillText('A living clock for the sky above you.',120,1125);
    ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='11px ui-monospace,SFMono-Regular,Menlo,monospace';ctx.fillText('2piclock.com',120,1160);
    this.drawLogo(ctx,938,1125,day,34);
  }

  private getMoonPhaseLabel(): string {
    try {
      const moon=(this.weatherService as any).celestialService?.celestialState?.()?.moon;
      return moon ? `${moon.phaseName} · ${Math.round(moon.illuminationFraction*100)}% illuminated` : 'Moon phase · live astronomical position';
    } catch { return 'Moon phase · live astronomical position'; }
  }

  private celestialEvent(name:'sunrise'|'sunset'): Date | null {
    try {
      const celestial=(this.locationService as any).celestialService?.celestialState?.();
      return celestial?.solarEvents?.[name] ?? null;
    } catch { return null; }
  }

  private formatEvent(value: Date | null, timezone:string): string {
    if(!value) return '—';
    try{return value.toLocaleTimeString('en-US',{timeZone:timezone,hour:'2-digit',minute:'2-digit'});}catch{return '—';}
  }

  async copySkyLink(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const location = this.locationService.selectedLocation();
    const instant = this.timeControlService.currentActiveDate().toISOString();
    const path = window.location.pathname === '/' ? '/' + location.id : window.location.pathname;
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
