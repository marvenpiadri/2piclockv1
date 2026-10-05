import { Injectable, ErrorHandler, signal, PLATFORM_ID, inject, NgZone } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface AppErrorLog {
  id: string;
  message: string;
  stack?: string;
  type: 'error' | 'warning' | 'info';
  timestamp: number;
  url?: string;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService implements ErrorHandler {
  private platformId = inject(PLATFORM_ID);
  private ngZone = inject(NgZone);
  private isBrowser = isPlatformBrowser(this.platformId);

  private readonly STORAGE_KEY = '2piclock_error_logs';
  private readonly MAX_STORED_ERRORS = 50;

  readonly logs = signal<AppErrorLog[]>([]);
  readonly activeNotifications = signal<AppErrorLog[]>([]);

  constructor() {
    if (this.isBrowser && typeof localStorage !== 'undefined') {
      this.loadLogsFromStorage();
    }
  }

  handleError(error: unknown): void {
    const errorObj = this.normalizeError(error);
    
    // 1. Log to browser/server console
    console.error('[2PiClock Application Error]', {
      id: errorObj.id,
      timestamp: new Date(errorObj.timestamp).toISOString(),
      message: errorObj.message,
      stack: errorObj.stack,
      url: errorObj.url,
      raw: error
    });

    // 2. Persist to local storage in browser
    this.recordLog(errorObj);

    // 3. Queue user notification inside Angular zone
    this.ngZone.run(() => {
      this.notifyUser(errorObj);
    });
  }

  showNotification(message: string, type: 'error' | 'warning' | 'info' = 'error', durationMs = 6000): void {
    const notification: AppErrorLog = {
      id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      type,
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location?.href : undefined
    };

    this.recordLog(notification);
    this.notifyUser(notification, durationMs);
  }

  dismissNotification(id: string): void {
    this.activeNotifications.update(list => list.filter(item => item.id !== id));
  }

  clearAllNotifications(): void {
    this.activeNotifications.set([]);
  }

  clearStoredLogs(): void {
    this.logs.set([]);
    if (this.isBrowser && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(this.STORAGE_KEY);
      } catch {
        // Ignore storage access errors
      }
    }
  }

  private notifyUser(item: AppErrorLog, autoDismissMs = 6000): void {
    // Avoid duplicate notifications
    const existing = this.activeNotifications().find(n => n.message === item.message);
    if (existing) return;

    this.activeNotifications.update(current => [item, ...current.slice(0, 3)]);

    if (autoDismissMs > 0 && typeof setTimeout !== 'undefined') {
      setTimeout(() => {
        this.dismissNotification(item.id);
      }, autoDismissMs);
    }
  }

  private recordLog(item: AppErrorLog): void {
    this.logs.update(current => [item, ...current.slice(0, this.MAX_STORED_ERRORS - 1)]);
    
    if (this.isBrowser && typeof localStorage !== 'undefined') {
      try {
        const stored = this.logs();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stored));
      } catch {
        // Storage might be full or blocked; fail silently
      }
    }
  }

  private loadLogsFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed: AppErrorLog[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.logs.set(parsed.slice(0, this.MAX_STORED_ERRORS));
        }
      }
    } catch {
      // Ignore parse failure
    }
  }

  private normalizeError(error: unknown): AppErrorLog {
    let message = 'An unexpected application exception occurred';
    let stack: string | undefined;

    if (error instanceof Error) {
      message = error.message || message;
      stack = error.stack;
    } else if (typeof error === 'string') {
      message = error;
    } else if (error && typeof error === 'object') {
      if ('message' in error && typeof (error as { message: unknown }).message === 'string') {
        message = (error as { message: string }).message;
      } else {
        message = JSON.stringify(error);
      }
    }

    return {
      id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      message,
      stack,
      type: 'error',
      timestamp: Date.now(),
      url: typeof window !== 'undefined' ? window.location?.href : undefined
    };
  }
}
