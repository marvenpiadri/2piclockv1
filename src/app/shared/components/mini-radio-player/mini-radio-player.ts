import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { RadioService } from '../../../core/services/radio.service';

@Component({
  selector: 'app-mini-radio-player',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (currentStation()) {
      <aside class="mini-player-bar glass-panel" role="region" aria-label="Global Radio Player">
        <div class="mini-player-inner">
          
          <!-- Station & Live Info -->
          <div class="station-meta-zone" [routerLink]="['/radio']" [queryParams]="{ tab: 'explore' }">
            <div class="live-dot-wrap">
              @if (isLoading()) {
                <span class="mini-dot loading"></span>
              } @else if (isPlaying()) {
                <span class="mini-dot live"></span>
              } @else {
                <span class="mini-dot paused"></span>
              }
            </div>

            <div class="station-text-group">
              <div class="station-title-line">
                <strong class="station-name-text">{{ currentStation()?.name }}</strong>
                <span class="loc-sub font-mono">· {{ currentStation()?.city }}</span>
              </div>
              
              @if (playingContext(); as ctx) {
                <div class="station-context-line font-mono">
                  <span>{{ ctx.localTime }}</span>
                  <span class="sep">·</span>
                  <span class="text-amber-400/90">{{ ctx.astroState }}</span>
                  <span class="sep">·</span>
                  <span>{{ ctx.station.country }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Controls -->
          <div class="controls-zone">
            <!-- Play / Pause -->
            <button 
              type="button" 
              class="mini-play-btn" 
              [attr.aria-label]="isPlaying() ? 'Pause Audio' : 'Resume Audio'"
              (click)="togglePlay()">
              <mat-icon>{{ isPlaying() ? 'pause' : 'play_arrow' }}</mat-icon>
            </button>

            <!-- Mute / Unmute -->
            <button 
              type="button" 
              class="mini-icon-btn" 
              [attr.aria-label]="isMuted() ? 'Unmute' : 'Mute'"
              (click)="toggleMute()">
              <mat-icon>{{ isMuted() || volume() === 0 ? 'volume_off' : 'volume_up' }}</mat-icon>
            </button>

            <!-- Expand to /radio -->
            <a 
              [routerLink]="['/radio']" 
              class="mini-icon-btn" 
              title="Open Planetary Radio Studio"
              aria-label="Open Radio Studio">
              <mat-icon>open_in_new</mat-icon>
            </a>

            <!-- Dismiss / Stop -->
            <button 
              type="button" 
              class="mini-icon-btn close-btn" 
              title="Stop and Close Player"
              aria-label="Stop Radio"
              (click)="stop()">
              <mat-icon>close</mat-icon>
            </button>
          </div>

        </div>
      </aside>
    }
  `,
  styles: [`
    .mini-player-bar {
      position: fixed;
      bottom: 18px;
      right: 18px;
      z-index: 1000;
      max-width: calc(100vw - 36px);
      width: 380px;
      padding: 10px 14px;
      background: rgba(13, 17, 24, 0.94);
      border: 1px solid rgba(245, 158, 11, 0.3);
      border-radius: var(--radius-lg);
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65);
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .mini-player-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .station-meta-zone {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      min-width: 0;
      flex: 1;
    }

    .live-dot-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .mini-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }

    .mini-dot.live {
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
      animation: miniPulse 1.8s infinite;
    }

    .mini-dot.loading {
      background: var(--2pi-amber-bright);
      animation: miniPulse 0.8s infinite;
    }

    .mini-dot.paused {
      background: #64748b;
    }

    @keyframes miniPulse {
      0% { transform: scale(0.9); opacity: 0.8; }
      50% { transform: scale(1.3); opacity: 1; }
      100% { transform: scale(0.9); opacity: 0.8; }
    }

    .station-text-group {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .station-title-line {
      display: flex;
      align-items: baseline;
      gap: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .station-name-text {
      font-size: 13px;
      color: #ffffff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .loc-sub {
      font-size: 11px;
      color: var(--2pi-amber-bright);
      flex-shrink: 0;
    }

    .station-context-line {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 10px;
      color: var(--2pi-muted);
    }

    .sep {
      opacity: 0.5;
    }

    .controls-zone {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .mini-play-btn {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--2pi-amber-bright);
      color: #07090e;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: transform 0.15s ease;
    }

    .mini-play-btn:hover {
      transform: scale(1.08);
    }

    .mini-play-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .mini-icon-btn {
      background: transparent;
      border: none;
      color: var(--2pi-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      border-radius: 50%;
      cursor: pointer;
      transition: color 0.15s ease;
    }

    .mini-icon-btn:hover {
      color: #ffffff;
    }

    .mini-icon-btn mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .close-btn:hover {
      color: #f87171;
    }
  `]
})
export class MiniRadioPlayerComponent {
  readonly radioService = inject(RadioService);

  readonly currentStation = this.radioService.currentStation;
  readonly isPlaying = this.radioService.isPlaying;
  readonly isLoading = this.radioService.isLoading;
  readonly volume = this.radioService.volume;
  readonly isMuted = this.radioService.isMuted;
  readonly playingContext = this.radioService.playingLocationContext;

  togglePlay(): void {
    this.radioService.togglePlay();
  }

  toggleMute(): void {
    this.radioService.toggleMute();
  }

  stop(): void {
    this.radioService.stop();
  }
}
