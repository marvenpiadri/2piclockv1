import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CelestialService } from '../../../core/services/celestial.service';

/**
 * Visual Moon Phase Indicator
 * Renders realistic SVG lunar geometry based on illumination fraction,
 * synodic lunar age, and bright limb orientation.
 */
@Component({
  selector: 'app-moon-phase-indicator',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './moon-phase-indicator.html',
  styleUrl: './moon-phase-indicator.css'
})
export class MoonPhaseIndicator {
  private celestialService = inject(CelestialService);

  // Optional overrides (defaults to real-time CelestialService state)
  customIllumination = input<number | null>(null);
  customAgeDays = input<number | null>(null);
  customPhaseName = input<string | null>(null);
  size = input<number>(100);
  showLabels = input<boolean>(true);
  showDetails = input<boolean>(true);
  compact = input<boolean>(false);

  readonly moonState = computed(() => this.celestialService.celestialState().moon);

  readonly illuminationFraction = computed(() => {
    const custom = this.customIllumination();
    return custom !== null ? Math.max(0, Math.min(1, custom)) : this.moonState().illuminationFraction;
  });

  readonly ageDays = computed(() => {
    const custom = this.customAgeDays();
    return custom !== null ? custom : this.moonState().ageDays;
  });

  readonly phaseName = computed(() => {
    return this.customPhaseName() || this.moonState().phaseName;
  });

  readonly isWaxing = computed(() => {
    const age = this.ageDays();
    return age <= 14.765;
  });

  readonly illuminationPercentage = computed(() => {
    return (this.illuminationFraction() * 100).toFixed(1);
  });

  readonly brightLimbAngle = computed(() => {
    return this.moonState().brightLimbAngleDeg;
  });

  // Next major lunar milestone
  readonly nextPhaseMilestone = computed(() => {
    const age = this.ageDays();
    const synodicMonth = 29.530588853;
    const q1 = 7.3826;
    const full = 14.7653;
    const q3 = 22.1479;

    if (age < q1) {
      return { target: 'First Quarter', inDays: (q1 - age).toFixed(1) };
    } else if (age < full) {
      return { target: 'Full Moon', inDays: (full - age).toFixed(1) };
    } else if (age < q3) {
      return { target: 'Third Quarter', inDays: (q3 - age).toFixed(1) };
    } else {
      return { target: 'New Moon', inDays: (synodicMonth - age).toFixed(1) };
    }
  });

  // SVG Lit Path calculation based on Meeus lunar terminator geometry
  readonly svgLitPath = computed(() => {
    const k = this.illuminationFraction();
    const isWaxing = this.isWaxing();
    const r = 44; // base radius

    if (k <= 0.005) {
      // New Moon: virtually no direct illumination
      return '';
    }

    if (k >= 0.995) {
      // Full Moon: full disc
      return `M 0 ${-r} A ${r} ${r} 0 1 1 0 ${r} A ${r} ${r} 0 1 1 0 ${-r} Z`;
    }

    if (isWaxing) {
      // Waxing: right hemisphere is illuminated
      if (k < 0.5) {
        // Crescent: terminator curves to the right
        const rx = Math.max(0.1, r * (1 - 2 * k));
        return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 0 0 ${-r} Z`;
      } else if (Math.abs(k - 0.5) < 0.005) {
        // Exact First Quarter
        return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} L 0 ${-r} Z`;
      } else {
        // Gibbous: terminator curves into the left side
        const rx = Math.max(0.1, r * (2 * k - 1));
        return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 1 0 ${-r} Z`;
      }
    } else {
      // Waning: left hemisphere is illuminated
      if (k < 0.5) {
        // Crescent: terminator curves to the left
        const rx = Math.max(0.1, r * (1 - 2 * k));
        return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 1 0 ${-r} Z`;
      } else if (Math.abs(k - 0.5) < 0.005) {
        // Exact Third Quarter
        return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} L 0 ${-r} Z`;
      } else {
        // Gibbous: terminator curves into the right side
        const rx = Math.max(0.1, r * (2 * k - 1));
        return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} A ${rx.toFixed(2)} ${r} 0 0 0 0 ${-r} Z`;
      }
    }
  });

  formatDistance(distKm: number): string {
    return Math.round(distKm).toLocaleString();
  }
}
