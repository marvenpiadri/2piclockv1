import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-weather-coming-soon',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="weather-coming-soon">
      <div class="weather-trailer-orbit" aria-hidden="true">
        <div class="trailer-glow"></div>
        <div class="trailer-orbit-ring"></div>
        <div class="trailer-front">
          <span class="wi wi-day-cloudy"></span>
        </div>
      </div>

      <div class="weather-trailer-copy">
        <span class="eyebrow">2PICLOCK · WEATHER</span>
        <h1>Weather, rebuilt around the world.</h1>
        <p>
          A global weather experience is coming soon — live layers, animated wind,
          forecasts and location-aware atmosphere, all on the same map backbone as 2piClock.
        </p>

        <div class="trailer-points">
          <span><i class="wi wi-strong-wind"></i> Wind fields</span>
          <span><i class="wi wi-cloudy"></i> Weather layers</span>
          <span><i class="wi wi-day-sunny"></i> Local conditions</span>
        </div>

        <div class="trailer-actions">
          <a routerLink="/sky/weather">Preview weather in Sky</a>
          <a routerLink="/world">Explore the World Map</a>
        </div>
      </div>
    </main>
  `,
  styles: [`
    :host { display:block; min-height:calc(100vh - 72px); }
    .weather-coming-soon {
      min-height:calc(100vh - 72px);
      display:grid;
      place-items:center;
      grid-template-columns:minmax(260px, 420px) minmax(320px, 620px);
      gap:clamp(40px, 8vw, 120px);
      padding:clamp(40px, 8vw, 96px);
      background:
        radial-gradient(circle at 30% 45%, rgba(56,189,248,.12), transparent 34%),
        radial-gradient(circle at 70% 50%, rgba(167,139,250,.08), transparent 38%);
      color:#f8fafc;
    }
    .weather-trailer-orbit {
      position:relative;
      width:min(34vw,360px);
      aspect-ratio:1;
      display:grid;
      place-items:center;
    }
    .trailer-glow {
      position:absolute; inset:20%;
      border-radius:50%;
      background:radial-gradient(circle, rgba(56,189,248,.24), transparent 68%);
      filter:blur(14px);
      animation:weatherPulse 5s ease-in-out infinite;
    }
    .trailer-orbit-ring {
      position:absolute; inset:4%;
      border:1px solid rgba(148,163,184,.2);
      border-radius:50%;
      transform:rotate(-18deg) scaleY(.45);
      box-shadow:0 0 80px rgba(56,189,248,.08);
    }
    .trailer-front {
      width:38%; aspect-ratio:1;
      display:grid; place-items:center;
      border:1px solid rgba(255,255,255,.16);
      border-radius:28%;
      background:rgba(10,18,30,.72);
      backdrop-filter:blur(14px);
      box-shadow:0 30px 90px rgba(0,0,0,.28);
    }
    .trailer-front .wi { font-size:clamp(42px,6vw,72px); color:#38bdf8; }
    .weather-trailer-copy { max-width:620px; }
    .eyebrow {
      color:#fbbf24; font:600 11px/1.2 ui-monospace,SFMono-Regular,monospace;
      letter-spacing:.16em;
    }
    h1 {
      margin:14px 0 18px;
      font-size:clamp(42px,6vw,78px);
      line-height:.98;
      letter-spacing:-.045em;
      max-width:720px;
    }
    p { margin:0; max-width:600px; color:#aeb9c8; font-size:17px; line-height:1.7; }
    .trailer-points {
      display:flex; flex-wrap:wrap; gap:10px; margin:28px 0;
    }
    .trailer-points span {
      display:inline-flex; align-items:center; gap:8px;
      padding:9px 11px; border:1px solid rgba(255,255,255,.1);
      border-radius:9px; background:rgba(255,255,255,.035);
      color:#cbd5e1; font-size:12px;
    }
    .trailer-points i { color:#38bdf8; }
    .trailer-actions { display:flex; gap:10px; flex-wrap:wrap; }
    .trailer-actions a {
      padding:10px 13px; border-radius:9px; border:1px solid rgba(255,255,255,.12);
      color:#f8fafc; text-decoration:none; background:rgba(255,255,255,.045);
      font-size:12px;
    }
    .trailer-actions a:first-child { background:rgba(245,158,11,.12); border-color:rgba(245,158,11,.3); }
    @keyframes weatherPulse { 50% { transform:scale(1.08); opacity:.75; } }
    @media (max-width:800px) {
      .weather-coming-soon { grid-template-columns:1fr; text-align:center; gap:30px; }
      .weather-trailer-orbit { width:min(68vw,300px); margin:auto; }
      .weather-trailer-copy { margin:auto; }
      .trailer-points,.trailer-actions { justify-content:center; }
    }
    @media (prefers-reduced-motion:reduce) { .trailer-glow { animation:none; } }
  `]
})
export class WeatherComingSoonComponent {}
