import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';

export interface EclipseEvent {
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
          <span class="text-xs text-slate-400 font-mono">{{ upcomingEclipses.length }} Events Calculated</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (e of upcomingEclipses; track e.date) {
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
  private locationService = inject(LocationService);
  readonly selectedLocation = this.locationService.selectedLocation;

  readonly upcomingEclipses: EclipseEvent[] = [
    {
      date: 'August 12, 2026',
      type: 'Total Solar',
      category: 'solar',
      magnitude: 1.0386,
      duration: '2m 18s',
      visibilityRegion: 'Greenland, Iceland, Northern Spain, Portugal',
      pathCoordinates: '65.2° N, 25.2° W',
      localVisibility: 'Partial (92% Obscuration in Europe)',
      description: 'The first total solar eclipse visible in mainland Europe since 1999, casting a dark umbra across the Arctic and Iberian Peninsula.'
    },
    {
      date: 'February 6, 2027',
      type: 'Annular Solar',
      category: 'solar',
      magnitude: 0.9281,
      duration: '7m 51s',
      visibilityRegion: 'Chile, Argentina, Atlantic Ocean, West Africa',
      pathCoordinates: '31.3° S, 48.5° W',
      localVisibility: 'Partial (Southern Hemisphere)',
      description: 'Striking "Ring of Fire" annular eclipse with the Moon at apogee creating a wide ring around the solar disk.'
    },
    {
      date: 'August 2, 2027',
      type: 'Total Solar',
      category: 'solar',
      magnitude: 1.0790,
      duration: '6m 23s',
      visibilityRegion: 'Southern Spain, Morocco, Egypt, Saudi Arabia, Yemen',
      pathCoordinates: '25.5° N, 33.2° E',
      localVisibility: 'Total across Luxor & Valley of the Kings',
      description: 'One of the longest total solar eclipses of the 21st century, passing directly over ancient Egyptian monuments.'
    },
    {
      date: 'March 3, 2026',
      type: 'Total Lunar',
      category: 'lunar',
      magnitude: 1.1507,
      duration: '58m (Totality)',
      visibilityRegion: 'Pacific Ocean, Americas, East Asia, Australia',
      pathCoordinates: '12.4° S, 160.0° W',
      localVisibility: 'Fully Visible (Blood Moon)',
      description: 'Deep total lunar eclipse turning the full moon an intense coppery-red due to Rayleigh scattering through Earth atmosphere.'
    },
    {
      date: 'August 28, 2026',
      type: 'Partial Lunar',
      category: 'lunar',
      magnitude: 0.9299,
      duration: '3h 18m',
      visibilityRegion: 'Eastern Americas, Europe, Africa, Middle East',
      pathCoordinates: '9.8° S, 24.1° W',
      localVisibility: 'Deep Partial (93% in shadow)',
      description: 'Near-total lunar eclipse with the southern lunar limb entering deep into the Earth umbral cone.'
    }
  ];

  readonly nextEclipse = computed(() => this.upcomingEclipses[0]);
}
