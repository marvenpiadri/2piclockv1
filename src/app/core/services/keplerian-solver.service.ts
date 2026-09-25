import { Injectable, computed, inject } from '@angular/core';
import { TimeControlService } from './time-control.service';
import { LocationService } from './location.service';
import {
  computeKeplerianState,
  computeHeliocentricVector,
  solveKeplersEquation,
  normalizeAngleDeg,
  JPL_KEPLERIAN_ELEMENTS,
  KeplerianOrbitalState
} from '../astronomy/keplerian-engine';

export interface EclipticPoint {
  longitudeDeg: number;
  rightAscensionDeg: number;
  declinationDeg: number;
  x: number;
  y: number;
  z: number;
}

@Injectable({
  providedIn: 'root'
})
export class KeplerianSolverService {
  private timeControlService = inject(TimeControlService);
  private locationService = inject(LocationService);

  readonly activeDate = this.timeControlService.currentActiveDate;
  readonly selectedLocation = this.locationService.selectedLocation;

  /**
   * Solves Kepler's equation M = E - e*sin(E) for Eccentric Anomaly E (in radians)
   */
  solveKepler(meanAnomalyRad: number, eccentricity: number, maxIterations = 15, tolerance = 1e-8): number {
    return solveKeplersEquation(meanAnomalyRad, eccentricity, maxIterations, tolerance);
  }

  /**
   * Evaluates all planetary positions and orbital states for a given instant and observer coordinates
   */
  getPlanetaryStates(date: Date, latitudeDeg: number, longitudeDeg: number): KeplerianOrbitalState[] {
    const timeMs = date.getTime();
    const jd = timeMs / 86400000 + 2440587.5;
    const T = (jd - 2451545.0) / 36525.0;

    // Earth heliocentric position vector
    const earthEl = JPL_KEPLERIAN_ELEMENTS['earth'];
    const earthA = earthEl.a + earthEl.aRate * T;
    const earthE = earthEl.e + earthEl.eRate * T;
    const earthI = earthEl.i + earthEl.iRate * T;
    const earthOmega = earthEl.Omega + earthEl.OmegaRate * T;
    const earthVarpi = earthEl.varpi + earthEl.varpiRate * T;
    const earthL = earthEl.L + earthEl.LRate * T;
    const earthM = (earthL - earthVarpi) % 360;
    const earthHelio = computeHeliocentricVector(earthA, earthE, earthI, earthOmega, earthVarpi - earthOmega, earthM);

    // Greenwich Mean Sidereal Time + Observer Longitude = Local Sidereal Time
    const gmst = (280.46061837 + 360.98564736629 * (jd - 2451545.0)) % 360;
    const lst = (gmst + longitudeDeg + 360) % 360;

    const planets = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
    const list: KeplerianOrbitalState[] = [];

    for (const p of planets) {
      const state = computeKeplerianState(p, T, earthHelio, latitudeDeg, lst);
      if (state) {
        list.push(state);
      }
    }

    return list;
  }

  /**
   * Generates 3D coordinates along the 23.44° Ecliptic Plane
   */
  getEclipticCurve(radius = 100, obliquityDeg = 23.439291, steps = 120): EclipticPoint[] {
    const points: EclipticPoint[] = [];
    const epsRad = (obliquityDeg * Math.PI) / 180;
    const cosEps = Math.cos(epsRad);
    const sinEps = Math.sin(epsRad);

    for (let i = 0; i <= steps; i++) {
      const lambdaDeg = (i / steps) * 360;
      const lambdaRad = (lambdaDeg * Math.PI) / 180;

      // Heliocentric/Geocentric unit vector on ecliptic plane
      const xEcl = Math.cos(lambdaRad);
      const yEcl = Math.sin(lambdaRad);
      const zEcl = 0;

      // Rotate to Equatorial coordinates
      const xEq = xEcl;
      const yEq = yEcl * cosEps - zEcl * sinEps;
      const zEq = yEcl * sinEps + zEcl * cosEps;

      const raRad = Math.atan2(yEq, xEq);
      const decRad = Math.asin(zEq);

      points.push({
        longitudeDeg: lambdaDeg,
        rightAscensionDeg: normalizeAngleDeg((raRad * 180) / Math.PI),
        declinationDeg: (decRad * 180) / Math.PI,
        x: xEq * radius,
        y: yEq * radius,
        z: zEq * radius
      });
    }

    return points;
  }

  /**
   * Reactive signal of planetary states synchronized with global simulation time and selected location
   */
  readonly currentPlanetaryStates = computed<KeplerianOrbitalState[]>(() => {
    const date = this.activeDate();
    const loc = this.selectedLocation();
    return this.getPlanetaryStates(date, loc.latitude, loc.longitude);
  });
}
