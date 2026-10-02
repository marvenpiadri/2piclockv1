import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';
import { CountryFlagComponent } from '../../shared/components';
import { getCelestialState } from '../../core/astronomy/astronomy-engine';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MatIconModule, CountryFlagComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="dashboard-container">
      
      <!-- Top Header -->
      <header class="dashboard-header flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
            <mat-icon class="text-xl">dashboard</mat-icon>
          </div>
          <div>
            <h1 class="text-xl md:text-2xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
              <span>Multi-City Horizon Dashboard</span>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono">Live Diurnal Grid</span>
            </h1>
            <p class="text-xs text-slate-400 font-mono">
              Synchronized 24-Hour 2Pi Celestial Radian Vectors & Local Time
            </p>
          </div>
        </div>

        <!-- Add City Quick Dropdown -->
        <div class="flex items-center gap-2">
          <select 
            [ngModel]="selectedAddId()" 
            (ngModelChange)="addCityById($event)" 
            class="px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-xs text-white outline-none focus:border-amber-400 transition cursor-pointer">
            <option value="" disabled selected>+ Pin City to Dashboard...</option>
            @for (loc of availableToAdd(); track loc.id) {
              <option [value]="loc.id">{{ loc.name }} ({{ loc.country }})</option>
            }
          </select>
        </div>
      </header>

      <!-- Pinned Cities Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 my-6">
        @for (card of cityCards(); track card.loc.id) {
          <div class="city-card p-5 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-xl hover:border-amber-500/30 transition shadow-xl relative group">
            
            <!-- Remove Button on Hover -->
            @if (cityCards().length > 1) {
              <button 
                type="button" 
                (click)="removeCity(card.loc.id)" 
                class="absolute top-4 right-4 text-slate-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition p-1"
                title="Unpin City">
                <mat-icon class="text-base">close</mat-icon>
              </button>
            }

            <!-- City Name & Flag -->
            <div class="flex items-center gap-2.5 mb-3">
              <app-country-flag [countryCode]="card.loc.countryCode" [customClass]="'w-5 h-3.5 rounded'"></app-country-flag>
              <div>
                <h3 class="font-bold text-base text-white font-sans">{{ card.loc.name }}</h3>
                <span class="text-xs font-mono text-slate-400">{{ card.loc.country }} · {{ card.loc.timezone }}</span>
              </div>
            </div>

            <!-- Time & Solar Altitude -->
            <div class="flex items-baseline justify-between my-3">
              <div class="text-2xl font-black text-white font-mono tracking-tight">
                {{ card.timeStr }}
              </div>
              <span class="text-xs font-mono font-bold px-2.5 py-1 rounded-xl"
                    [class.bg-amber-500/20]="card.isDay"
                    [class.text-amber-300]="card.isDay"
                    [class.border]="true"
                    [class.border-amber-500/30]="card.isDay"
                    [class.bg-slate-800]="!card.isDay"
                    [class.text-slate-300]="!card.isDay"
                    [class.border-slate-700]="!card.isDay">
                {{ card.statusLabel }}
              </span>
            </div>

            <!-- Mini Solar Radian Diurnal Bar -->
            <div class="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden my-3 relative">
              <div class="h-full bg-gradient-to-r from-indigo-500 via-amber-400 to-indigo-500 transition-all duration-500"
                   [style.width.%]="card.daylightProgress * 100"></div>
            </div>

            <!-- Details Row -->
            <div class="grid grid-cols-2 gap-2 text-xs font-mono text-slate-400 pt-3 border-t border-white/5">
              <div>
                <span class="text-slate-500 block text-[10px]">SOLAR ELEVATION</span>
                <span class="text-slate-200 font-semibold">{{ card.solarAlt.toFixed(1) }}°</span>
              </div>
              <div>
                <span class="text-slate-500 block text-[10px]">TWILIGHT STATE</span>
                <span class="text-slate-200 capitalize">{{ card.twilight }}</span>
              </div>
            </div>

            <!-- Link to Explore City -->
            <div class="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
              <a [routerLink]="['/', card.loc.id]" class="text-xs text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1">
                <span>Open Observatory</span>
                <mat-icon class="text-sm">arrow_forward</mat-icon>
              </a>
            </div>

          </div>
        }
      </div>

    </div>
  `,
  styles: [`
    .dashboard-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
      color: #f1f5f9;
    }
  `]
})
export class DashboardComponent {
  private locationService = inject(LocationService);

  readonly allLocations = this.locationService.locations;
  readonly pinnedIds = signal<string[]>(['tokyo', 'london', 'newyork', 'paris', 'reykjavik', 'casablanca']);
  readonly selectedAddId = signal<string>('');

  readonly availableToAdd = computed(() => {
    const pinned = new Set(this.pinnedIds());
    return this.allLocations().filter(p => !pinned.has(p.id));
  });

  readonly cityCards = computed(() => {
    const ids = this.pinnedIds();
    const now = new Date();
    return ids.map(id => {
      const loc = this.allLocations().find(p => p.id === id) || this.allLocations()[0];
      const state = getCelestialState(now, loc.latitude, loc.longitude, loc.timezone);
      const isDay = state.sun.isAboveHorizon || state.twilightState === 'day' || state.twilightState === 'golden_hour';
      
      let timeStr = '';
      try {
        timeStr = now.toLocaleTimeString('en-US', {
          timeZone: loc.timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
      } catch {
        timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      let statusLabel = 'Night';
      if (state.sun.altitudeDeg > 0) statusLabel = 'Solar Day';
      else if (state.sun.altitudeDeg > -6) statusLabel = 'Civil Twilight';
      else if (state.sun.altitudeDeg > -12) statusLabel = 'Nautical Twilight';
      else if (state.sun.altitudeDeg > -18) statusLabel = 'Astro Twilight';

      return {
        loc,
        timeStr,
        isDay,
        solarAlt: state.sun.altitudeDeg,
        daylightProgress: state.daylightProgress,
        twilight: state.twilightState.replace(/_/g, ' '),
        statusLabel
      };
    });
  });

  addCityById(id: string): void {
    if (!id) return;
    this.pinnedIds.update(ids => ids.includes(id) ? ids : [...ids, id]);
    this.selectedAddId.set('');
  }

  removeCity(id: string): void {
    this.pinnedIds.update(ids => ids.filter(i => i !== id));
  }
}
