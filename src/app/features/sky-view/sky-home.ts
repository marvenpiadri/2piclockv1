import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { CelestialService } from '../../core/services/celestial.service';
import { TimeControlService, SimulationSpeed } from '../../core/services/time-control.service';
import { LocationService } from '../../core/services/location.service';
import { WeatherService } from '../../core/services/weather.service';
import { AstronomicalCalculatorService } from '../../core/services/astronomical-calculator.service';
import { ObservatoryViewService, ObservatoryView } from '../../core/services/observatory-view.service';
import { GeoLocation } from '../../core/models/location.model';
import { GeocodingService } from '../../core/services/geocoding.service';
import { Subscription } from 'rxjs';
import { ShareExportModalComponent } from '../../shared/components/share-export-modal/share-export-modal';
import { CountryFlagComponent, WeatherAlertsModalComponent, AstronomicalEventsPanelComponent, WeatherBarChartComponent, WeatherIconComponent, ReactiveSkyComponent, CelestialAstrolabeComponent } from '../../shared/components';
import { SettingsModalComponent } from '../../shared/components/settings-modal/settings-modal';
import { FormsModule } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import * as Astronomy from 'astronomy-engine';

@Component({
  selector: 'app-sky-home',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule,
    MatIconModule, 
    ShareExportModalComponent, 
    WeatherAlertsModalComponent,
    AstronomicalEventsPanelComponent,
    SettingsModalComponent,
    WeatherBarChartComponent, WeatherIconComponent,
    RouterLink,
    CountryFlagComponent,
    ReactiveSkyComponent,
    CelestialAstrolabeComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sky-home.html',
  styleUrl: './sky-home.css'
})
export class SkyHomeComponent implements OnDestroy {
  // Angular templates resolve identifiers against the component instance.
  readonly Math = Math;
  private celestialService = inject(CelestialService);
  private timeControlService = inject(TimeControlService);
  private locationService = inject(LocationService);
  private readonly geocodingService = inject(GeocodingService);
  readonly weatherService = inject(WeatherService);
  private observatoryViewService = inject(ObservatoryViewService);
  private astronomicalCalculator = inject(AstronomicalCalculatorService);
  private title = inject(Title);
  private meta = inject(Meta);
  private route = inject(ActivatedRoute);

  readonly tonightViewMode = signal<'celestial' | 'analog'>('celestial');

  private readonly skyPageState = signal<'time' | 'weather' | 'tonight'>(
    (this.route.snapshot.data['skyPage'] ?? 'time') as 'time' | 'weather' | 'tonight'
  );
  get skyPage(): 'time' | 'weather' | 'tonight' {
    return this.skyPageState();
  }

  readonly activeView = this.observatoryViewService.activeView;
  readonly celestial = this.celestialService.celestialState;
  readonly weather = this.celestialService.currentWeather;
  readonly atmosphericState = this.celestialService.atmosphericState;
  readonly hourlyForecasts = this.weatherService.hourlyForecasts;
  readonly activeAlerts = this.weatherService.activeAlerts;
  readonly showAlertsModal = signal<boolean>(false);
  readonly showEventsPanel = signal<boolean>(false);
  readonly showSettingsModal = signal<boolean>(false);
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly allLocations = this.locationService.locations;
  readonly activeDate = this.timeControlService.currentActiveDate;
  readonly isLive = this.timeControlService.isLive;
  readonly isPlaying = this.timeControlService.isPlaying;
  readonly currentSpeed = this.timeControlService.simulationSpeed;
  readonly dayFraction = this.timeControlService.dayFraction;

  readonly localDayFraction = computed(() => {
    const d = this.activeDate();
    const zone = this.selectedLocation().timezone;
    const parts = this.getLocalDateParts(d, zone);
    return (
      (parts.hour * 3600000 +
        parts.minute * 60000 +
        parts.second * 1000 +
        d.getMilliseconds()) / 86400000
    );
  });

  readonly localTime = this.celestialService.formattedLocalTime;
  readonly localDate = this.celestialService.formattedLocalDate;
  readonly timezoneDisplay = this.celestialService.timezoneDisplay;
  readonly polarAngles = this.celestialService.polarClockAngles;
  readonly isBrightSky = this.celestialService.isBrightSky;

  readonly moonHandRotation = computed(() => {
    const ageDays = this.celestial().moon.ageDays;
    const elongationDeg = (ageDays / 29.530588853) * 360;
    const sunRot = this.localDayFraction() * 360 - 180;
    return sunRot + elongationDeg;
  });

  // Simulated Eclipse State for interactive exploration and visual testing
  readonly simulatedEclipse = signal<'none' | 'solar' | 'lunar'>('none');

  toggleEclipseSimulation(): void {
    this.simulatedEclipse.update(mode => {
      if (mode === 'none') return 'solar';
      if (mode === 'solar') return 'lunar';
      return 'none';
    });
  }

  readonly sunAltitude = computed(() => this.celestial().sun.altitudeDeg);
  readonly sunAzimuth = computed(() => this.celestial().sun.azimuthDeg);
  readonly moonAltitude = computed(() => this.celestial().moon.altitudeDeg);
  readonly moonAzimuth = computed(() => this.celestial().moon.azimuthDeg);

  // High-precision Sun Cartesian coordinate on circular celestial sky dome (-160 to +160 box)
  readonly sunCanvasPos = computed(() => {
    const alt = this.sunAltitude();
    const az = this.sunAzimuth();
    const rad = Math.max(10, Math.min(130, ((90 - alt) / 180) * 125));
    const angleRad = (az - 90) * (Math.PI / 180);
    return {
      x: Math.round(Math.cos(angleRad) * rad * 10) / 10,
      y: Math.round(Math.sin(angleRad) * rad * 10) / 10,
      isAboveHorizon: alt >= 0
    };
  });

  // High-precision Moon Cartesian coordinate on circular celestial sky dome
  readonly moonCanvasPos = computed(() => {
    const sim = this.simulatedEclipse();
    if (sim === 'solar') {
      const sun = this.sunCanvasPos();
      return { x: sun.x + 1.5, y: sun.y + 1, isAboveHorizon: sun.isAboveHorizon };
    }
    const alt = this.moonAltitude();
    const az = this.moonAzimuth();
    const rad = Math.max(10, Math.min(130, ((90 - alt) / 180) * 125));
    const angleRad = (az - 90) * (Math.PI / 180);
    return {
      x: Math.round(Math.cos(angleRad) * rad * 10) / 10,
      y: Math.round(Math.sin(angleRad) * rad * 10) / 10,
      isAboveHorizon: alt >= 0
    };
  });

  // Angular Separation between Sun and Moon in degrees
  readonly angularSeparationDeg = computed(() => {
    const sim = this.simulatedEclipse();
    if (sim === 'solar') return 0.2;
    if (sim === 'lunar') return 179.8;
    const sunAlt = (this.sunAltitude() * Math.PI) / 180;
    const sunAz = (this.sunAzimuth() * Math.PI) / 180;
    const moonAlt = (this.moonAltitude() * Math.PI) / 180;
    const moonAz = (this.moonAzimuth() * Math.PI) / 180;

    const cosD = Math.sin(sunAlt) * Math.sin(moonAlt) + Math.cos(sunAlt) * Math.cos(moonAlt) * Math.cos(sunAz - moonAz);
    const clamped = Math.max(-1, Math.min(1, cosD));
    return Math.round((Math.acos(clamped) * 180 / Math.PI) * 10) / 10;
  });

  // Active Solar / Lunar Eclipse Detection & Telemetry
  readonly activeEclipseState = computed(() => {
    const sim = this.simulatedEclipse();
    const sep = this.angularSeparationDeg();
    const moonIllum = this.celestial().moon.illuminationFraction;

    if (sim === 'solar' || sep < 1.6) {
      return {
        isActive: true,
        type: 'Total Solar Eclipse Active',
        category: 'solar' as const,
        description: 'Moon umbra completely obscures the solar photosphere, revealing the corona and diamond ring flare.',
        color: '#fde047',
        obscuration: sim === 'solar' ? 100 : Math.round((1 - sep / 1.6) * 100)
      };
    }

    if (sim === 'lunar' || (sep > 178.4 && moonIllum > 0.92)) {
      return {
        isActive: true,
        type: 'Total Lunar Eclipse (Blood Moon)',
        category: 'lunar' as const,
        description: 'Moon is immersed in Earth umbra; Rayleigh scattered atmospheric sunlight renders the lunar disk deep crimson.',
        color: '#f43f5e',
        obscuration: 100
      };
    }

    return {
      isActive: false,
      type: 'Standard Celestial Orbit',
      category: 'none' as const,
      description: 'Real-time diurnal solar altitude and lunar phase geometry over the local horizon.',
      color: '#94a3b8',
      obscuration: 0
    };
  });

  readonly planetaryPositions = this.celestialService.planetaryPositions;

  readonly visiblePlanetsTonight = computed(() => {
    const location = this.selectedLocation();
    const date = this.activeDate();

    return this.planetaryPositions()
      .filter(p => p.altitudeDeg > 0 && p.visible)
      .map(planet => {
        const riseSet = this.celestialService.getPlanetRiseSet(
          planet.body,
          date,
          location.latitude,
          location.longitude,
          location.elevationMeters ?? 0
        );

        return {
          ...planet,
          rise: riseSet.rise,
          set: riseSet.set
        };
      });
  });

  readonly tonightDarknessWindow = computed(() => {
    const ev = this.celestial().solarEvents;
    return {
      civilDusk: ev.civilDusk,
      nauticalDusk: ev.nauticalDusk,
      astronomicalDusk: ev.astronomicalDusk,
      astronomicalDawn: ev.astronomicalDawn,
      nauticalDawn: ev.nauticalDawn,
      civilDawn: ev.civilDawn
    };
  });

  readonly moonObserving = computed(() => {
    const c = this.celestial();
    const moon = c.moon;
    const location = this.selectedLocation();
    const moonEvents = this.celestialService.getPlanetRiseSet(
      Astronomy.Body.Moon,
      this.activeDate(),
      location.latitude,
      location.longitude,
      location.elevationMeters ?? 0
    );
    const sunAlt = c.sun.altitudeDeg;
    const moonAbove = moon.altitudeDeg > 0;
    const moonInterference = moonAbove ? Math.round(moon.illuminationFraction * 100) : 0;

    return {
      illuminationPct: Math.round(moon.illuminationFraction * 100),
      altitudeDeg: moon.altitudeDeg,
      azimuthDeg: moon.azimuthDeg,
      phaseName: moon.phaseName,
      rise: moonEvents.rise,
      set: moonEvents.set,
      aboveHorizon: moonAbove,
      interferencePct: sunAlt < -12 ? moonInterference : Math.round(moonInterference * 0.35)
    };
  });

  readonly visibleConstellations = computed(() =>
    this.celestialService.getVisibleConstellations(
      this.activeDate(),
      this.selectedLocation().latitude,
      this.selectedLocation().longitude,
      8
    )
  );

  readonly tonightTimeline = computed(() => {
    const c = this.celestial();
    const moon = this.moonObserving();
    const events = [
      { label: 'Sunset', time: c.solarEvents.sunset, detail: 'Sun reaches the horizon' },
      { label: 'Civil dusk', time: c.solarEvents.civilDusk, detail: 'Bright stars begin to emerge' },
      { label: 'Moonrise', time: moon.rise, detail: moon.phaseName + ' · ' + moon.illuminationPct + '% illuminated' },
      { label: 'Astronomical dusk', time: c.solarEvents.astronomicalDusk, detail: 'Astronomical darkness begins' },
      { label: 'Astronomical dawn', time: c.solarEvents.astronomicalDawn, detail: 'Astronomical darkness ends' },
      { label: 'Moonset', time: moon.set, detail: 'Moon drops below the horizon' }
    ];
    return events
      .filter(event => event.time instanceof Date && Number.isFinite(event.time.getTime()))
      .sort((a, b) => a.time!.getTime() - b.time!.getTime());
  });

  readonly upcomingCelestialEvents = computed(() => {
    const now = this.activeDate().getTime();
    const location = this.selectedLocation();
    const year = Number(new Intl.DateTimeFormat('en-US', {
      timeZone: location.timezone,
      year: 'numeric'
    }).format(this.activeDate()));

    const events = [
      ...this.astronomicalCalculator.calculateYearlyEvents(year, location),
      ...this.astronomicalCalculator.calculateYearlyEvents(year + 1, location)
    ];

    return events
      .filter(event => event.date.getTime() > now)
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 4);
  });

  readonly tonightTwilightSequence = computed(() => {
    const ev = this.celestial().solarEvents;
    return [
      { name: 'Golden Hour', time: this.formatTime(ev.goldenHourEvening.start), alt: '+6.0° to -4.0°', desc: 'Warm horizontal solar rays' },
      { name: 'Sunset', time: this.formatTime(ev.sunset), alt: '0.0° Horizon', desc: 'Solar disk touches the horizon' },
      { name: 'Civil Dusk', time: this.formatTime(ev.civilDusk), alt: '-6.0° Nadir', desc: 'Brightest stars & planets emerge' },
      { name: 'Nautical Dusk', time: this.formatTime(ev.nauticalDusk), alt: '-12.0° Nadir', desc: 'Horizon outline becomes indistinct' },
      { name: 'Astro Dusk', time: this.formatTime(ev.astronomicalDusk), alt: '-18.0° Nadir', desc: 'Full astronomical darkness begins' },
      { name: 'Solar Midnight', time: '00:00', alt: 'Lowest Nadir', desc: 'Sun reaches maximum depth below Earth' }
    ];
  });

  // Clock Display Mode: Radian 2Pi Dial vs Analog Clock (Digital option removed as requested)
  readonly clockDisplayMode = signal<'radian' | 'analog'>('radian');

  readonly showShareModal = signal<boolean>(false);
  
  readonly isInspectorVisible = signal<boolean>(false);
  // Integrated right environmental deck: expanded by default, part of the page layout (not absolute or fixed modal)
  readonly isRightPanelExpanded = signal<boolean>(true);
  readonly activeDeckTab = signal<'weather' | 'observations'>('weather');

  toggleRightPanel(): void {
    this.isRightPanelExpanded.update(v => !v);
  }

  setDeckTab(tab: 'weather' | 'observations'): void {
    this.activeDeckTab.set(tab);
  }


  readonly windCompass = computed(() => {
    const deg = this.weather().windDirectionDeg;
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(((deg % 360) / 22.5)) % 16;
    return directions[index];
  });

  readonly dewPointC = computed(() => {
    const t = this.weather().temperatureC;
    const rh = Math.max(1, Math.min(100, this.weather().humidityPct));
    const a = 17.27;
    const b = 237.7;
    const alpha = ((a * t) / (b + t)) + Math.log(rh / 100);
    const dp = (b * alpha) / (a - alpha);
    return Math.round(dp * 10) / 10;
  });

  readonly dewPointF = computed(() => {
    return Math.round((this.dewPointC() * 9 / 5 + 32) * 10) / 10;
  });

  readonly uvRiskLevel = computed(() => {
    const uv = this.weather().uvIndex;
    if (uv <= 2) return { label: 'Low', color: '#38bdf8', advice: 'Minimal sun hazard' };
    if (uv <= 5) return { label: 'Moderate', color: '#facc15', advice: 'Wear sunglasses & hat' };
    if (uv <= 7) return { label: 'High', color: '#fb923c', advice: 'Protection required' };
    if (uv <= 10) return { label: 'Very High', color: '#f43f5e', advice: 'Seek shade midday' };
    return { label: 'Extreme', color: '#c084fc', advice: 'Avoid direct midday exposure' };
  });

  readonly daylightDurationMinutes = computed(() => {
    const events = this.celestial().solarEvents;
    if (!events.sunrise || !events.sunset) return null;
    return Math.max(0, Math.round((events.sunset.getTime() - events.sunrise.getTime()) / 60000));
  });

  readonly solarProgress = computed(() => {
    const events = this.celestial().solarEvents;
    if (!events.sunrise || !events.sunset) return 50;
    const now = this.activeDate().getTime();
    const rise = events.sunrise.getTime();
    const set = events.sunset.getTime();
    if (now < rise) return 0;
    if (now > set) return 100;
    return Math.round(((now - rise) / (set - rise)) * 100);
  });

  readonly starlightScore = computed(() => {
    const w = this.weather();
    const c = this.celestial();
    const sunAlt = c.sun.altitudeDeg;
    const moonAlt = c.moon.altitudeDeg;
    const moonIllum = c.moon.illuminationFraction;

    if (sunAlt > 0) {
      return { score: 5, rating: 'Daylight', advice: 'Sun above horizon, night observation unavailable.' };
    }
    if (sunAlt > -6) {
      return { score: 18, rating: 'Civil Twilight', advice: 'Only bright planets (Venus, Jupiter) visible.' };
    }
    if (sunAlt > -12) {
      return { score: 38, rating: 'Nautical Twilight', advice: 'Navigational stars and brighter constellations visible.' };
    }

    let score = 100;
    score -= w.cloudCoverPct * 0.75;
    if (moonAlt > 0) {
      score -= moonIllum * 35;
    }
    score -= (100 - Math.min(100, w.visibilityKm * 5)) * 0.15;
    score = Math.max(8, Math.min(99, Math.round(score)));

    if (score >= 80) return { score, rating: 'Pristine Dark Sky', advice: 'Exceptional transparency. Milky Way and deep-sky nebulae visible.' };
    if (score >= 60) return { score, rating: 'Good Stargazing', advice: 'Clear visibility. Major constellations and planets easily observed.' };
    if (score >= 40) return { score, rating: 'Moderate Seeing', advice: 'Partly veiled by light cloud or lunar brightness.' };
    return { score, rating: 'Poor / Obscured', advice: 'Overcast or heavy lunar glare obscuring celestial bodies.' };
  });

  readonly comfortIndex = computed(() => {
    const temp = this.weather().temperatureC;
    const wind = this.weather().windSpeedKmh;
    const rain = this.weather().precipitationPct;

    if (rain > 60 || wind > 45) {
      return { score: 32, label: 'Unfavorable', color: '#f43f5e', activity: 'Stay sheltered' };
    }
    if (temp >= 16 && temp <= 24 && wind < 20 && rain < 20) {
      return { score: 94, label: 'Ideal', color: '#34d399', activity: 'Perfect for all outdoor activities' };
    }
    if (temp >= 10 && temp <= 28 && wind < 30 && rain < 40) {
      return { score: 78, label: 'Pleasant', color: '#facc15', activity: 'Good for walking, running, and cycling' };
    }
    return { score: 55, label: 'Brisk / Demanding', color: '#fb923c', activity: 'Dress appropriately for conditions' };
  });
  // Route-driven Sky pages keep each subject focused and lightweight.
  readonly activeSection = signal<'time' | 'weather' | 'footer'>('time');
  readonly skySections = [
    { id: 'time', label: 'Time', icon: 'schedule' },
    { id: 'weather', label: 'Weather', icon: 'cloud' },
    { id: 'footer', label: 'About', icon: 'info' }
  ] as const;

  readonly worldClockCities = [
    { name: 'London', zone: 'Europe/London' },
    { name: 'New York', zone: 'America/New_York' },
    { name: 'Dubai', zone: 'Asia/Dubai' },
    { name: 'Tokyo', zone: 'Asia/Tokyo' }
  ];

  constructor() {
    // A single SkyHome component powers the location-first routes. The URL
    // supplies both the location slug and the focused experience.
    // Restore a shared astronomical instant from ?at=<ISO timestamp>.
    // Location remains authoritative from the route; the timestamp is optional.
    this.route.queryParamMap.subscribe(params => {
      const sharedAt = params.get('at');
      if (!sharedAt) return;
      const date = new Date(sharedAt);
      if (Number.isFinite(date.getTime())) {
        this.timeControlService.setSpecificInstant(date);
      }
    });

    this.route.paramMap.subscribe(params => {
      const experience = params.get('experience') as string | null;
      // Location-scoped routes are synchronized by validLocationGuard before
      // this component renders. Do not select again here or a route change
      // would clear weather overrides and trigger a duplicate refresh.
      const routeExperience = experience && ['time', 'weather', 'tonight'].includes(experience)
        ? experience as 'time' | 'weather' | 'tonight'
        : (this.route.snapshot.data['skyPage'] ?? 'time') as 'time' | 'weather' | 'tonight';
      this.skyPageState.set(routeExperience);
    });

    // Weather refresh is owned by CelestialService so location changes have
    // exactly one request path across the app.
    effect(() => {
      const location = this.selectedLocation();
      const labels = {
        time: `Now in ${location.name}, ${location.country}`,
        weather: `Weather in ${location.name}, ${location.country}`,
        tonight: `Tonight in ${location.name}, ${location.country}`
      };
      const descriptions = {
        time: `Current local time, sunrise, sunset, weather and astronomical conditions for ${location.name}, ${location.country}.`,
        weather: `Current conditions, hourly weather and a 7-day forecast for ${location.name}, ${location.country}.`,
        tonight: `Tonight in ${location.name}: moon phase, twilight, stargazing conditions and the night sky.`
      };
      const title = `${labels[this.skyPage]} | 2piClock`;
      const description = descriptions[this.skyPage];
      this.title.setTitle(title);
      this.meta.updateTag({ name: 'description', content: description });
      this.meta.updateTag({ property: 'og:title', content: title });
      this.meta.updateTag({ property: 'og:description', content: description });
    });
  }

  formatWorldTime(zone: string): string {
    return this.activeDate().toLocaleTimeString('en-GB', {
      timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: false
    });
  }

  formatWorldDay(zone: string): string {
    return this.activeDate().toLocaleDateString('en-US', { timeZone: zone, weekday: 'short' });
  }

  onSkyScroll(event: Event): void {
    const container = event.currentTarget as HTMLElement;
    const center = container.scrollTop + container.clientHeight / 2;
    let nearest: typeof this.skySections[number]['id'] = this.skySections[0].id;
    let nearestDistance = Infinity;

    for (const section of this.skySections) {
      const element = document.getElementById('sky-section-' + section.id);
      if (!element) continue;
      const midpoint = element.offsetTop + element.offsetHeight / 2;
      const distance = Math.abs(midpoint - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = section.id;
      }
    }

    this.activeSection.set(nearest as 'time' | 'weather' | 'footer');
  }

  scrollToSection(id: string): void {
    document.getElementById('sky-section-' + id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  openWeatherReport(): void {
    this.scrollToSection('weather');
  }


  toggleInspector(): void {
    this.isInspectorVisible.update(v => !v);
  }

  // Right Inspector Panel 100% Drawer state
  readonly isDrawerOpen = signal<boolean>(false);
  readonly activeDrawerTab = signal<'weather' | 'ephemeris' | 'solar-jump' | 'locations'>('weather');

  // Ephemeris Model Selector (like Windy's forecast model selector)
  readonly selectedEphemerisModel = signal<'vsop87' | 'noaa' | 'nist' | '2pi'>('vsop87');
  readonly isFahrenheit = signal<boolean>(false);

  // Layer & Visual Toggles
  readonly showParticles = signal<boolean>(true);
  readonly showTwilightBands = signal<boolean>(true);
  readonly showConstellations = signal<boolean>(true);
  readonly isFullscreen = signal<boolean>(false);
  readonly zoomLevel = signal<number>(100);

  // Calendar ribbon follows the selected location's local civil date.
  // The Date objects here are UTC calendar carriers, not instants to display.
  readonly weeklyForecast = computed(() => {
    const hourly = this.weatherService.hourlyForecasts();
    const zone = this.selectedLocation().timezone;
    const active = this.activeDate();
    const base = this.getLocalDateParts(active, zone);
    const days: { key: string; label: string; condition: string; temperatureC: number; temperatureF: number; highC: number; highF: number; lowC: number; lowF: number; precipitationPct: number; windKmh: number }[] = [];

    for (let offset = 0; offset < 7; offset++) {
      const d = new Date(Date.UTC(base.year, base.month - 1, base.day + offset));
      const key = d.toISOString().slice(0, 10);
      const entries = hourly.filter(item => {
        const p = this.getLocalDateParts(new Date(item.timeMs), zone);
        return `${p.year}-${String(p.month).padStart(2,'0')}-${String(p.day).padStart(2,'0')}` === key;
      });
      if (!entries.length) continue;

      const values = entries.map(e => e.weather);
      const highC = Math.max(...values.map(v => v.temperatureC));
      const lowC = Math.min(...values.map(v => v.temperatureC));
      const avg = values.reduce((sum,v) => sum + v.temperatureC, 0) / values.length;
      const representative = values.reduce((best,v) => Math.abs(v.temperatureC-avg) < Math.abs(best.temperatureC-avg) ? v : best, values[0]);
      const precip = Math.max(...values.map(v => v.precipitationPct));
      const wind = Math.max(...values.map(v => v.windSpeedKmh));
      const dayName = offset === 0 ? 'Today' : new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(d);

      days.push({
        key,
        label: dayName,
        condition: representative.conditionLabel,
        temperatureC: representative.temperatureC,
        temperatureF: representative.temperatureF,
        highC,
        highF: Math.round((highC * 9 / 5 + 32) * 10) / 10,
        lowC,
        lowF: Math.round((lowC * 9 / 5 + 32) * 10) / 10,
        precipitationPct: precip,
        windKmh: wind
      });
    }

    return days;
  });

  readonly upcomingDays = computed(() => {
    const days: { date: Date; label: string; isToday: boolean; isSelected: boolean }[] = [];
    const active = this.activeDate();
    const timeZone = this.selectedLocation().timezone;
    const activeParts = this.getLocalDateParts(active, timeZone);
    const activeKey = `${activeParts.year}-${String(activeParts.month).padStart(2, '0')}-${String(activeParts.day).padStart(2, '0')}`;
    const base = new Date(Date.UTC(activeParts.year, activeParts.month - 1, activeParts.day));

    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      const dayName = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        weekday: 'short'
      }).format(d);
      const dayNum = d.getUTCDate();
      const isToday = i === 0;
      const isSelected = d.toISOString().slice(0, 10) === activeKey;

      days.push({
        date: d,
        label: `${dayName} ${dayNum}`,
        isToday,
        isSelected
      });
    }
    return days;
  });

  selectDay(d: Date): void {
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    this.timeControlService.setSpecificInstant(
      this.getZonedDateTime(year, month, day, 0, 0, 0, this.selectedLocation().timezone)
    );
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => console.debug('Fullscreen request error:', err));
      this.isFullscreen.set(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => console.debug('Fullscreen exit error:', err));
      }
      this.isFullscreen.set(false);
    }
  }

  zoomIn(): void {
    this.zoomLevel.update(z => Math.min(180, z + 15));
  }

  zoomOut(): void {
    this.zoomLevel.update(z => Math.max(60, z - 15));
  }

  resetZoom(): void {
    this.zoomLevel.set(100);
  }

  // Drawer location search is backed by the complete internal city database.
  // Presets remain only for the default state; they never constrain search.
  readonly drawerSearchQuery = signal<string>('');
  readonly drawerLocationResults = signal<GeoLocation[]>([]);
  readonly drawerLocationSearching = signal(false);
  private drawerSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private drawerSearchSubscription: Subscription | null = null;

  readonly filteredDrawerLocations = computed(() => {
    const q = this.drawerSearchQuery().trim();
    if (!q) return this.allLocations();
    return this.drawerLocationResults();
  });

  onDrawerSearch(value: string): void {
    this.drawerSearchQuery.set(value);
    if (this.drawerSearchTimer) clearTimeout(this.drawerSearchTimer);
    this.drawerSearchSubscription?.unsubscribe();

    const q = value.trim();
    if (q.length < 2) {
      this.drawerLocationResults.set([]);
      this.drawerLocationSearching.set(false);
      return;
    }

    this.drawerLocationSearching.set(true);
    this.drawerSearchTimer = setTimeout(() => {
      this.drawerSearchSubscription = this.geocodingService.search(q, 50).subscribe({
        next: results => {
          this.drawerLocationResults.set(results);
          this.drawerLocationSearching.set(false);
        },
        error: () => {
          this.drawerLocationResults.set([]);
          this.drawerLocationSearching.set(false);
        }
      });
    }, 180);
  }

  ngOnDestroy(): void {
    if (this.drawerSearchTimer) clearTimeout(this.drawerSearchTimer);
    this.drawerSearchSubscription?.unsubscribe();
  }

  setView(view: ObservatoryView): void {
    this.observatoryViewService.setView(view);
  }

  toggleDrawer(): void {
    this.isDrawerOpen.update(v => !v);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  openDrawerTab(tab: 'weather' | 'ephemeris' | 'solar-jump' | 'locations'): void {
    this.activeDrawerTab.set(tab);
    this.isDrawerOpen.set(true);
  }

  formatDayLength(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}m`;
  }

  formatMoonDistance(dist: number): string {
    return Math.round(dist).toLocaleString();
  }

  // Quick jump time presets operate on the exact selected-location instant.
  jumpToSolarEvent(event: 'dawn' | 'sunrise' | 'noon' | 'golden' | 'sunset' | 'blue' | 'night' | 'midnight'): void {
    const events = this.celestial().solarEvents;
    let targetDate: Date | null = null;

    switch (event) {
      case 'dawn': targetDate = events.civilDawn || events.nauticalDawn; break;
      case 'sunrise': {
        if (events.sunrise) {
          targetDate = events.sunrise;
        } else if (events.isPolarDay) {
          const localDate = this.getLocalDateParts(this.activeDate(), this.selectedLocation().timezone);
          targetDate = this.getZonedDateTime(localDate.year, localDate.month, localDate.day, 0, 0, 0, this.selectedLocation().timezone);
        }
        break;
      }
      case 'noon': {
        if (events.solarNoon) {
          targetDate = events.solarNoon;
        } else {
          const localDate = this.getLocalDateParts(this.activeDate(), this.selectedLocation().timezone);
          targetDate = this.getZonedDateTime(localDate.year, localDate.month, localDate.day, 12, 0, 0, this.selectedLocation().timezone);
        }
        break;
      }
      case 'golden': targetDate = events.goldenHourEvening.start || events.goldenHourMorning.start; break;
      case 'sunset': {
        if (events.sunset) {
          targetDate = events.sunset;
        } else if (events.isPolarNight) {
          const localDate = this.getLocalDateParts(this.activeDate(), this.selectedLocation().timezone);
          targetDate = this.getZonedDateTime(localDate.year, localDate.month, localDate.day, 12, 0, 0, this.selectedLocation().timezone);
        }
        break;
      }
      case 'blue': targetDate = events.blueHourEvening.start; break;
      case 'night':
      case 'midnight': {
        const localDate = this.getLocalDateParts(this.activeDate(), this.selectedLocation().timezone);
        targetDate = this.getZonedDateTime(
          localDate.year,
          localDate.month,
          localDate.day,
          0, 0, 0,
          this.selectedLocation().timezone
        );
        break;
      }
    }

    if (targetDate) {
      this.timeControlService.setSpecificInstant(targetDate);
    }
  }

  readonly comparisonDateInput = signal('');
  readonly isComparingDates = computed(() => this.comparisonDateInput().length === 10);

  readonly timeMachineComparison = computed(() => {
    const value = this.comparisonDateInput();
    if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const timezone = this.selectedLocation().timezone;
    const comparisonDate = this.getZonedDateTime(year, month, day, 12, 0, 0, timezone);
    const observer = new Astronomy.Observer(
      this.selectedLocation().latitude,
      this.selectedLocation().longitude,
      this.selectedLocation().elevationMeters ?? 0
    );
    const rise = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, +1, comparisonDate, 1);
    const set = Astronomy.SearchRiseSet(Astronomy.Body.Sun, observer, -1, comparisonDate, 1);
    const currentParts = this.getLocalDateParts(this.activeDate(), timezone);
    const comparisonMs = Date.UTC(year, month - 1, day);
    const currentMs = Date.UTC(currentParts.year, currentParts.month - 1, currentParts.day);
    const dayDelta = Math.round((comparisonMs - currentMs) / 86400000);
    const daylightMinutes = rise && set ? Math.round((set.date.getTime() - rise.date.getTime()) / 60000) : null;
    return {
      date: value,
      dayDelta,
      sunrise: rise ? this.formatTime(rise.date) : '--:--',
      sunset: set ? this.formatTime(set.date) : '--:--',
      daylightMinutes
    };
  });

  setComparisonDate(value: string): void {
    if (/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) this.comparisonDateInput.set(value);
  }

  clearComparisonDate(): void {
    this.comparisonDateInput.set('');
  }

  readonly activeLocalDateInput = computed(() => {
    const p = this.getLocalDateParts(this.activeDate(), this.selectedLocation().timezone);
    return p.year + '-' + String(p.month).padStart(2, '0') + '-' + String(p.day).padStart(2, '0');
  });

  setTimeMachineDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return;
    this.timeControlService.setSpecificInstant(
      this.getZonedDateTime(year, month, day, 12, 0, 0, this.selectedLocation().timezone)
    );
  }

  shiftTimeMachineDate(days: number): void {
    if (!Number.isFinite(days)) return;
    const current = this.getLocalDateParts(this.activeDate(), this.selectedLocation().timezone);
    const carrier = new Date(Date.UTC(current.year, current.month - 1, current.day + Math.trunc(days)));
    this.setTimeMachineDate(carrier.toISOString().slice(0, 10));
  }


  onScrubberInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    const fraction = Math.max(0, Math.min(0.999999, parseFloat(target.value)));
    const localDate = this.getLocalDateParts(this.activeDate(), this.selectedLocation().timezone);
    const totalMs = fraction * 86400000;
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = Math.floor(totalMs % 1000);

    this.timeControlService.setSpecificInstant(
      this.getZonedDateTime(
        localDate.year,
        localDate.month,
        localDate.day,
        hours,
        minutes,
        seconds,
        this.selectedLocation().timezone,
        milliseconds
      )
    );
  }

  private getLocalDateParts(date: Date, timeZone: string): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);

    const value = (type: string) => Number(parts.find(part => part.type === type)?.value ?? 0);
    return {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      hour: value('hour'),
      minute: value('minute'),
      second: value('second')
    };
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
    return TimeControlService.createExactZonedDateTime(
      year,
      month,
      day,
      hour,
      minute,
      second,
      timeZone,
      millisecond
    );
  }

  setLive(): void {
    this.timeControlService.setLive();
  }

  togglePlay(): void {
    this.timeControlService.togglePlayPause();
  }

  setSpeed(speed: SimulationSpeed): void {
    this.timeControlService.setSimulationSpeed(speed);
  }

  stepMinutes(min: number): void {
    this.timeControlService.stepMinutes(min);
  }

  toggleTempUnit(): void {
    this.isFahrenheit.update(v => !v);
  }

  selectLocation(loc: GeoLocation): void {
    this.locationService.selectLocation(loc);
  }

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

  getTwilightBadgeClass(state: string): string {
    switch (state) {
      case 'day': return 'badge-day';
      case 'golden_hour': return 'badge-golden';
      case 'civil_twilight': return 'badge-civil';
      case 'nautical_twilight': return 'badge-nautical';
      case 'astronomical_twilight': return 'badge-astro';
      default: return 'badge-night';
    }
  }

  getTwilightLabel(state: string): string {
    switch (state) {
      case 'day': return 'Daylight';
      case 'golden_hour': return 'Golden Hour';
      case 'civil_twilight': return 'Civil Twilight';
      case 'nautical_twilight': return 'Nautical Twilight';
      case 'astronomical_twilight': return 'Astro Twilight';
      default: return 'Deep Night';
    }
  }

  getMoonPhaseIcon(phase: string): string {
    switch (phase) {
      case 'New Moon': return 'brightness_1';
      case 'Waxing Crescent': return 'nightlight_round';
      case 'First Quarter': return 'brightness_2';
      case 'Waxing Gibbous': return 'brightness_3';
      case 'Full Moon': return 'brightness_high';
      case 'Waning Gibbous': return 'brightness_3';
      case 'Third Quarter': return 'brightness_2';
      case 'Waning Crescent': return 'nightlight_round';
      default: return 'nightlight_round';
    }
  }

  openAlertsModal(): void {
    this.showAlertsModal.set(true);
  }

  closeAlertsModal(): void {
    this.showAlertsModal.set(false);
  }

  openEventsPanel(): void {
    this.showEventsPanel.set(true);
  }

  closeEventsPanel(): void {
    this.showEventsPanel.set(false);
  }

  openSettingsModal(): void {
    this.showSettingsModal.set(true);
  }

  closeSettingsModal(): void {
    this.showSettingsModal.set(false);
  }
}
