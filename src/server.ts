import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { PRESET_LOCATIONS, GeoLocation } from './app/core/models/location.model';
import { getCountries, getStatesOfCountry, getCitiesOfState } from '@countrystatecity/countries';
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
  const placeUrls = PRESET_LOCATIONS.flatMap(location => [
    '/' + location.id,
    '/' + location.id + '/time',
    '/' + location.id + '/weather',
    '/' + location.id + '/sun',
    '/' + location.id + '/moon',
    '/' + location.id + '/tonight',
    '/' + location.id + '/astronomy',
    '/' + location.id + '/events',
    '/' + location.id + '/stargazing',
    '/' + location.id + '/eclipses',
    '/' + location.id + '/satellites',
  ]);
  const urls = [...staticSitemapUrls, ...placeUrls];
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

const slugifyLocation = (value: string) =>
  value.normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const buildLocationIndex = async (): Promise<GeoLocation[]> => {
  const countries = await getCountries();
  const locations: GeoLocation[] = [...PRESET_LOCATIONS];
  const seen = new Set(locations.map(location => location.id));

  for (const country of countries) {
    const countryCode = String(country.iso2 ?? '').toUpperCase();
    if (!countryCode) continue;

    const states = await getStatesOfCountry(countryCode);

    for (const state of states) {
      const countryCities = await getCitiesOfState(countryCode, state.iso2);
      for (const city of countryCities as CityRecord[]) {
      const name = String(city.name ?? '').trim();
      const latitude = Number(city.latitude);
      const longitude = Number(city.longitude);
      if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;

      const id = `${countryCode.toLowerCase()}-${slugifyLocation(name)}`;
      if (seen.has(id)) continue;

      const timezone = city.timezone || 'UTC';
      locations.push({
        id,
        name,
        country: String(country.name ?? countryCode),
        countryCode,
        flag: String(country.emoji ?? ''),
        latitude,
        longitude,
        timezone,
        tier: 3
      });
      seen.add(id);
      }
    }
  }

  return locations;
};

const getLocationIndex = (): Promise<GeoLocation[]> => {
  if (!locationIndexPromise) {
    locationIndexPromise = buildLocationIndex().catch(error => {
      locationIndexPromise = undefined;
      throw error;
    });
  }
  return locationIndexPromise;
};

const resolveLocation = async (value: unknown): Promise<GeoLocation | undefined> => {
  if (typeof value !== 'string') return undefined;
  const id = value.trim().toLowerCase();
  const preset = PRESET_LOCATIONS.find(item => item.id === id);
  if (preset) return preset;
  const locations = await getLocationIndex();
  return locations.find(item => item.id === id);
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
      '/api/v1/locations',
      '/api/v1/locations/search?q=casablanca',
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
  const query = typeof req.query['q'] === 'string' ? req.query['q'].trim().toLocaleLowerCase() : '';
  const count = Math.min(20, Math.max(1, Number(req.query['count'] ?? 8) || 8));

  try {
    const locations = await getLocationIndex();
    const results = locations
      .filter(location => {
        if (!query) return true;
        return [
          location.name,
          location.country,
          location.countryCode,
          location.id,
          location.timezone
        ].some(value => value.toLocaleLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (!query) return (a.tier ?? 3) - (b.tier ?? 3);
        const aName = a.name.toLocaleLowerCase();
        const bName = b.name.toLocaleLowerCase();
        const aExact = [a.id, aName, a.countryCode.toLocaleLowerCase()].includes(query);
        const bExact = [b.id, bName, b.countryCode.toLocaleLowerCase()].includes(query);
        const aPrefix = aName.startsWith(query);
        const bPrefix = bName.startsWith(query);
        return Number(bExact) - Number(aExact)
          || Number(bPrefix) - Number(aPrefix)
          || (a.tier ?? 3) - (b.tier ?? 3)
          || a.name.localeCompare(b.name);
      })
      .slice(0, count);

    res.json({
      version: '1',
      query,
      count: results.length,
      totalLocations: locations.length,
      source: 'country-state-city-database',
      locations: results
    });
  } catch {
    apiError(res, 503, 'LOCATION_DATA_UNAVAILABLE', 'The internal city catalogue is temporarily unavailable.');
  }
});

app.get('/api/v1/locations', async (_req, res) => {
  apiHeaders(res);
  try {
    const locations = await getLocationIndex();
    res.json({
      version: '1',
      count: locations.length,
      source: 'country-state-city-database',
      locations: locations.map(location => ({
        id: location.id,
        name: location.name,
        country: location.country,
        countryCode: location.countryCode,
        flag: location.flag,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone
      }))
    });
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
