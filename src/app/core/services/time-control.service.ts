import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type SimulationSpeed = 1 | 10 | 60 | 300 | 1200;

/**
 * The temporal authority for 2PiClock.
 *
 * Live mode is anchored to an epoch timestamp once, then advanced with
 * performance.now() so a wall-clock adjustment does not make the visible
 * clock jump every animation frame. The wall clock is periodically sampled
 * to correct long-term drift.
 */
@Injectable({ providedIn: 'root' })
export class TimeControlService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  readonly baseDate = signal<Date>(new Date());
  readonly isLive = signal(true);
  readonly isPlaying = signal(true);
  readonly simulationSpeed = signal<SimulationSpeed>(1);

  readonly simulatedEpochMs = signal(Date.now());
  private readonly liveEpochMs = signal(Date.now());

  readonly currentActiveDate = computed(() => {
    if (this.isLive()) {
      return new Date(this.liveEpochMs());
    }
    return new Date(this.simulatedEpochMs());
  });

  readonly dayFraction = computed(() => {
    const d = this.currentActiveDate();
    return (
      (d.getUTCHours() * 3600000 +
        d.getUTCMinutes() * 60000 +
        d.getUTCSeconds() * 1000 +
        d.getUTCMilliseconds()) /
      86400000
    );
  });

  private animationFrameId: number | null = null;
  private lastPerformanceTime = 0;
  private liveAnchorEpochMs = Date.now();
  private liveAnchorPerformanceMs = 0;
  private lastClockResyncPerformanceMs = 0;
  private lastEmittedLiveSecond = Math.floor(Date.now() / 1000);
  private simulationAccumulatorMs = 0;
  private lastSimulationEmitPerformanceMs = 0;

  constructor() {
    if (this.isBrowser) {
      this.liveAnchorPerformanceMs = performance.now();
      this.lastClockResyncPerformanceMs = this.liveAnchorPerformanceMs;
      this.lastSimulationEmitPerformanceMs = this.liveAnchorPerformanceMs;
      this.startLoop();
    }
  }

  private startLoop(): void {
    this.lastPerformanceTime = performance.now();

    const tick = (performanceTime: number) => {
      const deltaMs = Math.min(
        Math.max(0, performanceTime - this.lastPerformanceTime),
        250
      );
      this.lastPerformanceTime = performanceTime;

      if (this.isLive()) {
        const elapsed = performanceTime - this.liveAnchorPerformanceMs;
        const epoch = this.liveAnchorEpochMs + elapsed;
        const currentSec = Math.floor(epoch / 1000);

        if (currentSec !== this.lastEmittedLiveSecond) {
          this.lastEmittedLiveSecond = currentSec;
          this.liveEpochMs.set(epoch);
        }

        // Re-anchor every 30 seconds to absorb system clock corrections
        // without introducing visible per-frame jitter.
        if (performanceTime - this.lastClockResyncPerformanceMs >= 30000) {
          this.reanchorLiveClock(performanceTime);
        }
      } else if (this.isPlaying()) {
        const speed = this.simulationSpeed();
        this.simulationAccumulatorMs += deltaMs * speed;

        // Controlled emission cadence:
        // At 1x speed: emit once per simulated second (or min 250ms)
        // At higher speeds: emit at max 20Hz (every 50ms) to ensure smooth motion without frame drops
        const minIntervalMs = speed === 1 ? 500 : 50;
        if (performanceTime - this.lastSimulationEmitPerformanceMs >= minIntervalMs) {
          this.lastSimulationEmitPerformanceMs = performanceTime;
          const advancement = this.simulationAccumulatorMs;
          this.simulationAccumulatorMs = 0;
          this.advanceSimulation(advancement);
        }
      }

      if (typeof requestAnimationFrame !== 'undefined') {
        this.animationFrameId = requestAnimationFrame(tick);
      }
    };

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(tick);
    }
  }

  private reanchorLiveClock(performanceTime: number): void {
    this.liveAnchorEpochMs = Date.now();
    this.liveAnchorPerformanceMs = performanceTime;
    this.lastClockResyncPerformanceMs = performanceTime;
    this.liveEpochMs.set(this.liveAnchorEpochMs);
  }

  private advanceSimulation(advancementMs: number): void {
    this.simulatedEpochMs.update(epoch => epoch + advancementMs);
  }

  setLive(): void {
    const now = Date.now();
    const perf = this.isBrowser ? performance.now() : 0;

    this.liveAnchorEpochMs = now;
    this.liveAnchorPerformanceMs = perf;
    this.lastClockResyncPerformanceMs = perf;
    this.lastEmittedLiveSecond = Math.floor(now / 1000);
    this.liveEpochMs.set(now);
    this.simulatedEpochMs.set(now);

    const date = new Date(now);
    this.baseDate.set(date);
    this.isLive.set(true);
    this.isPlaying.set(true);
    this.simulationSpeed.set(1);
  }

  /**
   * Set the simulation to an exact instant.
   * Directly stores the exact epoch timestamp, preserving the exact UTC/timezone instant
   * and avoiding any browser-local midnight shifts or DST conversion errors.
   */
  setSpecificInstant(date: Date): void {
    const instantMs = date.getTime();
    this.isLive.set(false);
    this.simulatedEpochMs.set(instantMs);
    this.baseDate.set(new Date(instantMs));
  }

  setTimeOfDayFraction(fraction: number): void {
    this.isLive.set(false);
    const current = this.currentActiveDate();
    const d = new Date(current.getTime());
    const clampedFrac = Math.max(0, Math.min(0.999999, fraction));
    const dayMs = clampedFrac * 86400000;
    const hours = Math.floor(dayMs / 3600000);
    const minutes = Math.floor((dayMs % 3600000) / 60000);
    const seconds = Math.floor((dayMs % 60000) / 1000);
    d.setUTCHours(hours, minutes, seconds, 0);
    this.simulatedEpochMs.set(d.getTime());
  }

  setTimeHoursMinutes(hours: number, minutes: number, seconds = 0): void {
    this.isLive.set(false);
    const current = this.currentActiveDate();
    const d = new Date(current.getTime());
    d.setUTCHours(
      Math.max(0, Math.min(23, hours)),
      Math.max(0, Math.min(59, minutes)),
      Math.max(0, Math.min(59, seconds)),
      0
    );
    this.simulatedEpochMs.set(d.getTime());
  }

  setSpecificDate(year: number, month: number, day: number): void {
    const current = this.currentActiveDate();
    const d = new Date(current.getTime());
    d.setUTCFullYear(year, month - 1, day);
    this.setSpecificInstant(d);
  }

  setSimulationSpeed(speed: SimulationSpeed): void {
    this.simulationSpeed.set(speed);
    this.isLive.set(false);
  }

  togglePlayPause(): void {
    if (this.isLive()) {
      this.isLive.set(false);
      this.isPlaying.set(false);
      return;
    }

    this.isPlaying.update(value => !value);
  }

  stepMinutes(minutes: number): void {
    this.isLive.set(false);
    this.advanceSimulation(minutes * 60000);
  }
}
