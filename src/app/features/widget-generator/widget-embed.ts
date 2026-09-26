import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AnalogClockComponent } from '../../shared/components/analog-clock/analog-clock';
import { LocationService } from '../../core/services/location.service';
import { TimeControlService } from '../../core/services/time-control.service';

@Component({
  selector: 'app-widget-embed',
  standalone: true,
  imports: [AnalogClockComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="embed" [class.light]="theme() === 'light'">
      @if (style() === 'analog') {
        <div class="analog-wrap">
          <app-analog-clock
            [timezone]="location().timezone"
            [activeDate]="activeDate()"
            [size]="150"
            [showSeconds]="true"
            [ariaLabel]="location().name + ' analog clock'">
          </app-analog-clock>
        </div>
        <div class="location">{{ location().name }}</div>
        <div class="zone">{{ zoneLabel() }}</div>
      } @else {
        <div class="digital-wrap">
          <div class="brand"><span class="brand-disc">2π</span><span>2piClock</span></div>
          <div class="digital">{{ digitalTime() }}</div>
          <div class="meta"><span>{{ location().name }}</span><span>{{ zoneLabel() }}</span></div>
        </div>
      }
      <a href="https://2piclock.com" target="_blank" rel="noopener noreferrer" class="credit">2piclock.com</a>
    </main>
  `,
  styles: [`
    :host { display:block; width:100vw; height:100vh; overflow:hidden; }
    .embed {
      box-sizing:border-box; width:100%; height:100%; min-width:220px; min-height:150px;
      display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px;
      padding:14px; position:relative; overflow:hidden; color:#f8fafc;
      background:linear-gradient(160deg,rgba(16,24,39,.96),rgba(3,7,18,.98));
      font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    }
    .embed.light { color:#172033; background:linear-gradient(160deg,#fff8e8,#e8f0f7); }
    .analog-wrap { width:150px; height:150px; display:grid; place-items:center; }
    .location { font-size:14px; font-weight:700; letter-spacing:-.02em; }
    .zone { font:9px ui-monospace,SFMono-Regular,Menlo,monospace; opacity:.6; }
    .digital-wrap { width:min(100%,340px); text-align:center; }
    .brand { display:flex; align-items:center; justify-content:center; gap:7px; font-size:10px; font-weight:700; opacity:.78; }
    .brand-disc { width:22px; height:22px; border-radius:50%; display:grid; place-items:center; background:#f59e0b; color:#451a03; font:700 8px ui-monospace,monospace; }
    .digital { margin:12px 0 7px; font:700 clamp(34px,9vw,68px)/1 ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.03em; color:#f59e0b; }
    .meta { display:flex; justify-content:center; gap:10px; font:9px ui-monospace,SFMono-Regular,Menlo,monospace; opacity:.65; }
    .credit { position:absolute; right:10px; bottom:7px; color:inherit; opacity:.45; text-decoration:none; font:8px ui-monospace,monospace; }
  `]
})
export class WidgetEmbedComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly locationService = inject(LocationService);
  private readonly timeControl = inject(TimeControlService);

  readonly activeDate = this.timeControl.currentActiveDate;
  readonly location = computed(() => {
    const id = this.route.snapshot.paramMap.get('location');
    return this.locationService.allPresets.find(x => x.id === id) ?? this.locationService.selectedLocation();
  });
  readonly style = computed<'analog'|'digital'>(() =>
    this.route.snapshot.queryParamMap.get('style') === 'analog' ? 'analog' : 'digital'
  );
  readonly theme = computed<'dark'|'light'>(() =>
    this.route.snapshot.queryParamMap.get('theme') === 'light' ? 'light' : 'dark'
  );
  readonly digitalTime = computed(() => {
    try {
      return this.activeDate().toLocaleTimeString('en-US', {
        timeZone: this.location().timezone, hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
      });
    } catch { return '00:00:00'; }
  });
  readonly zoneLabel = computed(() => {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone:this.location().timezone, timeZoneName:'shortOffset' })
        .formatToParts(this.activeDate()).find(x => x.type === 'timeZoneName')?.value ?? this.location().timezone;
    } catch { return this.location().timezone; }
  });
}
