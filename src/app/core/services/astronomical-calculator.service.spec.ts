import { describe, it, expect } from 'vitest';
import { AstronomicalCalculatorService } from './astronomical-calculator.service';
import { GeoLocation } from '../models/location.model';

const london = { id: 'london', name: 'London', country: 'United Kingdom', countryCode: 'GB', latitude: 51.5, longitude: -0.12, timezone: 'Europe/London' } as GeoLocation;

describe('AstronomicalCalculatorService yearly events', () => {
  const events = new AstronomicalCalculatorService().calculateYearlyEvents(2026, london);
  const find = (id: string) => events.find(e => e.id.startsWith(id));

  it('places the March 2026 equinox at 14:46 UTC', () => {
    const t = find('spring-equinox')!.date.getTime();
    expect(Math.abs(t - Date.UTC(2026, 2, 20, 14, 46))).toBeLessThan(5 * 60000);
  });

  it('lists the 2026 total lunar eclipse and total solar eclipse', () => {
    const lunar = events.find(e => e.title === 'Total Lunar Eclipse')!;
    expect(lunar.date.toISOString().slice(0, 10)).toBe('2026-03-03');
    const solar = events.find(e => e.title === 'Total Solar Eclipse')!;
    expect(solar.date.toISOString().slice(0, 10)).toBe('2026-08-12');
  });

  it('puts perihelion in early January', () => {
    expect(find('perihelion')!.date.toISOString().slice(0, 7)).toBe('2026-01');
  });

  it('is sorted and has full moons about 29.5 days apart', () => {
    const full = events.filter(e => e.title.includes('Full Moon')).map(e => e.date.getTime());
    for (let i = 1; i < full.length; i++) expect((full[i] - full[i - 1]) / 86400000).toBeGreaterThan(28.5);
    expect(full.length).toBeGreaterThanOrEqual(12);
  });
});
