/**
 * D-Fence — Dispatch Proposal & Multi-Team Routing (REQUIREMENTS.md 11.2.16).
 * Stereotype: <<boundary>>. Traces: 11.2.16, 8.1.7, 8.1.8, 8.1.11, 8.1.12, 11.4.2.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Backpack, Building2, CalendarDays, Car, Check, ChevronDown, ChevronRight, ChevronUp, Circle, CircleCheck,
  CircleHelp, ClipboardPlus, Clock, ExternalLink, Eye, Filter, Footprints, Hourglass, Inbox, Info, Layers,
  ListChecks, LoaderCircle, MapPin, Navigation, PawPrint, RefreshCw, Route, ShieldCheck, Timer, TriangleAlert,
  Truck, Users, Warehouse, Wrench, X,
} from 'lucide-react';
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
import type { TaskScoreExplanation } from '../../../../src/presentation/TaskScoreExplanation';
import { staffDisplayName, staffPhotoUrl, vehicleLabel } from '../../lib/staffVisuals';
import { DispatchAssignmentEditor, SavedDispatches } from '../../components/DispatchAssignmentEditor';
import { ScoreBreakdown } from '../../components/ScoreBreakdown';

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
    scoreExplanation?: TaskScoreExplanation;
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
  scoreExplanation?: TaskScoreExplanation;
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
    crewMembers?: Array<{ id: string; email: string; displayName?: string | null }>;
    vehicleModel?: string;
    vehiclePhotoUrl?: string;
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
  scoreExplanation?: TaskScoreExplanation;
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

/* Tailwind class sets reused across the pilot screen (T16). Kept as constants so one look stays one string. */
const CONTROL_LABEL = 'inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-quiet';
const CONTROL = 'rounded-xl min-h-11 border border-line bg-surface px-3 text-sm text-ink shadow-xs transition-colors duration-150 hover:border-accent/50 focus:border-accent';
const TAB = 'inline-flex items-center gap-1.5 rounded-full min-h-11 border-transparent bg-transparent px-3 text-sm font-medium text-ink-quiet transition-colors duration-150 hover:bg-surface hover:text-ink aria-pressed:bg-accent-fill aria-pressed:text-white aria-pressed:shadow-sm';
const FILTER_OPTION = 'text-sm transition-colors duration-150 hover:text-accent';
const MAP_SECTION = 'dispatch-map relative mb-3 [&_.map]:relative [&_.map]:mt-0 [&_.map]:overflow-hidden [&_.map]:rounded-2xl [&_.map]:border [&_.map]:border-line [&_.map]:shadow-sm'
  + ' [&_.map-toolbar]:rounded-2xl [&_.map-toolbar]:border [&_.map-toolbar]:border-line [&_.map-toolbar]:bg-surface/80 [&_.map-toolbar]:p-1.5 [&_.map-toolbar]:shadow-lg [&_.map-toolbar]:backdrop-blur-md'
  + ' sm:[&_.map-toolbar]:absolute sm:[&_.map-toolbar]:top-3 sm:[&_.map-toolbar]:right-3 sm:[&_.map-toolbar]:z-[500] sm:[&_.map-toolbar]:mb-0';
const CHIP = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold';
const METRIC = 'inline-flex items-center gap-1.5';
const GHOST_BUTTON = 'inline-flex items-center gap-1.5 rounded-full min-h-11 border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors duration-150 hover:border-accent/50 hover:bg-accent-quiet hover:text-accent';
const STATUS_BUTTON = 'inline-flex items-center gap-1 rounded-full min-h-11 border border-line bg-surface px-2.5 text-xs font-medium text-ink transition-colors duration-150';
const CARD_LIST = '[&>li]:rounded-3xl [&>li]:border [&>li]:border-line [&>li]:shadow-sm [&>li]:transition-shadow [&>li]:duration-200 [&>li]:hover:shadow-md';
const CARD_LINK = 'inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-accent-dark';

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

export function DispatchProposalScreen(props: ScreenProps & { embedded?: boolean }): JSX.Element {
  const today = useMemo(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()), []);
  const [date, setDate] = useState<string>(today);
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [days, setDays] = useState(7);
  const path = `/api/ops/dispatch?date=${encodeURIComponent(selectedDay)}`;
  const { state, value, retry } = useLoad<DispatchPayload>(props.api, path, {
    isEmpty: (v) => !v.proposals?.length,
    emptyMessage:
      'Nothing is proposed for this date. Either every ranked cluster already has an open work order, or no scoring cycle has run.',
  });

  const routesPath = `/api/ops/dispatch/horizon?date=${encodeURIComponent(date)}&days=${days}`;
  const routesLoad = useLoad<HorizonPayload>(props.api, routesPath, {
    // A pending snapshot is a computation state, never an empty task list.
    isEmpty: () => false,
    refreshMs: 3000,
  });

  // Saved dispatches and vehicles name the crew and van of a committed task, which the plan omits.
  const savedLoad = useLoad<{ assignments?: Array<{ teamId: string; crewIds: string[]; vehicleId: string; workOrderIds: string[] }> }>(
    props.api, `/api/ops/dispatch/assignments?date=${encodeURIComponent(selectedDay)}`, { isEmpty: () => false, allowForbidden: true });
  const vehiclesLoad = useLoad<{ vehicles?: Array<{ id: string; model?: string | null; name: string; registration: string }> }>(
    props.api, '/api/ops/vehicles', { isEmpty: () => false, allowForbidden: true });

  const [view, setView] = useState<'proposals' | 'routes' | 'unassigned'>('routes');
  // null means All, while [] deliberately selects nothing. New polling options join All only.
  const [selectedHqs, setSelectedHqs] = useState<string[] | null>(null);
  const [selectedTypes, setSelectedTypes] = useState<string[] | null>(null);
  const [activePackingLists, setActivePackingLists] = useState<Record<string, boolean>>({});
  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});
  const [assignmentNotice, setAssignmentNotice] = useState('');
  // Local stop status overrides for interactive progress tracking
  const [stopOverrides, setStopOverrides] = useState<Record<string, 'Completed' | 'InProgress' | 'Pending'>>({});

  const horizon = routesLoad.value;
  const plan = horizon?.plans?.find((item) => item.date === selectedDay);
  const routes = plan?.routes ?? [];
  const crewLabel = (teamId?: string) => routes.find((route) => route.teamId === teamId)?.crewMembers
    ?.map((member) => staffDisplayName(member.email, 'CleaningCrew', member.displayName)).join(', ');
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
  // Unassigned tasks the manager can add to a dispatch by hand.
  const addableTasks = dailyUnplanned.filter((job) => job.disposition !== 'committed')
    .map((job) => ({ workOrderId: job.workOrderId, label: taskLocation(job.locality, job.point), taskType: job.taskType, pestType: job.pestType }));
  // A proposal alone is not evidence of road access. Only validated road-plan stops belong here.
  const roadRoutes = routes.filter((r) => r.route.source === 'onemap' && isUsableDrivingRoute({
    ...r.route, coordinates: r.route.coordinates.map((p) => new GeoPoint(p.latitude, p.longitude)),
  }, (r.route.drivingStops ?? r.waypointOrder.map((wp) => wp.point)).map((p) => new GeoPoint(p.latitude, p.longitude))));
  const displayedRoutes = roadRoutes.filter((r) => r.waypointOrder.some((wp) => !wp.isHq && accepts(r.teamId, wp.taskType)));

  const mapRoutes: MapRoute[] = displayedRoutes.map((r) => ({
    teamId: r.teamId,
    color: r.color || '#4CC9F0',
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
      sourceReportId: wp.sourceReportId, teamId: route.teamId, teamLabel: crewLabel(route.teamId) || cleanTitle(route.teamId, 'Field team'), assignmentState: 'planned',
      scoreExplanation: wp.scoreExplanation }];
  }));
  const crewById = new Map(horizonRoutes.flatMap((item) => item.crewMembers ?? []).map((member) => [member.id, member]));
  const committedTeam = (workOrderId: string) => {
    const saved = (savedLoad.value?.assignments ?? []).find((item) => item.workOrderIds.includes(workOrderId));
    if (!saved) return undefined;
    const crew = saved.crewIds.map((id) => crewById.get(id)).filter((member) => member !== undefined)
      .map((member) => staffDisplayName(member!.email, 'CleaningCrew', member!.displayName));
    const vehicle = (vehiclesLoad.value?.vehicles ?? []).find((item) => item.id === saved.vehicleId);
    const parts = [crew.length ? crew.join(', ') : cleanTitle(saved.teamId, 'Field team'), vehicle ? vehicleLabel(vehicle) : ''];
    return { teamId: saved.teamId, label: parts.filter(Boolean).join(' · ') };
  };
  const dispositionTasks = horizonUnassigned.map((job) => {
    const committed = job.disposition === 'committed' ? committedTeam(job.workOrderId) : undefined;
    return {
    id: job.workOrderId, point: job.point, pestType: job.pestType, taskType: job.taskType,
    priority: job.priority, location: taskLocation(job.locality, job.point),
    photoUrl: taskReferenceImage(job.taskType, job.pestType), photoIsReference: true,
    sourceReportId: job.sourceReportId ?? job.reportIds?.[0], teamId: job.teamId ?? committed?.teamId,
    scoreExplanation: job.scoreExplanation,
    teamLabel: committed?.label ?? (job.teamId ? cleanTitle(job.teamId, 'Field team') : undefined),
    assignmentState: (job.disposition === 'committed' ? (job.teamId || committed ? 'assigned' : 'unknown') : 'unassigned') as MapTask['assignmentState'],
  }; });
  const proposalTasks = visibleProposals.map((proposal) => ({
    id: `proposal:${proposal.sourceReportId ?? proposal.clusterId}:${proposal.pestType ?? 'Mosquito'}`, point: proposal.point ?? proposal.mapPoint,
    pestType: proposal.pestType ?? 'Mosquito', taskType: proposal.suggestedTaskType, priority: proposal.tier,
    location: taskLocation(proposal.locality, proposal.point ?? proposal.mapPoint), photoUrl: taskReferenceImage(proposal.suggestedTaskType, proposal.pestType),
    photoIsReference: true, sourceReportId: proposal.sourceReportId,
    scoreExplanation: proposal.scoreExplanation,
    teamId: proposalTeam(proposal), teamLabel: proposalTeam(proposal) ? crewLabel(proposalTeam(proposal)) || cleanTitle(proposalTeam(proposal), 'Field team') : undefined,
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
  // A saved work order opens its detail screen; a planned task (report-/prop-/plan-position ids) opens
  // an in-page panel built from the plan data already loaded. Both show the score breakdown.
  const [openedTask, setOpenedTask] = useState<MapTask | null>(null);
  const openTaskDetail = (task: MapTask) => {
    const path = task.id.includes(':') ? undefined : existingOrderPath(task.id);
    if (path) props.onNavigate(path); else setOpenedTask(task);
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
      {props.embedded ? <h2 className="tracking-tight">Dispatch <span data-part="selected-day" className="font-normal text-ink-quiet">{selectedDay}</span></h2>
        : <h1 className="text-2xl font-bold tracking-tight sm:text-[2rem]">Dispatch <span data-part="selected-day" className="font-normal text-ink-quiet">{selectedDay}</span></h1>}
      <div className="mb-4 flex flex-wrap items-end gap-4 rounded-3xl border border-line bg-surface p-5 shadow-sm">
        <div className="flex min-w-40 flex-col gap-1">
          <label htmlFor="date" className={CONTROL_LABEL}>
            <CalendarDays size={14} aria-hidden="true" /> Horizon start:
          </label>
          <input
            id="date"
            type="date"
            className={CONTROL}
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setSelectedDay(event.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <div className="flex min-w-40 flex-col gap-1">
          <label htmlFor="dispatch-day" className={CONTROL_LABEL}><Eye size={14} aria-hidden="true" /> Show day:</label>
          <select id="dispatch-day" className={CONTROL} value={selectedDay} onChange={(event) => { setSelectedDay(event.target.value); setCurrentPage(1); }}>
            {Array.from({ length: days }, (_, offset) => dateOffset(date, offset)).map((day, index) => <option key={day} value={day}>Day {index + 1} · {day}</option>)}
          </select>
        </div>
        <div className="flex min-w-40 flex-col gap-1">
          <label htmlFor="horizon-days" className={CONTROL_LABEL}><Layers size={14} aria-hidden="true" /> Planning horizon:</label>
          <select id="horizon-days" className={CONTROL} value={days} onChange={(event) => { setDays(Number(event.target.value)); setSelectedDay(date); }}>
            {[1, 2, 3, 4, 5, 6, 7].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'day' : 'days'}</option>)}
          </select>
        </div>

        <nav aria-label="Dispatch views" data-part="dispatch-tabs" className="flex flex-wrap gap-1 rounded-full border border-line bg-ground p-1 lg:ml-auto">
          <button type="button" className={TAB} aria-pressed={view === 'routes'} onClick={() => setView('routes')}><Route size={16} aria-hidden="true" />Routes ({roadRoutes.length})</button>
          <button type="button" className={TAB} aria-pressed={view === 'unassigned'} onClick={() => setView('unassigned')}><Inbox size={16} aria-hidden="true" />Unassigned / committed ({horizonOnlyUnassigned.length} / {horizonCommitted.length})</button>
          <button type="button" className={TAB} aria-pressed={view === 'proposals'} onClick={() => setView('proposals')}><ListChecks size={16} aria-hidden="true" />Proposals ({visibleProposals.length})</button>
        </nav>
      </div>
      <div className="dispatch-filters mb-4 flex flex-wrap gap-3">
        {([
          ['HQ', hqOptions, selectedHqs, setSelectedHqs],
          ['Job Type', typeOptions, selectedTypes, setSelectedTypes],
        ] as const).map(([title, options, selection, setSelection]) => (
          <fieldset key={title} data-filter={title === 'HQ' ? 'hq' : 'job-type'}
            className="m-0 flex min-w-0 flex-wrap gap-x-4 gap-y-0 rounded-3xl border border-line bg-surface px-5 pt-1 pb-2 shadow-sm">
            <legend className={`${CONTROL_LABEL} px-1`}><Filter size={14} aria-hidden="true" /> {title}</legend>
            <label className={FILTER_OPTION}><input type="checkbox" checked={selection === null || (options.length > 0 && options.every((option) => selection.includes(option)))}
              onChange={(event) => { setSelection(event.target.checked ? null : []); setCurrentPage(1); }} /> All</label>
            {options.map((option) => <label key={option} className={FILTER_OPTION}><input type="checkbox" value={option}
              checked={selection === null || selection.includes(option)}
              onChange={(event) => { setSelection(event.target.checked ? [...(selection ?? options), option] : (selection ?? options).filter((item) => item !== option)); setCurrentPage(1); }} />
              {option === '__unassigned' ? 'Unassigned / HQ not recorded' : option === '__unknown' ? 'Type not recorded' : label(option)}
            </label>)}
          </fieldset>
        ))}
      </div>
      {assignmentNotice ? <p role="status" data-part="assignment-notice"
        className="flex items-center gap-2 rounded-full border border-accent/30 bg-accent-quiet px-4 py-2 text-sm text-accent"><CircleCheck size={16} aria-hidden="true" />{assignmentNotice}</p> : null}
      <SavedDispatches key={selectedDay} api={props.api} date={selectedDay} candidates={addableTasks}
        onSaved={(result) => { setAssignmentNotice(`Dispatch updated · ${result.workOrderIds.length} tasks. Route, crew and vehicle saved.`); routesLoad.retry(); }} />
      {/*
        The map heading and the map's own toolbar float over the canvas in frosted panels on a wide
        screen. On a phone they stay in the flow above it, where they cannot cover the map.
      */}
      <section className={MAP_SECTION} aria-label="Dispatch map">
        <div className="pointer-events-none mb-2 sm:absolute sm:top-3 sm:left-14 sm:z-[500] sm:mb-0 sm:max-w-[calc(100%-26rem)] sm:rounded-2xl sm:border sm:border-line sm:bg-surface/80 sm:px-4 sm:py-2 sm:shadow-lg sm:backdrop-blur-md">
          <h2 className="m-0 flex flex-wrap items-baseline gap-x-2 text-lg font-semibold tracking-tight" title={view === 'routes' ? 'Full planned route' : undefined}>{view === 'routes' ? 'Routes' : view === 'unassigned' ? 'Horizon tasks' : 'Daily proposals'} <small className="text-xs font-normal text-ink-quiet">{mapTasks.length} locations</small></h2>
          {view !== 'routes' ? <p className="dispatch-map-note m-0 flex items-center gap-1 text-xs text-ink-quiet"><TriangleAlert size={12} aria-hidden="true" />{view === 'proposals' ? 'Candidate locations' : 'Recorded task locations'} · Road access not verified</p> : null}
        </div>
        <SingaporeMap label="dispatch-routes-map" viewKey={photoScope} showClusterBadges={false}
          clusters={[]} routes={view === 'routes' ? mapRoutes : []} tasks={mapTasks} onTaskOpen={openTask} onTaskDetail={openTaskDetail} size="tall"
          onRejectReport={async (id, reason) => { await props.api.post(`/api/ops/moderation/${encodeURIComponent(id)}/reject`, { reason }); routesLoad.retry(); retry(); }} />
        {unavailableTasks.length > 0 ? <p className="dispatch-map-note mt-1 mb-0 text-sm text-ink-quiet">{unavailableTasks.length} locations unavailable</p> : null}
      </section>
      {openedTask === null ? null : (
        <dialog ref={(el) => { if (el && !el.open) el.showModal(); }} data-part="task-detail" aria-label="Task detail" onClose={() => setOpenedTask(null)}
          className="max-w-lg rounded-2xl border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-ground/70 backdrop:backdrop-blur-sm">
          <h2 className="mt-0 tracking-tight">{openedTask.location}</h2>
          <p className="text-sm text-ink-quiet">Pest: {openedTask.pestType ? label(openedTask.pestType) : 'Not recorded'} · Task: {openedTask.taskType ? label(openedTask.taskType) : 'Not recorded'} · Priority: {openedTask.priority ?? 'Not recorded'}</p>
          <p className="text-sm text-ink-quiet">Team: {openedTask.assignmentState === 'unassigned' ? 'Unassigned' : openedTask.teamLabel ?? 'Team not recorded'}{openedTask.assignmentState === 'planned' ? ' (planned)' : ''}</p>
          <ScoreBreakdown explanation={openedTask.scoreExplanation} />
          <button type="button" className={`${GHOST_BUTTON} mt-4`} onClick={() => setOpenedTask(null)}><X size={16} aria-hidden="true" />Close task</button>
        </dialog>
      )}
      <div data-part="dispatch-status" aria-live="polite" className="flex flex-wrap items-center">
        {horizon?.planStatus === 'pending' || plan?.planStatus === 'pending' ? <span className="dispatch-status-chip" role="status" title="Routes are being prepared"><LoaderCircle size={14} className="motion-safe:animate-spin" aria-hidden="true" />Pending</span> : null}
        {horizon?.planStatus === 'refreshing' || plan?.planStatus === 'refreshing' ? <span className="dispatch-status-chip" role="status" title="The previous completed plan remains available"><RefreshCw size={14} className="motion-safe:animate-spin" aria-hidden="true" />Updating</span> : null}
        {horizon?.computedAt ? <span className="dispatch-status-chip" title={horizon.planningDurationSeconds != null ? `Calculation took ${horizon.planningDurationSeconds.toFixed(1)} seconds` : undefined}><Clock size={14} aria-hidden="true" />Updated {new Date(horizon.computedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT</span> : null}
        {horizon?.availabilityAssumption ? <span className="dispatch-status-chip" title={horizon.availabilityAssumption}><Info size={14} aria-hidden="true" />Availability assumed</span> : null}
        {horizon?.planStatus === 'failed' ? <span className="dispatch-status-chip text-tier-high" role="alert" title={horizon.error ?? 'Dispatch calculation failed'}><TriangleAlert size={14} aria-hidden="true" />Failed <button type="button" onClick={routesLoad.retry}>Retry</button></span> : null}
      </div>
      <p><a href="/ops/vehicles" onClick={link(props, '/ops/vehicles')} className="inline-flex items-center gap-1.5 text-sm font-medium no-underline transition-colors hover:text-accent-dark hover:underline"><Truck size={16} aria-hidden="true" />Vehicles &amp; load limits</a></p>


      <details className="dispatch-details group mt-3 border-t border-line" key={view}><summary className="flex cursor-pointer list-none items-center gap-2 py-3 font-semibold tracking-tight transition-colors hover:text-accent [&::-webkit-details-marker]:hidden"><ChevronRight size={16} className="transition-transform duration-200 group-open:rotate-90" aria-hidden="true" />Task details and actions</summary>
      {view === 'routes' ? (
        <StateView state={plan?.computedAt && routes.length > 0 ? { kind: 'ready' } : routesLoad.state} onRetry={routesLoad.retry}>
          <section aria-label="Planned inspection routes" data-part="planned-routes">

            {plan && !['pending', 'refreshing', 'failed'].includes(plan.planStatus ?? 'ready') &&
              routes.length === 0 && dailyUnplanned.length === 0 ?
              <p>No eligible tasks are waiting for this date.</p> : null}
            <div className="grid grid-cols-1 gap-5">
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
                    // The team colour is data, so it stays inline; everything else is a utility.
                    style={{ borderLeftColor: planned.color || 'var(--line)' }}
                    className="rounded-3xl border border-l-4 border-line bg-surface p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-6"
                  >
                    {/* Header: Team & Status */}
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-block size-3 rounded-full ring-2 ring-surface" style={{ background: planned.color }} />
                        <h2 className="m-0 text-xl font-semibold tracking-tight">{cleanTitle(planned.teamId, 'Field team')}</h2>
                        <span className={`${CHIP} bg-accent-quiet text-accent`}>
                          <Building2 size={13} aria-hidden="true" />{cleanTitle(planned.depotLocation, 'Depot')} Depot
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
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
                        <span className={`${CHIP} ${planned.isWithinFourHourCap ? 'bg-tier-low/14 text-tier-low' : 'bg-tier-high/14 text-tier-high'}`}>
                          <Timer size={13} aria-hidden="true" />{hours}h {minutes}m / 4h 00m cap ({planned.capacityUsedPercentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Operational Summary */}
                    <div className="dispatch-crew-members my-2 flex flex-wrap gap-2" data-part="crew-members">
                      {planned.crewMembers?.length ? planned.crewMembers.map((member) => <span key={member.id} data-crew-id={member.id}
                        className="inline-flex items-center gap-2 rounded-full border border-line bg-ground py-1 pr-3 pl-1 text-sm transition-colors hover:border-accent/40">
                        <img src={staffPhotoUrl(member.email, 'CleaningCrew')} alt="Reference portrait" className="size-8 rounded-full object-cover" />
                        {staffDisplayName(member.email, 'CleaningCrew', member.displayName)}
                      </span>) : <span className="inline-flex items-center gap-1.5 text-sm text-ink-quiet"><Users size={14} aria-hidden="true" />{planned.staffCount ?? '?'} staff · names not recorded</span>}
                    </div>
                    <DispatchAssignmentEditor key={`${selectedDay}:${planned.teamId}:${planned.workOrderIds.join(',')}`}
                      api={props.api} date={selectedDay} teamId={planned.teamId}
                      proposedCrewIds={planned.crewMembers?.map((member) => member.id) ?? []} proposedVehicleId={planned.vehicleId}
                      stops={planned.waypointOrder.filter((wp) => !wp.isHq && wp.workOrderId).map((wp) => ({ workOrderId: wp.workOrderId!, label: stopDisplayName(wp) }))}
                      candidates={addableTasks}
                      onAssigned={(result) => { setAssignmentNotice(`Dispatch assigned · ${result.workOrderIds.length} tasks. Crew and vehicle saved.`); routesLoad.retry(); }} />
                    {planned.vehicleId ? (
                      <section aria-label="Assigned vehicle and cargo load" className="my-3 rounded-xl border border-line bg-ground p-4 text-sm">
                        {planned.vehiclePhotoUrl ? <figure className="dispatch-vehicle-photo m-0 mb-2"><img src={planned.vehiclePhotoUrl} alt={`${planned.vehicleModel || 'Vehicle'} reference photo`}
                          className="h-36 w-full max-w-80 rounded-lg object-cover"
                          onError={(event) => { event.currentTarget.hidden = true; }} /><figcaption className="text-xs text-ink-quiet">Model reference photo</figcaption></figure> : null}
                        <p className="m-0 flex flex-wrap items-center gap-2"><Truck size={16} className="text-ink-quiet" aria-hidden="true" /><strong title={planned.vehicleRegistration} className="tracking-tight">{cleanTitle(planned.vehicleModel || planned.vehicleName, 'Assigned vehicle')}</strong>{' '}
                          {planned.isDemoVehicle ? <Pill tone="warn">Illustrative capacity</Pill> : null}</p>
                        <p className="mt-1 mb-0 text-ink-quiet">Payload: {planned.loadWeightKg?.toFixed(1)} / {planned.maxPayloadKg?.toFixed(1)} kg
                          {planned.loadWeightPercentage != null ? ` (${planned.loadWeightPercentage.toFixed(1)}%)` : ''}.
                          {' '}Cargo volume: {planned.loadVolumeM3?.toFixed(3)} / {planned.maxCargoVolumeM3?.toFixed(3)} m³
                          {planned.loadVolumePercentage != null ? ` (${planned.loadVolumePercentage.toFixed(1)}%)` : ''}.</p>
                        {planned.loadBasis ? <span title={planned.loadBasis}>Load basis</span> : null}
                      </section>
                    ) : null}
                    <span className={`${CHIP} mb-3 border border-line text-ink-quiet`} title={planned.route.source === 'onemap' ? 'Provider-verified road route' : 'Direct-distance estimate'}>
                      {planned.route.source === 'onemap' ? <ShieldCheck size={13} aria-hidden="true" /> : <Navigation size={13} aria-hidden="true" />}
                      {planned.route.source === 'onemap' ? 'Verified route' : 'Estimated route'}</span>
                    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-quiet [&_strong]:text-ink">
                      <span className={METRIC}><MapPin size={15} aria-hidden="true" /><span><strong>{totalStops}</strong> stops</span></span>
                      <span className={METRIC}><Car size={15} aria-hidden="true" /><span><strong>{(planned.route.distanceMetres / 1000).toFixed(1)} km</strong> total travel
                        {walkingDistanceMetres > 0 ? ` (${(drivingDistanceMetres / 1000).toFixed(1)} km driving + ${(walkingDistanceMetres / 1000).toFixed(1)} km walking)` : ''}
                        {' '}({Math.round((planned.route.drivingDurationSeconds ?? planned.route.durationSeconds) / 60)} min driving)</span></span>
                      {(planned.route.walkingDurationSeconds ?? 0) > 0 ? <span className={METRIC}><Footprints size={15} aria-hidden="true" /><span><strong>{Math.round((planned.route.walkingDurationSeconds ?? 0) / 60)} min</strong> verified walking access and return</span></span> : null}
                      <span className={METRIC}><Wrench size={15} aria-hidden="true" /><span><strong>{Math.round(planned.totalEffortSeconds / 60)} min</strong> on-site effort</span></span>
                      {planned.onCallLagHours > 0 ? (
                        <span className={METRIC}><Hourglass size={15} aria-hidden="true" /><span><strong>{planned.onCallLagHours}h</strong> mobilization lag</span></span>
                      ) : null}
                    </div>

                    {/* Only an explicit route instruction adds an intermediate depot return. */}
                    {hasExplicitBaseReturn ? <span className="dispatch-status-chip" title="A route instruction adds the intermediate depot return; vehicle load limits otherwise guide allocation."><Warehouse size={14} aria-hidden="true" />Depot return required</span> : null}

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="mb-1.5 flex justify-between text-sm font-semibold">
                        <span>
                          Dispatch Progress: {completedStops} of {totalStops} stops completed
                        </span>
                        <span className="tabular-nums text-ink-quiet">{progressPct}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                        <div
                          className="h-full rounded-full transition-[width] duration-300 ease-out"
                          // Width and team colour are data, so they stay inline.
                          style={{
                            width: `${progressPct}%`,
                            background: progressPct === 100 ? 'var(--tier-low)' : `linear-gradient(90deg, ${planned.color || 'var(--accent)'}, var(--tier-low))`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Waypoint Step Tracker */}
                    <div className="mb-4">
                      <h3 className="mt-0 mb-2 text-sm font-semibold tracking-tight text-ink">Stops</h3>
                      <ol className="m-0 flex list-none flex-col gap-2 p-0">
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
                              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors duration-150 ${
                                waypoint.isHq ? 'border-line bg-ground'
                                  : isDone ? 'border-tier-low/40 bg-tier-low/14'
                                  : isInProg ? 'border-accent/40 bg-accent-quiet'
                                  : 'border-line bg-surface hover:border-accent/40'}`}
                            >
                              <div className="flex min-w-0 items-center gap-2.5">
                                {waypoint.isHq ? <Building2 size={18} className="shrink-0 text-ink-quiet" aria-hidden="true" />
                                  : waypoint.requiresBaseReturn ? <PawPrint size={18} className="shrink-0 text-tier-medium" aria-hidden="true" />
                                  : isDone ? <CircleCheck size={18} className="shrink-0 text-tier-low" aria-hidden="true" />
                                  : isInProg ? <Hourglass size={18} className="shrink-0 text-accent" aria-hidden="true" />
                                  : <Circle size={18} className="shrink-0 text-ink-quiet" aria-hidden="true" />}
                                <div className="min-w-0">
                                  <img src={taskReferenceImage(waypoint.taskType, waypoint.pestType)} alt="Reference image; not incident evidence"
                                    className="mr-2 inline-block size-10 rounded-md object-cover align-middle outline outline-1 -outline-offset-1 outline-white/10" />
                                  <strong className={isDone ? 'text-tier-low' : 'text-ink'}>{stopDisplayName(waypoint)}
                                  </strong>
                                  {!waypoint.isHq ? <small className="block text-xs text-ink-quiet">Reference · {label(waypoint.pestType ?? 'Unknown')} · {label(waypoint.taskType ?? 'Unknown')}</small> : null}
                                  {(() => {
                                    const task = waypoint.isHq ? undefined : routeTasks.find((t) => t.id === (waypoint.workOrderId ?? `${selectedDay}:${planned.teamId}:${index}`));
                                    return task ? <button type="button" data-part="open-task" className={`${GHOST_BUTTON} mt-1 text-xs`} onClick={() => openTaskDetail(task)}><ExternalLink size={14} aria-hidden="true" />Open task</button> : null;
                                  })()}
                                  {waypoint.isAreaAccess ? <small className="mt-0.5 block text-xs text-ink-quiet" title="Provider-verified road entry inside the authorised service area.">Area access point</small> : null}
                                  {waypoint.priority ? (
                                    <span className={`${CHIP} ml-2 ${
                                      waypoint.priority === 'Critical' ? 'bg-tier-high/14 text-tier-high'
                                        : waypoint.priority === 'High' ? 'bg-tier-medium/14 text-tier-medium'
                                        : 'bg-line/60 text-ink-quiet'}`}>
                                      {waypoint.priority} priority
                                    </span>
                                  ) : null}
                                  {waypoint.isDemo ? <span className="ml-2"><Pill tone="warn">DEMO</Pill></span> : null}
                                  {waypoint.estimatedEffortMinutes > 0 ? (
                                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-ink-quiet">
                                      <Timer size={12} aria-hidden="true" />
                                      Effort: {waypoint.estimatedEffortMinutes} mins
                                      {waypoint.requiredStaff ? ` · ${waypoint.requiredStaff} staff required` : ''}
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {!waypoint.isHq ? (
                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    onClick={() => updateStopStatus(planned.teamId, index, 'Completed')}
                                    className={`${STATUS_BUTTON} ${isDone ? 'border-tier-low bg-tier-low text-ground' : 'hover:border-tier-low hover:text-tier-low'}`}
                                  >
                                    <Check size={14} aria-hidden="true" />Done
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateStopStatus(planned.teamId, index, 'InProgress')}
                                    className={`${STATUS_BUTTON} ${isInProg ? 'border-accent-fill bg-accent-fill text-white' : 'hover:border-accent hover:text-accent'}`}
                                  >
                                    In Progress
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => updateStopStatus(planned.teamId, index, 'Pending')}
                                    className={`${STATUS_BUTTON} ${!isDone && !isInProg ? 'border-ink-quiet bg-ink-quiet text-ground' : 'hover:border-ink-quiet hover:text-ink'}`}
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
                    <div className="border-t border-dashed border-line pt-2.5">
                      <button
                        type="button"
                        onClick={() => togglePackingList(planned.teamId)}
                        className="flex items-center gap-1.5 border-0 bg-transparent px-0 text-sm font-semibold text-accent transition-colors hover:text-accent-dark"
                      >
                        <span className="inline-flex items-center gap-1.5"><Backpack size={16} aria-hidden="true" />Logistics & Equipment Packing List ({planned.packingList?.length ?? 0} items)</span>
                        <span className="inline-flex items-center gap-0.5 font-medium text-ink-quiet">{activePackingLists[planned.teamId]
                          ? <><ChevronUp size={14} aria-hidden="true" />Hide</> : <><ChevronDown size={14} aria-hidden="true" />View checklist</>}</span>
                      </button>

                      {activePackingLists[planned.teamId] ? (
                        <div className="mt-2 rounded-xl border border-line bg-ground p-3">
                          <p className="mt-0 mb-2.5 text-xs text-ink-quiet">
                            Verify quantities and cargo dimensions before departure. Provisional item values are labelled below.
                          </p>
                          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))] gap-2">
                            {(planned.packingList ?? []).map((item, itemIdx) => {
                              const key = `${planned.teamId}-${itemIdx}-${item.item}`;
                              const isChecked = checkedGear[key] === true;

                              return (
                                <label
                                  key={key}
                                  className={`flex cursor-pointer items-start gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors duration-150 ${
                                    isChecked ? 'border-tier-low/40 bg-tier-low/14' : 'border-line bg-surface hover:border-accent/40'}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleGearItem(key)}
                                    className="mt-0.5"
                                  />
                                  <div>
                                    <span className="mr-1.5">{item.icon}</span>
                                    <strong className={isChecked ? 'line-through' : ''}>
                                      {item.item}
                                    </strong>{' '}
                                    <span className="font-semibold text-accent">({item.quantity})</span>
                                    <div className="mt-0.5 text-[0.7rem] text-ink-quiet">
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
            <h2 className="tracking-tight">Tasks unassigned across the {horizon?.days ?? days}-day horizon ({horizonOnlyUnassigned.length})</h2>
            <p>Horizon starts {horizon?.startDate ?? date}.</p>
            {horizonOnlyUnassigned.length === 0 ? <p>No tasks remain unassigned across this horizon.</p> : null}
            <ul data-cards className={`dispatch-task-cards ${CARD_LIST}`}>{horizonOnlyUnassigned.map((job) => (
              <li key={job.workOrderId} data-work-order-id={job.workOrderId} data-priority={job.priority} data-disposition="unassigned">
                <img src={taskReferenceImage(job.taskType, job.pestType)} alt="Reference image; not incident evidence" /><strong>{job.priority ?? 'Priority unknown'}: {taskLocation(job.locality, job.point)}</strong>
                <small>Reference · {label(job.pestType ?? 'Unknown')} · {label(job.taskType ?? 'Unknown')}</small>
                {job.isDemo ? <> <Pill tone="warn">DEMO</Pill></> : null}
                {' '}Unassigned{job.scheduledDate ? ` · eligible ${job.scheduledDate}` : ''}.
                {' '}{job.requiredStaff ?? '?'} staff required. <details><summary>Why unassigned</summary><p>{job.reason}</p></details>
                {existingOrderPath(job.workOrderId) ? <> <a href={existingOrderPath(job.workOrderId)} onClick={link(props, existingOrderPath(job.workOrderId)!)}>Review work order</a></> : null}
              </li>
            ))}</ul>
            <h3 className="tracking-tight">Committed work ({horizonCommitted.length})</h3>
            {horizonCommitted.length === 0 ? <p>No committed items are reported for this horizon.</p> : null}
            <ul data-cards className={`dispatch-task-cards ${CARD_LIST}`}>{horizonCommitted.map((job) => (
              <li key={job.workOrderId} data-work-order-id={job.workOrderId} data-priority={job.priority} data-disposition="committed">
                <img src={taskReferenceImage(job.taskType, job.pestType)} alt="Reference image; not incident evidence" /><strong>{job.priority ?? 'Priority unknown'}: {taskLocation(job.locality, job.point)}</strong>
                <small>Reference · {label(job.pestType ?? 'Unknown')} · {label(job.taskType ?? 'Unknown')} · {committedTeam(job.workOrderId)?.label ?? (job.teamId ? cleanTitle(job.teamId, 'Field team') : 'Team not recorded')}</small>
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
          <ol data-part="proposals" data-cards className={`dispatch-task-cards ${CARD_LIST}`}>
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
                <div data-part="card-actions" className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <a href={proposalFormPath(proposal)} onClick={link(props, proposalFormPath(proposal))} className={CARD_LINK}><ClipboardPlus size={14} aria-hidden="true" />Raise a work order</a>
                  <a href={proposal.sourceReportId ? `/reports/${proposal.sourceReportId}` : `/ops/clusters/${proposal.clusterId}`}
                    onClick={link(props, proposal.sourceReportId ? `/reports/${proposal.sourceReportId}` : `/ops/clusters/${proposal.clusterId}`)} className={CARD_LINK}>
                    <CircleHelp size={14} aria-hidden="true" />Why is this ranked here?
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
