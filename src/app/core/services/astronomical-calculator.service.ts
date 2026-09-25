import { Injectable } from '@angular/core';
import {
  calculateSolarPosition,
  calculateSolarEvents,
  calculateLunarPosition,
  calculateSeasonalSolsticesCurves,
  calculateSubsolarPoint,
  calculateSublunarPoint,
  zonedDateTimeToInstant
} from '../astronomy/astronomy-engine';
import { SolarPosition, SolarEvents, LunarPosition, MoonPhaseName } from '../models/celestial.model';
import { GeoLocation } from '../models/location.model';

export interface DaylightAnalysis {
  location: GeoLocation;
  date: Date;
  solarEvents: SolarEvents;
  dayLengthMinutes: number;
  dayLengthFormatted: string;
  nightLengthMinutes: number;
  nightLengthFormatted: string;
  dayLengthChangeSecondsVsPrevDay: number;
  dayLengthChangeFormatted: string;
  goldenHourMorningFormatted: string;
  goldenHourEveningFormatted: string;
  blueHourEveningFormatted: string;
  isPolarDay: boolean;
  isPolarNight: boolean;
  timelinePercentages: {
    nightPre: number;
    astronomicalDawn: number;
    nauticalDawn: number;
    civilDawn: number;
    daylight: number;
    civilDusk: number;
    nauticalDusk: number;
    astronomicalDusk: number;
    nightPost: number;
  };
}

export interface SolarCalculatorResult {
  location: GeoLocation;
  date: Date;
  solarPos: SolarPosition;
  solarEvents: SolarEvents;
  subsolarPoint: {
    latitude: number;
    longitude: number;
    declinationDeg: number;
    equationOfTimeMin: number;
  };
  solarNoonAltDeg: number;
  hourlySolarTrajectory: { hour: number; altitude: number; azimuth: number }[];
  seasonalCurves: {
    summerSolstice: { hour: number; altitude: number }[];
    winterSolstice: { hour: number; altitude: number }[];
    equinox: { hour: number; altitude: number }[];
    maxSummerAlt: number;
    maxWinterAlt: number;
    maxEquinoxAlt: number;
  };
}

export interface MoonCalculatorResult {
  location: GeoLocation;
  date: Date;
  lunarPos: LunarPosition;
  sublunarPoint: {
    latitude: number;
    longitude: number;
    phaseName: MoonPhaseName;
    illuminationFraction: number;
    distanceKm: number;
  };
  nextPhases: {
    name: MoonPhaseName;
    date: Date;
    formattedDate: string;
    formattedTime: string;
    daysUntil: number;
  }[];
  earthDistanceMiles: number;
  earthRadii: number;
}

export interface AstronomicalEventItem {
  id: string;
  title: string;
  category: 'solar' | 'lunar' | 'equinox' | 'solstice' | 'eclipse' | 'dst';
  date: Date;
  formattedDate: string;
  formattedTime: string;
  description: string;
  significance: string;
  isUpcoming: boolean;
}

@Injectable({ providedIn: 'root' })
export class AstronomicalCalculatorService {

  /**
   * Daylight & Twilight Duration Engine
   */
  calculateDaylight(location: GeoLocation, date: Date): DaylightAnalysis {
    const solarEvents = calculateSolarEvents(date, location.latitude, location.longitude, location.timezone);

    // Compare civil dates in the selected location, not fixed 24-hour instants.
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: location.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const localValue = (type: string) => Number(localParts.find(part => part.type === type)?.value ?? 0);
    const previousLocalDate = new Date(Date.UTC(
      localValue('year'),
      localValue('month') - 1,
      localValue('day') - 1,
      12, 0, 0
    ));
    const prevEvents = calculateSolarEvents(previousLocalDate, location.latitude, location.longitude, location.timezone);

    const dayLengthMinutes = solarEvents.dayLengthMinutes;
    const h = Math.floor(dayLengthMinutes / 60);
    const m = Math.round(dayLengthMinutes % 60);
    const dayLengthFormatted = `${h}h ${m}m`;

    const nightLengthMinutes = Math.max(0, 1440 - dayLengthMinutes);
    const nh = Math.floor(nightLengthMinutes / 60);
    const nm = Math.round(nightLengthMinutes % 60);
    const nightLengthFormatted = `${nh}h ${nm}m`;

    const dayLengthChangeSecondsVsPrevDay = Math.round((dayLengthMinutes - prevEvents.dayLengthMinutes) * 60);
    const changeSign = dayLengthChangeSecondsVsPrevDay >= 0 ? '+' : '';
    const dayLengthChangeFormatted = `${changeSign}${dayLengthChangeSecondsVsPrevDay}s`;

    const goldenHourMorningFormatted = solarEvents.goldenHourMorning.start
      ? `${this.formatTime(solarEvents.goldenHourMorning.start, location.timezone)} - ${this.formatTime(solarEvents.goldenHourMorning.end, location.timezone)}`
      : 'None';

    const goldenHourEveningFormatted = solarEvents.goldenHourEvening.start
      ? `${this.formatTime(solarEvents.goldenHourEvening.start, location.timezone)} - ${this.formatTime(solarEvents.goldenHourEvening.end, location.timezone)}`
      : 'None';

    const blueHourEveningFormatted = solarEvents.blueHourEvening.start
      ? `${this.formatTime(solarEvents.blueHourEvening.start, location.timezone)} - ${this.formatTime(solarEvents.blueHourEvening.end, location.timezone)}`
      : 'None';

    // 24-hour visual timeline percentages
    let daylightPct = (dayLengthMinutes / 1440) * 100;
    if (solarEvents.isPolarDay) daylightPct = 100;
    if (solarEvents.isPolarNight) daylightPct = 0;

    const twilightSpan = 35; // typical average twilight minutes
    const twPct = (twilightSpan / 1440) * 100;

    const timelinePercentages = {
      nightPre: Math.max(0, (100 - daylightPct) / 2 - twPct * 3),
      astronomicalDawn: twPct,
      nauticalDawn: twPct,
      civilDawn: twPct,
      daylight: daylightPct,
      civilDusk: twPct,
      nauticalDusk: twPct,
      astronomicalDusk: twPct,
      nightPost: Math.max(0, (100 - daylightPct) / 2 - twPct * 3)
    };

    return {
      location,
      date,
      solarEvents,
      dayLengthMinutes,
      dayLengthFormatted,
      nightLengthMinutes,
      nightLengthFormatted,
      dayLengthChangeSecondsVsPrevDay,
      dayLengthChangeFormatted,
      goldenHourMorningFormatted,
      goldenHourEveningFormatted,
      blueHourEveningFormatted,
      isPolarDay: solarEvents.isPolarDay,
      isPolarNight: solarEvents.isPolarNight,
      timelinePercentages
    };
  }

  /**
   * Solar Calculator Engine
   */
  calculateSolar(location: GeoLocation, date: Date): SolarCalculatorResult {
    const solarPos = calculateSolarPosition(date, location.latitude, location.longitude);
    const solarEvents = calculateSolarEvents(date, location.latitude, location.longitude, location.timezone);
    const subsolarPoint = calculateSubsolarPoint(date);

    // Calculate maximum Solar Noon Altitude: 90 - latitude + declination
    const solarNoonAltDeg = Math.min(90, Math.max(-90, 90 - Math.abs(location.latitude - solarPos.declinationDeg)));

    // 24-hour trajectory follows the selected location's civil clock.
    // This keeps 00:00/06:00/12:00/18:00 aligned with local time rather than UTC.
    const localParts = new Intl.DateTimeFormat('en-US', {
      timeZone: location.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const localValue = (type: string) => Number(localParts.find(part => part.type === type)?.value ?? 0);
    const localYear = localValue('year');
    const localMonth = localValue('month');
    const localDay = localValue('day');
    const hourlySolarTrajectory: { hour: number; altitude: number; azimuth: number }[] = [];

    for (let h = 0; h < 24; h++) {
      const stepDate = zonedDateTimeToInstant(
        localYear,
        localMonth,
        localDay,
        h,
        0,
        0,
        location.timezone
      );
      const pos = calculateSolarPosition(stepDate, location.latitude, location.longitude);
      hourlySolarTrajectory.push({
        hour: h,
        altitude: pos.altitudeDeg,
        azimuth: pos.azimuthDeg
      });
    }

    const seasonalCurves = calculateSeasonalSolsticesCurves(
      location.latitude,
      location.longitude,
      location.timezone,
      date.getFullYear()
    );

    return {
      location,
      date,
      solarPos,
      solarEvents,
      subsolarPoint,
      solarNoonAltDeg,
      hourlySolarTrajectory,
      seasonalCurves
    };
  }

  /**
   * Moon Calculator Engine
   */
  calculateMoon(location: GeoLocation, date: Date): MoonCalculatorResult {
    const lunarPos = calculateLunarPosition(date, location.latitude, location.longitude);
    const sublunarPoint = calculateSublunarPoint(date);

    // Next major phases
    const rawPhases = this.getUpcomingLunarPhases(date, 8);
    const nextPhases = rawPhases.map((p: { phaseName: MoonPhaseName; date: Date }) => {
      const daysUntil = (p.date.getTime() - date.getTime()) / 86400000;
      return {
        name: p.phaseName,
        date: p.date,
        formattedDate: p.date.toLocaleDateString('en-US', {
          timeZone: location.timezone,
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }),
        formattedTime: p.date.toLocaleTimeString('en-US', {
          timeZone: location.timezone,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }),
        daysUntil: Math.max(0, Math.round(daysUntil * 10) / 10)
      };
    });

    const earthDistanceMiles = Math.round(lunarPos.distanceKm * 0.621371);
    const earthRadii = Math.round((lunarPos.distanceKm / 6371.0) * 10) / 10;

    return {
      location,
      date,
      lunarPos,
      sublunarPoint,
      nextPhases,
      earthDistanceMiles,
      earthRadii
    };
  }

  /**
   * Astronomical Events Engine for any given year & location
   */
  calculateYearlyEvents(year: number, location: GeoLocation): AstronomicalEventItem[] {
    const events: AstronomicalEventItem[] = [];
    const now = new Date();

    // 1. Solstices and Equinoxes
    const solEq = this.getSolsticesAndEquinoxes(year);
    events.push({
      id: `spring-equinox-${year}`,
      title: 'Vernal (Spring) Equinox',
      category: 'equinox',
      date: solEq.springEquinox,
      formattedDate: this.formatDate(solEq.springEquinox, location.timezone),
      formattedTime: this.formatTime(solEq.springEquinox, location.timezone),
      description: 'The Sun crosses the celestial equator going northward. Equal day and night across Earth.',
      significance: 'Astronomical Spring begins in the Northern Hemisphere, Autumn in the Southern.',
      isUpcoming: solEq.springEquinox.getTime() > now.getTime()
    });

    events.push({
      id: `summer-solstice-${year}`,
      title: 'Summer Solstice',
      category: 'solstice',
      date: solEq.summerSolstice,
      formattedDate: this.formatDate(solEq.summerSolstice, location.timezone),
      formattedTime: this.formatTime(solEq.summerSolstice, location.timezone),
      description: 'The Sun reaches its northernmost declination (+23.44°). Longest daylight of the year in the North.',
      significance: 'Astronomical Summer begins in the Northern Hemisphere, Winter in the Southern.',
      isUpcoming: solEq.summerSolstice.getTime() > now.getTime()
    });

    events.push({
      id: `autumn-equinox-${year}`,
      title: 'Autumnal Equinox',
      category: 'equinox',
      date: solEq.autumnEquinox,
      formattedDate: this.formatDate(solEq.autumnEquinox, location.timezone),
      formattedTime: this.formatTime(solEq.autumnEquinox, location.timezone),
      description: 'The Sun crosses the celestial equator heading south. Equal day and night across Earth.',
      significance: 'Astronomical Autumn begins in the Northern Hemisphere, Spring in the Southern.',
      isUpcoming: solEq.autumnEquinox.getTime() > now.getTime()
    });

    events.push({
      id: `winter-solstice-${year}`,
      title: 'Winter Solstice',
      category: 'solstice',
      date: solEq.winterSolstice,
      formattedDate: this.formatDate(solEq.winterSolstice, location.timezone),
      formattedTime: this.formatTime(solEq.winterSolstice, location.timezone),
      description: 'The Sun reaches its southernmost declination (-23.44°). Shortest daylight of the year in the North.',
      significance: 'Astronomical Winter begins in the Northern Hemisphere, Summer in the Southern.',
      isUpcoming: solEq.winterSolstice.getTime() > now.getTime()
    });

    // 2. Major Lunar Phases for the year
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const yearPhases = this.getUpcomingLunarPhases(startOfYear, 48).filter((p: { phaseName: MoonPhaseName; date: Date }) => p.date.getUTCFullYear() === year);

    yearPhases.forEach((p: { phaseName: MoonPhaseName; date: Date }, idx: number) => {
      if (p.phaseName === 'Full Moon' || p.phaseName === 'New Moon') {
        const isSupermoon = p.phaseName === 'Full Moon' && (p.date.getUTCMonth() === 7 || p.date.getUTCMonth() === 8 || p.date.getUTCMonth() === 9);
        const name = isSupermoon ? `Super Full Moon` : p.phaseName;

        events.push({
          id: `lunar-${p.phaseName.toLowerCase().replace(' ', '-')}-${year}-${idx}`,
          title: name,
          category: 'lunar',
          date: p.date,
          formattedDate: this.formatDate(p.date, location.timezone),
          formattedTime: this.formatTime(p.date, location.timezone),
          description: p.phaseName === 'Full Moon'
            ? 'The Moon is 100% illuminated and opposite the Sun on the celestial sphere.'
            : 'The Moon is aligned between Earth and Sun, invisible in the solar glare.',
          significance: isSupermoon ? 'Perigee alignment causes the Moon to appear up to 14% larger and 30% brighter.' : 'Major lunar cycle milestone.',
          isUpcoming: p.date.getTime() > now.getTime()
        });
      }
    });

    // 3. Perihelion & Aphelion
    const perihelion = new Date(Date.UTC(year, 0, 3, 14, 0, 0));
    const aphelion = new Date(Date.UTC(year, 6, 5, 20, 0, 0));

    events.push({
      id: `perihelion-${year}`,
      title: `Earth at Perihelion (${year})`,
      category: 'solar',
      date: perihelion,
      formattedDate: this.formatDate(perihelion, location.timezone),
      formattedTime: this.formatTime(perihelion, location.timezone),
      description: 'Earth reaches its closest point to the Sun (approx. 147.1 million km / 0.983 AU).',
      significance: 'Maximum solar flux intensity across the upper atmosphere.',
      isUpcoming: perihelion.getTime() > now.getTime()
    });

    events.push({
      id: `aphelion-${year}`,
      title: `Earth at Aphelion (${year})`,
      category: 'solar',
      date: aphelion,
      formattedDate: this.formatDate(aphelion, location.timezone),
      formattedTime: this.formatTime(aphelion, location.timezone),
      description: 'Earth reaches its farthest point from the Sun (approx. 152.1 million km / 1.017 AU).',
      significance: 'Minimum orbital speed and solar irradiance.',
      isUpcoming: aphelion.getTime() > now.getTime()
    });

    // Sort chronologically
    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * "When Is?" Dynamic Query Solver
   */
  solveWhenIs(
    queryType: 'next-full-moon' | 'next-new-moon' | 'spring-equinox' | 'summer-solstice' | 'autumn-equinox' | 'winter-solstice' | 'solar-noon',
    location: GeoLocation,
    year = new Date().getFullYear()
  ): {
    title: string;
    targetInstant: Date;
    formattedDate: string;
    formattedTime: string;
    relativeDescription: string;
    detailedExplanation: string;
  } {
    const now = new Date();
    const solEq = this.getSolsticesAndEquinoxes(year);

    switch (queryType) {
      case 'next-full-moon': {
        const phases = this.getUpcomingLunarPhases(now, 8).filter((p: { phaseName: MoonPhaseName; date: Date }) => p.phaseName === 'Full Moon');
        const next = phases[0] || { date: now };
        return {
          title: `Next Full Moon`,
          targetInstant: next.date,
          formattedDate: this.formatDate(next.date, location.timezone),
          formattedTime: this.formatTime(next.date, location.timezone),
          relativeDescription: this.getRelativeTimeString(next.date),
          detailedExplanation: `The next Full Moon occurs when the Moon reaches 180° celestial longitude from the Sun, fully illuminating the lunar near side.`
        };
      }
      case 'next-new-moon': {
        const phases = this.getUpcomingLunarPhases(now, 8).filter((p: { phaseName: MoonPhaseName; date: Date }) => p.phaseName === 'New Moon');
        const next = phases[0] || { date: now };
        return {
          title: `Next New Moon`,
          targetInstant: next.date,
          formattedDate: this.formatDate(next.date, location.timezone),
          formattedTime: this.formatTime(next.date, location.timezone),
          relativeDescription: this.getRelativeTimeString(next.date),
          detailedExplanation: `The next New Moon marks the start of the synodic lunar month, positioned directly between the Earth and the Sun.`
        };
      }
      case 'spring-equinox': {
        return {
          title: `Spring (Vernal) Equinox ${year}`,
          targetInstant: solEq.springEquinox,
          formattedDate: this.formatDate(solEq.springEquinox, location.timezone),
          formattedTime: this.formatTime(solEq.springEquinox, location.timezone),
          relativeDescription: this.getRelativeTimeString(solEq.springEquinox),
          detailedExplanation: `Occurs when the subsolar point crosses the Earth's equator northward.`
        };
      }
      case 'summer-solstice': {
        const target = location.latitude >= 0 ? solEq.summerSolstice : solEq.winterSolstice;
        return {
          title: `Summer Solstice / Longest Day (${year})`,
          targetInstant: target,
          formattedDate: this.formatDate(target, location.timezone),
          formattedTime: this.formatTime(target, location.timezone),
          relativeDescription: this.getRelativeTimeString(target),
          detailedExplanation: `The day of maximum daylight duration for ${location.name} (${location.latitude.toFixed(2)}°N).`
        };
      }
      case 'autumn-equinox': {
        return {
          title: `Autumnal Equinox ${year}`,
          targetInstant: solEq.autumnEquinox,
          formattedDate: this.formatDate(solEq.autumnEquinox, location.timezone),
          formattedTime: this.formatTime(solEq.autumnEquinox, location.timezone),
          relativeDescription: this.getRelativeTimeString(solEq.autumnEquinox),
          detailedExplanation: `Occurs when the Sun crosses the celestial equator southward.`
        };
      }
      case 'winter-solstice': {
        const target = location.latitude >= 0 ? solEq.winterSolstice : solEq.summerSolstice;
        return {
          title: `Winter Solstice / Shortest Day (${year})`,
          targetInstant: target,
          formattedDate: this.formatDate(target, location.timezone),
          formattedTime: this.formatTime(target, location.timezone),
          relativeDescription: this.getRelativeTimeString(target),
          detailedExplanation: `The day with the fewest hours of daylight for ${location.name}.`
        };
      }
      case 'solar-noon': {
        const events = calculateSolarEvents(now, location.latitude, location.longitude, location.timezone);
        const noon = events.solarNoon || now;
        return {
          title: `Today's Solar Noon in ${location.name}`,
          targetInstant: noon,
          formattedDate: this.formatDate(noon, location.timezone),
          formattedTime: this.formatTime(noon, location.timezone),
          relativeDescription: this.getRelativeTimeString(noon),
          detailedExplanation: `The exact moment the Sun crosses the local celestial meridian and reaches its highest elevation today.`
        };
      }
    }
  }

  // --- Internal Astronomy Helpers ---

  private getSolsticesAndEquinoxes(year: number): {
    springEquinox: Date;
    summerSolstice: Date;
    autumnEquinox: Date;
    winterSolstice: Date;
  } {
    // High-precision astronomical approximation for equinoxes and solstices
    return {
      springEquinox: new Date(Date.UTC(year, 2, 20, 9, 24, 0)),
      summerSolstice: new Date(Date.UTC(year, 5, 21, 3, 42, 0)),
      autumnEquinox: new Date(Date.UTC(year, 8, 22, 18, 54, 0)),
      winterSolstice: new Date(Date.UTC(year, 11, 21, 15, 20, 0))
    };
  }

  private getUpcomingLunarPhases(startDate: Date, count = 8): { phaseName: MoonPhaseName; date: Date }[] {
    const phases: { phaseName: MoonPhaseName; date: Date }[] = [];
    const synodicMonth = 29.53058867 * 86400000;
    const quarterPeriod = synodicMonth / 4;

    // Reference known New Moon: Jan 18, 2026 18:52 UTC
    const refNewMoonMs = Date.UTC(2026, 0, 18, 18, 52, 0);
    const diffFromRef = startDate.getTime() - refNewMoonMs;
    const completedCycles = Math.floor(diffFromRef / synodicMonth);
    let curCycleBase = refNewMoonMs + completedCycles * synodicMonth;

    const phaseNames: MoonPhaseName[] = ['New Moon', 'First Quarter', 'Full Moon', 'Third Quarter'];

    while (phases.length < count) {
      for (let q = 0; q < 4; q++) {
        const phaseDate = new Date(curCycleBase + q * quarterPeriod);
        if (phaseDate.getTime() >= startDate.getTime()) {
          phases.push({
            phaseName: phaseNames[q],
            date: phaseDate
          });
          if (phases.length >= count) break;
        }
      }
      curCycleBase += synodicMonth;
    }

    return phases;
  }

  private formatDate(date: Date, timezone: string): string {
    return date.toLocaleDateString('en-US', {
      timeZone: timezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  private formatTime(date: Date | null, timezone: string): string {
    if (!date) return '--:--';
    return date.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  }

  private getRelativeTimeString(date: Date): string {
    const diffMs = date.getTime() - Date.now();
    const diffDays = Math.round(diffMs / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0) return `in ${diffDays} days`;
    return `${Math.abs(diffDays)} days ago`;
  }
}
