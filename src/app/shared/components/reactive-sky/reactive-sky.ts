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
import { WeatherData, AtmosphericState } from '../../../core/models/weather.model';

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
  layer: number; // 0: low stratus, 1: mid cumulus/broken, 2: high cirrus
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

interface AmbientParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  phase: number;
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
  readonly atmosphericState = this.celestialService.atmosphericState;

  private ctx: CanvasRenderingContext2D | null = null;
  private animFrameId: number | null = null;
  private width = 0;
  private height = 0;
  private dpr = 1;

  // Star catalog
  private stars: Star[] = [];
  // Procedural Clouds
  private clouds: CloudParticle[] = [];
  // Precipitation Particles (Rain, Drizzle, Snow, Blizzard, Sleet)
  private precipParticles: PrecipParticle[] = [];
  // Ambient Particulates (Dust, Sand Haze, Freezing Frost Needles)
  private ambientParticles: AmbientParticle[] = [];

  // Lightning system for thunderstorms
  private lightningTimer = 0;
  private lightningFlashAlpha = 0;
  private activeLightningBolt: LightningBolt | null = null;

  // Smooth continuous atmospheric interpolation state
  private interp = {
    cloudCoverage: 0.25,
    haze: 0.1,
    dustAerosols: 0,
    heatShimmer: 0,
    freezingFrost: 0,
    precipIntensity: 0,
    stormActivity: 0,
    auroraActivity: 0,
    eclipseObscuration: 0
  };

  private reducedMotion = false;
  private resizeHandler: (() => void) | null = null;

  constructor() {
    if (this.isBrowser) {
      this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || false;
      this.initStars();
      this.initClouds();
      this.initPrecipParticles();
      this.initAmbientParticles();
    }
  }

  ngOnInit(): void {
    if (!this.isBrowser) return;

    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: false });

    this.setupResizeObserver();
    this.startRenderLoop();
  }

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
    const starCount = 320;
    this.stars = [];

    let seed = 42;
    const rnd = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    const colors = [
      'rgba(255, 255, 255,',
      'rgba(230, 242, 255,', // Blue-white Rigel
      'rgba(255, 238, 215,', // Golden Capella
      'rgba(255, 215, 185,', // Warm Betelgeuse
      'rgba(255, 250, 240,'  // Crisp white
    ];

    for (let i = 0; i < starCount; i++) {
      const x = rnd();
      const y = Math.pow(rnd(), 1.35) * 0.88;
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
    const count = 55;
    for (let i = 0; i < count; i++) {
      const layer = Math.floor(Math.random() * 3);
      // layer 0: low stratus, layer 1: mid cumulus, layer 2: high cirrus
      const baseY = layer === 0 ? 0.35 + Math.random() * 0.45 : (layer === 1 ? 0.15 + Math.random() * 0.55 : 0.05 + Math.random() * 0.35);
      const rx = layer === 2 ? 140 + Math.random() * 220 : 90 + Math.random() * 190;
      const ry = layer === 2 ? 25 + Math.random() * 45 : 35 + Math.random() * 90;

      this.clouds.push({
        x: Math.random(),
        y: baseY,
        radiusX: rx,
        radiusY: ry,
        opacity: 0.12 + Math.random() * 0.38,
        speed: (layer === 2 ? 0.00002 : (layer === 0 ? 0.00007 : 0.00004)) + Math.random() * 0.00005,
        layer
      });
    }
  }

  private initPrecipParticles(): void {
    this.precipParticles = [];
    const count = 300;
    for (let i = 0; i < count; i++) {
      this.precipParticles.push({
        x: Math.random(),
        y: Math.random(),
        speedY: 0.007 + Math.random() * 0.018,
        speedX: -0.003 + Math.random() * 0.002,
        size: 1 + Math.random() * 2.5,
        opacity: 0.25 + Math.random() * 0.7,
        wobblePhase: Math.random() * Math.PI * 2
      });
    }
  }

  private initAmbientParticles(): void {
    this.ambientParticles = [];
    const count = 75;
    for (let i = 0; i < count; i++) {
      this.ambientParticles.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.0004,
        vy: -0.0002 - Math.random() * 0.0005,
        size: 1.2 + Math.random() * 2.8,
        opacity: 0.2 + Math.random() * 0.6,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  private startRenderLoop(): void {
    let lastTime = performance.now();
    let renderAccumulator = 0;
    // The sky is a background layer, so 30 FPS is enough for smooth celestial
    // motion while avoiding unnecessary full-canvas work on every browser frame.
    const targetFrameMs = 1000 / 30;

    const render = (time: number) => {
      const frameDelta = Math.min(Math.max(0, time - lastTime), 100);
      lastTime = time;
      renderAccumulator += frameDelta;

      if (renderAccumulator >= targetFrameMs) {
        const delta = renderAccumulator;
        renderAccumulator = 0;
        this.updateInterpolation(delta);
        this.drawScene(time, delta);
      }

      this.animFrameId = requestAnimationFrame(render);
    };

    this.animFrameId = requestAnimationFrame(render);
  }

  /**
   * Smooth, continuous interpolation of atmospheric variables to eliminate abrupt visual pops
   */
  private updateInterpolation(delta: number): void {
    const target = this.atmosphericState();
    const rate = 1 - Math.exp(-delta / 550); // ~1.5s smooth settle

    this.interp.cloudCoverage += (target.cloudCoverage - this.interp.cloudCoverage) * rate;
    this.interp.haze += (target.haze - this.interp.haze) * rate;
    this.interp.dustAerosols += (target.dustAerosols - this.interp.dustAerosols) * rate;
    this.interp.heatShimmer += (target.heatShimmer - this.interp.heatShimmer) * rate;
    this.interp.freezingFrost += (target.freezingFrost - this.interp.freezingFrost) * rate;
    this.interp.precipIntensity += (target.precipitationIntensity - this.interp.precipIntensity) * rate;
    this.interp.stormActivity += (target.stormActivity - this.interp.stormActivity) * rate;
    this.interp.auroraActivity += (target.auroraActivity - this.interp.auroraActivity) * rate;
    this.interp.eclipseObscuration += ((target.isEclipse ? (target.eclipseObscuration ?? 0.95) : 0) - this.interp.eclipseObscuration) * rate;
  }

  private drawScene(time: number, delta: number): void {
    if (!this.ctx || this.width === 0 || this.height === 0) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const celestial = this.celestial();
    const weather = this.weather();
    const atmos = this.atmosphericState();
    const isSouthern = this.celestialService.selectedLocation().latitude < 0;

    const sunAlt = celestial.sun.altitudeDeg;
    const sunAz = celestial.sun.azimuthDeg;
    const moonAlt = celestial.moon.altitudeDeg;

    // 1. Draw Layered Atmospheric Sky Gradient
    this.drawSkyGradient(ctx, w, h, sunAlt, sunAz, weather, atmos);

    // 2. Astrolabe & Equinoctial Coordinate Datum Grid
    this.drawAstrolabeGrid(ctx, w, h, sunAlt, celestial, isSouthern);

    // 3. Draw Aurora Borealis / Australis Curtains (when active or polar night)
    if (this.interp.auroraActivity > 0.02 && sunAlt < -6) {
      this.drawAurora(ctx, w, h, sunAlt, this.interp.auroraActivity, time);
    }

    // 4. Draw Stars with Astronomical Extinction, Lunar Washout & Winter Crispness
    this.drawStars(ctx, w, h, sunAlt, celestial, weather, atmos, time);

    // 5. Draw Solar Horizon Flare / Twilight Scattering Arch
    this.drawSolarGlow(ctx, w, h, sunAlt, sunAz, weather, isSouthern);

    // 6. Draw Moon with Geometric Phase Terminator, Earthshine & Eclipse
    if (moonAlt > -8) {
      this.drawMoon(ctx, w, h, celestial, weather, atmos, isSouthern);
    }

    // 7. Draw Sun Disc, Refraction Oblateness, UV Corona & Solar Eclipse
    if (sunAlt > -10) {
      this.drawSun(ctx, w, h, sunAlt, sunAz, weather, atmos, time, isSouthern);
    }

    // 8. Draw Procedural Atmospheric Clouds with Directional Illumination
    this.drawClouds(ctx, w, h, sunAlt, weather, atmos, delta);

    // 9. Draw Weather Precipitation, Storms, Fog, Frost & Dust Haze Particles
    this.drawWeatherEffects(ctx, w, h, weather, atmos, delta, time);

    // 10. Draw Horizon Baseline with Compass Bearings & Heat Shimmer
    this.drawHorizonLine(ctx, w, h, sunAlt, weather, atmos, isSouthern, time);
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
   * Continuous physics-based Sky Gradient interpolation based on Solar Altitude, Weather & Seasonal Modifiers
   */
  private drawSkyGradient(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    _sunAz: number,
    weather: WeatherData,
    atmos: AtmosphericState
  ): void {
    // Base Astronomical Sky Color Palettes: [Zenith, Mid, Horizon]
    const night = { zenith: [2, 4, 14], mid: [4, 8, 22], horizon: [8, 14, 32] };
    const astro = { zenith: [4, 8, 26], mid: [9, 15, 40], horizon: [18, 24, 55] };
    const nautical = { zenith: [8, 16, 48], mid: [18, 28, 68], horizon: [48, 48, 88] };
    const civil = { zenith: [14, 28, 75], mid: [55, 48, 105], horizon: [175, 85, 80] };
    const sunset = { zenith: [20, 35, 80], mid: [135, 75, 125], horizon: [255, 110, 45] };
    const golden = { zenith: [36, 68, 145], mid: [115, 120, 175], horizon: [248, 155, 68] };
    const day = { zenith: [22, 90, 190], mid: [68, 140, 222], horizon: [195, 225, 245] };
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

    // 1. Seasonal Atmospheric Tint
    if (atmos.season === 'winter') {
      // Cooler illumination, pale crisp daylight, steel blue-gray tone
      zRGB = lerpColor(zRGB, [10, 30, 60], 0.22);
      mRGB = lerpColor(mRGB, [50, 95, 145], 0.25);
      hRGB = lerpColor(hRGB, [160, 195, 225], 0.30);
    } else if (atmos.season === 'summer') {
      // Warmer golden illumination, stronger atmospheric scattering
      hRGB = lerpColor(hRGB, [245, 215, 175], 0.20);
      mRGB = lerpColor(mRGB, [85, 155, 235], 0.15);
    } else if (atmos.season === 'autumn') {
      // Low-angle warm sunlight, bronze/gold tones
      hRGB = lerpColor(hRGB, [235, 180, 120], 0.22);
      mRGB = lerpColor(mRGB, [120, 130, 160], 0.15);
    } else if (atmos.season === 'spring') {
      // Gentle pastel colors, soft dawn atmosphere
      hRGB = lerpColor(hRGB, [220, 230, 245], 0.15);
    }

    // 2. Dust / Sand Haze Particulate Scattering (Warm Amber Horizon)
    if (this.interp.dustAerosols > 0.05) {
      const dustFactor = this.interp.dustAerosols;
      const amberHorizon = [225, 145, 65];
      const amberMid = [165, 115, 80];
      hRGB = lerpColor(hRGB, amberHorizon, dustFactor * 0.75);
      mRGB = lerpColor(mRGB, amberMid, dustFactor * 0.55);
    }

    // 3. Freezing Frost / Freezing Fog (Pale Icy Scintillating Wash)
    if (this.interp.freezingFrost > 0.05) {
      const frostFactor = this.interp.freezingFrost;
      const iceTone = [185, 215, 240];
      hRGB = lerpColor(hRGB, iceTone, frostFactor * 0.45);
      mRGB = lerpColor(mRGB, [90, 125, 165], frostFactor * 0.3);
    }

    // 4. Weather Overcast, Storm & Precipitation Desaturation
    const cloudCover = this.interp.cloudCoverage;
    const isStormOrOvercast =
      weather.condition === 'overcast' ||
      weather.condition === 'heavy_rain' ||
      weather.condition === 'heavy_downpour' ||
      weather.condition === 'thunderstorm' ||
      weather.condition === 'severe_storm' ||
      weather.condition === 'monsoon' ||
      weather.condition === 'tropical_storm' ||
      weather.condition === 'blizzard' ||
      weather.condition === 'winter_overcast';

    const overcastFactor = cloudCover * (isStormOrOvercast ? 0.86 : 0.38);
    if (overcastFactor > 0) {
      const isNight = sunAlt < -6;
      const grayZenith = isNight ? [6, 10, 16] : [65, 75, 90];
      const grayMid = isNight ? [12, 18, 28] : [90, 105, 122];
      const grayHorizon = isNight ? [20, 28, 40] : [130, 145, 160];

      zRGB = lerpColor(zRGB, grayZenith, overcastFactor);
      mRGB = lerpColor(mRGB, grayMid, overcastFactor);
      hRGB = lerpColor(hRGB, grayHorizon, overcastFactor);
    }

    // 5. Solar Eclipse Darkening
    if (this.interp.eclipseObscuration > 0.1) {
      const eclipseDarkness = this.interp.eclipseObscuration;
      const twilightDark = [8, 12, 28];
      zRGB = lerpColor(zRGB, twilightDark, eclipseDarkness * 0.85);
      mRGB = lerpColor(mRGB, [14, 22, 45], eclipseDarkness * 0.82);
      hRGB = lerpColor(hRGB, [28, 40, 72], eclipseDarkness * 0.75);
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
   * Aurora Borealis / Australis dynamic geomagnetic curtains (Green/Emerald & Violet ribbons)
   */
  private drawAurora(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    activity: number,
    time: number
  ): void {
    const darkness = Math.min(1, Math.max(0, (-sunAlt - 6) / 10));
    const alpha = activity * darkness * 0.75;
    if (alpha <= 0.01) return;

    ctx.save();
    const horizonY = h * 0.90;
    const ribbonCount = 3;

    for (let r = 0; r < ribbonCount; r++) {
      const baseY = horizonY * (0.18 + r * 0.16);
      const waveSpeed = 0.0006 + r * 0.0003;
      const waveFreq = 0.004 + r * 0.002;

      ctx.beginPath();
      ctx.moveTo(0, baseY);

      for (let x = 0; x <= w; x += 15) {
        const offset =
          Math.sin(x * waveFreq + time * waveSpeed) * 35 +
          Math.cos(x * waveFreq * 1.8 - time * waveSpeed * 1.2) * 18;
        ctx.lineTo(x, baseY + offset);
      }

      ctx.lineTo(w, baseY - 60);
      ctx.lineTo(0, baseY - 60);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, baseY - 60, 0, baseY + 40);
      if (r === 1) {
        // Violet/Purple upper curtain
        grad.addColorStop(0, `rgba(168, 85, 247, 0)`);
        grad.addColorStop(0.5, `rgba(192, 132, 252, ${(alpha * 0.55).toFixed(3)})`);
        grad.addColorStop(1, `rgba(52, 211, 153, ${(alpha * 0.75).toFixed(3)})`);
      } else {
        // Emerald / Green lower curtains
        grad.addColorStop(0, `rgba(16, 185, 129, 0)`);
        grad.addColorStop(0.6, `rgba(52, 211, 153, ${(alpha * 0.65).toFixed(3)})`);
        grad.addColorStop(1, `rgba(110, 231, 183, ${(alpha * 0.85).toFixed(3)})`);
      }

      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Astronomical Star Vault with Magnitude Extinction, Lunar Washout & Atmospheric Occlusion
   */
  private drawStars(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    celestial: CelestialState,
    weather: WeatherData,
    atmos: AtmosphericState,
    time: number
  ): void {
    let starVis = celestial.starVisibilityFraction;
    if (atmos.isEclipse && (atmos.eclipseObscuration ?? 0) > 0.85) {
      starVis = Math.max(starVis, ((atmos.eclipseObscuration ?? 0) - 0.85) * 4);
    }
    if (starVis <= 0.005) return;

    // Lunar Glare Washout
    const moonAlt = celestial.moon.altitudeDeg;
    const moonIllum = celestial.moon.illuminationFraction;
    const lunarWashout = (moonAlt > 0 && moonIllum > 0.25)
      ? 1 - (moonIllum * 0.32 * Math.max(0, Math.min(1, moonAlt / 45)))
      : 1.0;

    // Cloud, Fog & Dust occlusion
    const cloudOcclusion = Math.max(0, 1 - (this.interp.cloudCoverage * 0.95));
    const fogOcclusion = Math.max(0.1, 1 - (this.interp.haze * 0.7));
    const dustOcclusion = Math.max(0.05, 1 - (this.interp.dustAerosols * 0.85));

    // Winter Clear & Clear-Dry boosts celestial transparency
    const crispnessBoost = (atmos.season === 'winter' || weather.condition === 'clear_dry') ? 1.25 : 1.0;

    const finalStarAlpha = Math.min(1, starVis * lunarWashout * cloudOcclusion * fogOcclusion * dustOcclusion * crispnessBoost);
    if (finalStarAlpha <= 0.005) return;

    const horizonY = h * 0.90;
    const extinctionThreshold = (1 - finalStarAlpha) * 0.5;
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
    atmos: AtmosphericState,
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

    const cloudCover = this.interp.cloudCoverage;
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

    // Draw Solar Photosphere Disc
    ctx.beginPath();
    ctx.ellipse(sunPos.x, sunPos.y, sunRadius, sunRadius * flattenFactor, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${coreColor}, ${sunDiscAlpha.toFixed(3)})`;
    ctx.shadowColor = `rgba(${coronaColor}, 0.8)`;
    ctx.shadowBlur = sunRadius * 1.5;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Solar Eclipse Umbra Disc
    if (atmos.isEclipse && atmos.eclipseType === 'solar') {
      const obsc = this.interp.eclipseObscuration;
      const offsetX = sunRadius * 0.35 * (1 - obsc);
      ctx.beginPath();
      ctx.arc(sunPos.x + offsetX, sunPos.y, sunRadius * 1.02, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8, 12, 20, 0.98)';
      ctx.fill();

      // Diamond ring / flare edge
      if (obsc > 0.88) {
        ctx.strokeStyle = 'rgba(255, 245, 220, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(sunPos.x, sunPos.y, sunRadius * 1.04, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
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
    atmos: AtmosphericState,
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
    const cloudCover = this.interp.cloudCoverage;
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

      // Total Lunar Eclipse Blood Moon color
      if (atmos.isEclipse && atmos.eclipseType === 'lunar') {
        moonGrad.addColorStop(0, `rgba(244, 63, 94, ${moonAlpha.toFixed(3)})`);
        moonGrad.addColorStop(0.7, `rgba(225, 29, 72, ${moonAlpha.toFixed(3)})`);
        moonGrad.addColorStop(1, `rgba(159, 18, 57, ${moonAlpha.toFixed(3)})`);
      } else {
        moonGrad.addColorStop(0, `rgba(255, 255, 245, ${moonAlpha.toFixed(3)})`);
        moonGrad.addColorStop(0.7, `rgba(235, 240, 250, ${moonAlpha.toFixed(3)})`);
        moonGrad.addColorStop(1, `rgba(210, 220, 235, ${moonAlpha.toFixed(3)})`);
      }

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
    atmos: AtmosphericState,
    delta: number
  ): void {
    const cloudCover = this.interp.cloudCoverage;
    if (cloudCover <= 0.05) return;

    const horizonY = h * 0.90;
    const isNight = sunAlt < -6;
    const isSunset = sunAlt >= -6 && sunAlt <= 6;

    let cloudRGB = isNight ? [25, 35, 52] : (isSunset ? [240, 160, 130] : [245, 250, 255]);
    if (
      weather.condition === 'overcast' ||
      weather.condition === 'thunderstorm' ||
      weather.condition === 'severe_storm' ||
      weather.condition === 'monsoon' ||
      weather.condition === 'tropical_storm' ||
      weather.condition === 'blizzard' ||
      weather.condition === 'winter_overcast'
    ) {
      cloudRGB = isNight ? [12, 16, 25] : [110, 120, 135];
    }

    const maxCloudsToDraw = Math.floor(this.clouds.length * cloudCover);

    for (let i = 0; i < maxCloudsToDraw; i++) {
      const cloud = this.clouds[i];

      if (!this.reducedMotion) {
        const windFactor = 0.4 + Math.min(3.0, weather.windSpeedKmh / 12);
        // Weather APIs report wind direction as the direction the wind comes
        // FROM, clockwise from north. Clouds move in the opposite direction.
        const windRadians = (weather.windDirectionDeg * Math.PI) / 180;
        const horizontalWind = -Math.sin(windRadians);
        cloud.x += cloud.speed * delta * windFactor * horizontalWind;
        if (cloud.x > 1.25) cloud.x = -0.25;
        if (cloud.x < -0.25) cloud.x = 1.25;
      }

      // Layer height adjustment based on cloud type
      let yOffset = cloud.y;
      if (atmos.cloudType === 'low_stratus') {
        yOffset = 0.45 + (cloud.y * 0.45); // Concentrate near horizon
      } else if (atmos.cloudType === 'cirrus') {
        yOffset = cloud.y * 0.35; // Concentrate in high upper sky
      }

      const cx = cloud.x * w;
      const cy = yOffset * horizonY;
      const rx = atmos.cloudType === 'cirrus' ? cloud.radiusX * 1.5 : cloud.radiusX;
      const ry = atmos.cloudType === 'cirrus' ? cloud.radiusY * 0.5 : cloud.radiusY;

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
   * Weather Precipitation, Thunderstorm Lightning Bolts, Ambient Dust & Freezing Mist Particles
   */
  private drawWeatherEffects(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    weather: WeatherData,
    atmos: AtmosphericState,
    delta: number,
    time: number
  ): void {
    const cond = weather.condition;
    const horizonY = h * 0.90;

    // 1. Fog / Mist Haze Layer
    if (this.interp.haze > 0.2 || cond === 'fog' || cond === 'freezing_fog' || weather.visibilityKm < 5) {
      const fogIntensity = Math.max(this.interp.haze, (50 - weather.visibilityKm) / 50);
      const fogGrad = ctx.createLinearGradient(0, horizonY - 200, 0, h);
      const fogColor = cond === 'freezing_fog' ? '225, 235, 250' : '210, 220, 235';
      fogGrad.addColorStop(0, `rgba(${fogColor}, 0)`);
      fogGrad.addColorStop(0.6, `rgba(${fogColor}, ${(fogIntensity * 0.5).toFixed(3)})`);
      fogGrad.addColorStop(1, `rgba(${fogColor}, ${(fogIntensity * 0.75).toFixed(3)})`);
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, horizonY - 200, w, h - (horizonY - 200));
    }

    // 2. Ambient Particles: Dust / Sand Haze & Freezing Frost Ice Crystals
    const isDust = this.interp.dustAerosols > 0.08;
    const isFrost = this.interp.freezingFrost > 0.08;

    if (isDust || isFrost) {
      const count = Math.min(this.ambientParticles.length, 60);
      for (let i = 0; i < count; i++) {
        const p = this.ambientParticles[i];
        if (!this.reducedMotion) {
          p.x += p.vx * delta;
          p.y += p.vy * delta;
          if (p.y < 0.2) p.y = 0.95;
          if (p.x < 0) p.x = 1;
          if (p.x > 1) p.x = 0;
        }

        const px = p.x * w;
        const py = p.y * horizonY;

        if (isDust) {
          // Amber dust motes drifting across lower troposphere
          ctx.fillStyle = `rgba(245, 158, 11, ${(p.opacity * this.interp.dustAerosols * 0.6).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 0.8, 0, Math.PI * 2);
          ctx.fill();
        } else if (isFrost) {
          // Sparkling ice crystal needles (diamond dust)
          const sparkle = (Math.sin(time * 0.008 + p.phase) + 1) * 0.5;
          ctx.fillStyle = `rgba(224, 242, 254, ${(p.opacity * this.interp.freezingFrost * sparkle * 0.8).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(px, py, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 3. Thunderstorm: Sheet & Fork Lightning (disabled if reducedMotion)
    if (this.interp.stormActivity > 0.2 && !this.reducedMotion) {
      this.lightningTimer += delta;
      const interval = 2800 / this.interp.stormActivity;
      if (this.lightningTimer > interval && Math.random() < 0.05) {
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

    // 4. Precipitation Particles (Drizzle, Rain, Downpour, Flurries, Snow, Blizzard, Sleet)
    const precipType = atmos.precipitationType;
    if (precipType === 'none' && this.interp.precipIntensity < 0.05) return;

    const isSnowLike = precipType === 'snow' || precipType === 'flurries' || precipType === 'blizzard';
    const isBlizzard = precipType === 'blizzard';
    const isDrizzle = precipType === 'drizzle';
    const isSleet = precipType === 'sleet';

    const particleCount = isBlizzard
      ? 260
      : (precipType === 'downpour' ? 240 : (isDrizzle ? 180 : 120));

    for (let i = 0; i < particleCount; i++) {
      const p = this.precipParticles[i];

      if (!this.reducedMotion) {
        if (isSnowLike) {
          if (isBlizzard) {
            p.y += p.speedY * 0.9;
            const windRadians = (weather.windDirectionDeg * Math.PI) / 180;
            const horizontalWind = -Math.sin(windRadians);
            p.x += horizontalWind * (0.004 + (weather.windSpeedKmh / 80) * 0.012);
          } else {
            p.y += p.speedY * (precipType === 'flurries' ? 0.3 : 0.5);
            p.x += Math.sin(time * 0.002 + p.wobblePhase) * 0.001;
          }
        } else if (isDrizzle) {
          p.y += p.speedY * 0.55;
          const windRadians = (weather.windDirectionDeg * Math.PI) / 180;
          p.x += -Math.sin(windRadians) * (0.0008 + weather.windSpeedKmh / 25000);
        } else if (isSleet) {
          p.y += p.speedY * 1.8;
          const windRadians = (weather.windDirectionDeg * Math.PI) / 180;
          p.x += -Math.sin(windRadians) * (0.002 + weather.windSpeedKmh / 9000);
        } else {
          // Rain or Downpour
          const rainSpeedMult = precipType === 'downpour' ? 2.4 : 1.4;
          p.y += p.speedY * rainSpeedMult;
          const windRadians = (weather.windDirectionDeg * Math.PI) / 180;
          p.x += -Math.sin(windRadians) * (0.002 + weather.windSpeedKmh / 7000);
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

      if (isSnowLike) {
        ctx.fillStyle = `rgba(255, 255, 255, ${(p.opacity * (isBlizzard ? 0.95 : 0.8)).toFixed(3)})`;
        ctx.beginPath();
        const snowSize = isBlizzard ? p.size * 1.3 : (precipType === 'flurries' ? p.size * 0.75 : p.size);
        ctx.arc(px, py, snowSize, 0, Math.PI * 2);
        ctx.fill();
      } else if (isDrizzle) {
        // Ultra-fine micro-droplets
        ctx.fillStyle = `rgba(205, 230, 255, ${(p.opacity * 0.5).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, 1.0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Rain / Sleet / Downpour Streaks
        const len = precipType === 'downpour' ? 32 : (isSleet ? 14 : 18);
        ctx.strokeStyle = `rgba(195, 225, 255, ${(p.opacity * 0.75).toFixed(3)})`;
        ctx.lineWidth = precipType === 'downpour' ? 1.8 : (isSleet ? 1.4 : 1.1);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + p.speedX * w * 0.08, py + len);
        ctx.stroke();
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
   * Minimalist Pure Horizon Datum Baseline with Hemisphere-Aware Compass Bearings & Heat Shimmer
   */
  private drawHorizonLine(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sunAlt: number,
    _weather: WeatherData,
    atmos: AtmosphericState,
    isSouthern: boolean,
    time: number
  ): void {
    const horizonY = h * 0.90;
    const isSunset = sunAlt >= -6 && sunAlt <= 6;

    // Clean, crisp datum stroke line with heat shimmer displacement
    ctx.strokeStyle = isSunset ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    if (this.interp.heatShimmer > 0.05 && !this.reducedMotion) {
      // Convective horizon distortion wave
      const shimmerAmp = this.interp.heatShimmer * 2.5;
      ctx.moveTo(0, horizonY);
      for (let x = 0; x <= w; x += 10) {
        const wave = Math.sin(x * 0.03 + time * 0.005) * shimmerAmp;
        ctx.lineTo(x, horizonY + wave);
      }
    } else {
      ctx.moveTo(0, horizonY);
      ctx.lineTo(w, horizonY);
    }
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
      let dAz = normAz;
      if (dAz > 180) dAz -= 360;
      return w * (0.5 - dAz / 360);
    } else {
      // Observer faces South (180° is center)
      const dAz = normAz - 180;
      return w * (0.5 + dAz / 360);
    }
  }
}
