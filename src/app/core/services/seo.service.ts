import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { LocationService } from './location.service';

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private title = inject(Title);
  private meta = inject(Meta);
  private router = inject(Router);
  private locationService = inject(LocationService);
  private document = inject(DOCUMENT);

  private readonly DEFAULT_TITLE = '2PiClock — Astronomical World Clock & Living Reactive Sky';
  private readonly DEFAULT_DESC = '2PiClock is a living celestial world clock and reactive sky engine, accurately rendering real-time solar altitude, lunar phases, twilight gradients, and atmospheric weather above any global coordinate.';

  init(): void {
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.updateMetaForCurrentRoute();
      });

    this.updateMetaForCurrentRoute();
  }

  private updateMetaForCurrentRoute(): void {
    const url = this.router.url.split('?')[0];
    const loc = this.locationService.selectedLocation();

    let pageTitle = this.DEFAULT_TITLE;
    let pageDesc = this.DEFAULT_DESC;

    if (url.includes('/time')) {
      pageTitle = `Time Suite & Global Zone Converter — 2PiClock`;
      pageDesc = `High-precision timezone conversion, calendar date differences, target countdowns, and Unix epoch calculator with DST awareness.`;
    } else if (url.includes('/stargazing')) {
      pageTitle = `Stargazing & Astrophotography Planner — ${loc.name} · 2PiClock`;
      pageDesc = `Calculate night sky darkness index, Bortle scale, moon interference, and astronomical twilight darkness window for ${loc.name}.`;
    } else if (url.includes('/eclipses')) {
      pageTitle = `Solar & Lunar Eclipse Predictor — 2PiClock`;
      pageDesc = `Predict upcoming total solar eclipses, annular eclipses, and blood moons with local visibility percent and sky trajectory.`;
    } else if (url.includes('/satellites')) {
      pageTitle = `ISS & Satellite Tracker — ${loc.name} · 2PiClock`;
      pageDesc = `Track International Space Station (ISS), Hubble, and Tiangong visible passes over ${loc.name} with elevation angles and brightness magnitude.`;
    } else if (url.includes('/dashboard')) {
      pageTitle = `Multi-City Horizon Dashboard — 2PiClock`;
      pageDesc = `Compare multiple global cities simultaneously with synchronized 24-hour diurnal radian dials and live weather telemetry.`;
    } else if (url.includes('/widget')) {
      pageTitle = `Embeddable Astronomical Clock Widget — 2PiClock`;
      pageDesc = `Customize and embed a living 2pi celestial clock widget on your website or dashboard.`;
    } else if (url.includes('/astronomy')) {
      pageTitle = `Solar Altitude & Lunar Ephemeris — ${loc.name} · 2PiClock`;
      pageDesc = `Analytical solar elevation, azimuth, golden hour, blue hour, and lunar phase geometry for ${loc.name}, ${loc.country}.`;
    } else if (url.includes('/radio')) {
      pageTitle = `World Radio (Listen to Earth) — 2PiClock`;
      pageDesc = `Live global terrestrial radio broadcasts synchronized with local solar & diurnal cycles across Earth.`;
    } else if (url.includes('/space')) {
      pageTitle = `3D Deep Space Orrery & Ephemeris — 2PiClock`;
      pageDesc = `3D Celestial Sphere with Right Ascension, Declination, and Keplerian orbital paths for solar system planets.`;
    } else if (url.includes('/atmosphere') || url.includes('/weather')) {
      pageTitle = `Atmosphere & Live Weather Telemetry — ${loc.name} · 2PiClock`;
      pageDesc = `Atmospheric storm severity, barometric pressure, wind vectors, and live meteorological simulation for ${loc.name}.`;
    } else if (loc && loc.name) {
      pageTitle = `${loc.name} Sky Window & 2Pi Diurnal Dial — 2PiClock`;
      pageDesc = `Live astronomical horizon simulation for ${loc.name}, ${loc.country} with exact solar altitude, twilight boundaries, and atmospheric sky.`;
    }

    this.title.setTitle(pageTitle);
    this.meta.updateTag({ name: 'description', content: pageDesc });
    this.meta.updateTag({ property: 'og:title', content: pageTitle });
    this.meta.updateTag({ property: 'og:description', content: pageDesc });
    this.meta.updateTag({ property: 'og:url', content: `https://2piclock.com${url}` });
    this.meta.updateTag({ name: 'twitter:title', content: pageTitle });
    this.meta.updateTag({ name: 'twitter:description', content: pageDesc });

    const link = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (link) {
      link.href = `https://2piclock.com${url === '/' ? '/' : url.replace(/\/$/, '')}`;
    }
  }
}

