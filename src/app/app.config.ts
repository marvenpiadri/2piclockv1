import {
  ApplicationConfig,
  ErrorHandler,
  PLATFORM_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideClientHydration, withHttpTransferCacheOptions } from '@angular/platform-browser';
import { routes } from './app.routes';
import { SeoService } from './core/services/seo.service';
import { ErrorHandlerService } from './core/services/error-handler.service';
import { LocationService } from './core/services/location.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withFetch()),
    provideClientHydration(
      withHttpTransferCacheOptions({
        includePostRequests: false,
      }),
    ),
    provideRouter(routes),
    { provide: ErrorHandler, useClass: ErrorHandlerService },
    provideAppInitializer(() => {
      const seoService = inject(SeoService);
      try {
        seoService.init();
      } catch {
        // Non-fatal SEO init.
      }

      const locationService = inject(LocationService);
      const platformId = inject(PLATFORM_ID);
      if (isPlatformBrowser(platformId)) {
        // Do not block application bootstrap on GPS. The root route guard
        // shares this promise and waits only when it actually needs a location.
        void locationService.ensureInitialLocation().catch(() => undefined);
      }
    }),
  ],
};
