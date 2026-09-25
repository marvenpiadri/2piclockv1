import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ObservatoryViewService, ObservatoryView } from '../../../core/services/observatory-view.service';

@Component({
  selector: 'app-observatory-mode-selector',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="observatory-mode-selector" aria-label="Observatory Perspective Mode">
      <div class="ios-segmented-track flex items-center p-1 rounded-xl bg-white/[0.06] border border-white/10 backdrop-blur-xl">
        @for (item of views; track item.id) {
          <button
            type="button"
            class="ios-segment-btn flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer select-none"
            [class.active]="activeView() === item.id"
            [attr.aria-selected]="activeView() === item.id"
            (click)="selectMode(item.id)">
            
            <mat-icon class="text-[16px] w-4 h-4" [class.text-amber-400]="activeView() === item.id">
              {{ item.icon }}
            </mat-icon>

            <span class="tracking-tight font-semibold">
              {{ item.label }}
            </span>
          </button>
        }
      </div>
    </nav>
  `,
  styles: [`
    .observatory-mode-selector {
      display: inline-flex;
    }

    .ios-segmented-track {
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.2);
    }

    .ios-segment-btn {
      color: #94a3b8;
    }

    .ios-segment-btn:hover:not(.active) {
      color: #f1f5f9;
      background: rgba(255, 255, 255, 0.04);
    }

    .ios-segment-btn.active {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.14);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.12);
    }
  `]
})
export class ObservatoryModeSelectorComponent {
  private viewService = inject(ObservatoryViewService);

  readonly views = this.viewService.allViews;
  readonly activeView = this.viewService.activeView;

  selectMode(view: ObservatoryView): void {
    this.viewService.setView(view);
  }
}
