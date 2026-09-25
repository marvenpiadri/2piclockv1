import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Map, Marker, GeoJSONSource } from 'maplibre-gl';
import { CelestialService } from '../../../core/services/celestial.service';
import { LocationService } from '../../../core/services/location.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { calculateSubsolarPoint } from '../../../core/astronomy/astronomy-engine';
import { GeoLocation } from '../../../core/models/location.model';

@Component({
  selector: 'app-orbital-world-backdrop',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orbital-world-backdrop.html',
  styleUrl: './orbital-world-backdrop.css'
})
export class OrbitalWorldBackdropComponent implements OnInit, OnDestroy {
  @ViewChild('globeContainer', { static: false }) globeContainerRef?: ElementRef<HTMLDivElement>;

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private celestialService = inject(CelestialService);
  private locationService = inject(LocationService);
  private timeControlService = inject(TimeControlService);

  readonly celestial = this.celestialService.celestialState;
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly activeDate = this.timeControlService.currentActiveDate;
  readonly localTime = this.celestialService.formattedLocalTime;

  readonly subsolarPoint = computed(() => {
    return calculateSubsolarPoint(this.activeDate());
  });

  private map: Map | null = null;
  private observerMarker: Marker | null = null;
  private subsolarMarker: Marker | null = null;
  private isMapLoaded = false;
  private lastLocationId = '';

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        const date = this.activeDate();
        const loc = this.selectedLocation();
        this.celestial(); // track dependency

        if (this.map && this.isMapLoaded) {
          this.updateTerminatorLayer(date);
          this.updateSubsolarMarker();
          this.updateObserverMarker(loc);

          // If location preset changed, smoothly fly to new coordinates
          if (loc.id !== this.lastLocationId) {
            this.lastLocationId = loc.id;
            this.map.flyTo({
              center: [loc.longitude, loc.latitude],
              zoom: 1.6,
              speed: 0.8,
              curve: 1.4,
              essential: true
            });
          }
        }
      });
    }
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      setTimeout(() => this.initMapLibreGlobe(), 40);
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      if (this.observerMarker) {
        this.observerMarker.remove();
        this.observerMarker = null;
      }
      if (this.subsolarMarker) {
        this.subsolarMarker.remove();
        this.subsolarMarker = null;
      }
      this.map.remove();
      this.map = null;
    }
  }

  private initMapLibreGlobe(): void {
    if (!this.globeContainerRef?.nativeElement) return;

    const loc = this.selectedLocation();
    this.lastLocationId = loc.id;

    const map = new Map({
      container: this.globeContainerRef.nativeElement,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [loc.longitude, loc.latitude],
      zoom: 1.6,
      minZoom: 1,
      maxZoom: 6,
      attributionControl: false,
      interactive: true
    });

    this.map = map;
    map.setProjection({ type: 'globe' });

    map.on('load', () => {
      if (!this.map) return;
      this.isMapLoaded = true;

      // Add day/night terminator layers
      this.initTerminatorSource();

      // Add subsolar point marker
      this.initSubsolarMarker();

      // Add observer location beacon marker
      this.initObserverMarker();

      // Initial update
      this.updateTerminatorLayer(this.activeDate());
    });
  }

  private initTerminatorSource(): void {
    if (!this.map) return;

    const data = this.buildTerminatorGeoJson(this.activeDate());

    this.map.addSource('terminator-source', {
      type: 'geojson',
      data
    });

    // Night shadow
    this.map.addLayer({
      id: 'terminator-night-fill',
      type: 'fill',
      source: 'terminator-source',
      filter: ['==', '$type', 'Polygon'],
      paint: {
        'fill-color': '#01030a',
        'fill-opacity': 0.65
      }
    });

    // Twilight boundary line
    this.map.addLayer({
      id: 'terminator-boundary-line',
      type: 'line',
      source: 'terminator-source',
      filter: ['==', '$type', 'LineString'],
      paint: {
        'line-color': '#f59e0b',
        'line-width': 2.0,
        'line-opacity': 0.8,
        'line-blur': 1.5
      }
    });
  }

  private updateTerminatorLayer(date: Date): void {
    if (!this.map || !this.map.getSource('terminator-source')) return;

    const source = this.map.getSource('terminator-source') as GeoJSONSource;
    if (source) {
      const data = this.buildTerminatorGeoJson(date);
      source.setData(data as any);
    }
  }

  private buildTerminatorGeoJson(date: Date): any {
    const subsolar = calculateSubsolarPoint(date);
    const decRad = (subsolar.latitude * Math.PI) / 180;
    const lng0 = subsolar.longitude;

    const points: [number, number][] = [];
    const step = 3;

    for (let lng = -180; lng <= 180; lng += step) {
      const dLngRad = ((lng - lng0) * Math.PI) / 180;
      let lat = 0;
      if (Math.abs(subsolar.latitude) < 0.08) {
        lat = 0;
      } else {
        const tanLat = -Math.cos(dLngRad) / Math.tan(decRad);
        lat = (Math.atan(tanLat) * 180) / Math.PI;
      }
      lat = Math.max(-89.9, Math.min(89.9, lat));
      points.push([lng, lat]);
    }

    const polygonCoords: [number, number][] = [...points];

    if (subsolar.latitude >= 0) {
      polygonCoords.push([180, -90]);
      polygonCoords.push([-180, -90]);
      polygonCoords.push(points[0]);
    } else {
      polygonCoords.push([180, 90]);
      polygonCoords.push([-180, 90]);
      polygonCoords.push(points[0]);
    }

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Night Hemisphere Shadow' },
          geometry: {
            type: 'Polygon',
            coordinates: [polygonCoords]
          }
        },
        {
          type: 'Feature',
          properties: { name: 'Solar Terminator Horizon' },
          geometry: {
            type: 'LineString',
            coordinates: points
          }
        }
      ]
    };
  }

  private initSubsolarMarker(): void {
    if (!this.map) return;

    const el = document.createElement('div');
    el.className = 'subsolar-globe-marker';
    el.innerHTML = `
      <div class="subsolar-orb">
        <span>☉</span>
      </div>
      <div class="subsolar-tag">SOLAR ZENITH</div>
    `;

    const sub = this.subsolarPoint();
    this.subsolarMarker = new Marker({ element: el })
      .setLngLat([sub.longitude, sub.latitude])
      .addTo(this.map);
  }

  private updateSubsolarMarker(): void {
    if (!this.subsolarMarker) return;
    const sub = this.subsolarPoint();
    this.subsolarMarker.setLngLat([sub.longitude, sub.latitude]);
  }

  private initObserverMarker(): void {
    if (!this.map) return;

    const loc = this.selectedLocation();
    const el = document.createElement('div');
    el.className = 'observer-globe-beacon';
    el.innerHTML = `
      <div class="beacon-card">
        <span class="beacon-flag">${loc.flag}</span>
        <span class="beacon-city">${loc.name}</span>
        <div class="beacon-telemetry">
          <span>${this.localTime()}</span>
          <span>Alt ${this.celestial().sun.altitudeDeg >= 0 ? '+' : ''}${this.celestial().sun.altitudeDeg.toFixed(1)}°</span>
        </div>
      </div>
      <div class="beacon-dot"></div>
    `;

    this.observerMarker = new Marker({ element: el, anchor: 'bottom' })
      .setLngLat([loc.longitude, loc.latitude])
      .addTo(this.map);
  }

  private updateObserverMarker(loc: GeoLocation): void {
    if (!this.observerMarker) return;
    this.observerMarker.setLngLat([loc.longitude, loc.latitude]);

    const card = this.observerMarker.getElement().querySelector('.beacon-card');
    if (card) {
      const cityEl = card.querySelector('.beacon-city');
      const flagEl = card.querySelector('.beacon-flag');
      const timeEl = card.querySelector('.beacon-telemetry span:first-child');
      const altEl = card.querySelector('.beacon-telemetry span:last-child');

      if (cityEl) cityEl.textContent = loc.name;
      if (flagEl) flagEl.textContent = loc.flag;
      if (timeEl) timeEl.textContent = this.localTime();
      if (altEl) {
        altEl.textContent = `Alt ${this.celestial().sun.altitudeDeg >= 0 ? '+' : ''}${this.celestial().sun.altitudeDeg.toFixed(1)}°`;
      }
    }
  }
}
