import { Injectable, signal, effect } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GlassThemeService {
  readonly isGlassEnabled = signal<boolean>(this.loadInitialGlassPreference());

  constructor() {
    effect(() => {
      const enabled = this.isGlassEnabled();
      try {
        localStorage.setItem('2piclock_glass_mode', enabled ? 'true' : 'false');
      } catch {
        // ignore storage errors
      }
      if (typeof document !== 'undefined') {
        if (enabled) {
          document.body.classList.add('glass-mode-active');
          document.body.classList.remove('glass-mode-disabled');
        } else {
          document.body.classList.remove('glass-mode-active');
          document.body.classList.add('glass-mode-disabled');
        }
      }
    });
  }

  toggleGlassMode(): void {
    this.isGlassEnabled.update(v => !v);
  }

  setGlassMode(enabled: boolean): void {
    this.isGlassEnabled.set(enabled);
  }

  private loadInitialGlassPreference(): boolean {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('2piclock_glass_mode');
      if (stored !== null) {
        return stored === 'true';
      }
    }
    return true; // default to glass enabled as requested
  }
}
