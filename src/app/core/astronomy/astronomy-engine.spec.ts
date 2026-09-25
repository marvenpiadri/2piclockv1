import { describe, it, expect } from 'vitest';
import {
  calculateSolarPosition,
  calculateSolarEvents,
  calculateLunarPosition,
  calculateSubsolarPoint,
  calculateRadianTimeOverlap,
  getJulianDate,
  getJulianCenturies,
  getCelestialState
} from './astronomy-engine';

describe('Astronomy Engine Mathematics Foundation', () => {
  const equinoxDate = new Date('2026-03-20T12:00:00Z');
  const summerSolsticeDate = new Date('2026-06-21T12:00:00Z');
  const winterSolsticeDate = new Date('2026-12-21T12:00:00Z');

  describe('Julian Date & Centuries', () => {
    it('should compute correct Julian Day for J2000.0 epoch', () => {
      const j2000 = new Date('2000-01-01T12:00:00Z');
      const jd = getJulianDate(j2000);
      expect(jd).toBeCloseTo(2451545.0, 2);
      expect(getJulianCenturies(jd)).toBeCloseTo(0.0, 4);
    });
  });

  describe('Solar Coordinates & Seasons', () => {
    it('should calculate solar declination near 0° at Vernal Equinox', () => {
      const sun = calculateSolarPosition(equinoxDate, 0, 0);
      expect(Math.abs(sun.declinationDeg)).toBeLessThan(1.5);
    });

    it('should calculate solar declination near +23.44° at Summer Solstice', () => {
      const sun = calculateSolarPosition(summerSolsticeDate, 0, 0);
      expect(sun.declinationDeg).toBeGreaterThan(23.0);
      expect(sun.declinationDeg).toBeLessThan(23.6);
    });

    it('should calculate solar declination near -23.44° at Winter Solstice', () => {
      const sun = calculateSolarPosition(winterSolsticeDate, 0, 0);
      expect(sun.declinationDeg).toBeLessThan(-23.0);
      expect(sun.declinationDeg).toBeGreaterThan(-23.6);
    });

    it('should calculate solar noon elevation near zenith (90°) at equator on equinox', () => {
      const sun = calculateSolarPosition(equinoxDate, 0, 0);
      expect(sun.altitudeDeg).toBeGreaterThan(87);
      expect(sun.isAboveHorizon).toBe(true);
    });

    it('should calculate solar elevation below horizon at midnight', () => {
      const midnightUtc = new Date('2026-03-20T00:00:00Z');
      const sun = calculateSolarPosition(midnightUtc, 51.5, 0); // London
      expect(sun.altitudeDeg).toBeLessThan(0);
      expect(sun.isAboveHorizon).toBe(false);
    });
  });

  describe('Solar Events & Milestones', () => {
    it('should compute valid chronological solar sequence for London on equinox', () => {
      const events = calculateSolarEvents(equinoxDate, 51.5074, -0.1278);
      expect(events.sunrise).not.toBeNull();
      expect(events.solarNoon).not.toBeNull();
      expect(events.sunset).not.toBeNull();

      if (events.sunrise && events.solarNoon && events.sunset) {
        expect(events.sunrise.getTime()).toBeLessThan(events.solarNoon.getTime());
        expect(events.solarNoon.getTime()).toBeLessThan(events.sunset.getTime());
      }
      expect(events.dayLengthMinutes).toBeGreaterThan(700);
      expect(events.dayLengthMinutes).toBeLessThan(750);
    });

    it('should resolve solar events against the selected location civil date', () => {
      // Tokyo is UTC+9, so the local civil day is not the same as the UTC day
      // around midnight. The returned sunrise must still belong to March 20 locally.
      const events = calculateSolarEvents(
        new Date('2026-03-20T00:30:00Z'),
        35.6762,
        139.6503,
        'Asia/Tokyo'
      );
      expect(events.sunrise).not.toBeNull();
      if (events.sunrise) {
        const localDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tokyo'
        }).format(events.sunrise);
        expect(localDate).toBe('2026-03-20');
      }
    });

    it('should detect polar day or night correctly at high latitudes', () => {
      // 85° North on Summer Solstice (Midnight Sun / Polar Day)
      const arcticSummer = calculateSolarEvents(summerSolsticeDate, 85.0, 0);
      expect(arcticSummer.isPolarDay).toBe(true);
      expect(arcticSummer.isPolarNight).toBe(false);

      // 85° North on Winter Solstice (Polar Night)
      const arcticWinter = calculateSolarEvents(winterSolsticeDate, 85.0, 0);
      expect(arcticWinter.isPolarNight).toBe(true);
      expect(arcticWinter.isPolarDay).toBe(false);
    });
  });

  describe('Lunar Calculations', () => {
    it('should compute valid lunar distance and illumination bounds', () => {
      const moon = calculateLunarPosition(equinoxDate, 40.7128, -74.006);
      expect(moon.illuminationFraction).toBeGreaterThanOrEqual(0);
      expect(moon.illuminationFraction).toBeLessThanOrEqual(1);
      // Realistic Earth-Moon perigee to apogee distance: 356,000 to 407,000 km
      expect(moon.distanceKm).toBeGreaterThan(350000);
      expect(moon.distanceKm).toBeLessThan(410000);
      expect(moon.ageDays).toBeGreaterThanOrEqual(0);
      expect(moon.ageDays).toBeLessThanOrEqual(30);
    });
  });

  describe('Terminator & Subsolar Geometry', () => {
    it('should compute subsolar coordinates within valid geographic bounds', () => {
      const subsolar = calculateSubsolarPoint(equinoxDate);
      expect(subsolar.latitude).toBeGreaterThanOrEqual(-24);
      expect(subsolar.latitude).toBeLessThanOrEqual(24);
      expect(subsolar.longitude).toBeGreaterThanOrEqual(-180);
      expect(subsolar.longitude).toBeLessThanOrEqual(180);
    });
  });

  describe('2π Radian Overlap Matrix', () => {
    it('should calculate multi-city working hour overlap slots and find sweet spot window', () => {
      const testCities = [
        { id: 'london', name: 'London', flag: '🇬🇧', timezone: 'Europe/London' },
        { id: 'paris', name: 'Paris', flag: '🇫🇷', timezone: 'Europe/Paris' },
        { id: 'berlin', name: 'Berlin', flag: '🇩🇪', timezone: 'Europe/Berlin' }
      ];

      const overlap = calculateRadianTimeOverlap(testCities, equinoxDate);
      expect(overlap.slots24h.length).toBe(96); // 24 * 4 quarters
      expect(overlap.bestWindow).not.toBeNull();
      if (overlap.bestWindow) {
        expect(overlap.bestWindow.durationHours).toBeGreaterThan(0);
      }
    });
  });

  describe('Celestial State Synthesis', () => {
    it('should correctly assemble complete state for Tokyo', () => {
      const state = getCelestialState(equinoxDate, 35.6762, 139.6503, 'Asia/Tokyo');
      expect(state.season).toBe('spring');
      expect(state.localTimeString).toBeDefined();
      expect(state.twilightState).toBeDefined();
      expect(state.starVisibilityFraction).toBeGreaterThanOrEqual(0);
      expect(state.starVisibilityFraction).toBeLessThanOrEqual(1);
    });
  });
});
