import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { GeoLocation } from './app/core/models/location.model';
import { getCountries, getAllCitiesInWorld } from '@countrystatecity/countries';
import { calculateSolarPosition, calculateLunarPosition, getCelestialState, calculateSolarEvents } from './app/core/astronomy/astronomy-engine';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/{*splat}', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

// Only canonical 200-status pages belong in the sitemap.
// Redirect-only intent aliases remain useful for navigation/search entry, but
// indexing the redirect URLs creates duplicate crawl targets.
const staticSitemapUrls = [
  '/', '/api', '/weather', '/astronomy', '/tonight',
  '/world', '/world-clocks', '/events',
  '/maps/clocks', '/maps/radio',
  '/time/converter', '/time/difference', '/time/duration',
  '/time/date-difference', '/time/add-subtract', '/time/countdown',
  '/time/unix-timestamp', '/time/world-matrix',
  '/widget',
  '/radio/stations', '/radio/map', '/radio/favorites', '/radio/recent',
  '/atmosphere', '/ephemeris', '/planner', '/space',
  '/stargazing', '/eclipses', '/satellites'
];
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const buildSitemap = () => {
  const urls = [...staticSitemapUrls];
  const uniqueUrls = [...new Set(urls)];
  const entries = uniqueUrls.map(path => '  <url><loc>https://2piclock.com' + escapeXml(path) + '</loc></url>').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries + '\n</urlset>';
};

const apiHeaders = (res: express.Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
};

const resolveApiDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value) return new Date();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const apiError = (res: express.Response, status: number, code: string, message: string) => {
  res.status(status).json({ error: { code, message } });
};
interface CityRecord {
  id?: number;
  name?: string;
  countryCode?: string;
  stateCode?: string;
  latitude?: string | number;
  longitude?: string | number;
  timezone?: string;
}

let locationIndexPromise: Promise<GeoLocation[]> | undefined;
const locationById = new Map<string, GeoLocation>();
const locationSearchCache = new Map<string, GeoLocation[]>();

const normalizeLocationText = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();

const slugifyLocation = (value: string) =>
  normalizeLocationText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const buildLocationIndex = async (): Promise<GeoLocation[]> => {
  const [countries, cities] = await Promise.all([
    getCountries(),
    getAllCitiesInWorld()
  ]);

  const countryByCode = new Map(
    countries.map(country => [
      String(country.iso2 ?? '').toUpperCase(),
      {
        name: String(country.name ?? ''),
        flag: String(country.emoji ?? '')
      }
    ])
  );

  const locations: GeoLocation[] = [];

  for (const city of cities as CityRecord[]) {
    const name = String(city.name ?? '').trim();
    const countryCode = String(city.countryCode ?? '').toUpperCase();
    const latitude = Number(city.latitude);
    const longitude = Number(city.longitude);

    if (
      !name ||
      !countryCode ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }

    const country = countryByCode.get(countryCode);
    const cityId = city.id != null ? String(city.id) : `${slugifyLocation(name)}-${latitude}-${longitude}`;
    const id = `${countryCode.toLowerCase()}-${cityId}`;

    locations.push({
      id,
      name,
      country: country?.name || countryCode,
      countryCode,
      flag: country?.flag || '',
      latitude,
      longitude,
      timezone: String(city.timezone || 'UTC'),
      tier: 3
    });
  }

  return locations;
};

const getLocationIndex = (): Promise<GeoLocation[]> => {
  if (!locationIndexPromise) {
    locationIndexPromise = buildLocationIndex().then(locations => {
      locationById.clear();
      for (const location of locations) locationById.set(location.id.toLowerCase(), location);
      locationSearchCache.clear();
      return locations;
    }).catch(error => {
      locationIndexPromise = undefined;
      locationById.clear();
      throw error;
    });
  }
  return locationIndexPromise;
};

const resolveLocation = async (value: unknown): Promise<GeoLocation | undefined> => {
  if (typeof value !== 'string') return undefined;
  await getLocationIndex();
  return locationById.get(value.trim().toLowerCase());
};

const randomSample = <T>(items: T[], count: number): T[] => {
  const sample = items.slice();
  for (let i = sample.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [sample[i], sample[j]] = [sample[j], sample[i]];
  }
  return sample.slice(0, count);
};


app.options('/api/v1/{*splat}', (_req, res) => res.sendStatus(204));

const weatherProxyCache = new Map<string, { expiresAt: number; data: unknown }>();
const WEATHER_CACHE_MS = 10 * 60 * 1000;

app.get('/api/v1/weather', async (req, res) => {
  apiHeaders(res);

  try {
    let latitude = typeof req.query['latitude'] === 'string' ? req.query['latitude'] : '';
    let longitude = typeof req.query['longitude'] === 'string' ? req.query['longitude'] : '';

    if (typeof req.query['location'] === 'string') {
      const location = await resolveLocation(req.query['location']);
      if (!location) return apiError(res, 400, 'INVALID_LOCATION', 'Use a valid location id.');
      latitude = String(location.latitude);
      longitude = String(location.longitude);
    }

    if (!latitude || !longitude) {
      return apiError(res, 400, 'MISSING_COORDINATES', 'Provide latitude and longitude, or a location id.');
    }

    const allowed = ['current', 'hourly', 'forecast_days', 'timezone'];
    const search = new URLSearchParams();
    search.set('latitude', latitude);
    search.set('longitude', longitude);

    for (const key of allowed) {
      const value = req.query[key];
      if (typeof value === 'string' && value) search.set(key, value);
    }

    const cacheKey = search.toString();
    const cached = weatherProxyCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-2piClock-Cache', 'HIT');
      return res.json(cached.data);
    }

    const upstream = await fetch(`https://api.open-meteo.com/v1/forecast?${search.toString()}`, {
      headers: { Accept: 'application/json' }
    });

    if (!upstream.ok) {
      return apiError(res, 502, 'WEATHER_UPSTREAM_ERROR', `Weather provider returned HTTP ${upstream.status}.`);
    }

    const data = await upstream.json();
    weatherProxyCache.set(cacheKey, { expiresAt: Date.now() + WEATHER_CACHE_MS, data });

    if (weatherProxyCache.size > 200) {
      const oldest = weatherProxyCache.keys().next().value;
      if (oldest) weatherProxyCache.delete(oldest);
    }

    res.setHeader('X-2piClock-Cache', 'MISS');
    res.json(data);
  } catch {
    apiError(res, 502, 'WEATHER_UNAVAILABLE', 'Weather data is temporarily unavailable.');
  }
});



app.get('/api/v1', (_req, res) => {
  apiHeaders(res);
  res.json({
    name: '2piClock API',
    version: '1',
    documentation: 'https://2piclock.com/api',
    endpoints: [
      '/api/v1/locations/search?q=casablanca',
      '/api/v1/locations/random?count=50',
      '/api/v1/locations/{id}',
      '/api/v1/locations/search?q=paris',
      '/api/v1/weather?location=paris&current=temperature_2m,weather_code&hourly=temperature_2m&forecast_days=7&timezone=UTC',
      '/api/v1/solar?location=paris&at=2026-09-26T12:00:00Z',
      '/api/v1/lunar?location=paris&at=2026-09-26T12:00:00Z',
      '/api/v1/celestial?location=paris&at=2026-09-26T12:00:00Z',
      '/api/v1/events?location=paris&date=2026-09-26'
    ]
  });
});

app.get('/api/v1/locations/search', async (req, res) => {
  apiHeaders(res);
  const rawQuery = typeof req.query['q'] === 'string' ? req.query['q'].trim() : '';
  const query = normalizeLocationText(rawQuery);
  const count = Math.min(50, Math.max(1, Number(req.query['count'] ?? 12) || 12));
  if (query.length < 2) { res.json({ version: '1', query, count: 0, locations: [] }); return; }
  try {
    let matches = locationSearchCache.get(query);
    if (!matches) {
      const locations = await getLocationIndex();
      matches = locations.filter(location => [location.name, location.country, location.countryCode, location.id, location.timezone]
        .some(value => normalizeLocationText(String(value)).includes(query)))
        .sort((a, b) => {
          const aName = normalizeLocationText(a.name), bName = normalizeLocationText(b.name);
          const aCountry = normalizeLocationText(a.country), bCountry = normalizeLocationText(b.country);
          const aExact = [aName, normalizeLocationText(a.id), normalizeLocationText(a.countryCode)].includes(query);
          const bExact = [bName, normalizeLocationText(b.id), normalizeLocationText(b.countryCode)].includes(query);
          const aPrefix = aName.startsWith(query), bPrefix = bName.startsWith(query);
          const aWordPrefix = aName.split(/\\s+/).some(word => word.startsWith(query));
          const bWordPrefix = bName.split(/\\s+/).some(word => word.startsWith(query));
          const aCountryPrefix = aCountry.startsWith(query), bCountryPrefix = bCountry.startsWith(query);
          return Number(bExact) - Number(aExact) || Number(bPrefix) - Number(aPrefix)
            || Number(bWordPrefix) - Number(aWordPrefix) || Number(bCountryPrefix) - Number(aCountryPrefix)
            || a.name.localeCompare(b.name);
        });
      locationSearchCache.set(query, matches);
      if (locationSearchCache.size > 100) locationSearchCache.delete(locationSearchCache.keys().next().value as string);
    }
    const results = matches.slice(0, count);
    res.json({ version: '1', query, count: results.length, locations: results });
  } catch {
    apiError(res, 503, 'LOCATION_DATA_UNAVAILABLE', 'The internal city catalogue is temporarily unavailable.');
  }
});

app.get('/api/v1/locations/random', async (req, res) => {
  apiHeaders(res);
  const count = Math.min(50, Math.max(1, Number(req.query['count'] ?? 50) || 50));
  try {
    const locations = await getLocationIndex();
    const results = randomSample(locations, count);
    res.json({ version: '1', count: results.length, locations: results });
  } catch {
    apiError(res, 503, 'LOCATION_DATA_UNAVAILABLE', 'The internal city catalogue is temporarily unavailable.');
  }
});

app.get('/api/v1/locations/map', async (req, res) => {
  apiHeaders(res);
  const count = Math.min(5000, Math.max(500, Number(req.query['count'] ?? 2500) || 2500));
  try {
    const locations = await getLocationIndex();
    const grid = new Map<string, GeoLocation>();
    const latStep = 180 / 90;
    const lonStep = 360 / 120;
    for (const location of locations) {
      const latBucket = Math.floor((location.latitude + 90) / latStep);
      const lonBucket = Math.floor((location.longitude + 180) / lonStep);
      const key = latBucket + ':' + lonBucket;
      if (!grid.has(key)) grid.set(key, location);
    }
    const results = [...grid.values()].slice(0, count);
    res.json({ version: '1', count: results.length, locations: results });
  } catch {
    apiError(res, 503, 'LOCATION_DATA_UNAVAILABLE', 'The internal city catalogue is temporarily unavailable.');
  }
});

app.get('/api/v1/locations/:id', async (req, res) => {
  apiHeaders(res);
  try {
    const location = await resolveLocation(req.params['id']);
    if (!location) return apiError(res, 404, 'LOCATION_NOT_FOUND', 'The requested location was not found.');
    res.json({ version: '1', location });
  } catch {
    apiError(res, 503, 'LOCATION_DATA_UNAVAILABLE', 'The internal city catalogue is temporarily unavailable.');
  }
});

app.get('/api/v1/solar', async (req, res) => {
  apiHeaders(res);
  const location = await resolveLocation(req.query['location']);
  if (!location) return apiError(res, 400, 'INVALID_LOCATION', 'Use a valid preset location id.');
  const date = resolveApiDate(req.query['at']);
  if (!date) return apiError(res, 400, 'INVALID_TIMESTAMP', 'Use an ISO-8601 timestamp in the at parameter.');
  const solar = calculateSolarPosition(date, location.latitude, location.longitude);
  res.json({ version: '1', instant: date.toISOString(), location: { id: location.id, name: location.name, country: location.country, timezone: location.timezone }, solar });
});

app.get('/api/v1/lunar', async (req, res) => {
  apiHeaders(res);
  const location = await resolveLocation(req.query['location']);
  if (!location) return apiError(res, 400, 'INVALID_LOCATION', 'Use a valid preset location id.');
  const date = resolveApiDate(req.query['at']);
  if (!date) return apiError(res, 400, 'INVALID_TIMESTAMP', 'Use an ISO-8601 timestamp in the at parameter.');
  const sun = calculateSolarPosition(date, location.latitude, location.longitude);
  const lunar = calculateLunarPosition(date, location.latitude, location.longitude, sun);
  res.json({ version: '1', instant: date.toISOString(), location: { id: location.id, name: location.name, country: location.country, timezone: location.timezone }, moon: lunar });
});

app.get('/api/v1/celestial', async (req, res) => {
  apiHeaders(res);
  const location = await resolveLocation(req.query['location']);
  if (!location) return apiError(res, 400, 'INVALID_LOCATION', 'Use a valid preset location id.');
  const date = resolveApiDate(req.query['at']);
  if (!date) return apiError(res, 400, 'INVALID_TIMESTAMP', 'Use an ISO-8601 timestamp in the at parameter.');
  const celestial = getCelestialState(date, location.latitude, location.longitude, location.timezone);
  res.json({ version: '1', instant: date.toISOString(), location: { id: location.id, name: location.name, country: location.country, timezone: location.timezone }, celestial });
});

app.get('/api/v1/events', async (req, res) => {
  apiHeaders(res);
  const location = await resolveLocation(req.query['location']);
  if (!location) return apiError(res, 400, 'INVALID_LOCATION', 'Use a valid preset location id.');
  const rawDate = typeof req.query['date'] === 'string' ? req.query['date'] : '';
  const date = rawDate ? new Date(rawDate + 'T12:00:00Z') : new Date();
  if (!Number.isFinite(date.getTime())) return apiError(res, 400, 'INVALID_DATE', 'Use an ISO date such as 2026-09-26.');
  const events = calculateSolarEvents(date, location.latitude, location.longitude, location.timezone);
  res.json({ version: '1', date: rawDate || date.toISOString().slice(0, 10), location: { id: location.id, name: location.name, country: location.country, timezone: location.timezone }, events });
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\nSitemap: https://2piclock.com/sitemap.xml\n');
});

app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml').send(buildSitemap());
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
