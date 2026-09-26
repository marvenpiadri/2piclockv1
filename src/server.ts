import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { PRESET_LOCATIONS } from './app/core/models/location.model';
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

const resolveApiLocation = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  return PRESET_LOCATIONS.find(item => item.id === value);
};

const resolveApiDate = (value: unknown): Date | null => {
  if (typeof value !== 'string' || !value) return new Date();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

const apiError = (res: express.Response, status: number, code: string, message: string) => {
  res.status(status).json({ error: { code, message } });
};

app.options('/api/v1/{*splat}', (_req, res) => res.sendStatus(204));

app.get('/api/v1', (_req, res) => {
  apiHeaders(res);
  res.json({
    name: '2piClock API',
    version: '1',
    documentation: 'https://2piclock.com/api',
    endpoints: [
      '/api/v1/locations',
      '/api/v1/solar?location=paris&at=2026-09-26T12:00:00Z',
      '/api/v1/lunar?location=paris&at=2026-09-26T12:00:00Z',
      '/api/v1/celestial?location=paris&at=2026-09-26T12:00:00Z',
      '/api/v1/events?location=paris&date=2026-09-26'
    ]
  });
});

app.get('/api/v1/locations', (_req, res) => {
  apiHeaders(res);
  res.json({
    version: '1',
    locations: PRESET_LOCATIONS.map(location => ({
      id: location.id,
      name: location.name,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone
    }))
  });
});

app.get('/api/v1/solar', (req, res) => {
  apiHeaders(res);
  const location = resolveApiLocation(req.query['location']);
  if (!location) return apiError(res, 400, 'INVALID_LOCATION', 'Use a valid preset location id.');
  const date = resolveApiDate(req.query['at']);
  if (!date) return apiError(res, 400, 'INVALID_TIMESTAMP', 'Use an ISO-8601 timestamp in the at parameter.');
  const solar = calculateSolarPosition(date, location.latitude, location.longitude);
  res.json({ version: '1', instant: date.toISOString(), location: { id: location.id, name: location.name, country: location.country, timezone: location.timezone }, solar });
});

app.get('/api/v1/lunar', (req, res) => {
  apiHeaders(res);
  const location = resolveApiLocation(req.query['location']);
  if (!location) return apiError(res, 400, 'INVALID_LOCATION', 'Use a valid preset location id.');
  const date = resolveApiDate(req.query['at']);
  if (!date) return apiError(res, 400, 'INVALID_TIMESTAMP', 'Use an ISO-8601 timestamp in the at parameter.');
  const sun = calculateSolarPosition(date, location.latitude, location.longitude);
  const lunar = calculateLunarPosition(date, location.latitude, location.longitude, sun);
  res.json({ version: '1', instant: date.toISOString(), location: { id: location.id, name: location.name, country: location.country, timezone: location.timezone }, moon: lunar });
});

app.get('/api/v1/celestial', (req, res) => {
  apiHeaders(res);
  const location = resolveApiLocation(req.query['location']);
  if (!location) return apiError(res, 400, 'INVALID_LOCATION', 'Use a valid preset location id.');
  const date = resolveApiDate(req.query['at']);
  if (!date) return apiError(res, 400, 'INVALID_TIMESTAMP', 'Use an ISO-8601 timestamp in the at parameter.');
  const celestial = getCelestialState(date, location.latitude, location.longitude, location.timezone);
  res.json({ version: '1', instant: date.toISOString(), location: { id: location.id, name: location.name, country: location.country, timezone: location.timezone }, celestial });
});

app.get('/api/v1/events', (req, res) => {
  apiHeaders(res);
  const location = resolveApiLocation(req.query['location']);
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
