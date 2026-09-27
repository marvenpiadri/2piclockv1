import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import * as Astronomy from 'astronomy-engine';

import { LocationService } from '../../core/services/location.service';
import { CelestialService } from '../../core/services/celestial.service';
import { WeatherService } from '../../core/services/weather.service';
import { PrecisionAstronomyService } from '../../core/services/precision-astronomy.service';
import { GeoLocation } from '../../core/models/location.model';
import { CountryFlagComponent } from '../../shared/components/country-flag/country-flag';
import { ShareExportModalComponent } from '../../shared/components/share-export-modal/share-export-modal';

export interface TwilightPhaseInfo {
  name: string;
  code: 'day' | 'civil_dusk' | 'nautical_dusk' | 'astro_dusk' | 'full_night' | 'astro_dawn' | 'nautical_dawn' | 'civil_dawn';
  sunAltRange: string;
  description: string;
  timeFormatted: string;
  date: Date;
}

export interface PlanetTonightDetail {
  body: Astronomy.Body;
  name: string;
  symbol: string;
  color: string;
  magnitude: number;
  altitudeDeg: number;
  azimuthDeg: number;
  constellation: string;
  riseTime: string;
  transitTime: string;
  setTime: string;
  isVisibleNow: boolean;
  viewingStatus: string;
  viewingTip: string;
  equipment: 'Naked Eye' | 'Binoculars' | 'Telescope';
  bestWindow: string;
  xPct: number;
  yPct: number;
}

export interface DeepSkyTargetItem {
  id: string;
  name: string;
  catalog: string;
  constellation: string;
  type: string;
  magnitude: number;
  optics: string;
  bestTime: string;
  description: string;
  observed: boolean;
}

export interface AltitudeCurvePoint {
  hourLabel: string;
  date: Date;
  sunAlt: number;
  moonAlt: number;
  venusAlt: number;
  marsAlt: number;
  jupiterAlt: number;
  saturnAlt: number;
}

export interface CurvePeakInfo {
  id: string;
  name: string;
  color: string;
  symbol: string;
  x: number;
  y: number;
  alt: number;
  timeLabel: string;
  isVisible: boolean;
  zone: string;
}

export interface CelestialVisibilityGuide {
  id: string;
  name: string;
  color: string;
  symbol: string;
  peakTime: string;
  peakAlt: number;
  riseTime: string;
  setTime: string;
  summary: string;
  viewingTip: string;
  equipment: string;
  isVisibleTonight: boolean;
  statusBadge: string;
  timelineStartPct: number;
  timelineEndPct: number;
}

@Component({
  selector: 'app-tonight',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    RouterLink,
    CountryFlagComponent,
    ShareExportModalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tonight.html',
  styleUrl: './tonight.css'
})
export class TonightComponent {
  readonly Math = Math;
  private locationService = inject(LocationService);
  private celestialService = inject(CelestialService);
  private weatherService = inject(WeatherService);
  private precisionAstronomy = inject(PrecisionAstronomyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private title = inject(Title);
  private meta = inject(Meta);

  // Authoritative Location state
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly allPresets = this.locationService.allPresets;
  readonly showLocationPicker = signal<boolean>(false);
  readonly locationSearch = signal<string>('');
  readonly showShareModal = signal<boolean>(false);

  // Filtered preset locations for quick switcher
  readonly filteredLocations = computed(() => {
    const q = this.locationSearch().toLowerCase().trim();
    if (!q) return this.allPresets.slice(0, 14);
    return this.allPresets.filter(l =>
      l.name.toLowerCase().includes(q) ||
      l.country.toLowerCase().includes(q) ||
      l.countryCode.toLowerCase().includes(q)
    ).slice(0, 14);
  });

  // Time & Simulation Mode
  readonly isLiveMode = signal<boolean>(true);
  readonly manualTimeOffsetMinutes = signal<number>(0);
  readonly clockTick = signal<number>(Date.now());

  // Selected celestial body in the interactive planisphere dome
  readonly selectedPlanisphereObject = signal<string | null>(null);

  // Checklist of observing targets stored in local storage
  readonly checkedTargetIds = signal<Set<string>>(new Set());

  // Active chart curve visibility toggles
  readonly showCurveMoon = signal<boolean>(true);
  readonly showCurveJupiter = signal<boolean>(true);
  readonly showCurveSaturn = signal<boolean>(true);
  readonly showCurveVenus = signal<boolean>(true);
  readonly showCurveMars = signal<boolean>(true);

  constructor() {
    const platformId = inject(PLATFORM_ID);
    if (isPlatformBrowser(platformId)) {
      const interval = window.setInterval(() => {
        if (this.isLiveMode()) {
          this.clockTick.set(Date.now());
        }
      }, 1000);

      try {
        const saved = localStorage.getItem('2piclock_tonight_targets');
        if (saved) {
          const parsed = JSON.parse(saved) as string[];
          this.checkedTargetIds.set(new Set(parsed));
        }
      } catch {
        // ignore storage errors
      }

      (this as any).cleanupInterval = () => window.clearInterval(interval);

      effect(() => {
        const loc = this.selectedLocation();
        this.title.setTitle(`Tonight under the Sky in ${loc.name} — Stargazing & Planetary Almanac · 2PiClock`);
        this.meta.updateTag({
          name: 'description',
          content: `Tonight's astronomical ephemeris for ${loc.name}, ${loc.country}: sunset times, darkness windows, moon phase, visible planets, and stargazing seeing forecast.`
        });
      });
    }
  }

  readonly activeInstant = computed<Date>(() => {
    const tick = this.clockTick();
    if (this.isLiveMode()) {
      return new Date(tick);
    }
    const loc = this.selectedLocation();
    const base = new Date(tick);
    const observer = new Astronomy.Observer(loc.latitude, loc.longitude, loc.elevationMeters ?? 0);
    const sunsetSearch = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, base, 1);
    const ref = sunsetSearch ? sunsetSearch.date : base;
    return new Date(ref.getTime() + this.manualTimeOffsetMinutes() * 60000);
  });

  readonly observer = computed(() => {
    const loc = this.selectedLocation();
    return new Astronomy.Observer(loc.latitude, loc.longitude, loc.elevationMeters ?? 0);
  });

  readonly currentWeather = computed(() => {
    return this.weatherService.getWeatherForInstant(this.activeInstant(), this.selectedLocation());
  });

  readonly formattedLocalTime = computed(() => {
    const d = this.activeInstant();
    const tz = this.selectedLocation().timezone;
    try {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }).format(d);
    } catch {
      return d.toTimeString().slice(0, 8);
    }
  });

  readonly formattedLocalDate = computed(() => {
    const d = this.activeInstant();
    const tz = this.selectedLocation().timezone;
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      }).format(d);
    } catch {
      return d.toDateString();
    }
  });

  readonly sunCoords = computed(() => {
    const d = this.activeInstant();
    const obs = this.observer();
    const eq = Astronomy.Equator(Astronomy.Body.Sun, d, obs, true, true);
    const hor = Astronomy.Horizon(d, obs, eq.ra, eq.dec, 'normal');
    return {
      altitudeDeg: hor.altitude,
      azimuthDeg: hor.azimuth,
      raHours: eq.ra,
      decDeg: eq.dec
    };
  });

  readonly currentTwilightStage = computed<TwilightPhaseInfo>(() => {
    const alt = this.sunCoords().altitudeDeg;
    const d = this.activeInstant();
    const timeStr = this.formattedLocalTime();

    if (alt >= 0) {
      return {
        name: 'Daylight',
        code: 'day',
        sunAltRange: `+${alt.toFixed(1)}°`,
        description: 'Sun is above the horizon. Daylight remains active.',
        timeFormatted: timeStr,
        date: d
      };
    } else if (alt >= -6) {
      return {
        name: 'Civil Twilight',
        code: 'civil_dusk',
        sunAltRange: `${alt.toFixed(1)}° (0° to −6°)`,
        description: 'Brightest planets (Venus, Jupiter) and first-magnitude stars appear.',
        timeFormatted: timeStr,
        date: d
      };
    } else if (alt >= -12) {
      return {
        name: 'Nautical Twilight',
        code: 'nautical_dusk',
        sunAltRange: `${alt.toFixed(1)}° (−6° to −12°)`,
        description: 'Horizon blurs; marine navigation stars and primary constellations are clear.',
        timeFormatted: timeStr,
        date: d
      };
    } else if (alt >= -18) {
      return {
        name: 'Astronomical Twilight',
        code: 'astro_dusk',
        sunAltRange: `${alt.toFixed(1)}° (−12° to −18°)`,
        description: 'Sky background darkens rapidly; Milky Way and fainter clusters emerge.',
        timeFormatted: timeStr,
        date: d
      };
    } else {
      return {
        name: 'Deep Astronomical Night',
        code: 'full_night',
        sunAltRange: `${alt.toFixed(1)}° (< −18°)`,
        description: 'True astronomical dark sky. Optimum conditions for deep-sky observation.',
        timeFormatted: timeStr,
        date: d
      };
    }
  });

  readonly tonightSolarMilestones = computed(() => {
    const now = this.activeInstant();
    const obs = this.observer();
    const tz = this.selectedLocation().timezone;

    const startOfNight = new Date(now.getTime() - 12 * 3600000);
    const sunsetSearch = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, -1, startOfNight, 2);
    const sunset = sunsetSearch ? sunsetSearch.date : null;

    const findAltitudeTransition = (targetAlt: number, afterDate: Date, direction: number) => {
      try {
        const res = Astronomy.SearchAltitude(Astronomy.Body.Sun, obs, direction, afterDate, 1, targetAlt);
        return res ? res.date : null;
      } catch {
        return null;
      }
    };

    const ref = sunset || now;
    const civilDusk = findAltitudeTransition(-6, ref, -1);
    const nauticalDusk = findAltitudeTransition(-12, civilDusk || ref, -1);
    const astroDusk = findAltitudeTransition(-18, nauticalDusk || ref, -1);

    const sunriseSearch = sunset ? Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, +1, sunset, 2) : null;
    const sunrise = sunriseSearch ? sunriseSearch.date : null;

    const refDawn = sunrise || new Date(ref.getTime() + 10 * 3600000);
    const civilDawn = findAltitudeTransition(-6, new Date(refDawn.getTime() - 2 * 3600000), +1);
    const nauticalDawn = findAltitudeTransition(-12, new Date(refDawn.getTime() - 3 * 3600000), +1);
    const astroDawn = findAltitudeTransition(-18, new Date(refDawn.getTime() - 4 * 3600000), +1);

    let solarMidnight: Date | null = null;
    if (sunset && sunrise) {
      solarMidnight = new Date((sunset.getTime() + sunrise.getTime()) / 2);
    }

    const fmt = (d: Date | null) => {
      if (!d) return '—';
      try {
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(d);
      } catch {
        return d.toTimeString().slice(0, 5);
      }
    };

    let darkMinutes = 0;
    if (astroDusk && astroDawn && astroDawn.getTime() > astroDusk.getTime()) {
      darkMinutes = Math.round((astroDawn.getTime() - astroDusk.getTime()) / 60000);
    }

    let totalNightMinutes = 0;
    if (sunset && sunrise && sunrise.getTime() > sunset.getTime()) {
      totalNightMinutes = Math.round((sunrise.getTime() - sunset.getTime()) / 60000);
    }

    return {
      sunset,
      sunsetFormatted: fmt(sunset),
      civilDusk,
      civilDuskFormatted: fmt(civilDusk),
      nauticalDusk,
      nauticalDuskFormatted: fmt(nauticalDusk),
      astroDusk,
      astroDuskFormatted: fmt(astroDusk),
      solarMidnight,
      solarMidnightFormatted: fmt(solarMidnight),
      astroDawn,
      astroDawnFormatted: fmt(astroDawn),
      nauticalDawn,
      nauticalDawnFormatted: fmt(nauticalDawn),
      civilDawn,
      civilDawnFormatted: fmt(civilDawn),
      sunrise,
      sunriseFormatted: fmt(sunrise),
      darkMinutes,
      darkHoursFormatted: `${Math.floor(darkMinutes / 60)}h ${darkMinutes % 60}m`,
      totalNightMinutes,
      totalNightFormatted: `${Math.floor(totalNightMinutes / 60)}h ${totalNightMinutes % 60}m`
    };
  });

  readonly moonDetail = computed(() => {
    const d = this.activeInstant();
    const obs = this.observer();
    const tz = this.selectedLocation().timezone;

    const eq = Astronomy.Equator(Astronomy.Body.Moon, d, obs, true, true);
    const hor = Astronomy.Horizon(d, obs, eq.ra, eq.dec, 'normal');
    const illum = Astronomy.Illumination(Astronomy.Body.Moon, d);
    const distanceKm = Astronomy.GeoVector(Astronomy.Body.Moon, d, true).Length() * 149597870.7;

    const riseSearch = Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, +1, new Date(d.getTime() - 12 * 3600000), 2);
    const setSearch = Astronomy.SearchRiseSet(Astronomy.Body.Moon, obs, -1, new Date(d.getTime() - 12 * 3600000), 2);

    const fmt = (date: Date | null) => {
      if (!date) return '—';
      try {
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(date);
      } catch {
        return date.toTimeString().slice(0, 5);
      }
    };

    const phaseDeg = illum.phase_angle;
    const phaseFraction = illum.phase_fraction;
    let phaseName = 'New Moon';
    if (phaseFraction < 0.02) phaseName = 'New Moon';
    else if (phaseFraction < 0.48) phaseName = phaseDeg < 90 ? 'Waxing Crescent' : 'Waning Crescent';
    else if (phaseFraction < 0.52) phaseName = phaseDeg < 90 ? 'First Quarter' : 'Last Quarter';
    else if (phaseFraction < 0.98) phaseName = phaseDeg < 90 ? 'Waxing Gibbous' : 'Waning Gibbous';
    else phaseName = 'Full Moon';

    const isAboveHorizon = hor.altitude > 0;
    let interferencePct = 0;
    if (isAboveHorizon) {
      const altFactor = Math.sin(Math.max(0, hor.altitude) * (Math.PI / 180));
      interferencePct = Math.round(phaseFraction * altFactor * 100);
    }

    let interferenceRating = 'Minimal Lunar Glare';
    let interferenceAdvice = 'Sky background remains dark; faint nebulae and distant galaxies are distinct.';
    if (interferencePct > 60) {
      interferenceRating = 'Heavy Lunar Wash';
      interferenceAdvice = 'Bright moonlight washes out deep sky targets. Focus on lunar craters and bright planets.';
    } else if (interferencePct > 25) {
      interferenceRating = 'Moderate Lunar Glow';
      interferenceAdvice = 'Milky Way contrast is softened. Bright open clusters and double stars are optimal.';
    }

    return {
      altitudeDeg: hor.altitude,
      azimuthDeg: hor.azimuth,
      illuminationFraction: phaseFraction,
      illuminationPct: Math.round(phaseFraction * 100),
      phaseName,
      phaseAngleDeg: phaseDeg,
      distanceKm: Math.round(distanceKm),
      distanceEarthRadii: (distanceKm / 6371).toFixed(1),
      riseFormatted: fmt(riseSearch?.date ?? null),
      setFormatted: fmt(setSearch?.date ?? null),
      isAboveHorizon,
      interferencePct,
      interferenceRating,
      interferenceAdvice
    };
  });

  readonly planetsTonight = computed<PlanetTonightDetail[]>(() => {
    const d = this.activeInstant();
    const obs = this.observer();
    const tz = this.selectedLocation().timezone;

    const planetDefs: {
      body: Astronomy.Body;
      name: string;
      symbol: string;
      color: string;
      equipment: 'Naked Eye' | 'Binoculars' | 'Telescope';
      tip: string;
    }[] = [
      { body: Astronomy.Body.Venus, name: 'Venus', symbol: '♀', color: '#fef08a', equipment: 'Naked Eye', tip: 'Brilliant dazzling beacon; visible crescent phase in small telescope.' },
      { body: Astronomy.Body.Jupiter, name: 'Jupiter', symbol: '♃', color: '#fed7aa', equipment: 'Naked Eye', tip: 'Bright golden disc; four Galilean moons easily seen in 7x50 binoculars.' },
      { body: Astronomy.Body.Saturn, name: 'Saturn', symbol: '♄', color: '#fde047', equipment: 'Naked Eye', tip: 'Pale amber jewel; majestic ring system visible in any 60mm telescope.' },
      { body: Astronomy.Body.Mars, name: 'Mars', symbol: '♂', color: '#f87171', equipment: 'Naked Eye', tip: 'Distinctive crimson hue; polar ice cap discernible near opposition.' },
      { body: Astronomy.Body.Mercury, name: 'Mercury', symbol: '☿', color: '#cbd5e1', equipment: 'Binoculars', tip: 'Elusive fleet-footed planet hugging twilight horizon; best viewed with clear western sightline.' },
      { body: Astronomy.Body.Uranus, name: 'Uranus', symbol: '♅', color: '#67e8f9', equipment: 'Binoculars', tip: 'Subtle greenish-cyan disc; steady binoculars needed against starfields.' },
      { body: Astronomy.Body.Neptune, name: 'Neptune', symbol: '♆', color: '#60a5fa', equipment: 'Telescope', tip: 'Distant deep azure pinpoint; telescope required to resolve non-stellar disc.' }
    ];

    const fmt = (date: Date | null) => {
      if (!date) return '—';
      try {
        return new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(date);
      } catch {
        return date.toTimeString().slice(0, 5);
      }
    };

    return planetDefs.map(p => {
      const eq = Astronomy.Equator(p.body, d, obs, true, true);
      const hor = Astronomy.Horizon(d, obs, eq.ra, eq.dec, 'normal');
      const illum = Astronomy.Illumination(p.body, d);

      const riseSearch = Astronomy.SearchRiseSet(p.body, obs, +1, new Date(d.getTime() - 12 * 3600000), 2);
      const setSearch = Astronomy.SearchRiseSet(p.body, obs, -1, new Date(d.getTime() - 12 * 3600000), 2);
      const transitSearch = Astronomy.SearchHourAngle(p.body, obs, 0, new Date(d.getTime() - 12 * 3600000));

      const isVisibleNow = hor.altitude > 0;
      let viewingStatus = 'Below Horizon';
      let bestWindow = 'Not well positioned tonight';

      if (hor.altitude > 30) {
        viewingStatus = 'Optimal Visibility';
        bestWindow = 'Now high above atmospheric turbulence';
      } else if (hor.altitude > 10) {
        viewingStatus = 'Visible Low';
        bestWindow = 'Visible above horizon; check local obstructions';
      } else if (hor.altitude > 0) {
        viewingStatus = 'Rising / Setting';
        bestWindow = 'Very close to horizon';
      }

      const raH = eq.ra;
      let constellation = 'Aquarius';
      if (raH >= 0 && raH < 2) constellation = 'Pisces';
      else if (raH < 3.5) constellation = 'Aries';
      else if (raH < 6) constellation = 'Taurus';
      else if (raH < 8) constellation = 'Gemini';
      else if (raH < 9.5) constellation = 'Cancer';
      else if (raH < 11.5) constellation = 'Leo';
      else if (raH < 13) constellation = 'Virgo';
      else if (raH < 15.5) constellation = 'Libra';
      else if (raH < 17) constellation = 'Scorpius';
      else if (raH < 19) constellation = 'Sagittarius';
      else if (raH < 21.5) constellation = 'Capricornus';

      const rad = Math.max(0, Math.min(48, ((90 - hor.altitude) / 90) * 46));
      const angleRad = (hor.azimuth - 90) * (Math.PI / 180);
      const xPct = 50 + Math.cos(angleRad) * rad;
      const yPct = 50 + Math.sin(angleRad) * rad;

      return {
        body: p.body,
        name: p.name,
        symbol: p.symbol,
        color: p.color,
        magnitude: Math.round(illum.mag * 10) / 10,
        altitudeDeg: hor.altitude,
        azimuthDeg: hor.azimuth,
        constellation,
        riseTime: fmt(riseSearch?.date ?? null),
        transitTime: fmt(transitSearch?.time?.date ?? null),
        setTime: fmt(setSearch?.date ?? null),
        isVisibleNow,
        viewingStatus,
        viewingTip: p.tip,
        equipment: p.equipment,
        bestWindow,
        xPct,
        yPct
      };
    });
  });

  readonly prominentStars = computed(() => {
    const d = this.activeInstant();
    const obs = this.observer();

    const catalog = [
      { name: 'Polaris', ra: 2.53, dec: 89.26, mag: 1.98, constellation: 'Ursa Minor' },
      { name: 'Sirius', ra: 6.75, dec: -16.72, mag: -1.46, constellation: 'Canis Major' },
      { name: 'Vega', ra: 18.62, dec: 38.78, mag: 0.03, constellation: 'Lyra' },
      { name: 'Arcturus', ra: 14.26, dec: 19.18, mag: -0.05, constellation: 'Boötes' },
      { name: 'Capella', ra: 5.28, dec: 45.99, mag: 0.08, constellation: 'Auriga' },
      { name: 'Rigel', ra: 5.24, dec: -8.20, mag: 0.18, constellation: 'Orion' },
      { name: 'Betelgeuse', ra: 5.92, dec: 7.41, mag: 0.50, constellation: 'Orion' },
      { name: 'Altair', ra: 19.84, dec: 8.87, mag: 0.77, constellation: 'Aquila' },
      { name: 'Aldebaran', ra: 4.60, dec: 16.51, mag: 0.85, constellation: 'Taurus' },
      { name: 'Spica', ra: 13.42, dec: -11.16, mag: 0.98, constellation: 'Virgo' },
      { name: 'Antares', ra: 16.49, dec: -26.43, mag: 1.06, constellation: 'Scorpius' },
      { name: 'Deneb', ra: 20.69, dec: 45.28, mag: 1.25, constellation: 'Cygnus' }
    ];

    return catalog.map(s => {
      const hor = Astronomy.Horizon(d, obs, s.ra, s.dec, 'normal');
      const rad = Math.max(0, Math.min(48, ((90 - hor.altitude) / 90) * 46));
      const angleRad = (hor.azimuth - 90) * (Math.PI / 180);
      return {
        ...s,
        altitudeDeg: hor.altitude,
        azimuthDeg: hor.azimuth,
        isVisible: hor.altitude > 0,
        xPct: 50 + Math.cos(angleRad) * rad,
        yPct: 50 + Math.sin(angleRad) * rad
      };
    }).filter(s => s.isVisible);
  });

  readonly stargazingQuality = computed(() => {
    const w = this.currentWeather();
    const moon = this.moonDetail();
    const twilight = this.currentTwilightStage();

    let score = 100;
    score -= (w.cloudCoverPct * 0.55);
    if (w.humidityPct > 75) score -= (w.humidityPct - 75) * 0.4;
    score -= (moon.interferencePct * 0.35);

    if (twilight.code === 'day') score -= 50;
    else if (twilight.code === 'civil_dusk' || twilight.code === 'civil_dawn') score -= 35;
    else if (twilight.code === 'nautical_dusk' || twilight.code === 'nautical_dawn') score -= 20;
    else if (twilight.code === 'astro_dusk' || twilight.code === 'astro_dawn') score -= 10;

    const clampedScore = Math.max(12, Math.min(100, Math.round(score)));

    let rating = 'Exceptional';
    let badgeClass = 'text-emerald-400 bg-emerald-950/60 border-emerald-500/40';
    let summary = 'Pristine dark skies with clear transparency. Ideal for astrophotography & faint deep sky targets.';

    if (clampedScore < 40) {
      rating = 'Challenging';
      badgeClass = 'text-rose-400 bg-rose-950/60 border-rose-500/40';
      summary = 'High cloud cover or severe light interference. Recommend bright planetary observation or indoor planning.';
    } else if (clampedScore < 65) {
      rating = 'Fair';
      badgeClass = 'text-amber-400 bg-amber-950/60 border-amber-500/40';
      summary = 'Partial haze or lunar wash. Bright clusters, double stars, and prominent planets remain well visible.';
    } else if (clampedScore < 85) {
      rating = 'Good';
      badgeClass = 'text-cyan-400 bg-cyan-950/60 border-cyan-500/40';
      summary = 'Fine observing conditions. Open star clusters and nebulae will exhibit crisp structure.';
    }

    return {
      score: clampedScore,
      rating,
      badgeClass,
      summary,
      cloudCoverPct: w.cloudCoverPct,
      humidityPct: w.humidityPct,
      visibilityKm: w.visibilityKm,
      dewPointC: w.dewPointC,
      dewWarning: w.temperatureC - w.dewPointC < 2.5
    };
  });

  readonly deepSkyTargets = computed<DeepSkyTargetItem[]>(() => {
    const checked = this.checkedTargetIds();
    const list: Omit<DeepSkyTargetItem, 'observed'>[] = [
      {
        id: 'target-m31',
        name: 'Andromeda Galaxy',
        catalog: 'M31 / NGC 224',
        constellation: 'Andromeda',
        type: 'Spiral Galaxy (2.5M ly)',
        magnitude: 3.4,
        optics: 'Naked eye / 7x50 Binoculars',
        bestTime: 'High in Eastern / Northern sky',
        description: 'Our galactic neighbor; visible as a ghostly oval smudge with dense radiant stellar core.'
      },
      {
        id: 'target-m45',
        name: 'The Pleiades (Seven Sisters)',
        catalog: 'M45',
        constellation: 'Taurus',
        type: 'Open Star Cluster',
        magnitude: 1.6,
        optics: 'Naked eye / Wide-field Binoculars',
        bestTime: 'Rising late evening',
        description: 'Breathtaking blue diamond cluster enshrouded in delicate interstellar reflection nebulosity.'
      },
      {
        id: 'target-m42',
        name: 'Great Orion Nebula',
        catalog: 'M42 / NGC 1976',
        constellation: 'Orion',
        type: 'Diffuse Emission Nebula',
        magnitude: 4.0,
        optics: 'Binoculars / Small Telescope',
        bestTime: 'High across Southern meridian',
        description: 'Star nursery harboring the brilliant Trapezium cluster with sprawling bat-wing filaments.'
      },
      {
        id: 'target-double-cluster',
        name: 'The Double Cluster',
        catalog: 'NGC 869 & NGC 884',
        constellation: 'Perseus',
        type: 'Twin Open Clusters',
        magnitude: 3.7,
        optics: 'Binoculars or rich-field refractor',
        bestTime: 'Near Zenith in Northern latitudes',
        description: 'Pair of spectacular shimmering jewel-boxes bursting with ruby supergiant stars.'
      },
      {
        id: 'target-m13',
        name: 'Great Globular Cluster in Hercules',
        catalog: 'M13 / NGC 6205',
        constellation: 'Hercules',
        type: 'Globular Cluster (300k stars)',
        magnitude: 5.8,
        optics: 'Binoculars / 100mm Telescope',
        bestTime: 'Early evening western sky',
        description: 'Massive beehive of ancient stars packed tightly together into a blazing central ball.'
      },
      {
        id: 'target-m57',
        name: 'The Ring Nebula',
        catalog: 'M57 / NGC 6720',
        constellation: 'Lyra',
        type: 'Planetary Nebula',
        magnitude: 8.8,
        optics: 'Telescope (80mm+)',
        bestTime: 'High overhead in Summer/Autumn',
        description: 'Delicate glowing smoke-ring left behind by a dying star 2,500 light-years away.'
      }
    ];

    return list.map(item => ({
      ...item,
      observed: checked.has(item.id)
    }));
  });

  readonly altitudeCurves = computed<AltitudeCurvePoint[]>(() => {
    const obs = this.observer();
    const tz = this.selectedLocation().timezone;
    const ms = this.tonightSolarMilestones();
    const refStart = ms.sunset ? new Date(ms.sunset.getTime() - 30 * 60000) : new Date(this.activeInstant().getTime() - 6 * 3600000);
    const refEnd = ms.sunrise ? new Date(ms.sunrise.getTime() + 30 * 60000) : new Date(refStart.getTime() + 13 * 3600000);

    const totalSpan = refEnd.getTime() - refStart.getTime();
    const steps = 14;
    const intervalMs = totalSpan / steps;

    const points: AltitudeCurvePoint[] = [];

    for (let i = 0; i <= steps; i++) {
      const t = new Date(refStart.getTime() + i * intervalMs);
      const sunEq = Astronomy.Equator(Astronomy.Body.Sun, t, obs, true, true);
      const sunHor = Astronomy.Horizon(t, obs, sunEq.ra, sunEq.dec, 'normal');

      const moonEq = Astronomy.Equator(Astronomy.Body.Moon, t, obs, true, true);
      const moonHor = Astronomy.Horizon(t, obs, moonEq.ra, moonEq.dec, 'normal');

      const venusEq = Astronomy.Equator(Astronomy.Body.Venus, t, obs, true, true);
      const venusHor = Astronomy.Horizon(t, obs, venusEq.ra, venusEq.dec, 'normal');

      const marsEq = Astronomy.Equator(Astronomy.Body.Mars, t, obs, true, true);
      const marsHor = Astronomy.Horizon(t, obs, marsEq.ra, marsEq.dec, 'normal');

      const jupiterEq = Astronomy.Equator(Astronomy.Body.Jupiter, t, obs, true, true);
      const jupiterHor = Astronomy.Horizon(t, obs, jupiterEq.ra, jupiterEq.dec, 'normal');

      const saturnEq = Astronomy.Equator(Astronomy.Body.Saturn, t, obs, true, true);
      const saturnHor = Astronomy.Horizon(t, obs, saturnEq.ra, saturnEq.dec, 'normal');

      let hourLabel = '';
      try {
        hourLabel = new Intl.DateTimeFormat('en-GB', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(t);
      } catch {
        hourLabel = t.toTimeString().slice(0, 5);
      }

      points.push({
        hourLabel,
        date: t,
        sunAlt: Math.round(sunHor.altitude * 10) / 10,
        moonAlt: Math.round(moonHor.altitude * 10) / 10,
        venusAlt: Math.round(venusHor.altitude * 10) / 10,
        marsAlt: Math.round(marsHor.altitude * 10) / 10,
        jupiterAlt: Math.round(jupiterHor.altitude * 10) / 10,
        saturnAlt: Math.round(saturnHor.altitude * 10) / 10
      });
    }

    return points;
  });

  readonly svgCurvePaths = computed(() => {
    const points = this.altitudeCurves();
    if (points.length < 2) return {
      sun: '',
      moon: '',
      venus: '',
      mars: '',
      jupiter: '',
      saturn: '',
      sunArea: '',
      moonArea: '',
      venusArea: '',
      marsArea: '',
      jupiterArea: '',
      saturnArea: '',
      zeroAltY: 160,
      thirtyAltY: 100,
      sixtyAltY: 50,
      peaks: [] as CurvePeakInfo[],
      currentTimeX: null as number | null,
      currentTimeLabel: null as string | null
    };

    const width = 800;
    const height = 240;
    const paddingX = 40;
    const paddingY = 24;

    const minAlt = -30;
    const maxAlt = 90;
    const altSpan = maxAlt - minAlt;

    const getX = (index: number) => paddingX + (index / (points.length - 1)) * (width - 2 * paddingX);
    const getY = (alt: number) => {
      const clamped = Math.max(minAlt, Math.min(maxAlt, alt));
      return height - paddingY - ((clamped - minAlt) / altSpan) * (height - 2 * paddingY);
    };

    const buildPath = (key: 'sunAlt' | 'moonAlt' | 'venusAlt' | 'marsAlt' | 'jupiterAlt' | 'saturnAlt') => {
      return points.map((p, idx) => {
        const x = getX(idx);
        const y = getY(p[key]);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ');
    };

    const zeroAltY = getY(0);
    const thirtyAltY = getY(30);
    const sixtyAltY = getY(60);

    const buildAreaPath = (key: 'sunAlt' | 'moonAlt' | 'venusAlt' | 'marsAlt' | 'jupiterAlt' | 'saturnAlt') => {
      const pts = points.map((p, idx) => ({
        x: getX(idx),
        y: getY(Math.max(0, p[key]))
      }));
      const first = pts[0];
      const last = pts[pts.length - 1];
      const linePts = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      return `${linePts} L ${last.x.toFixed(1)} ${zeroAltY.toFixed(1)} L ${first.x.toFixed(1)} ${zeroAltY.toFixed(1)} Z`;
    };

    const findPeak = (key: 'moonAlt' | 'jupiterAlt' | 'saturnAlt' | 'venusAlt' | 'marsAlt', id: string, name: string, color: string, symbol: string): CurvePeakInfo => {
      let maxAlt = -999;
      let maxIdx = 0;
      for (let i = 0; i < points.length; i++) {
        if (points[i][key] > maxAlt) {
          maxAlt = points[i][key];
          maxIdx = i;
        }
      }
      const x = getX(maxIdx);
      const y = getY(maxAlt);
      const isVisible = maxAlt > 0;
      let zone = 'High in Sky';
      if (maxAlt > 50) zone = 'High Overhead · Best View';
      else if (maxAlt > 25) zone = 'Mid-Sky';
      else if (maxAlt > 5) zone = 'Low on Horizon';
      else zone = 'Below Horizon';

      return {
        id,
        name,
        color,
        symbol,
        x: Math.round(x),
        y: Math.round(y),
        alt: Math.round(maxAlt),
        timeLabel: points[maxIdx]?.hourLabel ?? '—',
        isVisible,
        zone
      };
    };

    const peaks: CurvePeakInfo[] = [
      findPeak('moonAlt', 'moon', 'Moon', '#ffffff', '☾'),
      findPeak('jupiterAlt', 'jupiter', 'Jupiter', '#fed7aa', '♃'),
      findPeak('saturnAlt', 'saturn', 'Saturn', '#fde047', '♄'),
      findPeak('venusAlt', 'venus', 'Venus', '#fef08a', '♀'),
      findPeak('marsAlt', 'mars', 'Mars', '#f87171', '♂')
    ];

    const ms = this.tonightSolarMilestones();
    const refStart = ms.sunset ? new Date(ms.sunset.getTime() - 30 * 60000) : new Date(this.activeInstant().getTime() - 6 * 3600000);
    const refEnd = ms.sunrise ? new Date(ms.sunrise.getTime() + 30 * 60000) : new Date(refStart.getTime() + 13 * 3600000);
    const totalSpan = refEnd.getTime() - refStart.getTime();

    const now = this.activeInstant();
    let currentTimeX: number | null = null;
    let currentTimeLabel: string | null = null;
    if (now >= refStart && now <= refEnd && totalSpan > 0) {
      const frac = (now.getTime() - refStart.getTime()) / totalSpan;
      currentTimeX = Math.round(paddingX + frac * (width - 2 * paddingX));
      currentTimeLabel = this.formattedLocalTime();
    }

    return {
      sun: buildPath('sunAlt'),
      moon: buildPath('moonAlt'),
      venus: buildPath('venusAlt'),
      mars: buildPath('marsAlt'),
      jupiter: buildPath('jupiterAlt'),
      saturn: buildPath('saturnAlt'),
      sunArea: buildAreaPath('sunAlt'),
      moonArea: buildAreaPath('moonAlt'),
      venusArea: buildAreaPath('venusAlt'),
      marsArea: buildAreaPath('marsAlt'),
      jupiterArea: buildAreaPath('jupiterAlt'),
      saturnArea: buildAreaPath('saturnAlt'),
      zeroAltY,
      thirtyAltY,
      sixtyAltY,
      peaks,
      currentTimeX,
      currentTimeLabel
    };
  });

  readonly celestialVisibilityGuides = computed<CelestialVisibilityGuide[]>(() => {
    const points = this.altitudeCurves();
    if (points.length < 2) return [];

    const planets = this.planetsTonight();
    const moon = this.moonDetail();

    const getGuide = (
      id: string,
      name: string,
      color: string,
      symbol: string,
      altKey: 'moonAlt' | 'jupiterAlt' | 'saturnAlt' | 'venusAlt' | 'marsAlt',
      equipment: string,
      customTip: string,
      rise: string,
      set: string
    ): CelestialVisibilityGuide => {
      let maxAlt = -999;
      let maxIdx = 0;
      let startIdx = -1;
      let endIdx = -1;

      for (let i = 0; i < points.length; i++) {
        const alt = points[i][altKey];
        if (alt > maxAlt) {
          maxAlt = alt;
          maxIdx = i;
        }
        if (alt > 0) {
          if (startIdx === -1) startIdx = i;
          endIdx = i;
        }
      }

      const isVisibleTonight = maxAlt > 0;
      const peakTime = points[maxIdx]?.hourLabel ?? '—';
      const peakAlt = Math.max(0, Math.round(maxAlt));

      let statusBadge = 'Optimal Viewing';
      let summary = '';
      if (!isVisibleTonight) {
        statusBadge = 'Below Horizon';
        summary = 'Remains below your local horizon throughout the night.';
      } else if (peakAlt > 45) {
        statusBadge = 'Prime Overhead';
        summary = `High in dark sky (highest at ${peakTime}, ${peakAlt}° elevation).`;
      } else if (peakAlt > 20) {
        statusBadge = 'Good Visibility';
        summary = `Well visible across the night; reaches ${peakAlt}° elevation at ${peakTime}.`;
      } else {
        statusBadge = 'Low Horizon View';
        summary = `Hugs low horizon (max ${peakAlt}° at ${peakTime}). Look in open unobstructed terrain.`;
      }

      const timelineStartPct = startIdx !== -1 ? Math.round((startIdx / (points.length - 1)) * 100) : 0;
      const timelineEndPct = endIdx !== -1 ? Math.round((endIdx / (points.length - 1)) * 100) : 0;

      return {
        id,
        name,
        color,
        symbol,
        peakTime,
        peakAlt,
        riseTime: rise,
        setTime: set,
        summary,
        viewingTip: customTip,
        equipment,
        isVisibleTonight,
        statusBadge,
        timelineStartPct,
        timelineEndPct
      };
    };

    const jup = planets.find(p => p.name === 'Jupiter');
    const sat = planets.find(p => p.name === 'Saturn');
    const ven = planets.find(p => p.name === 'Venus');
    const mar = planets.find(p => p.name === 'Mars');

    return [
      getGuide('moon', 'The Moon', '#ffffff', '☾', 'moonAlt', 'Naked Eye', `${moon.phaseName} (${moon.illuminationPct}% illuminated). ${moon.interferenceRating}.`, moon.riseFormatted, moon.setFormatted),
      getGuide('jupiter', 'Jupiter', '#fed7aa', '♃', 'jupiterAlt', jup?.equipment ?? 'Naked Eye', jup?.viewingTip ?? 'Brilliant beacon, easiest planet to see naked-eye.', jup?.riseTime ?? '—', jup?.setTime ?? '—'),
      getGuide('saturn', 'Saturn', '#fde047', '♄', 'saturnAlt', sat?.equipment ?? 'Naked Eye', sat?.viewingTip ?? 'Golden-amber jewel; rings visible in small telescope.', sat?.riseTime ?? '—', sat?.setTime ?? '—'),
      getGuide('venus', 'Venus', '#fef08a', '♀', 'venusAlt', ven?.equipment ?? 'Naked Eye', ven?.viewingTip ?? 'Brilliant Evening/Morning Star; outshines all stars.', ven?.riseTime ?? '—', ven?.setTime ?? '—'),
      getGuide('mars', 'Mars', '#f87171', '♂', 'marsAlt', mar?.equipment ?? 'Naked Eye', mar?.viewingTip ?? 'Distinct reddish point; look for its steady glow.', mar?.riseTime ?? '—', mar?.setTime ?? '—')
    ];
  });

  toggleCurve(id: string): void {
    switch (id) {
      case 'moon': this.showCurveMoon.set(!this.showCurveMoon()); break;
      case 'jupiter': this.showCurveJupiter.set(!this.showCurveJupiter()); break;
      case 'saturn': this.showCurveSaturn.set(!this.showCurveSaturn()); break;
      case 'venus': this.showCurveVenus.set(!this.showCurveVenus()); break;
      case 'mars': this.showCurveMars.set(!this.showCurveMars()); break;
    }
  }

  isCurveActive(id: string): boolean {
    switch (id) {
      case 'moon': return this.showCurveMoon();
      case 'jupiter': return this.showCurveJupiter();
      case 'saturn': return this.showCurveSaturn();
      case 'venus': return this.showCurveVenus();
      case 'mars': return this.showCurveMars();
      default: return false;
    }
  }

  readonly selectedBodyInfo = computed(() => {
    const id = this.selectedPlanisphereObject();
    if (!id) return null;

    if (id === 'moon') {
      const m = this.moonDetail();
      return {
        name: 'The Moon',
        category: 'Natural Satellite',
        altitude: `${m.altitudeDeg.toFixed(1)}°`,
        azimuth: `${m.azimuthDeg.toFixed(0)}°`,
        magnitude: (m.illuminationFraction > 0.8 ? -12.5 : -10.2).toFixed(1),
        constellation: 'Lunar Orbit',
        status: m.isAboveHorizon ? 'Above Horizon' : 'Below Horizon',
        detail: `${m.phaseName} · ${m.illuminationPct}% illuminated · Distance: ${m.distanceKm.toLocaleString()} km`,
        riseSet: `Rise: ${m.riseFormatted} · Set: ${m.setFormatted}`
      };
    }

    const planet = this.planetsTonight().find(p => p.name.toLowerCase() === id.toLowerCase());
    if (planet) {
      return {
        name: planet.name,
        category: 'Planet',
        altitude: `${planet.altitudeDeg.toFixed(1)}°`,
        azimuth: `${planet.azimuthDeg.toFixed(0)}°`,
        magnitude: planet.magnitude.toFixed(1),
        constellation: planet.constellation,
        status: planet.viewingStatus,
        detail: planet.viewingTip,
        riseSet: `Rise: ${planet.riseTime} · Transit: ${planet.transitTime} · Set: ${planet.setTime}`
      };
    }

    const star = this.prominentStars().find(s => s.name.toLowerCase() === id.toLowerCase());
    if (star) {
      return {
        name: star.name,
        category: 'Navigational Star',
        altitude: `${star.altitudeDeg.toFixed(1)}°`,
        azimuth: `${star.azimuthDeg.toFixed(0)}°`,
        magnitude: star.mag.toFixed(2),
        constellation: star.constellation,
        status: 'Visible Tonight',
        detail: `Major benchmark star in ${star.constellation}`,
        riseSet: 'Observable across seasonal passage'
      };
    }

    return null;
  });

  selectLocation(loc: GeoLocation): void {
    this.locationService.selectLocation(loc);
    this.showLocationPicker.set(false);
    this.router.navigate(['/', loc.id, 'tonight']);
  }

  toggleTarget(targetId: string): void {
    this.checkedTargetIds.update(set => {
      const next = new Set(set);
      if (next.has(targetId)) next.delete(targetId);
      else next.add(targetId);

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('2piclock_tonight_targets', JSON.stringify(Array.from(next)));
        } catch {
          // ignore storage error
        }
      }
      return next;
    });
  }

  jumpToMilestone(offsetMinutes: number): void {
    this.isLiveMode.set(false);
    this.manualTimeOffsetMinutes.set(offsetMinutes);
  }

  resetToLive(): void {
    this.isLiveMode.set(true);
    this.manualTimeOffsetMinutes.set(0);
    this.clockTick.set(Date.now());
  }

  onScrubberInput(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.isLiveMode.set(false);
    this.manualTimeOffsetMinutes.set(val);
  }

  selectPlanisphereObject(id: string): void {
    if (this.selectedPlanisphereObject() === id) {
      this.selectedPlanisphereObject.set(null);
    } else {
      this.selectedPlanisphereObject.set(id);
    }
  }
}
