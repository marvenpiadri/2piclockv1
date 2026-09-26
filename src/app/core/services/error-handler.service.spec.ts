import '@angular/compiler';
import { describe, it, expect, beforeEach } from 'vitest';
import { Injector, PLATFORM_ID, provideZonelessChangeDetection, NgZone } from '@angular/core';
import { ErrorHandlerService } from './error-handler.service';

describe('ErrorHandlerService Unit Tests (Jasmine / Karma compliant)', () => {
  let errorHandler: ErrorHandlerService;

  beforeEach(() => {
    try {
      localStorage.removeItem('2piclock_error_logs');
    } catch {
      // Ignore if unavailable
    }

    const injector = Injector.create({
      providers: [
        provideZonelessChangeDetection(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { 
          provide: NgZone, 
          useValue: { 
            run: <T>(fn: () => T): T => fn(),
            runOutsideAngular: <T>(fn: () => T): T => fn() 
          } 
        },
        ErrorHandlerService
      ]
    });

    errorHandler = injector.get(ErrorHandlerService);
  });

  it('should initialize with empty or stored logs', () => {
    expect(errorHandler).toBeTruthy();
    expect(Array.isArray(errorHandler.logs())).toBe(true);
    expect(Array.isArray(errorHandler.activeNotifications())).toBe(true);
  });

  it('should catch, normalize, and log standard Error objects', () => {
    const testError = new Error('Test application crash simulation');
    errorHandler.handleError(testError);

    const logs = errorHandler.logs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].message).toBe('Test application crash simulation');
    expect(logs[0].type).toBe('error');
    expect(logs[0].timestamp).toBeGreaterThan(0);

    const active = errorHandler.activeNotifications();
    expect(active.length).toBeGreaterThan(0);
    expect(active[0].message).toBe('Test application crash simulation');
  });

  it('should display custom notifications and allow dismissing them', () => {
    errorHandler.showNotification('Astronomical telemetry updated', 'info');

    let active = errorHandler.activeNotifications();
    expect(active.length).toBe(1);
    expect(active[0].message).toBe('Astronomical telemetry updated');
    expect(active[0].type).toBe('info');

    // Dismiss notification
    errorHandler.dismissNotification(active[0].id);
    active = errorHandler.activeNotifications();
    expect(active.length).toBe(0);
  });

  it('should clear stored logs on request', () => {
    errorHandler.handleError('Simulated string exception');
    expect(errorHandler.logs().length).toBe(1);

    errorHandler.clearStoredLogs();
    expect(errorHandler.logs().length).toBe(0);
  });
});
