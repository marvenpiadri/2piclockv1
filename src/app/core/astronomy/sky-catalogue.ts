/**
 * Single reference catalogue for every sky view (Living Sky, Astronomy atlas, charts).
 * All coordinates are J2000.0 equatorial degrees; precess before projecting (see
 * equatorialToHorizontal in astronomy-engine.ts).
 */

export interface CatalogueStar {
  name: string;
  raDeg: number;
  decDeg: number;
  magnitude: number;
  /** "r,g,b" body colour, from spectral class. */
  tint: string;
}

const WHITE = '235,245,255';
const BLUE = '215,235,255';
const CREAM = '255,245,215';
const GOLD = '255,225,190';
const RED = '255,205,175';

export const STARS: readonly CatalogueStar[] = [
  { name: 'Sirius', raDeg: 101.287, decDeg: -16.716, magnitude: -1.46, tint: WHITE },
  { name: 'Canopus', raDeg: 95.988, decDeg: -52.696, magnitude: -0.74, tint: CREAM },
  { name: 'Arcturus', raDeg: 213.915, decDeg: 19.182, magnitude: -0.05, tint: GOLD },
  { name: 'Vega', raDeg: 279.235, decDeg: 38.784, magnitude: 0.03, tint: WHITE },
  { name: 'Capella', raDeg: 79.172, decDeg: 45.998, magnitude: 0.08, tint: CREAM },
  { name: 'Rigel', raDeg: 78.634, decDeg: -8.202, magnitude: 0.13, tint: BLUE },
  { name: 'Procyon', raDeg: 114.826, decDeg: 5.225, magnitude: 0.34, tint: WHITE },
  { name: 'Achernar', raDeg: 24.429, decDeg: -57.237, magnitude: 0.46, tint: WHITE },
  { name: 'Betelgeuse', raDeg: 88.793, decDeg: 7.407, magnitude: 0.5, tint: RED },
  { name: 'Hadar', raDeg: 210.956, decDeg: -60.373, magnitude: 0.61, tint: BLUE },
  { name: 'Altair', raDeg: 297.696, decDeg: 8.868, magnitude: 0.77, tint: WHITE },
  { name: 'Aldebaran', raDeg: 69.996, decDeg: 16.509, magnitude: 0.85, tint: RED },
  { name: 'Spica', raDeg: 201.298, decDeg: -11.161, magnitude: 0.97, tint: BLUE },
  { name: 'Antares', raDeg: 247.352, decDeg: -26.432, magnitude: 1.06, tint: RED },
  { name: 'Pollux', raDeg: 116.329, decDeg: 28.026, magnitude: 1.14, tint: CREAM },
  { name: 'Fomalhaut', raDeg: 344.413, decDeg: -29.622, magnitude: 1.16, tint: WHITE },
  { name: 'Deneb', raDeg: 310.358, decDeg: 45.28, magnitude: 1.25, tint: WHITE },
  { name: 'Regulus', raDeg: 152.093, decDeg: 11.967, magnitude: 1.35, tint: WHITE },
  { name: 'Castor', raDeg: 113.65, decDeg: 31.888, magnitude: 1.58, tint: WHITE },
  { name: 'Shaula', raDeg: 263.402, decDeg: -37.103, magnitude: 1.63, tint: BLUE },
  { name: 'Bellatrix', raDeg: 81.283, decDeg: 6.35, magnitude: 1.64, tint: BLUE },
  { name: 'Alnilam', raDeg: 84.053, decDeg: -1.202, magnitude: 1.69, tint: BLUE },
  { name: 'Alnitak', raDeg: 85.19, decDeg: -1.943, magnitude: 1.74, tint: BLUE },
  { name: 'Alnair', raDeg: 332.058, decDeg: -46.961, magnitude: 1.74, tint: WHITE },
  { name: 'Alioth', raDeg: 193.507, decDeg: 55.96, magnitude: 1.76, tint: WHITE },
  { name: 'Mirfak', raDeg: 51.08, decDeg: 49.861, magnitude: 1.79, tint: CREAM },
  { name: 'Dubhe', raDeg: 165.932, decDeg: 61.751, magnitude: 1.79, tint: GOLD },
  { name: 'Alkaid', raDeg: 206.885, decDeg: 49.313, magnitude: 1.86, tint: BLUE },
  { name: 'Sargas', raDeg: 264.33, decDeg: -42.998, magnitude: 1.86, tint: CREAM },
  { name: 'Kochab', raDeg: 222.676, decDeg: 74.155, magnitude: 2.08, tint: GOLD },
  { name: 'Saiph', raDeg: 86.939, decDeg: -9.67, magnitude: 2.06, tint: BLUE },
  { name: 'Denebola', raDeg: 177.265, decDeg: 14.572, magnitude: 2.14, tint: WHITE },
  { name: 'Mintaka', raDeg: 83.001, decDeg: -0.299, magnitude: 2.23, tint: BLUE },
  { name: 'Mizar', raDeg: 200.981, decDeg: 54.925, magnitude: 2.23, tint: WHITE },
  { name: 'Schedar', raDeg: 10.127, decDeg: 56.537, magnitude: 2.24, tint: GOLD },
  { name: 'Caph', raDeg: 2.295, decDeg: 59.15, magnitude: 2.27, tint: CREAM },
  { name: 'Algieba', raDeg: 154.993, decDeg: 19.841, magnitude: 2.28, tint: GOLD },
  { name: 'Larawag', raDeg: 252.541, decDeg: -34.293, magnitude: 2.29, tint: GOLD },
  { name: 'Dschubba', raDeg: 240.083, decDeg: -22.622, magnitude: 2.32, tint: BLUE },
  { name: 'Merak', raDeg: 165.46, decDeg: 56.382, magnitude: 2.37, tint: WHITE },
  { name: 'Phecda', raDeg: 178.458, decDeg: 53.695, magnitude: 2.44, tint: WHITE },
  { name: 'Gamma Cas', raDeg: 14.177, decDeg: 60.717, magnitude: 2.47, tint: BLUE },
  { name: 'Zosma', raDeg: 168.527, decDeg: 20.524, magnitude: 2.56, tint: WHITE },
  { name: 'Ruchbah', raDeg: 21.454, decDeg: 60.235, magnitude: 2.68, tint: WHITE },
  { name: 'Lesath', raDeg: 262.691, decDeg: -37.296, magnitude: 2.7, tint: BLUE },
  { name: 'Megrez', raDeg: 183.856, decDeg: 57.033, magnitude: 3.31, tint: WHITE },
  { name: 'Chertan', raDeg: 168.56, decDeg: 15.43, magnitude: 3.33, tint: WHITE },
  { name: 'Segin', raDeg: 28.599, decDeg: 63.67, magnitude: 3.35, tint: BLUE }
];

export interface Constellation {
  id: string;
  name: string;
  /** Pairs of star names forming the stick figure. */
  lines: readonly (readonly [string, string])[];
}

export const CONSTELLATIONS: readonly Constellation[] = [
  {
    id: 'orion', name: 'Orion',
    lines: [
      ['Betelgeuse', 'Bellatrix'], ['Betelgeuse', 'Alnitak'], ['Bellatrix', 'Mintaka'],
      ['Alnitak', 'Alnilam'], ['Alnilam', 'Mintaka'], ['Alnitak', 'Saiph'], ['Mintaka', 'Rigel']
    ]
  },
  {
    id: 'ursa-major', name: 'Ursa Major',
    lines: [
      ['Dubhe', 'Merak'], ['Merak', 'Phecda'], ['Phecda', 'Megrez'], ['Megrez', 'Alioth'],
      ['Alioth', 'Mizar'], ['Mizar', 'Alkaid'], ['Dubhe', 'Megrez']
    ]
  },
  {
    id: 'cassiopeia', name: 'Cassiopeia',
    lines: [['Caph', 'Schedar'], ['Schedar', 'Gamma Cas'], ['Gamma Cas', 'Ruchbah'], ['Ruchbah', 'Segin']]
  },
  {
    id: 'leo', name: 'Leo',
    lines: [['Regulus', 'Algieba'], ['Algieba', 'Zosma'], ['Zosma', 'Denebola'], ['Zosma', 'Chertan'], ['Chertan', 'Regulus']]
  },
  {
    id: 'scorpius', name: 'Scorpius',
    lines: [['Dschubba', 'Antares'], ['Antares', 'Larawag'], ['Larawag', 'Sargas'], ['Sargas', 'Shaula'], ['Shaula', 'Lesath']]
  },
  {
    id: 'summer-triangle', name: 'Summer Triangle',
    lines: [['Vega', 'Deneb'], ['Deneb', 'Altair'], ['Altair', 'Vega']]
  }
];

export interface DeepSkyObject {
  id: string;
  name: string;
  catalog: string;
  type: string;
  raDeg: number;
  decDeg: number;
  magnitude: number;
  size: string;
}

export const DEEP_SKY: readonly DeepSkyObject[] = [
  { id: 'm31', name: 'Andromeda Galaxy', catalog: 'M31, NGC 224', type: 'Galaxy', raDeg: 10.6847, decDeg: 41.269, magnitude: 3.44, size: '178′ × 63′' },
  { id: 'm42', name: 'Orion Nebula', catalog: 'M42, NGC 1976', type: 'Emission nebula', raDeg: 83.8221, decDeg: -5.3911, magnitude: 4.0, size: '85′ × 60′' },
  { id: 'm45', name: 'Pleiades', catalog: 'M45, Melotte 22', type: 'Open cluster', raDeg: 56.8712, decDeg: 24.117, magnitude: 1.6, size: '110′' },
  { id: 'm13', name: 'Hercules Cluster', catalog: 'M13, NGC 6205', type: 'Globular cluster', raDeg: 250.4235, decDeg: 36.4613, magnitude: 5.78, size: '20′' },
  { id: 'm51', name: 'Whirlpool Galaxy', catalog: 'M51, NGC 5194', type: 'Spiral galaxy', raDeg: 202.4696, decDeg: 47.1952, magnitude: 8.36, size: '11′ × 7′' },
  { id: 'm57', name: 'Ring Nebula', catalog: 'M57, NGC 6720', type: 'Planetary nebula', raDeg: 283.3969, decDeg: 33.0292, magnitude: 8.8, size: '1.4′' },
  { id: 'm8', name: 'Lagoon Nebula', catalog: 'M8, NGC 6523', type: 'Emission nebula', raDeg: 270.92, decDeg: -24.38, magnitude: 6.0, size: '90′ × 40′' },
  { id: 'm20', name: 'Trifid Nebula', catalog: 'M20, NGC 6514', type: 'Emission nebula', raDeg: 270.654, decDeg: -23.03, magnitude: 6.3, size: '28′' },
  { id: 'm6', name: 'Butterfly Cluster', catalog: 'M6, NGC 6405', type: 'Open cluster', raDeg: 265.07, decDeg: -32.22, magnitude: 4.2, size: '25′' },
  { id: 'm7', name: 'Ptolemy Cluster', catalog: 'M7, NGC 6475', type: 'Open cluster', raDeg: 268.46, decDeg: -34.79, magnitude: 3.3, size: '80′' }
];
