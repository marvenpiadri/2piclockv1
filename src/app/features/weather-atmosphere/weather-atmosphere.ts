import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { WeatherService } from '../../core/services/weather.service';
import { CelestialService } from '../../core/services/celestial.service';
import { WeatherCondition } from '../../core/models/weather.model';
import { WeatherAggressivenessVisualizerComponent, CountryFlagComponent, WeatherIconComponent } from '../../shared/components';

export type AtmosphereCategoryType = 'all' | 'clear' | 'clouds' | 'rain' | 'snow' | 'atmosphere' | 'seasonal' | 'special';

export interface ConditionPresetItem {
  id: WeatherCondition;
  category: AtmosphereCategoryType;
  label: string;
  icon: string;
  desc: string;
}

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
  readonly atmosphericState = this.celestialService.atmosphericState;

  readonly activeCategory = signal<AtmosphereCategoryType>('all');

  readonly categories: { id: AtmosphereCategoryType; label: string; icon: string }[] = [
    { id: 'all', label: 'All Presets', icon: 'apps' },
    { id: 'clear', label: 'Clear', icon: 'wb_sunny' },
    { id: 'clouds', label: 'Clouds', icon: 'cloud' },
    { id: 'rain', label: 'Rain', icon: 'grain' },
    { id: 'snow', label: 'Snow & Ice', icon: 'ac_unit' },
    { id: 'atmosphere', label: 'Moisture & Haze', icon: 'blur_on' },
    { id: 'seasonal', label: 'Seasonal', icon: 'nature' },
    { id: 'special', label: 'Special', icon: 'auto_awesome' }
  ];

  readonly allConditions: ConditionPresetItem[] = [
    // Clear
    { id: 'clear', category: 'clear', label: 'Crystal Clear', icon: 'wb_sunny', desc: 'Maximum visibility, deep gradient, brilliant stars' },
    { id: 'clear_dry', category: 'clear', label: 'Clear & Dry', icon: 'wb_sunny', desc: 'Low humidity, razor-sharp celestial bodies, zero haze' },
    // Clouds
    { id: 'partly_cloudy', category: 'clouds', label: 'Partly Cloudy', icon: 'partly_cloudy_day', desc: 'Scattered cumulus clouds & parallax drift' },
    { id: 'broken_clouds', category: 'clouds', label: 'Broken Clouds', icon: 'cloud', desc: 'Separated cloud banks with clear sky gaps' },
    { id: 'cloudy', category: 'clouds', label: 'Cloudy', icon: 'cloud', desc: 'Dense cloud layering across upper troposphere' },
    { id: 'overcast', category: 'clouds', label: 'Overcast', icon: 'cloud_queue', desc: 'Complete cloud ceiling & diffused solar corona' },
    { id: 'low_clouds', category: 'clouds', label: 'Low Clouds', icon: 'cloud_queue', desc: 'Clouds concentrated near horizon with depth' },
    // Rain
    { id: 'drizzle', category: 'rain', label: 'Drizzle', icon: 'grain', desc: 'Fine micro-droplet precipitation & soft darkening' },
    { id: 'rain', category: 'rain', label: 'Light Rain', icon: 'grain', desc: 'Steady rain particles & atmospheric darkening' },
    { id: 'heavy_rain', category: 'rain', label: 'Heavy Rain', icon: 'thunderstorm', desc: 'Dense rain streaks & tropospheric occlusion' },
    { id: 'heavy_downpour', category: 'rain', label: 'Heavy Downpour', icon: 'thunderstorm', desc: 'Extreme rainfall rate & reduced horizon range' },
    { id: 'thunderstorm', category: 'rain', label: 'Thunderstorm', icon: 'bolt', desc: 'Dynamic sheet lightning & branching fork bolts' },
    { id: 'severe_storm', category: 'rain', label: 'Severe Storm', icon: 'bolt', desc: 'Dark turbulent cloud ceiling & torrential rain' },
    // Snow & Ice
    { id: 'snow_flurries', category: 'snow', label: 'Snow Flurries', icon: 'ac_unit', desc: 'Sparse drifting snowflakes in crisp cold air' },
    { id: 'snow', category: 'snow', label: 'Light Snow', icon: 'ac_unit', desc: 'Continuous gentle snowflake drift' },
    { id: 'heavy_snow', category: 'snow', label: 'Heavy Snowfall', icon: 'ac_unit', desc: 'Dense large snow particles & muted horizon' },
    { id: 'blizzard', category: 'snow', label: 'Winter Blizzard', icon: 'ac_unit', desc: 'Wind-driven horizontal snow & near-whiteout' },
    { id: 'sleet', category: 'snow', label: 'Sleet / Ice Rain', icon: 'grain', desc: 'Fast mixed frozen precipitation' },
    { id: 'winter_clear', category: 'snow', label: 'Winter Clear', icon: 'ac_unit', desc: 'Sub-zero crisp atmosphere & pale daylight' },
    { id: 'winter_overcast', category: 'snow', label: 'Winter Overcast', icon: 'cloud_queue', desc: 'Steel blue-grey tone & heavy flat ceiling' },
    // Moisture & Visibility
    { id: 'haze', category: 'atmosphere', label: 'Hazy', icon: 'blur_on', desc: 'Softened horizon & atmospheric scattering' },
    { id: 'dust_haze', category: 'atmosphere', label: 'Dust / Sand Haze', icon: 'blur_on', desc: 'Particulate air & warm amber horizon scattering' },
    { id: 'fog', category: 'atmosphere', label: 'Atmospheric Fog', icon: 'blur_on', desc: 'Dense horizon mist & heavily reduced visibility' },
    { id: 'freezing_fog', category: 'atmosphere', label: 'Freezing Fog', icon: 'blur_on', desc: 'Cold dense fog & sparkling ice crystals' },
    { id: 'heat_haze', category: 'atmosphere', label: 'Heat Haze', icon: 'wb_sunny', desc: 'Shimmering horizon & convective wave distortion' },
    // Seasonal
    { id: 'spring_mist', category: 'seasonal', label: 'Spring Mist', icon: 'blur_on', desc: 'Gentle pastel-tinted dawn & soft humidity' },
    { id: 'summer_heat_haze', category: 'seasonal', label: 'Summer Heat Haze', icon: 'wb_sunny', desc: 'Golden solar irradiance & warm horizon haze' },
    { id: 'autumn_haze', category: 'seasonal', label: 'Autumn Haze', icon: 'blur_on', desc: 'Low-angle warm bronze sunlight & crisp air' },
    // Special
    { id: 'monsoon', category: 'special', label: 'Monsoon', icon: 'thunderstorm', desc: 'Towering cumulonimbus & torrential rain bursts' },
    { id: 'tropical_storm', category: 'special', label: 'Tropical Storm', icon: 'thunderstorm', desc: 'Gale wind shear & deep humid cloud bands' },
    { id: 'aurora', category: 'special', label: 'Aurora Borealis', icon: 'auto_awesome', desc: 'Undulating geomagnetic emerald & violet curtains' },
    { id: 'solar_eclipse', category: 'special', label: 'Solar Eclipse', icon: 'wb_sunny', desc: 'Moon umbra covers sun, revealing corona' },
    { id: 'lunar_eclipse', category: 'special', label: 'Lunar Eclipse', icon: 'dark_mode', desc: 'Earth umbra renders deep crimson blood moon' }
  ];

  readonly filteredConditions = computed(() => {
    const cat = this.activeCategory();
    if (cat === 'all') return this.allConditions;
    return this.allConditions.filter(c => c.category === cat);
  });

  constructor() {
    this.weatherService.fetchWeatherForLocation(this.selectedLocation());
  }

  setCategory(category: AtmosphereCategoryType): void {
    this.activeCategory.set(category);
  }

  setCondition(condition: WeatherCondition): void {
    const cloud = this.weatherService.getConditionDefaultCloud(condition);
    const precip = this.weatherService.getConditionDefaultPrecip(condition);
    this.weatherService.setOverride({
      condition,
      cloudCoverPct: cloud,
      precipitationPct: precip
    });
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
