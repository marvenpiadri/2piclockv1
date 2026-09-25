import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CelestialService } from '../../core/services/celestial.service';
import { TimeControlService } from '../../core/services/time-control.service';
import { LocationService } from '../../core/services/location.service';
import { AstronomyDetails } from '../../shared/components';

@Component({
  selector: 'app-celestial-ephemeris',
  imports: [CommonModule, MatIconModule, AstronomyDetails],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './celestial-ephemeris.html',
  styleUrl: './celestial-ephemeris.css'
})
export class CelestialEphemerisComponent {
  private celestialService = inject(CelestialService);
  private timeControlService = inject(TimeControlService);
  private locationService = inject(LocationService);

  readonly celestial = this.celestialService.celestialState;
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly activeDate = this.timeControlService.currentActiveDate;
  readonly solarCurve = this.celestialService.solarCurve;
  readonly solarCrossCheck = this.celestialService.solarCrossCheck;
  readonly planetaryPositions = this.celestialService.planetaryPositions;

  // Key Astronomical Milestones (Solstices & Equinoxes for the current year)
  readonly astronomicalSeasons = computed(() => {
    const year = this.activeDate().getFullYear();
    return [
      { name: 'March Equinox (Vernal)', date: `Mar 20, ${year}`, desc: 'Equal day and night globally' },
      { name: 'June Solstice (Summer/Winter)', date: `Jun 21, ${year}`, desc: 'Longest day in North, shortest in South' },
      { name: 'September Equinox (Autumnal)', date: `Sep 22, ${year}`, desc: 'Solar equator crossing' },
      { name: 'December Solstice (Winter/Summer)', date: `Dec 21, ${year}`, desc: 'Shortest day in North, longest in South' }
    ];
  });

  // SVG Chart path generation for the 24-hour solar altitude curve
  readonly chartSvgPath = computed(() => {
    const points = this.solarCurve();
    if (!points.length) return '';

    const width = 800;
    const height = 260;
    const paddingX = 40;
    const paddingY = 30;
    const chartW = width - paddingX * 2;
    const chartH = height - paddingY * 2;

    // Altitudes range from -90 to +90
    // Y: alt +90 => top (paddingY), alt 0 => middle (paddingY + chartH/2), alt -90 => bottom (paddingY + chartH)
    const mapY = (alt: number) => {
      const norm = (90 - alt) / 180; // 0 (top) to 1 (bottom)
      return paddingY + norm * chartH;
    };

    const mapX = (hour: number) => {
      const norm = hour / 24;
      return paddingX + norm * chartW;
    };

    let d = '';
    points.forEach((p, idx) => {
      const x = mapX(p.hour);
      const y = mapY(p.altitude);
      if (idx === 0) {
        d += `M ${x} ${y}`;
      } else {
        d += ` L ${x} ${y}`;
      }
    });

    return d;
  });

  // Current sun position on the chart
  readonly currentSunPointOnChart = computed(() => {
    const date = this.activeDate();
    const hours = date.getUTCHours() + date.getUTCMinutes() / 60;
    const alt = this.celestial().sun.altitudeDeg;

    const width = 800;
    const height = 260;
    const paddingX = 40;
    const paddingY = 30;
    const chartW = width - paddingX * 2;
    const chartH = height - paddingY * 2;

    const normX = hours / 24;
    const normY = (90 - alt) / 180;

    return {
      x: paddingX + normX * chartW,
      y: paddingY + normY * chartH
    };
  });

  formatTime(d: Date | null): string {
    if (!d) return '--:--';
    const loc = this.selectedLocation();
    try {
      return d.toLocaleTimeString('en-US', {
        timeZone: loc.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch {
      return d.toTimeString().slice(0, 5);
    }
  }

  formatMoonDistance(dist: number): string {
    return Math.round(dist).toLocaleString();
  }

  formatDayLength(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }
}
