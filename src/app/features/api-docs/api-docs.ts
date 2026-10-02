import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-api-docs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="api-page">
      <header class="hero">
        <p class="eyebrow">2PICLOCK DEVELOPER PLATFORM</p>
        <h1>2piClock API</h1>
        <p class="lede">Build with live astronomical calculations from the same engine that powers 2piClock. Query the Sun, Moon, celestial state, solar events and the global location catalogue.</p>
        <div class="hero-actions">
          <a href="/api/v1" target="_blank" rel="noopener">Open API root</a>
          <a href="/api/v1/locations" target="_blank" rel="noopener">Browse locations</a>
        </div>
      </header>

      <section class="section">
        <div class="section-head"><span>01</span><h2>Quick start</h2></div>
        <p>All endpoints are read-only JSON GET endpoints. Use a preset location id and an optional ISO-8601 instant.</p>
        <pre><code>GET https://2piclock.com/api/v1/solar?location=paris&amp;at=2026-09-26T12:00:00Z</code></pre>
        <p class="muted">If <code>at</code> is omitted, the API evaluates the current instant. Results are cached briefly at the edge.</p>
      </section>

      <section class="section grid">
        <article><span class="method">GET</span><h3>/api/v1/locations</h3><p>Returns the public preset location catalogue with coordinates and IANA time zones.</p></article>
        <article><span class="method">GET</span><h3>/api/v1/solar</h3><p>Solar altitude, azimuth, distance, right ascension and declination for a location and instant.</p></article>
        <article><span class="method">GET</span><h3>/api/v1/lunar</h3><p>Moon altitude, azimuth, phase, illumination, distance and equatorial coordinates.</p></article>
        <article><span class="method">GET</span><h3>/api/v1/celestial</h3><p>Combined sky state including Sun, Moon, twilight classification and solar events.</p></article>
        <article><span class="method">GET</span><h3>/api/v1/events</h3><p>Sunrise, sunset and other daily solar-event data for a selected location and civil date.</p></article>
      </section>

      <section class="section">
        <div class="section-head"><span>02</span><h2>Parameters</h2></div>
        <table><thead><tr><th>Parameter</th><th>Required</th><th>Description</th></tr></thead>
        <tbody>
          <tr><td><code>location</code></td><td>Yes</td><td>Preset location id, for example <code>paris</code>.</td></tr>
          <tr><td><code>at</code></td><td>No</td><td>ISO-8601 timestamp, for example <code>2026-09-26T12:00:00Z</code>.</td></tr>
          <tr><td><code>date</code></td><td>Events only</td><td>ISO civil date, for example <code>2026-09-26</code>.</td></tr>
        </tbody></table>
      </section>

      <section class="section">
        <div class="section-head"><span>03</span><h2>Example</h2></div>
        <pre><code>curl "https://2piclock.com/api/v1/lunar?location=casablanca&amp;at=2026-09-26T21:00:00Z"</code></pre>
        <p>Use the returned astronomical values in dashboards, observatories, education projects, travel tools, weather interfaces and other applications. Please cache responses responsibly and identify your application when contacting us.</p>
      </section>

      <section class="section note">
        <h2>Built for the open web</h2>
        <p>The API is versioned and read-only. More astronomical endpoints can be added without breaking the v1 contract.</p>
      </section>
    </main>
  `,
  styles: [`
    :host { display:block; min-height:100vh; background:linear-gradient(180deg,#f7f4ec 0%,#eef1ef 48%,#e8ecea 100%); color:#17202a; }
    .api-page { width:min(1120px,calc(100% - 32px)); margin:auto; padding:72px 0 100px; font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .hero { max-width:780px; padding:42px 0 58px; }
    .eyebrow,.method { color:#b56b00; font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.14em; }
    h1 { margin:12px 0 18px; font-size:clamp(44px,8vw,78px); letter-spacing:-.055em; line-height:.95; }
    .lede { max-width:720px; font-size:19px; line-height:1.6; color:#52606d; }
    .hero-actions { display:flex; gap:10px; flex-wrap:wrap; margin-top:26px; }
    a { color:#17202a; text-decoration:none; border:1px solid rgba(23,32,42,.15); border-radius:999px; padding:10px 15px; font-weight:650; background:rgba(255,255,255,.52); }
    a:hover { border-color:#b56b00; }
    .section { padding:42px 0; border-top:1px solid rgba(23,32,42,.1); }
    .section-head { display:flex; align-items:baseline; gap:14px; margin-bottom:18px; }
    .section-head span { color:#b56b00; font:700 10px ui-monospace,monospace; }
    h2 { margin:0; font-size:28px; letter-spacing:-.035em; }
    h3 { margin:10px 0 8px; font-size:19px; }
    p { line-height:1.65; color:#52606d; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    article { padding:22px; border:1px solid rgba(23,32,42,.1); border-radius:18px; background:rgba(255,255,255,.48); }
    pre { overflow:auto; padding:18px; border-radius:14px; background:#17202a; color:#e8edf1; font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace; }
    code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:.92em; }
    table { width:100%; border-collapse:collapse; background:rgba(255,255,255,.38); border-radius:16px; overflow:hidden; }
    th,td { padding:14px 16px; text-align:left; border-bottom:1px solid rgba(23,32,42,.08); vertical-align:top; }
    th { font-size:12px; text-transform:uppercase; letter-spacing:.08em; }
    .muted { font-size:13px; }
    .note { border:1px solid rgba(181,107,0,.2); border-radius:20px; padding:28px; margin-top:18px; background:rgba(245,158,11,.07); }
    @media(max-width:700px){ .api-page{padding-top:36px}.grid{grid-template-columns:1fr}.lede{font-size:16px} th,td{padding:11px 9px;font-size:13px} }
  `]
})
export class ApiDocsComponent {}
