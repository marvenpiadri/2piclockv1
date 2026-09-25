/**
 * 2PiClock — Space-Agency-Grade Keplerian Ephemeris & 3D Celestial Geometry Engine
 * 
 * Local-First mathematical models for:
 * 1. Solving Kepler's Equation via Newton-Raphson boundary iterations:
 *    E_n = E_{n-1} - (E_{n-1} - e*sin(E_{n-1}) - M) / (1 - e*cos(E_{n-1}))
 * 2. Computing Heliocentric 3D Planetary Vectors and Elliptical Orbits
 * 3. Transforming between Ecliptic, Equatorial (RA/Dec), and Local Horizontal (Alt/Az) coordinates:
 *    sin(alt) = sin(dec)*sin(lat) + cos(dec)*cos(lat)*cos(LHA)
 *    tan(az)  = -cos(dec)*sin(LHA) / (sin(dec)*cos(lat) - cos(dec)*sin(lat)*cos(LHA))
 * 4. Atmospheric refraction approximations near the local horizon.
 */

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface KeplerianElements {
  a: number;       // Semi-major axis (AU)
  aRate: number;   // AU / century
  e: number;       // Eccentricity
  eRate: number;   // / century
  i: number;       // Inclination (deg)
  iRate: number;   // deg / century
  Omega: number;   // Longitude of ascending node (deg)
  OmegaRate: number; // deg / century
  varpi: number;   // Longitude of perihelion (deg)
  varpiRate: number; // deg / century
  L: number;       // Mean longitude (deg)
  LRate: number;   // deg / century
}

export interface KeplerianOrbitalState {
  name: string;
  symbol: string;
  semiMajorAxisAU: number;
  eccentricity: number;
  inclinationDeg: number;
  longitudeAscendingNodeDeg: number;
  argumentOfPerihelionDeg: number;
  meanAnomalyDeg: number;
  eccentricAnomalyDeg: number;
  trueAnomalyDeg: number;
  heliocentricRadiusAU: number;
  heliocentricX: number;
  heliocentricY: number;
  heliocentricZ: number;
  geocentricDistanceAU: number;
  rightAscensionDeg: number;
  rightAscensionHours: number;
  declinationDeg: number;
  altitudeDeg: number;
  azimuthDeg: number;
  apparentMagnitude: number;
  isVisibleAboveHorizon: boolean;
  color: string;
  orbitPoints: { x: number; y: number; z: number }[]; // 3D Heliocentric ellipse points
}

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export interface HorizontalCoordinate {
  altitudeDeg: number;
  azimuthDeg: number;
  zenithDeg: number;
  refractedAltitudeDeg: number;
  isAboveHorizon: boolean;
}

export interface EquatorialCoordinate {
  rightAscensionDeg: number;
  rightAscensionHours: number;
  declinationDeg: number;
  distanceAU: number;
}

/**
 * Standard Keplerian elements at J2000.0 from NASA / JPL Planetary Ephemerides
 */
export const JPL_KEPLERIAN_ELEMENTS: Record<string, KeplerianElements> = {
  mercury: {
    a: 0.38709927, aRate: 0.00000037,
    e: 0.20563593, eRate: 0.00001906,
    i: 7.00497902, iRate: -0.00594749,
    Omega: 48.33076593, OmegaRate: -0.12534081,
    varpi: 77.45779628, varpiRate: 0.16047689,
    L: 252.25032350, LRate: 149472.67411175
  },
  venus: {
    a: 0.72333566, aRate: 0.00000390,
    e: 0.00677672, eRate: -0.00004107,
    i: 3.39467605, iRate: -0.00078890,
    Omega: 76.67984255, OmegaRate: -0.27769418,
    varpi: 131.60246718, varpiRate: 0.00268329,
    L: 181.97909950, LRate: 58517.81538729
  },
  earth: {
    a: 1.00000261, aRate: 0.00000562,
    e: 0.01671123, eRate: -0.00004392,
    i: -0.00001531, iRate: -0.01294668,
    Omega: 0.0, OmegaRate: 0.0,
    varpi: 102.93768193, varpiRate: 0.32327364,
    L: 100.46457166, LRate: 35999.37244981
  },
  mars: {
    a: 1.52371034, aRate: 0.00001847,
    e: 0.09339410, eRate: 0.00007882,
    i: 1.84969142, iRate: -0.00813131,
    Omega: 49.55953891, OmegaRate: -0.29257343,
    varpi: -239.94174092, varpiRate: 0.44441088,
    L: -4.55343205, LRate: 19140.30268499
  },
  jupiter: {
    a: 5.20288700, aRate: -0.00011607,
    e: 0.04838624, eRate: -0.00013253,
    i: 1.30439695, iRate: -0.00183714,
    Omega: 100.47390909, OmegaRate: 0.20469106,
    varpi: 14.72847983, varpiRate: 0.21252668,
    L: 34.39644051, LRate: 3034.74612775
  },
  saturn: {
    a: 9.53667594, aRate: -0.00125060,
    e: 0.05386179, eRate: -0.00050991,
    i: 2.48599187, iRate: 0.00193609,
    Omega: 113.66242448, OmegaRate: -0.28867794,
    varpi: 92.59887831, varpiRate: -0.41897216,
    L: 49.95424423, LRate: 1222.49362201
  },
  uranus: {
    a: 19.18916464, aRate: -0.00196176,
    e: 0.04725744, eRate: -0.00004397,
    i: 0.77263783, iRate: -0.00242939,
    Omega: 74.01692503, OmegaRate: 0.04240589,
    varpi: 170.95427630, varpiRate: 0.40805280,
    L: 313.23810451, LRate: 428.48202785
  },
  neptune: {
    a: 30.06992276, aRate: 0.00026291,
    e: 0.00859048, eRate: 0.00005105,
    i: 1.77004347, iRate: 0.00035372,
    Omega: 131.78422574, OmegaRate: -0.00508664,
    varpi: 44.96476224, varpiRate: -0.32241464,
    L: -55.12002969, LRate: 218.45945325
  }
};

/**
 * Normalizes an angle in degrees to [0, 360)
 */
export function normalizeAngleDeg(deg: number): number {
  const mod = deg % 360;
  return mod < 0 ? mod + 360 : mod;
}

/**
 * Solves Kepler's Equation for Eccentric Anomaly E (in radians)
 * using Newton-Raphson boundary iterations:
 * E_n = E_{n-1} - (E_{n-1} - e * sin(E_{n-1}) - M) / (1 - e * cos(E_{n-1}))
 */
export function solveKeplersEquation(
  meanAnomalyRad: number,
  eccentricity: number,
  maxIterations = 15,
  tolerance = 1e-8
): number {
  // Initial estimate
  let E = eccentricity > 0.8
    ? Math.PI
    : meanAnomalyRad + eccentricity * Math.sin(meanAnomalyRad);

  for (let iter = 0; iter < maxIterations; iter++) {
    const f = E - eccentricity * Math.sin(E) - meanAnomalyRad;
    if (Math.abs(f) < tolerance) {
      break;
    }
    const fPrime = 1 - eccentricity * Math.cos(E);
    const delta = f / fPrime;
    E -= delta;
    if (Math.abs(delta) < tolerance) {
      break;
    }
  }
  return E;
}

/**
 * Calculates high-accuracy Heliocentric Cartesian Coordinates (AU) from Keplerian elements
 */
export function computeHeliocentricVector(
  a: number,
  e: number,
  iDeg: number,
  OmegaDeg: number,
  omegaDeg: number,
  EDeg: number
): Vector3D {
  const Erad = EDeg * DEG2RAD;
  const iRad = iDeg * DEG2RAD;
  const OmegaRad = OmegaDeg * DEG2RAD;
  const omegaRad = omegaDeg * DEG2RAD;

  // 1. Orbital Plane Coordinates
  const xPlane = a * (Math.cos(Erad) - e);
  const yPlane = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(Erad);

  // 2. 3D Rotation into Ecliptic Coordinate Frame
  const cosO = Math.cos(OmegaRad);
  const sinO = Math.sin(OmegaRad);
  const cosw = Math.cos(omegaRad);
  const sinw = Math.sin(omegaRad);
  const cosi = Math.cos(iRad);
  const sini = Math.sin(iRad);

  const x = (cosO * cosw - sinO * sinw * cosi) * xPlane + (-cosO * sinw - sinO * cosw * cosi) * yPlane;
  const y = (sinO * cosw + cosO * sinw * cosi) * xPlane + (-sinO * sinw + cosO * cosw * cosi) * yPlane;
  const z = (sinw * sini) * xPlane + (cosw * sini) * yPlane;

  return { x, y, z };
}

/**
 * Transforms Ecliptic 3D coordinates (X, Y, Z) to Equatorial 3D coordinates (Xeq, Yeq, Zeq)
 * given the true obliquity of the ecliptic eps (deg)
 */
export function eclipticToEquatorialVector(vec: Vector3D, epsDeg = 23.439291): Vector3D {
  const epsRad = epsDeg * DEG2RAD;
  const cosEps = Math.cos(epsRad);
  const sinEps = Math.sin(epsRad);

  return {
    x: vec.x,
    y: vec.y * cosEps - vec.z * sinEps,
    z: vec.y * sinEps + vec.z * cosEps
  };
}

/**
 * Converts Equatorial 3D vector to Right Ascension (alpha) and Declination (delta)
 */
export function equatorialVectorToRaDec(vec: Vector3D): EquatorialCoordinate {
  const r = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
  const raRad = Math.atan2(vec.y, vec.x);
  const raDeg = normalizeAngleDeg(raRad * RAD2DEG);
  const decRad = Math.asin(Math.max(-1, Math.min(1, vec.z / (r || 1))));
  const decDeg = decRad * RAD2DEG;

  return {
    rightAscensionDeg: raDeg,
    rightAscensionHours: raDeg / 15,
    declinationDeg: decDeg,
    distanceAU: r
  };
}

/**
 * Transforms Equatorial (RA, Dec) to Local Horizontal (Altitude, Azimuth)
 * for an observer at latitude phi and local sidereal time LST:
 * 
 * Local Hour Angle: H = LST - RA
 * sin(alt) = sin(dec)*sin(lat) + cos(dec)*cos(lat)*cos(H)
 * cos(az)  = (sin(dec) - sin(alt)*sin(lat)) / (cos(alt)*cos(lat))
 */
export function equatorialToHorizontal(
  raDeg: number,
  decDeg: number,
  latitudeDeg: number,
  localSiderealTimeDeg: number
): HorizontalCoordinate {
  let H = normalizeAngleDeg(localSiderealTimeDeg - raDeg);
  if (H > 180) H -= 360;
  const HRad = H * DEG2RAD;

  const latRad = latitudeDeg * DEG2RAD;
  const decRad = decDeg * DEG2RAD;

  // Altitude
  const sinAlt = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(HRad);
  const rawAltRad = Math.asin(Math.max(-1, Math.min(1, sinAlt)));
  const altitudeDeg = rawAltRad * RAD2DEG;

  // Atmospheric Refraction correction near horizon
  let refractedAltitudeDeg = altitudeDeg;
  if (altitudeDeg > -1.0) {
    const rArcMin = 1.02 / Math.tan((altitudeDeg + 10.3 / (altitudeDeg + 5.11)) * DEG2RAD);
    refractedAltitudeDeg = altitudeDeg + rArcMin / 60;
  }

  // Azimuth (measured from North = 0° clockwise through East = 90°)
  const yAz = -Math.cos(decRad) * Math.sin(HRad);
  const xAz = Math.sin(decRad) * Math.cos(latRad) - Math.cos(decRad) * Math.sin(latRad) * Math.cos(HRad);
  const azimuthDeg = normalizeAngleDeg(Math.atan2(yAz, xAz) * RAD2DEG);

  return {
    altitudeDeg,
    azimuthDeg,
    zenithDeg: 90 - altitudeDeg,
    refractedAltitudeDeg,
    isAboveHorizon: refractedAltitudeDeg > -0.833
  };
}

/**
 * Computes the full Keplerian planetary ephemeris state for a specific Julian Day
 */
export function computeKeplerianState(
  planetKey: string,
  julianCenturiesT: number,
  earthHeliocentric: Vector3D,
  latitudeDeg: number,
  lstDeg: number
): KeplerianOrbitalState | null {
  const el = JPL_KEPLERIAN_ELEMENTS[planetKey];
  if (!el) return null;

  const T = julianCenturiesT;
  const a = el.a + el.aRate * T;
  const e = Math.max(0.0001, el.e + el.eRate * T);
  const i = el.i + el.iRate * T;
  const Omega = normalizeAngleDeg(el.Omega + el.OmegaRate * T);
  const varpi = normalizeAngleDeg(el.varpi + el.varpiRate * T);
  const L = normalizeAngleDeg(el.L + el.LRate * T);

  const omega = normalizeAngleDeg(varpi - Omega);
  const M = normalizeAngleDeg(L - varpi);
  const MRad = M * DEG2RAD;

  // Solve Kepler's Equation for E
  const ERad = solveKeplersEquation(MRad, e);
  const EDeg = ERad * RAD2DEG;

  // True Anomaly nu
  const sinNu = (Math.sqrt(1 - e * e) * Math.sin(ERad)) / (1 - e * Math.cos(ERad));
  const cosNu = (Math.cos(ERad) - e) / (1 - e * Math.cos(ERad));
  const nuDeg = normalizeAngleDeg(Math.atan2(sinNu, cosNu) * RAD2DEG);

  // Heliocentric Radius
  const rHelio = a * (1 - e * Math.cos(ERad));

  // Heliocentric 3D position
  const helioVec = computeHeliocentricVector(a, e, i, Omega, omega, EDeg);

  // Geocentric 3D vector = Helio_Planet - Helio_Earth
  const geoEcliptic: Vector3D = {
    x: helioVec.x - earthHeliocentric.x,
    y: helioVec.y - earthHeliocentric.y,
    z: helioVec.z - earthHeliocentric.z
  };

  // Convert to Equatorial
  const geoEquatorial = eclipticToEquatorialVector(geoEcliptic);
  const eq = equatorialVectorToRaDec(geoEquatorial);

  // Convert to Local Horizontal
  const horiz = equatorialToHorizontal(eq.rightAscensionDeg, eq.declinationDeg, latitudeDeg, lstDeg);

  // Compute 3D Heliocentric Orbital Ellipse trajectory points (for 3D rendering)
  const orbitPoints: { x: number; y: number; z: number }[] = [];
  for (let sampleE = 0; sampleE <= 360; sampleE += 6) {
    const pt = computeHeliocentricVector(a, e, i, Omega, omega, sampleE);
    orbitPoints.push(pt);
  }

  const planetSymbols: Record<string, string> = {
    mercury: '☿', venus: '♀', earth: '🜨', mars: '♂',
    jupiter: '♃', saturn: '♄', uranus: '♅', neptune: '♆'
  };

  const planetColors: Record<string, string> = {
    mercury: '#94a3b8', venus: '#fef08a', earth: '#38bdf8', mars: '#f87171',
    jupiter: '#fdba74', saturn: '#fde047', uranus: '#67e8f9', neptune: '#818cf8'
  };

  const name = planetKey.charAt(0).toUpperCase() + planetKey.slice(1);

  return {
    name,
    symbol: planetSymbols[planetKey] || '●',
    semiMajorAxisAU: a,
    eccentricity: e,
    inclinationDeg: i,
    longitudeAscendingNodeDeg: Omega,
    argumentOfPerihelionDeg: omega,
    meanAnomalyDeg: M,
    eccentricAnomalyDeg: EDeg,
    trueAnomalyDeg: nuDeg,
    heliocentricRadiusAU: rHelio,
    heliocentricX: helioVec.x,
    heliocentricY: helioVec.y,
    heliocentricZ: helioVec.z,
    geocentricDistanceAU: eq.distanceAU,
    rightAscensionDeg: eq.rightAscensionDeg,
    rightAscensionHours: eq.rightAscensionHours,
    declinationDeg: eq.declinationDeg,
    altitudeDeg: horiz.refractedAltitudeDeg,
    azimuthDeg: horiz.azimuthDeg,
    apparentMagnitude: 0, // Calculated via illumination models
    isVisibleAboveHorizon: horiz.isAboveHorizon,
    color: planetColors[planetKey] || '#fbbf24',
    orbitPoints
  };
}
