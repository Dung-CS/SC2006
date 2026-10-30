/**
 * D-Fence — Alert Settings screen (REQUIREMENTS.md 11.2.11).
 * Stereotype: <<boundary>>. Traces: 11.2.11, 6.1.1–6.1.8, 6.2.x, 11.4.2, 10.5.3.
 *
 * Two halves, in the order they must happen: link a Telegram account, then choose what it is told.
 *
 * The linking code is shown with its expiry (6.1.7 gives it fifteen minutes). A code displayed
 * without a deadline is a code someone will come back to tomorrow and blame the system for.
 *
 * The delivery history below is the honest part of §6: 6.2.x records failed and suppressed
 * deliveries as well as sent ones, and showing only the successes would tell a resident their
 * alerts are working when the last three never arrived.
 */
import { useState } from 'react';
import { Bell, MapPin, Send } from 'lucide-react';
import { ApiError } from '../../lib/ApiClient';
import { useLoad } from '../../lib/useLoad';
import { StateView } from '../../components/States';
import { link } from '../../components/Link';
import { ScreenProps } from '../ScreenProps';

interface AlertHistory {
  alerts: Array<{ trigger: string; outcome: string; sentAt: string; attempts: number; message: string }>;
}

interface LinkCode {
  code: string;
  expiresAt: string;
  next: string;
}

export function AlertSettingsScreen(props: ScreenProps): JSX.Element {
  const { state, value, retry } = useLoad<AlertHistory>(props.api, '/api/alerts', {
    isEmpty: (v) => v.alerts.length === 0,
    emptyMessage: 'No alerts have been sent yet. Link Telegram and add a saved location to start receiving them.',
  });
  const [code, setCode] = useState<LinkCode | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function requestCode(): Promise<void> {
    setBusy(true);
    setFailure(null);
    try {
      setCode(await props.api.post<LinkCode>('/api/alerts/link', {}));
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setFailure(`${f?.error ?? 'a code could not be issued'} — ${f?.remedy ?? 'try again shortly'}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-screen="AlertSettings" data-requirement="11.2.11">
      <h1 className="flex items-center gap-3">
        <Bell aria-hidden="true" className="size-7 shrink-0 text-accent" />
        Alerts
      </h1>

      <section data-part="telegram" className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mt-0">Telegram</h2>
        <p>
          D-Fence sends alerts through Telegram. Request a code, then send it to the D-Fence bot to
          link your account.
        </p>
        <button type="button" data-variant="primary" onClick={() => void requestCode()} disabled={busy} className="inline-flex items-center gap-2">
          <Send aria-hidden="true" className="size-4" />
          {busy ? 'Requesting…' : 'Request a linking code'}
        </button>
        {code === null ? null : (
          <div role="status" data-part="code" className="mt-4 rounded-2xl bg-accent-quiet p-4">
            <p data-part="digits" className="text-3xl font-bold tracking-widest text-accent-dark">{code.code}</p>
            <p>{code.next}</p>
            {/* 6.1.7 — fifteen minutes. Stated, so the code is not treated as permanent. */}
            <p data-part="expires">
              This code expires at {new Date(code.expiresAt).toISOString().slice(11, 16)} UTC.
            </p>
          </div>
        )}
        {failure === null ? null : (
          <p role="alert" data-part="error" className="mt-4 text-tier-high">
            {failure}
          </p>
        )}
      </section>

      <section data-part="locations" className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mt-0">What you are alerted about</h2>
        {/* The per-location switches live on the location itself, because that is what they belong
            to — a threshold with no location to apply it to is a setting about nothing. */}
        <p>
          Alerts are set per saved location. Open a location to choose its triggers and its growth
          threshold.
        </p>
        <a href="/locations" onClick={link(props, '/locations')} className="inline-flex min-h-11 items-center gap-2 font-semibold">
          <MapPin aria-hidden="true" className="size-4" />
          My locations
        </a>
      </section>

      <section data-part="history" className="rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <h2 className="mt-0">Recent alerts</h2>
        <StateView state={state} onRetry={retry}>
          <ul className="m-0 list-none p-0">
            {(value?.alerts ?? []).map((alert, index) => (
              <li key={`${alert.sentAt}-${index}`} data-outcome={alert.outcome} className="border-b border-line py-3 last:border-b-0">
                <p data-part="message">{alert.message}</p>
                <p data-part="meta" className="text-sm text-ink-quiet">
                  {alert.trigger} — {alert.outcome}
                  {alert.attempts > 1 ? ` after ${alert.attempts} attempts` : ''} —{' '}
                  {new Date(alert.sentAt).toISOString().slice(0, 16).replace('T', ' ')}
                </p>
              </li>
            ))}
          </ul>
        </StateView>
      </section>
    </section>
  );
}
