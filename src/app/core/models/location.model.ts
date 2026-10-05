export interface GeoLocation {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  flag: string;
  latitude: number;
  longitude: number;
  timezone: string;
  elevationMeters?: number;
  isCustom?: boolean;
  tier?: number; // 1 = major world hub (always visible), 2 = capital/continental hub, 3 = regional clock
}

export const DEFAULT_LOCATIONS: GeoLocation[] = [
  { id: 'gb-london', name: 'London', country: 'United Kingdom', countryCode: 'GB', flag: '🇬🇧', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', tier: 1 },
  { id: 'us-new-york', name: 'New York', country: 'United States', countryCode: 'US', flag: '🇺🇸', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York', tier: 1 },
  { id: 'jp-tokyo', name: 'Tokyo', country: 'Japan', countryCode: 'JP', flag: '🇯🇵', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo', tier: 1 },
  { id: 'fr-paris', name: 'Paris', country: 'France', countryCode: 'FR', flag: '🇫🇷', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris', tier: 1 },
  { id: 'au-sydney', name: 'Sydney', country: 'Australia', countryCode: 'AU', flag: '🇦🇺', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney', tier: 1 },
  { id: 'eg-cairo', name: 'Cairo', country: 'Egypt', countryCode: 'EG', flag: '🇪🇬', latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo', tier: 1 },
  { id: 'ae-dubai', name: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', flag: '🇦🇪', latitude: 25.2048, longitude: 55.2708, timezone: 'Asia/Dubai', tier: 1 },
  { id: 'us-los-angeles', name: 'Los Angeles', country: 'United States', countryCode: 'US', flag: '🇺🇸', latitude: 34.0522, longitude: -118.2437, timezone: 'America/Los_Angeles', tier: 1 },
  { id: 'sg-singapore', name: 'Singapore', country: 'Singapore', countryCode: 'SG', flag: '🇸🇬', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore', tier: 1 },
  { id: 'br-sao-paulo', name: 'São Paulo', country: 'Brazil', countryCode: 'BR', flag: '🇧🇷', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo', tier: 1 },
  { id: 'de-berlin', name: 'Berlin', country: 'Germany', countryCode: 'DE', flag: '🇩🇪', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin', tier: 1 },
  { id: 'ca-toronto', name: 'Toronto', country: 'Canada', countryCode: 'CA', flag: '🇨🇦', latitude: 43.6532, longitude: -79.3832, timezone: 'America/Toronto', tier: 1 },
  { id: 'in-mumbai', name: 'Mumbai', country: 'India', countryCode: 'IN', flag: '🇮🇳', latitude: 19.076, longitude: 72.8777, timezone: 'Asia/Kolkata', tier: 1 },
  { id: 'hk-hong-kong', name: 'Hong Kong', country: 'Hong Kong', countryCode: 'HK', flag: '🇭🇰', latitude: 22.3193, longitude: 114.1694, timezone: 'Asia/Hong_Kong', tier: 1 },
  { id: 'us-honolulu', name: 'Honolulu', country: 'United States', countryCode: 'US', flag: '🇺🇸', latitude: 21.3069, longitude: -157.8583, timezone: 'Pacific/Honolulu', tier: 2 },
  { id: 'nz-auckland', name: 'Auckland', country: 'New Zealand', countryCode: 'NZ', flag: '🇳🇿', latitude: -36.8485, longitude: 174.7633, timezone: 'Pacific/Auckland', tier: 1 },
  { id: 'ma-casablanca', name: 'Casablanca', country: 'Morocco', countryCode: 'MA', flag: '🇲🇦', latitude: 33.5731, longitude: -7.5898, timezone: 'Africa/Casablanca', tier: 2 },
  { id: 'ar-buenos-aires', name: 'Buenos Aires', country: 'Argentina', countryCode: 'AR', flag: '🇦🇷', latitude: -34.6037, longitude: -58.3816, timezone: 'America/Argentina/Buenos_Aires', tier: 1 },
  { id: 'is-reykjavik', name: 'Reykjavik', country: 'Iceland', countryCode: 'IS', flag: '🇮🇸', latitude: 64.1466, longitude: -21.9426, timezone: 'Atlantic/Reykjavik', tier: 2 },
  { id: 'za-johannesburg', name: 'Johannesburg', country: 'South Africa', countryCode: 'ZA', flag: '🇿🇦', latitude: -26.2041, longitude: 28.0473, timezone: 'Africa/Johannesburg', tier: 1 }
];
