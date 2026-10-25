import { AngularAppEngine, createRequestHandler } from '@angular/ssr';
import { handleApiRequest, type CloudflareEnv } from './server/api';

const angularApp = new AngularAppEngine();

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
  if (path.startsWith('/api/v1')) return handleApiRequest(request, env);

  if (path === '/robots.txt') {
    return new Response('User-agent: *\nAllow: /\nSitemap: https://2piclock.com/sitemap.xml\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
    });
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
