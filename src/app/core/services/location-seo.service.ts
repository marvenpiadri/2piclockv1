import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { GeoLocation } from '../models/location.model';

export type LocationExperience = 'time' | 'weather' | 'astronomy' | 'tonight';

export interface LocationSeoPreset {
  pageName: string;
  title: string;
  description: string;
  h1: string;
  answer: string;
  intentPhrases: string[];
  related: { label: string; path: string }[];
}

@Injectable({ providedIn: 'root' })
export class LocationSeoService {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  getPreset(location: GeoLocation, experience: LocationExperience): LocationSeoPreset {
    const city = location.name;
    const country = location.country;

    const base = {
      time: {
        pageName: `Time in ${city}`,
        title: `Time in ${city}, ${country} | Local Time Now | 2piClock`,
        description: `What time is it in ${city}, ${country}? See the current local time, date, timezone, sunrise, sunset and live sky conditions.`,
        h1: `Time in ${city}`,
        answer: `This page answers local-time questions for ${city}, ${country}, including the current time, date, timezone and solar day.`,
        intentPhrases: [`time in ${city}`, `what time is it in ${city}`, `${city} local time`, `${city} timezone`]
      },
      weather: {
        pageName: `Weather in ${city}`,
        title: `Weather in ${city}, ${country} | Current Conditions & Forecast | 2piClock`,
        description: `What is the weather in ${city}, ${country}? See current conditions, temperature, hourly weather, precipitation, wind and the 7-day forecast.`,
        h1: `Weather in ${city}`,
        answer: `This page answers weather questions for ${city}, ${country}, with current conditions, temperature, precipitation, wind, hourly weather and a 7-day forecast.`,
        intentPhrases: [`weather in ${city}`, `what is the weather in ${city}`, `${city} weather today`, `${city} forecast`, `${city} temperature`]
      },
      astronomy: {
        pageName: `Astronomy in ${city}`,
        title: `Astronomy in ${city}, ${country} | Sun, Moon & Sky | 2piClock`,
        description: `Explore the Sun, Moon, twilight, daylight, lunar phase and astronomical conditions for ${city}, ${country}.`,
        h1: `Astronomy in ${city}`,
        answer: `This page answers astronomy questions for ${city}, ${country}, including the Sun and Moon positions, twilight, daylight and lunar phase.`,
        intentPhrases: [`astronomy in ${city}`, `sunrise in ${city}`, `sunset in ${city}`, `moon phase in ${city}`, `${city} daylight`]
      },
      tonight: {
        pageName: `Tonight in ${city}`,
        title: `Tonight in ${city}, ${country} | Moon, Twilight & Night Sky | 2piClock`,
        description: `What can you see tonight in ${city}, ${country}? Check moonlight, twilight, cloud conditions and the live night sky.`,
        h1: `Tonight in ${city}`,
        answer: `This page answers tonight-sky questions for ${city}, ${country}, combining local twilight, Moon conditions and weather-aware stargazing information.`,
        intentPhrases: [`tonight in ${city}`, `night sky in ${city}`, `moon tonight in ${city}`, `stargazing in ${city}`]
      }
    }[experience];

    return {
      ...base,
      related: [
        { label: `All ${city} time & sky`, path: `/${location.id}` },
        { label: `Weather in ${city}`, path: `/${location.id}/weather` },
        { label: `Astronomy in ${city}`, path: `/${location.id}/astronomy` },
        { label: `Tonight in ${city}`, path: `/${location.id}/tonight` }
      ]
    };
  }

  apply(location: GeoLocation, experience: LocationExperience): LocationSeoPreset {
    const preset = this.getPreset(location, experience);
    const url = `https://2piclock.com/${location.id}${experience === 'time' ? '' : `/${experience}`}`;

    this.title.setTitle(preset.title);
    this.meta.updateTag({ name: 'description', content: preset.description });
    this.meta.updateTag({ name: 'robots', content: 'index,follow,max-image-preview:large' });
    this.meta.updateTag({ property: 'og:title', content: preset.title });
    this.meta.updateTag({ property: 'og:description', content: preset.description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: preset.title });
    this.meta.updateTag({ name: 'twitter:description', content: preset.description });

    let script = this.document.getElementById('location-seo-jsonld') as HTMLScriptElement | null;
    if (!script) {
      script = this.document.createElement('script');
      script.id = 'location-seo-jsonld';
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }

    const graph = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebPage',
          '@id': `${url}#webpage`,
          url,
          name: preset.pageName,
          description: preset.description,
          inLanguage: 'en',
          about: { '@id': `${url}#place` },
          isPartOf: { '@type': 'WebSite', '@id': 'https://2piclock.com/#website', name: '2piClock', url: 'https://2piclock.com/' },
          breadcrumb: { '@id': `${url}#breadcrumb` }
        },
        {
          '@type': 'Place',
          '@id': `${url}#place`,
          name: `${cityLabel(location)}`,
          address: {
            '@type': 'PostalAddress',
            addressLocality: location.name,
            addressCountry: location.countryCode
          },
          geo: {
            '@type': 'GeoCoordinates',
            latitude: location.latitude,
            longitude: location.longitude
          }
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${url}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: '2piClock', item: 'https://2piclock.com/' },
            { '@type': 'ListItem', position: 2, name: location.name, item: `https://2piclock.com/${location.id}` },
            { '@type': 'ListItem', position: 3, name: preset.pageName, item: url }
          ]
        }
      ]
    };

    script.textContent = JSON.stringify(graph).replace(/</g, '\\u003c');
    return preset;
  }
}

function cityLabel(location: GeoLocation): string {
  return `${location.name}, ${location.country}`;
}
