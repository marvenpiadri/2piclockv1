import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WeatherService } from '../../../core/services/weather.service';
import { GlassThemeService } from '../../../core/services/glass-theme.service';

@Component({
  selector: 'app-settings-modal',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="settings-backdrop" (click)="closeModal()">
      <section class="settings-sheet" role="dialog" aria-modal="true" aria-label="Settings" (click)="$event.stopPropagation()">
        <header class="settings-header">
          <div>
            <span class="settings-eyebrow">PREFERENCES</span>
            <h2>Settings</h2>
          </div>
          <button type="button" class="settings-close" (click)="closeModal()" aria-label="Close settings">
            <mat-icon>close</mat-icon>
          </button>
        </header>

        <div class="settings-list">
          <div class="settings-row">
            <div class="settings-copy"><span class="settings-icon"><mat-icon>thermostat</mat-icon></span><div><strong>Temperature</strong><small>Choose Celsius or Fahrenheit</small></div></div>
            <button type="button" class="settings-toggle" (click)="toggleTemperatureUnit()">{{ isFahrenheit() ? '°F' : '°C' }}</button>
          </div>
          <div class="settings-row">
            <div class="settings-copy"><span class="settings-icon"><mat-icon>grain</mat-icon></span><div><strong>Weather particles</strong><small>Rain, snow and atmospheric motion</small></div></div>
            <button type="button" class="settings-toggle" [class.active]="showParticles()" (click)="toggleParticles()">{{ showParticles() ? 'On' : 'Off' }}</button>
          </div>
          <div class="settings-row">
            <div class="settings-copy"><span class="settings-icon"><mat-icon>schedule</mat-icon></span><div><strong>Clock interface</strong><small>Switch between the polar and analog clock</small></div></div>
            <button type="button" class="settings-toggle" (click)="toggleClockMode()">{{ clockDisplayMode() === 'analog' ? 'Analog' : 'Polar' }}</button>
          </div>
          <div class="settings-row">
            <div class="settings-copy"><span class="settings-icon"><mat-icon>blur_on</mat-icon></span><div><strong>Glass interface</strong><small>Control the atmospheric glass treatment</small></div></div>
            <button type="button" class="settings-toggle" [class.active]="isGlassEnabled()" (click)="toggleGlassMode()">{{ isGlassEnabled() ? 'On' : 'Off' }}</button>
          </div>
        </div>

        <footer class="settings-footer">
          <span>Changes apply immediately</span>
          <button type="button" class="settings-done" (click)="closeModal()">Done</button>
        </footer>
      </section>
    </div>
  `,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 120; display: block; }
    .settings-backdrop { position: absolute; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(4,5,8,.62); backdrop-filter: blur(10px); }
    .settings-sheet { width: min(440px, calc(100vw - 32px)); color: #f5f5f5; background: rgba(12,14,18,.96); border: 1px solid rgba(255,255,255,.1); border-radius: 18px; box-shadow: 0 24px 80px rgba(0,0,0,.45); overflow: hidden; }
    .settings-header { display:flex; align-items:center; justify-content:space-between; padding:18px 20px; border-bottom:1px solid rgba(255,255,255,.07); }
    .settings-eyebrow { display:block; color:#777; font:700 8px/1 monospace; letter-spacing:.14em; text-transform:uppercase; margin-bottom:6px; }
    .settings-header h2 { margin:0; font:600 20px/1.1 system-ui,sans-serif; letter-spacing:-.02em; }
    .settings-close { width:30px; height:30px; display:grid; place-items:center; border:0; border-radius:8px; background:rgba(255,255,255,.05); color:#888; cursor:pointer; }
    .settings-close:hover { color:#fff; background:rgba(255,255,255,.09); }
    .settings-list { padding:8px 12px; }
    .settings-row { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:13px 8px; border-bottom:1px solid rgba(255,255,255,.055); }
    .settings-row:last-child { border-bottom:0; }
    .settings-copy { display:flex; align-items:center; gap:11px; min-width:0; }
    .settings-icon { width:30px; height:30px; flex:0 0 30px; display:grid; place-items:center; border-radius:9px; background:rgba(245,158,11,.08); color:#f5b23d; }
    .settings-icon mat-icon { font-size:17px; width:17px; height:17px; }
    .settings-copy div { display:flex; flex-direction:column; gap:4px; min-width:0; }
    .settings-copy strong { font:600 11px/1.1 system-ui,sans-serif; }
    .settings-copy small { color:#777; font:9px/1.25 monospace; }
    .settings-toggle { min-width:52px; padding:7px 10px; border:1px solid rgba(255,255,255,.1); border-radius:8px; background:rgba(255,255,255,.035); color:#aaa; font:700 9px monospace; cursor:pointer; transition:.16s ease; }
    .settings-toggle:hover { border-color:rgba(245,158,11,.35); color:#fff; }
    .settings-toggle.active { background:rgba(245,158,11,.13); border-color:rgba(245,158,11,.35); color:#f5b23d; }
    .settings-footer { display:flex; align-items:center; justify-content:space-between; padding:13px 20px 16px; border-top:1px solid rgba(255,255,255,.07); color:#666; font:8px monospace; }
    .settings-done { border:0; border-radius:8px; padding:8px 13px; background:#f59e0b; color:#111; font:800 9px monospace; cursor:pointer; }
    .settings-done:hover { background:#fbbf24; }
  `]
})
export class SettingsModalComponent {
  @Output() closeModalEvent = new EventEmitter<void>();
  private weatherService = inject(WeatherService);
  private glassThemeService = inject(GlassThemeService);

  readonly isFahrenheit = this.weatherService.isFahrenheit;
  readonly showParticles = signal<boolean>(true);
  readonly showWindVectors = signal<boolean>(false);
  readonly clockDisplayMode = signal<'analog' | 'radian'>('radian');
  readonly isGlassEnabled = this.glassThemeService.isGlassEnabled;

  toggleTemperatureUnit(): void { this.weatherService.toggleFahrenheit(); }
  toggleParticles(): void { this.showParticles.update(v => !v); }
  toggleWindVectors(): void { this.showWindVectors.update(v => !v); }
  toggleClockMode(): void { this.clockDisplayMode.update(m => m === 'analog' ? 'radian' : 'analog'); }
  toggleGlassMode(): void { this.glassThemeService.toggleGlassMode(); }
  closeModal(): void { this.closeModalEvent.emit(); }
}
