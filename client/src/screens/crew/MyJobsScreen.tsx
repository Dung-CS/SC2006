/**
 * D-Fence — My Jobs (REQUIREMENTS.md 11.2.19).
 * Stereotype: <<boundary>>. Traces: 11.2.19, 8.4.1, 8.4.2, 8.4.6, 2.3.5, 11.4.2, 11.6.x.
 *
 * A crew member's own work, and nothing else. The filter is sent to the server rather than applied
 * here (8.4.1): filtering in the browser would mean every crew's assignments were shipped to the
 * device and hidden by the interface, which is precisely the arrangement 2.3.6 says may never be
 * the enforcement point.
 *
 * Today first, then by priority within a date — 8.4.2's order, produced by the controller. This
 * screen re-sorts nothing; a second sort here would silently win over the one the requirement
 * names, and the two would drift.
 */
import { useState } from 'react';
import { Backpack, ChevronRight } from 'lucide-react';
import { useLoad } from '../../lib/useLoad';
import { Freshness, QUEUE_REFRESH_MS, StateView } from '../../components/States';
import { link } from '../../components/Link';
import { Pill, statusTone, tierTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { Pagination, usePagination } from '../../components/Pagination';
import { ScreenProps } from '../ScreenProps';
import { displayTaskName } from '../../../../src/presentation/DisplayNames';

interface JobsPayload {
  filter: string;
  workOrders: Array<{
    id: string;
    clusterId?: string | null;
    sourceReportId?: string | null;
    pestType?: string | null;
    location?: string;
    point?: { latitude: number; longitude: number } | null;
    taskType: string;
    status: string;
    scheduledDate: string;
    priority: string;
    issueFlag: boolean;
  }>;
}

interface ChecklistItem {
  id: string;
  item: string;
  quantity?: string;
  icon?: string;
  checked: boolean;
  checkedBy?: string;
  checkedAt?: string;
}

interface ChecklistResponse {
  assignment: { id: string } | null;
  checklist: ChecklistItem[];
}

const FILTERS = ['Today', 'Upcoming', 'Completed', 'All'] as const;

export function MyJobsScreen(props: ScreenProps): JSX.Element {
  const [filter, setFilter] = useState<string>('Today');
  const { state, value, retry, lastLoadedAt } = useLoad<JobsPayload>(
    props.api,
    `/api/crew/work-orders?filter=${filter}`,
    {
      isEmpty: (v) => v.workOrders.length === 0,
      emptyMessage: 'Nothing here. Check Upcoming, or ask your manager if you expected work today.',
      // 8.2.1 — this is the screen a manager's assignment has to reach. A crew member holding
      // their phone in a car park should not have to know to reload it, and until the poll existed
      // the only way a new job appeared was if they happened to press something.
      refreshMs: QUEUE_REFRESH_MS,
    },
  );

  const { value: checklistVal, retry: retryChecklist } = useLoad<ChecklistResponse>(
    props.api,
    '/api/crew/dispatch/checklist',
    { refreshMs: QUEUE_REFRESH_MS }
  );

  const { currentPage, setCurrentPage, pageSize, totalItems, pagedItems } = usePagination(
    value?.workOrders ?? [],
    10,
  );

  return (
    <section data-screen="MyJobs" data-requirement="11.2.19">
      <h1 className="text-2xl font-bold tracking-tight md:text-[2rem]">My jobs</h1>
      <Freshness at={lastLoadedAt} everyMs={QUEUE_REFRESH_MS} onRefresh={retry} />

      {/* 11.6.x — large, separate controls rather than a dropdown: this screen is used one-handed,
          outdoors, on a phone. */}
      <div role="group" aria-label="Filter" data-part="filters" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            className="min-h-12 text-base"
            aria-pressed={filter === option}
            onClick={() => {
              setFilter(option);
              setCurrentPage(1);
            }}
          >
            {option}
          </button>
        ))}
      </div>

      {checklistVal?.checklist?.length ? (
        <section aria-label="Dispatch logistics checklist" className="my-4 rounded-3xl border border-line bg-surface p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="m-0 flex items-center gap-2 text-base font-bold text-ink">
              <Backpack size={18} className="text-accent" /> Equipment &amp; Logistics Checklist
            </h2>
            <span className="text-xs font-semibold text-ink-quiet">
              {checklistVal.checklist.filter((i) => i.checked).length} of {checklistVal.checklist.length} loaded
            </span>
          </div>
          <p className="mt-0 mb-3 text-xs text-ink-quiet">Verify and check each item as it is loaded onto your vehicle.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {checklistVal.checklist.map((item) => (
              <label
                key={item.id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-sm transition-colors ${
                  item.checked ? 'border-tier-low/40 bg-tier-low/10' : 'border-line bg-ground hover:border-accent/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={async (e) => {
                    if (!checklistVal.assignment) return;
                    await props.api.post('/api/crew/dispatch/checklist/toggle', {
                      assignmentId: checklistVal.assignment.id,
                      itemId: item.id,
                      checked: e.target.checked,
                    });
                    retryChecklist();
                  }}
                  className="size-4 rounded"
                />
                <span className="text-base">{item.icon || '📦'}</span>
                <span className={`font-medium ${item.checked ? 'text-ink-quiet line-through' : 'text-ink'}`}>
                  {item.item} {item.quantity ? <span className="text-xs font-semibold text-accent">({item.quantity})</span> : null}
                </span>
              </label>
            ))}
          </div>
        </section>
      ) : null}

      <StateView state={state} onRetry={retry}>
        <ol data-part="jobs" className="m-0 grid list-none gap-3 p-0">
          {/* Rendered in the order the server returned (8.4.2). */}
          {pagedItems.map((job) => (
            <li key={job.id} data-status={job.status} data-priority={job.priority} className="relative grid gap-1 rounded-3xl border border-line bg-surface p-4 shadow-sm">
              <a href={`/crew/jobs/${job.id}`} onClick={link(props, `/crew/jobs/${job.id}`)} className="flex min-h-11 items-center justify-between gap-2 text-lg font-bold text-ink no-underline">
                <span data-part="entity-title">{displayTaskName(job.taskType, job.pestType ?? undefined, job.location ?? 'Reported location')}</span>
                <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-accent" />
              </a>
              <p className="job-card-location" data-part="location">
                📍 {job.location ?? (job.point == null ? 'Singapore' : `${job.point.latitude}, ${job.point.longitude}`)}
              </p>
              {job.clusterId === null ? <p data-part="target">Verified report target</p> : null}
              <p data-part="scheduled" className="m-0 text-sm font-semibold text-ink-quiet">{job.scheduledDate}</p>
              <div className="job-card-meta">
                <span data-part="status">
                  <Pill tone={statusTone(job.status)}>{label(job.status)}</Pill>
                  {job.issueFlag ? <span className="ml-1.5 text-sm font-semibold text-tier-high">⚠️ Issue</span> : null}
                </span>
                <span data-part="priority">
                  <Pill tone={tierTone(job.priority)} tier={job.priority}>
                    {job.priority}{job.clusterId === null && job.priority === 'Medium' ? ' — Unscored report default' : job.clusterId === null && job.priority === 'Critical' ? ' — Critical injury override' : ''}
                  </Pill>
                </span>
              </div>
            </li>
          ))}
        </ol>

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemName="jobs"
        />
      </StateView>
    </section>
  );
}
