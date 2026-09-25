import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { CelestialService } from '../../../core/services/celestial.service';
import { WeatherCondition } from '../../../core/models/weather.model';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  length?: number;
  opacity: number;
  phase?: number;
  splashR?: number;
  maxSplashR?: number;
  color?: string;
}

@Component({
  selector: 'app-weather-particles',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <canvas 
      #particleCanvas 
      class="pointer-events-none fixed inset-0 w-full h-full z-[2] opacity-60 transition-opacity duration-1000">
    </canvas>
  `,
  styles: [`
    :host {
      display: block;
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
  `]
})
export class WeatherParticlesComponent implements OnInit, OnDestroy {
  @ViewChild('particleCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private celestialService = inject(CelestialService);
  private ngZone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);

  readonly weather = this.celestialService.currentWeather;
  private animFrameId: number | null = null;
  private particles: Particle[] = [];
  private splashes: Particle[] = [];

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.ngZone.runOutsideAngular(() => {
        this.initCanvas();
        this.startLoop();
      });
    }
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null && isPlatformBrowser(this.platformId)) {
      cancelAnimationFrame(this.animFrameId);
    }
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.onResize);
    }
  }

  private initCanvas(): void {
    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);
  }

  private onResize = (): void => {
    this.resizeCanvas();
    this.reseedParticles();
  };

  private resizeCanvas(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  private reseedParticles(): void {
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.width;
    const height = canvas.height;
    const cond = this.weather().condition;
    const count = this.getParticleCount(cond);

    this.particles = [];
    this.splashes = [];

    for (let i = 0; i < count; i++) {
      this.particles.push(this.createParticle(cond, width, height, true));
    }
  }

  private getParticleCount(cond: WeatherCondition): number {
    switch (cond) {
      case 'heavy_rain':
      case 'severe_thunderstorm':
        return 160;
      case 'rain':
      case 'thunderstorm':
        return 110;
      case 'drizzle':
        return 80;
      case 'blizzard':
      case 'heavy_snow':
        return 140;
      case 'snow':
        return 90;
      case 'fog':
      case 'haze':
        return 35;
      case 'cloudy':
      case 'overcast':
      case 'partly_cloudy':
        return 40;
      case 'clear':
      default:
        return 45; // Golden celestial dust motes
    }
  }

  private createParticle(cond: WeatherCondition, w: number, h: number, randomY = false): Particle {
    const windKmh = this.weather().windSpeedKmh || 15;
    const windVx = (windKmh / 20) * (Math.random() * 0.5 + 0.8);
    const x = Math.random() * (w + 200) - 100;
    const y = randomY ? Math.random() * h : -20;

    if (cond.includes('rain') || cond.includes('thunderstorm') || cond === 'drizzle') {
      const isHeavy = cond === 'heavy_rain' || cond === 'severe_thunderstorm';
      return {
        x,
        y,
        vx: windVx,
        vy: isHeavy ? Math.random() * 8 + 14 : Math.random() * 6 + 9,
        size: isHeavy ? 1.8 : 1.2,
        length: isHeavy ? Math.random() * 16 + 18 : Math.random() * 10 + 12,
        opacity: Math.random() * 0.4 + 0.4,
        color: 'rgba(186, 230, 253, '
      };
    } else if (cond === 'snow' || cond === 'heavy_snow' || cond === 'blizzard') {
      const isBlizzard = cond === 'blizzard' || cond === 'heavy_snow';
      return {
        x,
        y,
        vx: (Math.random() - 0.2) * (isBlizzard ? 5 : 2) + windVx * 0.5,
        vy: isBlizzard ? Math.random() * 3 + 3 : Math.random() * 1.5 + 1.2,
        size: Math.random() * (isBlizzard ? 4.5 : 3.5) + 1.5,
        opacity: Math.random() * 0.6 + 0.3,
        phase: Math.random() * Math.PI * 2,
        color: 'rgba(255, 255, 255, '
      };
    } else if (cond === 'fog' || cond === 'haze') {
      return {
        x,
        y: Math.random() * h,
        vx: Math.random() * 0.3 + 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        size: Math.random() * 120 + 80,
        opacity: Math.random() * 0.15 + 0.05,
        phase: Math.random() * Math.PI * 2,
        color: 'rgba(226, 232, 240, '
      };
    } else if (cond === 'cloudy' || cond === 'overcast' || cond === 'partly_cloudy') {
      return {
        x,
        y: Math.random() * (h * 0.6),
        vx: Math.random() * 0.4 + 0.2,
        vy: 0,
        size: Math.random() * 90 + 60,
        opacity: Math.random() * 0.12 + 0.04,
        phase: Math.random() * Math.PI * 2,
        color: 'rgba(203, 213, 225, '
      };
    } else {
      // Clear - Golden celestial dust motes floating gently up/sideways
      return {
        x: Math.random() * w,
        y: randomY ? Math.random() * h : h + 10,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -(Math.random() * 0.4 + 0.2),
        size: Math.random() * 2.2 + 0.8,
        opacity: Math.random() * 0.5 + 0.2,
        phase: Math.random() * Math.PI * 2,
        color: 'rgba(251, 191, 36, '
      };
    }
  }

  private startLoop(): void {
    let lastCond = this.weather().condition;
    this.reseedParticles();

    const loop = () => {
      const canvas = this.canvasRef?.nativeElement;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const currentCond = this.weather().condition;
      if (currentCond !== lastCond) {
        lastCond = currentCond;
        this.reseedParticles();
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      this.updateAndDraw(ctx, canvas.width, canvas.height, currentCond);

      this.animFrameId = requestAnimationFrame(loop);
    };

    this.animFrameId = requestAnimationFrame(loop);
  }

  private updateAndDraw(ctx: CanvasRenderingContext2D, w: number, h: number, cond: WeatherCondition): void {
    // 1. Draw splashes
    for (let i = this.splashes.length - 1; i >= 0; i--) {
      const s = this.splashes[i];
      s.splashR! += 0.8;
      s.opacity -= 0.04;

      if (s.opacity <= 0 || s.splashR! >= s.maxSplashR!) {
        this.splashes.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.splashR!, s.splashR! * 0.4, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(186, 230, 253, ${s.opacity})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // 2. Draw active particles
    const isRain = cond.includes('rain') || cond.includes('thunderstorm') || cond === 'drizzle';
    const isSnow = cond === 'snow' || cond === 'heavy_snow' || cond === 'blizzard';
    const isFog = cond === 'fog' || cond === 'haze';
    const isCloud = cond === 'cloudy' || cond === 'overcast' || cond === 'partly_cloudy';

    for (const p of this.particles) {

      if (isRain) {
        p.x += p.vx;
        p.y += p.vy;

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 1.5, p.y - p.length!);
        ctx.strokeStyle = `${p.color}${p.opacity})`;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Splash trigger at bottom area
        if (p.y >= h - Math.random() * 40) {
          if (Math.random() < 0.25 && this.splashes.length < 25) {
            this.splashes.push({
              x: p.x,
              y: p.y,
              vx: 0,
              vy: 0,
              size: 0,
              opacity: 0.7,
              splashR: 1,
              maxSplashR: Math.random() * 6 + 4
            });
          }
          // Reset particle
          Object.assign(p, this.createParticle(cond, w, h, false));
        }
      } else if (isSnow) {
        p.phase! += 0.03;
        p.x += p.vx + Math.sin(p.phase!) * 0.8;
        p.y += p.vy;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${p.opacity})`;
        ctx.fill();

        if (p.y > h + 10 || p.x > w + 20 || p.x < -20) {
          Object.assign(p, this.createParticle(cond, w, h, false));
        }
      } else if (isFog || isCloud) {
        p.phase! += 0.01;
        p.x += p.vx;
        p.y += p.vy;
        const alpha = p.opacity * (0.8 + 0.2 * Math.sin(p.phase!));

        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        grad.addColorStop(0, `${p.color}${alpha})`);
        grad.addColorStop(1, `${p.color}0)`);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        if (p.x - p.size > w) {
          p.x = -p.size;
        }
      } else {
        // Clear / Golden motes
        p.phase! += 0.02;
        p.x += p.vx + Math.sin(p.phase!) * 0.3;
        p.y += p.vy;
        const alpha = p.opacity * (0.6 + 0.4 * Math.sin(p.phase!));

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${alpha})`;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (p.y < -10) {
          Object.assign(p, this.createParticle(cond, w, h, false));
        }
      }
    }
  }
}
