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
  readonly moonTerminatorRx = computed(() => Math.max(1.5, Math.abs(2 * this.illumination() - 1) * 18));
  readonly moonTerminatorRotation = computed(() => this.phaseAngle());
  // Use the calculated solar azimuth rather than a synthetic 24-hour rotation.\n  // This keeps the identity mark tied to the same real sky model as the clock/sky view.\n  readonly sunRotation = computed(() => this.celestial().sun.azimuthDeg);
  readonly phaseLabel = computed(() => {
    const phase = this.phaseName();
    return phase ? 'Moon · ' + phase + ' · ' + this.illuminationPercentage() + '% illuminated' : 'Moon';
  });

  illuminationPercentage(): string {
    return (this.illumination() * 100).toFixed(0);
  }

  private localHour(): number {
    const instant = this.activeDate();
    const zone = this.celestialService.selectedLocation().timezone;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(instant);
    const get = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
    return get('hour') + get('minute') / 60 + get('second') / 3600;
  }
}
