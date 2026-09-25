import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CelestialService } from '../../../core/services/celestial.service';
import { CelestialState } from '../../../core/models/celestial.model';
import { WeatherData } from '../../../core/models/weather.model';

interface Star {
  x: number; // 0 to 1 normalized
  y: number; // 0 to 1 normalized (upper hemisphere)
  radius: number;
  baseBrightness: number;
  flickerSpeed: number;
  flickerPhase: number;
  color: string;
}

interface CloudParticle {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  opacity: number;
  speed: number;
  layer: number;
}

interface PrecipParticle {
  x: number;
  y: number;
  speedY: number;
  speedX: number;
  size: number;
  opacity: number;
  wobblePhase: number;
}

interface LightningBolt {
  points: { x: number; y: number }[];
  alpha: number;
  branches: { points: { x: number; y: number }[]; alpha: number }[];
}

@Component({
  selector: 'app-reactive-sky',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reactive-sky.html',
  styleUrl: './reactive-sky.css'
})
export class ReactiveSkyComponent implements OnInit, OnDestroy {
  @ViewChild('skyCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private celestialService = inject(CelestialService);

  readonly celestial = this.celestialService.celestialState;
  readonly weather = this.celestialService.currentWeather;

  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;

  // Star catalog
  private stars: Star[] = [];
  // Procedural Clouds
  private clouds: CloudParticle[] = [];
  // Precipitation & Blizzard Particles
  private precipParticles: PrecipParticle[] = [];

  // Lightning system for thunderstorms
  private lightningTimer = 0;
  private lightningFlashAlpha = 0;
  private activeLightningBolt: LightningBolt | null = null;

  private reducedMotion = false;

  constructor() {
    if (this.isBrowser) {
      this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
      this.initStars();
      this.initClouds();
      this.initPrecipParticles();
    }
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: false });

    this.setupResizeObserver();
    this.startRenderLoop();
  }

  private resizeHandler: (() => void) | null = null;

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.resizeHandler && typeof window !== 'undefined') {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }
  }

  private setupResizeObserver(): void {
    const canvas = this.canvasRef.nativeElement;
    this.resizeHandler = () => {
      const rect = canvas.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.width = rect.width;
      this.height = rect.height;

      canvas.width = Math.floor(this.width * this.dpr);
      canvas.height = Math.floor(this.height * this.dpr);

      if (this.ctx) {
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      }
    };

    this.resizeHandler();
    window.addEventListener('resize', this.resizeHandler, { passive: true });
  }

  private initStars(): void {
    const starCount = 280;
    this.stars = [];

    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const colors = [
      'rgba(255, 255, 255,',
      'rgba(235, 245, 255,', // Blue-white
      'rgba(255, 240, 220,', // Warm gold
      'rgba(255, 250, 240,'  // Crisp white
    ];

    for (let i = 0; i < starCount; i++) {
      const x = rnd();
      const y = Math.pow(rnd(), 1.3) * 0.88;
      const radius = 0.5 + rnd() * 1.5;
      const baseBrightness = 0.35 + rnd() * 0.65;
      const flickerSpeed = 0.001 + rnd() * 0.004;
      const flickerPhase = rnd() * Math.PI * 2;
      const color = colors[Math.floor(rnd() * colors.length)];

      this.stars.push({
        x,
        y,
        radius,
        baseBrightness,
        flickerSpeed,
        flickerPhase,
        color
      });
    }
  }

  private initClouds(): void {
    this.clouds = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
      this.clouds.push({
        x: Math.random(),
        y: 0.04 + Math.random() * 0.72,
        radiusX: 80 + Math.random() * 180,
        radiusY: 35 + Math.random() * 80,
        opacity: 0.12 + Math.random() * 0.38,
        speed: 0.00003 + Math.random() * 0.0001,
        layer: Math.floor(Math.random() * 3)
      });
    }
  }

  private initPrecipParticles(): void {
    this.precipParticles = [];
    const count = 260;
    for (let i = 0; i < count; i++) {
      this.precipParticles.push({
        x: Math.random(),
        y: Math.random(),
        speedY: 0.007 + Math.random() * 0.015,
        speedX: -0.003 + Math.random() * 0.002,
        size: 1 + Math.random() * 2.5,
        opacity: 0.25 + Math.random() * 0.65,
        wobblePhase: Math.random() * Math.PI * 2
      });
    }
  }

  private startRenderLoop(): void {
    let lastTime = performance.now();

    const render = (time: number) => {
      const delta = Math.min(time - lastTime, 100);
      lastTime = time;

      this.drawScene(time, delta);
      this.animFrameId = requestAnimationFrame(render);
    };

    this.animFrameId = requestAnimationFrame(render);
  }

  private drawScene(time: number, delta: number): void {
    if (!this.ctx || this.width === 0 || this.height === 0) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const celestial = this.celestial();
    const weather = this.weather();
    const isSouthern = this.celestialService.selectedLocation().latitude < 0;

    const sunAlt = celestial.sun.altitudeDeg;
    const sunAz = celestial.sun.azimuthDeg;
    const moonAlt = celestial.moon.altitudeDeg;

    // 1. Draw Full Pure Sky Atmospheric Gradient
    this.drawSkyGradient(ctx, w, h, sunAlt, sunAz, weather);

    // 2. Astrolabe & Equinoctial Coordinate Vector Grid
    this.drawAstrolabeGrid(ctx, w, h, sunAlt, celestial, isSouthern);

    // 3. Draw Stars with Astronomical Extinction & Lunar Washout
    this.drawStars(ctx, w, h, sunAlt, celestial, weather, time);

    // 4. Draw Solar Horizon Flare / Twilight Glow
    this.drawSolarGlow(ctx, w, h, sunAlt, sunAz, weather, isSouthern);

    // 5. Draw Moon with Geometric Phase Terminator & Earthshine
    if (moonAlt > -8) {
      this.drawMoon(ctx, w, h, celestial, weather, isSouthern);
    }

    // 6. Draw Sun Disc, Atmospheric Refraction & UV Corona
    if (sunAlt > -10) {
      this.drawSun(ctx, w, h, sunAlt, sunAz, weather, time, isSouthern);
    }

    // 7. Draw Procedural Atmospheric Clouds
    this.drawClouds(ctx, w, h, sunAlt, weather, delta);

    // 8. Draw Weather Storm, Lightning & Winter Snow/Blizzard Effects
    this.drawWeatherEffects(ctx, w, h, weather, delta, time);

    // 9. Draw Pure Minimalist Horizon Baseline with Dynamic Compass Bearings
    this.drawHorizonLine(ctx, w, h, sunAlt, weather, isSouthern);
  }

  /**
   * Astrolabe Celestial Coordinates & Cardinal Compass Datum Lines
   */
  private drawAstrolabeGrid(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    celestial: CelestialState,
    isSouthern: boolean
  ): void {
    const horizonY = h * 0.90;
    const isNight = sunAlt < -6;
    const gridAlpha = isNight ? 0.07 : 0.035;

    ctx.save();
    ctx.strokeStyle = `rgba(245, 158, 11, ${gridAlpha})`;
    ctx.lineWidth = 0.75;
    ctx.setLineDash([3, 6]);

    // Altitude Circles (15°, 30°, 45°, 60°, 75°)
    const maxZenithY = horizonY * 0.05;
    const altSteps = [15, 30, 45, 60, 75];
    for (const alt of altSteps) {
      const normAlt = alt / 90;
      const y = horizonY - normAlt * (horizonY - maxZenithY);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Azimuth Meridian Lines (every 45°: N, NE, E, SE, S, SW, W, NW)
    for (let az = 0; az < 360; az += 45) {
      const x = this.projectAzimuthToScreenX(az, w, isSouthern);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, horizonY);
      ctx.stroke();
    }

    // Declination curve
    const declination = celestial.sun.declinationDeg;
    const declRatio = (declination + 23.44) / 46.88;
    const declY = horizonY * 0.35 + (1 - declRatio) * horizonY * 0.3;

    ctx.strokeStyle = `rgba(251, 191, 36, ${(gridAlpha * 2).toFixed(3)})`;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, declY);
    ctx.bezierCurveTo(w * 0.25, declY - 20, w * 0.75, declY - 20, w, declY);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Continuous physics-based Sky Gradient interpolation based on Solar Altitude & Weather
   * Covers the full astronomical spectrum without artificial step jumps:
   * Night -> Astro Twilight -> Nautical Twilight -> Civil Twilight -> Sunset/Sunrise -> Golden Hour -> Day -> High Noon
   */
  private drawSkyGradient(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    _sunAz: number,
    weather: WeatherData
  ): void {
    // Continuous Astronomical Sky Color Palettes: [Zenith, Mid, Horizon]
    // 1. Deep Night (alt <= -18°)
    const night = { zenith: [2, 4, 14], mid: [4, 8, 22], horizon: [8, 14, 32] };
    // 2. Astronomical Twilight (-18° to -12°)
    const astro = { zenith: [4, 8, 26], mid: [9, 15, 40], horizon: [18, 24, 55] };
    // 3. Nautical Twilight (-12° to -6°)
    const nautical = { zenith: [8, 16, 48], mid: [18, 28, 68], horizon: [48, 48, 88] };
    // 4. Civil Twilight (-6° to -1°)
    const civil = { zenith: [14, 28, 75], mid: [55, 48, 105], horizon: [175, 85, 80] };
    // 5. Sunset / Sunrise (-1° to +1°: Belt of Venus & intense Rayleigh scattering)
    const sunset = { zenith: [20, 35, 80], mid: [135, 75, 125], horizon: [255, 110, 45] };
    // 6. Golden Hour (+1° to +6°)
    const golden = { zenith: [36, 68, 145], mid: [115, 120, 175], horizon: [248, 155, 68] };
    // 7. Daytime (+6° to +35°)
    const day = { zenith: [22, 90, 190], mid: [68, 140, 222], horizon: [195, 225, 245] };
    // 8. High Noon (> 35°)
    const highNoon = { zenith: [14, 75, 195], mid: [50, 130, 225], horizon: [180, 220, 250] };

    let zRGB: number[];
    let mRGB: number[];
    let hRGB: number[];

    const lerpColor = (c1: number[], c2: number[], t: number): number[] => {
      const f = Math.max(0, Math.min(1, t));
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * f),
        Math.round(c1[1] + (c2[1] - c1[1]) * f),
        Math.round(c1[2] + (c2[2] - c1[2]) * f)
      ];
    };

    if (sunAlt <= -18) {
      zRGB = night.zenith; mRGB = night.mid; hRGB = night.horizon;
    } else if (sunAlt <= -12) {
      const f = (sunAlt + 18) / 6;
      zRGB = lerpColor(night.zenith, astro.zenith, f);
      mRGB = lerpColor(night.mid, astro.mid, f);
      hRGB = lerpColor(night.horizon, astro.horizon, f);
    } else if (sunAlt <= -6) {
      const f = (sunAlt + 12) / 6;
      zRGB = lerpColor(astro.zenith, nautical.zenith, f);
      mRGB = lerpColor(astro.mid, nautical.mid, f);
      hRGB = lerpColor(astro.horizon, nautical.horizon, f);
    } else if (sunAlt <= -1) {
      const f = (sunAlt + 6) / 5;
      zRGB = lerpColor(nautical.zenith, civil.zenith, f);
      mRGB = lerpColor(nautical.mid, civil.mid, f);
      hRGB = lerpColor(nautical.horizon, civil.horizon, f);
    } else if (sunAlt <= 1) {
      const f = (sunAlt + 1) / 2;
      zRGB = lerpColor(civil.zenith, sunset.zenith, f);
      mRGB = lerpColor(civil.mid, sunset.mid, f);
      hRGB = lerpColor(civil.horizon, sunset.horizon, f);
    } else if (sunAlt <= 6) {
      const f = (sunAlt - 1) / 5;
      zRGB = lerpColor(sunset.zenith, golden.zenith, f);
      mRGB = lerpColor(sunset.mid, golden.mid, f);
      hRGB = lerpColor(sunset.horizon, golden.horizon, f);
    } else if (sunAlt <= 35) {
      const f = (sunAlt - 6) / 29;
      zRGB = lerpColor(golden.zenith, day.zenith, f);
      mRGB = lerpColor(golden.mid, day.mid, f);
      hRGB = lerpColor(golden.horizon, day.horizon, f);
    } else {
      const f = Math.min(1, (sunAlt - 35) / 30);
      zRGB = lerpColor(day.zenith, highNoon.zenith, f);
      mRGB = lerpColor(day.mid, highNoon.mid, f);
      hRGB = lerpColor(day.horizon, highNoon.horizon, f);
    }

    // Weather overcast & storm desaturation
    const isStormOrOvercast = weather.condition === 'overcast' || weather.condition === 'heavy_rain' || weather.condition === 'thunderstorm' || weather.condition === 'blizzard';
    const overcastFactor = (weather.cloudCoverPct / 100) * (isStormOrOvercast ? 0.82 : 0.38);
    if (overcastFactor > 0) {
      const isNight = sunAlt < -6;
      const grayZenith = isNight ? [8, 12, 18] : [65, 75, 90];
      const grayMid = isNight ? [14, 20, 30] : [90, 105, 122];
      const grayHorizon = isNight ? [22, 30, 42] : [130, 145, 160];

      zRGB = lerpColor(zRGB, grayZenith, overcastFactor);
      mRGB = lerpColor(mRGB, grayMid, overcastFactor);
      hRGB = lerpColor(hRGB, grayHorizon, overcastFactor);
    }

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgb(${zRGB.join(',')})`);
    grad.addColorStop(0.55, `rgb(${mRGB.join(',')})`);
    grad.addColorStop(0.90, `rgb(${hRGB.join(',')})`);
    grad.addColorStop(1, `rgb(${Math.round(hRGB[0] * 0.7)},${Math.round(hRGB[1] * 0.7)},${Math.round(hRGB[2] * 0.7)})`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  /**
   * Astronomical Star Vault with Magnitude Extinction, Lunar Washout & Weather Occlusion
   */
  private drawStars(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    celestial: CelestialState,
    weather: WeatherData,
    time: number
  ): void {
    const starVis = celestial.starVisibilityFraction;
    if (starVis <= 0.005) return;

    // Lunar Glare Washout: Full Moon high above horizon illuminates upper atmosphere, fading dim stars
    const moonAlt = celestial.moon.altitudeDeg;
    const moonIllum = celestial.moon.illuminationFraction;
    const lunarWashout = (moonAlt > 0 && moonIllum > 0.25)
      ? 1 - (moonIllum * 0.32 * Math.max(0, Math.min(1, moonAlt / 45)))
      : 1.0;

    // Cloud & Fog occlusion
    const cloudOcclusion = Math.max(0, 1 - (weather.cloudCoverPct / 100) * 0.95);
    const fogOcclusion = weather.condition === 'fog' ? 0.25 : (weather.visibilityKm < 5 ? 0.6 : 1.0);

    const finalStarAlpha = starVis * lunarWashout * cloudOcclusion * fogOcclusion;
    if (finalStarAlpha <= 0.005) return;

    const horizonY = h * 0.90;
    // Magnitude extinction: as sky brightens or clouds roll in, dim stars extinguish first
    const extinctionThreshold = (1 - finalStarAlpha) * 0.5;

    // Atmospheric scintillation (twinkling) modulated by wind turbulence
    const windTurbulence = 1.0 + Math.min(2.5, weather.windSpeedKmh / 20);

    for (const star of this.stars) {
      if (star.baseBrightness < extinctionThreshold) continue;

      const sx = star.x * w;
      const sy = star.y * horizonY;
      const twinkle = 0.82 + Math.sin(time * star.flickerSpeed * windTurbulence + star.flickerPhase) * 0.18;
      const alpha = star.baseBrightness * finalStarAlpha * twinkle;
      if (alpha <= 0.01) continue;

      ctx.beginPath();
      ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
      ctx.fillStyle = `${star.color} ${alpha.toFixed(3)})`;
      ctx.fill();
    }
  }

  /**
   * Atmospheric Solar Horizon Flare & Twilight Arch
   */
  private drawSolarGlow(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    sunAz: number,
    weather: WeatherData,
    isSouthern: boolean
  ): void {
    if (sunAlt < -14 || sunAlt > 25) return;

    const horizonY = h * 0.90;
    const sunX = this.projectAzimuthToScreenX(sunAz, w, isSouthern);
    const glowRadius = Math.max(w * 0.45, 280);

    let intensity = 0;
    if (sunAlt <= 0) {
      intensity = Math.max(0, (sunAlt + 14) / 14) * 0.65;
    } else {
      intensity = Math.max(0, (25 - sunAlt) / 25) * 0.75;
    }

    intensity *= Math.max(0, 1 - (weather.cloudCoverPct / 100) * 0.55);
    if (intensity <= 0.01) return;

    const radial = ctx.createRadialGradient(sunX, horizonY, 5, sunX, horizonY, glowRadius);
    const color = sunAlt < 2 ? '255, 115, 35,' : '255, 185, 75,';

    radial.addColorStop(0, `rgba(${color} ${(intensity * 0.85).toFixed(3)})`);
    radial.addColorStop(0.35, `rgba(${color} ${(intensity * 0.35).toFixed(3)})`);
    radial.addColorStop(1, `rgba(${color} 0)`);

    ctx.fillStyle = radial;
    ctx.fillRect(0, horizonY - glowRadius, w, glowRadius * 2);
  }

  /**
   * Sun Disc, Atmospheric Refraction Oblateness & UV Corona
   */
  private drawSun(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    sunAz: number,
    weather: WeatherData,
    time: number,
    isSouthern: boolean
  ): void {
    const horizonY = h * 0.90;
    const sunPos = this.projectCelestialToScreen(sunAlt, sunAz, w, horizonY, isSouthern);
    if (sunPos.y > h + 50) return;

    const sunRadius = Math.max(16, Math.min(28, w * 0.024));
    let coreColor = '255, 255, 255';
    let coronaColor = '255, 215, 120';
    let coronaAlpha = 0.5;

    if (sunAlt < 2) {
      coreColor = '255, 160, 60'; coronaColor = '255, 85, 25'; coronaAlpha = 0.85;
    } else if (sunAlt < 6) {
      coreColor = '255, 220, 130'; coronaColor = '255, 135, 40'; coronaAlpha = 0.7;
    } else if (sunAlt < 15) {
      coreColor = '255, 245, 200'; coronaColor = '255, 180, 75'; coronaAlpha = 0.58;
    }

    const cloudCover = weather.cloudCoverPct / 100;
    const sunDiscAlpha = Math.max(0.15, 1 - cloudCover * 0.85);

    const coronaRad = sunRadius * (3.8 + Math.max(0, sunAlt / 15));
    const corona = ctx.createRadialGradient(sunPos.x, sunPos.y, sunRadius * 0.8, sunPos.x, sunPos.y, coronaRad);
    corona.addColorStop(0, `rgba(${coronaColor}, ${(coronaAlpha * sunDiscAlpha).toFixed(3)})`);
    corona.addColorStop(0.5, `rgba(${coronaColor}, ${(coronaAlpha * 0.3 * sunDiscAlpha).toFixed(3)})`);
    corona.addColorStop(1, `rgba(${coronaColor}, 0)`);

    ctx.fillStyle = corona;
    ctx.beginPath();
    ctx.arc(sunPos.x, sunPos.y, coronaRad, 0, Math.PI * 2);
    ctx.fill();

    // High UV solar pulsation halo
    if (weather.uvIndex >= 6 && sunAlt > 10) {
      const uvPulse = (Math.sin(time * 0.004) + 1) * 0.5;
      const ringRad = sunRadius * (1.8 + uvPulse * 0.8);
      ctx.strokeStyle = `rgba(245, 158, 11, ${(0.3 + uvPulse * 0.3).toFixed(3)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sunPos.x, sunPos.y, ringRad, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Atmospheric refraction flattening (solar oblateness near horizon)
    const flattenFactor = sunAlt <= 3 ? Math.max(0.82, 0.82 + (sunAlt / 3) * 0.18) : 1.0;

    ctx.beginPath();
    ctx.ellipse(sunPos.x, sunPos.y, sunRadius, sunRadius * flattenFactor, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${coreColor}, ${sunDiscAlpha.toFixed(3)})`;
    ctx.shadowColor = `rgba(${coronaColor}, 0.8)`;
    ctx.shadowBlur = sunRadius * 1.5;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /**
   * Moon with True Geometric Phase Terminator, Bright Limb Orientation & Earthshine
   */
  private drawMoon(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    celestial: CelestialState,
    weather: WeatherData,
    isSouthern: boolean
  ): void {
    const horizonY = h * 0.90;
    const moon = celestial.moon;
    const moonPos = this.projectCelestialToScreen(moon.altitudeDeg, moon.azimuthDeg, w, horizonY, isSouthern);
    if (moonPos.y > h + 50) return;

    // Smooth horizon culling: fades when setting below horizon
    let horizonFade = 1.0;
    if (moon.altitudeDeg < 0) {
      horizonFade = Math.max(0, (moon.altitudeDeg + 8) / 8);
    }
    if (horizonFade <= 0.01) return;

    const moonRadius = Math.max(14, Math.min(24, w * 0.02));
    const cloudCover = weather.cloudCoverPct / 100;
    const isDarkSky = celestial.sun.altitudeDeg < -4;
    const moonAlpha = Math.max(0.18, (1 - cloudCover * 0.8) * (isDarkSky ? 1 : 0.65)) * horizonFade;

    ctx.save();
    ctx.translate(moonPos.x, moonPos.y);

    // Orientation: tilt bright limb towards Sun
    const tiltRad = (moon.brightLimbAngleDeg - 90) * (Math.PI / 180);
    ctx.rotate(tiltRad);

    // Silvery lunar halo when illuminated at night
    if (isDarkSky && moon.illuminationFraction > 0.25) {
      const glowRad = moonRadius * (2.2 + moon.illuminationFraction * 1.8);
      const glow = ctx.createRadialGradient(0, 0, moonRadius * 0.9, 0, 0, glowRad);
      glow.addColorStop(0, `rgba(215, 230, 255, ${(0.35 * moonAlpha * moon.illuminationFraction).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(215, 230, 255, 0)');

      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, glowRad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Earthshine: faint ash glow on dark unlit limb during crescent phases at night
    const earthshineAlpha = (isDarkSky && moon.illuminationFraction < 0.45)
      ? 0.22 * (1 - moon.illuminationFraction) * moonAlpha
      : 0.12 * moonAlpha;

    ctx.beginPath();
    ctx.arc(0, 0, moonRadius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(38, 52, 78, ${earthshineAlpha.toFixed(3)})`;
    ctx.fill();

    // Geometric Phase Terminator
    if (moon.illuminationFraction > 0.02) {
      const k = moon.illuminationFraction;
      ctx.beginPath();
      ctx.arc(0, 0, moonRadius, -Math.PI / 2, Math.PI / 2, false);

      const terminatorRx = Math.abs((2 * k - 1) * moonRadius);
      const anticlockwise = k < 0.5;
      ctx.ellipse(0, 0, terminatorRx, moonRadius, 0, Math.PI / 2, -Math.PI / 2, anticlockwise);
      ctx.closePath();

      const moonGrad = ctx.createLinearGradient(-moonRadius, -moonRadius, moonRadius, moonRadius);
      moonGrad.addColorStop(0, `rgba(255, 255, 245, ${moonAlpha.toFixed(3)})`);
      moonGrad.addColorStop(0.7, `rgba(235, 240, 250, ${moonAlpha.toFixed(3)})`);
      moonGrad.addColorStop(1, `rgba(210, 220, 235, ${moonAlpha.toFixed(3)})`);

      ctx.fillStyle = moonGrad;
      ctx.fill();
    }

    ctx.restore();
  }

  private drawClouds(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    weather: WeatherData,
    delta: number
  ): void {
    const cloudCover = weather.cloudCoverPct / 100;
    if (cloudCover <= 0.05) return;

    const horizonY = h * 0.90;
    const isNight = sunAlt < -6;
    const isSunset = sunAlt >= -6 && sunAlt <= 6;

    let cloudRGB = isNight ? [25, 35, 52] : (isSunset ? [240, 160, 130] : [245, 250, 255]);
    if (weather.condition === 'overcast' || weather.condition === 'thunderstorm' || weather.condition === 'blizzard') {
      cloudRGB = isNight ? [12, 16, 25] : [110, 120, 135];
    }

    const maxCloudsToDraw = Math.floor(this.clouds.length * cloudCover);

    for (let i = 0; i < maxCloudsToDraw; i++) {
      const cloud = this.clouds[i];

      if (!this.reducedMotion) {
        const windFactor = 0.4 + Math.min(3.0, weather.windSpeedKmh / 12);
        const windDirection = Math.cos((weather.windDirectionDeg * Math.PI) / 180);
        cloud.x += cloud.speed * delta * windFactor * (windDirection >= 0 ? 1 : -1);
        if (cloud.x > 1.25) cloud.x = -0.25;
        if (cloud.x < -0.25) cloud.x = 1.25;
      }

      const cx = cloud.x * w;
      const cy = cloud.y * horizonY;
      const rx = cloud.radiusX;
      const ry = cloud.radiusY;

      const grad = ctx.createRadialGradient(cx, cy, ry * 0.2, cx, cy, rx);
      const alpha = cloud.opacity * (0.4 + cloudCover * 0.6);

      grad.addColorStop(0, `rgba(${cloudRGB.join(',')}, ${alpha.toFixed(3)})`);
      grad.addColorStop(0.6, `rgba(${cloudRGB.join(',')}, ${(alpha * 0.5).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${cloudRGB.join(',')}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Weather Precipitation, Thunderstorm Lightning Bolts & Blizzard Storm
   */
  private drawWeatherEffects(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    weather: WeatherData,
    delta: number,
    time: number
  ): void {
    const cond = weather.condition;
    const horizonY = h * 0.90;

    // 1. Fog / Mist Haze Layer
    if (cond === 'fog' || weather.visibilityKm < 5) {
      const fogGrad = ctx.createLinearGradient(0, horizonY - 180, 0, h);
      fogGrad.addColorStop(0, 'rgba(210, 220, 235, 0)');
      fogGrad.addColorStop(0.6, 'rgba(210, 220, 235, 0.45)');
      fogGrad.addColorStop(1, 'rgba(190, 205, 225, 0.7)');
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, horizonY - 180, w, h - (horizonY - 180));
    }

    // 2. Thunderstorm: Sheet & Fork Lightning (disabled if reducedMotion)
    if (cond === 'thunderstorm' && !this.reducedMotion) {
      this.lightningTimer += delta;
      if (this.lightningTimer > 2800 && Math.random() < 0.04) {
        this.lightningFlashAlpha = 0.85 + Math.random() * 0.15;
        this.generateLightningBolt(w, horizonY);
        this.lightningTimer = 0;
      }

      // Flash background illumination
      if (this.lightningFlashAlpha > 0) {
        ctx.fillStyle = `rgba(235, 245, 255, ${this.lightningFlashAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
        this.lightningFlashAlpha -= delta * 0.0035;
      }

      // Draw branching lightning bolt
      if (this.activeLightningBolt && this.activeLightningBolt.alpha > 0.05) {
        this.drawLightningBolt(ctx, this.activeLightningBolt);
        this.activeLightningBolt.alpha -= delta * 0.004;
      }
    }

    // 3. Precipitation Particles (Rain, Heavy Downpour, Snow, Winter Blizzard)
    const isRain = cond === 'rain' || cond === 'heavy_rain' || cond === 'thunderstorm';
    const isSnow = cond === 'snow' || cond === 'blizzard';

    if (!isRain && !isSnow) return;

    const isBlizzard = cond === 'blizzard';
    const particleCount = isBlizzard ? 240 : (cond === 'heavy_rain' || cond === 'thunderstorm' ? 200 : (isRain ? 110 : 100));

    for (let i = 0; i < particleCount; i++) {
      const p = this.precipParticles[i];

      if (!this.reducedMotion) {
        if (isRain) {
          const rainSpeedMult = cond === 'heavy_rain' || cond === 'thunderstorm' ? 2.2 : 1.3;
          p.y += p.speedY * rainSpeedMult;
          p.x += p.speedX * (weather.windSpeedKmh / 20);
        } else if (isSnow) {
          if (isBlizzard) {
            p.y += p.speedY * 0.9;
            p.x += -0.012 - (weather.windSpeedKmh / 80) * 0.015;
          } else {
            p.y += p.speedY * 0.45;
            p.x += Math.sin(time * 0.002 + p.wobblePhase) * 0.001;
          }
        }

        if (p.y > 1) {
          p.y = -0.05;
          p.x = Math.random();
        }
        if (p.x < -0.1) p.x = 1.1;
        if (p.x > 1.1) p.x = -0.1;
      }

      const px = p.x * w;
      const py = p.y * h;

      if (isRain) {
        const len = cond === 'heavy_rain' || cond === 'thunderstorm' ? 28 : 16;
        ctx.strokeStyle = `rgba(195, 225, 255, ${(p.opacity * 0.75).toFixed(3)})`;
        ctx.lineWidth = cond === 'heavy_rain' ? 1.75 : 1.2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + p.speedX * w * 0.08, py + len);
        ctx.stroke();
      } else if (isSnow) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(p.opacity * (isBlizzard ? 0.95 : 0.8)).toFixed(3)})`;
        ctx.beginPath();
        const snowSize = isBlizzard ? p.size * 1.3 : p.size;
        ctx.arc(px, py, snowSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private generateLightningBolt(w: number, horizonY: number): void {
    const startX = w * (0.2 + Math.random() * 0.6);
    const startY = 10;
    const points: { x: number; y: number }[] = [{ x: startX, y: startY }];

    let currX = startX;
    let currY = startY;
    const segments = 12;
    const stepY = (horizonY * 0.8) / segments;

    for (let i = 0; i < segments; i++) {
      currX += (Math.random() - 0.5) * 55;
      currY += stepY + (Math.random() - 0.5) * 15;
      points.push({ x: currX, y: currY });
    }

    const branches: { points: { x: number; y: number }[]; alpha: number }[] = [];
    if (points.length > 5) {
      const branchOrigin = points[Math.floor(points.length / 2)];
      let bx = branchOrigin.x;
      let by = branchOrigin.y;
      const bPoints: { x: number; y: number }[] = [{ x: bx, y: by }];
      for (let j = 0; j < 5; j++) {
        bx += (Math.random() - 0.3) * 45;
        by += stepY * 0.7;
        bPoints.push({ x: bx, y: by });
      }
      branches.push({ points: bPoints, alpha: 0.8 });
    }

    this.activeLightningBolt = {
      points,
      alpha: 1.0,
      branches
    };
  }

  private drawLightningBolt(ctx: CanvasRenderingContext2D, bolt: LightningBolt): void {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${bolt.alpha.toFixed(3)})`;
    ctx.shadowColor = 'rgba(160, 210, 255, 0.9)';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.5;

    // Main bolt
    ctx.beginPath();
    ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
    for (let i = 1; i < bolt.points.length; i++) {
      ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
    }
    ctx.stroke();

    // Branches
    ctx.lineWidth = 1.2;
    for (const br of bolt.branches) {
      ctx.beginPath();
      ctx.moveTo(br.points[0].x, br.points[0].y);
      for (let i = 1; i < br.points.length; i++) {
        ctx.lineTo(br.points[i].x, br.points[i].y);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Minimalist Pure Horizon Datum Baseline with Hemisphere-Aware Compass Bearings
   */
  private drawHorizonLine(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    _weather: WeatherData,
    isSouthern: boolean
  ): void {
    const horizonY = h * 0.90;
    const isSunset = sunAlt >= -6 && sunAlt <= 6;

    // Clean, crisp datum stroke line
    ctx.strokeStyle = isSunset ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(w, horizonY);
    ctx.stroke();

    // Cardinal Azimuth Compass marks along horizon
    const cardinalLabels: { text: string; az: number }[] = [
      { text: 'N', az: 0 },
      { text: 'NE', az: 45 },
      { text: 'E', az: 90 },
      { text: 'SE', az: 135 },
      { text: 'S', az: 180 },
      { text: 'SW', az: 225 },
      { text: 'W', az: 270 },
      { text: 'NW', az: 315 },
      { text: 'N', az: 360 }
    ];

    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';

    for (const card of cardinalLabels) {
      const x = this.projectAzimuthToScreenX(card.az, w, isSouthern);
      if (x < -10 || x > w + 10) continue;
      ctx.beginPath();
      ctx.moveTo(x, horizonY - 4);
      ctx.lineTo(x, horizonY + 4);
      ctx.stroke();
      ctx.fillText(card.text, x, horizonY + 16);
    }
  }

  private projectCelestialToScreen(
    altitudeDeg: number,
    azimuthDeg: number,
    w: number,
    horizonY: number,
    isSouthern = false
  ): { x: number; y: number } {
    const x = this.projectAzimuthToScreenX(azimuthDeg, w, isSouthern);
    const maxZenithY = horizonY * 0.05;
    const normalizedAlt = altitudeDeg / 90;
    const y = horizonY - (normalizedAlt * (horizonY - maxZenithY));
    return { x, y };
  }

  private projectAzimuthToScreenX(azimuthDeg: number, w: number, isSouthern = false): number {
    const normAz = ((azimuthDeg % 360) + 360) % 360;
    if (isSouthern) {
      // Observer faces North (0° is center)
      // East (90°) on left (x = 0.25w), North (0°) center (x = 0.5w), West (270°) on right (x = 0.75w)
      let dAz = normAz;
      if (dAz > 180) dAz -= 360; // -180 to +180 relative to North
      return w * (0.5 - dAz / 360);
    } else {
      // Observer faces South (180° is center)
      // East (90°) on left (x = 0.25w), South (180°) center (x = 0.5w), West (270°) on right (x = 0.75w)
      const dAz = normAz - 180; // -180 to +180 relative to South
      return w * (0.5 + dAz / 360);
    }
  }
}
