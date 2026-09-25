import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { RadioService } from '../../core/services/radio.service';
import { RadioStation } from '../../core/models/radio.model';
import { LocationService } from '../../core/services/location.service';
import { TimeControlService } from '../../core/services/time-control.service';
import { MapBackboneService } from '../../core/services/map-backbone.service';
import { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl';

export type RadioTab = 'explore' | 'map' | 'favorites' | 'recents';

@Component({
  selector: 'app-world-radio',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, MatIconModule],
  templateUrl: './world-radio.html',
  styleUrl: './world-radio.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WorldRadioComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly radioService = inject(RadioService);
  readonly locationService = inject(LocationService);
  readonly timeService = inject(TimeControlService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private title = inject(Title);
  private meta = inject(Meta);
  private readonly mapBackbone = inject(MapBackboneService);
  @ViewChild('radioMapContainer', { static: false }) radioMapContainer?: ElementRef<HTMLDivElement>;
  private radioMap?: MapLibreMap;
  private radioMapReady = false;

  readonly activeTab = signal<RadioTab>('explore');
  readonly searchQuery = signal<string>('');
  readonly selectedGenre = signal<string>('all');
  readonly selectedContinent = signal<string>('all');
  readonly hoveredStation = signal<RadioStation | null>(null);

  readonly genres = [
    { id: 'all', label: 'All Streams' },
    { id: 'ambient', label: 'Ambient & Drone' },
    { id: 'jazz', label: 'World Jazz' },
    { id: 'electronic', label: 'Electronic & Synth' },
    { id: 'lo-fi', label: 'Lo-Fi & Chill' },
    { id: 'city-pop', label: 'City Pop' },
    { id: 'classical', label: 'Classical & Piano' },
    { id: 'traditional', label: 'Traditional & Folk' },
    { id: 'space', label: 'Deep Space' }
  ];

  readonly continents = [
    { id: 'all', label: 'Worldwide' },
    { id: 'asia', label: 'Asia Pacific' },
    { id: 'europe', label: 'Europe' },
    { id: 'americas', label: 'Americas' },
    { id: 'africa', label: 'Africa & Middle East' }
  ];

  // Expose signals from radioService
  readonly currentStation = this.radioService.currentStation;
  readonly isPlaying = this.radioService.isPlaying;
  readonly isLoading = this.radioService.isLoading;
  readonly volume = this.radioService.volume;
  readonly isMuted = this.radioService.isMuted;
  readonly error = this.radioService.error;
  readonly playingContext = this.radioService.playingLocationContext;
  readonly favorites = this.radioService.favorites;
  readonly recents = this.radioService.recentStations;

  readonly allStations = this.radioService.searchResults;

  readonly filteredStations = computed<RadioStation[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const g = this.selectedGenre();
    const c = this.selectedContinent();
    const tab = this.activeTab();

    if (tab === 'favorites') {
      return this.favorites();
    }
    if (tab === 'recents') {
      return this.recents();
    }

    return this.radioService.searchResults().filter(s => {
      // Query filter
      const matchQ = !q || 
        s.name.toLowerCase().includes(q) || 
        s.city.toLowerCase().includes(q) || 
        s.country.toLowerCase().includes(q) || 
        s.tags.some(t => t.toLowerCase().includes(q));

      // Genre filter
      const matchG = g === 'all' || s.tags.some(t => t.toLowerCase().includes(g));

      // Continent filter
      let matchC = true;
      if (c === 'asia') {
        matchC = ['Japan', 'South Korea', 'China', 'Australia', 'India', 'Singapore', 'Thailand'].includes(s.country);
      } else if (c === 'europe') {
        matchC = ['United Kingdom', 'France', 'Germany', 'Iceland', 'Spain', 'Italy', 'Norway', 'Sweden'].includes(s.country);
      } else if (c === 'americas') {
        matchC = ['United States', 'Canada', 'Brazil', 'Argentina', 'Mexico', 'Chile', 'Colombia'].includes(s.country);
      } else if (c === 'africa') {
        matchC = ['Morocco', 'Egypt', 'South Africa', 'Kenya', 'Nigeria', 'United Arab Emirates', 'Saudi Arabia'].includes(s.country);
      }

      return matchQ && matchG && matchC;
    });
  });

  // Map representation coordinates
  readonly mapStations = computed(() => {
    return this.allStations().map(s => {
      // Equirectangular projection coordinates
      const xPercent = ((s.longitude + 180) / 360) * 100;
      const yPercent = ((90 - s.latitude) / 180) * 100;
      const isCurrent = this.currentStation()?.id === s.id;
      return {
        ...s,
        xPercent,
        yPercent,
        isCurrent
      };
    });
  });

  constructor() {
    effect(() => {
      const loc = this.locationService.selectedLocation();
      this.radioService.getStationsForLocation(loc.name, loc.country);
    });

    effect(() => {
      this.allStations();
      if (this.activeTab() === 'map') setTimeout(() => this.updateRadioMapSource(), 0);
    });
  }

  ngOnInit(): void {
    // Route segments are the canonical identities for radio products:
    // /radio/stations, /radio/map, /radio/favorites and /radio/recent.
    this.route.data.subscribe(data => {
      const tab = data['tab'] as RadioTab | undefined;
      if (tab && ['explore', 'map', 'favorites', 'recents'].includes(tab)) {
        this.activeTab.set(tab);
        this.updateSeo(tab);
      }
    });

    // Populate the initial directory from Radio Browser's non-broken stations.
    // The local list remains only as a fallback if the directory is unavailable.
    this.radioService.loadGlobalStations(100);

    this.route.queryParams.subscribe(params => {
      if (params['tab'] && ['explore', 'map', 'favorites', 'recents'].includes(params['tab'])) {
        const tab = params['tab'] as RadioTab;
        this.activeTab.set(tab);
        this.updateSeo(tab);
      }
      if (params['search']) {
        this.searchQuery.set(params['search']);
        this.onSearchChange();
      }
      if (params['play']) {
        const target = this.allStations().find(s => s.id === params['play'] || s.city.toLowerCase() === params['play'].toLowerCase());
        if (target) {
          this.radioService.playStation(target);
        }
      }
    });
  }

  setTab(tab: RadioTab): void {
    this.activeTab.set(tab);
    this.updateSeo(tab);
    const slug = this.radioTabSlug(tab);
    this.routerNavigate(slug);
    if (tab === 'map') setTimeout(() => this.initRadioMap(), 0);
  }

  private radioTabSlug(tab: RadioTab): string {
    return {
      explore: 'stations',
      map: 'map',
      favorites: 'favorites',
      recents: 'recent'
    }[tab];
  }

  private routerNavigate(slug: string): void {
    // Keep search/play state shareable while making the directory path canonical.
    const queryParams = { ...this.route.snapshot.queryParams };
    delete queryParams['tab'];
    this.router.navigate(['/radio', slug], {
      queryParams
    });
  }

  private updateSeo(tab: RadioTab): void {
    const seo: Record<RadioTab, { title: string; description: string }> = {
      explore: {
        title: 'World Radio Stations | Live Global Radio | 2piClock',
        description: 'Explore and listen to live radio stations by city, country, genre and broadcast location.'
      },
      map: {
        title: 'World Radio Map | Live Stations by Location | 2piClock',
        description: 'Explore live radio stations on an interactive world map and play broadcasts by location.'
      },
      favorites: {
        title: 'Favorite Radio Stations | 2piClock',
        description: 'Access your saved radio stations and continue listening to broadcasts you follow.'
      },
      recents: {
        title: 'Recently Played Radio Stations | 2piClock',
        description: 'Return to recently played live radio stations and broadcasts.'
      }
    };
    this.title.setTitle(seo[tab].title);
    this.meta.updateTag({ name: 'description', content: seo[tab].description });
    this.meta.updateTag({ property: 'og:title', content: seo[tab].title });
    this.meta.updateTag({ property: 'og:description', content: seo[tab].description });
  }

  ngAfterViewInit(): void {
    if (this.activeTab() === 'map') this.initRadioMap();
  }

  ngOnDestroy(): void {
    this.radioMap?.remove();
  }

  private initRadioMap(): void {
    if (this.radioMap || !this.radioMapContainer?.nativeElement) return;
    this.radioMap = this.mapBackbone.createMap(
      this.radioMapContainer.nativeElement,
      [0, 20],
      1.8,
      'radio'
    );
    this.radioMap.on('load', () => {
      this.radioMapReady = true;
      this.updateRadioMapSource();
      this.radioMap?.on('click', 'radio-stations', event => {
        const id = event.features?.[0]?.properties?.['id'];
        const station = this.allStations().find(s => s.id === id);
        if (station) this.playStation(station);
      });
      this.radioMap?.on('mouseenter', 'radio-stations', () => {
        if (this.radioMap) this.radioMap.getCanvas().style.cursor = 'pointer';
      });
      this.radioMap?.on('mouseleave', 'radio-stations', () => {
        if (this.radioMap) this.radioMap.getCanvas().style.cursor = '';
      });
    });
  }

  private updateRadioMapSource(): void {
    if (!this.radioMapReady || !this.radioMap) return;
    const stations = this.allStations().filter(s => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));
    const data = {
      type: 'FeatureCollection',
      features: stations.map(station => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [station.longitude, station.latitude] },
        properties: { id: station.id, name: station.name, city: station.city, country: station.country }
      }))
    };
    const source = this.radioMap.getSource('radio-stations') as GeoJSONSource | undefined;
    if (source) {
      source.setData(data as any);
      return;
    }
    this.radioMap.addSource('radio-stations', { type: 'geojson', data: data as any });
    this.radioMap.addLayer({
      id: 'radio-stations',
      type: 'circle',
      source: 'radio-stations',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3, 5, 6, 10, 8],
        'circle-color': '#fbbf24',
        'circle-opacity': 0.86,
        'circle-stroke-color': '#101820',
        'circle-stroke-width': 1.2
      }
    });
  }

  onSearchChange(): void {
    this.radioService.searchStations({
      query: this.searchQuery(),
      tag: this.selectedGenre() !== 'all' ? this.selectedGenre() : undefined
    });
    setTimeout(() => this.updateRadioMapSource(), 0);
  }

  setGenre(genreId: string): void {
    this.selectedGenre.set(genreId);
    this.onSearchChange();
  }

  setContinent(contId: string): void {
    this.selectedContinent.set(contId);
  }

  playStation(station: RadioStation): void {
    this.radioService.playStation(station);
  }

  togglePlay(): void {
    this.radioService.togglePlay();
  }

  toggleFavorite(station: RadioStation, event: Event): void {
    event.stopPropagation();
    this.radioService.toggleFavorite(station);
  }

  isFavorite(station: RadioStation): boolean {
    return this.radioService.isStationFavorite(station);
  }

  setVolume(event: Event): void {
    const val = parseFloat((event.target as HTMLInputElement).value);
    this.radioService.setVolume(val);
  }

  toggleMute(): void {
    this.radioService.toggleMute();
  }

  getSolarAltitudeDisplay(deg: number): string {
    return `${deg >= 0 ? '+' : ''}${deg.toFixed(1)}°`;
  }
}
