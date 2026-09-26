import { ChangeDetectionStrategy, Component, computed, inject, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { LocationService } from '../../core/services/location.service';
import {
  AstronomicalCalculatorService,
  DaylightAnalysis,
  SolarCalculatorResult,
  MoonCalculatorResult,
  AstronomicalEventItem
} from '../../core/services/astronomical-calculator.service';
import { GeoLocation } from '../../core/models/location.model';
import { MoonPhaseIndicator } from '../../shared/components/moon-phase-indicator/moon-phase-indicator';
import { Title, Meta } from '@angular/platform-browser';
import { CelestialService } from '../../core/services/celestial.service';
import { PlanetaryPosition } from '../../core/services/precision-astronomy.service';
import { computeKeplerianState, KeplerianOrbitalState, getGMST, getJulianCenturies, getJulianDate, JPL_KEPLERIAN_ELEMENTS } from '../../core/astronomy/keplerian-engine';

export type AstronomyTab = 'overview' | 'solar' | 'daylight' | 'moon' | 'events';

@Component({
  selector: 'app-astronomy-suite',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatIconModule,
    MoonPhaseIndicator
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './astronomy-suite.html',
  styleUrl: './astronomy-suite.css'
})
export class AstronomySuiteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private locationService = inject(LocationService);
  private astroCalc = inject(AstronomicalCalculatorService);
  private title = inject(Title);
  private meta = inject(Meta);
  private celestialService = inject(CelestialService);

  readonly allPresets = this.locationService.allPresets;
  readonly activeTab = signal<AstronomyTab>('overview');
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly selectedDate = signal<string>(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: this.locationService.selectedLocation().timezone
    }).format(new Date())
  );
  readonly selectedTime = signal<string>('12:00');
  readonly selectedYear = signal<number>(new Date().getFullYear());
  readonly copyNotification = signal<string | null>(null);
  readonly selectedHour = computed(() => {
    const hour = parseInt(this.selectedTime().slice(0, 2), 10);
    return Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : 12;
  });

  // "When Is?" query selector
  readonly whenIsQuery = signal<'next-full-moon' | 'next-new-moon' | 'spring-equinox' | 'summer-solstice' | 'autumn-equinox' | 'winter-solstice' | 'solar-noon'>('next-full-moon');

  /**
   * Interpret the form's date/time as wall-clock time in the selected location.
   * The astronomy engine works with real UTC instants, so this conversion must
   * happen before any solar/lunar calculation. In particular, 00:00 must stay
   * midnight rather than being treated as a falsy value and becoming 12:00.
   */
  readonly parsedInstant = computed<Date>(() => {
    const [y, m, d] = this.selectedDate().split('-').map(Number);
    const [h, min] = this.selectedTime().split(':').map(Number);
    const year = Number.isFinite(y) ? y : new Date().getFullYear();
    const month = Number.isFinite(m) && m >= 1 && m <= 12 ? m : 1;
    const day = Number.isFinite(d) && d >= 1 && d <= 31 ? d : 1;
    const hour = Number.isFinite(h) && h >= 0 && h <= 23 ? h : 12;
    const minute = Number.isFinite(min) && min >= 0 && min <= 59 ? min : 0;

    return this.getZonedDateTime(year, month, day, hour, minute, 0, this.selectedLocation().timezone);
  });

  // --- Calculations ---
  readonly solarResult = computed<SolarCalculatorResult>(() => {
    return this.astroCalc.calculateSolar(this.selectedLocation(), this.parsedInstant());
  });

  readonly daylightResult = computed<DaylightAnalysis>(() => {
    return this.astroCalc.calculateDaylight(this.selectedLocation(), this.parsedInstant());
  });

  readonly moonResult = computed<MoonCalculatorResult>(() => {
    return this.astroCalc.calculateMoon(this.selectedLocation(), this.parsedInstant());
  });

  readonly planetaryPositions = computed<PlanetaryPosition[]>(() => {
    return this.celestialService.planetaryPositions().map(planet => planet);
  });

  readonly visiblePlanetaryPositions = computed(() =>
    this.planetaryPositions().filter(planet => planet.visible && planet.altitudeDeg > 0)
  );

  readonly selectedPlanet = signal('earth');

  readonly selectedConstellation = signal('orion');

  readonly selectedDeepSkyObject = signal('m31');

  readonly deepSkyCatalog = [
    { id: 'm31', name: 'Andromeda Galaxy', catalog: 'M31 · NGC 224', type: 'Galaxy', ra: 10.6847, dec: 41.2690, mag: 3.44, size: '178′ × 63′' },
    { id: 'm42', name: 'Orion Nebula', catalog: 'M42 · NGC 1976', type: 'Emission nebula', ra: 83.8221, dec: -5.3911, mag: 4.00, size: '85′ × 60′' },
    { id: 'm45', name: 'Pleiades', catalog: 'M45 · Melotte 22', type: 'Open cluster', ra: 56.8712, dec: 24.1170, mag: 1.60, size: '110′' },
    { id: 'm13', name: 'Hercules Cluster', catalog: 'M13 · NGC 6205', type: 'Globular cluster', ra: 250.4235, dec: 36.4613, mag: 5.78, size: '20′' },
    { id: 'm51', name: 'Whirlpool Galaxy', catalog: 'M51 · NGC 5194', type: 'Spiral galaxy', ra: 202.4696, dec: 47.1952, mag: 8.36, size: '11′ × 7′' },
    { id: 'm57', name: 'Ring Nebula', catalog: 'M57 · NGC 6720', type: 'Planetary nebula', ra: 283.3969, dec: 33.0292, mag: 8.80, size: '1.4′' },
    { id: 'm8', name: 'Lagoon Nebula', catalog: 'M8 · NGC 6523', type: 'Emission nebula', ra: 270.9200, dec: -24.3800, mag: 6.00, size: '90′ × 40′' },
    { id: 'm20', name: 'Trifid Nebula', catalog: 'M20 · NGC 6514', type: 'Emission nebula', ra: 270.6540, dec: -23.0300, mag: 6.30, size: '28′' },
    { id: 'm6', name: 'Butterfly Cluster', catalog: 'M6 · NGC 6405', type: 'Open cluster', ra: 265.0700, dec: -32.2200, mag: 4.20, size: '25′' },
    { id: 'm7', name: 'Ptolemy Cluster', catalog: 'M7 · NGC 6475', type: 'Open cluster', ra: 268.4600, dec: -34.7900, mag: 3.30, size: '80′' }
  ] as const;

  readonly selectedDeepSkyData = computed(() =>
    this.deepSkyCatalog.find(object => object.id === this.selectedDeepSkyObject()) ?? this.deepSkyCatalog[0]
  );

  readonly selectedDeepSkyPosition = computed(() => {
    const object = this.selectedDeepSkyData();
    const instant = this.parsedInstant();
    const jd = getJulianDate(instant);
    const lstDeg = (getGMST(jd, getJulianCenturies(jd)) + this.selectedLocation().longitude) % 360;
    const hourAngleDeg = ((lstDeg - object.ra + 540) % 360) - 180;
    const lat = this.selectedLocation().latitude * Math.PI / 180;
    const dec = object.dec * Math.PI / 180;
    const ha = hourAngleDeg * Math.PI / 180;
    const sinAlt = Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(ha);
    const altitudeDeg = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    const azimuthDeg = ((Math.atan2(
      Math.sin(ha),
      Math.cos(ha) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat)
    ) * 180 / Math.PI) + 180 + 360) % 360;
    return { altitudeDeg, azimuthDeg, hourAngleDeg, lstDeg };
  });

  selectDeepSkyObject(id: string): void {
    this.selectedDeepSkyObject.set(id);
  }

  deepSkyFieldLeft(): number {
    return 50 + Math.max(-46, Math.min(46, this.selectedDeepSkyPosition().hourAngleDeg / 180 * 46));
  }

  deepSkyFieldTop(): number {
    return 50 - Math.max(-42, Math.min(42, this.selectedDeepSkyPosition().altitudeDeg / 90 * 42));
  }



  readonly constellationCatalog = [
    {
      id: 'orion',
      name: 'Orion',
      stars: [
        { name: 'Betelgeuse', ra: 88.793, dec: 7.407, mag: 0.50 },
        { name: 'Bellatrix', ra: 81.283, dec: 6.350, mag: 1.64 },
        { name: 'Alnilam', ra: 84.053, dec: -1.202, mag: 1.69 },
        { name: 'Alnitak', ra: 85.190, dec: -1.943, mag: 1.74 },
        { name: 'Mintaka', ra: 83.001, dec: -0.299, mag: 2.23 },
        { name: 'Rigel', ra: 78.634, dec: -8.202, mag: 0.13 }
      ],
      lines: [['Betelgeuse', 'Bellatrix'], ['Betelgeuse', 'Mintaka'], ['Bellatrix', 'Alnilam'], ['Mintaka', 'Alnilam'], ['Mintaka', 'Alnitak'], ['Alnilam', 'Alnitak'], ['Alnitak', 'Rigel'], ['Mintaka', 'Rigel']]
    },
    {
      id: 'ursa-major',
      name: 'Ursa Major',
      stars: [
        { name: 'Dubhe', ra: 165.932, dec: 61.751, mag: 1.79 },
        { name: 'Merak', ra: 165.460, dec: 56.382, mag: 2.37 },
        { name: 'Phecda', ra: 178.458, dec: 53.695, mag: 2.44 },
        { name: 'Megrez', ra: 183.856, dec: 57.033, mag: 3.31 },
        { name: 'Alioth', ra: 193.507, dec: 55.960, mag: 1.76 },
        { name: 'Mizar', ra: 201.298, dec: 54.925, mag: 2.27 },
        { name: 'Alkaid', ra: 206.885, dec: 49.313, mag: 1.86 }
      ],
      lines: [['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Alioth'], ['Alioth', 'Mizar'], ['Mizar', 'Alkaid'], ['Dubhe', 'Megrez']]
    },
    {
      id: 'cassiopeia',
      name: 'Cassiopeia',
      stars: [
        { name: 'Schedar', ra: 10.127, dec: 56.537, mag: 2.24 },
        { name: 'Caph', ra: 2.295, dec: 59.150, mag: 2.27 },
        { name: 'Gamma Cas', ra: 14.177, dec: 60.717, mag: 2.47 },
        { name: 'Ruchbah', ra: 21.454, dec: 60.235, mag: 2.68 },
        { name: 'Segin', ra: 28.599, dec: 63.670, mag: 3.35 }
      ],
      lines: [['Caph', 'Schedar'], ['Schedar', 'Gamma Cas'], ['Gamma Cas', 'Ruchbah'], ['Ruchbah', 'Segin']]
    },
    {
      id: 'leo',
      name: 'Leo',
      stars: [
        { name: 'Regulus', ra: 152.093, dec: 11.967, mag: 1.35 },
        { name: 'Denebola', ra: 177.265, dec: 14.572, mag: 2.14 },
        { name: 'Algieba', ra: 154.993, dec: 19.841, mag: 2.28 },
        { name: 'Zosma', ra: 168.527, dec: 20.524, mag: 2.56 },
        { name: 'Chertan', ra: 168.560, dec: 15.430, mag: 3.33 }
      ],
      lines: [['Regulus', 'Algieba'], ['Algieba', 'Zosma'], ['Zosma', 'Denebola'], ['Zosma', 'Chertan'], ['Chertan', 'Regulus']]
    },
    {
      id: 'scorpius',
      name: 'Scorpius',
      stars: [
        { name: 'Antares', ra: 247.352, dec: -26.432, mag: 1.06 },
        { name: 'Dschubba', ra: 240.083, dec: -22.622, mag: 2.32 },
        { name: 'Sargas', ra: 264.330, dec: -42.998, mag: 1.86 },
        { name: 'Shaula', ra: 263.402, dec: -37.103, mag: 1.63 },
        { name: 'Lesath', ra: 262.691, dec: -37.296, mag: 2.70 },
        { name: 'Girtab', ra: 260.502, dec: -34.293, mag: 2.41 }
      ],
      lines: [['Dschubba', 'Antares'], ['Antares', 'Girtab'], ['Girtab', 'Sargas'], ['Girtab', 'Shaula'], ['Shaula', 'Lesath']]
    }
  ] as const;

  readonly selectedConstellationData = computed(() =>
    this.constellationCatalog.find(item => item.id === this.selectedConstellation()) ?? this.constellationCatalog[0]
  );

  readonly earthMoonSunSeparation = computed(() => {
    const sun = this.solarResult().solarPos;
    const moon = this.moonResult().lunarPos;
    const ra1 = sun.rightAscensionDeg * Math.PI / 180;
    const dec1 = sun.declinationDeg * Math.PI / 180;
    const ra2 = moon.rightAscensionDeg * Math.PI / 180;
    const dec2 = moon.declinationDeg * Math.PI / 180;
    const cosine = Math.sin(dec1) * Math.sin(dec2) + Math.cos(dec1) * Math.cos(dec2) * Math.cos(ra1 - ra2);
    return Math.acos(Math.max(-1, Math.min(1, cosine))) * 180 / Math.PI;
  });

  constellationX(raDeg: number): number {
    return ((raDeg / 360) * 94 + 3);
  }

  constellationY(decDeg: number): number {
    return 50 - (decDeg / 90) * 44;
  }

  constellationStarRadius(magnitude: number): number {
    return Math.max(1.1, Math.min(3.1, 3.3 - magnitude * 0.55));
  }

  constellationStarByName(name: string) {
    return this.selectedConstellationData().stars.find(star => star.name === name);
  }

  constellationLineWidth(fromName: string, toName: string): number {
    const from = this.constellationStarByName(fromName);
    const to = this.constellationStarByName(toName);
    if (!from || !to) return 0;
    return Math.hypot(this.constellationX(to.ra) - this.constellationX(from.ra), this.constellationY(to.dec) - this.constellationY(from.dec));
  }

  constellationLineAngle(fromName: string, toName: string): number {
    const from = this.constellationStarByName(fromName);
    const to = this.constellationStarByName(toName);
    if (!from || !to) return 0;
    return Math.atan2(this.constellationY(to.dec) - this.constellationY(from.dec), this.constellationX(to.ra) - this.constellationX(from.ra)) * 180 / Math.PI;
  }

  selectConstellation(id: string): void {
    this.selectedConstellation.set(id);
  }

  earthSkyNodeX(raDeg: number): number {
    const angle = (raDeg - this.solarResult().solarPos.rightAscensionDeg) * Math.PI / 180;
    return 50 + Math.sin(angle) * 35;
  }

  relationshipLineWidth(raDeg: number, decDeg: number): number {
    const dx = this.earthSkyNodeX(raDeg) - 50;
    const dy = this.earthSkyNodeY(decDeg) - 50;
    return Math.hypot(dx, dy);
  }

  relationshipLineAngle(raDeg: number, decDeg: number): number {
    const dx = this.earthSkyNodeX(raDeg) - 50;
    const dy = this.earthSkyNodeY(decDeg) - 50;
    return Math.atan2(dy, dx) * 180 / Math.PI;
  }

  earthSkyNodeY(decDeg: number): number {
    const delta = decDeg - this.solarResult().solarPos.declinationDeg;
    return 50 - Math.max(-1, Math.min(1, delta / 90)) * 35;
  }


  readonly solarSystemStates = computed<KeplerianOrbitalState[]>(() => {
    const instant = this.parsedInstant();
    const jd = getJulianDate(instant);
    const t = getJulianCenturies(jd);
    const earth = computeKeplerianState('earth', t, { x: 0, y: 0, z: 0 }, this.selectedLocation().latitude, 0);
    if (!earth) return [];
    const lst = getGMST(jd, t) + this.selectedLocation().longitude;
    return Object.keys(JPL_KEPLERIAN_ELEMENTS)
      .filter(key => key !== 'earth')
      .map(key => computeKeplerianState(
        key,
        t,
        { x: earth.heliocentricX, y: earth.heliocentricY, z: earth.heliocentricZ },
        this.selectedLocation().latitude,
        lst
      ))
      .filter((state): state is KeplerianOrbitalState => !!state)
      .concat(earth);
  });

  readonly selectedPlanetState = computed(() =>
    this.solarSystemStates().find(body => body.name.toLowerCase() === this.selectedPlanet()) ?? null
  );

  solarSystemScale(radiusAu: number): number {
    const max = 30.1;
    return 5 + (Math.log1p(Math.max(0, radiusAu)) / Math.log1p(max)) * 44;
  }

  orbitPath(state: KeplerianOrbitalState): string {
    const cx = 50;
    const cy = 50;
    const points = state.orbitPoints.map(point => {
      const radius = Math.hypot(point.x, point.y);
      const angle = Math.atan2(point.y, point.x);
      const scaled = this.solarSystemScale(radius);
      return [cx + Math.cos(angle) * scaled, cy + Math.sin(angle) * scaled];
    });
    return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ') + ' Z';
  }

  planetX(state: KeplerianOrbitalState): number {
    const radius = Math.hypot(state.heliocentricX, state.heliocentricY);
    const angle = Math.atan2(state.heliocentricY, state.heliocentricX);
    return 50 + Math.cos(angle) * this.solarSystemScale(radius);
  }

  planetY(state: KeplerianOrbitalState): number {
    const radius = Math.hypot(state.heliocentricX, state.heliocentricY);
    const angle = Math.atan2(state.heliocentricY, state.heliocentricX);
    return 50 + Math.sin(angle) * this.solarSystemScale(radius);
  }

  selectPlanet(name: string): void {
    this.selectedPlanet.set(name.toLowerCase());
  }

  readonly planetaryRiseSet = computed(() => {
    const location = this.selectedLocation();
    const date = this.parsedInstant();
    return this.planetaryPositions().map(planet => ({
      ...planet,
      riseSet: this.celestialService.getPlanetRiseSet(
        planet.body,
        date,
        location.latitude,
        location.longitude,
        location.elevationMeters ?? 0
      )
    }));
  });

  readonly eventsResult = computed<AstronomicalEventItem[]>(() => {
    return this.astroCalc.calculateYearlyEvents(this.selectedYear(), this.selectedLocation());
  });

  readonly whenIsResult = computed(() => {
    return this.astroCalc.solveWhenIs(this.whenIsQuery(), this.selectedLocation(), this.selectedYear());
  });

  constructor() {
    effect(() => {
      const location = this.selectedLocation();
      const tab = this.activeTab();
      const labels: Record<AstronomyTab, string> = {
        overview: 'Astronomy',
        solar: 'Sun Position',
        daylight: 'Daylight & Twilight',
        moon: 'Moon',
        events: 'Astronomical Events'
      };
      const title = `${labels[tab]} in ${location.name} | 2piClock`;
      const description = `Live ${labels[tab].toLowerCase()} for ${location.name}, ${location.country}, including precise solar and lunar calculations.`;
      this.title.setTitle(title);
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ property: 'og:description', content: description });
    });

    // Sync selectedDate with local timezone of the selected location
    effect(() => {
      const timezone = this.selectedLocation().timezone;
      this.selectedDate.set(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone
        }).format(new Date())
      );
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('location');
      if (slug) {
        const found = this.allPresets.find(p => p.id === slug);
        if (found) {
          this.locationService.selectLocation(found);
          this.selectedDate.set(new Intl.DateTimeFormat('en-CA', {
            timeZone: found.timezone
          }).format(new Date()));
        }
      }
    });

    this.route.data.subscribe(data => {
      const tab = data['tab'];
      if (tab && this.isValidTab(tab)) this.activeTab.set(tab as AstronomyTab);
    });

    this.route.queryParams.subscribe(params => {
      if (params['tab'] && this.isValidTab(params['tab'])) {
        this.activeTab.set(params['tab'] as AstronomyTab);
      }
      if (params['loc']) {
        const found = this.allPresets.find(p => p.id === params['loc'] || p.name.toLowerCase() === params['loc'].toLowerCase());
        if (found) this.locationService.selectLocation(found);
      }
      if (params['date']) {
        this.selectedDate.set(params['date']);
      }
      if (params['time']) {
        this.selectedTime.set(params['time']);
      }
    });
  }

  setTab(tab: AstronomyTab): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge'
    });
  }

  private isValidTab(tab: string): boolean {
    return ['overview', 'solar', 'daylight', 'moon', 'events'].includes(tab);
  }

  setLocation(loc: GeoLocation): void {
    this.locationService.selectLocation(loc);
  }

  setLocationById(id: string): void {
    const loc = this.allPresets.find(p => p.id === id);
    if (loc) {
      this.locationService.selectLocation(loc);
    }
  }

  setWhenIsQuery(query: 'next-full-moon' | 'next-new-moon' | 'spring-equinox' | 'summer-solstice' | 'autumn-equinox' | 'winter-solstice' | 'solar-noon'): void {
    this.whenIsQuery.set(query);
  }

  private getZonedDateTime(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    timeZone: string,
    millisecond = 0
  ): Date {
    const wallClockUtc = Date.UTC(year, month - 1, day, hour, minute, second, millisecond);

    const getOffsetMinutes = (instant: Date): number => {
      const value = new Intl.DateTimeFormat('en-US', {
        timeZone,
        timeZoneName: 'longOffset'
      }).formatToParts(instant).find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
      const match = value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
      if (!match) return 0;
      const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
      return match[1] === '+' ? minutes : -minutes;
    };

    let instant = new Date(wallClockUtc - getOffsetMinutes(new Date(wallClockUtc)) * 60000);
    const correctedOffset = getOffsetMinutes(instant);
    if (correctedOffset !== getOffsetMinutes(new Date(wallClockUtc))) {
      instant = new Date(wallClockUtc - correctedOffset * 60000);
    }
    return instant;
  }

  formatTime(date: Date | null): string {
    if (!date) return '--:--';
    return date.toLocaleTimeString('en-US', {
      timeZone: this.selectedLocation().timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  horizonLeft(azimuthDeg: number): number {
    return Math.max(4, Math.min(96, (azimuthDeg / 360) * 92 + 4));
  }

  horizonBottom(altitudeDeg: number): number {
    return Math.max(6, Math.min(88, ((altitudeDeg + 5) / 95) * 82 + 6));
  }

  sunAltitudePercent(altitudeDeg: number): number {
    return Math.max(0, Math.min(100, ((altitudeDeg + 90) / 180) * 100));
  }

  trajectoryX(hour: number): number {
    return Math.max(3, Math.min(97, (hour / 23) * 94 + 3));
  }

  trajectoryY(altitude: number): number {
    const normalized = Math.max(-90, Math.min(90, altitude));
    return 50 - (normalized / 90) * 42;
  }

  getCompassHeading(azimuthDeg: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(azimuthDeg / 22.5) % 16;
    return directions[idx] || 'N';
  }

  copyShareLink(): void {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.copyNotification.set('Astronomical calculation link copied!');
      setTimeout(() => this.copyNotification.set(null), 3500);
    });
  }
}
