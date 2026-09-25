import { Injectable } from '@angular/core';
import { GeoLocation } from '../models/location.model';

export interface TimezoneConversionResult {
  location: GeoLocation;
  localTime: string;
  localTime12: string;
  localDate: string;
  dayOffset: number; // -1 = yesterday, 0 = same day, +1 = tomorrow relative to source
  utcOffsetMinutes: number;
  utcOffsetString: string;
  timezoneAbbr: string;
  isDST: boolean;
  isWorkHour: boolean; // 09:00 - 17:00
  isSleepHour: boolean; // 22:00 - 06:00
}

export interface TimeDifferenceResult {
  locA: GeoLocation;
  locB: GeoLocation;
  timeA: string;
  dateA: string;
  timeB: string;
  dateB: string;
  diffMinutes: number;
  diffHours: number;
  formattedDiff: string;
  relationText: string; // e.g. "Tokyo is 9 hours ahead of Casablanca"
  dstA: boolean;
  dstB: boolean;
}

export interface DurationResult {
  totalMs: number;
  totalSeconds: number;
  totalMinutes: number;
  totalHours: number;
  totalDays: number;
  breakdown: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  };
  formattedSummary: string;
  crossesMidnight: boolean;
  isNegative: boolean;
}

export interface DateDifferenceResult {
  totalDays: number;
  totalWeeks: number;
  remainingDaysAfterWeeks: number;
  totalHours: number;
  totalMinutes: number;
  businessDays: number; // Monday - Friday
  weekendDays: number;
  calendarBreakdown: {
    years: number;
    months: number;
    days: number;
  };
  formattedCalendarSummary: string;
  isNegative: boolean;
}

export interface AddSubtractResult {
  resultDate: Date;
  isoString: string;
  formattedLocal: string;
  formattedUtc: string;
  unixTimestampSec: number;
  dayOfWeek: string;
  isLeapYear: boolean;
  daysInMonth: number;
}

export interface CountdownState {
  targetDate: Date;
  totalRemainingMs: number;
  isComplete: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  formattedTime: string;
  progressPercent: number; // if start timestamp provided
}

export interface UnixConversionResult {
  unixSeconds: number;
  unixMilliseconds: number;
  iso8601: string;
  utcString: string;
  localFormatted: string;
  relativeTime: string;
  isLeapYear: boolean;
  dayOfYear: number;
}

export interface WorldComparisonRow {
  location: GeoLocation;
  localTime: string;
  localDate: string;
  utcOffset: string;
  timeDiffVsReferenceHours: number;
  status: 'work' | 'shoulder' | 'personal' | 'sleep';
  statusLabel: string;
  daylightStatus: 'day' | 'night' | 'twilight';
  hourBlocks: { hour: number; isWork: boolean; isCurrent: boolean }[];
}

@Injectable({ providedIn: 'root' })
export class TimeCalculationService {

  /**
   * Converts a given local date/time in a source timezone to multiple target timezones
   */
  convertTimezones(
    sourceLocation: GeoLocation,
    year: number,
    month: number, // 1-12
    day: number,
    hour: number,
    minute: number,
    second = 0,
    targetLocations: GeoLocation[] = []
  ): { sourceInstant: Date; conversions: TimezoneConversionResult[] } {
    // 1. Build unambiguous UTC instant from source local date & time
    const sourceInstant = this.createUtcFromLocal(sourceLocation.timezone, year, month, day, hour, minute, second);

    // 2. Source reference calendar day
    const sourceDateParts = this.getLocalDateParts(sourceInstant, sourceLocation.timezone);
    const sourceEpochDay = Date.UTC(sourceDateParts.year, sourceDateParts.month - 1, sourceDateParts.day);

    const conversions: TimezoneConversionResult[] = targetLocations.map(loc => {
      const parts = this.getLocalDateParts(sourceInstant, loc.timezone);
      const targetEpochDay = Date.UTC(parts.year, parts.month - 1, parts.day);
      const dayOffset = Math.round((targetEpochDay - sourceEpochDay) / 86400000);

      const offsetMin = this.getTimezoneOffsetMinutes(sourceInstant, loc.timezone);
      const offsetStr = this.formatUtcOffset(offsetMin);

      const h24 = parts.hour;
      const m24 = parts.minute;
      const s24 = parts.second;
      const localTime = `${String(h24).padStart(2, '0')}:${String(m24).padStart(2, '0')}:${String(s24).padStart(2, '0')}`;

      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      const ampm = h24 >= 12 ? 'PM' : 'AM';
      const localTime12 = `${h12}:${String(m24).padStart(2, '0')} ${ampm}`;

      const dateObj = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
      const localDate = dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'
      });

      const isDST = this.isDaylightSavingTime(sourceInstant, loc.timezone);
      const isWorkHour = h24 >= 9 && h24 < 17;
      const isSleepHour = h24 >= 22 || h24 < 6;

      const timezoneAbbr = this.getTimezoneAbbreviation(sourceInstant, loc.timezone);

      return {
        location: loc,
        localTime,
        localTime12,
        localDate,
        dayOffset,
        utcOffsetMinutes: offsetMin,
        utcOffsetString: offsetStr,
        timezoneAbbr,
        isDST,
        isWorkHour,
        isSleepHour
      };
    });

    return { sourceInstant, conversions };
  }

  /**
   * Calculates the exact time difference between two locations on a specific date
   */
  calculateTimeDifference(
    locA: GeoLocation,
    locB: GeoLocation,
    date: Date = new Date()
  ): TimeDifferenceResult {
    const offsetA = this.getTimezoneOffsetMinutes(date, locA.timezone);
    const offsetB = this.getTimezoneOffsetMinutes(date, locB.timezone);

    const diffMinutes = offsetB - offsetA;
    const diffHours = diffMinutes / 60;

    const absHours = Math.floor(Math.abs(diffMinutes) / 60);
    const absMinutes = Math.abs(diffMinutes) % 60;
    const formattedDiff = absMinutes === 0 ? `${absHours}h` : `${absHours}h ${absMinutes}m`;

    let relationText = '';
    if (diffMinutes === 0) {
      relationText = `${locB.name} is in the same time zone as ${locA.name}`;
    } else if (diffMinutes > 0) {
      relationText = `${locB.name} is ${formattedDiff} ahead of ${locA.name}`;
    } else {
      relationText = `${locB.name} is ${formattedDiff} behind ${locA.name}`;
    }

    const timeA = date.toLocaleTimeString('en-US', { timeZone: locA.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateA = date.toLocaleDateString('en-US', { timeZone: locA.timezone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const timeB = date.toLocaleTimeString('en-US', { timeZone: locB.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateB = date.toLocaleDateString('en-US', { timeZone: locB.timezone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    const dstA = this.isDaylightSavingTime(date, locA.timezone);
    const dstB = this.isDaylightSavingTime(date, locB.timezone);

    return {
      locA,
      locB,
      timeA,
      dateA,
      timeB,
      dateB,
      diffMinutes,
      diffHours,
      formattedDiff,
      relationText,
      dstA,
      dstB
    };
  }

  /**
   * Calculates high-precision duration between two timestamps
   */
  calculateDuration(startDate: Date, endDate: Date): DurationResult {
    const totalMs = endDate.getTime() - startDate.getTime();
    const isNegative = totalMs < 0;
    const absMs = Math.abs(totalMs);

    const totalSeconds = Math.floor(absMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = totalMinutes / 60;
    const totalDays = totalHours / 24;

    const days = Math.floor(absMs / 86400000);
    const hours = Math.floor((absMs % 86400000) / 3600000);
    const minutes = Math.floor((absMs % 3600000) / 60000);
    const seconds = Math.floor((absMs % 60000) / 1000);

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);

    const formattedSummary = (isNegative ? '-' : '') + parts.join(', ');
    const crossesMidnight = startDate.getUTCDate() !== endDate.getUTCDate() || absMs >= 86400000;

    return {
      totalMs,
      totalSeconds,
      totalMinutes,
      totalHours,
      totalDays,
      breakdown: { days, hours, minutes, seconds },
      formattedSummary,
      crossesMidnight,
      isNegative
    };
  }

  /**
   * Computes true calendar date difference (Years, Months, Days) and totals
   */
  calculateDateDifference(d1: Date, d2: Date, includeEndDay = false): DateDifferenceResult {
    let start = new Date(Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate()));
    let end = new Date(Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate()));
    
    let isNegative = false;
    if (end.getTime() < start.getTime()) {
      isNegative = true;
      const temp = start;
      start = end;
      end = temp;
    }

    if (includeEndDay) {
      end = new Date(end.getTime() + 86400000);
    }

    // 1. Calendar Unit Difference (Years, Months, Days)
    let years = end.getUTCFullYear() - start.getUTCFullYear();
    let months = end.getUTCMonth() - start.getUTCMonth();
    let days = end.getUTCDate() - start.getUTCDate();

    if (days < 0) {
      months -= 1;
      // Get days in previous month
      const prevMonthLastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0)).getUTCDate();
      days += prevMonthLastDay;
    }

    if (months < 0) {
      years -= 1;
      months += 12;
    }

    // 2. Absolute totals
    const totalMs = end.getTime() - start.getTime();
    const totalDays = Math.round(totalMs / 86400000);
    const totalWeeks = Math.floor(totalDays / 7);
    const remainingDaysAfterWeeks = totalDays % 7;
    const totalHours = totalDays * 24;
    const totalMinutes = totalHours * 60;

    // 3. Business / Weekend Days
    let businessDays = 0;
    let weekendDays = 0;
    const cur = new Date(start.getTime());
    while (cur.getTime() < end.getTime()) {
      const dayOfWeek = cur.getUTCDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendDays++;
      } else {
        businessDays++;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    const summaryParts: string[] = [];
    if (years > 0) summaryParts.push(`${years} year${years > 1 ? 's' : ''}`);
    if (months > 0) summaryParts.push(`${months} month${months > 1 ? 's' : ''}`);
    if (days > 0 || summaryParts.length === 0) summaryParts.push(`${days} day${days > 1 ? 's' : ''}`);

    const formattedCalendarSummary = (isNegative ? '-' : '') + summaryParts.join(', ');

    return {
      totalDays: isNegative ? -totalDays : totalDays,
      totalWeeks: isNegative ? -totalWeeks : totalWeeks,
      remainingDaysAfterWeeks,
      totalHours: isNegative ? -totalHours : totalHours,
      totalMinutes: isNegative ? -totalMinutes : totalMinutes,
      businessDays: isNegative ? -businessDays : businessDays,
      weekendDays: isNegative ? -weekendDays : weekendDays,
      calendarBreakdown: { years, months, days },
      formattedCalendarSummary,
      isNegative
    };
  }

  /**
   * Adds or subtracts time with calendar integrity and leap-year rules
   */
  addSubtractTime(
    baseDate: Date,
    operation: 'add' | 'subtract',
    amount: {
      years?: number;
      months?: number;
      days?: number;
      hours?: number;
      minutes?: number;
      seconds?: number;
    }
  ): AddSubtractResult {
    const sign = operation === 'add' ? 1 : -1;
    const d = new Date(baseDate.getTime());

    const years = (amount.years || 0) * sign;
    const months = (amount.months || 0) * sign;
    const days = (amount.days || 0) * sign;
    const hours = (amount.hours || 0) * sign;
    const minutes = (amount.minutes || 0) * sign;
    const seconds = (amount.seconds || 0) * sign;

    if (years !== 0 || months !== 0) {
      const targetYear = d.getUTCFullYear() + years;
      const targetMonth = d.getUTCMonth() + months;
      const origDay = d.getUTCDate();

      // Set year and month first
      d.setUTCFullYear(targetYear);
      d.setUTCMonth(targetMonth);

      // Clamp day to max days in month (e.g. Feb 29 -> Feb 28 on non-leap years)
      const maxDaysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
      if (origDay > maxDaysInMonth) {
        d.setUTCDate(maxDaysInMonth);
      }
    }

    if (days !== 0) {
      d.setUTCDate(d.getUTCDate() + days);
    }

    if (hours !== 0) {
      d.setUTCHours(d.getUTCHours() + hours);
    }

    if (minutes !== 0) {
      d.setUTCMinutes(d.getUTCMinutes() + minutes);
    }

    if (seconds !== 0) {
      d.setUTCSeconds(d.getUTCSeconds() + seconds);
    }

    const unixTimestampSec = Math.floor(d.getTime() / 1000);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayOfWeek = dayNames[d.getUTCDay()];

    const y = d.getUTCFullYear();
    const isLeapYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    const daysInMonth = new Date(Date.UTC(y, d.getUTCMonth() + 1, 0)).getUTCDate();

    return {
      resultDate: d,
      isoString: d.toISOString(),
      formattedLocal: d.toLocaleString('en-US'),
      formattedUtc: d.toUTCString(),
      unixTimestampSec,
      dayOfWeek,
      isLeapYear,
      daysInMonth
    };
  }

  /**
   * Computes exact epoch countdown parameters
   */
  calculateCountdown(targetDate: Date, fromDate: Date = new Date(), startDate?: Date): CountdownState {
    const totalRemainingMs = targetDate.getTime() - fromDate.getTime();
    const isComplete = totalRemainingMs <= 0;

    const absMs = Math.max(0, totalRemainingMs);
    const days = Math.floor(absMs / 86400000);
    const hours = Math.floor((absMs % 86400000) / 3600000);
    const minutes = Math.floor((absMs % 3600000) / 60000);
    const seconds = Math.floor((absMs % 60000) / 1000);

    const formattedTime = `${String(days).padStart(2, '0')}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;

    let progressPercent = 0;
    if (startDate) {
      const totalSpan = targetDate.getTime() - startDate.getTime();
      if (totalSpan > 0) {
        const elapsed = fromDate.getTime() - startDate.getTime();
        progressPercent = Math.max(0, Math.min(100, (elapsed / totalSpan) * 100));
      }
    }

    return {
      targetDate,
      totalRemainingMs,
      isComplete,
      days,
      hours,
      minutes,
      seconds,
      formattedTime,
      progressPercent
    };
  }

  /**
   * Converts Unix Timestamps to readable dates and vice-versa
   */
  convertUnixTimestamp(value: number | string, inputMode: 'seconds' | 'milliseconds' | 'iso'): UnixConversionResult {
    let date: Date;

    if (inputMode === 'seconds') {
      const sec = typeof value === 'string' ? parseFloat(value) : value;
      date = new Date((sec || 0) * 1000);
    } else if (inputMode === 'milliseconds') {
      const ms = typeof value === 'string' ? parseFloat(value) : value;
      date = new Date(ms || 0);
    } else {
      date = new Date(value);
      if (isNaN(date.getTime())) {
        date = new Date();
      }
    }

    const unixSeconds = Math.floor(date.getTime() / 1000);
    const unixMilliseconds = date.getTime();
    const iso8601 = date.toISOString();
    const utcString = date.toUTCString();
    const localFormatted = date.toLocaleString('en-US');

    // Relative time calculation
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    let relativeTime = '';
    if (Math.abs(diffSec) < 60) {
      relativeTime = diffSec >= 0 ? `${diffSec}s ago` : `in ${Math.abs(diffSec)}s`;
    } else if (Math.abs(diffSec) < 3600) {
      const m = Math.floor(Math.abs(diffSec) / 60);
      relativeTime = diffSec >= 0 ? `${m}m ago` : `in ${m}m`;
    } else if (Math.abs(diffSec) < 86400) {
      const h = Math.floor(Math.abs(diffSec) / 3600);
      relativeTime = diffSec >= 0 ? `${h}h ago` : `in ${h}h`;
    } else {
      const d = Math.floor(Math.abs(diffSec) / 86400);
      relativeTime = diffSec >= 0 ? `${d}d ago` : `in ${d}d`;
    }

    const y = date.getUTCFullYear();
    const isLeapYear = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

    // Day of Year
    const startOfYear = new Date(Date.UTC(y, 0, 1));
    const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86400000) + 1;

    return {
      unixSeconds,
      unixMilliseconds,
      iso8601,
      utcString,
      localFormatted,
      relativeTime,
      isLeapYear,
      dayOfYear
    };
  }

  /**
   * Multi-City World Time Comparison Matrix
   */
  calculateWorldComparisonMatrix(
    cities: GeoLocation[],
    referenceCity: GeoLocation,
    instant: Date = new Date()
  ): WorldComparisonRow[] {
    const refOffset = this.getTimezoneOffsetMinutes(instant, referenceCity.timezone);

    return cities.map(loc => {
      const localTime = instant.toLocaleTimeString('en-US', {
        timeZone: loc.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      const localDate = instant.toLocaleDateString('en-US', {
        timeZone: loc.timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });

      const offsetMin = this.getTimezoneOffsetMinutes(instant, loc.timezone);
      const utcOffset = this.formatUtcOffset(offsetMin);
      const timeDiffVsReferenceHours = (offsetMin - refOffset) / 60;

      const [hStr] = localTime.split(':');
      const hour = parseInt(hStr, 10) || 0;

      let status: WorldComparisonRow['status'] = 'personal';
      let statusLabel = 'Evening / Personal';

      if (hour >= 9 && hour < 17) {
        status = 'work';
        statusLabel = 'Working Hours';
      } else if ((hour >= 8 && hour < 9) || (hour >= 17 && hour < 18)) {
        status = 'shoulder';
        statusLabel = 'Shoulder / Flex';
      } else if (hour >= 22 || hour < 6) {
        status = 'sleep';
        statusLabel = 'Sleep / Night';
      }

      // Daylight approximation
      let daylightStatus: WorldComparisonRow['daylightStatus'] = 'day';
      if (hour >= 6 && hour < 19) {
        daylightStatus = 'day';
      } else if ((hour >= 5 && hour < 6) || (hour >= 19 && hour < 20)) {
        daylightStatus = 'twilight';
      } else {
        daylightStatus = 'night';
      }

      // 24-hour strip visualization
      const hourBlocks = Array.from({ length: 24 }, (_, i) => {
        return {
          hour: i,
          isWork: i >= 9 && i < 17,
          isCurrent: i === hour
        };
      });

      return {
        location: loc,
        localTime,
        localDate,
        utcOffset,
        timeDiffVsReferenceHours,
        status,
        statusLabel,
        daylightStatus,
        hourBlocks
      };
    });
  }

  // --- Helper Methods ---

  private createUtcFromLocal(
    timezone: string,
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second = 0
  ): Date {
    // Initial guess assuming UTC
    let guessUtc = Date.UTC(year, month - 1, day, hour, minute, second);

    // Iterative refinement to match target local timezone (handles DST ambiguity)
    for (let iter = 0; iter < 3; iter++) {
      const parts = this.getLocalDateParts(new Date(guessUtc), timezone);
      const currentLocalMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      const targetLocalMs = Date.UTC(year, month - 1, day, hour, minute, second);
      const diff = targetLocalMs - currentLocalMs;

      if (diff === 0) break;
      guessUtc += diff;
    }

    return new Date(guessUtc);
  }

  private getLocalDateParts(date: Date, timezone: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  } {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });

      const parts = formatter.formatToParts(date);
      let year = date.getUTCFullYear();
      let month = date.getUTCMonth() + 1;
      let day = date.getUTCDate();
      let hour = date.getUTCHours();
      let minute = date.getUTCMinutes();
      let second = date.getUTCSeconds();

      for (const p of parts) {
        if (p.type === 'year') year = parseInt(p.value, 10);
        if (p.type === 'month') month = parseInt(p.value, 10);
        if (p.type === 'day') day = parseInt(p.value, 10);
        if (p.type === 'hour') hour = parseInt(p.value, 10) % 24;
        if (p.type === 'minute') minute = parseInt(p.value, 10);
        if (p.type === 'second') second = parseInt(p.value, 10);
      }

      return { year, month, day, hour, minute, second };
    } catch {
      return {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds()
      };
    }
  }

  getTimezoneOffsetMinutes(date: Date, timezone: string): number {
    try {
      const parts = this.getLocalDateParts(date, timezone);
      const localEpoch = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      return Math.round((localEpoch - date.getTime()) / 60000);
    } catch {
      return 0;
    }
  }

  private formatUtcOffset(offsetMinutes: number): string {
    const sign = offsetMinutes >= 0 ? '+' : '-';
    const absMin = Math.abs(offsetMinutes);
    const h = Math.floor(absMin / 60);
    const m = absMin % 60;
    return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, '0')}`;
  }

  private getTimezoneAbbreviation(date: Date, timezone: string): string {
    try {
      const str = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        timeZoneName: 'short'
      }).format(date);
      const parts = str.split(' ');
      return parts[parts.length - 1] || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  private isDaylightSavingTime(date: Date, timezone: string): boolean {
    try {
      const y = date.getFullYear();
      // Compare offset in January vs July
      const jan = new Date(Date.UTC(y, 0, 15));
      const jul = new Date(Date.UTC(y, 6, 15));

      const offJan = this.getTimezoneOffsetMinutes(jan, timezone);
      const offJul = this.getTimezoneOffsetMinutes(jul, timezone);

      if (offJan === offJul) return false; // No DST in this zone

      const stdOffset = Math.min(offJan, offJul);
      const curOffset = this.getTimezoneOffsetMinutes(date, timezone);
      return curOffset > stdOffset;
    } catch {
      return false;
    }
  }
}
