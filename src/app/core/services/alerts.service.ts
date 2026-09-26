import { Injectable, computed, inject, signal } from '@angular/core';
import { CelestialService } from './celestial.service';
import { LocationService } from './location.service';
import { TimeControlService } from './time-control.service';
import { AlertItem } from '../models/alerts.model';

@Injectable({
  providedIn: 'root'
})
export class AlertsService {
  private celestialService = inject(CelestialService);
  private locationService = inject(LocationService);
  private timeControlService = inject(TimeControlService);

  readonly currentWeather = this.celestialService.currentWeather;
  readonly celestialState = this.celestialService.celestialState;
  readonly atmosphericState = this.celestialService.atmosphericState;
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly activeDate = this.timeControlService.currentActiveDate;

  // Custom simulation trigger for testing real-time warnings
  readonly simulatedAlert = signal<AlertItem | null>(null);

  /**
   * Sound chime enable setting for critical alerts
   */
  readonly audioEnabled = signal<boolean>(false);

  toggleAudio(): void {
    this.audioEnabled.update(v => !v);
  }

  setSimulatedAlert(alert: AlertItem | null): void {
    this.simulatedAlert.set(alert);
  }

  clearSimulatedAlert(): void {
    this.simulatedAlert.set(null);
  }

  /**
   * Primary computed list of real-time alerts evaluated dynamically from weather + celestial telemetry
   */
  readonly liveAlerts = computed<AlertItem[]>(() => {
    const alerts: AlertItem[] = [];
    const w = this.currentWeather();
    const c = this.celestialState();
    const atm = this.atmosphericState();
    const loc = this.selectedLocation();
    const now = this.activeDate();
    const locName = loc ? `${loc.name}, ${loc.country}` : 'Current Location';
    const coords = loc ? `${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°` : '0.0°, 0.0°';

    if (!w) return alerts;

    // -------------------------------------------------------------
    // 1. SEVERE WEATHER ALERTS
    // -------------------------------------------------------------
    // A. Thunderstorm & Lightning Warning
    if (
      w.condition === 'thunderstorm' ||
      w.condition === 'severe_storm' ||
      w.condition === 'severe_thunderstorm'
    ) {
      alerts.push({
        id: `wt-lightning-${now.getTime()}`,
        title: 'Severe Thunderstorm & Lightning Warning',
        category: 'weather',
        categoryLabel: 'Severe Weather',
        severity: 'critical',
        severityLabel: 'Critical Warning',
        description: `Severe convective thunderstorm activity detected in ${loc.name}. Frequent cloud-to-ground lightning bolts and atmospheric turbulence present.`,
        safetyAdvice: 'Seek sturdy shelter immediately. Stay clear of high ground, tall trees, and electrical apparatus.',
        metricLabel: 'Storm Index',
        metricValue: `${w.aggressivenessIndex}/100 · ${w.lightningFrequencyPerMin ?? 18} strikes/min`,
        issuedAt: now,
        locationName: locName,
        coordinates: coords,
        icon: 'thunderstorm',
        badgeBg: 'rgba(239, 68, 68, 0.25)',
        badgeColor: '#f87171',
        cardBorderColor: 'rgba(239, 68, 68, 0.5)'
      });
    }

    // B. Gale / High Wind Warning
    if (w.windSpeedKmh > 40 || (w.windGustKmh ?? 0) > 55) {
      const isExtreme = w.windSpeedKmh > 65 || (w.windGustKmh ?? 0) > 85;
      alerts.push({
        id: `wt-wind-${now.getTime()}`,
        title: isExtreme ? 'Severe Gale & Hurricane Gust Warning' : 'High Wind & Gale Advisory',
        category: 'weather',
        categoryLabel: 'Severe Weather',
        severity: isExtreme ? 'critical' : 'advisory',
        severityLabel: isExtreme ? 'Critical Warning' : 'Advisory',
        description: `High surface wind velocity in ${loc.name} with sustained speeds of ${w.windSpeedKmh} km/h and peak gusts up to ${w.windGustKmh ?? w.windSpeedKmh} km/h.`,
        safetyAdvice: 'Secure loose outdoor structures. Maritime vessels should seek harbor. Drive with extreme caution.',
        metricLabel: 'Wind / Gusts',
        metricValue: `${w.windSpeedKmh} km/h (Gusts: ${w.windGustKmh ?? w.windSpeedKmh} km/h)`,
        issuedAt: now,
        locationName: locName,
        coordinates: coords,
        icon: 'air',
        badgeBg: isExtreme ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.25)',
        badgeColor: isExtreme ? '#f87171' : '#fbbf24',
        cardBorderColor: isExtreme ? 'rgba(239, 68, 68, 0.5)' : 'rgba(245, 158, 11, 0.4)'
      });
    }

    // C. Heavy Rain & Flash Flood Watch
    if (
      w.condition === 'heavy_rain' ||
      w.condition === 'heavy_downpour' ||
      w.condition === 'monsoon' ||
      w.condition === 'tropical_storm' ||
      w.rainMm > 15
    ) {
      alerts.push({
        id: `wt-flood-${now.getTime()}`,
        title: 'Heavy Rainfall & Flash Flood Watch',
        category: 'weather',
        categoryLabel: 'Precipitation',
        severity: 'watch',
        severityLabel: 'Watch',
        description: `Intense precipitation rate (${w.rainMm || 18} mm/h) detected across ${loc.name}. Rapid runoff may cause urban waterlogging and river swell.`,
        safetyAdvice: 'Do not walk or drive through flooded roadways. Avoid low-lying riverbanks and underpasses.',
        metricLabel: 'Rain Accumulation',
        metricValue: `${w.rainMm || 18} mm/h (${w.precipitationPct}% probability)`,
        issuedAt: now,
        locationName: locName,
        coordinates: coords,
        icon: 'water_drop',
        badgeBg: 'rgba(59, 130, 246, 0.25)',
        badgeColor: '#60a5fa',
        cardBorderColor: 'rgba(59, 130, 246, 0.45)'
      });
    }

    // D. Winter Blizzard & Freezing Ice Warning
    if (
      w.condition === 'blizzard' ||
      w.condition === 'heavy_snow' ||
      w.condition === 'freezing_rain' ||
      w.condition === 'sleet'
    ) {
      alerts.push({
        id: `wt-blizzard-${now.getTime()}`,
        title: 'Severe Winter Blizzard & Ice Freeze Warning',
        category: 'weather',
        categoryLabel: 'Winter Weather',
        severity: 'critical',
        severityLabel: 'Critical Warning',
        description: `Dangerous winter storm conditions in ${loc.name}. Blowing snow and glaze ice causing near-zero visibility and hazardous roads.`,
        safetyAdvice: 'Avoid unnecessary travel. Ensure heating devices operate safely and keep emergency thermal kits ready.',
        metricLabel: 'Temperature & Frost',
        metricValue: `${w.temperatureC}°C · Frost Level: ${w.winterFrostLevel ?? 85}%`,
        issuedAt: now,
        locationName: locName,
        coordinates: coords,
        icon: 'ac_unit',
        badgeBg: 'rgba(56, 189, 248, 0.25)',
        badgeColor: '#38bdf8',
        cardBorderColor: 'rgba(56, 189, 248, 0.5)'
      });
    }

    // E. Dense Fog & Visibility Advisory
    if (w.visibilityKm < 1.5 || w.condition === 'fog' || w.condition === 'freezing_fog') {
      alerts.push({
        id: `wt-fog-${now.getTime()}`,
        title: 'Dense Fog & Low Visibility Advisory',
        category: 'weather',
        categoryLabel: 'Visibility',
        severity: 'advisory',
        severityLabel: 'Advisory',
        description: `Widespread thick radiation fog reducing optical range to ${w.visibilityKm.toFixed(1)} km across ${loc.name}.`,
        safetyAdvice: 'Use low-beam headlights when driving. Maintain extended trailing distance on highways.',
        metricLabel: 'Optical Range',
        metricValue: `${w.visibilityKm.toFixed(1)} km (${w.humidityPct}% humidity)`,
        issuedAt: now,
        locationName: locName,
        coordinates: coords,
        icon: 'blur_on',
        badgeBg: 'rgba(148, 163, 184, 0.22)',
        badgeColor: '#cbd5e1',
        cardBorderColor: 'rgba(148, 163, 184, 0.35)'
      });
    }

    // F. Extreme Heat Wave & UV Hazard
    if (w.temperatureC >= 34 || w.uvIndex >= 8) {
      alerts.push({
        id: `wt-heat-${now.getTime()}`,
        title: w.uvIndex >= 10 ? 'Extreme Heat & Extreme UV Alert' : 'Heat Advisory & High UV Warning',
        category: 'weather',
        categoryLabel: 'Extreme Temperature',
        severity: w.uvIndex >= 10 ? 'critical' : 'advisory',
        severityLabel: w.uvIndex >= 10 ? 'Critical Warning' : 'Advisory',
        description: `Extreme heat index (${w.temperatureC}°C, feels like ${w.feelsLikeC}°C) and UV index of ${w.uvIndex} in ${loc.name}.`,
        safetyAdvice: 'Stay hydrated, apply SPF 50+ sunscreen, and minimize direct sun exposure between 10:00 and 16:00.',
        metricLabel: 'Temperature & UV',
        metricValue: `${w.temperatureC}°C (Feels: ${w.feelsLikeC}°C) · UV: ${w.uvIndex}`,
        issuedAt: now,
        locationName: locName,
        coordinates: coords,
        icon: 'sunny',
        badgeBg: 'rgba(249, 115, 22, 0.25)',
        badgeColor: '#fb923c',
        cardBorderColor: 'rgba(249, 115, 22, 0.45)'
      });
    }

    // -------------------------------------------------------------
    // 2. ASTRONOMICAL & SPACE WEATHER ALERTS
    // -------------------------------------------------------------
    // A. Geomagnetic Storm / Aurora Borealis Warning
    const Kp = calculateEstimatedKp(now, loc.latitude, atm.auroraActivity);
    if (Kp >= 5 || atm.auroraActivity > 0.35) {
      const stormClass = Kp >= 7 ? 'G3-G5 Severe Geomagnetic Storm' : 'G1-G2 Geomagnetic Storm Watch';
      alerts.push({
        id: `ast-aurora-${now.getTime()}`,
        title: `${stormClass} & Aurora Warning`,
        category: 'space_weather',
        categoryLabel: 'Space Weather',
        severity: Kp >= 7 ? 'critical' : 'watch',
        severityLabel: Kp >= 7 ? 'Critical Warning' : 'Watch',
        description: `Enhanced solar coronal mass ejection (CME) shockwave interacting with Earth magnetosphere. Auroral oval visible at lower latitudes (${loc.latitude.toFixed(1)}°).`,
        safetyAdvice: 'Prime observation hours tonight. High-altitude GPS & HF radio communications may experience minor scintillation.',
        metricLabel: 'Planetary Kp Index',
        metricValue: `Kp ${Kp.toFixed(1)} (${(atm.auroraActivity * 100).toFixed(0)}% Aurora Activity)`,
        issuedAt: now,
        locationName: locName,
        coordinates: coords,
        icon: 'flare',
        badgeBg: 'rgba(168, 85, 247, 0.25)',
        badgeColor: '#c084fc',
        cardBorderColor: 'rgba(168, 85, 247, 0.5)'
      });
    }

    // B. Solar / Lunar Eclipse Warning
    if (atm.isEclipse || c.solarEvents.isPolarDay || c.solarEvents.isPolarNight) {
      if (atm.isEclipse) {
        const isSolar = atm.eclipseType === 'solar';
        alerts.push({
          id: `ast-eclipse-${now.getTime()}`,
          title: isSolar ? 'Solar Eclipse Obscuration Warning' : 'Lunar Eclipse / Blood Moon Active',
          category: 'eclipse',
          categoryLabel: 'Astronomical Event',
          severity: 'warning',
          severityLabel: 'Warning',
          description: `An active ${atm.eclipseType || 'solar'} eclipse is geometrically occurring over ${loc.name}. Maximum obscuration estimated at ${((atm.eclipseObscuration || 0.85) * 100).toFixed(0)}%.`,
          safetyAdvice: isSolar
            ? 'CRITICAL: Never look directly at the Sun without ISO 12312-2 certified solar viewing glasses.'
            : 'Unfiltered naked-eye observation is completely safe during lunar eclipses.',
          metricLabel: 'Obscuration Rate',
          metricValue: `${((atm.eclipseObscuration || 0.85) * 100).toFixed(0)}% ${atm.eclipseType || 'solar'} shadow`,
          issuedAt: now,
          locationName: locName,
          coordinates: coords,
          icon: 'wb_twilight',
          badgeBg: 'rgba(236, 72, 153, 0.25)',
          badgeColor: '#f472b6',
          cardBorderColor: 'rgba(236, 72, 153, 0.5)'
        });
      }
    }

    // C. Stargazing Condition & Sky Transparency
    const isNight = !c.sun.isAboveHorizon && c.twilightState === 'night';
    if (isNight) {
      if (w.cloudCoverPct > 85) {
        alerts.push({
          id: `ast-cloud-block-${now.getTime()}`,
          title: 'Stargazing Cloud Obstruction Warning',
          category: 'stargazing',
          categoryLabel: 'Night Observation',
          severity: 'info',
          severityLabel: 'Notice',
          description: `Heavy cloud deck (${w.cloudCoverPct}% cover) blocking deep sky object observation and stellar transparency in ${loc.name}.`,
          safetyAdvice: 'Plan deep-sky photography for upcoming clear sky windows.',
          metricLabel: 'Cloud Obstruction',
          metricValue: `${w.cloudCoverPct}% Overcast`,
          issuedAt: now,
          locationName: locName,
          coordinates: coords,
          icon: 'cloud_off',
          badgeBg: 'rgba(100, 116, 139, 0.22)',
          badgeColor: '#94a3b8',
          cardBorderColor: 'rgba(100, 116, 139, 0.35)'
        });
      } else if (w.cloudCoverPct <= 10 && c.moon.illuminationFraction < 0.25) {
        alerts.push({
          id: `ast-dark-sky-${now.getTime()}`,
          title: 'Prime Dark Sky & Milky Way Observation Window',
          category: 'stargazing',
          categoryLabel: 'Astrophotography',
          severity: 'info',
          severityLabel: 'Prime Conditions',
          description: `Exceptional clear night conditions in ${loc.name}! Low cloud cover (${w.cloudCoverPct}%) combined with minimal lunar light pollution (${(c.moon.illuminationFraction * 100).toFixed(0)}% Moon).`,
          safetyAdvice: 'Ideal night for wide-field galaxy imaging, nebulae, and stellar photography.',
          metricLabel: 'Sky Quality',
          metricValue: `Bortle 2-3 Dark Sky · ${(c.starVisibilityFraction * 100).toFixed(0)}% Clarity`,
          issuedAt: now,
          locationName: locName,
          coordinates: coords,
          icon: 'auto_awesome',
          badgeBg: 'rgba(16, 185, 129, 0.25)',
          badgeColor: '#34d399',
          cardBorderColor: 'rgba(16, 185, 129, 0.45)'
        });
      }
    }

    // D. Meteor Shower Activity Alert
    const activeMeteorShower = getActiveMeteorShower(now);
    if (activeMeteorShower) {
      alerts.push({
        id: `ast-meteor-${activeMeteorShower.code}-${now.getTime()}`,
        title: `${activeMeteorShower.name} Meteor Shower Peak`,
        category: 'astronomy',
        categoryLabel: 'Meteor Shower',
        severity: 'advisory',
        severityLabel: 'Advisory',
        description: `The ${activeMeteorShower.name} is currently active in the night sky over ${loc.name}, delivering up to ${activeMeteorShower.zhr} meteors/hour at zenith.`,
        safetyAdvice: `Look towards the constellation ${activeMeteorShower.radiantConstellation} after midnight for best trail visibility.`,
        metricLabel: 'Zenithal Hourly Rate (ZHR)',
        metricValue: `~${activeMeteorShower.zhr} meteors/hour (Radiant: ${activeMeteorShower.radiantConstellation})`,
        issuedAt: now,
        locationName: locName,
        coordinates: coords,
        icon: 'star',
        badgeBg: 'rgba(14, 165, 233, 0.25)',
        badgeColor: '#38bdf8',
        cardBorderColor: 'rgba(14, 165, 233, 0.45)'
      });
    }

    // Append simulated alert if set
    const sim = this.simulatedAlert();
    if (sim) {
      alerts.unshift(sim);
    }

    return alerts;
  });

  readonly criticalCount = computed(() => {
    return this.liveAlerts().filter(a => a.severity === 'critical' || a.severity === 'warning').length;
  });

  readonly totalAlertsCount = computed(() => this.liveAlerts().length);

  /**
   * Play an audible frequency chime for critical warnings using Web Audio API
   */
  playAlertChime(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {
      // Audio autoplay policy fallback
    }
  }
}

/**
 * Estimate planetary Kp index based on time and geomagnetic latitude approximation
 */
function calculateEstimatedKp(date: Date, latitudeDeg: number, auroraActivityScore: number): number {
  const day = date.getUTCDate();
  const month = date.getUTCMonth() + 1;
  const hour = date.getUTCHours();
  
  // Seeded cyclic noise for space weather flux
  const cycle = Math.sin((day * 31 + month * 12 + hour) * 0.4) * 2.2 + 2.8;
  const latFactor = Math.abs(latitudeDeg) > 50 ? 1.4 : 0.8;
  const baseKp = cycle * latFactor + auroraActivityScore * 4;
  return Math.max(1, Math.min(9, Math.round(baseKp * 10) / 10));
}

interface MeteorShower {
  code: string;
  name: string;
  radiantConstellation: string;
  zhr: number;
}

/**
 * Evaluate active major meteor shower based on current month/day
 */
function getActiveMeteorShower(date: Date): MeteorShower | null {
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();

  if (m === 1 && d >= 1 && d <= 5) {
    return { code: 'QUA', name: 'Quadrantids', radiantConstellation: 'Boötes', zhr: 110 };
  }
  if (m === 4 && d >= 16 && d <= 25) {
    return { code: 'LYR', name: 'Lyrids', radiantConstellation: 'Lyra', zhr: 18 };
  }
  if (m === 5 && d >= 1 && d <= 10) {
    return { code: 'ETA', name: 'Eta Aquariids', radiantConstellation: 'Aquarius', zhr: 50 };
  }
  if (m === 8 && d >= 9 && d <= 15) {
    return { code: 'PER', name: 'Perseids', radiantConstellation: 'Perseus', zhr: 100 };
  }
  if (m === 10 && d >= 20 && d <= 25) {
    return { code: 'ORI', name: 'Orionids', radiantConstellation: 'Orion', zhr: 20 };
  }
  if (m === 11 && d >= 16 && d <= 20) {
    return { code: 'LEO', name: 'Leonids', radiantConstellation: 'Leo', zhr: 15 };
  }
  if (m === 12 && d >= 11 && d <= 15) {
    return { code: 'GEM', name: 'Geminids', radiantConstellation: 'Gemini', zhr: 120 };
  }
  return null;
}
