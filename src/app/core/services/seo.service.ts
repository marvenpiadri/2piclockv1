import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { LocationService } from './location.service';

interface SeoPage {
  title: string;
  description: string;
  type?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly locationService = inject(LocationService);
  private readonly document = inject(DOCUMENT);

  private readonly defaultTitle = '2piClock — Living Sky, World Clock & Astronomy';
  private readonly defaultDescription =
    '2piClock is a living sky, world clock and astronomy platform with precise solar and lunar calculations, weather-aware skies, time tools and global location pages.';
  private readonly origin = 'https://2piclock.com';

  init(): void {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.updateMeta());

    this.updateMeta();
  }

  private updateMeta(): void {
    const url = this.router.url.split('?')[0].replace(/\/+$/, '') || '/';
    const loc = this.locationService.selectedLocation();
    const page = this.describe(url, loc.name, loc.country);
    const canonical = this.canonicalUrl(url);

    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({
      name: 'robots',
      content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1'
    });

    this.meta.updateTag({ property: 'og:type', content: page.type ?? 'website' });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:site_name', content: '2piClock' });
    this.meta.updateTag({ property: 'og:locale', content: 'en_US' });
    this.meta.updateTag({ property: 'og:image', content: this.origin + '/icon.svg' });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });
    this.meta.updateTag({ name: 'twitter:image', content: this.origin + '/icon.svg' });
    this.meta.updateTag({ name: 'theme-color', content: '#11100d' });

    let link = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = canonical;

    this.setJsonLd(canonical, page, url, loc);
  }

  private canonicalUrl(path: string): string {
    return path === '/' ? this.origin + '/' : this.origin + path;
  }

  private describe(url: string, location: string, country: string): SeoPage {
    const timeTools: Record<string, SeoPage> = {
      '/time/converter': {
        title: 'Time Zone Converter | 2piClock',
        description: 'Convert a date and time between cities and IANA time zones with precise local results.'
      },
      '/time/difference': {
        title: 'Time Difference Calculator | 2piClock',
        description: 'Calculate the exact time difference between two cities and time zones.'
      },
      '/time/duration': {
        title: 'Time Duration Calculator | 2piClock',
        description: 'Calculate the exact duration between two dates and times in days, hours, minutes and seconds.'
      },
      '/time/date-difference': {
        title: 'Date Difference Calculator | 2piClock',
        description: 'Calculate the number of days and calendar difference between two dates.'
      },
      '/time/add-subtract': {
        title: 'Add or Subtract Time | 2piClock',
        description: 'Add or subtract years, months, days, hours, minutes and seconds from a date and time.'
      },
      '/time/countdown': {
        title: 'Countdown & Count-Up Calculator | 2piClock',
        description: 'Create a live countdown to an event or measure elapsed time from a starting instant.'
      },
      '/time/unix-timestamp': {
        title: 'Unix Timestamp Converter | 2piClock',
        description: 'Convert Unix timestamps between seconds, milliseconds, ISO and local date-time formats.'
      },
      '/time/world-matrix': {
        title: 'World Time Matrix | 2piClock',
        description: 'Compare local times, UTC offsets and day status across cities around the world.'
      }
    };

    if (timeTools[url]) return timeTools[url];
    if (url === '/api') {
      return {
        title: '2piClock API — Astronomical Data for Developers',
        description: 'Public 2piClock API documentation for solar position, lunar position, celestial state, solar events and global locations.',
        type: 'website'
      };
    }
    if (url === '/astronomy' || url.endsWith('/astronomy')) {
      return {
        title: `Astronomy & Ephemeris for ${location} | 2piClock`,
        description: `Explore Solar System positions, Sun and Moon geometry, coordinates, constellations, deep-sky objects and observing data for ${location}, ${country}.`
      };
    }
    if (url === '/tonight' || url.endsWith('/tonight')) {
      return {
        title: `Tonight Sky in ${location} | Planets, Moon & Stargazing | 2piClock`,
        description: `See tonight's Moon, visible planets, constellations, darkness window and observing conditions for ${location}, ${country}.`
      };
    }
    if (url === '/weather' || url === '/atmosphere' || url.endsWith('/weather')) {
      return {
        title: `Weather & Living Sky in ${location} | 2piClock`,
        description: `See local weather alongside solar position, twilight, Moon conditions and an atmospheric living sky for ${location}, ${country}.`
      };
    }
    if (url === '/stargazing' || url.endsWith('/stargazing')) {
      return {
        title: `Stargazing in ${location} | Darkness, Moon & Sky Conditions | 2piClock`,
        description: `Plan stargazing in ${location} with astronomical darkness, Moon interference, visible sky conditions and celestial guidance.`
      };
    }
    if (url === '/eclipses' || url.endsWith('/eclipses')) {
      return {
        title: `Solar & Lunar Eclipses for ${location} | 2piClock`,
        description: `Explore solar and lunar eclipse timing and local sky geometry for ${location}, ${country}.`
      };
    }
    if (url === '/satellites' || url.endsWith('/satellites')) {
      return {
        title: `Satellite & ISS Sky for ${location} | 2piClock`,
        description: `Explore satellite visibility and astronomical sky information for ${location}, ${country}.`
      };
    }
    if (url === '/events' || url.endsWith('/events')) {
      return {
        title: `Celestial Events for ${location} | 2piClock`,
        description: `Explore upcoming celestial events and sky timing for ${location}, ${country}.`
      };
    }
    if (url === '/world-clocks') {
      return {
        title: 'World Clock — Current Time Around the World | 2piClock',
        description: 'Compare current local time across cities and time zones with an astronomical world clock.'
      };
    }
    if (url === '/world') {
      return {
        title: 'World Map — Day, Night, Weather & Global Time | 2piClock',
        description: 'Explore day and night, twilight, world weather and global time across Earth.'
      };
    }
    if (url === '/radio' || url.startsWith('/radio/')) {
      return {
        title: 'World Radio — Listen Around Earth | 2piClock',
        description: 'Explore live radio stations around the world while following the changing clock and sky.'
      };
    }
    if (url === '/widget' || url.startsWith('/widget/')) {
      return {
        title: '2piClock Widget — Embeddable Astronomical Clock',
        description: 'Create and embed a compact 2piClock time and sky widget on your website.'
      };
    }
    if (url === '/dashboard') {
      return {
        title: '2piClock Dashboard — Multiple Cities, Time & Sky',
        description: 'Monitor multiple cities with local time, day status and astronomical context in one workspace.'
      };
    }
    if (url === '/space') {
      return {
        title: 'Space View — Solar System & Celestial Context | 2piClock',
        description: 'Explore space-oriented views and astronomical context powered by the 2piClock calculation engine.'
      };
    }
    if (url === '/ephemeris') {
      return {
        title: 'Celestial Ephemeris — Planet Positions | 2piClock',
        description: 'Explore calculated celestial positions, coordinates and rise and set information.'
      };
    }
    if (url === '/planner') {
      return {
        title: 'Meeting Planner Across Time Zones | 2piClock',
        description: 'Find practical meeting times across cities and time zones while keeping local day and night context visible.'
      };
    }
    if (url === '/alerts') {
      return {
        title: 'Sky & Weather Alerts | 2piClock',
        description: 'Review relevant sky and weather alerts for your selected location.'
      };
    }

    return {
      title: location ? `${location} Sky, Time & Astronomy | 2piClock` : this.defaultTitle,
      description: location
        ? `Live sky, exact local time, weather, Sun and Moon information for ${location}, ${country}. Explore tonight's sky and local astronomy.`
        : this.defaultDescription
    };
  }

  private setJsonLd(
    canonical: string,
    page: SeoPage,
    url: string,
    loc: { name: string; country: string; id: string; latitude?: number; longitude?: number; timezone?: string }
  ): void {
    const existing = this.document.getElementById('2piclock-seo-jsonld');
    if (existing) existing.remove();

    const script = this.document.createElement('script');
    script.id = '2piclock-seo-jsonld';
    script.type = 'application/ld+json';

    const breadcrumbs = this.breadcrumbs(url);
    const graph: Record<string, unknown>[] = [
      {
        '@type': 'WebSite',
        '@id': this.origin + '/#website',
        name: '2piClock',
        url: this.origin + '/',
        description: this.defaultDescription
      },
      {
        '@type': 'WebApplication',
        '@id': canonical + '#app',
        name: '2piClock',
        url: canonical,
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Web',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
      },
      {
        '@type': 'WebPage',
        '@id': canonical + '#webpage',
        name: page.title,
        url: canonical,
        description: page.description,
        isPartOf: { '@id': this.origin + '/#website' }
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbs.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: this.origin + item.path
        }))
      }
    ];

    if (this.isLocationPage(url, loc.id) && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
      graph.push({
        '@type': 'Place',
        '@id': canonical + '#place',
        name: loc.name,
        address: { '@type': 'PostalAddress', addressCountry: loc.country },
        geo: { '@type': 'GeoCoordinates', latitude: loc.latitude, longitude: loc.longitude },
        additionalProperty: loc.timezone
          ? [{ '@type': 'PropertyValue', name: 'IANA time zone', value: loc.timezone }]
          : undefined
      });
    }

    if (url === '/api') {
      graph.push({
        '@type': 'TechArticle',
        '@id': canonical + '#article',
        headline: page.title,
        description: page.description,
        url: canonical
      });
    }

    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    this.document.head.appendChild(script);
  }

  private isLocationPage(url: string, locationId: string): boolean {
    if (!locationId) return false;
    const parts = url.split('/').filter(Boolean);
    if (parts.length < 2) return false;
    const location = this.locationService.selectedLocation();
    const slug = this.locationService.getLocationSlug(location).split('/');
    return parts[0] === slug[0] && parts[1] === slug[1];
  }

  private breadcrumbs(url: string): { name: string; path: string }[] {
    const parts = url.split('/').filter(Boolean);
    const labels: Record<string, string> = {
      api: 'API',
      astronomy: 'Astronomy',
      tonight: 'Tonight',
      weather: 'Weather',
      time: 'Time Tools',
      world: 'World Map',
      'world-clocks': 'World Clock',
      radio: 'Radio',
      stargazing: 'Stargazing',
      eclipses: 'Eclipses',
      satellites: 'Satellites',
      events: 'Celestial Events',
      widget: 'Widget',
      dashboard: 'Dashboard',
      space: 'Space',
      atmosphere: 'Atmosphere',
      ephemeris: 'Ephemeris',
      planner: 'Planner',
      alerts: 'Alerts',
      maps: 'Maps'
    };

    return [
      { name: '2piClock', path: '/' },
      ...parts.map((part, index) => ({
        name: labels[part] ?? part.replace(/-/g, ' '),
        path: '/' + parts.slice(0, index + 1).join('/')
      }))
    ];
  }
}
