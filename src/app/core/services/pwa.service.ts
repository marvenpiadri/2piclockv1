import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  readonly isInstallable = signal<boolean>(false);
  readonly isInstalled = signal<boolean>(false);
  readonly isIOS = signal<boolean>(false);
  readonly isOnline = signal<boolean>(true);
  readonly showIOSModal = signal<boolean>(false);

  private deferredPrompt: BeforeInstallPromptEvent | null = null;

  constructor() {
    if (!this.isBrowser) return;

    // Detect standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    this.isInstalled.set(isStandalone);

    // Detect iOS devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent) && !(window as any).MSStream;
    this.isIOS.set(isIOSDevice);

    // Network status
    this.isOnline.set(navigator.onLine);
    window.addEventListener('online', () => this.isOnline.set(true));
    window.addEventListener('offline', () => this.isOnline.set(false));

    // Listen for PWA install prompt
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.isInstallable.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled.set(true);
      this.isInstallable.set(false);
      this.deferredPrompt = null;
    });

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('PWA service worker registration notice:', err);
      });
    }
  }

  async promptInstall(): Promise<boolean> {
    if (this.isIOS()) {
      this.showIOSModal.set(true);
      return false;
    }

    if (!this.deferredPrompt) return false;

    await this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      this.isInstalled.set(true);
      this.isInstallable.set(false);
      this.deferredPrompt = null;
      return true;
    }
    return false;
  }

  closeIOSModal(): void {
    this.showIOSModal.set(false);
  }
}
