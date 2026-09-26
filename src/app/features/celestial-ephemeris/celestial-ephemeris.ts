import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CelestialService } from '../../core/services/celestial.service';
import { TimeControlService } from '../../core/services/time-control.service';
import { LocationService } from '../../core/services/location.service';
import { AstronomyDetails } from '../../shared/components';
import * as Astronomy from 'astronomy-engine';

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
    const date = this.activeDate();
    const loc = this.selectedLocation();
    const localYear = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: loc.timezone,
      year: 'numeric'
    }).format(date));
    const seasons = Astronomy.Seasons(localYear);
    const format = (d: Date) => d.toLocaleString('en-US', {
      timeZone: loc.timezone,
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    return [
      { name: 'March Equinox (Vernal)', date: format(seasons.mar_equinox.date), desc: 'Equinox: Sun crosses the celestial equator northward' },
      { name: 'June Solstice (Summer/Winter)', date: format(seasons.jun_solstice.date), desc: 'Solstice: maximum northern solar declination' },
      { name: 'September Equinox (Autumnal)', date: format(seasons.sep_equinox.date), desc: 'Equinox: Sun crosses the celestial equator southward' },
      { name: 'December Solstice (Winter/Summer)', date: format(seasons.dec_solstice.date), desc: 'Solstice: maximum southern solar declination' }
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
    const loc = this.selectedLocation();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: loc.timezone,
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23'
    }).formatToParts(date);
    const localHour = Number(parts.find(part => part.type === 'hour')?.value ?? 0);
    const localMinute = Number(parts.find(part => part.type === 'minute')?.value ?? 0);
    const hours = localHour + localMinute / 60;
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
