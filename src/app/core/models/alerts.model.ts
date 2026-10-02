export type AlertSeverity = 'critical' | 'warning' | 'watch' | 'advisory' | 'info';

export type AlertCategory = 'weather' | 'astronomy' | 'space_weather' | 'stargazing' | 'eclipse';

export interface AlertItem {
  id: string;
  title: string;
  category: AlertCategory;
  categoryLabel: string;
  severity: AlertSeverity;
  severityLabel: string;
  description: string;
  safetyAdvice: string;
  metricLabel: string;
  metricValue: string;
  issuedAt: Date;
  expiresAt?: Date;
  locationName: string;
  coordinates: string;
  icon: string;
  badgeBg: string;
  badgeColor: string;
  cardBorderColor: string;
  isSimulated?: boolean;
}

export interface AlertFilter {
  category: 'all' | AlertCategory;
  severity: 'all' | AlertSeverity;
  searchQuery: string;
}
