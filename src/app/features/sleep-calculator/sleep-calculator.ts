import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  computed,
  effect
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import { MatIconModule } from '@angular/material/icon';
import { CelestialService } from '../../core/services/celestial.service';
import { LocationService } from '../../core/services/location.service';
import { getCelestialState } from '../../core/astronomy/astronomy-engine';
import { ShareExportModalComponent, ShareSleepPlan } from '../../shared/components/share-export-modal/share-export-modal';

export type Mode = 'wake' | 'bed' | 'now' | 'nap';
export type Age = 'teen' | 'adult' | 'older' | 'senior';
export type Chronotype = 'lark' | 'bear' | 'wolf';

export interface Plan {
  id: string;
  cycles: number;
  sleepMinutes: number;
  inBedMinutes: number;
  bedtime: Date;
  wakeTime: Date;
  score: 'recommended' | 'optimal' | 'short' | 'long';
  scoreLabel: string;
  efficiencyPercent: number;
  inertiaRisk: 'low' | 'moderate' | 'high';
  stageSummary: string;
  napType?: 'power' | 'caffeine' | 'refresh' | 'cycle' | 'recovery';
}

export interface HistoryEntry {
  id: number;
  createdAt: string;
  mode: Mode;
  title: string;
  bedtime: string;
  wakeTime: string;
  sleepMinutes: number;
  inBedMinutes: number;
  cycles: number;
  age: Age;
  chronotype: Chronotype;
  location: string;
  timezone: string;
}

export interface ToastMessage {
  id: number;
  title: string;
  message: string;
  icon: string;
}

@Component({
  selector: 'app-sleep-calculator',
  imports: [CommonModule, MatIconModule, ShareExportModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sleep-calculator.html',
  styleUrl: './sleep-calculator.css'
})
export class SleepCalculatorComponent implements OnInit, OnDestroy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly platformId = inject(PLATFORM_ID);
  readonly locationService = inject(LocationService);
  readonly celestialService = inject(CelestialService);

  // Core Calculator Configuration Signals
  readonly mode = signal<Mode>('wake');
  readonly age = signal<Age>('adult');
  readonly chronotype = signal<Chronotype>('bear');
  readonly wakeTime = signal('07:00');
  readonly bedtime = signal('23:00');
  readonly latency = signal(14); // Clinical average is ~14 min
  readonly cycleLengthMinutes = signal(90); // Standard ultradian cycle

  // UI & History State
  readonly showShareModal = signal(false);
  readonly history = signal<HistoryEntry[]>([]);
  readonly toast = signal<ToastMessage | null>(null);
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Simulation State
  readonly isSimulating = signal(false);
  readonly simulationProgress = signal(0); // 0 to 1 along the night
  readonly simulationSpeed = signal<number>(15); // multiplier
  readonly selectedPlanForSim = signal<Plan | null>(null);
  private simIntervalId: ReturnType<typeof setInterval> | null = null;

  // Computed Target Sleep Hours
  readonly targetRange = computed(() => {
    switch (this.age()) {
      case 'teen': return { min: 8, max: 10, label: '8–10 h', optimalCycles: 6 };
      case 'older': return { min: 7, max: 9, label: '7–9 h', optimalCycles: 5 };
      case 'senior': return { min: 7, max: 8, label: '7–8 h', optimalCycles: 5 };
      default: return { min: 7, max: 9, label: '7–9 h', optimalCycles: 5 };
    }
  });

  // Current Atmospheric & Solar Context
  readonly currentSky = computed(() => {
    const a = this.celestialService.celestialState().sun.altitudeDeg;
    return a < -18 ? 'Astronomical Night' : a < -6 ? 'Nautical/Civil Twilight' : a < 6 ? 'Solar Horizon' : 'Day Sky';
  });

  readonly weatherContext = computed(() => {
    const w = this.celestialService.currentWeather();
    return w ? `${w.temperatureC}°C · ${w.conditionLabel}` : 'Atmosphere nominal';
  });

  readonly sunset = computed(() => {
    const d = this.celestialService.celestialState().solarEvents.sunset;
    return d ? this.formatTime(d) : '—';
  });

  readonly sunrise = computed(() => {
    const d = this.celestialService.celestialState().solarEvents.sunrise;
    return d ? this.formatTime(d) : '—';
  });

  // Generated Sleep Plans
  readonly plans = computed<Plan[]>(() => {
    const m = this.mode();
    if (m === 'nap') {
      return this.generateNapPlans();
    }
    if (m === 'now') {
      return this.generateSleepNowPlans();
    }

    const base = this.parseTime(m === 'bed' ? this.bedtime() : this.wakeTime());
    const forward = m === 'bed';
    const cycleLen = this.cycleLengthMinutes();
    const lat = this.latency();
    const range = this.targetRange();

    // 5, 6, 4, 7, 3 cycles
    return [5, 6, 4, 7, 3].map(cycles => {
      const sleep = cycles * cycleLen;
      const inBed = sleep + lat;
      const bed = forward ? base : new Date(base.getTime() - inBed * 60000);
      const wake = forward ? new Date(base.getTime() + inBed * 60000) : base;
      const hours = sleep / 60;

      let score: Plan['score'] = 'recommended';
      let scoreLabel = 'Recommended';
      if (hours >= range.min && hours <= range.max) {
        score = cycles === range.optimalCycles ? 'optimal' : 'recommended';
        scoreLabel = cycles === range.optimalCycles ? 'Optimal Rest Peak' : 'Healthy Target Range';
      } else if (hours < range.min) {
        score = 'short';
        scoreLabel = 'Short Sleep (Sleep Debt Risk)';
      } else {
        score = 'long';
        scoreLabel = 'Extended Duration';
      }

      const efficiencyPercent = Math.min(98, Math.max(76, Math.round(93 + (cycles === 5 ? 4 : cycles === 6 ? 3 : -7))));
      const inertiaRisk: Plan['inertiaRisk'] = 'low';

      return {
        id: `plan-${cycles}c-${bed.getTime()}`,
        cycles,
        sleepMinutes: sleep,
        inBedMinutes: inBed,
        bedtime: bed,
        wakeTime: wake,
        score,
        scoreLabel,
        efficiencyPercent,
        inertiaRisk,
        stageSummary: `${Math.round(sleep * 0.5)}m Light · ${Math.round(sleep * 0.25)}m Deep SWS · ${Math.round(sleep * 0.25)}m REM`
      };
    }).sort((a, b) => {
      if (a.score === 'optimal') return -1;
      if (b.score === 'optimal') return 1;
      return b.cycles - a.cycles;
    });
  });

  // Best Recommended Plan
  readonly bestPlan = computed<Plan>(() => {
    const list = this.plans();
    const optimal = list.find(p => p.score === 'optimal');
    if (optimal) return optimal;
    const recommended = list.find(p => p.score === 'recommended');
    if (recommended) return recommended;
    return list[0];
  });

  // Active Plan being simulated
  readonly activePlan = computed<Plan>(() => {
    return this.selectedPlanForSim() ?? this.bestPlan();
  });

  // Astronomy and Circadian Science Insights
  readonly astronomyInsight = computed(() => {
    const loc = this.locationService.selectedLocation();
    const plan = this.activePlan();
    const bedState = getCelestialState(plan.bedtime, loc.latitude, loc.longitude, loc.timezone);
    const wakeState = getCelestialState(plan.wakeTime, loc.latitude, loc.longitude, loc.timezone);
    const moon = bedState.moon;
    const sunset = bedState.solarEvents.sunset;
    const sunrise = wakeState.solarEvents.sunrise;
    const solarNoon = bedState.solarEvents.solarNoon;
    const solarMidnight = solarNoon ? new Date(solarNoon.getTime() + 12 * 3600000) : null;

    const bedAfterSunset = sunset ? Math.round((plan.bedtime.getTime() - sunset.getTime()) / 60000) : null;
    const wakeBeforeSunrise = sunrise ? Math.round((sunrise.getTime() - plan.wakeTime.getTime()) / 60000) : null;

    let circadianAlignment = 'Aligned with natural darkness';
    if (bedAfterSunset !== null && bedAfterSunset < 0) {
      circadianAlignment = 'Bedtime precedes sunset (daylight circadian friction)';
    } else if (wakeBeforeSunrise !== null && wakeBeforeSunrise < -60) {
      circadianAlignment = 'Waking in full daylight; morning photons set biological clock';
    }

    return {
      moonPhase: moon.phaseName,
      moonIllumination: Math.round(moon.illuminationFraction * 100),
      moonAltitude: Math.round(moon.altitudeDeg),
      sunBedAlt: Math.round(bedState.sun.altitudeDeg),
      sunWakeAlt: Math.round(wakeState.sun.altitudeDeg),
      bedAfterSunset,
      wakeBeforeSunrise,
      solarMidnight: solarMidnight ? this.formatTime(solarMidnight) : '01:15 AM',
      circadianAlignment,
      melatoninPeakWindow: solarMidnight
        ? `${this.formatTime(new Date(solarMidnight.getTime() - 90 * 60000))} – ${this.formatTime(new Date(solarMidnight.getTime() + 90 * 60000))}`
        : '01:30 AM – 04:00 AM'
    };
  });

  // Simulation Timeline State
  readonly simulatedInstant = computed<Date>(() => {
    const plan = this.activePlan();
    const start = plan.bedtime.getTime();
    const end = plan.wakeTime.getTime();
    const progress = this.simulationProgress();
    return new Date(start + (end - start) * progress);
  });

  readonly simulatedState = computed(() => {
    const instant = this.simulatedInstant();
    const plan = this.activePlan();
    const progress = this.simulationProgress();
    const loc = this.locationService.selectedLocation();
    const cel = getCelestialState(instant, loc.latitude, loc.longitude, loc.timezone);

    const totalMinutes = plan.inBedMinutes;
    const elapsedMinutes = Math.round(totalMinutes * progress);
    const latencyMin = this.latency();

    let stage: 'Latency' | 'N1 Light' | 'N2 Light' | 'N3 Deep' | 'REM' | 'Awake' = 'Latency';
    let stageDescription = 'Settling into sleep latency buffer';
    let brainwaves = 'Alpha/Beta 12–20 Hz';
    let cycleNumber = 1;
    let hormoneState = { melatonin: 25, cortisol: 12, temperatureDropC: 0.1, adenosineClearance: 5 };

    if (elapsedMinutes < latencyMin) {
      stage = 'Latency';
      stageDescription = `Sleep latency buffer (${elapsedMinutes} of ${latencyMin} min)`;
      brainwaves = 'Alpha wave drowsiness (8–12 Hz)';
      hormoneState = { melatonin: 45, cortisol: 14, temperatureDropC: 0.15, adenosineClearance: 8 };
    } else {
      const sleepElapsed = elapsedMinutes - latencyMin;
      const cycleLen = this.cycleLengthMinutes();
      cycleNumber = Math.min(plan.cycles, Math.floor(sleepElapsed / cycleLen) + 1);
      const minInCycle = sleepElapsed % cycleLen;

      // Realistic hypnogram architecture: Early cycles have heavy N3 Deep; later cycles have heavy REM
      const isEarly = cycleNumber <= 2;
      const deepDuration = isEarly ? 34 : 12;
      const remDuration = isEarly ? 14 : 32;

      if (minInCycle < 8) {
        stage = 'N1 Light';
        stageDescription = `Cycle ${cycleNumber}: N1 Theta transition, hypnagogic calm`;
        brainwaves = 'Theta waves (4–8 Hz)';
      } else if (minInCycle < 8 + deepDuration) {
        stage = 'N3 Deep';
        stageDescription = `Cycle ${cycleNumber}: N3 Slow-Wave Sleep (Delta waves, cellular repair, growth hormone)`;
        brainwaves = 'High-amplitude Delta (0.5–4 Hz)';
      } else if (minInCycle < cycleLen - remDuration) {
        stage = 'N2 Light';
        stageDescription = `Cycle ${cycleNumber}: N2 Sleep Spindles, sensory gating, motor consolidation`;
        brainwaves = 'Sigma sleep spindles & K-complexes (11–16 Hz)';
      } else {
        stage = 'REM';
        stageDescription = `Cycle ${cycleNumber}: REM Dreaming, emotional synthesis, creative insight`;
        brainwaves = 'Fast desynchronized low-voltage mixed waves';
      }

      // Hormonal simulation
      const midPoint = 0.48;
      const distFromMid = Math.abs(progress - midPoint);
      const melatonin = Math.round(Math.max(12, 96 - distFromMid * 175));
      const cortisol = progress > 0.82
        ? Math.round(24 + (progress - 0.82) * 420) // Cortisol Awakening Response surge
        : Math.round(8 + Math.sin(progress * Math.PI) * 16);
      const tempDrop = parseFloat((Math.min(1.1, Math.sin(progress * Math.PI * 0.9) * 0.98)).toFixed(2));
      const adenosine = Math.round(Math.min(100, 10 + progress * 88));

      hormoneState = { melatonin, cortisol, temperatureDropC: tempDrop, adenosineClearance: adenosine };
    }

    return {
      clockTime: this.formatTime(instant),
      elapsedMinutes,
      totalMinutes,
      progressPercent: Math.round(progress * 100),
      stage,
      stageDescription,
      brainwaves,
      cycleNumber,
      totalCycles: plan.cycles,
      sunAltitude: cel.sun.altitudeDeg.toFixed(1),
      skyCondition: cel.sun.altitudeDeg < -18 ? 'Astronomical Night' : cel.sun.altitudeDeg < -6 ? 'Twilight' : 'Dawn Horizon',
      ...hormoneState
    };
  });

  // Hypnogram Curve Data for SVG Display
  readonly hypnogramPath = computed(() => {
    const plan = this.activePlan();
    const cycleCount = Math.max(1, plan.cycles);
    const latencyFrac = this.latency() / plan.inBedMinutes;
    const sleepFrac = 1 - latencyFrac;

    // Y values: 15 = Awake, 45 = REM, 75 = Light (N1/N2), 105 = Deep (N3)
    let d = `M 0 15 L ${latencyFrac * 100} 15`;

    for (let c = 0; c < cycleCount; c++) {
      const cycleStart = latencyFrac * 100 + (c / cycleCount) * sleepFrac * 100;
      const cycleWidth = (1 / cycleCount) * sleepFrac * 100;

      const isEarly = c < 2;
      const n3Width = isEarly ? cycleWidth * 0.42 : cycleWidth * 0.16;
      const n2Width1 = cycleWidth * 0.18;
      const remWidth = isEarly ? cycleWidth * 0.15 : cycleWidth * 0.38;
      const n2Width2 = cycleWidth - (n2Width1 + n3Width + remWidth);

      const p1 = cycleStart;
      const p2 = p1 + n2Width1;
      const p3 = p2 + n3Width;
      const p4 = p3 + n2Width2;
      const p5 = cycleStart + cycleWidth;

      d += ` L ${p1} 75 L ${p2} 105 L ${p3} 75 L ${p4} 45 L ${p5} 15`;
    }

    return d;
  });

  // Share modal plan wrapper
  readonly shareSleepPlan = computed<ShareSleepPlan>(() => {
    const p = this.activePlan();
    return {
      bedtime: p.bedtime,
      wakeTime: p.wakeTime,
      sleepMinutes: p.sleepMinutes,
      cycles: p.cycles,
      inBedMinutes: p.inBedMinutes
    };
  });

  constructor() {
    effect(() => {
      if (this.isSimulating()) {
        this.restartSimTimer();
      }
    });
  }

  ngOnInit(): void {
    this.title.setTitle('Sleep Calculator — Astronomical Circadian Sleep Engine | 2piClock');
    this.meta.updateTag({
      name: 'description',
      content: 'Scientific 90-minute sleep cycle calculator with real-time circadian sky simulation, fall-asleep latency customization, chronotype guidance, and history.'
    });

    if (isPlatformBrowser(this.platformId)) {
      this.loadHistory();
      this.syncFromCurrentTime();
    }
  }

  ngOnDestroy(): void {
    this.stopSimulation();
    if (this.toastTimer) clearTimeout(this.toastTimer);
  }

  // User Actions
  setMode(m: Mode): void {
    this.mode.set(m);
    if (m === 'now') {
      this.syncFromCurrentTime();
    }
    this.showToast('Mode Switched', `Active calculation mode: ${this.modeLabel(m)}`, 'schedule');
  }

  setAge(a: Age): void {
    this.age.set(a);
    const r = this.targetRange();
    this.showToast('Profile Updated', `Target sleep range: ${r.label}`, 'person');
  }

  setChronotype(c: Chronotype): void {
    this.chronotype.set(c);
    const label = c === 'lark' ? 'Morning Lark' : c === 'wolf' ? 'Night Owl' : 'Intermediate Bear';
    this.showToast('Chronotype Set', `Calibrated for ${label} circadian peak`, 'wb_twilight');
  }

  setLatency(min: number): void {
    this.latency.set(min);
    this.showToast('Latency Adjusted', `Calculations include ${min} min fall-asleep buffer`, 'bedtime');
  }

  setCycleLength(min: number): void {
    this.cycleLengthMinutes.set(min);
    this.showToast('Ultradian Length', `Ultradian cycle length set to ${min} minutes`, 'tune');
  }

  onWakeInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) this.wakeTime.set(val);
  }

  onBedInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) this.bedtime.set(val);
  }

  syncFromCurrentTime(): void {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 10);
    this.wakeTime.set(this.formatInputTime(new Date(Date.now() + 7.5 * 3600000)));
    this.bedtime.set(this.formatInputTime(new Date()));
  }

  selectPlanForSimulation(p: Plan): void {
    this.selectedPlanForSim.set(p);
    this.simulationProgress.set(0);
    this.showToast('Simulator Loaded', `Active night: ${p.cycles} cycles (${this.formatDuration(p.sleepMinutes)})`, 'play_circle');
  }

  toggleSimulation(): void {
    if (this.isSimulating()) {
      this.stopSimulation();
      this.showToast('Simulation Paused', 'Night flight paused', 'pause');
    } else {
      if (this.simulationProgress() >= 0.99) {
        this.simulationProgress.set(0);
      }
      this.isSimulating.set(true);
      this.restartSimTimer();
      this.showToast('Simulation Active', `Simulating night over ${this.locationService.selectedLocation().name}`, 'play_arrow');
    }
  }

  stopSimulation(): void {
    this.isSimulating.set(false);
    if (this.simIntervalId) {
      clearInterval(this.simIntervalId);
      this.simIntervalId = null;
    }
  }

  private restartSimTimer(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.simIntervalId) clearInterval(this.simIntervalId);

    const stepMs = 50;
    const increment = (stepMs / 1000) * (this.simulationSpeed() / 240);

    this.simIntervalId = setInterval(() => {
      const next = this.simulationProgress() + increment;
      if (next >= 1) {
        this.simulationProgress.set(1);
        this.stopSimulation();
        this.showToast('Wake Horizon Reached', 'Simulated morning alarm triggered at cycle end', 'alarm');
      } else {
        this.simulationProgress.set(next);
      }
    }, stepMs);
  }

  seekSimulation(percent: number): void {
    this.simulationProgress.set(Math.max(0, Math.min(1, percent)));
  }

  onScrubberInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.seekSimulation(parseFloat(target.value));
  }

  jumpToSimulationMilestone(fraction: number, label: string): void {
    this.seekSimulation(fraction);
    this.showToast('Milestone', `Jumped to ${label}`, 'skip_next');
  }

  resetSimulation(): void {
    this.stopSimulation();
    this.simulationProgress.set(0);
    this.showToast('Rewound', 'Returned to bedtime lights-out', 'skip_previous');
  }

  jumpToWake(): void {
    this.stopSimulation();
    this.simulationProgress.set(1);
    this.showToast('Wake Time', 'Jumped to awakening moment', 'alarm');
  }

  setSpeed(speed: number): void {
    this.simulationSpeed.set(speed);
  }

  // History & Storage
  savePlan(p: Plan): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const loc = this.locationService.selectedLocation();
    const entry: HistoryEntry = {
      id: Date.now(),
      createdAt: new Date().toISOString(),
      mode: this.mode(),
      title: `${p.cycles} Cycles (${this.formatDuration(p.sleepMinutes)})`,
      bedtime: p.bedtime.toISOString(),
      wakeTime: p.wakeTime.toISOString(),
      sleepMinutes: p.sleepMinutes,
      inBedMinutes: p.inBedMinutes,
      cycles: p.cycles,
      age: this.age(),
      chronotype: this.chronotype(),
      location: loc.name,
      timezone: loc.timezone
    };

    const next = [entry, ...this.history().filter(h => h.id !== entry.id)].slice(0, 30);
    this.history.set(next);
    localStorage.setItem('2piclock-sleep-history', JSON.stringify(next));

    this.showToast('Plan Bookmarked', `Saved to history: ${this.formatTime(p.bedtime)} → ${this.formatTime(p.wakeTime)}`, 'bookmark_added');
  }

  restoreHistory(entry: HistoryEntry): void {
    this.mode.set(entry.mode);
    this.age.set(entry.age);
    this.chronotype.set(entry.chronotype);

    const b = new Date(entry.bedtime);
    const w = new Date(entry.wakeTime);
    this.bedtime.set(this.formatInputTime(b));
    this.wakeTime.set(this.formatInputTime(w));

    this.showToast('Plan Restored', `Restored ${entry.title} for ${entry.location}`, 'history');
  }

  deleteHistoryEntry(id: number, event: Event): void {
    event.stopPropagation();
    const next = this.history().filter(h => h.id !== id);
    this.history.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('2piclock-sleep-history', JSON.stringify(next));
    }
    this.showToast('Entry Deleted', 'Removed plan from history', 'delete_outline');
  }

  clearHistory(): void {
    this.history.set([]);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('2piclock-sleep-history');
    }
    this.showToast('History Cleared', 'All saved sleep history cleared', 'delete_sweep');
  }

  copySchedule(p: Plan, event?: Event): void {
    if (event) event.stopPropagation();
    if (!isPlatformBrowser(this.platformId)) return;

    const loc = this.locationService.selectedLocation();
    const text = `2piClock Sleep Plan (${p.cycles} cycles · ${this.formatDuration(p.sleepMinutes)} sleep)
Bedtime: ${this.formatTime(p.bedtime)}
Wake Time: ${this.formatTime(p.wakeTime)}
In-bed Duration: ${this.formatDuration(p.inBedMinutes)} (includes ${this.latency()}m latency)
Location: ${loc.name}, ${loc.country} (${loc.timezone})
Calculated via 2piClock astronomical sleep engine`;

    void navigator.clipboard.writeText(text).then(() => {
      this.showToast('Schedule Copied', `${this.formatTime(p.bedtime)} → ${this.formatTime(p.wakeTime)}`, 'content_copy');
    }).catch(() => {
      this.showToast('Copy Failed', 'Clipboard permissions denied', 'error');
    });
  }

  downloadIcsFile(p: Plan, event?: Event): void {
    if (event) event.stopPropagation();
    if (!isPlatformBrowser(this.platformId)) return;

    const formatIcsDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const loc = this.locationService.selectedLocation();
    const nowStr = formatIcsDate(new Date());
    const startStr = formatIcsDate(p.bedtime);
    const endStr = formatIcsDate(p.wakeTime);

    const icsData = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//2piClock//Circadian Sleep Calculator//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:sleep-${p.id}-${Date.now()}@2piclock.app`,
      `DTSTAMP:${nowStr}`,
      `DTSTART:${startStr}`,
      `DTEND:${endStr}`,
      `SUMMARY:Sleep: ${p.cycles} Cycles (${this.formatDuration(p.sleepMinutes)})`,
      `DESCRIPTION:2piClock Sleep Plan\\nBedtime: ${this.formatTime(p.bedtime)}\\nWake Time: ${this.formatTime(p.wakeTime)}\\nCycles: ${p.cycles}\\nLocation: ${loc.name}`,
      `LOCATION:${loc.name}, ${loc.country}`,
      'STATUS:CONFIRMED',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Prepare for Bedtime (Wind Down)',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `2piclock-sleep-plan-${p.cycles}c.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast('Calendar Exported', `Downloaded .ics event for ${this.formatTime(p.wakeTime)} alarm`, 'event_available');
  }

  // Toast Notification System
  showToast(title: string, message: string, icon = 'info'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    const id = Date.now();
    this.toast.set({ id, title, message, icon });
    this.toastTimer = setTimeout(() => {
      if (this.toast()?.id === id) {
        this.toast.set(null);
      }
    }, 4000);
  }

  dismissToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toast.set(null);
  }

  formatHistoryTime(isoString: string, timezone?: string): string {
    const d = new Date(isoString);
    return this.formatTime(d, timezone || this.locationService.selectedLocation().timezone);
  }

  // Helpers
  private loadHistory(): void {
    try {
      const stored = localStorage.getItem('2piclock-sleep-history');
      if (stored) {
        this.history.set(JSON.parse(stored));
      }
    } catch {
      // Local storage unavailable
    }
  }

  private generateSleepNowPlans(): Plan[] {
    const now = new Date();
    const lat = this.latency();
    const cycleLen = this.cycleLengthMinutes();
    const range = this.targetRange();

    return [5, 6, 4, 7, 3].map(cycles => {
      const sleep = cycles * cycleLen;
      const inBed = sleep + lat;
      const wake = new Date(now.getTime() + inBed * 60000);
      const hours = sleep / 60;

      let score: Plan['score'] = 'recommended';
      let scoreLabel = 'Recommended';
      if (hours >= range.min && hours <= range.max) {
        score = cycles === range.optimalCycles ? 'optimal' : 'recommended';
        scoreLabel = cycles === range.optimalCycles ? 'Optimal Rest Peak' : 'Healthy Target Range';
      } else if (hours < range.min) {
        score = 'short';
        scoreLabel = 'Short Sleep (Sleep Debt Risk)';
      } else {
        score = 'long';
        scoreLabel = 'Extended Duration';
      }

      return {
        id: `plan-now-${cycles}c`,
        cycles,
        sleepMinutes: sleep,
        inBedMinutes: inBed,
        bedtime: now,
        wakeTime: wake,
        score,
        scoreLabel,
        efficiencyPercent: Math.min(98, Math.max(78, Math.round(93 + (cycles === 5 ? 4 : -6)))),
        inertiaRisk: 'low' as Plan['inertiaRisk'],
        stageSummary: `${Math.round(sleep * 0.5)}m Light · ${Math.round(sleep * 0.25)}m Deep SWS · ${Math.round(sleep * 0.25)}m REM`
      };
    }).sort((a, b) => {
      if (a.score === 'optimal') return -1;
      if (b.score === 'optimal') return 1;
      return b.cycles - a.cycles;
    });
  }

  private generateNapPlans(): Plan[] {
    const now = new Date();
    const lat = Math.min(8, this.latency());

    const naps: { name: string; sleepMin: number; type: Plan['napType']; desc: string }[] = [
      { name: 'NASA 20-min Power Nap', sleepMin: 20, type: 'power', desc: 'Stage 2 light sleep alertness surge; +34% reaction performance, zero sleep inertia' },
      { name: '25-min Caffeine Nap (Nappuccino)', sleepMin: 25, type: 'caffeine', desc: 'Drink espresso before sleep; caffeine binds to receptors right as adenosine clears' },
      { name: '45-min Slow-Wave Nap', sleepMin: 45, type: 'refresh', desc: 'Deep physical reset for muscle recovery; allow 10 min for mild grogginess dissipation' },
      { name: '90-min Full Cycle Nap', sleepMin: 90, type: 'cycle', desc: 'Complete NREM + REM cycle; enhances creative problem solving & procedural memory' },
      { name: '120-min Shift Work Reset', sleepMin: 120, type: 'recovery', desc: 'Deep debt recovery for night-shift workers or severe sleep deprivation' }
    ];

    return naps.map(n => {
      const inBed = n.sleepMin + lat;
      const wake = new Date(now.getTime() + inBed * 60000);
      return {
        id: `nap-${n.type}`,
        cycles: parseFloat((n.sleepMin / 90).toFixed(1)),
        sleepMinutes: n.sleepMin,
        inBedMinutes: inBed,
        bedtime: now,
        wakeTime: wake,
        score: n.type === 'power' || n.type === 'cycle' ? 'optimal' : 'recommended',
        scoreLabel: n.name,
        efficiencyPercent: 96,
        inertiaRisk: n.type === 'refresh' ? 'moderate' : 'low',
        stageSummary: n.desc,
        napType: n.type
      };
    });
  }

  formatTime(d: Date, timezone = this.locationService.selectedLocation().timezone): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(d);
  }

  formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    return `${h}h${m ? ' ' + m + 'm' : ''}`;
  }

  modeLabel(m: Mode): string {
    switch (m) {
      case 'wake': return 'Wake Up Target';
      case 'bed': return 'Planned Bedtime';
      case 'now': return 'Sleep Right Now';
      case 'nap': return 'Power Nap Architect';
    }
  }

  private parseTime(v: string): Date {
    const [h, m] = v.split(':').map(Number);
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    if (d.getTime() <= Date.now()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  private formatInputTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
}
