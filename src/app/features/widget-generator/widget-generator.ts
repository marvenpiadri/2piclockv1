import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';

@Component({
  selector: 'app-widget-generator',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="widget-gen-container">
      
      <!-- Header -->
      <header class="widget-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
            <mat-icon class="text-xl">code</mat-icon>
          </div>
          <div>
            <h1 class="text-xl md:text-2xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
              <span>Embeddable 2PiClock Widget Generator</span>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-mono">Web Component / Iframe</span>
            </h1>
            <p class="text-xs text-slate-400 font-mono">
              Embed living celestial dials, solar gradients, and real-time world clocks on any website.
            </p>
          </div>
        </div>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6">
        
        <!-- Controls Column -->
        <div class="lg:col-span-5 p-6 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl space-y-4">
          <h2 class="text-sm font-bold text-white font-mono uppercase tracking-wider">Configure Widget</h2>

          <!-- Target Location -->
          <div>
            <label class="block text-xs text-slate-400 font-mono mb-1.5">Target Location</label>
            <select 
              [ngModel]="selectedLocationId()" 
              (ngModelChange)="selectedLocationId.set($event)"
              class="w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-xs text-white outline-none focus:border-amber-400">
              @for (loc of allPresets; track loc.id) {
                <option [value]="loc.id">{{ loc.name }} ({{ loc.country }})</option>
              }
            </select>
          </div>

          <!-- Widget Format -->
          <div>
            <label class="block text-xs text-slate-400 font-mono mb-1.5">Widget Format</label>
            <div class="grid grid-cols-3 gap-2">
              <button 
                type="button" 
                (click)="widgetFormat.set('badge')" 
                class="py-2 px-3 rounded-xl text-xs font-semibold border transition text-center"
                [class.bg-amber-500/20]="widgetFormat() === 'badge'"
                [class.text-amber-300]="widgetFormat() === 'badge'"
                [class.border-amber-500/40]="widgetFormat() === 'badge'"
                [class.bg-white/5]="widgetFormat() !== 'badge'"
                [class.text-slate-300]="widgetFormat() !== 'badge'"
                [class.border-white/10]="widgetFormat() !== 'badge'">
                Mini Badge
              </button>

              <button 
                type="button" 
                (click)="widgetFormat.set('dial')" 
                class="py-2 px-3 rounded-xl text-xs font-semibold border transition text-center"
                [class.bg-amber-500/20]="widgetFormat() === 'dial'"
                [class.text-amber-300]="widgetFormat() === 'dial'"
                [class.border-amber-500/40]="widgetFormat() === 'dial'"
                [class.bg-white/5]="widgetFormat() !== 'dial'"
                [class.text-slate-300]="widgetFormat() !== 'dial'"
                [class.border-white/10]="widgetFormat() !== 'dial'">
                Solar Dial
              </button>

              <button 
                type="button" 
                (click)="widgetFormat.set('card')" 
                class="py-2 px-3 rounded-xl text-xs font-semibold border transition text-center"
                [class.bg-amber-500/20]="widgetFormat() === 'card'"
                [class.text-amber-300]="widgetFormat() === 'card'"
                [class.border-amber-500/40]="widgetFormat() === 'card'"
                [class.bg-white/5]="widgetFormat() !== 'card'"
                [class.text-slate-300]="widgetFormat() !== 'card'"
                [class.border-white/10]="widgetFormat() !== 'card'">
                Full Card
              </button>
            </div>
          </div>

          <!-- Theme -->
          <div>
            <label class="block text-xs text-slate-400 font-mono mb-1.5">Glass Theme</label>
            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button" 
                (click)="widgetTheme.set('obsidian')" 
                class="py-2 px-3 rounded-xl text-xs font-semibold border transition text-center"
                [class.bg-amber-500/20]="widgetTheme() === 'obsidian'"
                [class.text-amber-300]="widgetTheme() === 'obsidian'"
                [class.border-amber-500/40]="widgetTheme() === 'obsidian'"
                [class.bg-white/5]="widgetTheme() !== 'obsidian'"
                [class.text-slate-300]="widgetTheme() !== 'obsidian'"
                [class.border-white/10]="widgetTheme() !== 'obsidian'">
                Obsidian Dark
              </button>

              <button 
                type="button" 
                (click)="widgetTheme.set('frosted')" 
                class="py-2 px-3 rounded-xl text-xs font-semibold border transition text-center"
                [class.bg-amber-500/20]="widgetTheme() === 'frosted'"
                [class.text-amber-300]="widgetTheme() === 'frosted'"
                [class.border-amber-500/40]="widgetTheme() === 'frosted'"
                [class.bg-white/5]="widgetTheme() !== 'frosted'"
                [class.text-slate-300]="widgetTheme() !== 'frosted'"
                [class.border-white/10]="widgetTheme() !== 'frosted'">
                Frosted Glass
              </button>
            </div>
          </div>

          <!-- Code Output -->
          <div class="pt-3 border-t border-white/10">
            <div class="flex items-center justify-between mb-2">
              <label class="text-xs text-slate-300 font-mono font-semibold">Embed HTML Code</label>
              <button 
                type="button" 
                (click)="copySnippet()" 
                class="text-xs font-mono text-amber-300 hover:text-amber-200 flex items-center gap-1 font-bold">
                <mat-icon class="text-sm">{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
                <span>{{ copied() ? 'Copied!' : 'Copy Code' }}</span>
              </button>
            </div>
            <textarea 
              readonly 
              [value]="embedSnippet()" 
              rows="4" 
              class="w-full p-3 rounded-xl bg-slate-950 font-mono text-[11px] text-amber-200 border border-white/10 select-all outline-none resize-none"></textarea>
          </div>

        </div>

        <!-- Live Interactive Preview Column -->
        <div class="lg:col-span-7 flex flex-col justify-center items-center p-8 rounded-3xl bg-slate-950/90 border border-white/10 backdrop-blur-xl relative overflow-hidden">
          <div class="absolute inset-0 bg-gradient-to-tr from-amber-500/5 via-indigo-500/5 to-transparent pointer-events-none"></div>

          <span class="text-xs font-mono text-slate-500 uppercase tracking-widest mb-6">Interactive Live Preview</span>

          <!-- Preview Mock Widget Frame -->
          <div class="w-full max-w-sm p-6 rounded-2xl bg-slate-900/90 border border-amber-500/30 shadow-2xl backdrop-blur-md text-center">
            
            <div class="flex items-center justify-center gap-2 mb-2">
              <div class="w-7 h-7 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 flex items-center justify-center text-slate-950 font-black font-mono text-xs shadow-md">
                2π
              </div>
              <span class="font-bold text-sm text-white font-sans">{{ activeLoc().name }}</span>
            </div>

            <div class="text-3xl font-black text-white font-mono my-2 tracking-tight">
              {{ previewTime() }}
            </div>

            <div class="text-xs font-mono text-amber-300">
              Solar Day · Horizon Altitude +34.2°
            </div>

            <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden my-3">
              <div class="h-full bg-gradient-to-r from-amber-400 to-indigo-500 w-2/3"></div>
            </div>

            <div class="text-[10px] font-mono text-slate-500">
              POWERED BY 2PICLOCK.COM
            </div>

          </div>

        </div>

      </div>

    </div>
  `,
  styles: [`
    .widget-gen-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
      color: #f1f5f9;
    }
  `]
})
export class WidgetGeneratorComponent {
  private locationService = inject(LocationService);

  readonly allPresets = this.locationService.allPresets;
  readonly selectedLocationId = signal<string>('tokyo');
  readonly widgetFormat = signal<'badge' | 'dial' | 'card'>('card');
  readonly widgetTheme = signal<'obsidian' | 'frosted'>('obsidian');
  readonly copied = signal<boolean>(false);

  readonly activeLoc = computed(() => {
    const id = this.selectedLocationId();
    return this.allPresets.find(p => p.id === id) || this.allPresets[0];
  });

  readonly previewTime = computed(() => {
    const loc = this.activeLoc();
    try {
      return new Date().toLocaleTimeString('en-US', {
        timeZone: loc.timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
    } catch {
      return '12:00:00';
    }
  });

  readonly embedSnippet = computed(() => {
    const loc = this.activeLoc();
    const fmt = this.widgetFormat();
    const thm = this.widgetTheme();
    return `<iframe src="https://2piclock.com/${loc.id}?embed=1&format=${fmt}&theme=${thm}" width="320" height="180" style="border:none;border-radius:16px;overflow:hidden;" loading="lazy" title="2piClock ${loc.name}"></iframe>`;
  });

  copySnippet(): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(this.embedSnippet());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    }
  }
}
