import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { PRESET_LOCATIONS } from './app/core/models/location.model';
import { calculateSolarPosition } from './app/core/astronomy/astronomy-engine';

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
  '/', '/weather', '/astronomy', '/tonight',
  '/world', '/world-clocks', '/events',
  '/maps/clocks', '/maps/weather', '/maps/radio',
  '/time/converter', '/time/difference', '/time/duration',
  '/time/date-difference', '/time/add-subtract', '/time/countdown',
  '/time/unix-timestamp', '/time/world-matrix',
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
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60');
};

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

app.get('/api/v1/sky', (req, res) => {
  apiHeaders(res);
  const locationId = typeof req.query['location'] === 'string' ? req.query['location'] : '';
  const location = PRESET_LOCATIONS.find(item => item.id === locationId);
  if (!location) {
    res.status(404).json({ error: 'Unknown location', code: 'LOCATION_NOT_FOUND' });
    return;
  }

  const rawAt = typeof req.query['at'] === 'string' ? req.query['at'] : '';
  const date = rawAt ? new Date(rawAt) : new Date();
  if (!Number.isFinite(date.getTime())) {
    res.status(400).json({ error: 'Invalid at timestamp', code: 'INVALID_TIMESTAMP' });
    return;
  }

  const solar = calculateSolarPosition(date, location.latitude, location.longitude);
  res.json({
    version: '1',
    generatedAt: new Date().toISOString(),
    instant: date.toISOString(),
    location: {
      id: location.id,
      name: location.name,
      country: location.country,
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone
    },
    sun: {
      altitudeDeg: Number(solar.altitudeDeg.toFixed(4)),
      azimuthDeg: Number(solar.azimuthDeg.toFixed(4)),
      distanceAU: Number(solar.distanceAU.toFixed(8)),
      rightAscensionDeg: Number(solar.rightAscensionDeg.toFixed(4)),
      declinationDeg: Number(solar.declinationDeg.toFixed(4))
    }
  });
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
