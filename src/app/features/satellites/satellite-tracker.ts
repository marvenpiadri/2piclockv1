import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';

export interface SatellitePass {
  name: string;
  category: 'Space Station' | 'Observatory' | 'Mega-Constellation';
  date: string;
  startTime: string;
  maxElevationDeg: number;
  durationMins: number;
  magnitude: number;
  riseDirection: string;
  setDirection: string;
  isNakedEyeVisible: boolean;
  brightnessLabel: 'Blindingly Bright' | 'Very Bright' | 'Moderately Bright' | 'Faint';
}

@Component({
  selector: 'app-satellite-tracker',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="satellites-container">
      
      <!-- Header -->
      <header class="satellites-header">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300">
            <mat-icon class="text-xl">satellite_alt</mat-icon>
          </div>
          <div>
            <h1 class="text-xl md:text-2xl font-bold tracking-tight text-white font-sans flex items-center gap-2">
              <span>ISS & Satellite Visual Pass Tracker</span>
              <span class="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 font-mono">LEO Ephemeris</span>
            </h1>
            <p class="text-xs text-slate-400 font-mono">
              Orbital Pass Predictions over {{ selectedLocation().name }} ({{ selectedLocation().latitude.toFixed(2) }}°, {{ selectedLocation().longitude.toFixed(2) }}°)
            </p>
          </div>
        </div>
      </header>

      <!-- Next ISS Pass Hero -->
      <div class="iss-hero my-6 p-6 rounded-3xl bg-gradient-to-br from-cyan-950/40 via-slate-900/90 to-slate-950 border border-cyan-500/30 backdrop-blur-xl shadow-2xl">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <span class="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono text-xs font-bold uppercase">
                Prime Target Pass
              </span>
              <span class="text-xs font-mono text-slate-400">International Space Station (ISS)</span>
            </div>
            <h2 class="text-2xl md:text-3xl font-extrabold text-white font-sans">
              ISS Visible Pass Tonight at {{ nextISSPass().startTime }}
            </h2>
            <p class="text-xs text-slate-300 mt-2 max-w-xl leading-relaxed">
              The ISS will streak across the sky reaching a peak altitude of {{ nextISSPass().maxElevationDeg }}° above the horizon with an apparent magnitude of {{ nextISSPass().magnitude }}.
            </p>
          </div>

          <div class="flex flex-col items-start md:items-end gap-2 bg-white/5 p-4 rounded-2xl border border-white/10 shrink-0">
            <span class="text-xs font-mono text-slate-400 uppercase">Max Elevation</span>
            <span class="text-2xl font-extrabold text-cyan-300 font-mono">{{ nextISSPass().maxElevationDeg }}°</span>
            <span class="text-xs font-mono text-emerald-400 font-semibold">{{ nextISSPass().brightnessLabel }}</span>
          </div>
        </div>
      </div>

      <!-- Passes Matrix -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-base font-bold text-white font-sans flex items-center gap-2">
            <mat-icon class="text-cyan-400 text-lg">track_changes</mat-icon>
            <span>Upcoming Low Earth Orbit (LEO) Passes</span>
          </h3>
          <span class="text-xs text-slate-400 font-mono">Next 48 Hours</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (pass of passes; track pass.name + pass.startTime) {
            <div class="pass-card p-5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-xl hover:border-cyan-500/30 transition">
              <div class="flex items-start justify-between">
                <div>
                  <h4 class="font-bold text-sm text-white">{{ pass.name }}</h4>
                  <span class="text-xs font-mono text-cyan-300">{{ pass.category }}</span>
                </div>
                <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                  Mag {{ pass.magnitude }}
                </span>
              </div>

              <div class="my-3 space-y-1">
                <div class="flex items-center justify-between text-xs font-mono">
                  <span class="text-slate-400">Pass Time:</span>
                  <strong class="text-white">{{ pass.startTime }}</strong>
                </div>
                <div class="flex items-center justify-between text-xs font-mono">
                  <span class="text-slate-400">Peak Elevation:</span>
                  <strong class="text-cyan-300">{{ pass.maxElevationDeg }}°</strong>
                </div>
                <div class="flex items-center justify-between text-xs font-mono">
                  <span class="text-slate-400">Duration:</span>
                  <strong class="text-slate-300">{{ pass.durationMins }} mins</strong>
                </div>
              </div>

              <div class="flex items-center justify-between text-xs font-mono text-slate-400 pt-2 border-t border-white/5">
                <span>{{ pass.riseDirection }} &rarr; {{ pass.setDirection }}</span>
                <span class="text-emerald-400 font-semibold">{{ pass.brightnessLabel }}</span>
              </div>
            </div>
          }
        </div>
      </div>

    </div>
  `,
  styles: [`
    .satellites-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
      color: #f1f5f9;
    }
  `]
})
export class SatelliteTrackerComponent {
  private locationService = inject(LocationService);
  readonly selectedLocation = this.locationService.selectedLocation;

  readonly passes: SatellitePass[] = [
    {
      name: 'International Space Station (ISS)',
      category: 'Space Station',
      date: 'Tonight',
      startTime: '21:14 PM',
      maxElevationDeg: 68,
      durationMins: 6,
      magnitude: -3.4,
      riseDirection: 'WSW',
      setDirection: 'ENE',
      isNakedEyeVisible: true,
      brightnessLabel: 'Blindingly Bright'
    },
    {
      name: 'Tiangong Space Station (CSS)',
      category: 'Space Station',
      date: 'Tonight',
      startTime: '22:42 PM',
      maxElevationDeg: 49,
      durationMins: 5,
      magnitude: -1.8,
      riseDirection: 'SW',
      setDirection: 'E',
      isNakedEyeVisible: true,
      brightnessLabel: 'Very Bright'
    },
    {
      name: 'Hubble Space Telescope (HST)',
      category: 'Observatory',
      date: 'Tomorrow',
      startTime: '04:18 AM',
      maxElevationDeg: 34,
      durationMins: 4,
      magnitude: 1.5,
      riseDirection: 'SSW',
      setDirection: 'SE',
      isNakedEyeVisible: true,
      brightnessLabel: 'Moderately Bright'
    },
    {
      name: 'Starlink G10-5 Train',
      category: 'Mega-Constellation',
      date: 'Tonight',
      startTime: '20:45 PM',
      maxElevationDeg: 54,
      durationMins: 5,
      magnitude: 2.1,
      riseDirection: 'NW',
      setDirection: 'SE',
      isNakedEyeVisible: true,
      brightnessLabel: 'Moderately Bright'
    },
    {
      name: 'Terra (EOS AM-1)',
      category: 'Observatory',
      date: 'Tomorrow',
      startTime: '22:05 PM',
      maxElevationDeg: 42,
      durationMins: 5,
      magnitude: 2.8,
      riseDirection: 'N',
      setDirection: 'S',
      isNakedEyeVisible: false,
      brightnessLabel: 'Faint'
    }
  ];

  readonly nextISSPass = computed(() => this.passes[0]);
}
