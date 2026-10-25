import type { GeoLocation } from '../app/core/models/location.model';

export interface CloudflareEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

let cataloguePromise: Promise<GeoLocation[]> | undefined;

export function getLocationCatalogue(env: CloudflareEnv): Promise<GeoLocation[]> {
  if (!cataloguePromise) {
    cataloguePromise = env.ASSETS.fetch(new Request('https://2piclock-assets/data/locations.json'))
      .then(async response => {
        if (!response.ok) throw new Error('Location catalogue unavailable');
        return await response.json() as GeoLocation[];
      })
      .catch(error => {
        cataloguePromise = undefined;
        throw error;
      });
  }
  return cataloguePromise;
}
