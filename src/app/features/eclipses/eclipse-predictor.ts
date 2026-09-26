import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';
import { TimeControlService } from '../../core/services/time-control.service';
import * as Astronomy from 'astronomy-engine';

export interface EclipseEvent {
  id: string;
  date: string;
  type: 'Total Solar' | 'Annular Solar' | 'Partial Solar' | 'Total Lunar' | 'Partial Lunar' | 'Penumbral Lunar';
  category: 'solar' | 'lunar';
  magnitude: number;
  duration: string;
  visibilityRegion: string;
  pathCoordinates: string;
  localVisibility: string;
  description: string;
}

@Component({
  selector: 'app-eclipse-predictor',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="eclipse-container">
      
      <!-- Header -->
      <header class="eclipse-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
            <mat-icon class="text-xl">wb_twilight</mat-icon>
          </div>
          <div>
            <h1 class="text-xl md:text-2xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
              <span>Solar & Lunar Eclipse Predictor</span>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono">Besselian Engine</span>
            </h1>
            <p class="text-xs text-slate-400 font-mono">
              Global and Local Eclipse Ephemeris for {{ selectedLocation().name }}, {{ selectedLocation().country }}
            </p>
          </div>
        </div>
      </header>

      <!-- Next Major Eclipse Hero Card -->
      <div class="next-eclipse-hero my-6 p-6 rounded-3xl bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-slate-950 border border-amber-500/30 backdrop-blur-xl shadow-2xl">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-xs font-bold uppercase">
                Next Upcoming Eclipse
              </span>
              <span class="text-xs font-mono text-slate-400">{{ nextEclipse().type }}</span>
            </div>
            <h2 class="text-2xl md:text-3xl font-extrabold text-white font-sans">
              {{ nextEclipse().type }} — {{ nextEclipse().date }}
            </h2>
            <p class="text-xs text-slate-300 mt-2 max-w-xl leading-relaxed">
              {{ nextEclipse().description }}
            </p>
          </div>

          <div class="flex flex-col items-start md:items-end gap-2 bg-white/5 p-4 rounded-2xl border border-white/10 shrink-0">
            <span class="text-xs font-mono text-slate-400 uppercase">Local Visibility</span>
            <span class="text-lg font-bold text-amber-300 font-mono">{{ nextEclipse().localVisibility }}</span>
            <span class="text-xs font-mono text-slate-400">Duration: <strong class="text-white">{{ nextEclipse().duration }}</strong></span>
          </div>
        </div>
      </div>

      <!-- Eclipse Database List -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-white font-sans flex items-center gap-2">
            <mat-icon class="text-amber-400 text-lg">event_available</mat-icon>
            <span>Upcoming Solar & Lunar Eclipses Catalog</span>
          </h3>
          <span class="text-xs text-slate-400 font-mono">{{ upcomingEclipses().length }} Events Calculated</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (e of upcomingEclipses(); track e.id) {
            <div class="eclipse-card p-5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl hover:border-amber-500/30 transition">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
                       [class.bg-amber-500/20]="e.category === 'solar'"
                       [class.text-amber-300]="e.category === 'solar'"
                       [class.bg-purple-500/20]="e.category === 'lunar'"
                       [class.text-purple-300]="e.category === 'lunar'">
                    <mat-icon class="text-base">{{ e.category === 'solar' ? 'wb_sunny' : 'nightlight' }}</mat-icon>
                  </div>
                  <div>
                    <h4 class="font-bold text-sm text-white">{{ e.type }}</h4>
                    <span class="text-xs font-mono text-slate-400">{{ e.date }}</span>
                  </div>
                </div>
                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                  Mag {{ e.magnitude }}
                </span>
              </div>

              <p class="text-xs text-slate-300 my-3 leading-relaxed">{{ e.description }}</p>

              <div class="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400 pt-3 border-t border-white/5">
                <div>
                  <span class="text-slate-500 block text-[10px]">VISIBILITY REGION</span>
                  <span class="text-slate-200">{{ e.visibilityRegion }}</span>
                </div>
                <div>
                  <span class="text-slate-500 block text-[10px]">AT {{ selectedLocation().name.toUpperCase() }}</span>
                  <span class="text-amber-300 font-semibold">{{ e.localVisibility }}</span>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

    </div>
  `,
  styles: [`
    .eclipse-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
      color: #f1f5f9;
    }
  `]
})
export class EclipsePredictorComponent {
  private readonly locationService = inject(LocationService);
  private readonly timeControlService = inject(TimeControlService);

  readonly selectedLocation = this.locationService.selectedLocation;
  readonly activeDate = this.timeControlService.currentActiveDate;

  private readonly eclipseCache = new Map<string, EclipseEvent[]>();

  readonly upcomingEclipses = computed(() => {
    const loc = this.selectedLocation();
    const start = this.activeDate();
    const cacheKey = [
      loc.id,
      loc.latitude.toFixed(4),
      loc.longitude.toFixed(4),
      loc.timezone,
      start.toISOString().slice(0, 10)
    ].join('|');

    const cached = this.eclipseCache.get(cacheKey);
    if (cached) return cached;

    const observer = new Astronomy.Observer(loc.latitude, loc.longitude, 0);
    const events: EclipseEvent[] = [];

    let solar = Astronomy.SearchLocalSolarEclipse(start, observer);
    for (let i = 0; i < 4; i++) {
      events.push(this.mapLocalSolarEclipse(solar, loc));
      solar = Astronomy.NextLocalSolarEclipse(solar.peak.time, observer);
    }

    let lunar = Astronomy.SearchLunarEclipse(start);
    for (let i = 0; i < 4; i++) {
      events.push(this.mapLunarEclipse(lunar, loc, observer));
      lunar = Astronomy.NextLunarEclipse(lunar.peak);
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    const result = events.slice(0, 8);

    if (this.eclipseCache.size >= 20) this.eclipseCache.clear();
    this.eclipseCache.set(cacheKey, result);
    return result;
  });

  readonly nextEclipse = computed(() => this.upcomingEclipses()[0] ?? {
    id: 'none',
    date: '—',
    type: 'Partial Lunar' as const,
    category: 'lunar' as const,
    magnitude: 0,
    duration: '—',
    visibilityRegion: '—',
    pathCoordinates: '—',
    localVisibility: 'No upcoming eclipse found',
    description: 'No eclipse was found in the current search window.'
  });

  private mapLocalSolarEclipse(
    eclipse: Astronomy.LocalSolarEclipseInfo,
    loc: ReturnType<LocationService['selectedLocation']>,
  ): EclipseEvent {
    const kind = this.eclipseKindLabel(eclipse.kind);
    const peakDate = eclipse.peak.time.date;
    const visible = eclipse.peak.altitude >= 0;
    const durationMinutes = Math.max(
      0,
      (eclipse.partial_end.time.date.getTime() - eclipse.partial_begin.time.date.getTime()) / 60000
    );

    return {
      id: `solar-${peakDate.toISOString()}`,
      date: peakDate.toISOString(),
      type: `${kind} Solar`,
      category: 'solar',
      magnitude: Number(eclipse.obscuration.toFixed(4)),
      duration: this.formatDuration(durationMinutes),
      visibilityRegion: `${loc.name} local path`,
      pathCoordinates: `${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°`,
      localVisibility: visible
        ? `Visible at peak · Sun ${eclipse.peak.altitude.toFixed(1)}°`
        : `Below horizon at peak · Sun ${eclipse.peak.altitude.toFixed(1)}°`,
      description: visible
        ? `A ${kind.toLowerCase()} solar eclipse is geometrically visible from ${loc.name} at the peak.`
        : `A ${kind.toLowerCase()} solar eclipse occurs for this location, but the Sun is below the horizon at peak.`
    };
  }

  private mapLunarEclipse(
    eclipse: Astronomy.LunarEclipseInfo,
    loc: ReturnType<LocationService['selectedLocation']>,
    observer: Astronomy.Observer
  ): EclipseEvent {
    const peakDate = eclipse.peak.date;
    const moon = Astronomy.Equator(Astronomy.Body.Moon, peakDate, observer, true, true);
    const horizontal = Astronomy.Horizon(peakDate, observer, moon.ra, moon.dec, 'normal');
    const durationMinutes = Math.max(
      0,
      (2 * eclipse.sd_penum) || (2 * eclipse.sd_partial) || (2 * eclipse.sd_total)
    );

    return {
      id: `lunar-${peakDate.toISOString()}`,
      date: peakDate.toISOString(),
      type: `${this.eclipseKindLabel(eclipse.kind)} Lunar`,
      category: 'lunar',
      magnitude: Number(eclipse.obscuration.toFixed(4)),
      duration: this.formatDuration(durationMinutes),
      visibilityRegion: 'Global lunar eclipse',
      pathCoordinates: 'Earth-facing hemisphere',
      localVisibility: horizontal.altitude >= 0
        ? `Moon above horizon · ${horizontal.altitude.toFixed(1)}°`
        : `Moon below horizon at peak · ${horizontal.altitude.toFixed(1)}°`,
      description: horizontal.altitude >= 0
        ? `The Moon is above the horizon in ${loc.name} when this ${this.eclipseKindLabel(eclipse.kind).toLowerCase()} lunar eclipse peaks.`
        : `The eclipse peaks while the Moon is below the horizon in ${loc.name}; another part of the world can observe it.`
    };
  }

  private eclipseKindLabel(kind: Astronomy.EclipseKind): 'Total' | 'Annular' | 'Partial' | 'Penumbral' {
    switch (kind) {
      case Astronomy.EclipseKind.Total: return 'Total';
      case Astronomy.EclipseKind.Annular: return 'Annular';
      case Astronomy.EclipseKind.Penumbral: return 'Penumbral';
      default: return 'Partial';
    }
  }

  private formatDuration(minutes: number): string {
    if (!Number.isFinite(minutes) || minutes <= 0) return '—';
    const totalSeconds = Math.round(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${secs}s`;
  }
}
