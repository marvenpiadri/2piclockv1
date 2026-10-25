import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { handleApiRequest } from './server/api';
import { getLocationCatalogue, type CloudflareEnv } from './server/location-catalogue';
import type { GeoLocation } from './app/core/models/location.model';

const angularApp = new AngularAppEngine();

const staticSitemapPages = [
  '/', '/api', '/weather', '/astronomy', '/tonight', '/world', '/world-clocks',
  '/events', '/alerts', '/maps/clocks', '/maps/radio', '/time/converter',
  '/time/difference', '/time/duration', '/time/date-difference', '/time/add-subtract',
  '/time/countdown', '/time/unix-timestamp', '/time/world-matrix', '/widget',
  '/dashboard', '/sleep-calculator', '/radio/stations', '/radio/map', '/atmosphere',
  '/ephemeris', '/planner', '/space', '/stargazing', '/eclipses', '/satellites'
];
const escapeXml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const xmlResponse = (body: string) => new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600, s-maxage=86400' } });
const sitemapResponse = (paths: string[]) => xmlResponse('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + [...new Set(paths)].map(path => '  <url><loc>https://2piclock.com' + escapeXml(path) + '</loc></url>').join('\n') + '\n</urlset>');
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const slugify = (value: string) => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const locationSlug = (location: Pick<GeoLocation, 'country' | 'name'>) => slugify(location.country) + '/' + slugify(location.name);

async function handleRequest(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const path = url.pathname;
  const cleanPath = path.length > 1 && path.endsWith('/') && !path.startsWith('/api/')
    ? path.replace(/\/+$/, '')
    : path;

  if (host === 'www.2piclock.com' || (host === '2piclock.com' && url.protocol !== 'https:')) {
    return Response.redirect('https://2piclock.com' + cleanPath + url.search, 308);
  }
  if (cleanPath !== path) return Response.redirect(new URL(cleanPath + url.search, url.origin), 308);
  if (path === '/api/v1' || path.startsWith('/api/v1/')) return handleApiRequest(request, env);

  if (path === '/robots.txt') {
    return new Response('User-agent: *\nAllow: /\nSitemap: https://2piclock.com/sitemap.xml\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
  }

  if (path === '/sitemap-pages.xml') return sitemapResponse(staticSitemapPages);
  if (path === '/sitemap.xml' || /^\/sitemap-locations-\d+\.xml$/.test(path)) {
    try {
      const all = await getLocationCatalogue(env);
      const chunkCount = Math.ceil(all.length * 7 / 40000);
      if (path === '/sitemap.xml') {
        const urls = ['https://2piclock.com/sitemap-pages.xml', ...Array.from({ length: chunkCount }, (_, i) => 'https://2piclock.com/sitemap-locations-' + i + '.xml')];
        const body = '<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(value => '  <sitemap><loc>' + escapeXml(value) + '</loc></sitemap>').join('\n') + '\n</sitemapindex>';
        return xmlResponse(body);
      }
      const chunk = Number(path.match(/(\d+)\.xml$/)?.[1]);
      const perChunk = Math.floor(40000 / 7);
      const start = chunk * perChunk;
      if (!Number.isInteger(chunk) || start >= all.length) return new Response('Sitemap not found.', { status: 404 });
      const urls = all.slice(start, start + perChunk).flatMap(location => {
        const base = '/' + locationSlug(location);
        return [base, base + '/time', base + '/weather', base + '/astronomy', base + '/tonight', base + '/sun', base + '/moon'];
      });
      return sitemapResponse(urls);
    } catch {
      return new Response('Sitemap temporarily unavailable.', { status: 503 });
    }
  }
  const legacy = path.match(/^\/([a-z]{2}-\d+)(?:\/([a-z0-9-]+))?$/i);
  if (legacy) {
    try {
      const all = await getLocationCatalogue(env);
      const location = all.find(item => item.id.toLowerCase() === legacy[1].toLowerCase());
      if (location) return Response.redirect(new URL('/' + locationSlug(location) + (legacy[2] ? '/' + legacy[2] : '') + url.search, url.origin), 301);
    } catch { /* Preserve the normal app fallback if the catalogue is unavailable. */ }
  }
  return await angularApp.handle(request) ?? new Response('Not found', { status: 404 });
}

// Angular CLI's local SSR adapter; Cloudflare requests use the Worker entry below.
export const reqHandler = createRequestHandler(async request =>
  await angularApp.handle(request) ?? new Response('Not found', { status: 404 }),
);

export default {
  fetch(request: Request, env: CloudflareEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};
