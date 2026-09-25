import { Injectable, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type ObservatoryView = 'world' | 'sky' | 'space';

export interface ObservatoryViewOption {
  id: ObservatoryView;
  label: string;
  tagline: string;
  perspective: string;
  icon: string;
  description: string;
}

export const OBSERVATORY_VIEWS: ObservatoryViewOption[] = [
  {
    id: 'world',
    label: 'WORLD',
    tagline: 'Orbital Perspective',
    perspective: 'Looking down at Earth from above',
    icon: 'public',
    description: 'Global day/night terminator boundary, solar illumination, and planetary timezone relationships.'
  },
  {
    id: 'sky',
    label: 'SKY',
    tagline: 'Horizon Optics',
    perspective: 'Standing at selected location looking into the sky',
    icon: 'wb_sunny',
    description: 'Local atmospheric gradient, horizon crossing, twilight phases, clouds, and polar dial instrument.'
  },
  {
    id: 'space',
    label: 'SPACE',
    tagline: 'Celestial Observatory',
    perspective: 'Looking outward into the celestial sphere & planetary ephemeris',
    icon: 'flare',
    description: '3D Celestial Sphere (RA/Dec), local horizon mesh (Alt/Az), and Keplerian orbital ephemeris matrix.'
  }
];

@Injectable({
  providedIn: 'root'
})
export class ObservatoryViewService {
  private router = inject(Router, { optional: true });

  // Authoritative active view state
  readonly activeView = signal<ObservatoryView>('sky');

  readonly allViews = OBSERVATORY_VIEWS;

  readonly currentViewOption = computed(() => {
    const active = this.activeView();
    return this.allViews.find(v => v.id === active) || this.allViews[1];
  });

  constructor() {
    if (this.router) {
      // Listen to navigation events to assign default views to routes
      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe((event) => {
          this.applyRouteDefault(event.urlAfterRedirects || event.url);
        });
    }
  }

  /**
   * Set the active observatory view perspective
   */
  setView(view: ObservatoryView): void {
    if (this.activeView() !== view) {
      this.activeView.set(view);
    }
  }

  /**
   * Toggle to next view in cycle: world -> sky -> space -> world
   */
  cycleView(): void {
    const current = this.activeView();
    if (current === 'world') this.setView('sky');
    else if (current === 'sky') this.setView('space');
    else this.setView('world');
  }

  /**
   * Map route URLs to default observatory views without breaking deep routing
   */
  private applyRouteDefault(url: string): void {
    const cleanUrl = url.split('?')[0].split('#')[0];
    if (cleanUrl === '/world-clocks' || cleanUrl === '/meeting-planner') {
      this.activeView.set('world');
    } else if (cleanUrl === '/ephemeris' || cleanUrl === '/moon' || cleanUrl === '/deep-space-observatory') {
      this.activeView.set('space');
    } else if (cleanUrl === '/atmosphere' || cleanUrl === '/weather' || cleanUrl === '/stargazing') {
      this.activeView.set('sky');
    }
    // On '/' root, preserve whatever view user selected (defaults to 'sky')
  }
}
