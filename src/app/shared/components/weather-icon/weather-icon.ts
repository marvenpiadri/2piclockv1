import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export type WeatherIconSize = 'sm' | 'md' | 'lg' | 'xl';
export type WeatherIconStyle = 'fill' | 'flat' | 'line' | 'monochrome';

@Component({
  selector: 'app-weather-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      [src]="currentSrc()"
      [alt]="label()"
      [width]="pixelSize[size()]"
      [height]="pixelSize[size()]"
      [style.width.px]="pixelSize[size()]"
      [style.height.px]="pixelSize[size()]"
      (error)="handleImageError()"
      loading="lazy"
      decoding="async"
      class="meteocons-weather-icon pointer-events-none select-none"
    />
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      flex: 0 0 auto;
      vertical-align: middle;
    }
    .meteocons-weather-icon {
      display: block;
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
    }
  `]
})
export class WeatherIconComponent {
  readonly condition = input<string>('clear');
  readonly icon = input<string | undefined>();
  readonly label = input<string>('Weather condition');
  readonly size = input<WeatherIconSize>('md');
  readonly isDay = input<boolean>(true);
  readonly iconStyle = input<WeatherIconStyle>('fill');

  readonly pixelSize: Record<WeatherIconSize, number> = {
    sm: 24,
    md: 40,
    lg: 72,
    xl: 96
  };

  private readonly fallbackAttempt = signal<number>(0);

  readonly resolvedSlug = computed(() => {
    const raw = this.icon() || this.condition();
    return this.resolveMeteoconSlug(raw, this.isDay());
  });

  readonly currentSrc = computed(() => {
    const attempt = this.fallbackAttempt();
    const style = this.iconStyle();
    const slug = this.resolvedSlug();

    if (attempt === 0) {
      // Primary: local bundled asset from @meteocons/svg
      return `/meteocons/${style}/${slug}.svg`;
    }
    if (attempt === 1) {
      // Secondary fallback: jsDelivr CDN
      return `https://cdn.jsdelivr.net/npm/@meteocons/svg@0.1.0/${style}/${slug}.svg`;
    }
    // Final fallback: standard not-available / clear-day
    return `/meteocons/${style}/not-available.svg`;
  });

  handleImageError(): void {
    if (this.fallbackAttempt() < 2) {
      this.fallbackAttempt.update(n => n + 1);
    }
  }

  private resolveMeteoconSlug(value: string | undefined, isDay: boolean): string {
    if (!value) return isDay ? 'clear-day' : 'clear-night';
    const clean = value.toLowerCase().trim().replace(/^wi-/, '').replace(/_/g, '-');

    const directAliases: Record<string, string> = {
      'wb-sunny': 'clear-day',
      'sunny': 'clear-day',
      'clear-day': 'clear-day',
      'clear-night': 'clear-night',
      'dark-mode': 'clear-night',
      'night': 'clear-night',
      'moon': 'clear-night',
      'partly-cloudy-day': 'partly-cloudy-day',
      'partly-cloudy-night': 'partly-cloudy-night',
      'cloud': 'cloudy',
      'cloudy': 'cloudy',
      'cloud-queue': isDay ? 'overcast-day' : 'overcast-night',
      'overcast': isDay ? 'overcast-day' : 'overcast-night',
      'grain': 'drizzle',
      'drizzle': 'drizzle',
      'rainy': 'rain',
      'rain': 'rain',
      'heavy-rain': 'extreme-rain',
      'heavy-downpour': 'extreme-rain',
      'thunderstorm': isDay ? 'thunderstorms-day-rain' : 'thunderstorms-night-rain',
      'severe-thunderstorm': isDay ? 'extreme-thunderstorms-day-rain' : 'extreme-thunderstorms-night-rain',
      'thunderstorms-day-rain': 'thunderstorms-day-rain',
      'thunderstorms-night-rain': 'thunderstorms-night-rain',
      'bolt': isDay ? 'thunderstorms-day' : 'thunderstorms-night',
      'weather-snowy': 'snow',
      'ac-unit': 'snow',
      'snow': 'snow',
      'heavy-snow': 'extreme-snow',
      'blizzard': 'extreme-snow',
      'freezing-rain': 'sleet',
      'sleet': 'sleet',
      'hail': 'hail',
      'foggy': isDay ? 'fog-day' : 'fog-night',
      'fog': isDay ? 'fog-day' : 'fog-night',
      'blur-on': isDay ? 'fog-day' : 'fog-night',
      'mist': 'mist',
      'haze': isDay ? 'haze-day' : 'haze-night',
      'smoke': 'smoke',
      'dust': 'dust',
      'tornado': 'tornado',
      'hurricane': 'hurricane',
      'wind': 'wind',
      'air': 'wind',
      'strong-wind': 'wind',
      'windsock': 'windsock',
      'barometer': 'barometer',
      'speed': 'barometer',
      'pressure': 'barometer',
      'humidity': 'humidity',
      'water-drop': 'humidity',
      'opacity': 'humidity',
      'dew-point': 'humidity',
      'visibility': 'horizon',
      'horizon': 'horizon',
      'uv-index': 'uv-index',
      'uv': 'uv-index',
      'sunrise': 'sunrise',
      'wb-twilight': 'sunrise',
      'sunset': 'sunset',
      'thermometer': 'thermometer',
      'temperature': 'thermometer',
      'celsius': 'celsius',
      'fahrenheit': 'fahrenheit'
    };

    if (directAliases[clean]) return directAliases[clean];

    // Fuzzy matching for complex weather condition strings
    if (clean.includes('severe') && clean.includes('thunder')) {
      return isDay ? 'extreme-thunderstorms-day-rain' : 'extreme-thunderstorms-night-rain';
    }
    if (clean.includes('thunder')) {
      return isDay ? 'thunderstorms-day-rain' : 'thunderstorms-night-rain';
    }
    if (clean.includes('blizzard') || clean.includes('heavy-snow') || clean.includes('heavysnow')) {
      return 'extreme-snow';
    }
    if (clean.includes('snow')) {
      return 'snow';
    }
    if (clean.includes('heavy-rain') || clean.includes('downpour') || clean.includes('squall')) {
      return 'extreme-rain';
    }
    if (clean.includes('drizzle')) {
      return 'drizzle';
    }
    if (clean.includes('rain')) {
      return 'rain';
    }
    if (clean.includes('freezing') || clean.includes('sleet')) {
      return 'sleet';
    }
    if (clean.includes('hail')) {
      return 'hail';
    }
    if (clean.includes('fog')) {
      return isDay ? 'fog-day' : 'fog-night';
    }
    if (clean.includes('mist')) {
      return 'mist';
    }
    if (clean.includes('haze')) {
      return isDay ? 'haze-day' : 'haze-night';
    }
    if (clean.includes('overcast')) {
      return isDay ? 'overcast-day' : 'overcast-night';
    }
    if (clean.includes('partly')) {
      return isDay ? 'partly-cloudy-day' : 'partly-cloudy-night';
    }
    if (clean.includes('cloud')) {
      return 'cloudy';
    }
    if (clean.includes('clear') || clean.includes('sunny')) {
      return isDay ? 'clear-day' : 'clear-night';
    }

    return isDay ? 'clear-day' : 'clear-night';
  }
}

