import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';
import { TimeControlService } from '../../core/services/time-control.service';
import { AnalogClockComponent } from '../../shared/components/analog-clock/analog-clock';

type WidgetStyle = 'analog' | 'digital';
type WidgetTheme = 'dark' | 'light';

@Component({
  selector: 'app-widget-generator',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule, AnalogClockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-gen">
      <header class="header">
        <div>
          <span class="eyebrow">2PICLOCK · EMBEDDABLE</span>
          <h1>Embeddable 2PiClock Widget Generator</h1>
          <p>Put a clean live clock on any website. Choose the reusable analog clock or the digital display.</p>
        </div>
      </header>

      <div class="generator">
        <section class="controls">
          <div class="section">
            <label>Location</label>
            <select [ngModel]="selectedLocationId()" (ngModelChange)="selectedLocationId.set($event)">
              @for (loc of allPresets; track loc.id) { <option [value]="loc.id">{{ loc.name }} · {{ loc.country }}</option> }
            </select>
          </div>

          <div class="section">
            <label>Clock style</label>
            <div class="choice-grid">
              <button type="button" [class.active]="style()==='analog'" (click)="style.set('analog')">
                <span class="choice-title">Analog clock</span>
                <span>Simple round face · live hands</span>
              </button>
              <button type="button" [class.active]="style()==='digital'" (click)="style.set('digital')">
                <span class="choice-title">Digital clock</span>
                <span>Clean 2piClock digital display</span>
              </button>
            </div>
          </div>

          <div class="section">
            <label>Appearance</label>
            <div class="theme-row">
              <button type="button" [class.active]="theme()==='dark'" (click)="theme.set('dark')">Sky / dark</button>
              <button type="button" [class.active]="theme()==='light'" (click)="theme.set('light')">Day / light</button>
            </div>
          </div>

          <div class="code">
            <div class="code-head"><span>Embed code</span><button type="button" (click)="copySnippet()"><mat-icon>{{copied()?'check':'content_copy'}}</mat-icon>{{copied()?'Copied':'Copy code'}}</button></div>
            <textarea readonly rows="5" [value]="embedSnippet()"></textarea>
          </div>
        </section>

        <section class="preview">
          <span class="preview-label">LIVE PREVIEW</span>
          <div class="preview-frame" [class.light]="theme()==='light'">
            @if(style()==='analog') {
              <app-analog-clock [timezone]="activeLoc().timezone" [activeDate]="activeDate()" [size]="190" [showSeconds]="true" [ariaLabel]="activeLoc().name + ' analog clock preview'"></app-analog-clock>
              <strong>{{ activeLoc().name }}</strong>
              <small>{{ zoneLabel() }}</small>
            } @else {
              <div class="digital-preview">
                <div class="brand"><span>2π</span><b>2piClock</b></div>
                <strong>{{ previewTime() }}</strong>
                <div>{{ activeLoc().name }} · {{ zoneLabel() }}</div>
              </div>
            }
            <span class="credit">2piclock.com</span>
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [`
    :host { display:block; min-height:100%; }
    .widget-gen { width:min(1120px,calc(100% - 32px)); margin:auto; padding:38px 0 64px; color:#f8fafc; }
    .header { margin-bottom:22px; }
    .eyebrow { color:#f59e0b; font:700 9px ui-monospace,monospace; letter-spacing:.16em; }
    h1 { margin:7px 0 7px; font:700 clamp(28px,4vw,42px)/1.08 system-ui,sans-serif; letter-spacing:-.04em; }
    .header p { margin:0; color:rgba(255,255,255,.62); font-size:13px; }
    .generator { display:grid; grid-template-columns:minmax(280px,430px) minmax(0,1fr); gap:18px; }
    .controls,.preview { border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.06); backdrop-filter:blur(18px); border-radius:20px; }
    .controls { padding:20px; }
    .preview { min-height:500px; padding:24px; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .section { margin-bottom:18px; }
    label { display:block; margin-bottom:7px; color:rgba(255,255,255,.58); font:700 9px ui-monospace,monospace; letter-spacing:.08em; text-transform:uppercase; }
    select { width:100%; height:38px; border:1px solid rgba(255,255,255,.14); border-radius:10px; padding:0 10px; background:rgba(0,0,0,.22); color:#fff; outline:none; }
    .choice-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    button { font:inherit; cursor:pointer; }
    .choice-grid button,.theme-row button { text-align:left; border:1px solid rgba(255,255,255,.12); border-radius:11px; background:rgba(255,255,255,.045); color:rgba(255,255,255,.68); padding:11px; }
    .choice-grid button.active,.theme-row button.active { border-color:rgba(245,158,11,.55); background:rgba(245,158,11,.12); color:#fff; }
    .choice-title { display:block; font-weight:700; font-size:12px; margin-bottom:3px; color:inherit; }
    .choice-grid span:last-child { display:block; font-size:9px; line-height:1.35; opacity:.65; }
    .theme-row { display:flex; gap:7px; }
    .theme-row button { padding:8px 12px; font-size:10px; }
    .code { border-top:1px solid rgba(255,255,255,.1); padding-top:15px; }
    .code-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:7px; color:rgba(255,255,255,.7); font:700 10px ui-monospace,monospace; }
    .code-head button { border:0; background:transparent; color:#fbbf24; display:flex; gap:5px; align-items:center; font-size:10px; }
    .code-head mat-icon { font-size:14px; width:14px; height:14px; }
    textarea { width:100%; box-sizing:border-box; resize:none; border:1px solid rgba(255,255,255,.1); border-radius:10px; background:rgba(0,0,0,.28); color:#fcd34d; padding:10px; font:9px/1.5 ui-monospace,monospace; outline:none; }
    .preview-label { align-self:flex-start; margin-bottom:13px; color:rgba(255,255,255,.45); font:700 9px ui-monospace,monospace; letter-spacing:.14em; }
    .preview-frame { width:min(100%,430px); min-height:310px; border:1px solid rgba(245,158,11,.24); border-radius:18px; background:linear-gradient(155deg,rgba(20,29,45,.96),rgba(4,8,17,.98)); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; position:relative; overflow:hidden; }
    .preview-frame.light { background:linear-gradient(155deg,#fff8e8,#e8f0f7); color:#182033; }
    .preview-frame strong { font-size:14px; }
    .preview-frame small { font:9px ui-monospace,monospace; opacity:.55; }
    .digital-preview { text-align:center; }
    .brand { display:flex; justify-content:center; align-items:center; gap:7px; opacity:.75; }
    .brand span { width:24px; height:24px; border-radius:50%; display:grid; place-items:center; background:#f59e0b; color:#451a03; font:700 8px ui-monospace,monospace; }
    .digital-preview strong { display:block; margin:18px 0 8px; color:#f59e0b; font:700 clamp(42px,8vw,70px)/1 ui-monospace,monospace; letter-spacing:.03em; }
    .digital-preview div:last-child { font:9px ui-monospace,monospace; opacity:.58; }
    .credit { position:absolute; right:12px; bottom:9px; font:8px ui-monospace,monospace; opacity:.45; }
    @media(max-width:780px){ .generator{grid-template-columns:1fr}.preview{min-height:390px}.widget-gen{width:min(100% - 22px,1120px)} }
  `]
})
export class WidgetGeneratorComponent {
  private readonly locationService = inject(LocationService);
  private readonly timeControl = inject(TimeControlService);

  readonly activeDate = this.timeControl.currentActiveDate;
  readonly allLocations = this.locationService.locations;
  readonly selectedLocationId = signal('tokyo');
  readonly style = signal<WidgetStyle>('analog');
  readonly theme = signal<WidgetTheme>('dark');
  readonly copied = signal(false);

  readonly activeLoc = computed(() => this.allLocations().find(p => p.id === this.selectedLocationId()) ?? this.allLocations()[0]);
  readonly previewTime = computed(() => {
    try { return this.activeDate().toLocaleTimeString('en-US',{timeZone:this.activeLoc().timezone,hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}); }
    catch { return '00:00:00'; }
  });
  readonly zoneLabel = computed(() => {
    try { return new Intl.DateTimeFormat('en-US',{timeZone:this.activeLoc().timezone,timeZoneName:'shortOffset'}).formatToParts(this.activeDate()).find(x=>x.type==='timeZoneName')?.value ?? this.activeLoc().timezone; }
    catch { return this.activeLoc().timezone; }
  });
  readonly embedSnippet = computed(() => {
    const loc=this.activeLoc();
    return `<iframe src="https://2piclock.com/widget/embed/${loc.id}?style=${this.style()}&theme=${this.theme()}" width="360" height="300" style="border:0;border-radius:16px;overflow:hidden" loading="lazy" title="2piClock ${loc.name}"></iframe>`;
  });
  copySnippet():void {
    if(typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(this.embedSnippet()).then(()=>{this.copied.set(true);setTimeout(()=>this.copied.set(false),2200);});
    }
  }
}
