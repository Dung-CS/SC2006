/**
 * D-Fence — Rejected Reports (REQUIREMENTS.md 11.2.14 family).
 * Stereotype: <<boundary>>. Newest first, as the server returns them; the screen does not re-sort.
 */
import { useLoad } from '../../lib/useLoad';
import { StateView } from '../../components/States';
import { link } from '../../components/Link';
import { label } from '../../lib/labels';
import { ScreenProps } from '../ScreenProps';

interface RejectedPayload {
  rejected: Array<{
    reportId: string;
    pestType: string;
    localityBinding: string;
    reason: string;
    rejectedBy: string | null;
    rejectedAt: string | null;
  }>;
}

export function RejectedReportsScreen(props: ScreenProps): JSX.Element {
  const { state, value, retry } = useLoad<RejectedPayload>(props.api, '/api/ops/moderation/rejected', {
    isEmpty: (v) => v.rejected.length === 0,
    emptyMessage: 'No reports have been rejected.',
  });
  return (
    <section data-screen="RejectedReports" data-requirement="11.2.14">
      <h1 className="text-2xl font-bold tracking-tight sm:text-[2rem]">Rejected reports</h1>
      <StateView state={state} onRetry={retry}>
        <ol data-part="rejected-list" data-cards>
          {(value?.rejected ?? []).map((row) => (
            <li key={row.reportId} className="queue-card">
              <div data-part="card-head">
                <a href={`/ops/moderation/${row.reportId}`} onClick={link(props, `/ops/moderation/${row.reportId}`)}>
                  {label(row.pestType)} report
                </a>
              </div>
              <p data-part="reason">{row.reason}</p>
              <div data-part="card-meta">
                <span data-part="locality">{row.localityBinding}</span>
                <span data-part="rejected-by">Rejected by {row.rejectedBy ?? 'unknown'}</span>
                <span data-part="rejected-at">
                  {row.rejectedAt === null
                    ? 'time not recorded'
                    : `${new Date(row.rejectedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT`}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </StateView>
    </section>
  );
}
