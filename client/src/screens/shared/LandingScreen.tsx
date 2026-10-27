/**
 * D-Fence — Landing screen (REQUIREMENTS.md 11.2.1).
 * Stereotype: <<boundary>>. Traces: 11.2.1, 11.1.9, 10.4.5, 10.4.6.
 *
 * The only screen that must render usefully for someone with no account, no session and no data.
 *
 * It carries the source attribution because 10.4.5 requires it to be reachable **without signing
 * in** — the data comes from NEA, the Meteorological Service and OneMap under terms that oblige
 * public credit, and crediting them only behind a login credits them to nobody. `/api/attribution`
 * is the one unauthenticated endpoint for exactly this reason.
 */
import { useLoad } from '../../lib/useLoad';
import { StateView } from '../../components/States';
import { link } from '../../components/Link';
import { homeFor } from '../../app/RouteGuard';
import { ScreenProps } from '../ScreenProps';

/**
 * The server's shape, matched exactly. An earlier version of this file invented `sources` with a
 * `name` and a `publisher`; the endpoint returns `attributions` with `source` and `text`, so the
 * credits list rendered empty — a 10.4.5 obligation silently unmet on the one screen that carries
 * it. Found by the UAT harness, which is the only thing that talks to the real endpoint.
 */
interface Attribution {
  attributions?: Array<{ source: string; text: string; licence: string; url: string }>;
  sources?: Array<{ name: string; publisher: string; licence: string; url: string }>;
}

export function LandingScreen(props: ScreenProps): JSX.Element {
  const { state, value, retry } = useLoad<Attribution>(props.api, '/api/attribution');
  const attributionList =
    value?.attributions ??
    value?.sources?.map((s) => ({
      source: s.name,
      text: `${s.name} (${s.publisher})`,
      licence: s.licence,
      url: s.url,
    })) ??
    [];

  return (
    <section data-screen="Landing" data-requirement="11.2.1">
      <div data-part="hero">
        <div data-part="hero-content">
          <h1>D-Fence</h1>
          <p className="hero-lead">
            Dengue cluster monitoring for Singapore. See which areas are active around you, report a
            breeding site, and get told when a cluster appears at a place you care about.
          </p>

          <nav aria-label="Get started" className="hero-actions">
            {props.principal === null ? (
              <>
                <a href="/signin" onClick={link(props, '/signin')} className="button-primary">
                  Sign in
                </a>
                <a href="/register" onClick={link(props, '/register')} className="button-quiet">
                  Create an account
                </a>
              </>
            ) : (
              // Someone already signed in has no business being sent back to a sign-in button; send
              // them where their role starts.
              <a href={homeFor(props.principal.role)} onClick={link(props, homeFor(props.principal.role))} className="button-primary">
                Continue
              </a>
            )}
          </nav>
        </div>

        <div data-part="hero-media">
          <img
            src="/visuals/hero/dfence-hero.jpg"
            alt="D-Fence Singapore residential estate protection overview"
            className="hero-image"
            width="640"
            height="360"
            loading="eager"
          />
        </div>
      </div>

      <div data-part="pillars" aria-label="Key features">
        <div data-component="feature-card">
          <img
            src="/visuals/icons/location-2838912.png"
            alt=""
            aria-hidden="true"
            className="feature-icon"
            width="36"
            height="36"
          />
          <h3>Active Cluster Tracking</h3>
          <p>Official cluster polygons evaluated against your saved locations within an inclusive 150 m boundary.</p>
        </div>
        <div data-component="feature-card">
          <img
            src="/visuals/icons/report-2912773.png"
            alt=""
            aria-hidden="true"
            className="feature-icon"
            width="36"
            height="36"
          />
          <h3>Community Breeding Reports</h3>
          <p>Geotagged site reporting with duplicate prevention and photo verification before priority changes.</p>
        </div>
        <div data-component="feature-card">
          <img
            src="/visuals/icons/notification-2645897.png"
            alt=""
            aria-hidden="true"
            className="feature-icon"
            width="36"
            height="36"
          />
          <h3>Geofenced Resident Alerts</h3>
          <p>Automated Telegram notifications when clusters emerge or expand around your home or workplace.</p>
        </div>
      </div>

      {/* 10.4.5 — public credit, on the public screen. */}
      <section data-part="attribution">
        <h2>Data sources</h2>
        <StateView state={state} onRetry={retry}>
          <ul>
            {attributionList.map((attribution) => (
              <li key={attribution.source}>
                {/* The publisher's own wording, not a paraphrase — the licence obliges the text. */}
                <a href={attribution.url}>{attribution.text}</a>
                {attribution.licence === '' ? '' : ` — ${attribution.licence}`}
              </li>
            ))}
          </ul>
        </StateView>
      </section>
    </section>
  );
}
