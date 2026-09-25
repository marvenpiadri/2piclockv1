import { Injectable, computed, signal } from '@angular/core';
import { AstronomicalRegistryItem, CALCULATOR_REGISTRY } from '../models/astronomical-registry.model';

@Injectable({ providedIn: 'root' })
export class CalculatorRegistryService {
  readonly registry = signal<AstronomicalRegistryItem[]>(CALCULATOR_REGISTRY);

  readonly deepSpaceObservatoryEntry = computed(() => {
    return this.registry().find(item => item.slug === 'deep-space-observatory') ?? this.registry()[0];
  });

  getBySlug(slug: string): AstronomicalRegistryItem | undefined {
    return this.registry().find(item => item.slug === slug);
  }

  getByCategory(category: AstronomicalRegistryItem['category']): AstronomicalRegistryItem[] {
    return this.registry().filter(item => item.category === category);
  }
}
