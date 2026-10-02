import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AlertsService } from '../../core/services/alerts.service';
import { LocationService } from '../../core/services/location.service';
import { CountryFlagComponent } from '../../shared/components/country-flag/country-flag';
import { AlertCategory, AlertItem, AlertSeverity } from '../../core/models/alerts.model';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, CountryFlagComponent],
  templateUrl: './alerts.html',
  styleUrl: './alerts.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AlertsComponent {
  readonly alertsService = inject(AlertsService);
  readonly locationService = inject(LocationService);

  readonly liveAlerts = this.alertsService.liveAlerts;
  readonly selectedLocation = this.locationService.selectedLocation;
  readonly criticalCount = this.alertsService.criticalCount;
  readonly totalCount = this.alertsService.totalAlertsCount;
  readonly currentWeather = this.alertsService.currentWeather;
  readonly audioEnabled = this.alertsService.audioEnabled;

  // Filter & Search Signals
  readonly activeCategory = signal<'all' | AlertCategory>('all');
  readonly activeSeverity = signal<'all' | AlertSeverity>('all');
  readonly searchQuery = signal<string>('');
  readonly copiedAlertId = signal<string | null>(null);

  // Simulation Modal Toggle
  readonly showSimModal = signal<boolean>(false);

  readonly filteredAlerts = computed<AlertItem[]>(() => {
    const list = this.liveAlerts();
    const cat = this.activeCategory();
    const sev = this.activeSeverity();
    const q = this.searchQuery().toLowerCase().trim();

    return list.filter(item => {
      // Category filter
      if (cat !== 'all' && item.category !== cat) {
        return false;
      }
      // Severity filter
      if (sev !== 'all' && item.severity !== sev) {
        return false;
      }
      // Search query filter
      if (q) {
        const text = `${item.title} ${item.description} ${item.locationName} ${item.metricValue} ${item.categoryLabel}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  });

  setCategory(cat: 'all' | AlertCategory): void {
    this.activeCategory.set(cat);
  }

  setSeverity(sev: 'all' | AlertSeverity): void {
    this.activeSeverity.set(sev);
  }

  toggleAudio(): void {
    this.alertsService.toggleAudio();
    if (this.audioEnabled()) {
      this.alertsService.playAlertChime();
    }
  }

  toggleSimModal(): void {
    this.showSimModal.update(v => !v);
  }

  copyAlertSummary(item: AlertItem): void {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return;
    const summary = `🚨 [${item.severityLabel.toUpperCase()}] ${item.title}\n📍 Location: ${item.locationName} (${item.coordinates})\n📊 Metric: ${item.metricValue}\n📝 Description: ${item.description}\n🛡️ Safety Advice: ${item.safetyAdvice}\n⏰ Issued: ${new Date(item.issuedAt).toLocaleString()} via 2PiClock Real-Time Alerts Module`;
    navigator.clipboard.writeText(summary).then(() => {
      this.copiedAlertId.set(item.id);
      setTimeout(() => this.copiedAlertId.set(null), 2500);
    });
  }

  // Preset Test Simulations
  triggerG5GeomagneticStorm(): void {
    const loc = this.selectedLocation();
    this.alertsService.setSimulatedAlert({
      id: `sim-g5-${Date.now()}`,
      title: 'G5 Extreme Geomagnetic Superstorm & Aurora Major Alert',
      category: 'space_weather',
      categoryLabel: 'Space Weather',
      severity: 'critical',
      severityLabel: 'Critical Warning',
      description: `Extreme solar flare & C9.8 CME eruption impacting Earth magnetosphere. Auroral displays visible as far south as equator/mid-latitudes over ${loc.name}.`,
      safetyAdvice: 'Widespread voltage control and grid scintillation possible. High-altitude satellites and long-range HF radio communication experiencing blackouts.',
      metricLabel: 'Planetary Kp Index',
      metricValue: 'Kp 9.0 (G5 Extreme Superstorm)',
      issuedAt: new Date(),
      locationName: `${loc.name}, ${loc.country}`,
      coordinates: `${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°`,
      icon: 'flare',
      badgeBg: 'rgba(236, 72, 153, 0.3)',
      badgeColor: '#f472b6',
      cardBorderColor: 'rgba(236, 72, 153, 0.65)',
      isSimulated: true
    });
    this.showSimModal.set(false);
    if (this.audioEnabled()) this.alertsService.playAlertChime();
  }

  triggerSuperTyphoonGale(): void {
    const loc = this.selectedLocation();
    this.alertsService.setSimulatedAlert({
      id: `sim-typhoon-${Date.now()}`,
      title: 'Category 4 Super Typhoon & Coastal Surge Warning',
      category: 'weather',
      categoryLabel: 'Severe Weather',
      severity: 'critical',
      severityLabel: 'Critical Warning',
      description: `Destructive eyewall gale winds approaching ${loc.name} with sustained velocity of 120 km/h and peak gusts reaching 165 km/h.`,
      safetyAdvice: 'Evacuate coastal surge zones immediately. Board windows and secure emergency supplies.',
      metricLabel: 'Sustained Winds & Pressure',
      metricValue: '120 km/h (Gusts: 165 km/h) · 932 hPa',
      issuedAt: new Date(),
      locationName: `${loc.name}, ${loc.country}`,
      coordinates: `${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°`,
      icon: 'thunderstorm',
      badgeBg: 'rgba(239, 68, 68, 0.3)',
      badgeColor: '#f87171',
      cardBorderColor: 'rgba(239, 68, 68, 0.65)',
      isSimulated: true
    });
    this.showSimModal.set(false);
    if (this.audioEnabled()) this.alertsService.playAlertChime();
  }

  triggerTotalSolarEclipse(): void {
    const loc = this.selectedLocation();
    this.alertsService.setSimulatedAlert({
      id: `sim-eclipse-${Date.now()}`,
      title: 'Total Solar Eclipse - Path of Totality Warning',
      category: 'eclipse',
      categoryLabel: 'Astronomical Event',
      severity: 'warning',
      severityLabel: 'Warning',
      description: `The Moon umbrella path is passing directly across ${loc.name}. Complete daylight darkness for 3m 42s of Totality!`,
      safetyAdvice: 'Solar viewers are strictly required during partial phases. Solar corona is visible during Totality.',
      metricLabel: 'Obscuration Rate',
      metricValue: '100% Totality (Umbra Path)',
      issuedAt: new Date(),
      locationName: `${loc.name}, ${loc.country}`,
      coordinates: `${loc.latitude.toFixed(2)}°, ${loc.longitude.toFixed(2)}°`,
      icon: 'wb_twilight',
      badgeBg: 'rgba(245, 158, 11, 0.3)',
      badgeColor: '#fbbf24',
      cardBorderColor: 'rgba(245, 158, 11, 0.6)',
      isSimulated: true
    });
    this.showSimModal.set(false);
    if (this.audioEnabled()) this.alertsService.playAlertChime();
  }

  clearSimulation(): void {
    this.alertsService.clearSimulatedAlert();
    this.showSimModal.set(false);
  }
}
