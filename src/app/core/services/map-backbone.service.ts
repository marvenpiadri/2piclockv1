import { Injectable } from '@angular/core';
import { Map as MapLibreMap, NavigationControl, StyleSpecification, setWorkerUrl } from 'maplibre-gl';

export type MapBackboneMode = 'world' | 'weather' | 'radio';

@Injectable({ providedIn: 'root' })
export class MapBackboneService {
  readonly style: StyleSpecification = {
    version: 8,
    name: '2PiClock World Map Backbone',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet'
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0a1628' } },
      {
        id: 'water',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'water',
        paint: { 'fill-color': '#0d2242', 'fill-opacity': 0.98 }
      },
      {
        id: 'landcover',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landcover',
        paint: { 'fill-color': '#182638', 'fill-opacity': 0.95 }
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'landuse',
        paint: { 'fill-color': '#182638', 'fill-opacity': 0.95 }
      },
      {
        id: 'waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: { 'line-color': '#1a3a60', 'line-width': 0.8, 'line-opacity': 0.6 }
      },
      {
        id: 'boundary_country',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: { 'line-color': '#334863', 'line-width': 0.8, 'line-opacity': 0.55 }
      },
      {
        id: 'boundary_state',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'boundary',
        filter: ['>', 'admin_level', 2],
        minzoom: 4,
        paint: { 'line-color': '#24354a', 'line-width': 0.5, 'line-opacity': 0.3 }
      }
    ]
  };

  createMap(container: HTMLElement, center: [number, number], zoom: number, mode: MapBackboneMode): MapLibreMap {
    setWorkerUrl('/maplibre-gl-worker.mjs');
    const map = new MapLibreMap({
      container,
      style: this.style,
      center,
      zoom,
      minZoom: 1,
      maxZoom: 12,
      attributionControl: { compact: true }
    });

    map.addControl(new NavigationControl({ showCompass: true, visualizePitch: false }), 'top-right');
    map.getContainer().dataset['mapMode'] = mode;
    return map;
  }
}
