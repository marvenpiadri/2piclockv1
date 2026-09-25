import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WeatherService } from '../../../core/services/weather.service';
import { CountryFlagComponent } from '../country-flag/country-flag';
import { WeatherIconComponent } from '../weather-icon/weather-icon';

@Component({
  selector: 'app-weather-overlay',
  standalone: true,
  imports: [CommonModule, MatIconModule, CountryFlagComponent, WeatherIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="weather-overlay-hud p-4 rounded-3xl bg-slate-950/90 border border-white/15 backdrop-blur-2xl shadow-2xl flex flex-col gap-3 max-w-sm text-slate-100 font-sans select-none animate-fadeIn">
      <!-- Header: Location & Conditions -->
      <div class="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div class="flex items-center gap-2.5">
          <app-country-flag [countryCode]="countryCode()" [customClass]="'w-5 h-3.5 rounded-xs shadow-xs'"></app-country-flag>
          <div class="flex flex-col">
            <span class="text-xs font-bold text-white tracking-tight leading-tight">{{ locationName() }}</span>
            <span class="text-[10px] text-amber-400 font-mono">Atmospheric Layer · Real-Time Telemetry</span>
          </div>
        </div>

        <button type="button" (click)="closeOverlay.emit()" class="p-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white transition-all cursor-pointer">
          <mat-icon class="text-sm w-4 h-4 flex items-center justify-center">close</mat-icon>
        </button>
      </div>

      <!-- Main Temperature & Dynamic Weather Icon Display -->
      <div class="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300">
            <app-weather-icon [condition]="weather().condition" [label]="weather().conditionLabel" size="lg"></app-weather-icon>
          </div>

          <div class="flex flex-col">
            <div class="text-2xl font-extrabold font-mono text-white tracking-tight leading-none">
              {{ isFahrenheit() ? weather().temperatureF + '°F' : weather().temperatureC + '°C' }}
            </div>
            <span class="text-xs text-slate-300 mt-1 font-medium">{{ weather().conditionLabel }}</span>
          </div>
        </div>

        <button type="button" (click)="toggleUnit()" class="px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono font-bold text-amber-300 border border-amber-400/30 cursor-pointer transition-all">
          °{{ isFahrenheit() ? 'F' : 'C' }}
        </button>
      </div>

      <!-- Real-Time Atmospheric Metrics Grid (Pressure, Humidity, Wind) -->
      <div class="grid grid-cols-3 gap-2">
        <!-- Wind Speed & Gust -->
        <div class="p-2.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center text-center gap-0.5">
          <app-weather-icon icon="wind" label="Wind" size="sm"></app-weather-icon>
          <span class="text-[10px] text-slate-400 font-mono">Wind</span>
          <span class="text-xs font-bold font-mono text-white">{{ weather().windSpeedKmh }} <span class="text-[9px] text-slate-400">km/h</span></span>
          <span class="text-[9px] text-cyan-300 font-mono">Gust {{ weather().windGustKmh || weather().windSpeedKmh }}</span>
        </div>

        <!-- Barometric Pressure -->
        <div class="p-2.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center text-center gap-0.5">
          <app-weather-icon icon="barometer" label="Pressure" size="sm"></app-weather-icon>
          <span class="text-[10px] text-slate-400 font-mono">Pressure</span>
          <span class="text-xs font-bold font-mono text-white">{{ weather().pressureHpa }}</span>
          <span class="text-[9px] text-amber-300 font-mono">hPa (MSLP)</span>
        </div>

        <!-- Relative Humidity -->
        <div class="p-2.5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center text-center gap-0.5">
          <app-weather-icon icon="humidity" label="Humidity" size="sm"></app-weather-icon>
          <span class="text-[10px] text-slate-400 font-mono">Humidity</span>
          <span class="text-xs font-bold font-mono text-white">{{ weather().humidityPct }}%</span>
          <span class="text-[9px] text-sky-300 font-mono">Dew point</span>
        </div>
      </div>

      <!-- Cloud Cover & Optical Visibility -->
      <div class="grid grid-cols-2 gap-2">
        <div class="p-2.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <app-weather-icon icon="cloudy" label="Cloud cover" size="sm"></app-weather-icon>
            <span class="text-[11px] text-slate-300 font-medium">Cloud Cover</span>
          </div>
          <span class="text-xs font-bold font-mono text-white">{{ weather().cloudCoverPct }}%</span>
        </div>

        <div class="p-2.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <app-weather-icon icon="visibility" label="Visibility" size="sm"></app-weather-icon>
            <span class="text-[11px] text-slate-300 font-medium">Visibility</span>
          </div>
          <span class="text-xs font-bold font-mono text-white">{{ weather().visibilityKm }} km</span>
        </div>
      </div>

      <!-- Storm Severity & Aggressiveness Index Bar -->
      <div class="p-3 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-1.5">
        <div class="flex items-center justify-between text-xs">
          <span class="text-slate-300 font-medium flex items-center gap-1.5">
            <app-weather-icon icon="thunderstorms-day-rain" label="Storm intensity" size="sm"></app-weather-icon>
            <span>Storm Aggressiveness</span>
          </span>
          <span class="font-mono font-bold text-amber-300">{{ weather().aggressivenessIndex }}/100</span>
        </div>

        <div class="w-full h-2 rounded-full bg-white/10 overflow-hidden">
          <div 
            class="h-full rounded-full transition-all duration-500"
            [class.bg-emerald-400]="weather().aggressivenessIndex < 30"
            [class.bg-amber-400]="weather().aggressivenessIndex >= 30 && weather().aggressivenessIndex < 65"
            [class.bg-rose-500]="weather().aggressivenessIndex >= 65"
            [style.width.%]="weather().aggressivenessIndex">
          </div>
        </div>

        <div class="flex justify-between text-[9px] text-slate-400 font-mono mt-0.5">
          <span>Calm</span>
          <span>Moderate</span>
          <span class="text-rose-400 font-bold">Severe Squall</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class WeatherOverlayComponent {
  readonly weatherService = inject(WeatherService);

  locationName = input<string>('Current Location');
  countryCode = input<string>('US');
  
  closeOverlay = output<void>();

  readonly weather = this.weatherService.currentWeather;
  readonly isFahrenheit = signal<boolean>(false);

  toggleUnit(): void {
    this.isFahrenheit.update(v => !v);
  }

  weatherIconColor(condition: string): string {
    const c = condition.toLowerCase();
    if (c.includes('thunder') || c.includes('storm')) return '#a78bfa';
    if (c.includes('rain') || c.includes('drizzle')) return '#38bdf8';
    if (c.includes('snow') || c.includes('blizzard')) return '#e2e8f0';
    if (c.includes('fog') || c.includes('haze')) return '#cbd5e1';
    if (c.includes('cloud')) return '#94a3b8';
    return '#fbbf24';
  }
}
