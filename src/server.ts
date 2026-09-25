import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';
import { PRESET_LOCATIONS } from './app/core/models/location.model';

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
  '/world', '/world-clocks',
  '/maps/clocks', '/maps/weather', '/maps/radio',
  '/time/converter', '/time/difference', '/time/duration',
  '/time/date-difference', '/time/add-subtract', '/time/countdown',
  '/time/unix-timestamp', '/time/world-matrix',
  '/radio/stations', '/radio/map', '/radio/favorites', '/radio/recent',
  '/atmosphere', '/ephemeris', '/planner', '/space'
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
  ]);
  const urls = [...staticSitemapUrls, ...placeUrls];
  const uniqueUrls = [...new Set(urls)];
  const entries = uniqueUrls.map(path => '  <url><loc>https://2piclock.com' + escapeXml(path) + '</loc></url>').join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + entries + '\n</urlset>';
};

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
