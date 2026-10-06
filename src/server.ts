import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {dirname, join} from 'node:path';
import {createRequire} from 'node:module';
import {readdirSync, readFileSync} from 'node:fs';
import { GeoLocation } from './app/core/models/location.model';
import { calculateSolarPosition, calculateLunarPosition, getCelestialState, calculateSolarEvents } from './app/core/astronomy/astronomy-engine';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.set('trust proxy', true);

// Enforce the single public URL used by canonical tags and sitemaps.
// Vercel terminates TLS before the function, so inspect forwarded protocol
// rather than relying on req.protocol alone.
app.use((req, res, next) => {
  const host = req.get('host')?.split(':')[0].toLowerCase() ?? '';
  const forwardedProto = String(req.get('x-forwarded-proto') ?? '').split(',')[0].trim().toLowerCase();
  const isCanonicalHost = host === '2piclock.com';
  const isAliasHost = host === 'www.2piclock.com';
  const shouldRedirectToHttps = (isCanonicalHost || isAliasHost) && forwardedProto === 'http';
  const pathname = req.path;
  const shouldRemoveTrailingSlash = pathname.length > 1 && pathname.endsWith('/') && !pathname.startsWith('/api/');

  if (isAliasHost || shouldRedirectToHttps) {
    const cleanPath = shouldRemoveTrailingSlash ? pathname.replace(/\/+$/, '') : pathname;
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return res.redirect(308, 'https://2piclock.com' + (cleanPath || '/') + query);
  }

  if (shouldRemoveTrailingSlash) {
    const cleanPath = pathname.replace(/\/+$/, '');
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    return res.redirect(308, (cleanPath || '/') + query);
  }

  next();
});

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
  '/world', '/world-clocks', '/events', '/alerts',
  '/maps/clocks', '/maps/radio',
  '/time/converter', '/time/difference', '/time/duration',
  '/time/date-difference', '/time/add-subtract', '/time/countdown',
  '/time/unix-timestamp', '/time/world-matrix',
  '/widget', '/dashboard',
  '/sleep-calculator',
  '/radio/stations', '/radio/map',
  '/atmosphere', '/ephemeris', '/planner', '/space',
  '/stargazing', '/eclipses', '/satellites'
];
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const buildUrlSet = (paths: string[]) => {
  const uniqueUrls = [...new Set(paths)];
  const entries = uniqueUrls
    .map(path => `  <url><loc>https://2piclock.com${escapeXml(path)}</loc></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;
};

const buildSitemapIndex = (locationSitemapCount: number) => {
  const sitemapUrls = [
    'https://2piclock.com/sitemap-pages.xml',
    ...Array.from(
      { length: locationSitemapCount },
      (_, index) => `https://2piclock.com/sitemap-locations-${index}.xml`
    )
  ];
  const entries = sitemapUrls
    .map(url => `  <sitemap><loc>${escapeXml(url)}</loc></sitemap>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;
};

const locationSitemapChunkSize = 40000;
const locationSitemapPagesPerLocation = 7;


const apiHeaders = (res: express.Response) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
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
const readJsonFile = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;

const buildLocationIndex = async (): Promise<GeoLocation[]> => {
  const locations = readJsonFile<GeoLocation[]>(join(browserDistFolder, 'data', 'locations.json'));

  if (!locations.length) throw new Error('The bundled location catalogue contains no cities.');

  const uniqueLocations = new Map<string, GeoLocation>();
  for (const location of locations) {
    const key = [
      normalizeLocationText(location.name),
      normalizeLocationText(location.countryCode)
    ].join('|');
    if (!uniqueLocations.has(key)) uniqueLocations.set(key, location);
  }

  return [...uniqueLocations.values()];
};
const getLocationIndex = (): Promise<GeoLocation[]> => {
  if (!locationIndexPromise) {
    locationIndexPromise = buildLocationIndex().then(locations => {
      locationById.clear();
      locationBySlug.clear();
      for (const location of locations) {
        locationById.set(location.id.toLowerCase(), location);
        locationBySlug.set(locationSlug(location), location);
      }
      locationSearchCache.clear();
      return locations;
    }).catch(error => {
      locationIndexPromise = undefined;
      locationById.clear();
      locationBySlug.clear();
      throw error;
    });
  }
  return locationIndexPromise;
};

const resolveLocation = async (value: unknown): Promise<GeoLocation | undefined> => {
  if (typeof value !== 'string') return undefined;
  await getLocationIndex();
  const normalized = value.trim().toLowerCase();
  return locationById.get(normalized) ?? locationBySlug.get(normalized.replace(/^\/+|\/+$/g, ''));
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

app.get('/api/v1/assets/meteocon/:slug', async (req, res) => {
  const slug = String(req.params['slug'] ?? '');
  if (!/^[a-z0-9-]+$/.test(slug)) return apiError(res, 400, 'INVALID_ASSET', 'Invalid weather icon.');
  try {
    const upstream = await fetch(`https://cdn.jsdelivr.net/npm/@meteocons/svg@0.1.0/fill/${slug}.svg`);
    if (!upstream.ok) return apiError(res, 404, 'ASSET_NOT_FOUND', 'Weather icon not found.');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.send(await upstream.text());
  } catch {
    apiError(res, 502, 'ASSET_UNAVAILABLE', 'Weather icon is temporarily unavailable.');
  }
});

app.get('/api/v1/assets/flag/:countryCode', async (req, res) => {
  const countryCode = String(req.params['countryCode'] ?? '').toLowerCase();
  if (!/^[a-z]{2}$/.test(countryCode)) return apiError(res, 400, 'INVALID_ASSET', 'Invalid country flag.');
  try {
    const upstream = await fetch(`https://flagcdn.com/w160/${countryCode}.png`);
    if (!upstream.ok) return apiError(res, 404, 'ASSET_NOT_FOUND', 'Country flag not found.');
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
    res.send(buffer);
  } catch {
    apiError(res, 502, 'ASSET_UNAVAILABLE', 'Country flag is temporarily unavailable.');
  }
});



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

    const allowed = ['current', 'hourly', 'forecast_days', 'timezone', 'wind_speed_unit', 'precipitation_unit'];
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


app.get('/api/v1/timezone', (req, res) => {
  apiHeaders(res);

  const timezone = typeof req.query['timezone'] === 'string' ? req.query['timezone'].trim() : '';
  const rawAt = typeof req.query['at'] === 'string' ? req.query['at'] : '';
  const date = rawAt ? new Date(rawAt) : new Date();

  if (!timezone) return apiError(res, 400, 'MISSING_TIMEZONE', 'Provide an IANA timezone.');
  if (!Number.isFinite(date.getTime())) return apiError(res, 400, 'INVALID_TIMESTAMP', 'Provide a valid ISO-8601 timestamp.');

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'longOffset',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);

    const offsetLabel = parts.find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
    const match = offsetLabel.match(/^GMT([+-])(\d{2}):?(\d{2})$/);
    let offsetMinutes = 0;
    if (match) {
      const sign = match[1] === '+' ? 1 : -1;
      const hours = Number(match[2]);
      const minutes = Number(match[3]);
      offsetMinutes = sign * (hours * 60 + minutes);
    } else if (offsetLabel !== 'GMT' && offsetLabel !== 'UTC') {
      return apiError(res, 422, 'TIMEZONE_OFFSET_UNAVAILABLE', 'The timezone offset could not be resolved.');
    }

    res.json({
      version: '1',
      timezone,
      instant: date.toISOString(),
      offsetMinutes,
      offset: offsetMinutes === 0
        ? 'UTC+0'
        : 'UTC' + (offsetMinutes > 0 ? '+' : '-') +
          String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0') +
          ':' + String(Math.abs(offsetMinutes) % 60).padStart(2, '0')
    });
  } catch {
    apiError(res, 400, 'INVALID_TIMEZONE', 'Use a valid IANA timezone.');
  }
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

app.get('/api/v1/locations/nearest', async (req, res) => {
  apiHeaders(res);
  const latitude = Number(req.query['latitude']);
  const longitude = Number(req.query['longitude']);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return apiError(res, 400, 'INVALID_COORDINATES', 'Provide valid latitude and longitude.');
  }

  try {
    const locations = await getLocationIndex();
    const toRadians = (value: number) => value * Math.PI / 180;
    const earthRadiusKm = 6371;
    let nearest: GeoLocation | undefined;
    let nearestDistanceKm = Number.POSITIVE_INFINITY;

    for (const location of locations) {
      const dLat = toRadians(location.latitude - latitude);
      const dLon = toRadians(location.longitude - longitude);
      const lat1 = toRadians(latitude);
      const lat2 = toRadians(location.latitude);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
      const distanceKm = 2 * earthRadiusKm * Math.asin(Math.sqrt(a));
      if (distanceKm < nearestDistanceKm) {
        nearest = location;
        nearestDistanceKm = distanceKm;
      }
    }

    if (!nearest) {
      return apiError(res, 503, 'LOCATION_DATA_UNAVAILABLE', 'The city catalogue is temporarily unavailable.');
    }
    res.json({ version: '1', location: nearest, distanceKm: Math.round(nearestDistanceKm * 10) / 10 });
  } catch {
    apiError(res, 503, 'LOCATION_DATA_UNAVAILABLE', 'The internal city catalogue is temporarily unavailable.');
  }
});

app.get('/api/v1/locations/:id', async (req, res) => {
  apiHeaders(res);
  try {
    const location = await resolveLocation(req.params['id']);
    if (!location) return apiError(res, 404, 'LOCATION_NOT_FOUND', 'The requested location was not found.');
    res.json({ version: '1', location, slug: locationSlug(location) });
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

const redirectLegacyLocationUrl = async (req: express.Request, res: express.Response, section?: string) => {
  const legacyParam = req.params['location'];
  const legacyId = Array.isArray(legacyParam) ? legacyParam[0] : legacyParam;
  if (!/^[a-z]{2}-\d+$/i.test(legacyId)) return false;
  const location = await resolveLocation(legacyId);
  if (!location) return false;
  const canonical = '/' + locationSlug(location) + (section ? '/' + section : '');
  res.redirect(301, canonical);
  return true;
};

app.get(/^\/([a-z]{2}-\d+)$/, async (req, res, next) => {
  try {
    if (!(await redirectLegacyLocationUrl(req, res))) next();
  } catch {
    next();
  }
});

app.get(/^\/([a-z]{2}-\d+)\/([a-z0-9-]+)$/, async (req, res, next) => {
  try {
    const section = req.path.split('/')[2];
    if (!(await redirectLegacyLocationUrl(req, res, section))) next();
  } catch {
    next();
  }
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: https://2piclock.com/sitemap.xml\n`);
});

app.get('/sitemap.xml', async (_req, res) => {
  try {
    const locations = await getLocationIndex();
    const locationSitemapCount = Math.ceil(locations.length * locationSitemapPagesPerLocation / locationSitemapChunkSize);
    res.type('application/xml').send(buildSitemapIndex(locationSitemapCount));
  } catch {
    res.status(503).type('text/plain').send('Sitemap temporarily unavailable.');
  }
});

app.get('/sitemap-pages.xml', (_req, res) => {
  res.type('application/xml').send(buildUrlSet(staticSitemapUrls));
});

app.get('/sitemap-locations-:chunk.xml', async (req, res) => {
  const chunkParam = String(req.params['chunk'] ?? '');
  if (!/^\d+$/.test(chunkParam)) {
    res.status(404).type('text/plain').send('Sitemap not found.');
    return;
  }

  try {
    const locations = await getLocationIndex();
    const chunk = Number(chunkParam);
    const pagesPerChunk = Math.floor(locationSitemapChunkSize / locationSitemapPagesPerLocation);
    const start = chunk * pagesPerChunk;
    const end = Math.min(locations.length, start + pagesPerChunk);
    if (start >= locations.length) {
      res.status(404).type('text/plain').send('Sitemap not found.');
      return;
    }

    const paths: string[] = [];
    for (const location of locations.slice(start, end)) {
      const base = '/' + locationSlug(location);
      paths.push(
        base,
        base + '/time',
        base + '/weather',
        base + '/astronomy',
        base + '/tonight',
        base + '/sun',
        base + '/moon'
      );
    }
    res.type('application/xml').send(buildUrlSet(paths));
  } catch {
    res.status(503).type('text/plain').send('Sitemap temporarily unavailable.');
  }
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
