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
