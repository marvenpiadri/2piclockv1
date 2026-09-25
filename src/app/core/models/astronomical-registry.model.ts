export interface AstronomicalRegistryItem {
  slug: string;
  name: string;
  category: 'astronomy' | 'chronometry' | 'navigation' | 'meteorology';
  title: string;
  description: string;
  keywords: string[];
  formula: string;
  howItWorks: string;
  notes: string[];
  related: string[];
}

export const CALCULATOR_REGISTRY: AstronomicalRegistryItem[] = [
  {
    slug: 'deep-space-observatory',
    name: 'Deep-Space Celestial Observatory',
    category: 'astronomy',
    title: '3D Celestial Sphere & Keplerian Ephemeris Engine | 2piClock',
    description: 'Explore the night sky from any global coordinate vector. Track local horizons, the ecliptic plane, and solar system trajectories using a reactive 3D mathematical space engine.',
    keywords: [
      'celestial observatory',
      '3d celestial sphere',
      'keplerian ephemeris calculator',
      'ecliptic plane tracker',
      'right ascension declination solver'
    ],
    formula: 'M = E − e sin(E); sin(alt) = sin(dec)sin(lat) + cos(dec)cos(lat)cos(LHA)',
    howItWorks: 'Calculates the real-time Keplerian orbital vectors of major solar system bodies relative to the Julian Date. Projects these coordinates onto a 3D equatorial sphere matrix, then applies local coordinate transformations based on the observer\'s specific latitude, longitude, and local sidereal time.',
    notes: [
      'Calculations adjust dynamically when moving the timeline slider forward or backward in time.',
      'Includes atmospheric refraction approximations near the local horizon lines.',
      'Maintains perfect coordinate sync with your ambient amber sky animation profiles.'
    ],
    related: ['sidereal-time-tracker', 'haversine-distance-calculator']
  },
  {
    slug: 'sidereal-time-tracker',
    name: 'Sidereal Time & Local Hour Angle Tracker',
    category: 'chronometry',
    title: 'Greenwich & Local Sidereal Time Calculator | 2piClock',
    description: 'Calculate Greenwich Mean Sidereal Time (GMST) and Local Sidereal Time (LST) based on the Earth\'s precise 23.9344696-hour axial rotation period.',
    keywords: ['sidereal time', 'local hour angle', 'gmst', 'lst', 'celestial meridian'],
    formula: 'GMST = 280.46061837 + 360.98564736629 × d; LST = GMST + Longitude',
    howItWorks: 'Computes sidereal rotation relative to the vernal equinox rather than the Sun, allowing astronomical alignment with stellar objects and right ascension meridians.',
    notes: [
      'Advances approximately 3 minutes and 56 seconds faster each day compared to civil solar time.',
      'Used as the direct phase angle for equatorial-to-horizontal sky projections.'
    ],
    related: ['deep-space-observatory', 'solar-noon-calculator']
  },
  {
    slug: 'haversine-distance-calculator',
    name: 'Great-Circle Haversine Distance Matrix',
    category: 'navigation',
    title: 'Spherical Haversine Distance & Orthodromic Matrix | 2piClock',
    description: 'Compute geodesic distances across the Earth ellipsoid between observer locations and the subsolar zenith point.',
    keywords: ['haversine', 'great circle distance', 'spherical trigonometry', 'geodesic distance'],
    formula: 'd = 2R · arcsin(√(sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2)))',
    howItWorks: 'Evaluates the shortest distance over the Earth\'s curved surface between any two latitude and longitude coordinate pairs.',
    notes: [
      'Earth mean volumetric radius: R = 6371.0088 km.',
      'Accurate within 0.3% of WGS-84 geodesic calculations.'
    ],
    related: ['deep-space-observatory', 'terminator-shadow-mapper']
  }
];
