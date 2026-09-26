import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { CelestialService } from '../../core/services/celestial.service';
import { LocationService } from '../../core/services/location.service';

export interface DeepSkyTarget {
  name: string;
  catalog: string;
  type: string;
  constellation: string;
  magnitude: number;
  bestTime: string;
  visibilityRating: 'Exceptional' | 'Good' | 'Fair' | 'Challenging';
  description: string;
}

@Component({
  selector: 'app-stargazing-planner',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="stargazing-container">
      
      <!-- Top Hero Header -->
      <header class="stargazing-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <mat-icon class="text-xl">nightlight_round</mat-icon>
          </div>
          <div>
            <h1 class="text-xl md:text-2xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
              <span>Stargazing & Astrophotography Planner</span>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-mono">Bortle Engine</span>
            </h1>
            <p class="text-xs text-slate-400 font-mono">
              Observer Coordinates: {{ selectedLocation().name }} ({{ selectedLocation().latitude.toFixed(2) }}°, {{ selectedLocation().longitude.toFixed(2) }}°)
            </p>
          </div>
        </div>
      </header>

      <!-- Grid Matrix: Darkness Score & Seeing Conditions -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
        
        <!-- Night Sky Darkness Score Card -->
        <div class="darkness-card p-5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">Overall Sky Quality</span>
            <span class="text-xs font-mono font-bold px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {{ skyQualityScore() }}/100
            </span>
          </div>
          <div class="my-4 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold text-white font-mono">{{ skyQualityLabel() }}</span>
          </div>
          <!-- Progress Bar -->
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden mb-3">
            <div class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-500" [style.width.%]="skyQualityScore()"></div>
          </div>
          <p class="text-xs text-slate-400 leading-relaxed">
            Derived from current lunar illumination ({{ (celestial().moon.illuminationFraction * 100).toFixed(0) }}%), cloud cover ({{ currentWeather().cloudCoverPct }}%), and solar depression.
          </p>
        </div>

        <!-- Bortle Class Index Card -->
        <div class="bortle-card p-5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">Estimated Bortle Scale</span>
            <span class="text-xs font-mono font-bold text-amber-300">Class {{ bortleClass() }}</span>
          </div>
          <div class="my-4">
            <span class="text-2xl font-bold text-slate-100">{{ bortleLabel() }}</span>
          </div>
          <div class="flex items-center gap-1.5 py-1">
            @for (b of [1,2,3,4,5,6,7,8,9]; track b) {
              <div class="flex-1 h-1.5 rounded-full" [class.bg-indigo-500]="b <= bortleClass()" [class.bg-slate-800]="b > bortleClass()"></div>
            }
          </div>
          <p class="text-xs text-slate-400 mt-2">
            {{ bortleDescription() }}
          </p>
        </div>

        <!-- Astronomical Darkness Window -->
        <div class="window-card p-5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider">Astronomical Darkness Window</span>
            <mat-icon class="text-sm text-indigo-400">timelapse</mat-icon>
          </div>
          <div class="my-4">
            <div class="text-2xl font-extrabold text-indigo-200 font-mono">{{ darknessWindowTimes() }}</div>
          </div>
          <div class="flex items-center justify-between text-xs font-mono text-slate-400 pt-1 border-t border-white/5">
            <span>Duration: <strong class="text-white">{{ darknessDuration() }}</strong></span>
            <span>Sun Altitude: <strong class="text-amber-300">{{ celestial().sun.altitudeDeg.toFixed(1) }}°</strong></span>
          </div>
        </div>

      </div>

      <!-- Prime Deep-Sky Celestial Targets Tonight -->
      <section class="deep-sky-section p-6 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-xl">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-2">
            <mat-icon class="text-indigo-400">flare</mat-icon>
            <h2 class="text-lg font-bold text-white font-sans">Prime Deep-Sky & Astrophotography Targets Tonight</h2>
          </div>
          <span class="text-xs text-slate-400 font-mono">Sorted by Optical Visibility</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (target of deepSkyTargets; track target.catalog) {
            <div class="target-card p-4 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-400/40 transition">
              <div class="flex items-start justify-between">
                <div>
                  <h3 class="font-bold text-sm text-white">{{ target.name }}</h3>
                  <span class="text-xs font-mono text-indigo-300">{{ target.catalog }} · {{ target.constellation }}</span>
                </div>
                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-indigo-950 border border-indigo-500/40 text-indigo-300">
                  Mag +{{ target.magnitude }}
                </span>
              </div>
              <p class="text-xs text-slate-400 my-2 leading-relaxed">{{ target.description }}</p>
              <div class="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-white/5">
                <span>Best: <strong class="text-slate-200">{{ target.bestTime }}</strong></span>
                <span class="text-emerald-400 font-semibold">{{ target.visibilityRating }}</span>
              </div>
            </div>
          }
        </div>
      </section>

    </div>
  `,
  styles: [`
    .stargazing-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
      color: #f1f5f9;
    }
    .darkness-card, .bortle-card, .window-card, .deep-sky-section {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
  `]
})
export class StargazingPlannerComponent {
  private celestialService = inject(CelestialService);
  private locationService = inject(LocationService);

  readonly selectedLocation = this.locationService.selectedLocation;
  readonly celestial = this.celestialService.celestialState;
  readonly currentWeather = this.celestialService.currentWeather;

  readonly bortleClass = computed(() => {
    const loc = this.selectedLocation();
    // Rural vs Urban heuristic from location presets
    if (loc.id === 'reykjavik' || loc.id === 'casablanca') return 3;
    if (loc.id === 'london' || loc.id === 'newyork' || loc.id === 'tokyo') return 7;
    return 4;
  });

  readonly bortleLabel = computed(() => {
    const c = this.bortleClass();
    if (c <= 2) return 'Truly Dark Sky';
    if (c <= 4) return 'Rural / Suburban Transition';
    if (c <= 6) return 'Suburban Sky';
    return 'Urban / City Sky';
  });

  readonly bortleDescription = computed(() => {
    const c = this.bortleClass();
    if (c <= 3) return 'Milky Way reveals immense structure; Andromeda Galaxy easily visible to the naked eye.';
    if (c <= 5) return 'Milky Way visible near zenith; faint deep-sky targets easily resolved with small telescopes.';
    return 'Bright sky glow masks faint stars; ideal for Moon, bright planets, and high-surface-brightness clusters.';
  });

  readonly skyQualityScore = computed(() => {
    const moon = this.celestial().moon.illuminationFraction;
    const clouds = this.currentWeather().cloudCoverPct;
    const sunAlt = this.celestial().sun.altitudeDeg;
    let score = 100;
    if (sunAlt > -18) score -= (sunAlt + 18) * 3; // Solar twilight penalty
    score -= moon * 30; // Moonlight penalty
    score -= clouds * 0.4; // Cloud penalty
    return Math.max(0, Math.min(100, Math.round(score)));
  });

  readonly skyQualityLabel = computed(() => {
    const s = this.skyQualityScore();
    if (s > 80) return 'Superb Clarity';
    if (s > 60) return 'Good Conditions';
    if (s > 40) return 'Fair Visibility';
    return 'Marginal / Obscured';
  });

  readonly darknessWindowTimes = computed(() => {
    const ev = this.celestial().solarEvents;
    if (ev.astronomicalDusk && ev.astronomicalDawn) {
      const timezone = this.selectedLocation().timezone;
      const dusk = ev.astronomicalDusk.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const dawn = ev.astronomicalDawn.toLocaleTimeString('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      return `${dusk} – ${dawn}`;
    }
    return 'Continuous Twilight';
  });

  readonly darknessDuration = computed(() => {
    const ev = this.celestial().solarEvents;
    if (ev.astronomicalDusk && ev.astronomicalDawn) {
      let diffMs = ev.astronomicalDawn.getTime() - ev.astronomicalDusk.getTime();
      if (diffMs < 0) diffMs += 24 * 3600000;
      const hours = Math.floor(diffMs / 3600000);
      const mins = Math.round((diffMs % 3600000) / 60000);
      return `${hours}h ${mins}m`;
    }
    return '0h (Polar/Twilight)';
  });

  readonly deepSkyTargets: DeepSkyTarget[] = [
    {
      name: 'Andromeda Galaxy',
      catalog: 'M31 / NGC 224',
      type: 'Spiral Galaxy',
      constellation: 'Andromeda',
      magnitude: 3.44,
      bestTime: 'Midnight',
      visibilityRating: 'Exceptional',
      description: 'The nearest major galaxy to the Milky Way, displaying striking dust lanes under dark skies.'
    },
    {
      name: 'Great Orion Nebula',
      catalog: 'M42 / NGC 1976',
      type: 'Diffuse Emission Nebula',
      constellation: 'Orion',
      magnitude: 4.0,
      bestTime: '01:30 AM',
      visibilityRating: 'Exceptional',
      description: 'Luminous stellar nursery hosting the famous Trapezium quadruple star cluster.'
    },
    {
      name: 'Pleiades Star Cluster',
      catalog: 'M45 / Seven Sisters',
      type: 'Open Star Cluster',
      constellation: 'Taurus',
      magnitude: 1.6,
      bestTime: '23:00 PM',
      visibilityRating: 'Exceptional',
      description: 'Brilliant cluster of young B-type blue stars wrapped in reflection nebulosity.'
    },
    {
      name: 'Hercules Globular Cluster',
      catalog: 'M13 / NGC 6205',
      type: 'Globular Cluster',
      constellation: 'Hercules',
      magnitude: 5.8,
      bestTime: '22:30 PM',
      visibilityRating: 'Good',
      description: 'Densely packed ball of over 300,000 ancient stars spanning 145 light-years across.'
    },
    {
      name: 'Ring Nebula',
      catalog: 'M57 / NGC 6720',
      type: 'Planetary Nebula',
      constellation: 'Lyra',
      magnitude: 8.8,
      bestTime: '21:45 PM',
      visibilityRating: 'Good',
      description: 'Gaseous shroud expelled by a dying white dwarf star, showcasing an iconic oval ring geometry.'
    },
    {
      name: 'Galactic Center (Milky Way)',
      catalog: 'Sagittarius A*',
      type: 'Galactic Core',
      constellation: 'Sagittarius',
      magnitude: 1.0,
      bestTime: '02:00 AM',
      visibilityRating: 'Good',
      description: 'Dense concentration of stars and nebulae along the dense galactic rift.'
    }
  ];
}
