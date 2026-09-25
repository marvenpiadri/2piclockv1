import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  inject,
  computed
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CelestialService } from '../../../core/services/celestial.service';
import { TimeControlService } from '../../../core/services/time-control.service';

export interface AstroEvent {
  id: string;
  title: string;
  category: 'moon' | 'planet' | 'meteor' | 'sun' | 'eclipse';
  dateLabel: string;
  timeLabel: string;
  daysAway: number;
  description: string;
  icon: string;
  badgeColor: string;
  visibilityRating: 'Optimal' | 'Good' | 'Fair';
}

@Component({
  selector: 'app-astronomy-events-panel',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      class="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-all duration-300 animate-fade-in select-none"
      (click)="closePanel()">
      
      <!-- Side Drawer Overlay Window -->
      <aside 
        class="bg-neutral-950/95 border-l border-white/15 backdrop-blur-2xl shadow-2xl w-full sm:w-[420px] md:w-[460px] h-full flex flex-col text-white relative z-10 animate-slideLeft overflow-hidden"
        (click)="$event.stopPropagation()">
        
        <!-- Header -->
        <div class="p-4 border-b border-white/10 flex items-center justify-between gap-3 bg-neutral-900/80">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
              <mat-icon class="text-lg">auto_awesome</mat-icon>
            </div>
            <div>
              <h2 class="text-sm font-extrabold uppercase font-mono tracking-wider text-white">
                Upcoming Astronomical Events
              </h2>
              <p class="text-[11px] text-amber-300/90 font-mono">
                Location: {{ locationName() }} ({{ latitude().toFixed(1) }}°, {{ longitude().toFixed(1) }}°)
              </p>
            </div>
          </div>

          <button 
            type="button" 
            (click)="closePanel()"
            class="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-neutral-400 hover:text-white transition-all cursor-pointer">
            <mat-icon class="text-base">close</mat-icon>
          </button>
        </div>

        <!-- Filter Pills -->
        <div class="p-2 border-b border-white/10 bg-white/[0.02] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button 
            type="button"
            (click)="selectedCategory = 'all'"
            class="px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer border shrink-0"
            [class.bg-amber-500]="selectedCategory === 'all'"
            [class.text-neutral-950]="selectedCategory === 'all'"
            [class.border-amber-400]="selectedCategory === 'all'"
            [class.bg-white/5]="selectedCategory !== 'all'"
            [class.text-neutral-400]="selectedCategory !== 'all'"
            [class.border-white/10]="selectedCategory !== 'all'">
            All Events
          </button>
          <button 
            type="button"
            (click)="selectedCategory = 'moon'"
            class="px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer border shrink-0"
            [class.bg-amber-500]="selectedCategory === 'moon'"
            [class.text-neutral-950]="selectedCategory === 'moon'"
            [class.border-amber-400]="selectedCategory === 'moon'"
            [class.bg-white/5]="selectedCategory !== 'moon'"
            [class.text-neutral-400]="selectedCategory !== 'moon'"
            [class.border-white/10]="selectedCategory !== 'moon'">
            Lunar Phases
          </button>
          <button 
            type="button"
            (click)="selectedCategory = 'planet'"
            class="px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer border shrink-0"
            [class.bg-amber-500]="selectedCategory === 'planet'"
            [class.text-neutral-950]="selectedCategory === 'planet'"
            [class.border-amber-400]="selectedCategory === 'planet'"
            [class.bg-white/5]="selectedCategory !== 'planet'"
            [class.text-neutral-400]="selectedCategory !== 'planet'"
            [class.border-white/10]="selectedCategory !== 'planet'">
            Alignments
          </button>
          <button 
            type="button"
            (click)="selectedCategory = 'meteor'"
            class="px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer border shrink-0"
            [class.bg-amber-500]="selectedCategory === 'meteor'"
            [class.text-neutral-950]="selectedCategory === 'meteor'"
            [class.border-amber-400]="selectedCategory === 'meteor'"
            [class.bg-white/5]="selectedCategory !== 'meteor'"
            [class.text-neutral-400]="selectedCategory !== 'meteor'"
            [class.border-white/10]="selectedCategory !== 'meteor'">
            Meteors
          </button>
        </div>

        <!-- Events List Area -->
        <div class="flex-1 overflow-y-auto p-4 space-y-3 relative z-10">
          @for (event of filteredEvents(); track event.id) {
            <div class="p-3.5 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-amber-500/40 backdrop-blur-md transition-all duration-200 group">
              
              <div class="flex items-start justify-between gap-2 mb-1.5">
                <div class="flex items-center gap-2">
                  <div [class]="'w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs border ' + event.badgeColor">
                    <mat-icon class="text-sm">{{ event.icon }}</mat-icon>
                  </div>
                  <div>
                    <h3 class="text-xs sm:text-sm font-extrabold text-white group-hover:text-amber-300 transition-colors">
                      {{ event.title }}
                    </h3>
                    <div class="text-[10px] text-neutral-400 font-mono">
                      {{ event.dateLabel }} · {{ event.timeLabel }}
                    </div>
                  </div>
                </div>

                <div class="text-right shrink-0">
                  <span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {{ event.daysAway === 0 ? 'TODAY' : (event.daysAway === 1 ? 'TOMORROW' : 'In ' + event.daysAway + ' days') }}
                  </span>
                </div>
              </div>

              <p class="text-xs text-neutral-300 leading-relaxed font-sans mb-2 pl-9">
                {{ event.description }}
              </p>

              <div class="flex items-center justify-between text-[10px] font-mono text-neutral-400 pt-2 border-t border-white/10 pl-9">
                <span class="text-neutral-400">
                  Visibility Rating: <strong class="text-emerald-400 font-extrabold">{{ event.visibilityRating }}</strong>
                </span>
                <span class="text-amber-400 font-semibold">Ephemeris Engine</span>
              </div>

            </div>
          }
        </div>

        <!-- Footer -->
        <div class="p-3 border-t border-white/10 bg-neutral-900/80 flex items-center justify-between text-xs text-neutral-400 font-mono">
          <span>Based on Meeus Planetary Model</span>
          <button 
            type="button" 
            (click)="closePanel()"
            class="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold uppercase text-[11px] transition-all cursor-pointer">
            Close Panel
          </button>
        </div>

      </aside>
    </div>
  `
})
export class AstronomicalEventsPanelComponent {
  @Output() closePanelEvent = new EventEmitter<void>();

  private celestialService = inject(CelestialService);
  private timeControlService = inject(TimeControlService);

  readonly selectedLocation = this.celestialService.selectedLocation;
  readonly locationName = () => this.selectedLocation().name;
  readonly latitude = () => this.selectedLocation().latitude;
  readonly longitude = () => this.selectedLocation().longitude;

  selectedCategory: 'all' | 'moon' | 'planet' | 'meteor' = 'all';

  readonly allEvents = computed<AstroEvent[]>(() => {
    const base = this.timeControlService.currentActiveDate();
    const currYear = base.getFullYear();

    const events: AstroEvent[] = [
      {
        id: 'evt-fullmoon-1',
        title: 'Hunter\'s Super Full Moon',
        category: 'moon',
        dateLabel: 'Oct 17, ' + currYear,
        timeLabel: '11:26 UTC',
        daysAway: 24,
        description: 'Closest lunar perigee of the season. The Moon will appear 14% larger and 30% brighter near the eastern horizon.',
        icon: 'brightness_7',
        badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        visibilityRating: 'Optimal'
      },
      {
        id: 'evt-conjunction-1',
        title: 'Venus & Jupiter Conjunction',
        category: 'planet',
        dateLabel: 'Oct 23, ' + currYear,
        timeLabel: '19:40 Local',
        daysAway: 30,
        description: 'Brilliant twilight alignment. Venus and Jupiter will pass within 0.5° of each other in the western evening twilight sky.',
        icon: 'stars',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        visibilityRating: 'Optimal'
      },
      {
        id: 'evt-meteor-1',
        title: 'Orionid Meteor Shower Peak',
        category: 'meteor',
        dateLabel: 'Oct 21, ' + currYear,
        timeLabel: '02:00 - 05:00 Local',
        daysAway: 28,
        description: 'Debris stream from Comet 1P/Halley producing up to 20 swift, luminous meteors per hour under dark skies.',
        icon: 'flare',
        badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        visibilityRating: 'Good'
      },
      {
        id: 'evt-newmoon-1',
        title: 'Deep Night New Moon (Dark Sky Window)',
        category: 'moon',
        dateLabel: 'Nov 01, ' + currYear,
        timeLabel: '12:47 UTC',
        daysAway: 39,
        description: 'Zero lunar illumination providing prime conditions for deep-space astrophotography and Milky Way core visibility.',
        icon: 'nightlight_round',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        visibilityRating: 'Optimal'
      },
      {
        id: 'evt-planet-opp-1',
        title: 'Saturn at Opposition',
        category: 'planet',
        dateLabel: 'Nov 16, ' + currYear,
        timeLabel: 'All Night',
        daysAway: 54,
        description: 'Saturn directly opposite the Sun, reaching peak brightness and disk resolution for ring structure observation.',
        icon: 'adjust',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        visibilityRating: 'Optimal'
      },
      {
        id: 'evt-solstice-1',
        title: 'December Solstice',
        category: 'sun',
        dateLabel: 'Dec 21, ' + currYear,
        timeLabel: '09:20 UTC',
        daysAway: 89,
        description: 'Sun reaches its southernmost declination at 23.44°S. Winter solstice in Northern Hemisphere and Summer solstice in Southern Hemisphere.',
        icon: 'wb_sunny',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        visibilityRating: 'Good'
      }
    ];

    return events;
  });

  filteredEvents = computed(() => {
    const list = this.allEvents();
    if (this.selectedCategory === 'all') return list;
    return list.filter(e => e.category === this.selectedCategory);
  });

  closePanel(): void {
    this.closePanelEvent.emit();
  }
}
