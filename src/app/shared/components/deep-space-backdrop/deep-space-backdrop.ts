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

interface DynamicStar {
  x: number; // Normalized 0..1
  y: number; // Normalized 0..1
  z: number; // Depth layer 0.1 (far) to 1.0 (near)
  radius: number;
  color: string;
  glowColor: string;
  twinkleSpeed: number;
  twinklePhase: number;
  hasSpikes: boolean;
}

interface MeteorParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  length: number;
  alpha: number;
  color: string;
  sparks: MeteorParticle[];
  isBolide: boolean;
}

interface ConstellationStar {
  x: number; // 0..1
  y: number; // 0..1
  name: string;
  mag: number;
}

interface Constellation {
  name: string;
  stars: ConstellationStar[];
  edges: [number, number][]; // Pair of indices in stars array
}

interface NebulaGas {
  x: number;
  y: number;
  radiusX: number;
  radiusY: number;
  rotation: number;
  stops: { offset: number; color: string }[];
  pulseSpeed: number;
  pulsePhase: number;
}

@Component({
  selector: 'app-deep-space-backdrop',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './deep-space-backdrop.html',
  styleUrl: './deep-space-backdrop.css'
})
export class DeepSpaceBackdropComponent implements OnInit, OnDestroy {
  @ViewChild('spaceCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);
  private celestialService = inject(CelestialService);

  readonly celestial = this.celestialService.celestialState;

  private ctx: CanvasRenderingContext2D | null = null;
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  private animFrameId: number | null = null;
  private lastTime = 0;
  private width = 0;
  private height = 0;
  private dpr = 1;

  // Parallax interaction
  private targetMouseX = 0;
  private targetMouseY = 0;
  private mouseX = 0;
  private mouseY = 0;

  // Space assets
  private dynamicStars: DynamicStar[] = [];
  private meteors: Meteor[] = [];
  private nebulae: NebulaGas[] = [];
  private constellations: Constellation[] = [];
  private lastMeteorSpawn = 0;

  ngOnInit(): void {
    if (this.isBrowser) {
      this.initCanvas();
      this.initSpaceObjects();
      this.buildOffscreenBackground();
      this.startLoop();
      window.addEventListener('pointermove', this.handlePointerMove, { passive: true });
    }
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.isBrowser) {
      window.removeEventListener('resize', this.handleResize);
      window.removeEventListener('pointermove', this.handlePointerMove);
    }
  }

  private initCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.handleResize();
    window.addEventListener('resize', this.handleResize, { passive: true });
  }

  private handlePointerMove = (e: PointerEvent): void => {
    // Convert mouse to centered normalized offset (-0.5 to +0.5)
    this.targetMouseX = (e.clientX / (window.innerWidth || 1)) - 0.5;
    this.targetMouseY = (e.clientY / (window.innerHeight || 1)) - 0.5;
  };

  private handleResize = (): void => {
    if (!this.canvasRef) return;
    const canvas = this.canvasRef.nativeElement;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    canvas.width = Math.floor(this.width * this.dpr);
    canvas.height = Math.floor(this.height * this.dpr);

    if (this.ctx) {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(this.dpr, this.dpr);
    }

    this.buildOffscreenBackground();
  };

  private initSpaceObjects(): void {
    // 1. Dynamic Mid/Foreground Stars with Spectral Classes
    const spectralTypes = [
      { color: '#a5f3fc', glow: 'rgba(56, 189, 248, 0.4)' },  // O/B Class - Deep Sapphire/Cyan
      { color: '#ffffff', glow: 'rgba(255, 255, 255, 0.5)' },  // A Class - Brilliant Diamond White
      { color: '#fef08a', glow: 'rgba(250, 204, 21, 0.35)' }, // F/G Class - Sol Gold
      { color: '#fed7aa', glow: 'rgba(251, 146, 60, 0.35)' }, // K Class - Warm Amber
      { color: '#fca5a5', glow: 'rgba(248, 113, 113, 0.4)' }  // M Class - Red Supergiant
    ];

    this.dynamicStars = [];
    for (let i = 0; i < 380; i++) {
      const z = Math.pow(Math.random(), 1.5) * 0.85 + 0.15; // Realistic depth falloff
      const spec = spectralTypes[Math.floor(Math.random() * spectralTypes.length)];
      const isBright = z > 0.82 && Math.random() < 0.35;

      this.dynamicStars.push({
        x: Math.random(),
        y: Math.random(),
        z,
        radius: isBright ? 1.6 + Math.random() * 1.2 : 0.6 + z * 0.9,
        color: spec.color,
        glowColor: spec.glow,
        twinkleSpeed: 0.8 + Math.random() * 3.2,
        twinklePhase: Math.random() * Math.PI * 2,
        hasSpikes: isBright
      });
    }

    // 2. Cosmic Nebulae Clouds
    this.nebulae = [
      {
        x: 0.3,
        y: 0.35,
        radiusX: 420,
        radiusY: 280,
        rotation: -0.3,
        stops: [
          { offset: 0, color: 'rgba(99, 102, 241, 0.12)' },
          { offset: 0.5, color: 'rgba(79, 70, 229, 0.05)' },
          { offset: 1, color: 'rgba(0, 0, 0, 0)' }
        ],
        pulseSpeed: 0.3,
        pulsePhase: 0
      },
      {
        x: 0.72,
        y: 0.5,
        radiusX: 520,
        radiusY: 340,
        rotation: 0.4,
        stops: [
          { offset: 0, color: 'rgba(168, 85, 247, 0.10)' },
          { offset: 0.6, color: 'rgba(147, 51, 234, 0.04)' },
          { offset: 1, color: 'rgba(0, 0, 0, 0)' }
        ],
        pulseSpeed: 0.25,
        pulsePhase: 1.5
      },
      {
        x: 0.5,
        y: 0.8,
        radiusX: 460,
        radiusY: 260,
        rotation: 0.1,
        stops: [
          { offset: 0, color: 'rgba(236, 72, 153, 0.08)' },
          { offset: 0.5, color: 'rgba(219, 39, 119, 0.03)' },
          { offset: 1, color: 'rgba(0, 0, 0, 0)' }
        ],
        pulseSpeed: 0.4,
        pulsePhase: 3.1
      }
    ];

    // 3. Real Constellations
    this.constellations = [
      {
        name: 'Orion',
        stars: [
          { x: 0.16, y: 0.28, name: 'Betelgeuse', mag: 1 },
          { x: 0.24, y: 0.31, name: 'Bellatrix', mag: 2 },
          { x: 0.19, y: 0.39, name: 'Alnitak', mag: 2 },
          { x: 0.21, y: 0.40, name: 'Alnilam', mag: 2 },
          { x: 0.23, y: 0.41, name: 'Mintaka', mag: 2 },
          { x: 0.17, y: 0.50, name: 'Saiph', mag: 2 },
          { x: 0.25, y: 0.48, name: 'Rigel', mag: 1 }
        ],
        edges: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]]
      },
      {
        name: 'Cassiopeia',
        stars: [
          { x: 0.74, y: 0.16, name: 'Caph', mag: 2 },
          { x: 0.78, y: 0.20, name: 'Schedar', mag: 2 },
          { x: 0.82, y: 0.17, name: 'Navi', mag: 2 },
          { x: 0.86, y: 0.22, name: 'Ruchbah', mag: 2 },
          { x: 0.90, y: 0.18, name: 'Segin', mag: 2 }
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 4]]
      },
      {
        name: 'Ursa Major',
        stars: [
          { x: 0.42, y: 0.15, name: 'Dubhe', mag: 2 },
          { x: 0.40, y: 0.22, name: 'Merak', mag: 2 },
          { x: 0.48, y: 0.23, name: 'Phecda', mag: 2 },
          { x: 0.49, y: 0.17, name: 'Megrez', mag: 2 },
          { x: 0.55, y: 0.18, name: 'Alioth', mag: 2 },
          { x: 0.60, y: 0.19, name: 'Mizar', mag: 2 },
          { x: 0.65, y: 0.22, name: 'Alkaid', mag: 2 }
        ],
        edges: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]]
      }
    ];
  }

  /**
   * Pre-renders 2000+ static background micro-stars and the Milky Way dust band
   * to an offscreen buffer canvas for maximum 60fps performance.
   */
  private buildOffscreenBackground(): void {
    if (!this.isBrowser || this.width === 0 || this.height === 0) return;

    if (!this.offscreenCanvas) {
      this.offscreenCanvas = document.createElement('canvas');
    }
    const canvas = this.offscreenCanvas;
    canvas.width = Math.floor(this.width * this.dpr);
    canvas.height = Math.floor(this.height * this.dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.offscreenCtx = ctx;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(this.dpr, this.dpr);

    const w = this.width;
    const h = this.height;

    // 1. Deep Space Base Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#010309');
    bgGrad.addColorStop(0.5, '#020612');
    bgGrad.addColorStop(1, '#010206');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Milky Way Galactic Band (Diagonal subtle glow)
    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.rotate(-Math.PI / 5);
    const mwGrad = ctx.createRadialGradient(0, 0, 50, 0, 0, Math.max(w, h) * 0.7);
    mwGrad.addColorStop(0, 'rgba(147, 197, 253, 0.06)');
    mwGrad.addColorStop(0.3, 'rgba(165, 180, 252, 0.03)');
    mwGrad.addColorStop(0.7, 'rgba(99, 102, 241, 0.015)');
    mwGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = mwGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.8, h * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3. Dense Static Micro-Star Field (2,200 stars)
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 2200; i++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h;
      const radius = 0.25 + Math.random() * 0.6;
      const alpha = 0.15 + Math.random() * 0.65;

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private startLoop(): void {
    const loop = (timestamp: number) => {
      if (!this.lastTime) this.lastTime = timestamp;
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
      this.lastTime = timestamp;

      this.render(timestamp / 1000, dt);
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private render(tSec: number, dt: number): void {
    if (!this.ctx || this.width === 0 || this.height === 0) return;

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Smooth Mouse Damping for Parallax
    this.mouseX += (this.targetMouseX - this.mouseX) * (dt * 4);
    this.mouseY += (this.targetMouseY - this.mouseY) * (dt * 4);

    // 1. Draw Pre-rendered Background Buffer
    if (this.offscreenCanvas) {
      ctx.drawImage(this.offscreenCanvas, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#010206';
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Volumetric Nebulae
    this.renderNebulae(ctx, w, h, tSec);

    // 3. Constellations
    this.renderConstellations(ctx, w, h, tSec);

    // 4. Dynamic Parallax Starfield
    this.renderDynamicStars(ctx, w, h, tSec);

    // 5. Shooting Stars / Meteors & Bolides
    this.updateAndRenderMeteors(ctx, w, h, tSec, dt);
  }

  private renderNebulae(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    tSec: number
  ): void {
    ctx.save();
    for (const neb of this.nebulae) {
      const cx = neb.x * w + this.mouseX * 15;
      const cy = neb.y * h + this.mouseY * 15;
      const pulse = 1 + 0.08 * Math.sin(tSec * neb.pulseSpeed + neb.pulsePhase);
      const rx = neb.radiusX * pulse;
      const ry = neb.radiusY * pulse;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(neb.rotation);

      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
      for (const stop of neb.stops) {
        grad.addColorStop(stop.offset, stop.color);
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  private renderConstellations(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    tSec: number
  ): void {
    ctx.save();
    const lineAlpha = 0.18 + 0.06 * Math.sin(tSec * 0.7);

    for (const constel of this.constellations) {
      ctx.strokeStyle = `rgba(165, 180, 252, ${lineAlpha})`;
      ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 4]);

      // Edges
      for (const [fromIdx, toIdx] of constel.edges) {
        const p1 = constel.stars[fromIdx];
        const p2 = constel.stars[toIdx];
        if (!p1 || !p2) continue;

        const x1 = p1.x * w + this.mouseX * 25;
        const y1 = p1.y * h + this.mouseY * 25;
        const x2 = p2.x * w + this.mouseX * 25;
        const y2 = p2.y * h + this.mouseY * 25;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Stars in Constellation
      for (const star of constel.stars) {
        const sx = star.x * w + this.mouseX * 25;
        const sy = star.y * h + this.mouseY * 25;

        // Halo
        ctx.fillStyle = 'rgba(165, 180, 252, 0.3)';
        ctx.beginPath();
        ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = 'rgba(199, 210, 254, 0.35)';
        ctx.font = '9px monospace';
        ctx.fillText(star.name, sx + 6, sy - 2);
      }
    }
    ctx.restore();
  }

  private renderDynamicStars(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    tSec: number
  ): void {
    ctx.save();
    for (const star of this.dynamicStars) {
      const offsetX = this.mouseX * (star.z * 40);
      const offsetY = this.mouseY * (star.z * 40);
      const sx = star.x * w + offsetX;
      const sy = star.y * h + offsetY;

      // Multi-frequency atmospheric scintillation (subtle opacity-based stellar twinkling)
      const primarySine = Math.sin(tSec * star.twinkleSpeed + star.twinklePhase);
      const secondarySine = Math.sin(tSec * (star.twinkleSpeed * 2.37) + (star.twinklePhase * 1.83));
      const shimmerWave = Math.sin(tSec * 0.45 + star.twinklePhase * 0.7);

      // Normalized opacity oscillation between 0.12 and 1.00
      const twinkleFactor = 0.60 + 0.28 * primarySine + 0.12 * secondarySine;
      const alpha = Math.max(0.12, Math.min(1.0, star.z * twinkleFactor * (0.85 + 0.15 * shimmerWave)));

      // Outer Halo for bright or close stars
      if (star.radius > 1.2) {
        ctx.fillStyle = star.glowColor;
        ctx.globalAlpha = alpha * 0.4;
        ctx.beginPath();
        ctx.arc(sx, sy, star.radius * 2.4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Star Core
      ctx.fillStyle = star.color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
      ctx.fill();

      // Diffraction Cross Spikes for bright primary stars
      if (star.hasSpikes) {
        ctx.strokeStyle = star.color;
        ctx.lineWidth = 0.7;
        ctx.globalAlpha = alpha * 0.45;

        const spikeLen = star.radius * 3.5;
        ctx.beginPath();
        ctx.moveTo(sx - spikeLen, sy);
        ctx.lineTo(sx + spikeLen, sy);
        ctx.moveTo(sx, sy - spikeLen);
        ctx.lineTo(sx, sy + spikeLen);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  private updateAndRenderMeteors(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    tSec: number,
    dt: number
  ): void {
    // Spawn meteor every 3 - 6 seconds
    if (tSec - this.lastMeteorSpawn > 3.2 && Math.random() < 0.05) {
      this.lastMeteorSpawn = tSec;
      const isBolide = Math.random() < 0.15; // 15% chance of bright bolide/fireball
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.35; // ~45 degrees diagonal
      const speed = isBolide ? (18 + Math.random() * 8) : (12 + Math.random() * 8);

      this.meteors.push({
        x: Math.random() * w * 0.8,
        y: Math.random() * h * 0.35,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: isBolide ? (140 + Math.random() * 100) : (70 + Math.random() * 80),
        alpha: 1,
        color: isBolide ? '#fef08a' : (Math.random() > 0.4 ? '#67e8f9' : '#a5f3fc'),
        sparks: [],
        isBolide
      });
    }

    ctx.save();
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i];
      m.x += m.vx;
      m.y += m.vy;
      m.alpha -= dt * (m.isBolide ? 0.7 : 1.2);

      // Add trail spark particle
      if (m.alpha > 0.3) {
        m.sparks.push({
          x: m.x - (Math.random() - 0.5) * 4,
          y: m.y - (Math.random() - 0.5) * 4,
          vx: -m.vx * 0.1 + (Math.random() - 0.5) * 2,
          vy: -m.vy * 0.1 + (Math.random() - 0.5) * 2,
          life: 0,
          maxLife: 0.3 + Math.random() * 0.4,
          size: 1 + Math.random() * 2,
          color: m.color
        });
      }

      // Update & Render Sparks
      for (let j = m.sparks.length - 1; j >= 0; j--) {
        const s = m.sparks[j];
        s.x += s.vx;
        s.y += s.vy;
        s.life += dt;
        if (s.life >= s.maxLife) {
          m.sparks.splice(j, 1);
          continue;
        }
        const sparkAlpha = (1 - s.life / s.maxLife) * m.alpha;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = sparkAlpha;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      }

      if (m.alpha <= 0 || m.x > w + 150 || m.y > h + 150) {
        this.meteors.splice(i, 1);
        continue;
      }

      // Main Meteor Streak Line
      const tailX = m.x - (m.vx / 10) * m.length;
      const tailY = m.y - (m.vy / 10) * m.length;

      const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, m.color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.strokeStyle = grad;
      ctx.lineWidth = m.isBolide ? 2.8 : 1.6;
      ctx.globalAlpha = m.alpha;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();

      // Glow Head
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = m.alpha;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.isBolide ? 3.5 : 2.0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
