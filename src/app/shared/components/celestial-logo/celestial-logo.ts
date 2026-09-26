import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CelestialService } from '../../../core/services/celestial.service';

@Component({
  selector: 'app-celestial-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './celestial-logo.html',
  styleUrl: './celestial-logo.css'
})
export class CelestialLogoComponent {
  private readonly celestialService = inject(CelestialService);
  readonly celestial = this.celestialService.celestialState;
  readonly activeDate = this.celestialService.activeDate;
  readonly sunAltitude = computed(() => this.celestial().sun.altitudeDeg);
  readonly illumination = computed(() => Math.max(0, Math.min(1, this.celestial().moon.illuminationFraction)));
  readonly phaseAngle = computed(() => this.celestial().moon.brightLimbAngleDeg);
  readonly phaseName = computed(() => this.celestial().moon.phaseName);
  readonly isDay = computed(() => this.sunAltitude() >= 0);
  readonly isTransition = computed(() => {
    const altitude = this.sunAltitude();
    return altitude > -6 && altitude < 6;
  });
  readonly celestialOpacity = computed(() => {
    const altitude = this.sunAltitude();
    if (altitude >= 6) return 1;
    if (altitude <= -6) return 0;
    return (altitude + 6) / 12;
  });
  readonly moonOpacity = computed(() => 1 - this.celestialOpacity());
  readonly twilightIntensity = computed(() => {
    const altitude = this.sunAltitude();
    if (altitude <= -6 || altitude >= 6) return 0;
    return 1 - Math.abs(altitude) / 6;
  });
  readonly sunScale = computed(() => 0.98 + this.twilightIntensity() * 0.04);
  readonly moonScale = computed(() => 0.98 + this.twilightIntensity() * 0.04);
  readonly moonLitPath = computed(() => this.createMoonLitPath());
  readonly moonTerminatorRotation = computed(() => this.phaseAngle());
  // Use the calculated solar azimuth rather than a synthetic 24-hour rotation.
  // This keeps the identity mark tied to the same real sky model as the clock/sky view.
  readonly sunRotation = computed(() => this.celestial().sun.azimuthDeg);
  readonly phaseLabel = computed(() => {
    const phase = this.phaseName();
    return phase ? 'Moon · ' + phase + ' · ' + this.illuminationPercentage() + '% illuminated' : 'Moon';
  });

  illuminationPercentage(): string {
    return (this.illumination() * 100).toFixed(0);
  }

  /**
   * Draw the illuminated lunar portion as an actual crescent/gibbous shape.
   * The geometry is driven by the calculated illumination fraction rather than
   * a generic ellipse, so new/quarter/full phases remain visually coherent.
   */
  private createMoonLitPath(): string {
    const r = 15;
    const f = this.illumination();
    const rx = r * Math.abs(2 * f - 1);
    const isGibbous = f > 0.5;

    if (isGibbous) {
      return [
        `M 24 9`,
        `A ${r} ${r} 0 0 0 24 39`,
        `A ${Math.max(0.01, rx)} ${r} 0 0 1 24 9`,
        'Z'
      ].join(' ');
    }

    return [
      `M 24 9`,
      `A ${r} ${r} 0 0 1 24 39`,
      `A ${Math.max(0.01, rx)} ${r} 0 0 1 24 9`,
      'Z'
    ].join(' ');
  }

}
