import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WeatherService } from '../../../core/services/weather.service';

@Component({
  selector: 'app-weather-alerts-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-all duration-200 animate-fade-in select-none"
      (click)="closeModal()">
      
      <!-- Modal Content Window -->
      <div 
        class="bg-neutral-950/95 border border-rose-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl max-w-lg w-full text-white relative overflow-hidden flex flex-col max-h-[85vh]"
        (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="flex items-center justify-between pb-3 border-b border-white/10">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
              <mat-icon class="text-lg">warning</mat-icon>
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-extrabold uppercase font-mono tracking-wider text-rose-300">
                Active Severe Weather Warnings
              </h3>
              <p class="text-[10px] text-neutral-400 font-mono">
                Real-Time Atmospheric Advisory Telemetry
              </p>
            </div>
          </div>

          <button 
            type="button" 
            (click)="closeModal()"
            class="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-all cursor-pointer">
            <mat-icon class="text-base">close</mat-icon>
          </button>
        </div>

        <!-- Alerts List Area -->
        <div class="my-4 space-y-3 overflow-y-auto pr-1">
          @if (activeAlerts().length === 0) {
            <div class="text-center py-8 text-neutral-400 font-mono text-xs">
              <mat-icon class="text-3xl text-emerald-400 mb-1">check_circle</mat-icon>
              <div>No Active Severe Weather Warnings</div>
              <div class="text-[10px] text-neutral-500">Atmospheric conditions are currently calm.</div>
            </div>
          } @else {
            @for (alert of activeAlerts(); track alert.id) {
              <div class="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/30 space-y-1.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    {{ alert.severity }}
                  </span>
                  <span class="text-[10px] text-neutral-400 font-mono">{{ alert.issuedAt }}</span>
                </div>
                <h4 class="text-sm font-extrabold text-white">{{ alert.title }}</h4>
                <p class="text-xs text-neutral-300 leading-relaxed font-sans">{{ alert.description }}</p>
              </div>
            }
          }
        </div>

        <!-- Footer -->
        <div class="pt-3 border-t border-white/10 flex items-center justify-between">
          <span class="text-[10px] font-mono text-neutral-400">Open-Meteo Advisory Alert Stream</span>
          <button 
            type="button" 
            (click)="closeModal()"
            class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer">
            Dismiss
          </button>
        </div>

      </div>
    </div>
  `
})
export class WeatherAlertsModalComponent {
  @Output() closeModalEvent = new EventEmitter<void>();

  private weatherService = inject(WeatherService);
  readonly activeAlerts = this.weatherService.activeAlerts;

  closeModal(): void {
    this.closeModalEvent.emit();
  }
}
