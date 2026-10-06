import { Injectable } from '@angular/core';
import { Map as MapLibreMap, NavigationControl, StyleSpecification, setWorkerUrl } from 'maplibre-gl';

export type MapBackboneMode = 'world' | 'weather' | 'radio';

@Injectable({ providedIn: 'root' })
export class MapBackboneService {
  readonly style: StyleSpecification = {
    version: 8,
    name: '2PiClock World Map Backbone',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
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
        id: 'country_labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 1.5,
        filter: ['==', 'class', 'country'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 1.5, 9, 3.5, 12],
          'text-max-width': 7,
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#d7e0eb',
          'text-halo-color': '#0a1628',
          'text-halo-width': 1.5,
          'text-opacity': 0.9
        }
      },
      {
        id: 'city_labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 3.5,
        filter: ['in', 'class', 'city', 'town'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 3.5, 9, 7, 13, 10, 15],
          'text-offset': [0, 0.7],
          'text-anchor': 'top',
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#f5c451',
          'text-halo-color': '#0a1628',
          'text-halo-width': 1.2,
          'text-opacity': 0.95
        }
      },
      {
        id: 'village_labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'place',
        minzoom: 6,
        filter: ['in', 'class', 'village', 'suburb'],
        layout: {
          'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name:latin'], ['get', 'name']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10,
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#b9c7d8',
          'text-halo-color': '#0a1628',
          'text-halo-width': 1
        }
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
