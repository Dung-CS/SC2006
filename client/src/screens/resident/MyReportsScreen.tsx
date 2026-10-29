/**
 * D-Fence — My Reports screen (REQUIREMENTS.md 11.2.9).
 * Stereotype: <<boundary>>. Traces: 11.2.9, 5.2.1–5.2.4, 11.4.2, 10.5.1.
 *
 * A resident's own reports, with the status each has reached. The status words are the data
 * dictionary's (10.5.1) rather than friendlier synonyms — a resident who is told their report was
 * "Verified" and an operations manager reading "Verified" on the same report must be reading about
 * the same thing, or the two cannot discuss it.
 */
import { useLoad } from '../../lib/useLoad';
import { StateView } from '../../components/States';
import { link } from '../../components/Link';
import { Pill, statusTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { reportPhotoUrl } from '../../lib/reportVisuals';
import { Pagination, usePagination } from '../../components/Pagination';
import { ScreenProps } from '../ScreenProps';

interface ReportSummary {
  id: string;
  type: string;
  status: string;
  submittedAt: string;
  localityBinding: string | null;
  corroborationCount: number;
  pestType?: string;
}

export function MyReportsScreen(props: ScreenProps): JSX.Element {
  const { state, value, retry } = useLoad<{ reports: ReportSummary[] }>(props.api, '/api/reports/mine', {
    isEmpty: (v) => v.reports.length === 0,
    emptyMessage: 'You have not submitted any reports. If you see standing water or uncleared refuse, report it here.',
  });

  const { currentPage, setCurrentPage, pageSize, totalItems, pagedItems } = usePagination(
    value?.reports ?? [],
    10,
  );

  return (
    <section data-screen="MyReports" data-requirement="11.2.9">
      <h1>My reports</h1>
      <a href="/report" onClick={link(props, '/report')}>
        Report a site
      </a>

      <StateView state={state} onRetry={retry}>
        <ul data-part="reports" data-cards>
          {pagedItems.map((report) => (
            <li key={report.id} data-entity-id={report.id} data-status={report.status} className="report-card">
              <div className="report-card-layout">
                <img
                  src={reportPhotoUrl(report.type, report.pestType)}
                  alt={`Evidence for ${label(report.type)}`}
                  className="report-card-thumb"
                  loading="lazy"
                />
                <div className="report-card-content">
                <div data-part="card-head">
                  <a data-part="entity-title" href={`/reports/${report.id}`} onClick={link(props, `/reports/${report.id}`)}>
                    {report.pestType && report.pestType !== 'Mosquito'
                      ? `${label(report.pestType)} · ${label(report.type)}`
                      : label(report.type)}
                  </a>
                  {/* 11.7.5 — the status is a word in its own right, and now a colour as well. */}
                  <Pill tone={statusTone(report.status)}>
                    <span data-part="status">{label(report.status)}</span>
                  </Pill>
                </div>
                <div data-part="card-meta">
                  {report.localityBinding === null || report.localityBinding === undefined ? null : (
                    <span>{report.localityBinding}</span>
                  )}
                  <span data-part="submitted">
                    {new Date(report.submittedAt).toISOString().slice(0, 16).replace('T', ' ')} SGT
                  </span>
                  {report.corroborationCount > 0 ? (
                    <span data-part="corroborations">
                      {report.corroborationCount} neighbour{report.corroborationCount === 1 ? '' : 's'} confirmed this
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
          ))}
        </ul>

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemName="reports"
        />
      </StateView>
    </section>
  );
}
