import { Injectable, inject } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { DOCUMENT } from '@angular/common';
import { LocationService } from './location.service';

interface SeoPage { title: string; description: string; type?: string; }

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly router = inject(Router);
  private readonly locationService = inject(LocationService);
  private readonly document = inject(DOCUMENT);

  private readonly defaultTitle = '2piClock — Living Sky, World Clock & Astronomy';
  private readonly defaultDescription = '2piClock is a living sky, world clock and astronomy platform with precise solar and lunar calculations, weather-aware skies, time tools and global location pages.';
  private readonly origin = 'https://2piclock.com';

  init(): void {
    this.router.events.pipe(filter(event => event instanceof NavigationEnd)).subscribe(() => this.updateMeta());
    this.updateMeta();
  }

  private updateMeta(): void {
    const url = this.router.url.split('?')[0].replace(/\/+$/, '') || '/';
    const loc = this.locationService.selectedLocation();
    const page = this.describe(url, loc.name, loc.country);
    const canonical = this.canonicalUrl(url);

    this.title.setTitle(page.title);
    this.meta.updateTag({ name: 'description', content: page.description });
    this.meta.updateTag({ name: 'robots', content: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1' });
    this.meta.updateTag({ property: 'og:type', content: page.type ?? 'website' });
    this.meta.updateTag({ property: 'og:title', content: page.title });
    this.meta.updateTag({ property: 'og:description', content: page.description });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:site_name', content: '2piClock' });
    this.meta.updateTag({ property: 'og:image', content: this.origin + '/icon.svg' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    this.meta.updateTag({ name: 'twitter:title', content: page.title });
    this.meta.updateTag({ name: 'twitter:description', content: page.description });
    this.meta.updateTag({ name: 'twitter:image', content: this.origin + '/icon.svg' });

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
    if (url === '/api') return { title: '2piClock API — Astronomical Data for Developers', description: 'Public 2piClock API documentation for solar position, lunar position, celestial state, solar events and global locations.', type: 'website' };
    if (url.includes('/time/')) return { title: 'Time Tools — Time Zone, Date Difference & Countdown | 2piClock', description: 'Practical time tools for time zones, date differences, durations, countdowns and Unix timestamps, built around precise timezone-aware calculations.' };
    if (url.includes('/astronomy') || url === '/astronomy') return { title: `Astronomy & Ephemeris for ${location} | 2piClock`, description: `Explore the Solar System, Moon and Sun geometry, coordinates, constellations, deep-sky objects and observing data for ${location}, ${country}.` };
    if (url.includes('/tonight')) return { title: `Tonight Sky in ${location} | Planets, Moon & Stargazing | 2piClock`, description: `See tonight's Moon, visible planets, constellations, darkness window and observing conditions for ${location}, ${country}.` };
    if (url.includes('/weather') || url.includes('/atmosphere')) return { title: `Weather & Living Sky in ${location} | 2piClock`, description: `See local weather alongside solar position, twilight, Moon conditions and an atmospheric living sky for ${location}, ${country}.` };
    if (url.includes('/stargazing')) return { title: `Stargazing in ${location} | Darkness, Moon & Sky Conditions | 2piClock`, description: `Plan stargazing in ${location} with astronomical darkness, Moon interference, visible sky conditions and celestial guidance.` };
    if (url.includes('/eclipses')) return { title: `Solar & Lunar Eclipses for ${location} | 2piClock`, description: `Explore eclipse timing and local sky geometry for ${location}, ${country}.` };
    if (url.includes('/satellites')) return { title: `Satellite & ISS Sky for ${location} | 2piClock`, description: `Explore satellite visibility and astronomical sky information for ${location}, ${country}.` };
    if (url.includes('/world-clocks')) return { title: 'World Clock — Current Time Around the World | 2piClock', description: 'Compare current local time across cities and time zones with an astronomical world clock.' };
    if (url.includes('/world')) return { title: 'World Map — Day, Night, Weather & Global Time | 2piClock', description: 'Explore day and night, twilight, world weather and global time across Earth.' };
    if (url.includes('/radio')) return { title: 'World Radio — Listen Around Earth | 2piClock', description: 'Explore live radio stations around the world while following the changing clock and sky.' };
    if (url.includes('/widget')) return { title: '2piClock Widget — Embeddable Astronomical Clock', description: 'Create and embed a compact 2piClock time and sky widget on your website.' };
    if (url.includes('/events')) return { title: `Celestial Events for ${location} | 2piClock`, description: `Explore upcoming celestial events and sky timing for ${location}, ${country}.` };
    return { title: location ? `${location} Sky, Time & Astronomy | 2piClock` : this.defaultTitle, description: location ? `Live sky, exact local time, weather, Sun and Moon information for ${location}, ${country}. Explore tonight's sky and local astronomy.` : this.defaultDescription };
  }

  private setJsonLd(canonical: string, page: SeoPage, url: string, loc: { name: string; country: string; id: string }): void {
    const existing = this.document.getElementById('2piclock-seo-jsonld');
    if (existing) existing.remove();
    const script = this.document.createElement('script');
    script.id = '2piclock-seo-jsonld';
    script.type = 'application/ld+json';

    const graph: Record<string, unknown>[] = [
      { '@type': 'WebSite', '@id': this.origin + '/#website', name: '2piClock', url: this.origin + '/', description: this.defaultDescription },
      { '@type': 'WebApplication', '@id': canonical + '#app', name: page.title.split(' | ')[0], url: canonical, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Web', isAccessibleForFree: true },
      { '@type': 'BreadcrumbList', itemListElement: this.breadcrumbs(url).map((item, index) => ({ '@type': 'ListItem', position: index + 1, name: item.name, item: this.origin + item.path })) }
    ];

    if (url === '/api') graph.push({ '@type': 'TechArticle', headline: page.title, description: page.description, url: canonical });
    script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
    this.document.head.appendChild(script);
    void loc;
  }

  private breadcrumbs(url: string): { name: string; path: string }[] {
    const parts = url.split('/').filter(Boolean);
    const labels: Record<string,string> = { api:'API', astronomy:'Astronomy', tonight:'Tonight', weather:'Weather', time:'Time Tools', world:'World Map', 'world-clocks':'World Clock', radio:'Radio', stargazing:'Stargazing', eclipses:'Eclipses', satellites:'Satellites', events:'Celestial Events', widget:'Widget' };
    return [{ name: '2piClock', path: '/' }, ...parts.map((part, index) => ({ name: labels[part] ?? part.replace(/-/g,' '), path: '/' + parts.slice(0,index+1).join('/') }))];
  }
}
