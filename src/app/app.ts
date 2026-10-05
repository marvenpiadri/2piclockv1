import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ReactiveSkyComponent } from './shared/components/reactive-sky/reactive-sky';
import { DeepSpaceBackdropComponent } from './shared/components/deep-space-backdrop/deep-space-backdrop';
import { CountryFlagComponent, MiniRadioPlayerComponent } from './shared/components';
import { PwaInstallComponent } from './shared/components/pwa-install/pwa-install';
import { GlassThemeService } from './core/services/glass-theme.service';
import { LocationService } from './core/services/location.service';
import { CelestialService } from './core/services/celestial.service';
import { ErrorHandlerService } from './core/services/error-handler.service';
import { ObservatoryViewService, ObservatoryView } from './core/services/observatory-view.service';
import { GeoLocation } from './core/models/location.model';
import { GeocodingService } from './core/services/geocoding.service';
import { Subscription, filter } from 'rxjs';

export interface NavCategory {
  title: string;
  icon: string;
  items: {
    label: string;
    path?: string;
    view?: ObservatoryView;
    desc: string;
    icon: string;
    tag?: string;
  }[];
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    FormsModule, 
    MatIconModule, 
    ReactiveSkyComponent, 
    DeepSpaceBackdropComponent,
    CountryFlagComponent,
    MiniRadioPlayerComponent,
    PwaInstallComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly document = inject(DOCUMENT);
  private locationService = inject(LocationService);
  private celestialService = inject(CelestialService);
  private geocodingService = inject(GeocodingService);
  private observatoryViewService = inject(ObservatoryViewService);
  readonly errorHandler = inject(ErrorHandlerService);
  readonly glassThemeService = inject(GlassThemeService);
  readonly router = inject(Router);

  readonly activeView = this.observatoryViewService.activeView;
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly randomLocations = this.locationService.randomLocations;
  readonly isLocating = this.locationService.isLocating;
  readonly locationError = this.locationService.locationError;

  // Animated substrates are mounted only on experiences that actually use them.
  // This prevents the 60fps sky renderer from consuming CPU on calculators,
  // maps and other product routes.
  readonly currentRoute = signal<string>('/');
  readonly sleepMode = computed(() => this.currentRoute().split('?')[0] === '/sleep-calculator');

  readonly showDeepSpace = computed(() => {
    const url = this.currentRoute().toLowerCase();
    return (
      url.includes('tonight') ||
      url.includes('astronomy') ||
      url.includes('stargazing') ||
      url.includes('eclipses') ||
      url.includes('satellites') ||
      url.includes('space') ||
      url.includes('ephemeris') ||
      url.startsWith('/space') ||
      url.startsWith('/deep-space')
    );
  });

  readonly showReactiveSky = computed(() => {
    if (this.showDeepSpace()) return false;
    const url = this.currentRoute();
    return (
      url === '/now' ||
      url === '/weather' ||
      url === '/sleep-calculator' ||
      /^\/[a-z0-9-]+(?:\/(?:weather|time|sun|moon))?(?:\?.*)?$/.test(url) ||
      url.startsWith('/sky')
    );
  });

  readonly localTime = this.celestialService.formattedLocalTime;
  readonly localDate = this.celestialService.formattedLocalDate;
  readonly celestial = this.celestialService.celestialState;
  readonly currentWeather = this.celestialService.currentWeather;

  readonly isDaytime = computed(() => {
    const state = this.celestial();
    return state.sun.isAboveHorizon || state.twilightState === 'day' || state.twilightState === 'golden_hour';
  });

  readonly weatherClass = computed(() => {
    const w = this.currentWeather();
    const cond = w?.condition || 'clear';
    if (
      cond === 'thunderstorm' ||
      cond === 'severe_storm' ||
      cond === 'severe_thunderstorm' ||
      cond === 'monsoon' ||
      cond === 'tropical_storm'
    ) return 'weather-storm';
    if (
      cond === 'rain' ||
      cond === 'heavy_rain' ||
      cond === 'heavy_downpour' ||
      cond === 'drizzle' ||
      cond === 'freezing_rain' ||
      cond === 'hail' ||
      cond === 'sleet'
    ) return 'weather-rain';
    if (
      cond === 'snow' ||
      cond === 'snow_flurries' ||
      cond === 'heavy_snow' ||
      cond === 'blizzard'
    ) return 'weather-snow';
    if (
      cond === 'fog' ||
      cond === 'freezing_fog' ||
      cond === 'haze' ||
      cond === 'dust_haze' ||
      cond === 'spring_mist' ||
      cond === 'autumn_haze'
    ) return 'weather-fog';
    if (
      cond === 'cloudy' ||
      cond === 'overcast' ||
      cond === 'partly_cloudy' ||
      cond === 'broken_clouds' ||
      cond === 'low_clouds' ||
      cond === 'winter_overcast'
    ) return 'weather-cloudy';
    return 'weather-clear';
  });

  readonly badgeTooltip = computed(() => {
    const isDay = this.isDaytime();
    const w = this.currentWeather();
    const loc = this.selectedLocation();
    const phase = isDay ? 'Sun (Solar Day)' : 'Moon (Lunar Night)';
    const temp = w?.temperatureC !== undefined ? `${w.temperatureC}°C` : '';
    const cond = w?.conditionLabel || '';
    return `2piClock · ${phase} · ${loc.name}${temp ? ' · ' + temp : ''}${cond ? ' · ' + cond : ''}`;
  });

  constructor() {
    this.currentRoute.set(this.router.url || '/');
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(event => {
        const url = (event as NavigationEnd).urlAfterRedirects || '/';
        this.currentRoute.set(url);
      });
  }

  // Dropdown & sidebar collapse states
  showLocationDropdown = signal<boolean>(false);
  showNavMenu = signal<boolean>(false);
  isSearchFocused = signal<boolean>(false);
  isNavCollapsed = signal<boolean>(false);

  toggleNavCollapse(): void {
    this.isNavCollapsed.update(v => !v);
  }

  // Search filter for city picker
  searchQuery = signal<string>('');
  readonly remoteLocations = signal<GeoLocation[]>([]);
  readonly isRemoteSearching = signal(false);
  private remoteSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private remoteSearchSubscription: Subscription | null = null;

  // Categorized Navigation Directory
  readonly navCategories: NavCategory[] = [
    {
      title: 'Time Product Suite',
      icon: 'schedule',
      items: [
        {
          label: 'Time Zone Converter',
          path: '/time',
          desc: 'Multi-target timezone conversion with DST awareness, 12/24h formats, and date offsets.',
          icon: 'sync_alt',
          tag: 'Product'
        },
        {
          label: 'Time Difference',
          path: '/time/difference',
          desc: 'Compare the local time offset between two cities and time zones.',
          icon: 'compare_arrows'
        },
        {
          label: 'Duration Calculator',
          path: '/time/duration',
          desc: 'Measure the exact elapsed time between two instants.',
          icon: 'timelapse'
        },
        {
          label: 'Date Difference',
          path: '/time/date-difference',
          desc: 'Calculate calendar days, weeks and business-day differences.',
          icon: 'date_range'
        },
        {
          label: 'Add / Subtract Time',
          path: '/time/add-subtract',
          desc: 'Move an exact date and time forward or backward by any interval.',
          icon: 'add_circle_outline'
        },
        {
          label: 'Countdown',
          path: '/time/countdown',
          desc: 'Create a live countdown or count-up for an event.',
          icon: 'hourglass_bottom'
        },
        {
          label: 'Unix Timestamp',
          path: '/time/unix-timestamp',
          desc: 'Convert Unix seconds and milliseconds to readable dates and back.',
          icon: 'terminal'
        }
      ]
    },
    {
      title: 'Celestial Horizons & Solar',
      icon: 'wb_sunny',
      items: [
        {
          label: 'Sky Window & 2Pi Dial',
          path: '/',
          view: 'sky',
          desc: 'Living horizon simulation, diurnal radian vector, and optical twilight gradient.',
          icon: 'radio_button_checked',
          tag: 'Real-Time'
        },
        {
          label: 'Tonight · Night Sky',
          path: '/tonight',
          desc: 'A focused view of sunset, darkness, Moon conditions, twilight and visible bright planets.',
          icon: 'dark_mode',
          tag: 'Night'
        },
        {
          label: 'Solar & Daylight Calculator',
          path: '/astronomy',
          desc: 'Solar altitude/azimuth, golden hour, twilight boundaries, and solar noon.',
          icon: 'wb_twilight',
          tag: 'Tool'
        },
        {
          label: 'Lunar Phase & "When Is?"',
          path: '/astronomy',
          desc: 'Geometric Moon phase terminator, next lunar milestones, and astronomical events.',
          icon: 'nightlight_round'
        }
      ]
    },
    {
      title: 'Earth & Global Experience',
      icon: 'public',
      items: [
        {
          label: 'World Radio (Listen to Earth)',
          path: '/radio',
          desc: 'Live global terrestrial broadcasts synchronized with local solar & diurnal cycles.',
          icon: 'radio',
          tag: 'Radio'
        },
        {
          label: 'World Clocks Grid',
          path: '/world-clocks',
          desc: 'Live clocks across major cities and time zones.',
          icon: 'schedule',
          tag: 'Multi-City'
        },
        {
          label: 'World Map (Terminator)',
          path: '/world',
          desc: 'Continuous analytical 2D terminator curve, subsolar zenith, and timezone grid.',
          icon: 'public'
        },
        {
          label: 'Meeting & Overlap Planner',
          path: '/planner',
          desc: 'Synchronized multi-location overlap calculator and optimum meeting planner.',
          icon: 'event_available'
        }
      ]
    },
    {
      title: 'Astronomy & Observation',
      icon: 'flare',
      items: [
        {
          label: 'Stargazing & Astrophotography',
          path: '/stargazing',
          desc: 'Bortle dark sky index, moon interference, and astronomical darkness window.',
          icon: 'nightlight',
          tag: 'New'
        },
        {
          label: 'Solar & Lunar Eclipses',
          path: '/eclipses',
          desc: 'Predict upcoming total solar eclipses, blood moons, and local visibility.',
          icon: 'wb_twilight',
          tag: 'Predictor'
        },
        {
          label: 'ISS & Satellite Tracker',
          path: '/satellites',
          desc: 'Track International Space Station (ISS) and visible satellite passes tonight.',
          icon: 'satellite_alt',
          tag: 'Live'
        },
        {
          label: 'Deep Space Orrery (3D)',
          path: '/space',
          view: 'space',
          desc: '3D Celestial Sphere, Right Ascension / Declination, and Keplerian orbital paths.',
          icon: 'view_in_ar',
          tag: '3D'
        },
        {
          label: 'Astronomical Ephemeris',
          path: '/ephemeris',
          desc: 'High-precision solar, lunar, and planetary coordinates with equation of time.',
          icon: 'dataset'
        }
      ]
    },
    {
      title: 'Multi-City & Developer Tools',
      icon: 'grid_view',
      items: [
        {
          label: 'Multi-City Horizon Dashboard',
          path: '/dashboard',
          desc: 'Side-by-side synchronized 24-hour diurnal radian dials and weather for pinned cities.',
          icon: 'dashboard',
          tag: 'Grid'
        },
        {
          label: 'Embeddable Clock Widget',
          path: '/widget',
          desc: 'Customize and embed a living 2pi celestial clock on external websites and blogs.',
          icon: 'code',
          tag: 'Widget'
        }
      ]
    },
    {
      title: 'Atmosphere & Weather',
      icon: 'air',
      items: [
        {
          label: 'Weather',
          path: '/weather',
          desc: 'Current conditions, hourly outlook and local weather context.',
          icon: 'cloud',
          tag: 'Live'
        },
        {
          label: 'Sleep Calculator',
          path: '/sleep-calculator',
          desc: 'Plan bedtime and wake time with sleep-cycle math, local night context, and private on-device history.',
          icon: 'bedtime',
          tag: 'Sleep'
        },
        {
          label: 'Real-Time Severe & Astronomical Alerts',
          path: '/alerts',
          desc: 'Live severe weather warnings, geomagnetic storms, eclipses, and visibility alerts.',
          icon: 'warning',
          tag: 'Live'
        },
        {
          label: 'Atmosphere & Storm Severity',
          path: '/atmosphere',
          desc: 'Weather severity, visibility, pressure and atmospheric conditions.',
          icon: 'thunderstorm'
        },
        {
          label: 'Astronomical Events',
          path: '/events',
          desc: 'A location-aware calendar of celestial and world-time events.',
          icon: 'event'
        },
      ]
    }
  ];

  readonly filteredLocations = computed(() => this.searchQuery().trim() ? this.remoteLocations() : this.randomLocations());

  toggleLocationDropdown(): void {
    this.showLocationDropdown.update(v => !v);
    if (this.showLocationDropdown() && this.locationService.locations().length === 0) {
      void this.locationService.loadLocations().then(() => {
        if (this.locationService.randomLocations().length === 0) this.locationService.refreshRandomLocations();
      });
    }
    if (this.showLocationDropdown()) {
      this.showNavMenu.set(false);
    }
  }

  toggleNavMenu(): void {
    this.showNavMenu.update(v => !v);
    if (this.showNavMenu()) {
      this.showLocationDropdown.set(false);
    }
  }

  closeMenus(): void {
    if (this.remoteSearchTimer) clearTimeout(this.remoteSearchTimer);
    this.showLocationDropdown.set(false);
    this.showNavMenu.set(false);
    this.isSearchFocused.set(false);
  }

  locationPath(section?: string): string[] {
    return this.locationService.getLocationPath(this.selectedLocation(), section);
  }

  navigateMenu(item: { path?: string; view?: ObservatoryView }): void {
    if (item.view) {
      this.observatoryViewService.setView(item.view);
    }
    if (item.path) {
      const locationAwareSections = new Set(['weather', 'tonight']);
      const section = item.path.replace(/^\//, '');
      if (locationAwareSections.has(section)) {
        this.router.navigate(this.locationService.getLocationPath(this.selectedLocation(), section));
      } else {
        this.router.navigate([item.path]);
      }
    }
    this.closeMenus();
  }

  onSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchQuery.set(val);
    this.searchRemoteLocations();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.remoteLocations.set([]);
    this.isRemoteSearching.set(false);
    if (this.remoteSearchTimer) clearTimeout(this.remoteSearchTimer);
  }

  searchRemoteLocations(): void {
    if (this.remoteSearchTimer) clearTimeout(this.remoteSearchTimer);
    const query = this.searchQuery().trim();
    if (query.length < 2) {
      this.remoteLocations.set([]);
      this.isRemoteSearching.set(false);
      return;
    }
    this.remoteSearchTimer = setTimeout(() => {
      this.remoteSearchSubscription?.unsubscribe();
      this.isRemoteSearching.set(true);
      this.remoteSearchSubscription = this.geocodingService.search(query, 50).subscribe({
        next: results => {
          this.remoteLocations.set(results);
          this.isRemoteSearching.set(false);
        },
        error: () => {
          this.remoteLocations.set([]);
          this.isRemoteSearching.set(false);
        }
      });
    }, 300);
  }

  selectLocation(loc: GeoLocation): void {
    this.locationService.selectLocation(loc);
    this.closeMenus();

    const path = this.router.url.split('?')[0].replace(/^\//, '');
    const parts = path.split('/').filter(Boolean);
    const focusedExperiences = new Set(['time', 'weather', 'sun', 'moon', 'tonight', 'astronomy']);
    let section: string | undefined;

    if (parts.length === 1 && focusedExperiences.has(parts[0])) {
      section = parts[0];
    } else if (parts.length >= 2 && focusedExperiences.has(parts[1])) {
      section = parts[1];
    }

    this.router.navigate(this.locationService.getLocationPath(loc, section));
  }

  async detectGPS(): Promise<void> {
    const loc = await this.locationService.detectUserLocation();
    this.closeMenus();
    if (loc) this.router.navigate(this.locationService.getLocationPath(loc));
  }
}
