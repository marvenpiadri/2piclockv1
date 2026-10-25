import { RenderMode, ServerRoute } from '@angular/ssr';

// Cloudflare Pages serves the Angular app as a static SPA.
// API requests are handled separately by Pages Functions.
export const serverRoutes: ServerRoute[] = [
  { path: '**', renderMode: RenderMode.Client },
];
