import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { SeoService } from './core/services/seo.service';
import { ErrorHandlerService } from './core/services/error-handler.service';
import { LocationService } from './core/services/location.service';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    { provide: ErrorHandler, useClass: ErrorHandlerService },
    provideAppInitializer(() => {
      inject(SeoService).init();
      const locationService = inject(LocationService);
      const platformId = inject(PLATFORM_ID);
      return isPlatformBrowser(platformId) ? locationService.ensureInitialLocation() : undefined;
    }),
  ],
};
