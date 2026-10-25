import type { GeoLocation } from '../app/core/models/location.model';
import {
  calculateSolarPosition,
  calculateLunarPosition,
  getCelestialState,
  calculateSolarEvents,
} from '../app/core/astronomy/astronomy-engine';

export interface CloudflareEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'public, max-age=60, s-maxage=60',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'X-Robots-Tag': 'noindex, nofollow',
  },
});
const error = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, status);
const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const slugify = (value: string) => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dateFrom = (value: string | null) => {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
let cataloguePromise: Promise<GeoLocation[]> | undefined;
async function locations(env: CloudflareEnv): Promise<GeoLocation[]> {
  if (!cataloguePromise) {
    cataloguePromise = env.ASSETS.fetch(new Request('https://2piclock-assets/data/locations.json'))
      .then(async response => {
        if (!response.ok) throw new Error('Location catalogue unavailable');
        return await response.json() as GeoLocation[];
      })
      .catch(error => { cataloguePromise = undefined; throw error; });
  }
  return cataloguePromise;
}
const locationSlug = (location: GeoLocation) => slugify(location.country) + '/' + slugify(location.name);
async function resolveLocation(env: CloudflareEnv, value: string | null) {
  if (!value) return undefined;
  const all = await locations(env);
  const key = value.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
  return all.find(item => item.id.toLowerCase() === key || locationSlug(item) === key);
}
const apiHeaders = { 'X-Robots-Tag': 'noindex, nofollow', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60, s-maxage=60' };

export const handleApiRequest = async (request: Request, env: CloudflareEnv): Promise<Response> => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: apiHeaders });
  if (request.method !== 'GET') return error(405, 'METHOD_NOT_ALLOWED', 'Only GET requests are supported.');

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean);
  const [resource, action, extra] = path;
  try {
    if (resource === 'assets' && action === 'meteocon' && extra) {
      if (!/^[a-z0-9-]+$/.test(extra)) return error(400, 'INVALID_ASSET', 'Invalid weather icon.');
      const upstream = await fetch(`https://cdn.jsdelivr.net/npm/@meteocons/svg@0.1.0/fill/${extra}.svg`);
      return upstream.ok
        ? new Response(await upstream.text(), { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } })
        : error(404, 'ASSET_NOT_FOUND', 'Weather icon not found.');
    }
    if (resource === 'assets' && action === 'flag' && extra) {
      if (!/^[a-z]{2}$/i.test(extra)) return error(400, 'INVALID_ASSET', 'Invalid country flag.');
      const upstream = await fetch(`https://flagcdn.com/w160/${extra.toLowerCase()}.png`);
      return upstream.ok
        ? new Response(await upstream.arrayBuffer(), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400, s-maxage=604800' } })
        : error(404, 'ASSET_NOT_FOUND', 'Country flag not found.');
    }
    if (resource === 'weather') {
      let latitude = url.searchParams.get('latitude') ?? '';
      let longitude = url.searchParams.get('longitude') ?? '';
      const locationId = url.searchParams.get('location');
      if (locationId) {
        const location = await resolveLocation(env, locationId);
        if (!location) return error(400, 'INVALID_LOCATION', 'Use a valid location id.');
        latitude = String(location.latitude);
        longitude = String(location.longitude);
      }
      if (!latitude || !longitude || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
        return error(400, 'MISSING_COORDINATES', 'Provide valid latitude and longitude, or a location id.');
      }
      const allowed = ['current', 'hourly', 'forecast_days', 'timezone', 'wind_speed_unit', 'precipitation_unit'];
      const query = new URLSearchParams({ latitude, longitude });
      for (const key of allowed) {
        const value = url.searchParams.get(key);
        if (value) query.set(key, value);
      }
      const upstream = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { headers: { Accept: 'application/json' } });
      if (!upstream.ok) return error(502, 'WEATHER_UPSTREAM_ERROR', `Weather provider returned HTTP ${upstream.status}.`);
      return new Response(await upstream.text(), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=600' } });
    }
    if (resource === 'timezone') {
      const timezone = url.searchParams.get('timezone')?.trim() ?? '';
      const date = dateFrom(url.searchParams.get('at'));
      if (!timezone) return error(400, 'MISSING_TIMEZONE', 'Provide an IANA timezone.');
      if (!date) return error(400, 'INVALID_TIMESTAMP', 'Provide a valid ISO-8601 timestamp.');
      try {
        const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, timeZoneName: 'longOffset', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
        const label = parts.find(part => part.type === 'timeZoneName')?.value ?? 'GMT';
        const match = label.match(/^GMT([+-])(\d{2}):?(\d{2})$/);
        const offsetMinutes = match ? (match[1] === '+' ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3])) : 0;
        return json({ version: '1', timezone, instant: date.toISOString(), offsetMinutes, offset: offsetMinutes === 0 ? 'UTC+0' : 'UTC' + (offsetMinutes > 0 ? '+' : '-') + String(Math.floor(Math.abs(offsetMinutes) / 60)).padStart(2, '0') + ':' + String(Math.abs(offsetMinutes) % 60).padStart(2, '0') });
      } catch { return error(400, 'INVALID_TIMEZONE', 'Use a valid IANA timezone.'); }
    }
    if (resource === 'locations') {
      const all = await locations(env);
      if (action === 'search') {
        const raw = url.searchParams.get('q') ?? '';
        const q = normalize(raw);
        const count = Math.min(50, Math.max(1, Number(url.searchParams.get('count') ?? 12) || 12));
        const matches = q.length < 2 ? [] : all.filter(item => [item.name, item.country, item.countryCode, item.id, item.timezone].some(value => normalize(String(value)).includes(q)))
          .sort((a,b) => Number(normalize(b.name) === q) - Number(normalize(a.name) === q) || a.name.localeCompare(b.name));
        return json({ version: '1', query: q, count: Math.min(count, matches.length), locations: matches.slice(0, count) });
      }
      if (action === 'random') {
        const count = Math.min(50, Math.max(1, Number(url.searchParams.get('count') ?? 50) || 50));
        const sample = all.slice();
        for (let i = sample.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [sample[i], sample[j]] = [sample[j], sample[i]]; }
        return json({ version: '1', count: Math.min(count, sample.length), locations: sample.slice(0, count) });
      }
      if (action === 'map') {
        const count = Math.min(5000, Math.max(500, Number(url.searchParams.get('count') ?? 2500) || 2500));
        const grid = new Map<string, GeoLocation>();
        for (const item of all) {
          const key = Math.floor((item.latitude + 90) / 2) + ':' + Math.floor((item.longitude + 180) / 3);
          if (!grid.has(key)) grid.set(key, item);
        }
        const result = [...grid.values()].slice(0, count);
        return json({ version: '1', count: result.length, locations: result });
      }
      if (action === 'nearest') {
        const lat = Number(url.searchParams.get('latitude')), lng = Number(url.searchParams.get('longitude'));
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return error(400, 'INVALID_COORDINATES', 'Provide valid latitude and longitude.');
        const rad = (n: number) => n * Math.PI / 180;
        let nearest: GeoLocation | undefined, distance = Infinity;
        for (const item of all) {
          const dLat = rad(item.latitude-lat), dLng = rad(item.longitude-lng), lat1 = rad(lat), lat2 = rad(item.latitude);
          const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
          const km = 12742 * Math.asin(Math.sqrt(h));
          if (km < distance) { nearest = item; distance = km; }
        }
        return nearest ? json({ version:'1', location:nearest, distanceKm:Math.round(distance*10)/10 }) : error(503,'LOCATION_DATA_UNAVAILABLE','The city catalogue is temporarily unavailable.');
      }
      const id = [action, extra].filter(Boolean).join('/');
      const location = all.find(item => item.id.toLowerCase() === id.toLowerCase() || locationSlug(item) === id.toLowerCase());
      return location ? json({ version:'1', location, slug:locationSlug(location) }) : error(404,'LOCATION_NOT_FOUND','The requested location was not found.');
    }
    if (['solar','lunar','celestial','events'].includes(resource)) {
      const location = await resolveLocation(env, url.searchParams.get('location'));
      if (!location) return error(400, 'INVALID_LOCATION', 'Use a valid preset location id.');
      const eventDate = url.searchParams.get('date');
      const date = resource === 'events' && eventDate
        ? (Number.isFinite(new Date(eventDate + 'T12:00:00Z').getTime()) ? new Date(eventDate + 'T12:00:00Z') : null)
        : dateFrom(url.searchParams.get('at'));
      if (!date) return error(400, 'INVALID_TIMESTAMP', 'Use a valid ISO date or timestamp.');
      const meta = { id:location.id, name:location.name, country:location.country, timezone:location.timezone };
      if (resource === 'solar') return json({ version:'1', instant:date.toISOString(), location:meta, solar:calculateSolarPosition(date,location.latitude,location.longitude) });
      if (resource === 'lunar') {
        const sun = calculateSolarPosition(date,location.latitude,location.longitude);
        return json({ version:'1', instant:date.toISOString(), location:meta, moon:calculateLunarPosition(date,location.latitude,location.longitude,sun) });
      }
      if (resource === 'celestial') return json({ version:'1', instant:date.toISOString(), location:meta, celestial:getCelestialState(date,location.latitude,location.longitude,location.timezone) });
      return json({ version:'1', date:url.searchParams.get('date') ?? date.toISOString().slice(0,10), location:meta, events:calculateSolarEvents(date,location.latitude,location.longitude,location.timezone) });
    }
    if (!resource) return json({ name:'2piClock API', version:'1', documentation:'https://2piclock.com/api', endpoints:['/api/v1/locations/search?q=casablanca','/api/v1/locations/random?count=50','/api/v1/locations/{id}','/api/v1/weather?location=paris&current=temperature_2m','/api/v1/solar?location=paris','/api/v1/lunar?location=paris','/api/v1/celestial?location=paris','/api/v1/events?location=paris'] });
    return error(404, 'NOT_FOUND', 'API endpoint not found.');
  } catch (cause) {
    console.error('2piClock API error', cause);
    return error(503, 'SERVICE_UNAVAILABLE', 'The requested service is temporarily unavailable.');
  }
};
