import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-country-flag',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isSpecial()) {
      <span class="special-flag-badge" [class]="customClass()">
        @if (countryCode() === 'GPS' || countryCode() === '📍') {
          📍
        } @else {
          🌐
        }
      </span>
    } @else if (hasError() || !cleanCode()) {
      <span class="fallback-flag-badge" [class]="customClass()">
        🏳️
      </span>
    } @else {
      <img
        [src]="flagUrl()"
        [srcset]="flagUrl2x() + ' 2x'"
        [alt]="cleanCode()"
        referrerpolicy="no-referrer"
        loading="lazy"
        (error)="onImgError()"
        class="flag-img"
        [class]="customClass() || 'flag-default'"
      />
    }
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      line-height: 1;
    }
    .flag-img {
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
      display: inline-block;
      object-fit: cover;
      user-select: none;
      flex-shrink: 0;
    }
    .flag-default {
      width: 20px;
      height: 14px;
      border-radius: 3px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .special-flag-badge,
    .fallback-flag-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      user-select: none;
      font-size: 0.9em;
      line-height: 1;
      font-family: var(--font-mono);
    }
  `]
})
export class CountryFlagComponent {
  readonly countryCode = input<string>('');
  readonly customClass = input<string>('');
  readonly hasError = signal<boolean>(false);

  readonly cleanCode = computed(() => {
    const raw = (this.countryCode() || '').trim().toLowerCase();
    if (raw.length === 2 && /^[a-z]{2}$/.test(raw)) {
      return raw;
    }
    return '';
  });

  readonly isSpecial = computed(() => {
    const raw = (this.countryCode() || '').trim().toUpperCase();
    return raw === 'GPS' || raw === '📍' || raw === '🌐' || raw === 'COORDINATES';
  });

  readonly flagUrl = computed(() => {
    const code = this.cleanCode();
    return code ? `https://flagcdn.com/w40/${code}.png` : '';
  });

  readonly flagUrl2x = computed(() => {
    const code = this.cleanCode();
    return code ? `https://flagcdn.com/w80/${code}.png` : '';
  });

  onImgError(): void {
    this.hasError.set(true);
  }
}
