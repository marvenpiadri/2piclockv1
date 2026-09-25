import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { PwaService } from '../../../core/services/pwa.service';

@Component({
  selector: 'app-pwa-install',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Header Install Button (Shown on installable desktop/mobile or iOS) -->
    @if (!pwaService.isInstalled() && (pwaService.isInstallable() || pwaService.isIOS())) {
      <button 
        type="button" 
        (click)="pwaService.promptInstall()" 
        class="btn-pwa-install"
        title="Install 2piClock as a standalone App">
        <mat-icon class="install-icon">install_mobile</mat-icon>
        <span class="hidden sm:inline text-xs font-semibold">Install App</span>
      </button>
    }

    <!-- iOS Safari Step-by-Step Installation Modal -->
    @if (pwaService.showIOSModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md" (click)="pwaService.closeIOSModal()">
        <div class="w-full max-w-sm rounded-2xl bg-neutral-900 border border-white/15 p-6 shadow-2xl text-slate-100" (click)="$event.stopPropagation()">
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <mat-icon class="text-amber-400">add_to_home_screen</mat-icon>
              <h3 class="font-bold text-base text-white">Install on iPhone / iPad</h3>
            </div>
            <button type="button" (click)="pwaService.closeIOSModal()" class="text-slate-400 hover:text-white p-1">
              <mat-icon class="text-lg">close</mat-icon>
            </button>
          </div>

          <div class="py-4 space-y-3 text-xs leading-relaxed text-slate-300">
            <div class="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span class="flex items-center justify-center w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 font-mono font-bold text-xs shrink-0">1</span>
              <p>Tap the <strong class="text-white">Share</strong> button <mat-icon class="text-xs inline align-middle text-blue-400">ios_share</mat-icon> in Safari toolbar.</p>
            </div>

            <div class="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span class="flex items-center justify-center w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 font-mono font-bold text-xs shrink-0">2</span>
              <p>Scroll down and tap <strong class="text-white">Add to Home Screen</strong> <mat-icon class="text-xs inline align-middle text-amber-400">add_box</mat-icon>.</p>
            </div>

            <div class="flex items-start gap-3 p-2.5 rounded-xl bg-white/5 border border-white/5">
              <span class="flex items-center justify-center w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 font-mono font-bold text-xs shrink-0">3</span>
              <p>Launch <strong class="text-amber-300">2piClock</strong> anytime with full-screen horizon and offline ephemeris.</p>
            </div>
          </div>

          <button 
            type="button" 
            (click)="pwaService.closeIOSModal()"
            class="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs transition">
            Got it
          </button>
        </div>
      </div>
    }

    <!-- Offline Connectivity Toast Indicator -->
    @if (!pwaService.isOnline()) {
      <div class="fixed bottom-16 left-4 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs font-medium shadow-2xl backdrop-blur-md">
        <span class="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
        <span>Offline Mode — Running on local high-precision ephemeris engine.</span>
      </div>
    }
  `,
  styles: [`
    .btn-pwa-install {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fef08a;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-pwa-install:hover {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.35) 0%, rgba(217, 119, 6, 0.25) 100%);
      border-color: rgba(251, 191, 36, 0.7);
      transform: translateY(-1px);
    }
    .install-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #fbbf24;
    }
  `]
})
export class PwaInstallComponent {
  readonly pwaService = inject(PwaService);
}
