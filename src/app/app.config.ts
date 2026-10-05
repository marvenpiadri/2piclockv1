import {
  ApplicationConfig,
  ErrorHandler,
  PLATFORM_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { SeoService } from './core/services/seo.service';
import { ErrorHandlerService } from './core/services/error-handler.service';
import { LocationService } from './core/services/location.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    { provide: ErrorHandler, useClass: ErrorHandlerService },
    provideAppInitializer(async () => {
      try {
        inject(SeoService).init();
      } catch {
        // Non-fatal SEO init
      }
      const locationService = inject(LocationService);
      const platformId = inject(PLATFORM_ID);
      if (isPlatformBrowser(platformId)) {
        try {
          await locationService.ensureInitialLocation();
        } catch {
          // Non-fatal initial location discovery
        }
      }
    }),
  ],
};
