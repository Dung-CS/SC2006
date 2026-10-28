/**
 * D-Fence — Dispatch Proposal & Multi-Team Routing (REQUIREMENTS.md 11.2.16).
 * Stereotype: <<boundary>>. Traces: 11.2.16, 8.1.7, 8.1.8, 8.1.11, 8.1.12, 11.4.2.
 */
import { useState } from 'react';
import { useLoad } from '../../lib/useLoad';
import { StateView } from '../../components/States';
import { link } from '../../components/Link';
import { Pill, tierTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { Pagination, usePagination } from '../../components/Pagination';
import { specialisationLabel } from '../../lib/dispatchRouting';
import { coveringSpecialisations } from '../../../../src/control/StaffRoutingPolicy';
import { PestClass, TaskType } from '../../../../src/entity/enums';
import { SingaporeMap, MapCluster, MapRoute } from '../../components/SingaporeMap';
import { ScreenProps } from '../ScreenProps';
import { isUsableDrivingRoute } from '../../../../src/boundary/gateways/OneMapGateway';
import { GeoPoint } from '../../../../src/entity/valueTypes';
import type { DispatchReferral } from '../../../../src/control/DispatchRouteInputs';

interface DispatchPayload {
  date: string;
  proposals: Array<{
    clusterId: string;
    mapClusterId?: string;
    sourceReportId?: string;
    point?: { latitude: number; longitude: number };
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
  workOrderId?: string;
  clusterId?: string | null;
  sourceReportId?: string;
  mapClusterId?: string;
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
  cumulativeDurationSeconds: number;
}

interface PlannedRoutesPayload {
  date: string;
  planStatus?: 'pending' | 'refreshing' | 'ready' | 'failed';
  computedAt?: string | null;
  planningDurationSeconds?: number | null;
  error?: string | null;
  referrals?: DispatchReferral[];
  unplanned?: Array<{ workOrderId: string; locality?: string; priority?: string; requiredStaff?: number; reason: string }>;
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

interface MapLayersPayload {
  clusters: MapCluster[];
}

function proposalFormPath(proposal: DispatchPayload['proposals'][number]): string {
  const query = new URLSearchParams({ taskType: proposal.suggestedTaskType,
    date: proposal.scheduledDate, pestType: proposal.pestType ?? 'Mosquito' });
  query.set(proposal.sourceReportId ? 'sourceReportId' : 'clusterId', proposal.sourceReportId ?? proposal.clusterId);
  return `/ops/work-orders/new?${query}`;
}

function proposalMapId(proposal: DispatchPayload['proposals'][number]): string {
  return proposal.mapClusterId ?? (proposal.sourceReportId ? `pest-${proposal.sourceReportId}` : proposal.clusterId);
}

export function DispatchProposalScreen(props: ScreenProps): JSX.Element {
  const [date, setDate] = useState<string>('');
  const path = date === '' ? '/api/ops/dispatch' : `/api/ops/dispatch?date=${encodeURIComponent(date)}`;
  const { state, value, retry } = useLoad<DispatchPayload>(props.api, path, {
    isEmpty: (v) => v.proposals.length === 0,
    emptyMessage:
      'Nothing is proposed for this date. Either every ranked cluster already has an open work order, or no scoring cycle has run.',
  });

  const routesPath =
    date === '' ? '/api/ops/dispatch/routes' : `/api/ops/dispatch/routes?date=${encodeURIComponent(date)}`;
  const routesLoad = useLoad<PlannedRoutesPayload>(props.api, routesPath, {
    // A pending snapshot is a computation state, never an empty task list.
    isEmpty: () => false,
    refreshMs: 3000,
  });

  const layersLoad = useLoad<MapLayersPayload>(props.api, '/api/map/layers');

  const [view, setView] = useState<'proposals' | 'routes'>('proposals');
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [activePackingLists, setActivePackingLists] = useState<Record<string, boolean>>({});
  const [checkedGear, setCheckedGear] = useState<Record<string, boolean>>({});
  // Local stop status overrides for interactive progress tracking
  const [stopOverrides, setStopOverrides] = useState<Record<string, 'Completed' | 'InProgress' | 'Pending'>>({});

  const { currentPage, setCurrentPage, pageSize, totalItems, pagedItems } = usePagination(
    value?.proposals ?? [],
    10,
  );

  const routes = routesLoad.value?.routes ?? [];
  const plan = routesLoad.value;
  const referrals = plan?.referrals ?? [];
  const allClusters = layersLoad.value?.clusters ?? [];
  // A proposal alone is not evidence of road access. Only validated road-plan stops belong here.
  const roadRoutes = routes.filter((r) => r.route.source === 'onemap' && isUsableDrivingRoute({
    ...r.route, coordinates: r.route.coordinates.map((p) => new GeoPoint(p.latitude, p.longitude)),
  }, r.waypointOrder.map((wp) => new GeoPoint(wp.point.latitude, wp.point.longitude))));
  const displayedRoutes = roadRoutes.filter((r) => selectedTeam === '' || r.teamId === selectedTeam);
  const roadClusterIds = new Set(displayedRoutes.flatMap((r) => r.waypointOrder
    .flatMap((wp, idx) => !wp.isHq && (stopOverrides[`${r.teamId}-${idx}`] ?? wp.status) !== 'Completed'
      ? [wp.mapClusterId ?? wp.clusterId] : [])));
  const displayedClusters = allClusters.filter((c) => roadClusterIds.has(c.clusterId));

  const mapRoutes: MapRoute[] = displayedRoutes.map((r) => ({
    teamId: r.teamId,
    color: r.color || '#2563EB',
    label: `${r.totalStopsCount} stops · ${Math.round(r.totalDurationSeconds / 60)}m`,
    coordinates: r.route.coordinates,
    waypoints: r.waypointOrder.flatMap((wp, idx) => {
      const overrideKey = `${r.teamId}-${idx}`;
      const effectiveStatus = stopOverrides[overrideKey] ?? wp.status;
      if (!wp.isHq && effectiveStatus === 'Completed') return [];
      return [{
        label: wp.label,
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

  const togglePackingList = (teamId: string) => {
    setActivePackingLists((prev) => ({ ...prev, [teamId]: !prev[teamId] }));
  };

  const toggleGearItem = (key: string) => {
    setCheckedGear((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateStopStatus = (teamId: string, idx: number, status: 'Completed' | 'InProgress' | 'Pending') => {
    const key = `${teamId}-${idx}`;
    setStopOverrides((prev) => ({ ...prev, [key]: status }));
  };

  return (
    <section data-screen="DispatchProposal" data-requirement="11.2.16">
      <h1>Dispatch for {value?.date ?? 'today'}</h1>
      <p>
        Precomputed routes cover eligible pest tasks in priority order. Each crew must fit its vehicle's seats,
        weight and cargo limits within a four-hour shift.
      </p>
      <p><a href="/ops/vehicles" onClick={link(props, '/ops/vehicles')}>Manage HQ vehicles and load limits</a></p>
      {plan?.planStatus === 'pending' ? (
        <p role="status">Preparing the first dispatch plan in the background. Routes will appear here when ready.</p>
      ) : null}
      {plan?.planStatus === 'refreshing' ? (
        <p role="status">Updating the dispatch plan in the background. The last completed plan remains visible.</p>
      ) : null}
      {plan?.computedAt ? <p>Last plan computed: {new Date(plan.computedAt).toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT
        {plan.planningDurationSeconds != null ? ` · calculation ${plan.planningDurationSeconds.toFixed(1)} seconds` : ''}.</p> : null}
      {plan?.planStatus === 'failed' ? (
        <div role="alert"><p>{plan.error ?? 'The latest dispatch calculation failed.'} The last completed plan, if available, remains visible.</p>
          <button type="button" onClick={routesLoad.retry}>Try again</button></div>
      ) : null}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div>
          <label htmlFor="date" style={{ marginRight: '8px', fontWeight: 600 }}>
            Show another date:
          </label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <nav aria-label="Dispatch views" data-part="dispatch-tabs">
          <button
            type="button"
            aria-pressed={view === 'routes'}
            onClick={() => setView('routes')}
            style={{ fontWeight: view === 'routes' ? 'bold' : 'normal', padding: '6px 14px' }}
          >
            🗺️ Planned Multi-Team Routes ({routes.length} Teams)
          </button>
          <button
            type="button"
            aria-pressed={view === 'proposals'}
            onClick={() => setView('proposals')}
            style={{ fontWeight: view === 'proposals' ? 'bold' : 'normal', padding: '6px 14px' }}
          >
            📋 Daily Proposals List ({value?.proposals.length ?? 0})
          </button>
        </nav>
      </div>

      {/* Interactive Singapore Map with Multi-Team Routes and Clusters */}
      <section style={{ marginBottom: '24px' }} aria-label="Dispatch Route Map">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
          <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Active Clusters & Multi-Team Road Routes</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <label htmlFor="dispatch-map-team">Map team:</label>
            <select id="dispatch-map-team" value={selectedTeam} onChange={(event) => {
              setSelectedTeam(event.target.value);
              setSelectedClusterId(null);
            }}>
              <option value="">All road-accessible teams</option>
              {roadRoutes.map((r) => <option key={r.teamId} value={r.teamId}>Team {r.teamId}</option>)}
            </select>
            {selectedClusterId ? (
              <button
                type="button"
                onClick={() => setSelectedClusterId(null)}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.82rem',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: '#f1f5f9',
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                Reset Map Focus
              </button>
            ) : null}
          </div>
        </div>
        <p>Only tasks on verified driving routes are shown. Completed stop markers and duplicate cluster icons are hidden.
          {' '}Choose one team to see fewer routes. Tasks without verified road access remain in the list.</p>
        <SingaporeMap
          label="dispatch-routes-map"
          viewKey={`${date}:${selectedTeam}`}
          showClusterBadges={false}
          clusters={displayedClusters}
          routes={mapRoutes}
          selectedClusterId={selectedClusterId}
          onSelectCluster={(id) => setSelectedClusterId((prev) => (prev === id ? null : id))}
          size="tall"
        />
      </section>

      {view === 'routes' ? (
        <StateView state={plan?.computedAt && routes.length > 0 ? { kind: 'ready' } : routesLoad.state} onRetry={routesLoad.retry}>
          <section aria-label="Planned inspection routes" data-part="planned-routes">
            <p>Allocate Critical, High, Medium, then Low tasks using qualified staff and remaining shift time. Route plans do not assign work orders.</p>
            <p>Provisional crew sizes: Inspection 1; Larviciding 2; Fogging 3; Drain clearance 2; Refuse clearance 2.</p>
            {plan && !['pending', 'refreshing', 'failed'].includes(plan.planStatus ?? 'ready') &&
              routes.length === 0 && (plan.unplanned?.length ?? 0) === 0 && referrals.length === 0 ?
              <p>No eligible tasks are waiting for this date.</p> : null}
            {(routesLoad.value?.unplanned?.length ?? 0) > 0 ? (
              <section aria-label="Unplanned tasks">
                <h2>Tasks without a route ({routesLoad.value?.unplanned?.length})</h2>
                <ul>{routesLoad.value?.unplanned?.map((job) => (
                  <li key={job.workOrderId}><strong>{job.priority}: {job.locality ?? job.workOrderId}</strong>
                    {' '}{job.requiredStaff ?? '?'} staff required. {job.reason}</li>
                ))}</ul>
              </section>
            ) : null}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
              {routes.map((planned) => {
                const totalStops = planned.waypointOrder.filter((wp) => !wp.isHq).length;
                let completedStops = 0;
                planned.waypointOrder.forEach((wp, idx) => {
                  if (!wp.isHq) {
                    const key = `${planned.teamId}-${idx}`;
                    const st = stopOverrides[key] ?? wp.status;
                    if (st === 'Completed') completedStops++;
                  }
                });
                const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
                const hours = Math.floor(planned.totalDurationSeconds / 3600);
                const minutes = Math.round((planned.totalDurationSeconds % 3600) / 60);
                const hasExplicitBaseReturn = planned.waypointOrder.some((wp) => wp.requiresBaseReturn);

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
                        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Team {planned.teamId}</h2>
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
                          🏢 {planned.depotLocation} Depot
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
                    <p><strong>{planned.staffCount ?? 1} staff</strong> reserved for this route.</p>
                    {planned.vehicleId ? (
                      <section aria-label="Assigned vehicle and cargo load">
                        <p><strong>{planned.vehicleName} · {planned.vehicleRegistration}</strong>{' '}
                          {planned.isDemoVehicle ? <Pill tone="warn">Demo vehicle — illustrative capacity</Pill> : null}</p>
                        <p>Payload: {planned.loadWeightKg?.toFixed(1)} / {planned.maxPayloadKg?.toFixed(1)} kg
                          {planned.loadWeightPercentage != null ? ` (${planned.loadWeightPercentage.toFixed(1)}%)` : ''}.
                          {' '}Cargo volume: {planned.loadVolumeM3?.toFixed(3)} / {planned.maxCargoVolumeM3?.toFixed(3)} m³
                          {planned.loadVolumePercentage != null ? ` (${planned.loadVolumePercentage.toFixed(1)}%)` : ''}.</p>
                        {planned.loadBasis ? <p>{planned.loadBasis}</p> : null}
                      </section>
                    ) : null}
                    <p>Travel source: {planned.route.source === 'onemap' ? 'OneMap road route' : 'Direct-distance estimate'}.</p>
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
                      <span>🚗 <strong>{(planned.route.distanceMetres / 1000).toFixed(1)} km</strong> travel ({Math.round(planned.totalTravelSeconds / 60)} min drive)</span>
                      <span>🛠️ <strong>{Math.round(planned.totalEffortSeconds / 60)} min</strong> on-site effort</span>
                      {planned.onCallLagHours > 0 ? (
                        <span>⏳ <strong>{planned.onCallLagHours}h</strong> mobilization lag</span>
                      ) : null}
                    </div>

                    {/* Only an explicit route instruction adds an intermediate depot return. */}
                    {hasExplicitBaseReturn ? (
                      <div
                        style={{
                          background: '#fffbeb',
                          border: '1.5px solid #fef08a',
                          padding: '10px 14px',
                          borderRadius: '6px',
                          color: '#854d0e',
                          marginBottom: '14px',
                          fontSize: '0.88rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                        <span>
                          <strong>Explicit depot-return instruction:</strong> This plan includes an instructed
                          intermediate return. Task type alone does not mandate a return; vehicle load limits govern allocation.
                        </span>
                      </div>
                    ) : null}

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
                      <h3 style={{ fontSize: '0.95rem', marginBottom: '8px', color: '#1e293b' }}>
                        Waypoint Route Execution
                      </h3>
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
                          const overrideKey = `${planned.teamId}-${index}`;
                          const currentStatus = stopOverrides[overrideKey] ?? waypoint.status;
                          const isDone = currentStatus === 'Completed';
                          const isInProg = currentStatus === 'InProgress';

                          return (
                            <li
                              key={`${waypoint.label}-${index}`}
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
                                  <strong style={{ color: isDone ? '#166534' : '#0f172a' }}>
                                    {waypoint.label}
                                  </strong>
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
      ) : (
        <StateView state={state} onRetry={retry}>
          <ol data-part="proposals" data-cards>
            {pagedItems.map((proposal) => (
              <li key={`${proposal.sourceReportId ?? proposal.clusterId}-${proposal.pestType ?? 'Mosquito'}`} data-tier={proposal.tier}>
                <div data-part="card-head">
                  <h2>{proposal.locality}{proposal.pestType ? ` · ${label(proposal.pestType)}` : ''}</h2>
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
                    {proposal.referralAuthority ? `External authority: ${proposal.referralAuthority}` : <>Crew capability:{' '}
                    {(proposal.allowedCapabilities ?? coveringSpecialisations(proposal.suggestedTaskType as TaskType, PestClass.VectorBorne))
                      .map(specialisationLabel)
                      .join(' or ') || 'none recorded covers this task'}</>}
                  </span>
                </div>
                <div data-part="card-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {roadClusterIds.has(proposalMapId(proposal)) ? <button
                    type="button"
                    onClick={() => {
                      setSelectedClusterId(proposalMapId(proposal));
                      window.scrollTo({ top: 160, behavior: 'smooth' });
                    }}
                    style={{
                      background: selectedClusterId === proposalMapId(proposal) ? '#2563eb' : '#f8fafc',
                      color: selectedClusterId === proposalMapId(proposal) ? '#ffffff' : '#1e293b',
                      border: `1px solid ${selectedClusterId === proposalMapId(proposal) ? '#1d4ed8' : '#cbd5e1'}`,
                      borderRadius: '4px',
                      padding: '4px 10px',
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    📍 Show on map
                  </button> : <span>Not on the current road-route map</span>}
                  {proposal.referralAuthority ? (
                    proposal.sourceReportId ? <a href={`/ops/referrals/${proposal.sourceReportId}`}
                      onClick={link(props, `/ops/referrals/${proposal.sourceReportId}`)}>Review referral</a> : null
                  ) : (
                    <a href={proposalFormPath(proposal)} onClick={link(props, proposalFormPath(proposal))}>Raise a work order</a>
                  )}
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
    </section>
  );
}
