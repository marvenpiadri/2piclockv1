import '@angular/compiler';
import { Injector, PLATFORM_ID } from '@angular/core';
import { ObservatoryViewService } from './observatory-view.service';
import { describe, it, expect, beforeEach } from 'vitest';

describe('ObservatoryViewService', () => {
  let service: ObservatoryViewService;

  beforeEach(() => {
    const injector = Injector.create({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        ObservatoryViewService
      ]
    });
    service = injector.get(ObservatoryViewService);
  });

  it('should initialize with default view "sky"', () => {
    expect(service.activeView()).toBe('sky');
    expect(service.currentViewOption().label).toBe('SKY');
  });

  it('should switch between world, sky, and space views', () => {
    service.setView('world');
    expect(service.activeView()).toBe('world');
    expect(service.currentViewOption().label).toBe('WORLD');

    service.setView('space');
    expect(service.activeView()).toBe('space');
    expect(service.currentViewOption().label).toBe('SPACE');

    service.setView('sky');
    expect(service.activeView()).toBe('sky');
  });

  it('should cycle views correctly in order: world -> sky -> space -> world', () => {
    service.setView('world');
    service.cycleView();
    expect(service.activeView()).toBe('sky');

    service.cycleView();
    expect(service.activeView()).toBe('space');

    service.cycleView();
    expect(service.activeView()).toBe('world');
  });

  it('should provide full metadata for all 3 views', () => {
    expect(service.allViews.length).toBe(3);
    const ids = service.allViews.map(v => v.id);
    expect(ids).toContain('world');
    expect(ids).toContain('sky');
    expect(ids).toContain('space');
  });
});
