import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { AtmosphereAudioService, ASMRSoundType } from '../../../core/services/atmosphere-audio.service';

@Component({
  selector: 'app-asmr-player',
  standalone: true,
  imports: [CommonModule, MatIconModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative shrink-0">
      <!-- Header Compact Button Trigger -->
      <button 
        type="button" 
        (click)="toggleMenu()"
        class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-slate-200 hover:text-white transition-all cursor-pointer group"
        [class.ring-1]="isOpen()"
        [class.ring-sky-400/50]="isOpen()"
        [class.bg-sky-500/15]="audioService.isPlaying()"
        [class.border-sky-400/40]="audioService.isPlaying()">
        
        <mat-icon class="text-sky-400 text-[16px] w-4 h-4" [class.animate-pulse]="audioService.isPlaying()">
          {{ audioService.isPlaying() ? 'graphic_eq' : 'headset' }}
        </mat-icon>
        
        <span class="hidden sm:inline font-mono">ASMR Sky Sound</span>
        
        @if (audioService.isPlaying()) {
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
        }

        <mat-icon class="text-slate-400 text-[14px] w-3.5 h-3.5">expand_more</mat-icon>
      </button>

      <!-- Dropdown Control Card -->
      @if (isOpen()) {
        <div class="absolute right-0 top-full mt-2 w-72 p-3.5 rounded-2xl bg-slate-950/95 border border-white/15 backdrop-blur-2xl shadow-2xl z-50 flex flex-col gap-3" (click)="$event.stopPropagation()">
          
          <div class="flex items-center justify-between pb-2 border-b border-white/10">
            <div class="flex items-center gap-2">
              <mat-icon class="text-sky-400 text-sm">graphic_eq</mat-icon>
              <span class="text-xs font-mono font-bold text-white uppercase tracking-wider">Atmospheric ASMR Audio</span>
            </div>
            <button type="button" class="text-slate-400 hover:text-white p-0.5 cursor-pointer" (click)="closeMenu()">
              <mat-icon class="text-xs">close</mat-icon>
            </button>
          </div>

          <!-- Quick Play/Pause Big Bar -->
          <div class="flex items-center justify-between p-2.5 rounded-xl bg-sky-500/10 border border-sky-400/20">
            <div class="flex flex-col">
              <span class="text-xs font-bold text-white flex items-center gap-1.5">
                {{ getSoundLabel(audioService.soundType()) }}
              </span>
              <span class="text-[10px] text-sky-200/80">Procedural ASMR Ambiance</span>
            </div>

            <button 
              type="button" 
              (click)="audioService.togglePlay()"
              class="w-8 h-8 rounded-full bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold flex items-center justify-center transition-transform hover:scale-105 cursor-pointer shadow-md shadow-sky-400/30">
              <mat-icon class="text-lg">{{ audioService.isPlaying() ? 'pause' : 'play_arrow' }}</mat-icon>
            </button>
          </div>

          <!-- Sound Selector Buttons -->
          <div class="flex flex-col gap-1">
            <span class="text-[10px] font-mono text-slate-400 uppercase tracking-wider px-1">Ambience Preset</span>
            <div class="grid grid-cols-2 gap-1.5">
              <button 
                type="button" 
                (click)="selectSound('rain')"
                class="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all border"
                [class.bg-sky-500/20]="audioService.soundType() === 'rain'"
                [class.border-sky-400/40]="audioService.soundType() === 'rain'"
                [class.text-sky-300]="audioService.soundType() === 'rain'"
                [class.bg-white/[0.03]]="audioService.soundType() !== 'rain'"
                [class.border-white/5]="audioService.soundType() !== 'rain'"
                [class.text-slate-300]="audioService.soundType() !== 'rain'">
                <mat-icon class="text-sm">water_drop</mat-icon>
                <span>Rainfall</span>
              </button>

              <button 
                type="button" 
                (click)="selectSound('breeze')"
                class="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all border"
                [class.bg-sky-500/20]="audioService.soundType() === 'breeze'"
                [class.border-sky-400/40]="audioService.soundType() === 'breeze'"
                [class.text-sky-300]="audioService.soundType() === 'breeze'"
                [class.bg-white/[0.03]]="audioService.soundType() !== 'breeze'"
                [class.border-white/5]="audioService.soundType() !== 'breeze'"
                [class.text-slate-300]="audioService.soundType() !== 'breeze'">
                <mat-icon class="text-sm">air</mat-icon>
                <span>Solar Breeze</span>
              </button>

              <button 
                type="button" 
                (click)="selectSound('night')"
                class="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all border"
                [class.bg-sky-500/20]="audioService.soundType() === 'night'"
                [class.border-sky-400/40]="audioService.soundType() === 'night'"
                [class.text-sky-300]="audioService.soundType() === 'night'"
                [class.bg-white/[0.03]]="audioService.soundType() !== 'night'"
                [class.border-white/5]="audioService.soundType() !== 'night'"
                [class.text-slate-300]="audioService.soundType() !== 'night'">
                <mat-icon class="text-sm">nights_stay</mat-icon>
                <span>Deep Night</span>
              </button>

              <button 
                type="button" 
                (click)="selectSound('custom')"
                class="px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-all border"
                [class.bg-sky-500/20]="audioService.soundType() === 'custom'"
                [class.border-sky-400/40]="audioService.soundType() === 'custom'"
                [class.text-sky-300]="audioService.soundType() === 'custom'"
                [class.bg-white/[0.03]]="audioService.soundType() !== 'custom'"
                [class.border-white/5]="audioService.soundType() !== 'custom'"
                [class.text-slate-300]="audioService.soundType() !== 'custom'">
                <mat-icon class="text-sm">add_circle_outline</mat-icon>
                <span>ASMR Hook</span>
              </button>
            </div>
          </div>

          <!-- Volume Control -->
          <div class="flex items-center gap-2 pt-1">
            <button 
              type="button" 
              (click)="audioService.toggleMute()" 
              class="text-slate-400 hover:text-white p-1 cursor-pointer">
              <mat-icon class="text-sm">{{ audioService.isMuted() ? 'volume_off' : 'volume_up' }}</mat-icon>
            </button>
            <input 
              type="range" 
              min="0" 
              max="100" 
              [value]="audioService.volume()" 
              (input)="onVolumeChange($event)"
              class="w-full accent-sky-400 h-1 rounded-lg bg-slate-800 cursor-pointer" />
            <span class="text-[10px] font-mono text-slate-400 w-8 text-right">{{ audioService.volume() }}%</span>
          </div>

          <!-- Custom Sound Extension Info -->
          <div class="p-2 rounded-xl bg-amber-400/10 border border-amber-400/20 text-[10px] text-amber-300 leading-tight">
            💡 <strong>ASMR Extension Ready:</strong> Plug in your external rain or storm audio track anytime via extension hook.
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: inline-block;
    }
  `]
})
export class ASMRPlayerComponent {
  readonly audioService = inject(AtmosphereAudioService);
  readonly isOpen = signal<boolean>(false);

  toggleMenu(): void {
    this.isOpen.update(v => !v);
  }

  closeMenu(): void {
    this.isOpen.set(false);
  }

  selectSound(type: ASMRSoundType): void {
    this.audioService.setSoundType(type);
    if (!this.audioService.isPlaying()) {
      this.audioService.play();
    }
  }

  onVolumeChange(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.audioService.setVolume(val);
  }

  getSoundLabel(type: ASMRSoundType): string {
    switch (type) {
      case 'rain': return '🌧 Soft Rain ASMR';
      case 'breeze': return '💨 Solar Breeze ASMR';
      case 'night': return '🌌 Starlight Night ASMR';
      case 'custom': return '🎵 Custom ASMR Slot';
      default: return '🔇 Silent Mode';
    }
  }
}
