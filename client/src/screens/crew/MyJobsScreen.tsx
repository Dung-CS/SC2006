/**
 * D-Fence — My Jobs & Crew Dispatch (REQUIREMENTS.md 11.2.19).
 * Stereotype: <<boundary>>. Traces: 11.2.19, 8.4.1, 8.4.2, 8.4.6, 2.3.5, 11.4.2, 11.6.x.
 *
 * Displays a field officer's assigned dispatch route today (full route, vehicle, crew, ordered stops,
 * logistics checklist) alongside their full filtered job queue.
 */
import { useState } from 'react';
import { Backpack, Building2, CalendarDays, ChevronRight, Truck, Users } from 'lucide-react';
import { useLoad } from '../../lib/useLoad';
import { Freshness, QUEUE_REFRESH_MS, StateView } from '../../components/States';
import { link } from '../../components/Link';
import { Pill, statusTone, tierTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { Pagination, usePagination } from '../../components/Pagination';
import { ScreenProps } from '../ScreenProps';
import { cleanTitle, displayTaskName } from '../../../../src/presentation/DisplayNames';
import { staffDisplayName, staffPhotoUrl } from '../../lib/staffVisuals';

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

interface DispatchStopPayload {
  workOrderId: string;
  pestType: string | null;
  taskType: string | null;
  location: string;
  priority: string | null;
  status: string | null;
}

interface DispatchAssignmentPayload {
  id: string;
  date: string;
  teamId: string;
  vehicleId?: string;
  status?: string;
  routeSnapshot?: {
    teamId: string;
    depotLocation?: string;
    status: string;
    color?: string;
    staffCount?: number;
    crewMembers?: Array<{ id: string; email: string; displayName?: string | null }>;
    vehicleModel?: string;
    vehicleName?: string;
    vehicleRegistration?: string;
    vehiclePhotoUrl?: string;
    waypointOrder?: Array<{
      isHq?: boolean;
      workOrderId?: string;
      taskType?: string;
      pestType?: string;
      priority?: string;
      status?: string;
      label?: string;
    }>;
    totalDurationSeconds: number;
    totalTravelSeconds: number;
    totalEffortSeconds: number;
    capacityUsedPercentage: number;
    completedCount: number;
    totalStopsCount: number;
    progressPercentage: number;
  };
}

interface ChecklistResponse {
  assignment: DispatchAssignmentPayload | null;
  checklist: ChecklistItem[];
  stops?: DispatchStopPayload[];
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
      refreshMs: QUEUE_REFRESH_MS,
    },
  );

  const { value: checklistVal, retry: retryChecklist } = useLoad<ChecklistResponse>(
    props.api,
    '/api/crew/dispatch/checklist',
    { refreshMs: QUEUE_REFRESH_MS },
  );

  const { currentPage, setCurrentPage, pageSize, totalItems, pagedItems } = usePagination(
    value?.workOrders ?? [],
    10,
  );

  const assignment = checklistVal?.assignment;
  const snapshot = assignment?.routeSnapshot;
  const stops: DispatchStopPayload[] = (checklistVal?.stops && checklistVal.stops.length > 0)
    ? checklistVal.stops
    : (snapshot?.waypointOrder?.filter((wp) => !wp.isHq).map((wp) => ({
        workOrderId: wp.workOrderId ?? '',
        pestType: wp.pestType ?? null,
        taskType: wp.taskType ?? null,
        location: wp.label ?? 'Singapore',
        priority: wp.priority ?? null,
        status: wp.status ?? null,
      })) ?? []);

  const totalStopsCount = stops.length > 0 ? stops.length : (snapshot?.totalStopsCount ?? 0);
  const completedStopsCount = stops.length > 0
    ? stops.filter((s) => s.status === 'Completed' || s.status === 'Verified').length
    : (snapshot?.completedCount ?? 0);
  const progressPct = totalStopsCount > 0
    ? Math.round((completedStopsCount / totalStopsCount) * 100)
    : (snapshot?.progressPercentage ?? 0);

  const dispatchStatus = assignment?.status === 'Cancelled'
    ? 'Cancelled'
    : totalStopsCount > 0 && completedStopsCount === totalStopsCount
    ? 'Completed'
    : (snapshot?.status ?? 'Assigned');

  const totalDurationSec = snapshot?.totalDurationSeconds ?? 0;
  const durationHours = Math.floor(totalDurationSec / 3600);
  const durationMins = Math.round((totalDurationSec % 3600) / 60);
  const capPct = snapshot?.capacityUsedPercentage ?? Math.min(100, Math.round((totalDurationSec / 14400) * 100));
  const travelMins = Math.round((snapshot?.totalTravelSeconds ?? 0) / 60);
  const effortMins = Math.round((snapshot?.totalEffortSeconds ?? 0) / 60);

  return (
    <section data-screen="MyJobs" data-requirement="11.2.19">
      <h1 className="text-2xl font-bold tracking-tight md:text-[2rem]">My jobs</h1>
      <Freshness
        at={lastLoadedAt}
        everyMs={QUEUE_REFRESH_MS}
        onRefresh={() => {
          retry();
          retryChecklist();
        }}
      />

      {/* 1. My Dispatch section (Mobile first, 430px wide, one-handed) */}
      <section
        data-part="my-dispatch"
        aria-label="My dispatch"
        className="my-4 rounded-3xl border border-line bg-surface p-4 shadow-sm"
      >
        {!assignment ? (
          <div className="flex flex-col gap-1 py-1">
            <h2 className="m-0 text-lg font-bold tracking-tight text-ink">My dispatch</h2>
            <p className="m-0 text-sm text-ink-quiet">No dispatch route assigned for today.</p>
          </div>
        ) : (
          <div>
            {/* Route Header */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-xl font-bold tracking-tight text-ink">
                    {cleanTitle(snapshot?.teamId ?? assignment.teamId, 'Field team')}
                  </h2>
                  {snapshot?.depotLocation ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-ground px-2.5 py-0.5 text-xs font-semibold text-accent">
                      <Building2 size={13} aria-hidden="true" />
                      {cleanTitle(snapshot.depotLocation, 'Depot')} Depot
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 mb-0 flex items-center gap-1 text-xs font-semibold text-ink-quiet">
                  <CalendarDays size={13} aria-hidden="true" />
                  {assignment.date}
                </p>
              </div>
              <div>
                <Pill tone={statusTone(dispatchStatus)}>{dispatchStatus}</Pill>
              </div>
            </div>

            {/* Assigned Crew */}
            <div data-part="dispatch-crew" className="my-3">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-quiet">
                Assigned crew
              </span>
              <div className="flex flex-wrap gap-2">
                {snapshot?.crewMembers?.length ? (
                  snapshot.crewMembers.map((member) => (
                    <span
                      key={member.id}
                      className="inline-flex items-center gap-2 rounded-full border border-line bg-ground py-1 pr-3 pl-1 text-sm text-ink"
                    >
                      <img
                        src={staffPhotoUrl(member.email, 'CleaningCrew')}
                        alt=""
                        className="size-7 rounded-full object-cover"
                      />
                      <span className="font-medium">
                        {staffDisplayName(member.email, 'CleaningCrew', member.displayName)}
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm text-ink-quiet">
                    <Users size={14} aria-hidden="true" />
                    {snapshot?.staffCount ?? 1} crew assigned
                  </span>
                )}
              </div>
            </div>

            {/* Assigned Vehicle */}
            <div data-part="dispatch-vehicle" className="my-3 rounded-2xl border border-line bg-ground p-3 text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-quiet">
                Assigned vehicle
              </span>
              <div className="flex items-center gap-3">
                {snapshot?.vehiclePhotoUrl ? (
                  <img
                    src={snapshot.vehiclePhotoUrl}
                    alt=""
                    className="size-10 rounded-lg object-cover"
                    onError={(e) => {
                      e.currentTarget.hidden = true;
                    }}
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface text-accent">
                    <Truck size={20} aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-base text-ink">
                      {snapshot?.vehicleModel || snapshot?.vehicleName || 'Vehicle assigned'}
                    </strong>
                    {snapshot?.vehicleRegistration ? (
                      <span className="rounded border border-line bg-surface px-2 py-0.5 font-mono text-xs font-semibold text-ink">
                        {snapshot.vehicleRegistration}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Route Metrics */}
            <div data-part="dispatch-metrics" className="my-3">
              <div className="mb-2">
                <div className="flex justify-between text-xs font-semibold text-ink mb-1">
                  <span>
                    Route progress: {completedStopsCount} of {totalStopsCount} stops completed
                  </span>
                  <span className="tabular-nums text-ink-quiet">{progressPct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full rounded-full transition-[width] duration-300 ease-out"
                    style={{
                      width: `${progressPct}%`,
                      backgroundColor: progressPct === 100 ? 'var(--tier-low, #16A34A)' : 'var(--accent, #2563EB)',
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 rounded-2xl border border-line bg-ground p-3 text-xs">
                <div>
                  <span className="block font-medium text-ink-quiet">Total Duration</span>
                  <strong className="text-sm text-ink">{durationHours}h {durationMins}m</strong>
                  <span className="mt-0.5 block text-[11px] text-ink-quiet">{capPct}% of 4h cap</span>
                </div>
                <div>
                  <span className="block font-medium text-ink-quiet">Travel Time</span>
                  <strong className="text-sm text-ink">{travelMins} min</strong>
                  <span className="mt-0.5 block text-[11px] text-ink-quiet">transit &amp; travel</span>
                </div>
                <div>
                  <span className="block font-medium text-ink-quiet">On-Site Effort</span>
                  <strong className="text-sm text-ink">{effortMins} min</strong>
                  <span className="mt-0.5 block text-[11px] text-ink-quiet">field treatment</span>
                </div>
                <div>
                  <span className="block font-medium text-ink-quiet">Stops</span>
                  <strong className="text-sm text-ink">{totalStopsCount} stops</strong>
                  <span className="mt-0.5 block text-[11px] text-ink-quiet">{completedStopsCount} completed</span>
                </div>
              </div>
            </div>

            {/* Logistics Equipment Checklist */}
            {checklistVal?.checklist?.length ? (
              <section
                aria-label="Dispatch logistics checklist"
                className="my-3 rounded-2xl border border-line bg-ground p-3.5"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="m-0 flex items-center gap-2 text-sm font-bold text-ink">
                    <Backpack size={16} className="text-accent" /> Equipment &amp; Logistics Checklist
                  </h3>
                  <span className="text-xs font-semibold text-ink-quiet">
                    {checklistVal.checklist.filter((i) => i.checked).length} of {checklistVal.checklist.length} loaded
                  </span>
                </div>
                <p className="mt-0 mb-3 text-xs text-ink-quiet">
                  Verify and check each item as it is loaded onto your vehicle.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {checklistVal.checklist.map((item) => (
                    <label
                      key={item.id}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-sm transition-colors ${
                        item.checked
                          ? 'border-tier-low/40 bg-tier-low/10'
                          : 'border-line bg-surface hover:border-accent/40'
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
                        {item.item}{' '}
                        {item.quantity ? (
                          <span className="text-xs font-semibold text-accent">({item.quantity})</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ) : null}

            {/* Ordered Stops */}
            <div data-part="dispatch-stops" className="my-3">
              <h3 className="mt-0 mb-2 text-sm font-bold tracking-tight text-ink">
                Route stops ({stops.length})
              </h3>
              {stops.length === 0 ? (
                <p className="text-xs text-ink-quiet">No stops assigned on this route.</p>
              ) : (
                <ol className="m-0 flex list-none flex-col gap-2 p-0">
                  {stops.map((stop, index) => (
                    <li
                      key={stop.workOrderId}
                      data-work-order-id={stop.workOrderId}
                      data-status={stop.status}
                      data-priority={stop.priority}
                      className="rounded-2xl border border-line bg-ground p-3 text-sm shadow-xs transition-colors hover:border-accent/40"
                    >
                      <a
                        href={`/crew/jobs/${stop.workOrderId}`}
                        onClick={link(props, `/crew/jobs/${stop.workOrderId}`)}
                        className="flex min-h-11 items-center justify-between gap-2 text-base font-bold text-ink no-underline"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-accent">{index + 1}.</span>
                          <span data-part="entity-title">
                            {displayTaskName(stop.taskType ?? 'Inspection', stop.pestType ?? undefined, stop.location)}
                          </span>
                        </span>
                        <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-accent" />
                      </a>
                      <p className="job-card-location m-0 mt-1 text-xs text-ink-quiet" data-part="location">
                        📍 {stop.location}
                      </p>
                      <div className="job-card-meta mt-2 flex flex-wrap items-center gap-2">
                        <span data-part="status">
                          {stop.status ? <Pill tone={statusTone(stop.status)}>{label(stop.status)}</Pill> : null}
                        </span>
                        <span data-part="priority">
                          {stop.priority ? (
                            <Pill tone={tierTone(stop.priority)} tier={stop.priority}>
                              {stop.priority}
                            </Pill>
                          ) : null}
                        </span>
                        {stop.pestType ? (
                          <span className="text-xs font-medium text-ink-quiet">{label(stop.pestType)}</span>
                        ) : null}
                        {stop.taskType ? (
                          <span className="text-xs font-medium text-ink-quiet">· {label(stop.taskType)}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 2. All My Jobs section */}
      <section aria-label="All my jobs" className="mt-8">
        <h2 className="mb-3 text-xl font-bold tracking-tight text-ink md:text-2xl">All my jobs</h2>

        {/* Filters */}
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

        <StateView state={state} onRetry={retry}>
          <ol data-part="jobs" className="m-0 mt-4 grid list-none gap-3 p-0">
            {pagedItems.map((job) => (
              <li
                key={job.id}
                data-status={job.status}
                data-priority={job.priority}
                className="relative grid gap-1 rounded-3xl border border-line bg-surface p-4 shadow-sm"
              >
                <a
                  href={`/crew/jobs/${job.id}`}
                  onClick={link(props, `/crew/jobs/${job.id}`)}
                  className="flex min-h-11 items-center justify-between gap-2 text-lg font-bold text-ink no-underline"
                >
                  <span data-part="entity-title">
                    {displayTaskName(job.taskType, job.pestType ?? undefined, job.location ?? 'Reported location')}
                  </span>
                  <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-accent" />
                </a>
                <p className="job-card-location" data-part="location">
                  📍 {job.location ?? (job.point == null ? 'Singapore' : `${job.point.latitude}, ${job.point.longitude}`)}
                </p>
                {job.clusterId === null ? <p data-part="target">Verified report target</p> : null}
                <p data-part="scheduled" className="m-0 text-sm font-semibold text-ink-quiet">
                  {job.scheduledDate}
                </p>
                <div className="job-card-meta">
                  <span data-part="status">
                    <Pill tone={statusTone(job.status)}>{label(job.status)}</Pill>
                    {job.issueFlag ? <span className="ml-1.5 text-sm font-semibold text-tier-high">⚠️ Issue</span> : null}
                  </span>
                  <span data-part="priority">
                    <Pill tone={tierTone(job.priority)} tier={job.priority}>
                      {job.priority}
                      {job.clusterId === null && job.priority === 'Medium'
                        ? ' — Unscored report default'
                        : job.clusterId === null && job.priority === 'Critical'
                        ? ' — Critical injury override'
                        : ''}
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
    </section>
  );
}
