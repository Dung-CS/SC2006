/**
 * D-Fence — Dispatch Proposal & Multi-Team Routing (REQUIREMENTS.md 11.2.16).
 * Stereotype: <<boundary>>. Traces: 11.2.16, 8.1.7, 8.1.8, 8.1.11, 8.1.12, 11.4.2.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLoad } from '../../lib/useLoad';
import { StateView } from '../../components/States';
import { link } from '../../components/Link';
import { Pill, tierTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { Pagination, usePagination } from '../../components/Pagination';
import { specialisationLabel } from '../../lib/dispatchRouting';
import { TaskType } from '../../../../src/entity/enums';
import { SingaporeMap, MapRoute, MapTask } from '../../components/SingaporeMap';
import { ScreenProps } from '../ScreenProps';
import { reportPhotoUrl } from '../../lib/reportVisuals';
import { cleanTitle } from '../../../../src/presentation/DisplayNames';
import { isUsableDrivingRoute } from '../../../../src/boundary/gateways/OneMapGateway';
import { GeoPoint } from '../../../../src/entity/valueTypes';

interface DispatchPayload {
  date: string;
  proposals: Array<{
    clusterId: string;
    mapClusterId?: string;
    sourceReportId?: string;
    point?: { latitude: number; longitude: number };
    mapPoint?: { latitude: number; longitude: number };
    referralAuthority?: string;
    priorityBasis?: string;
    pestType?: string;
    allowedCapabilities?: string[];
    locality: string;
    score: number;
    tier: string;
    suggestedTaskType: string;
    scheduledDate: string;
  }>;
}

interface PackingItemPayload {
  item: string;
  quantity: string;
  category: string;
  icon: string;
  reason: string;
  quantityCount?: number;
  unitWeightKg?: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
  totalWeightKg?: number;
  totalVolumeM3?: number;
  isProvisional?: boolean;
}

interface WaypointPayload {
  label: string;
  point: { latitude: number; longitude: number };
  isAreaAccess?: boolean;
  targetPoint?: { latitude: number; longitude: number };
  workOrderId?: string;
  clusterId?: string | null;
  sourceReportId?: string;
  mapClusterId?: string;
  locality?: string;
  taskType?: string;
  pestType?: string;
  priority?: string;
  status: 'Completed' | 'InProgress' | 'Pending';
  isCompleted: boolean;
  estimatedEffortMinutes: number;
  requiredStaff?: number;
  requiresBaseReturn?: boolean;
  isBaseReturn?: boolean;
  isHq?: boolean;
  isDemo?: boolean;
  cumulativeDurationSeconds: number;
}

interface PlannedRoutesPayload {
  date: string;
  planStatus?: 'pending' | 'refreshing' | 'ready' | 'failed';
  computedAt?: string | null;
  planningDurationSeconds?: number | null;
  error?: string | null;
  unplanned?: UnassignedPayload[];
  routes: Array<{
    teamId: string;
    staffCount?: number;
    depotLocation: string;
    status: string;
    onCallLagHours: number;
    workOrderIds: string[];
    waypointOrder: WaypointPayload[];
    route: {
      coordinates: Array<{ latitude: number; longitude: number }>;
      distanceMetres: number;
      durationSeconds: number;
      source: string;
      drivingDurationSeconds?: number;
      walkingDurationSeconds?: number;
      walkingVisits?: WalkingVisitPayload[];
      drivingStops?: Array<{ latitude: number; longitude: number }>;
      areaVisits?: Array<{ stopIndex: number; targetPoint: { latitude: number; longitude: number }; accessPoint: { latitude: number; longitude: number } }>;
    };
    totalDurationSeconds: number;
    totalTravelSeconds: number;
    totalEffortSeconds: number;
    capacityUsedPercentage: number;
    isWithinFourHourCap: boolean;
    completedCount: number;
    totalStopsCount: number;
    progressPercentage: number;
    packingList: PackingItemPayload[];
    color: string;
    vehicleId?: string;
    vehicleRegistration?: string;
    vehicleName?: string;
    isDemoVehicle?: boolean;
    maxPayloadKg?: number;
    maxCargoVolumeM3?: number;
    loadWeightKg?: number;
    loadVolumeM3?: number;
    loadWeightPercentage?: number;
    loadVolumePercentage?: number;
    loadBasis?: string;
  }>;
}

interface WalkingLegPayload { coordinates: Array<{ latitude: number; longitude: number }>; durationSeconds: number; distanceMetres: number; source: string; mode: string }
interface WalkingVisitPayload { stopIndex: number; targetPoint: { latitude: number; longitude: number }; accessPoint: { latitude: number; longitude: number }; outbound: WalkingLegPayload; return: WalkingLegPayload }
interface UnassignedPayload {
  workOrderId: string; locality?: string; priority?: string; taskType?: string; pestType?: string; requiredStaff?: number; reason: string;
  scheduledDate?: string; date?: string; disposition?: 'unassigned' | 'committed'; status?: string; isDemo?: boolean;
  sourceReportId?: string; reportIds?: string[];
  point?: { latitude: number; longitude: number }; teamId?: string;
}
interface HorizonPayload {
  startDate: string; days: number; planStatus: 'pending' | 'refreshing' | 'ready' | 'failed';
  computedAt?: string | null; planningDurationSeconds?: number | null; error?: string | null;
  availabilityAssumption?: string; plans: PlannedRoutesPayload[]; unassigned: UnassignedPayload[];
}
function proposalFormPath(proposal: DispatchPayload['proposals'][number]): string {
  const query = new URLSearchParams({ taskType: proposal.suggestedTaskType,
    date: proposal.scheduledDate, pestType: proposal.pestType ?? 'Mosquito' });
  query.set(proposal.sourceReportId ? 'sourceReportId' : 'clusterId', proposal.sourceReportId ?? proposal.clusterId);
  return `/ops/work-orders/new?${query}`;
}

function existingOrderPath(id?: string): string | undefined {
  return id && !id.startsWith('report-') && !id.startsWith('prop-') ? `/ops/work-orders/${id}` : undefined;
}

function taskReferenceImage(taskType?: string, pestType?: string): string {
  if (pestType?.toLowerCase().replace(/[^a-z]/g, '') === 'wildboar') return '/visuals/clusters/residential-garden.jpg';
  return reportPhotoUrl(taskType ?? 'StandingWater', pestType);
}

function stopDisplayName(waypoint: WaypointPayload): string {
  return waypoint.isHq ? cleanTitle(waypoint.label, 'HQ') : taskLocation(waypoint.locality, waypoint.targetPoint ?? waypoint.point);
}

function taskLocation(locality?: string, point?: { latitude: number; longitude: number }): string {
  const fallback = point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    ? `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : 'Location not recorded';
  const title = cleanTitle(locality, fallback);
  return /^(unknown locality|unknown location|reported location|location not recorded|unknown)$/i.test(title) ? fallback : title;
}

function dateOffset(date: string, offset: number): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + offset));
  return [value.getUTCFullYear(), String(value.getUTCMonth() + 1).padStart(2, '0'), String(value.getUTCDate()).padStart(2, '0')].join('-');
}

export function DispatchProposalScreen(props: ScreenProps): JSX.Element {
  const today = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), []);
  const [date, setDate] = useState<string>(today);
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [days, setDays] = useState(7);
  const path = `/api/ops/dispatch?date=${encodeURIComponent(selectedDay)}`;
  const { state, value, retry } = useLoad<DispatchPayload>(props.api, path, {
    isEmpty: (v) => v.proposals.length === 0,
    emptyMessage:
      'Nothing is proposed for this date. Either every ranked cluster already has an open work order, or no scoring cycle has run.',
  });

  const routesPath = `/api/ops/dispatch/horizon?date=${encodeURIComponent(date)}&days=${days}`;
  const routesLoad = useLoad<HorizonPayload>(props.api, routesPath, {
    // A pending snapshot is a computation state, never an empty task list.
    isEmpty: () => false,
    refreshMs: 3000,
  });

  const [view, setView] = useState<'proposals' | 'routes' | 'unassigned'>('routes');
  // null means All, while [] deliberately selects nothing. New polling options join All only.
  const [selectedHqs, setSelectedHqs] = useState<string[] | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[] | null>(null);
  const [activePackingLists, setActivePackingLists] = useState<Record<string, boolean>>({});
  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});
  // Local stop status overrides for interactive progress tracking
  const [stopOverrides, setStopOverrides] = useState<Record<string, 'Completed' | 'InProgress' | 'Pending'>>({});

  const horizon = routesLoad.value;
  const plan = horizon?.plans.find((item) => item.date === selectedDay);
  const routes = plan?.routes ?? [];
  const proposalTeam = (proposal: DispatchPayload['proposals'][number]) => {
    const mapId = proposal.mapClusterId ?? (proposal.sourceReportId ? `pest-${proposal.sourceReportId}` : proposal.clusterId);
    const teams = routes.filter((route) => route.waypointOrder.some((wp) => !wp.isHq && wp.taskType === proposal.suggestedTaskType &&
      (proposal.sourceReportId && wp.sourceReportId === proposal.sourceReportId ||
        (wp.mapClusterId ?? wp.clusterId) === mapId))).map((route) => route.teamId);
    // Only an unambiguous recorded plan match supplies a preview team.
    return new Set(teams).size === 1 ? teams[0] : undefined;
  };
  const horizonRoutes = (horizon?.plans ?? []).flatMap((item) => item.routes);
  const hqKey = (teamId?: string) => horizonRoutes.find((route) => route.teamId === teamId)?.depotLocation || '__unassigned';
  const typeKey = (taskType?: string) => taskType || '__unknown';
  const accepts = (teamId?: string, taskType?: string) =>
    (selectedHqs === null || selectedHqs.includes(hqKey(teamId))) &&
    (selectedTypes === null || selectedTypes.includes(typeKey(taskType)));
  const hqOptions = [...new Set([
    ...horizonRoutes.map((route) => hqKey(route.teamId)),
    ...(horizon?.unassigned ?? []).map((job) => hqKey(job.teamId)),
    ...(value?.proposals ?? []).map((proposal) => hqKey(proposalTeam(proposal))),
  ])].sort();
  const typeOptions = [...new Set([
    ...(horizon?.plans ?? []).flatMap((item) => item.routes.flatMap((route) => route.waypointOrder.filter((wp) => !wp.isHq).map((wp) => typeKey(wp.taskType)))),
    ...(horizon?.unassigned ?? []).map((job) => typeKey(job.taskType)),
    ...(value?.proposals ?? []).map((proposal) => typeKey(proposal.suggestedTaskType)),
  ])].sort();
  const visibleProposals = (value?.proposals ?? []).filter((proposal) => accepts(proposalTeam(proposal), proposal.suggestedTaskType));
  const { currentPage, setCurrentPage, pageSize, totalItems, pagedItems } = usePagination(visibleProposals, 10);
  const horizonUnassigned = (horizon?.unassigned ?? []).filter((job) => accepts(job.teamId, job.taskType));
  const horizonOnlyUnassigned = horizonUnassigned.filter((job) => job.disposition !== 'committed');
  const horizonCommitted = horizonUnassigned.filter((job) => job.disposition === 'committed');
  const dailyUnplanned = plan?.unplanned ?? [];
  // A proposal alone is not evidence of road access. Only validated road-plan stops belong here.
  const roadRoutes = routes.filter((r) => r.route.source === 'onemap' && isUsableDrivingRoute({
    ...r.route, coordinates: r.route.coordinates.map((p) => new GeoPoint(p.latitude, p.longitude)),
  }, (r.route.drivingStops ?? r.waypointOrder.map((wp) => wp.point)).map((p) => new GeoPoint(p.latitude, p.longitude))));
  const displayedRoutes = roadRoutes.filter((r) => r.waypointOrder.some((wp) => !wp.isHq && accepts(r.teamId, wp.taskType)));

  const mapRoutes: MapRoute[] = displayedRoutes.map((r) => ({
    teamId: r.teamId,
    color: r.color || '#2563EB',
    label: `${r.totalStopsCount} stops · ${Math.round(r.totalDurationSeconds / 60)}m`,
    coordinates: r.route.coordinates,
    walkingSegments: (r.route.walkingVisits ?? []).flatMap((visit) => [visit.outbound, visit.return]
      .map((leg) => ({ coordinates: leg.coordinates })).filter((segment) => segment.coordinates.length >= 2)),
    waypoints: r.waypointOrder.flatMap((wp, idx) => {
      const overrideKey = `${selectedDay}:${r.teamId}-${idx}`;
      const effectiveStatus = stopOverrides[overrideKey] ?? wp.status;
      if (!wp.isHq && (effectiveStatus === 'Completed' || !accepts(r.teamId, wp.taskType))) return [];
      return [{
        label: stopDisplayName(wp),
        point: wp.point,
        isCompleted: effectiveStatus === 'Completed',
        isBaseReturn: wp.isBaseReturn,
        isHq: wp.isHq,
        priority: wp.priority,
        pestType: wp.pestType,
        taskType: wp.taskType,
      }];
    }),
  }));

  const routeTasks: MapTask[] = displayedRoutes.flatMap((route) => route.waypointOrder.flatMap((wp, index) => {
    if (wp.isHq || !accepts(route.teamId, wp.taskType) || (stopOverrides[`${selectedDay}:${route.teamId}-${index}`] ?? wp.status) === 'Completed') return [];
    return [{ id: wp.workOrderId ?? `${selectedDay}:${route.teamId}:${index}`, point: wp.targetPoint ?? wp.point,
      pestType: wp.pestType, taskType: wp.taskType, priority: wp.priority,
      location: stopDisplayName(wp), photoUrl: taskReferenceImage(wp.taskType, wp.pestType), photoIsReference: true,
      sourceReportId: wp.sourceReportId, teamId: route.teamId, teamLabel: cleanTitle(route.teamId, 'Field team'), assignmentState: 'planned' }];
  }));
  const dispositionTasks = horizonUnassigned.map((job) => ({
    id: job.workOrderId, point: job.point, pestType: job.pestType, taskType: job.taskType,
    priority: job.priority, location: taskLocation(job.locality, job.point),
    photoUrl: taskReferenceImage(job.taskType, job.pestType), photoIsReference: true,
    sourceReportId: job.sourceReportId ?? job.reportIds?.[0], teamId: job.teamId,
    teamLabel: job.teamId ? cleanTitle(job.teamId, 'Field team') : undefined,
    assignmentState: (job.disposition === 'committed' ? (job.teamId ? 'assigned' : 'unknown') : 'unassigned') as MapTask['assignmentState'],
  }));
  const proposalTasks = visibleProposals.map((proposal) => ({
    id: `proposal:${proposal.sourceReportId ?? proposal.clusterId}:${proposal.pestType ?? 'Mosquito'}`, point: proposal.point ?? proposal.mapPoint,
    pestType: proposal.pestType ?? 'Mosquito', taskType: proposal.suggestedTaskType, priority: proposal.tier,
    location: taskLocation(proposal.locality, proposal.point ?? proposal.mapPoint), photoUrl: taskReferenceImage(proposal.suggestedTaskType, proposal.pestType),
    photoIsReference: true, sourceReportId: proposal.sourceReportId,
    teamId: proposalTeam(proposal), teamLabel: proposalTeam(proposal) ? cleanTitle(proposalTeam(proposal), 'Field team') : undefined,
    assignmentState: (proposalTeam(proposal) ? 'planned' : 'unassigned') as MapTask['assignmentState'],
  }));
  const candidates = view === 'routes' ? routeTasks : view === 'unassigned' ? dispositionTasks : proposalTasks;
  const locatedTasks = candidates.filter((task): task is MapTask => Boolean(task.point &&
    Number.isFinite(task.point.latitude) && Number.isFinite(task.point.longitude)));
  const unavailableTasks = candidates.filter((task) => !locatedTasks.some((located) => located.id === task.id));
  const [photos, setPhotos] = useState<Record<string, { url: string; expiresAt: number }>>({});
  const photoSequence = useRef(0);
  const photoScope = `${view}:${selectedDay}:${date}:${days}:${JSON.stringify(selectedHqs)}:${JSON.stringify(selectedTypes)}`;
  useEffect(() => { photoSequence.current += 1; }, [photoScope]);
  useEffect(() => {
    setPhotos({});
    return () => { photoSequence.current += 1; };
  }, [props.api, props.principal?.accountId]);
  useEffect(() => {
    const expiries = Object.values(photos).map((photo) => photo.expiresAt);
    if (!expiries.length) return;
    const timeout = window.setTimeout(() => setPhotos((previous) => Object.fromEntries(
      Object.entries(previous).filter(([, photo]) => photo.expiresAt > Date.now()))), Math.max(0, Math.min(...expiries) - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [photos]);
  const openTask = async (task: MapTask) => {
    const sequence = ++photoSequence.current;
    if (!task.sourceReportId || (photos[task.id]?.expiresAt ?? 0) > Date.now()) return;
    try {
      const report = await props.api.get<{ photos?: Array<{ storageKey?: string }> }>(`/api/reports/${encodeURIComponent(task.sourceReportId)}`);
      const key = report.photos?.[0]?.storageKey;
      if (!key || sequence !== photoSequence.current) return;
      const image = await props.api.get<{ url?: string; expiresInSeconds?: number }>(`/api/images/report/${encodeURIComponent(task.sourceReportId)}/${encodeURIComponent(key)}`);
      if (sequence !== photoSequence.current || !image.url || !/^(https?:\/\/|\/[^/])/.test(image.url)) return;
      const ttlSeconds = Number.isFinite(image.expiresInSeconds) && image.expiresInSeconds! > 0 ? Math.min(image.expiresInSeconds!, 240) : 60;
      setPhotos((previous) => ({ ...previous, [task.id]: { url: image.url!, expiresAt: Date.now() + Math.max(0, ttlSeconds - 1) * 1000 } }));
    } catch { /* A missing or withheld photo retains the labelled reference. */ }
  };
  const mapTasks = locatedTasks.map((task) => (photos[task.id]?.expiresAt ?? 0) > Date.now()
    ? { ...task, photoUrl: photos[task.id]!.url, photoIsReference: false } : task);

  const togglePackingList = (teamId: string) => {
    setActivePackingLists((prev) => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const toggleGearItem = (key: string) => {
    setCheckedGear((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateStopStatus = (teamId: string, idx: number, status: 'Completed' | 'InProgress' | 'Pending') => {
    const key = `${selectedDay}:${teamId}-${idx}`;
    setStopOverrides((prev) => ({ ...prev, [key]: status }));
  };

  return (
    <section className="dispatch-screen" data-screen="DispatchProposal" data-requirement="11.2.16">
      <h1>Dispatch <span data-part="selected-day">{selectedDay}</span></h1>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="date" style={{ marginRight: '8px', fontWeight: 600 }}>
            Horizon start:
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setSelectedDay(event.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div>
          <label htmlFor="dispatch-day" style={{ marginRight: '8px', fontWeight: 600 }}>Show day:</label>
          <select id="dispatch-day" value={selectedDay} onChange={(event) => { setSelectedDay(event.target.value); setCurrentPage(1); }}>
            {Array.from({ length: days }, (_, offset) => dateOffset(date, offset)).map((day, index) => <option key={day} value={day}>Day {index + 1} · {day}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="horizon-days" style={{ marginRight: '8px', fontWeight: 600 }}>Planning horizon:</label>
          <select id="horizon-days" value={days} onChange={(event) => { setDays(Number(event.target.value)); setSelectedDay(date); }}>
            {[1, 2, 3, 4, 5, 6, 7].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'day' : 'days'}</option>)}
          </select>
        </div>

        <nav aria-label="Dispatch views" data-part="dispatch-tabs">
          <button type="button" aria-pressed={view === 'routes'} onClick={() => setView('routes')}>Routes ({roadRoutes.length})</button>
          <button type="button" aria-pressed={view === 'unassigned'} onClick={() => setView('unassigned')}>Unassigned / committed ({horizonOnlyUnassigned.length} / {horizonCommitted.length})</button>
          <button type="button" aria-pressed={view === 'proposals'} onClick={() => setView('proposals')}>Proposals ({visibleProposals.length})</button>
        </nav>
      </div>
      <div className="dispatch-filters">
        {([
          ['HQ', hqOptions, selectedHqs, setSelectedHqs],
          ['Job Type', typeOptions, selectedTypes, setSelectedTypes],
        ] as const).map(([title, options, selection, setSelection]) => (
          <fieldset key={title} data-filter={title === 'HQ' ? 'hq' : 'job-type'}>
            <legend>{title}</legend>
            <label><input type="checkbox" checked={selection === null || (options.length > 0 && options.every((option) => selection.includes(option)))}
              onChange={(event) => { setSelection(event.target.checked ? null : []); setCurrentPage(1); }} /> All</label>
            {options.map((option) => <label key={option}><input type="checkbox" value={option}
              checked={selection === null || selection.includes(option)}
              onChange={(event) => { setSelection(event.target.checked ? [...(selection ?? options), option] : (selection ?? options).filter((item) => item !== option)); setCurrentPage(1); }} />
              {option === '__unassigned' ? 'Unassigned / HQ not recorded' : option === '__unknown' ? 'Type not recorded' : label(option)}
            </label>)}
          </fieldset>
        ))}
      </div>
      <section className="dispatch-map" aria-label="Dispatch map">
        <h2 title={view === 'routes' ? 'Full planned route' : undefined}>{view === 'routes' ? 'Routes' : view === 'unassigned' ? 'Horizon tasks' : 'Daily proposals'} <small>{mapTasks.length} locations</small></h2>
        {view !== 'routes' ? <p className="dispatch-map-note">{view === 'proposals' ? 'Candidate locations' : 'Recorded task locations'} · Road access not verified</p> : null}
        <SingaporeMap label="dispatch-routes-map" viewKey={photoScope} showClusterBadges={false}
          clusters={[]} routes={view === 'routes' ? mapRoutes : []} tasks={mapTasks} onTaskOpen={openTask} size="tall" />
        {unavailableTasks.length > 0 ? <p className="dispatch-map-note">{unavailableTasks.length} locations unavailable</p> : null}
      </section>
            <div data-part="dispatch-status" aria-live="polite">
        {horizon?.planStatus === 'pending' || plan?.planStatus === 'pending' ? <span className="dispatch-status-chip" role="status" title="Routes are being prepared">Pending</span> : null}
        {horizon?.planStatus === 'refreshing' || plan?.planStatus === 'refreshing' ? <span className="dispatch-status-chip" role="status" title="The previous completed plan remains available">Updating</span> : null}
        {horizon?.computedAt ? <span className="dispatch-status-chip" title={horizon.planningDurationSeconds != null ? `Calculation took ${horizon.planningDurationSeconds.toFixed(1)} seconds` : undefined}>Updated {new Date(horizon.computedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT</span> : null}
        {horizon?.availabilityAssumption ? <span className="dispatch-status-chip" title={horizon.availabilityAssumption}>Availability assumed</span> : null}
        {horizon?.planStatus === 'failed' ? <span className="dispatch-status-chip" role="alert" title={horizon.error ?? 'Dispatch calculation failed'}>Failed <button type="button" onClick={routesLoad.retry}>Retry</button></span> : null}
      </div>
      <p><a href="/ops/vehicles" onClick={link(props, '/ops/vehicles')}>Vehicles &amp; load limits</a></p>


      <details className="dispatch-details" key={view}><summary>Task details and actions</summary>
      {view === 'routes' ? (
        <StateView state={plan?.computedAt && routes.length > 0 ? { kind: 'ready' } : routesLoad.state} onRetry={routesLoad.retry}>
          <section aria-label="Planned inspection routes" data-part="planned-routes">

            {plan && !['pending', 'refreshing', 'failed'].includes(plan.planStatus ?? 'ready') &&
              routes.length === 0 && dailyUnplanned.length === 0 ?
              <p>No eligible tasks are waiting for this date.</p> : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              {displayedRoutes.map((planned) => {
                const totalStops = planned.waypointOrder.filter((wp) => !wp.isHq).length;
                let completedStops = 0;
                planned.waypointOrder.forEach((wp, idx) => {
                  if (!wp.isHq) {
                    const key = `${selectedDay}:${planned.teamId}-${idx}`;
                    const st = stopOverrides[key] ?? wp.status;
                    if (st === 'Completed') completedStops++;
                  }
                });
                const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
                const hours = Math.floor(planned.totalDurationSeconds / 3600);
                const minutes = Math.round((planned.totalDurationSeconds % 3600) / 60);
                const hasExplicitBaseReturn = planned.waypointOrder.some((wp) => wp.requiresBaseReturn);
                const walkingDistanceMetres = (planned.route.walkingVisits ?? []).reduce((total, visit) =>
                  total + visit.outbound.distanceMetres + visit.return.distanceMetres, 0);
                const drivingDistanceMetres = Math.max(0, planned.route.distanceMetres - walkingDistanceMetres);

                return (
                  <article
                    key={planned.teamId}
                    data-team={planned.teamId}
                    style={{
                      border: `2px solid ${planned.color || '#cbd5e1'}`,
                      borderRadius: '10px',
                      padding: '18px',
                      background: '#ffffff',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    {/* Header: Team & Status */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                        borderBottom: '1px solid #f1f5f9',
                        paddingBottom: '12px',
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '50%',
                            background: planned.color,
                            display: 'inline-block',
                          }}
                        />
                        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>{cleanTitle(planned.teamId, 'Field team')}</h2>
                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#334155',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                          }}
                        >
                          🏢 {cleanTitle(planned.depotLocation, 'Depot')} Depot
                        </span>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Pill
                          tone={
                            planned.status === 'Available'
                              ? 'good'
                              : planned.status === 'OnCall'
                              ? 'neutral'
                              : 'warn'
                          }
                        >
                          {planned.status === 'OnCall'
                            ? `On Call (+${planned.onCallLagHours}h lag)`
                            : planned.status}
                        </Pill>
                        <span
                          style={{
                            background: planned.isWithinFourHourCap ? '#dcfce7' : '#fee2e2',
                            color: planned.isWithinFourHourCap ? '#166534' : '#991b1b',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                          }}
                        >
                          ⏱️ {hours}h {minutes}m / 4h 00m cap ({planned.capacityUsedPercentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Operational Summary */}
                    <span>{planned.staffCount ?? '?'} staff</span>
                    {planned.vehicleId ? (
                      <section aria-label="Assigned vehicle and cargo load">
                        <p><strong title={planned.vehicleRegistration}>{cleanTitle(planned.vehicleName, 'Assigned vehicle')}</strong>{' '}
                          {planned.isDemoVehicle ? <Pill tone="warn">Illustrative capacity</Pill> : null}</p>
                        <p>Payload: {planned.loadWeightKg?.toFixed(1)} / {planned.maxPayloadKg?.toFixed(1)} kg
                          {planned.loadWeightPercentage != null ? ` (${planned.loadWeightPercentage.toFixed(1)}%)` : ''}.
                          {' '}Cargo volume: {planned.loadVolumeM3?.toFixed(3)} / {planned.maxCargoVolumeM3?.toFixed(3)} m³
                          {planned.loadVolumePercentage != null ? ` (${planned.loadVolumePercentage.toFixed(1)}%)` : ''}.</p>
                        {planned.loadBasis ? <span title={planned.loadBasis}>Load basis</span> : null}
                      </section>
                    ) : null}
                    <span title={planned.route.source === 'onemap' ? 'Provider-verified road route' : 'Direct-distance estimate'}>{planned.route.source === 'onemap' ? 'Verified route' : 'Estimated route'}</span>
                    <div
                      style={{
                        display: 'flex',
                        gap: '16px',
                        fontSize: '0.88rem',
                        color: '#475569',
                        marginBottom: '14px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span>📍 <strong>{totalStops}</strong> stops</span>
                      <span>🚗 <strong>{(planned.route.distanceMetres / 1000).toFixed(1)} km</strong> total travel
                        {walkingDistanceMetres > 0 ? ` (${(drivingDistanceMetres / 1000).toFixed(1)} km driving + ${(walkingDistanceMetres / 1000).toFixed(1)} km walking)` : ''}
                        {' '}({Math.round((planned.route.drivingDurationSeconds ?? planned.route.durationSeconds) / 60)} min driving)</span>
                      {(planned.route.walkingDurationSeconds ?? 0) > 0 ? <span>🚶 <strong>{Math.round((planned.route.walkingDurationSeconds ?? 0) / 60)} min</strong> verified walking access and return</span> : null}
                      <span>🛠️ <strong>{Math.round(planned.totalEffortSeconds / 60)} min</strong> on-site effort</span>
                      {planned.onCallLagHours > 0 ? (
                        <span>⏳ <strong>{planned.onCallLagHours}h</strong> mobilization lag</span>
                      ) : null}
                    </div>

                    {/* Only an explicit route instruction adds an intermediate depot return. */}
                    {hasExplicitBaseReturn ? <span className="dispatch-status-chip" title="A route instruction adds the intermediate depot return; vehicle load limits otherwise guide allocation.">Depot return required</span> : null}

                    {/* Progress Bar */}
                    <div style={{ marginBottom: '16px' }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.86rem',
                          fontWeight: 600,
                          marginBottom: '6px',
                        }}
                      >
                        <span>
                          Dispatch Progress: {completedStops} of {totalStops} stops completed
                        </span>
                        <span>{progressPct}%</span>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: '10px',
                          background: '#e2e8f0',
                          borderRadius: '5px',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${progressPct}%`,
                            height: '100%',
                            background:
                              progressPct === 100
                                ? '#16a34a'
                                : `linear-gradient(90deg, ${planned.color || '#2563eb'}, #10b981)`,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                    </div>

                    {/* Waypoint Step Tracker */}
                    <div style={{ marginBottom: '16px' }}>
                      <h3 style={{ fontSize: '0.95rem', marginBottom: '8px', color: '#1e293b' }}>Stops</h3>
                      <ol
                        style={{
                          listStyle: 'none',
                          padding: 0,
                          margin: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        {planned.waypointOrder.map((waypoint, index) => {
                          if (!waypoint.isHq && (!accepts(planned.teamId, waypoint.taskType) || (stopOverrides[`${selectedDay}:${planned.teamId}-${index}`] ?? waypoint.status) === 'Completed')) return null;
                          const overrideKey = `${selectedDay}:${planned.teamId}-${index}`;
                          const currentStatus = stopOverrides[overrideKey] ?? waypoint.status;
                          const isDone = currentStatus === 'Completed';
                          const isInProg = currentStatus === 'InProgress';

                          return (
                            <li
                              key={`${waypoint.label}-${index}`}
                              data-work-order-id={!waypoint.isHq ? waypoint.workOrderId : undefined}
                              data-priority={!waypoint.isHq ? waypoint.priority : undefined}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '8px 12px',
                                background: waypoint.isHq
                                  ? '#f8fafc'
                                  : isDone
                                  ? '#f0fdf4'
                                  : isInProg
                                  ? '#eff6ff'
                                  : '#ffffff',
                                border: `1px solid ${
                                  waypoint.isHq
                                    ? '#e2e8f0'
                                    : isDone
                                    ? '#bbf7d0'
                                    : isInProg
                                    ? '#bfdbfe'
                                    : '#e2e8f0'
                                }`,
                                borderRadius: '6px',
                                fontSize: '0.86rem',
                                flexWrap: 'wrap',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.1rem' }}>
                                  {waypoint.isHq
                                    ? '🏢'
                                    : waypoint.requiresBaseReturn
                                    ? '🐍'
                                    : isDone
                                    ? '✅'
                                    : isInProg
                                    ? '⏳'
                                    : '⚪'}
                                </span>
                                <div>
                                  <img src={taskReferenceImage(waypoint.taskType, waypoint.pestType)} alt="Reference image; not incident evidence" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} />
                                  <strong style={{ color: isDone ? '#166534' : '#0f172a' }}>{stopDisplayName(waypoint)}
                                  </strong>
                                  {!waypoint.isHq ? <small style={{ display: 'block' }}>Reference · {label(waypoint.pestType ?? 'Unknown')} · {label(waypoint.taskType ?? 'Unknown')}</small> : null}
                                  {waypoint.isAreaAccess ? <small style={{ display: 'block', color: '#475569', marginTop: '2px' }} title="Provider-verified road entry inside the authorised service area.">Area access point</small> : null}
                                  {waypoint.priority ? (
                                    <span
                                      style={{
                                        marginLeft: '8px',
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        fontSize: '0.74rem',
                                        fontWeight: 600,
                                        background:
                                          waypoint.priority === 'Critical'
                                            ? '#fee2e2'
                                            : waypoint.priority === 'High'
                                            ? '#ffedd5'
                                            : '#f1f5f9',
                                        color:
                                          waypoint.priority === 'Critical'
                                            ? '#991b1b'
                                            : waypoint.priority === 'High'
                                            ? '#9a3412'
                                            : '#334155',
                                      }}
                                    >
                                      {waypoint.priority} priority
                                    </span>
                                  ) : null}
                                  {waypoint.isDemo ? <span style={{ marginLeft: '8px' }}><Pill tone="warn">DEMO</Pill></span> : null}
                                  {waypoint.estimatedEffortMinutes > 0 ? (
                                    <span style={{ marginLeft: '8px', color: '#64748b', fontSize: '0.78rem' }}>
                                      Effort: {waypoint.estimatedEffortMinutes} mins
                                      {waypoint.requiredStaff ? ` · ${waypoint.requiredStaff} staff required` : ''}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {!waypoint.isHq ? (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button
                                    type="button"
                                    onClick={() => updateStopStatus(planned.teamId, index, 'Completed')}
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '0.75rem',
                                      background: isDone ? '#16a34a' : '#f8fafc',
                                      color: isDone ? '#ffffff' : '#334155',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Done ✓
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateStopStatus(planned.teamId, index, 'InProgress')}
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '0.75rem',
                                      background: isInProg ? '#2563eb' : '#f8fafc',
                                      color: isInProg ? '#ffffff' : '#334155',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    In Progress
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateStopStatus(planned.teamId, index, 'Pending')}
                                    style={{
                                      padding: '3px 8px',
                                      fontSize: '0.75rem',
                                      background: !isDone && !isInProg ? '#64748b' : '#f8fafc',
                                      color: !isDone && !isInProg ? '#ffffff' : '#334155',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                    }}
                                  >
                                    Pending
                                  </button>
                                </div>
                              ) : null}
                            </li>
                          );
                        })}
                      </ol>
                    </div>

                    {/* Logistics Equipment Packing List Toggle */}
                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                      <button
                        type="button"
                        onClick={() => togglePackingList(planned.teamId)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#2563eb',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 0',
                        }}
                      >
                        <span>🎒 Logistics & Equipment Packing List ({planned.packingList?.length ?? 0} items)</span>
                        <span>{activePackingLists[planned.teamId] ? '▲ Hide' : '▼ View checklist'}</span>
                      </button>

                      {activePackingLists[planned.teamId] ? (
                        <div
                          style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '12px',
                            marginTop: '8px',
                          }}
                        >
                          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 10px 0' }}>
                            Verify quantities and cargo dimensions before departure. Provisional item values are labelled below.
                          </p>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                              gap: '8px',
                            }}
                          >
                            {(planned.packingList ?? []).map((item, itemIdx) => {
                              const key = `${planned.teamId}-${itemIdx}-${item.item}`;
                              const isChecked = checkedGear[key] === true;

                              return (
                                <label
                                  key={key}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    background: isChecked ? '#f0fdf4' : '#ffffff',
                                    border: `1px solid ${isChecked ? '#bbf7d0' : '#e2e8f0'}`,
                                    padding: '8px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.82rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleGearItem(key)}
                                    style={{ marginTop: '2px' }}
                                  />
                                  <div>
                                    <span style={{ marginRight: '6px' }}>{item.icon}</span>
                                    <strong style={{ textDecoration: isChecked ? 'line-through' : 'none' }}>
                                      {item.item}
                                    </strong>{' '}
                                    <span style={{ color: '#0369a1', fontWeight: 600 }}>({item.quantity})</span>
                                    <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: '2px' }}>
                                      {item.reason}
                                    </div>
                                    {item.lengthCm != null && item.widthCm != null && item.heightCm != null ? (
                                      <div>Each: {item.lengthCm} × {item.widthCm} × {item.heightCm} cm
                                        {' '}· {item.unitWeightKg?.toFixed(2)} kg.</div>
                                    ) : <div>Dimensions not recorded.</div>}
                                    {item.totalWeightKg != null && item.totalVolumeM3 != null ? (
                                      <div>Load for {item.quantityCount ?? '?'}: {item.totalWeightKg.toFixed(2)} kg
                                        {' '}· {item.totalVolumeM3.toFixed(3)} m³.</div>
                                    ) : null}
                                    {item.isProvisional ? <div><strong>Provisional item values</strong></div> : null}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </StateView>
      ) : view === 'unassigned' ? (
        <StateView state={routesLoad.state} onRetry={routesLoad.retry}>
          <section aria-label="Horizon-wide unassigned and committed tasks" data-part="unassigned-tasks">
            <h2>Tasks unassigned across the {horizon?.days ?? days}-day horizon ({horizonOnlyUnassigned.length})</h2>
            <p>Horizon starts {horizon?.startDate ?? date}.</p>
            {horizonOnlyUnassigned.length === 0 ? <p>No tasks remain unassigned across this horizon.</p> : null}
            <ul data-cards className="dispatch-task-cards">{horizonOnlyUnassigned.map((job) => (
              <li key={job.workOrderId} data-work-order-id={job.workOrderId} data-priority={job.priority} data-disposition="unassigned">
                <img src={taskReferenceImage(job.taskType, job.pestType)} alt="Reference image; not incident evidence" /><strong>{job.priority ?? 'Priority unknown'}: {taskLocation(job.locality, job.point)}</strong>
                <small>Reference · {label(job.pestType ?? 'Unknown')} · {label(job.taskType ?? 'Unknown')}</small>
                {job.isDemo ? <> <Pill tone="warn">DEMO</Pill></> : null}
                {' '}Unassigned{job.scheduledDate ? ` · eligible ${job.scheduledDate}` : ''}.
                {' '}{job.requiredStaff ?? '?'} staff required. <details><summary>Why unassigned</summary><p>{job.reason}</p></details>
                {existingOrderPath(job.workOrderId) ? <> <a href={existingOrderPath(job.workOrderId)} onClick={link(props, existingOrderPath(job.workOrderId)!)}>Review work order</a></> : null}
              </li>
            ))}</ul>
            <h3>Committed work ({horizonCommitted.length})</h3>
            {horizonCommitted.length === 0 ? <p>No committed items are reported for this horizon.</p> : null}
            <ul data-cards className="dispatch-task-cards">{horizonCommitted.map((job) => (
              <li key={job.workOrderId} data-work-order-id={job.workOrderId} data-priority={job.priority} data-disposition="committed">
                <img src={taskReferenceImage(job.taskType, job.pestType)} alt="Reference image; not incident evidence" /><strong>{job.priority ?? 'Priority unknown'}: {taskLocation(job.locality, job.point)}</strong>
                <small>Reference · {label(job.pestType ?? 'Unknown')} · {label(job.taskType ?? 'Unknown')} · {job.teamId ? cleanTitle(job.teamId, 'Field team') : 'Team not recorded'}</small>
                {job.isDemo ? <> <Pill tone="warn">DEMO</Pill></> : null}
                {' '}Committed ({job.status ?? 'existing status'}){job.scheduledDate ? ` · ${job.scheduledDate}` : ''}. <details><summary>Task details</summary><p>{job.reason}</p></details>
                {' '}<a href={`/ops/work-orders/${job.workOrderId}`} onClick={link(props, `/ops/work-orders/${job.workOrderId}`)}>Review work order</a>
              </li>
            ))}</ul>
          </section>
        </StateView>
      ) : (
        <StateView state={state} onRetry={retry}>
          <p aria-live="polite">{totalItems} proposals match this filter.</p>
          <ol data-part="proposals" data-cards className="dispatch-task-cards">
            {pagedItems.map((proposal) => (
              <li key={`${proposal.sourceReportId ?? proposal.clusterId}-${proposal.pestType ?? 'Mosquito'}`} data-tier={proposal.tier} data-priority={proposal.tier} data-task-id={proposal.sourceReportId ?? proposal.clusterId}>
                <img src={taskReferenceImage(proposal.suggestedTaskType, proposal.pestType)} alt="Reference image; not incident evidence" />
                <small>Reference · {label(proposal.pestType ?? 'Mosquito')} · {proposalTeam(proposal) ? `${cleanTitle(proposalTeam(proposal), 'Field team')} (planned)` : 'Unassigned'}</small>
                <div data-part="card-head">
                  <h2>{taskLocation(proposal.locality, proposal.point ?? proposal.mapPoint)}</h2>
                  <Pill tone={tierTone(proposal.tier)} tier={proposal.tier}>
                    {proposal.tier} priority
                  </Pill>
                </div>
                <div data-part="card-meta">
                  <span data-part="score" className="num">
                    {proposal.priorityBasis === 'ReportTriage' ? 'Report triage' : `score ${proposal.score.toFixed(1)}`}
                  </span>
                  <span data-part="task">Suggested: {label(proposal.suggestedTaskType)}</span>
                  <span className="dispatch-suggested-route">
                    {proposal.allowedCapabilities === undefined ? 'Capability data unavailable' : `Crew capability: ${proposal.allowedCapabilities.map(specialisationLabel).join(' or ') || 'No qualified capability recorded'}`}
                  </span>
                </div>
                <div data-part="card-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <a href={proposalFormPath(proposal)} onClick={link(props, proposalFormPath(proposal))}>Raise a work order</a>
                  <a href={proposal.sourceReportId ? `/reports/${proposal.sourceReportId}` : `/ops/clusters/${proposal.clusterId}`}
                    onClick={link(props, proposal.sourceReportId ? `/reports/${proposal.sourceReportId}` : `/ops/clusters/${proposal.clusterId}`)}>
                    Why is this ranked here?
                  </a>
                </div>
              </li>
            ))}
          </ol>

          <Pagination
            currentPage={currentPage}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            itemName="proposals"
          />
        </StateView>
      )}
      </details>
    </section>
  );
}
