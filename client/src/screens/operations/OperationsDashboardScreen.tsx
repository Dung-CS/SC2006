/**
 * D-Fence — Operations Dashboard (REQUIREMENTS.md 11.2.12).
 * Stereotype: <<boundary>>. Traces: 11.2.12, 7.1.x, 7.2.x, 7.5.x, 1.4.4, 10.2.2, 10.5.7, 11.7.5.
 *
 * The manager's home, and the screen where a wrong number does the most damage — every dispatch
 * decision starts here.
 *
 * Three things it refuses to do:
 *   - **Recompute anything.** 7.2.1 forbids the dashboard recalculating a score for display; every
 *     figure is the one the scoring cycle stored. A recomputed contribution would show a number
 *     that never existed in the history, and the two would diverge the first time a weight changed.
 *   - **Show a null as zero.** `StatTile` renders an absent count as an em dash. "0 open verified
 *     reports" and "we could not count them" are different facts, and a manager acts on the first.
 *   - **Hide a stale source.** 1.4.4 and 10.2.2 want degraded data shown *and* marked; the payload
 *     carries `staleSources` precisely so this screen cannot quietly omit the notice.
 */
import { useLoad } from '../../lib/useLoad';
import { StateView, StatTile } from '../../components/States';
import { link } from '../../components/Link';
import { Pagination, usePagination } from '../../components/Pagination';
import { ScreenProps } from '../ScreenProps';
import { reportPhotoUrl } from '../../lib/reportVisuals';
import { cleanTitle } from '../../../../src/presentation/DisplayNames';
import { getClusterPhotos } from '../../lib/clusterVisuals';
import { DispatchProposalScreen } from './DispatchProposalScreen';

interface DashboardPayload {
  overview: {
    activeClusters: number;
    totalActiveCases: number;
    highTierClusters: number;
    reportHotspots?: number | null;
    reportHighPriority?: number | null;
    openVerifiedReports: number | null;
    openWorkOrders: number | null;
    overdueWorkOrders: number | null;
    tierDistribution: Record<string, number>;
    dataAsOf: string | null;
    staleSources: string[];
  };
  /**
   * 7.5.1-7.5.4. The field names are the server's — `detail` and `link`, not `message`. They were
   * `message` here and nothing on the server ever sent one, so every item in this panel rendered
   * as an empty bullet: the panel that exists to say what needs a decision today has been saying
   * nothing at all, in production, while looking like it had nothing to say.
   */
  attention: Array<{ kind: string; detail: string; link: string }>;
}

interface PriorityPayload {
  rows: Array<{
    rank: number;
    clusterId: string;
    locality: string;
    caseSize: number;
    caseDelta: number;
    score: number;
    tier: string;
    workOrderStatus: string | null;
    isDegraded: boolean;
    excludedDrivers: string[];
  }>;
}

export function OperationsDashboardScreen(props: ScreenProps): JSX.Element {
  const dashboard = useLoad<DashboardPayload>(props.api, '/api/ops/dashboard');
  const priority = useLoad<PriorityPayload>(props.api, '/api/ops/priority', {
    isEmpty: (v) => v.rows.length === 0,
    emptyMessage: 'No clusters have been scored yet.',
  });

  const {
    currentPage: priorityPage,
    setCurrentPage: setPriorityPage,
    pageSize: priorityPageSize,
    totalItems: priorityTotalItems,
    pagedItems: priorityPagedRows,
  } = usePagination(priority.value?.rows ?? [], 10);

  const overview = dashboard.value?.overview;

  return (
    <section data-screen="OpsDashboard" data-requirement="11.2.12">
      <h1>Operations</h1>
      <DispatchProposalScreen {...props} embedded />
      <details data-part="operations-summary">
        <summary>Operations summary</summary>

        <StateView state={dashboard.state} onRetry={dashboard.retry}>
          {overview === undefined ? null : (
            <>
              {/* 1.4.4, 10.5.7 — say which source is stale and that the figures below are affected.
                  A dashboard that showed the numbers alone would present last week's as today's. */}
              {overview.staleSources.length > 0 ? (
                <p role="status" data-part="stale">
                  Some figures are out of date: {overview.staleSources.join(', ')} last updated too long ago.
                </p>
              ) : null}

              <p data-part="as-of">
                {/* 7.1.9 — the age of the DATA, not of the request. */}
                {overview.dataAsOf === null
                  ? 'No data has been ingested yet.'
                  : `Data as of ${new Date(overview.dataAsOf).toISOString().slice(0, 16).replace('T', ' ')}.`}
              </p>

              <div data-part="stats">
                <StatTile label="Active clusters" value={overview.activeClusters} />
                <StatTile label="Active cases" value={overview.totalActiveCases} />
                <StatTile
                  label="Cluster priority"
                  value={overview.highTierClusters}
                  hint="Official NEA dengue clusters scored High."
                />
                <StatTile
                  label="Report case priority"
                  value={overview.reportHighPriority ?? null}
                  hint="Resident-report hotspots on the map rated High. Blank when reports could not be read."
                />
                {/* null renders as an em dash — never as zero (7.1.x). */}
                <StatTile
                  label="Open verified reports"
                  value={overview.openVerifiedReports}
                  hint="Blank when the report store could not be read."
                />
                <StatTile label="Open work orders" value={overview.openWorkOrders} />
                <StatTile label="Overdue work orders" value={overview.overdueWorkOrders} />
              </div>

              {/* 7.5.x — what needs a decision today, available with the supporting records. */}
              <section data-part="attention">
                <h2>Needs attention</h2>
                {(dashboard.value?.attention ?? []).length === 0 ? (
                  <p data-state="empty">Nothing is waiting on you.</p>
                ) : (
                  <ul data-part="attention-list" data-cards className="dispatch-task-cards">
                    {(dashboard.value?.attention ?? []).map((item, index) => (
                      <li key={`${item.kind}-${index}`} data-kind={item.kind}>
                        <img src={reportPhotoUrl('StandingWater')} alt="Standing water reference image; not incident evidence" />
                        <span data-part="detail">{item.detail}</span>{' '}
                        {/* 7.5.4 — the place it can be resolved, one click away rather than named. */}
                        <a href={item.link} onClick={link(props, item.link)}>
                          Open
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </StateView>

        <section data-part="priority">
          <h2>Priority</h2>
          <StateView state={priority.state} onRetry={priority.retry}>
            {priority.value?.rows && priority.value.rows.length > 0 ? (
              <div data-part="priority-cards" className="priority-clusters-cards">
                <div className="priority-cards-grid">
                  {priorityPagedRows.map((row) => {
                    const image = getClusterPhotos({ clusterId: row.clusterId, locality: row.locality, tier: row.tier, caseSize: row.caseSize })[0];
                    return <div key={row.clusterId} className="cluster-card priority-cluster-card" data-tier={row.tier} data-degraded={row.isDegraded}>
                      <img className="priority-card-reference-image" src={image?.url ?? reportPhotoUrl('StandingWater')} alt={`${image?.alt ?? 'Standing water'}; reference image, not incident evidence`} />
                      <div className="cluster-card-content">
                        <div className="cluster-card-header">
                          <span className="cluster-rank-badge">Rank #{row.rank}</span>
                          <a href={`/ops/clusters/${row.clusterId}`} onClick={link(props, `/ops/clusters/${row.clusterId}`)}>
                            {cleanTitle(row.locality, 'Unknown locality')}
                          </a>
                        </div>
                        <div className="cluster-card-stats">
                          <span>{row.caseSize} confirmed cases</span>
                          <span>Score <strong>{row.score.toFixed(1)}</strong></span>
                          <span aria-label="Case change">{row.caseDelta > 0 ? `+${row.caseDelta}` : row.caseDelta}</span>
                          <span>{row.workOrderStatus ?? 'No open work order'}</span>
                          <span className={`cluster-tier-tag tier-${row.tier.toLowerCase()}`}>{row.tier}</span>
                        </div>
                        {row.isDegraded ? <p data-part="degraded">Degraded. Excluded: {row.excludedDrivers.join(', ')}.</p> : null}
                      </div>
                    </div>;
                  })}
                </div>
              </div>
            ) : null}

            <Pagination
              currentPage={priorityPage}
              totalItems={priorityTotalItems}
              pageSize={priorityPageSize}
              onPageChange={setPriorityPage}
              itemName="priority clusters"
            />
          </StateView>
        </section>

        <nav aria-label="Operations actions">
          <a href="/ops/moderation" onClick={link(props, '/ops/moderation')}>
            Moderation queue
          </a>
          <a href="/ops/work-orders" onClick={link(props, '/ops/work-orders')}>
            Work orders
          </a>
        </nav>
      </details>
    </section>
  );
}
