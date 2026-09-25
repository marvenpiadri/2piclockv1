import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import * as THREE from 'three';
import { CelestialService } from '../../../core/services/celestial.service';
import { TimeControlService } from '../../../core/services/time-control.service';
import { LocationService } from '../../../core/services/location.service';
import { CalculatorRegistryService } from '../../../core/services/calculator-registry.service';
import { KeplerianSolverService } from '../../../core/services/keplerian-solver.service';
import { KeplerianOrbitalState } from '../../../core/astronomy/keplerian-engine';

export type CameraPreset = 'observer' | 'equatorial' | 'ecliptic' | 'body';

interface CelestialBodyVisual {
  id: string;
  name: string;
  symbol: string;
  color: string;
  radius: number;
  mesh: THREE.Mesh | THREE.Group;
  labelSprite: THREE.Sprite;
  orbitLine?: THREE.Line;
  light?: THREE.PointLight;
}

@Component({
  selector: 'app-space-view',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './space-view.html',
  styleUrl: './space-view.css'
})
export class SpaceViewComponent implements OnInit, OnDestroy {
  @ViewChild('celestialCanvas', { static: false }) canvasRef?: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  readonly isBrowser = isPlatformBrowser(this.platformId);

  private celestialService = inject(CelestialService);
  private timeControlService = inject(TimeControlService);
  private locationService = inject(LocationService);
  private registryService = inject(CalculatorRegistryService);
  private keplerianSolver = inject(KeplerianSolverService);

  readonly celestial = this.celestialService.celestialState;
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly activeDate = this.timeControlService.currentActiveDate;
  readonly solarCrossCheck = this.celestialService.solarCrossCheck;
  readonly planetaryPositions = this.celestialService.planetaryPositions;
  readonly solarCurve = this.celestialService.solarCurve;
  readonly localTime = this.celestialService.formattedLocalTime;
  readonly registryEntry = this.registryService.deepSpaceObservatoryEntry;

  // View Display Layer Toggles
  readonly showLocalHorizonMesh = signal<boolean>(true);
  readonly showEquatorialGrid = signal<boolean>(true);
  readonly showEclipticPlane = signal<boolean>(true);
  readonly showPlanetaryOrbits = signal<boolean>(true);
  readonly showStarfield = signal<boolean>(true);
  readonly activeCameraPreset = signal<CameraPreset>('observer');
  readonly selectedBodyId = signal<string>('jupiter');

  // Modals
  readonly showMathDrawer = signal<boolean>(false);
  readonly showExporterModal = signal<boolean>(false);
  readonly isExporting = signal<boolean>(false);
  readonly exportSuccessMessage = signal<string | null>(null);

  // Camera orientation angles & orbit controls
  private targetYaw = 0.55;
  private targetPitch = 0.42;
  private targetDistance = 140;
  private currentYaw = 0.55;
  private currentPitch = 0.42;
  private currentDistance = 140;

  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private hasMovedWhileDragging = false;

  // Three.js Core Objects
  private renderer: THREE.WebGLRenderer | null = null;
  private scene: THREE.Scene | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private raycaster = new THREE.Raycaster();
  private mouseVec = new THREE.Vector2();
  private animFrameId: number | null = null;

  // Three.js Groups
  private eclipticGroup = new THREE.Group();
  private equatorialGroup = new THREE.Group();
  private horizonGroup = new THREE.Group();
  private bodiesGroup = new THREE.Group();
  private starfieldGroup = new THREE.Points();

  private bodyVisuals = new Map<string, CelestialBodyVisual>();

  // Keplerian Real-time Planetary Ephemeris Collection
  readonly keplerianStates = computed<KeplerianOrbitalState[]>(() => {
    return this.keplerianSolver.currentPlanetaryStates();
  });

  // Formatted Sidereal Time
  readonly formattedSiderealTime = computed(() => {
    const loc = this.selectedLocation();
    const date = this.activeDate();
    const jd = date.getTime() / 86400000 + 2440587.5;
    const gmstDeg = (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360;
    const lstDeg = (gmstDeg + loc.longitude + 360) % 360;
    const lstHours = (lstDeg / 15 + 24) % 24;

    const h = Math.floor(lstHours);
    const m = Math.floor((lstHours - h) * 60);
    const s = Math.floor(((lstHours - h) * 60 - m) * 60);

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  });

  // Unified Body List (Sun, Moon + Keplerian Planets)
  readonly allCelestialBodies = computed(() => {
    const cel = this.celestial();
    const kepler = this.keplerianStates();
    const planetMags: Record<string, number> = {
      mercury: -0.4,
      venus: -4.4,
      mars: -1.5,
      jupiter: -2.8,
      saturn: 0.6,
      uranus: 5.7,
      neptune: 7.8
    };

    const list: {
      id: string;
      name: string;
      symbol: string;
      raDeg: number;
      decDeg: number;
      altDeg: number;
      azDeg: number;
      distanceAu: number;
      magnitude: number;
      visible: boolean;
      color: string;
      semiMajorAxisAU?: number;
      eccentricity?: number;
      inclinationDeg?: number;
      meanAnomalyDeg?: number;
      eccentricAnomalyDeg?: number;
    }[] = [
      {
        id: 'sun',
        name: 'Sun (Sol)',
        symbol: '☉',
        raDeg: (cel.sun.azimuthDeg * 0.9) % 360,
        decDeg: 0,
        altDeg: cel.sun.altitudeDeg,
        azDeg: cel.sun.azimuthDeg,
        distanceAu: 1.0,
        magnitude: -26.7,
        visible: cel.sun.altitudeDeg > -0.833,
        color: '#fbbf24'
      },
      {
        id: 'moon',
        name: 'Moon (Luna)',
        symbol: '☽',
        raDeg: (cel.moon.azimuthDeg * 0.9) % 360,
        decDeg: 5.14,
        altDeg: cel.moon.altitudeDeg,
        azDeg: cel.moon.azimuthDeg,
        distanceAu: 0.00257,
        magnitude: -12.7,
        visible: cel.moon.altitudeDeg > -0.833,
        color: '#f8fafc'
      }
    ];

    kepler.forEach(p => {
      const pid = p.name.toLowerCase();
      list.push({
        id: pid,
        name: p.name,
        symbol: p.symbol,
        raDeg: p.rightAscensionDeg,
        decDeg: p.declinationDeg,
        altDeg: p.altitudeDeg,
        azDeg: p.azimuthDeg,
        distanceAu: p.geocentricDistanceAU,
        magnitude: planetMags[pid] ?? 1.0,
        visible: p.isVisibleAboveHorizon,
        color: p.color,
        semiMajorAxisAU: p.semiMajorAxisAU,
        eccentricity: p.eccentricity,
        inclinationDeg: p.inclinationDeg,
        meanAnomalyDeg: p.meanAnomalyDeg,
        eccentricAnomalyDeg: p.eccentricAnomalyDeg
      });
    });

    return list;
  });

  // Active Selected Celestial Body Details
  readonly activeBodyDetails = computed(() => {
    const list = this.allCelestialBodies();
    const id = this.selectedBodyId();
    return list.find(b => b.id === id) || list[0];
  });

  constructor() {
    if (this.isBrowser) {
      effect(() => {
        // Track state updates reactively
        this.activeDate();
        this.selectedLocation();
        this.celestial();
        this.keplerianStates();

        const horizonVisible = this.showLocalHorizonMesh();
        const equatorialVisible = this.showEquatorialGrid();
        const eclipticVisible = this.showEclipticPlane();
        const orbitsVisible = this.showPlanetaryOrbits();
        const starfieldVisible = this.showStarfield();

        if (this.scene) {
          this.horizonGroup.visible = horizonVisible;
          this.equatorialGroup.visible = equatorialVisible;
          this.eclipticGroup.visible = eclipticVisible;
          this.starfieldGroup.visible = starfieldVisible;

          this.bodyVisuals.forEach(b => {
            if (b.orbitLine) {
              b.orbitLine.visible = orbitsVisible;
            }
          });

          this.updateScenePositions();
        }
      });
    }
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      setTimeout(() => this.initThreeScene(), 50);
    }
  }

  ngOnDestroy(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    if (this.isBrowser) {
      window.removeEventListener('resize', this.handleResize);
    }
  }

  private initThreeScene(): void {
    if (!this.canvasRef?.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;

    // 1. Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // 2. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020617);

    // 3. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.updateCameraPosition();

    // 4. Ambient & Directional Lighting
    const ambientLight = new THREE.AmbientLight(0x475569, 1.2);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 80, 50);
    this.scene.add(dirLight);

    // 5. Add Core Visualization Groups
    this.scene.add(this.eclipticGroup);
    this.scene.add(this.equatorialGroup);
    this.scene.add(this.horizonGroup);
    this.scene.add(this.bodiesGroup);

    // 6. Build Geometry Layers
    this.buildStarfield();
    this.buildEquatorialGrid();
    this.buildEclipticPlane();
    this.buildLocalHorizonMesh();
    this.buildCelestialBodies();

    // 7. Initial update of positions
    this.updateScenePositions();

    // 8. Event listeners & Render Loop
    window.addEventListener('resize', this.handleResize, { passive: true });
    this.startRenderLoop();
  }

  private handleResize = (): void => {
    if (!this.renderer || !this.camera || !this.canvasRef?.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  /**
   * Builds Deep-Space Starfield with spectral star colors and stellar magnitudes
   */
  private buildStarfield(): void {
    const starCount = 1400;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const radius = 320;

    const spectralColors = [
      new THREE.Color(0x93c5fd), // O/B blue
      new THREE.Color(0xffffff), // A white
      new THREE.Color(0xfef08a), // F/G yellow
      new THREE.Color(0xfdba74), // K orange
      new THREE.Color(0xf87171)  // M red
    ];

    for (let i = 0; i < starCount; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);

      const r = radius + (Math.random() - 0.5) * 40;
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const col = spectralColors[Math.floor(Math.random() * spectralColors.length)];
      const brightness = 0.5 + Math.random() * 0.5;
      colors[i * 3] = col.r * brightness;
      colors[i * 3 + 1] = col.g * brightness;
      colors[i * 3 + 2] = col.b * brightness;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85
    });

    this.starfieldGroup = new THREE.Points(geometry, material);
    this.scene?.add(this.starfieldGroup);
  }

  /**
   * Builds Equatorial Coordinate Sphere (Right Ascension meridians & Declination parallels)
   */
  private buildEquatorialGrid(): void {
    this.equatorialGroup.clear();
    const sphereRadius = 80;

    // Declination Circles (-60°, -30°, 0° Equator, +30°, +60°)
    [-60, -30, 0, 30, 60].forEach(decDeg => {
      const decRad = (decDeg * Math.PI) / 180;
      const r = sphereRadius * Math.cos(decRad);
      const y = sphereRadius * Math.sin(decRad);

      const circleGeo = new THREE.BufferGeometry();
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const theta = (i / 64) * Math.PI * 2;
        points.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
      }
      circleGeo.setFromPoints(points);

      const isEquator = decDeg === 0;
      const mat = new THREE.LineBasicMaterial({
        color: isEquator ? 0x38bdf8 : 0x0284c7,
        transparent: true,
        opacity: isEquator ? 0.7 : 0.25,
        linewidth: isEquator ? 2 : 1
      });

      const line = new THREE.Line(circleGeo, mat);
      this.equatorialGroup.add(line);
    });

    // RA Meridians (every 3h = 45°)
    for (let h = 0; h < 24; h += 3) {
      const raRad = ((h * 15) * Math.PI) / 180;
      const geo = new THREE.BufferGeometry();
      const points: THREE.Vector3[] = [];

      for (let d = -80; d <= 80; d += 5) {
        const decRad = (d * Math.PI) / 180;
        const x = sphereRadius * Math.cos(decRad) * Math.cos(raRad);
        const y = sphereRadius * Math.sin(decRad);
        const z = sphereRadius * Math.cos(decRad) * Math.sin(raRad);
        points.push(new THREE.Vector3(x, y, z));
      }
      geo.setFromPoints(points);

      const mat = new THREE.LineBasicMaterial({
        color: 0x0284c7,
        transparent: true,
        opacity: 0.2
      });

      const line = new THREE.Line(geo, mat);
      this.equatorialGroup.add(line);
    }

    // Polar Axis Vector
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -95, 0),
      new THREE.Vector3(0, 95, 0)
    ]);
    const axisMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 3,
      gapSize: 2,
      transparent: true,
      opacity: 0.6
    });
    const axisLine = new THREE.Line(axisGeo, axisMat);
    axisLine.computeLineDistances();
    this.equatorialGroup.add(axisLine);
  }

  /**
   * Builds the 23.44° Ecliptic Plane highway and solar system trajectory disk
   */
  private buildEclipticPlane(): void {
    this.eclipticGroup.clear();
    const eclipticRadius = 82;
    const obliquityDeg = 23.439291;

    // Tilted Ecliptic Outer Ring
    const curvePoints = this.keplerianSolver.getEclipticCurve(eclipticRadius, obliquityDeg, 120);
    const ringGeo = new THREE.BufferGeometry().setFromPoints(
      curvePoints.map(p => new THREE.Vector3(p.x, p.y, p.z))
    );

    const ringMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.85,
      linewidth: 2
    });
    const ringLine = new THREE.Line(ringGeo, ringMat);
    this.eclipticGroup.add(ringLine);

    // Glowing Ecliptic Semi-transparent Mesh Disk
    const planeGeo = new THREE.CircleGeometry(eclipticRadius, 64);
    const planeMat = new THREE.MeshBasicMaterial({
      color: 0xd97706,
      transparent: true,
      opacity: 0.06,
      side: THREE.DoubleSide
    });
    const planeMesh = new THREE.Mesh(planeGeo, planeMat);
    planeMesh.rotation.x = Math.PI / 2;
    planeMesh.rotation.z = (obliquityDeg * Math.PI) / 180;
    this.eclipticGroup.add(planeMesh);

    // Equinox & Solstice Cardinal Markers
    const equinoxPoints = [
      { name: '♈ Vernal Equinox (0h)', ra: 0, dec: 0 },
      { name: '♋ Summer Solstice (6h)', ra: 90, dec: 23.44 },
      { name: '♎ Autumnal Equinox (12h)', ra: 180, dec: 0 },
      { name: '♑ Winter Solstice (18h)', ra: 270, dec: -23.44 }
    ];

    equinoxPoints.forEach(eq => {
      const raRad = (eq.ra * Math.PI) / 180;
      const decRad = (eq.dec * Math.PI) / 180;
      const x = eclipticRadius * Math.cos(decRad) * Math.cos(raRad);
      const y = eclipticRadius * Math.sin(decRad);
      const z = eclipticRadius * Math.cos(decRad) * Math.sin(raRad);

      const dotGeo = new THREE.SphereGeometry(1.2, 12, 12);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.set(x, y, z);
      this.eclipticGroup.add(dot);
    });
  }

  /**
   * Builds Local Observer Horizon Mesh (Alt-Az grid, Zenith, Nadir, Cardinal Compass Points)
   */
  private buildLocalHorizonMesh(): void {
    this.horizonGroup.clear();
    const horizonRadius = 78;

    // Horizon Circle (Altitude = 0°)
    const circleGeo = new THREE.BufferGeometry();
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      points.push(new THREE.Vector3(horizonRadius * Math.cos(theta), 0, horizonRadius * Math.sin(theta)));
    }
    circleGeo.setFromPoints(points);

    const horizonMat = new THREE.LineBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.8,
      linewidth: 2
    });
    const horizonCircle = new THREE.Line(circleGeo, horizonMat);
    this.horizonGroup.add(horizonCircle);

    // Altitude Rings (+30°, +60°)
    [30, 60].forEach(altDeg => {
      const altRad = (altDeg * Math.PI) / 180;
      const r = horizonRadius * Math.cos(altRad);
      const y = horizonRadius * Math.sin(altRad);

      const geo = new THREE.BufferGeometry();
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const theta = (i / 64) * Math.PI * 2;
        pts.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
      }
      geo.setFromPoints(pts);

      const mat = new THREE.LineBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.35
      });
      this.horizonGroup.add(new THREE.Line(geo, mat));
    });

    // Observer Zenith & Nadir Vector Ray
    const zenithGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -horizonRadius * 1.1, 0),
      new THREE.Vector3(0, horizonRadius * 1.1, 0)
    ]);
    const zenithMat = new THREE.LineDashedMaterial({
      color: 0x10b981,
      dashSize: 2.5,
      gapSize: 2,
      transparent: true,
      opacity: 0.6
    });
    const zenithRay = new THREE.Line(zenithGeo, zenithMat);
    zenithRay.computeLineDistances();
    this.horizonGroup.add(zenithRay);

    // Cardinal Points (N, E, S, W)
    const cardinals = [
      { label: 'NORTH', color: '#ef4444', x: 0, z: -horizonRadius },
      { label: 'EAST', color: '#38bdf8', x: horizonRadius, z: 0 },
      { label: 'SOUTH', color: '#fbbf24', x: 0, z: horizonRadius },
      { label: 'WEST', color: '#a78bfa', x: -horizonRadius, z: 0 }
    ];

    cardinals.forEach(c => {
      const sprite = this.createTextSprite(c.label, c.color, 12);
      sprite.position.set(c.x * 1.08, 0, c.z * 1.08);
      this.horizonGroup.add(sprite);

      // Cardinal Ray line
      const rayGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(c.x, 0, c.z)
      ]);
      const rayMat = new THREE.LineBasicMaterial({
        color: 0x059669,
        transparent: true,
        opacity: 0.3
      });
      this.horizonGroup.add(new THREE.Line(rayGeo, rayMat));
    });
  }

  /**
   * Builds 3D Celestial Bodies (Sun, Moon, Keplerian Planets) with geometries, glow, and orbit paths
   */
  private buildCelestialBodies(): void {
    this.bodiesGroup.clear();
    this.bodyVisuals.clear();

    const planetDefs: {
      id: string;
      name: string;
      symbol: string;
      color: number;
      size: number;
      hasRings?: boolean;
    }[] = [
      { id: 'sun', name: 'Sun', symbol: '☉', color: 0xfbbf24, size: 4.5 },
      { id: 'moon', name: 'Moon', symbol: '☽', color: 0xf1f5f9, size: 2.2 },
      { id: 'mercury', name: 'Mercury', symbol: '☿', color: 0x94a3b8, size: 1.5 },
      { id: 'venus', name: 'Venus', symbol: '♀', color: 0xfef08a, size: 2.3 },
      { id: 'earth', name: 'Earth', symbol: '🜨', color: 0x38bdf8, size: 2.4 },
      { id: 'mars', name: 'Mars', symbol: '♂', color: 0xf87171, size: 1.8 },
      { id: 'jupiter', name: 'Jupiter', symbol: '♃', color: 0xfdba74, size: 3.8 },
      { id: 'saturn', name: 'Saturn', symbol: '♄', color: 0xfde047, size: 3.2, hasRings: true },
      { id: 'uranus', name: 'Uranus', symbol: '♅', color: 0x67e8f9, size: 2.6 },
      { id: 'neptune', name: 'Neptune', symbol: '♆', color: 0x818cf8, size: 2.5 }
    ];

    planetDefs.forEach(def => {
      const group = new THREE.Group();
      group.name = def.id;

      // 1. Core Sphere Mesh
      const geo = new THREE.SphereGeometry(def.size, 24, 24);
      let mat: THREE.Material;

      if (def.id === 'sun') {
        mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
      } else {
        mat = new THREE.MeshStandardMaterial({
          color: def.color,
          roughness: 0.4,
          metalness: 0.1
        });
      }

      const sphere = new THREE.Mesh(geo, mat);
      sphere.userData = { id: def.id, name: def.name };
      group.add(sphere);

      // 2. Saturn 3D Rings
      if (def.hasRings) {
        const ringGeo = new THREE.RingGeometry(def.size * 1.4, def.size * 2.3, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: 0xfde68a,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.75
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2.4;
        group.add(ringMesh);
      }

      // 3. Solar Corona Glow & Point Light
      let light: THREE.PointLight | undefined;
      if (def.id === 'sun') {
        light = new THREE.PointLight(0xfef08a, 2.0, 400);
        group.add(light);

        // Corona Aura
        const coronaGeo = new THREE.SphereGeometry(def.size * 1.6, 16, 16);
        const coronaMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.25
        });
        group.add(new THREE.Mesh(coronaGeo, coronaMat));
      }

      // 4. Text Label Sprite
      const hexColor = '#' + def.color.toString(16).padStart(6, '0');
      const labelSprite = this.createTextSprite(`${def.symbol} ${def.name}`, hexColor, 11);
      labelSprite.position.set(0, def.size + 3.5, 0);
      group.add(labelSprite);

      // 5. Orbit Line Placeholder
      const orbitGeo = new THREE.BufferGeometry();
      const orbitMat = new THREE.LineBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.4,
        linewidth: 1
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      this.bodiesGroup.add(orbitLine);

      this.bodiesGroup.add(group);

      this.bodyVisuals.set(def.id, {
        id: def.id,
        name: def.name,
        symbol: def.symbol,
        color: hexColor,
        radius: def.size,
        mesh: group,
        labelSprite,
        orbitLine,
        light
      });
    });
  }

  /**
   * Synchronizes 3D celestial body coordinates and orbital paths with Keplerian solver and celestial state
   */
  private updateScenePositions(): void {
    if (!this.scene) return;

    const celestial = this.celestial();
    const keplerStates = this.keplerianStates();
    const loc = this.selectedLocation();
    const sphereRadius = 80;

    // 1. Orient Local Horizon Mesh based on Observer Latitude & Local Sidereal Time
    const jd = this.activeDate().getTime() / 86400000 + 2440587.5;
    const gmstDeg = (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360;
    const lstDeg = (gmstDeg + loc.longitude + 360) % 360;

    // Horizon orientation in Equatorial system:
    // Rotate by -LST around Y (polar axis) and (90 - lat) around X (tilt)
    this.horizonGroup.rotation.y = -(lstDeg * Math.PI) / 180;
    this.horizonGroup.rotation.z = ((90 - loc.latitude) * Math.PI) / 180;

    // 2. Position Sun
    const sunVis = this.bodyVisuals.get('sun');
    if (sunVis) {
      // Calculate 3D Cartesian coordinates from Sun Azimuth & Altitude or RA/Dec
      const sunAltRad = (celestial.sun.altitudeDeg * Math.PI) / 180;
      const sunAzRad = (celestial.sun.azimuthDeg * Math.PI) / 180;

      // In local horizontal frame
      const hx = sphereRadius * Math.cos(sunAltRad) * Math.sin(sunAzRad);
      const hy = sphereRadius * Math.sin(sunAltRad);
      const hz = -sphereRadius * Math.cos(sunAltRad) * Math.cos(sunAzRad);

      const worldPos = new THREE.Vector3(hx, hy, hz).applyEuler(this.horizonGroup.rotation);
      sunVis.mesh.position.copy(worldPos);
    }

    // 3. Position Moon
    const moonVis = this.bodyVisuals.get('moon');
    if (moonVis) {
      const moonAltRad = (celestial.moon.altitudeDeg * Math.PI) / 180;
      const moonAzRad = (celestial.moon.azimuthDeg * Math.PI) / 180;

      const mx = (sphereRadius - 4) * Math.cos(moonAltRad) * Math.sin(moonAzRad);
      const my = (sphereRadius - 4) * Math.sin(moonAltRad);
      const mz = -(sphereRadius - 4) * Math.cos(moonAltRad) * Math.cos(moonAzRad);

      const worldPos = new THREE.Vector3(mx, my, mz).applyEuler(this.horizonGroup.rotation);
      moonVis.mesh.position.copy(worldPos);
    }

    // 4. Position Keplerian Planets & Update 3D Orbits
    keplerStates.forEach(planet => {
      const id = planet.name.toLowerCase();
      const vis = this.bodyVisuals.get(id);
      if (!vis) return;

      // Equatorial RA/Dec to 3D Cartesian Position
      const raRad = (planet.rightAscensionDeg * Math.PI) / 180;
      const decRad = (planet.declinationDeg * Math.PI) / 180;
      const dist = Math.min(120, Math.max(40, sphereRadius * 0.9 + planet.semiMajorAxisAU * 2));

      const px = dist * Math.cos(decRad) * Math.cos(raRad);
      const py = dist * Math.sin(decRad);
      const pz = dist * Math.cos(decRad) * Math.sin(raRad);

      vis.mesh.position.set(px, py, pz);

      // Update 3D Keplerian Orbit Path
      if (vis.orbitLine && planet.orbitPoints && planet.orbitPoints.length > 0) {
        const orbitScale = sphereRadius * 0.15;
        const pts: THREE.Vector3[] = planet.orbitPoints.map(pt => {
          // pt is heliocentric 3D Cartesian
          // Convert from Ecliptic to Equatorial frame
          const epsRad = (23.439291 * Math.PI) / 180;
          const eqX = pt.x * orbitScale;
          const eqY = (pt.y * Math.cos(epsRad) - pt.z * Math.sin(epsRad)) * orbitScale;
          const eqZ = (pt.y * Math.sin(epsRad) + pt.z * Math.cos(epsRad)) * orbitScale;
          return new THREE.Vector3(eqX, eqY, eqZ);
        });

        vis.orbitLine.geometry.setFromPoints(pts);
      }
    });
  }

  /**
   * Helper to create high-resolution 2D Canvas Text Sprites in Three.js
   */
  private createTextSprite(text: string, color = '#ffffff', fontSize = 14): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    ctx.font = `bold ${fontSize * 2}px monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(16, 4, 1);
    return sprite;
  }

  private startRenderLoop(): void {
    const loop = () => {
      this.render();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private render(): void {
    if (!this.renderer || !this.scene || !this.camera) return;

    // Smooth camera damping interpolation
    const damping = 0.08;
    this.currentYaw += (this.targetYaw - this.currentYaw) * damping;
    this.currentPitch += (this.targetPitch - this.currentPitch) * damping;
    this.currentDistance += (this.targetDistance - this.currentDistance) * damping;

    this.updateCameraPosition();

    // Subtle starfield twinkling / rotation
    if (this.starfieldGroup) {
      this.starfieldGroup.rotation.y += 0.00015;
    }

    this.renderer.render(this.scene, this.camera);
  }

  private updateCameraPosition(): void {
    if (!this.camera) return;
    const phi = Math.max(0.01, Math.min(Math.PI - 0.01, Math.PI / 2 - this.currentPitch));
    const theta = this.currentYaw;

    const x = this.currentDistance * Math.sin(phi) * Math.cos(theta);
    const y = this.currentDistance * Math.cos(phi);
    const z = this.currentDistance * Math.sin(phi) * Math.sin(theta);

    this.camera.position.set(x, y, z);
    this.camera.lookAt(0, 0, 0);
  }

  // --- Interaction & Controls ---

  onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.hasMovedWhileDragging = false;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      this.hasMovedWhileDragging = true;
    }

    this.targetYaw -= dx * 0.006;
    this.targetPitch += dy * 0.006;
    this.targetPitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.targetPitch));

    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  onMouseUp(e?: MouseEvent): void {
    if (this.isDragging && !this.hasMovedWhileDragging && e && this.canvasRef?.nativeElement) {
      // Raycast click selection
      this.handleRaycastClick(e);
    }
    this.isDragging = false;
  }

  onWheel(e: WheelEvent): void {
    e.preventDefault();
    this.targetDistance += e.deltaY * 0.12;
    this.targetDistance = Math.max(40, Math.min(300, this.targetDistance));
  }

  private handleRaycastClick(e: MouseEvent): void {
    if (!this.camera || !this.scene || !this.canvasRef?.nativeElement) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();

    this.mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouseVec, this.camera);
    const intersects = this.raycaster.intersectObjects(this.bodiesGroup.children, true);

    if (intersects.length > 0) {
      let targetObj: THREE.Object3D | null = intersects[0].object;
      while (targetObj && targetObj.parent !== this.bodiesGroup && targetObj.parent) {
        targetObj = targetObj.parent;
      }
      if (targetObj && targetObj.name) {
        this.selectedBodyId.set(targetObj.name);
      }
    }
  }

  selectBody(bodyOrId: string | { id: string }): void {
    const id = typeof bodyOrId === 'string' ? bodyOrId : bodyOrId.id;
    this.selectedBodyId.set(id);
    const vis = this.bodyVisuals.get(id);
    if (vis) {
      // Orient camera toward selected body
      const pos = vis.mesh.position;
      const r = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
      this.targetYaw = Math.atan2(pos.z, pos.x);
      this.targetPitch = Math.atan2(pos.y, r);
    }
  }

  setCameraPreset(preset: CameraPreset): void {
    this.activeCameraPreset.set(preset);

    if (preset === 'observer') {
      this.targetYaw = 0.55;
      this.targetPitch = 0.42;
      this.targetDistance = 140;
    } else if (preset === 'equatorial') {
      // Look down polar axis
      this.targetYaw = 0;
      this.targetPitch = 1.45;
      this.targetDistance = 150;
    } else if (preset === 'ecliptic') {
      // Ecliptic tilt 23.44°
      this.targetYaw = Math.PI / 2;
      this.targetPitch = (23.44 * Math.PI) / 180;
      this.targetDistance = 160;
    }
  }

  resetCamera(): void {
    this.setCameraPreset('observer');
  }

  /**
   * One-Tap 1200x630 Graphic Card Exporter
   */
  async exportGraphicCard(): Promise<void> {
    if (!this.isBrowser || this.isExporting()) return;

    this.isExporting.set(true);
    this.exportSuccessMessage.set(null);

    try {
      // Render clean frame in WebGL
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }

      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext('2d')!;

      // 1. Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 630);
      bgGrad.addColorStop(0, '#020617');
      bgGrad.addColorStop(1, '#09152e');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 630);

      // 2. Composite WebGL 3D canvas render
      if (this.canvasRef?.nativeElement) {
        const webglCanvas = this.canvasRef.nativeElement;
        ctx.drawImage(webglCanvas, 240, 20, 940, 590);
      }

      // 3. Left Brand & Telemetry Panel
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.fillRect(30, 30, 340, 570);
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(30, 30, 340, 570);

      // Brand Heading
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('2PiClock OBSERVATORY', 50, 75);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px sans-serif';
      ctx.fillText('DEEP-SPACE CELESTIAL SPHERE', 50, 98);

      // Observer Information
      const loc = this.selectedLocation();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(`${loc.flag} ${loc.name}`, 50, 150);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '13px monospace';
      ctx.fillText(`LAT: ${loc.latitude.toFixed(2)}° | LNG: ${loc.longitude.toFixed(2)}°`, 50, 175);
      ctx.fillText(`LST: ${this.formattedSiderealTime()}`, 50, 198);
      ctx.fillText(`LOCAL TIME: ${this.localTime()}`, 50, 221);

      // Ephemeris Target Details
      const body = this.activeBodyDetails();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`EPHEMERIS TARGET: ${body.symbol} ${body.name}`, 50, 280);

      ctx.fillStyle = '#cbd5e1';
      ctx.font = '12px monospace';
      ctx.fillText(`Altitude: ${body.altDeg >= 0 ? '+' : ''}${body.altDeg.toFixed(2)}°`, 50, 310);
      ctx.fillText(`Azimuth:  ${body.azDeg.toFixed(2)}°`, 50, 332);
      ctx.fillText(`RA (α):   ${(body.raDeg / 15).toFixed(2)}h (${body.raDeg.toFixed(1)}°)`, 50, 354);
      ctx.fillText(`Dec (δ):  ${body.decDeg >= 0 ? '+' : ''}${body.decDeg.toFixed(2)}°`, 50, 376);
      ctx.fillText(`Distance: ${body.distanceAu.toFixed(3)} AU`, 50, 398);

      // Footer
      ctx.fillStyle = '#64748b';
      ctx.font = '10px monospace';
      ctx.fillText('SOLVED VIA NEWTON-RAPHSON KEPLER ENGINE', 50, 560);
      ctx.fillText('2PiClock ASTRONOMICAL SUITE · UTC-STAMPED', 50, 580);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `2piclock-observatory-${loc.id}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      this.exportSuccessMessage.set('Ultra-premium 1200x630 graphic card exported successfully!');
      setTimeout(() => this.exportSuccessMessage.set(null), 5000);
    } catch (err) {
      console.error('Failed to export graphic card:', err);
    } finally {
      this.isExporting.set(false);
    }
  }
}
