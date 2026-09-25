import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WeatherService } from '../../core/services/weather.service';
import { CelestialService } from '../../core/services/celestial.service';
import { WeatherCondition } from '../../core/models/weather.model';
import { WeatherAggressivenessVisualizerComponent, CountryFlagComponent, WeatherIconComponent } from '../../shared/components';

@Component({
  selector: 'app-weather-atmosphere',
  standalone: true,
  imports: [
    CommonModule, 
    MatIconModule, 
    WeatherAggressivenessVisualizerComponent,
    CountryFlagComponent,
    WeatherIconComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './weather-atmosphere.html',
  styleUrl: './weather-atmosphere.css'
})
export class WeatherAtmosphereComponent {
  private weatherService = inject(WeatherService);
  private celestialService = inject(CelestialService);

  readonly weather = this.weatherService.currentWeather;
  readonly overrideConfig = this.weatherService.overrideConfig;
  readonly isLoading = this.weatherService.isLoading;
  readonly selectedLocation = this.celestialService.selectedLocation;

  constructor() {
    // Weather is this page's primary data source; fetch only while mounted.
    this.weatherService.fetchWeatherForLocation(this.selectedLocation());
  }

  readonly conditions: { id: WeatherCondition; label: string; icon: string; desc: string }[] = [
    { id: 'clear', label: 'Crystal Clear', icon: 'wb_sunny', desc: 'Maximum visibility & starlight penetration' },
    { id: 'partly_cloudy', label: 'Partly Cloudy', icon: 'partly_cloudy_day', desc: 'Scattered cumulus clouds & parallax drift' },
    { id: 'cloudy', label: 'Cloudy', icon: 'cloud', desc: 'Dense cloud layering across upper troposphere' },
    { id: 'overcast', label: 'Overcast', icon: 'cloud_queue', desc: 'Complete cloud ceiling & diffused solar corona' },
    { id: 'rain', label: 'Light Rain', icon: 'grain', desc: 'Steady rain particles & atmospheric darkening' },
    { id: 'heavy_rain', label: 'Heavy Downpour', icon: 'thunderstorm', desc: 'Dense rain streaks & deep troposphere occlusion' },
    { id: 'thunderstorm', label: 'Thunderstorm', icon: 'bolt', desc: 'Dynamic sheet lightning & flash illumination' },
    { id: 'snow', label: 'Snowfall', icon: 'ac_unit', desc: 'Gentle drifting snowflake particles' },
    { id: 'fog', label: 'Atmospheric Fog', icon: 'blur_on', desc: 'Dense horizon mist & muted visibility' }
  ];

  setCondition(condition: WeatherCondition): void {
    this.weatherService.setOverride({ condition });
  }

  setCloudCover(event: Event): void {
    const target = event.target as HTMLInputElement;
    const cloudCoverPct = parseInt(target.value, 10);
    this.weatherService.setOverride({ cloudCoverPct });
  }

  setPrecipitation(event: Event): void {
    const target = event.target as HTMLInputElement;
    const precipitationPct = parseInt(target.value, 10);
    this.weatherService.setOverride({ precipitationPct });
  }

  setWindSpeed(event: Event): void {
    const target = event.target as HTMLInputElement;
    const windSpeedKmh = parseInt(target.value, 10);
    this.weatherService.setOverride({ windSpeedKmh });
  }

  resetToLiveWeather(): void {
    this.weatherService.clearOverride();
    this.weatherService.fetchWeatherForLocation(this.selectedLocation());
  }
}

