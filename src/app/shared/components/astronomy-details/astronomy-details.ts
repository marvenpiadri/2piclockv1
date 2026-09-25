import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CelestialService } from '../../../core/services/celestial.service';
import { LocationService } from '../../../core/services/location.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { MoonPhaseIndicator } from '../moon-phase-indicator/moon-phase-indicator';

/**
 * AstronomyDetails Component
 * Displays precise sunrise, sunset, and solar noon times derived directly from the CelestialService,
 * along with daylight duration, twilight boundaries, solar coordinates, and a visual moon phase indicator.
 */
@Component({
  selector: 'app-astronomy-details',
  imports: [CommonModule, MatIconModule, MoonPhaseIndicator],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './astronomy-details.html',
  styleUrl: './astronomy-details.css'
})
export class AstronomyDetails {
  private celestialService = inject(CelestialService);
  private locationService = inject(LocationService);
  private timeControlService = inject(TimeControlService);

  // Optional visual variant
  variant = input<'full' | 'compact' | 'card'>('full');

  readonly celestial = this.celestialService.celestialState;
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly activeDate = this.timeControlService.currentActiveDate;
  readonly localTime = this.celestialService.formattedLocalTime;
  readonly localDate = this.celestialService.formattedLocalDate;
  readonly timezone = computed(() => this.selectedLocation().timezone);

  readonly solarEvents = computed(() => this.celestial().solarEvents);
  readonly sun = computed(() => this.celestial().sun);
  readonly moon = computed(() => this.celestial().moon);

  // Formatted Solar Core Events
  readonly formattedSunrise = computed(() => {
    return this.formatTime(this.solarEvents().sunrise);
  });

  readonly formattedSolarNoon = computed(() => {
    return this.formatTime(this.solarEvents().solarNoon);
  });

  readonly formattedSunset = computed(() => {
    return this.formatTime(this.solarEvents().sunset);
  });

  // Relative countdown / offset from current active time
  readonly sunriseRelative = computed(() => {
    return this.getRelativeTime(this.solarEvents().sunrise, this.activeDate());
  });

  readonly noonRelative = computed(() => {
    return this.getRelativeTime(this.solarEvents().solarNoon, this.activeDate());
  });

  readonly sunsetRelative = computed(() => {
    return this.getRelativeTime(this.solarEvents().sunset, this.activeDate());
  });

  // Day Length formatting (e.g. 12h 14m 32s)
  readonly formattedDayLength = computed(() => {
    const totalMinutes = this.solarEvents().dayLengthMinutes;
    if (this.solarEvents().isPolarDay) return '24h 00m (Continuous Daylight)';
    if (this.solarEvents().isPolarNight) return '0h 00m (Polar Night)';

    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.floor(totalMinutes % 60);
    const seconds = Math.floor((totalMinutes * 60) % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  });

  // Daylight Progress Percentage (0% to 100%) during the solar day
  readonly daylightProgressPct = computed(() => {
    const events = this.solarEvents();
    if (events.isPolarDay) return 100;
    if (events.isPolarNight) return 0;
    if (!events.sunrise || !events.sunset) return 50;

    const sunriseMs = events.sunrise.getTime();
    const sunsetMs = events.sunset.getTime();
    const nowMs = this.activeDate().getTime();

    if (nowMs <= sunriseMs) return 0;
    if (nowMs >= sunsetMs) return 100;

    const progress = ((nowMs - sunriseMs) / (sunsetMs - sunriseMs)) * 100;
    return Math.max(0, Math.min(100, progress));
  });

  // Check if Sun is currently above horizon
  readonly isDaytime = computed(() => {
    return this.sun().isAboveHorizon;
  });

  formatTime(date: Date | null, includeSeconds = true): string {
    if (!date) return '—';
    try {
      return date.toLocaleTimeString('en-US', {
        timeZone: this.timezone(),
        hour: '2-digit',
        minute: '2-digit',
        second: includeSeconds ? '2-digit' : undefined,
        hour12: false
      });
    } catch {
      return date.toTimeString().slice(0, includeSeconds ? 8 : 5);
    }
  }

  private getRelativeTime(targetDate: Date | null, referenceDate: Date): string {
    if (!targetDate) return '';
    const diffMs = targetDate.getTime() - referenceDate.getTime();
    const absDiff = Math.abs(diffMs);
    const hours = Math.floor(absDiff / 3600000);
    const minutes = Math.floor((absDiff % 3600000) / 60000);

    if (diffMs > 0) {
      if (hours > 0) return `in ${hours}h ${minutes}m`;
      return `in ${minutes}m`;
    } else {
      if (hours > 0) return `${hours}h ${minutes}m ago`;
      return `${minutes}m ago`;
    }
  }
}
