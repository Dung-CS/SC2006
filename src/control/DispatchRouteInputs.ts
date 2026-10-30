import { Account } from '../entity/Account';
import { cleanTitle } from '../presentation/DisplayNames';
import { Cluster } from '../entity/Cluster';
import { PestProfile } from '../entity/PestProfile';
import { WorkOrder } from '../entity/WorkOrder';
import { Report } from '../entity/Report';
import { PriorityScore } from '../entity/PriorityScore';
import { HqLocation, PestType, PriorityTier, Role, StaffStatus, TaskType, WorkOrderStatus } from '../entity/enums';
import { GeoPoint } from '../entity/valueTypes';
import { DispatchProposal } from './DispatchController';
import { taskForReport, triageForReport } from './ReportTriagePolicy';
import { RouteTeam, estimateRequiredStaff } from './RouteOptimizationService';
import { composeTaskScoreExplanation, highestReportTriage, storedLocalityScore } from '../presentation/TaskScoreExplanation';
import type { TaskScoreExplanation } from '../presentation/TaskScoreExplanation';
import { coveringSpecialisations, pestClassOf, permittedTasksFor, primarySpecialisation } from './StaffRoutingPolicy';
import { ReportGroupProvenance, groupNearbyReports, isPendingOrder, ordersForReportGroup, reportGroupProvenance } from './ReportSpatialClustering';
import type { DispatchJob } from './DispatchPlanService';

export const HQ_COORDINATES: Record<HqLocation, GeoPoint> = {
  Central: new GeoPoint(1.318, 103.847),
  NorthEast: new GeoPoint(1.37, 103.88),
  NorthWest: new GeoPoint(1.43, 103.785),
  SouthEast: new GeoPoint(1.32, 103.925),
  SouthWest: new GeoPoint(1.335, 103.743),
};

export interface DispatchReferral {
  reportIds?: ReportGroupProvenance['reportIds'];
  reportCount?: number;
  individualCounts?: ReportGroupProvenance['individualCounts'];
  reportId?: string;
  workOrderId?: string;
  clusterId?: string;
  pestType: string;
  priority: string;
  locality: string;
  authority: string;
  reason: string;
}

export interface DispatchInputs {
  teams: RouteTeam[];
  jobs: DispatchJob[];
  referrals: DispatchReferral[];
}

const tierRank: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
const higherPriority = (...tiers: Array<string | undefined>): PriorityTier =>
  tiers.filter((tier): tier is string => tier !== undefined)
    .sort((a, b) => (tierRank[a] ?? 3) - (tierRank[b] ?? 3))[0] as PriorityTier || PriorityTier.Medium;
const validPoint = (point?: GeoPoint | null): point is GeoPoint => Boolean(point &&
  Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
const demoEvidence = (text?: string): boolean => /^\[DEMO(?:\s|\])/.test(text ?? '');

/** Build planning inputs from real records; missing staff or locations create no synthetic work. */
export function buildDispatchRouteInputs(input: {
  date: string;
  crew: Account[];
  orders: WorkOrder[];
  clusters: Cluster[];
  proposals: DispatchProposal[];
  profiles: ReadonlyMap<PestType, PestProfile>;
  reports?: Report[];
  scores?: PriorityScore[];
  reportClusterDistanceMetres?: number;
}): DispatchInputs {
  const pools = new Map<string, RouteTeam>();
  const committedAssignees = new Set(input.orders.filter((order) => (order.dispatchAssignmentId ? order.scheduledDate === input.date : order.scheduledDate <= input.date) &&
    [WorkOrderStatus.Assigned, WorkOrderStatus.Accepted, WorkOrderStatus.InProgress, WorkOrderStatus.Rejected].includes(order.currentStatus()) && order.assigneeId)
    .flatMap((order) => [order.assigneeId!, ...order.assignedCrewIds]));
  for (const member of input.crew) {
    if (!member.isActive || member.role !== Role.CleaningCrew || !member.specialisation || !member.hqLocation) continue;
    if (member.staffStatus !== StaffStatus.Available && member.staffStatus !== StaffStatus.OnCall) continue;
    // A known committed assignee cannot also appear as free capacity. WorkOrder has no reliable
    // supporting-crew count, so reserve only the explicitly identified assignee.
    if (committedAssignees.has(member.id)) continue;
    const lag = member.staffStatus === StaffStatus.OnCall ? member.onCallLagHours : 0;
    if (!Number.isFinite(lag) || lag < 0) continue;
    const teamId = `${member.hqLocation}-${member.specialisation}-${member.staffStatus}${lag ? `-${lag}h` : ''}`;
    const pool = pools.get(teamId);
    const identity = { id: member.id, email: member.email, displayName: member.displayName };
    if (pool) { pool.staffCount = (pool.staffCount ?? 0) + 1; pool.staffMembers!.push(identity); }
    else pools.set(teamId, {
      teamId, hq: HQ_COORDINATES[member.hqLocation], capabilities: [member.specialisation],
      status: member.staffStatus, onCallLagHours: lag, staffCount: 1,
      staffMembers: [identity],
    });
  }

  for (const pool of pools.values()) pool.staffMembers?.sort((a, b) => a.id.localeCompare(b.id));
  const clusters = new Map(input.clusters.map((c) => [c.id, c]));
  const reports = new Map((input.reports ?? []).filter((report) => report.isVerified()).map((r) => [r.id, r]));
  const liveOrders = input.orders.filter(isPendingOrder);
  const groups = groupNearbyReports(input.reports ?? [], input.reportClusterDistanceMetres, input.orders, input.scores);
  const groupByReport = new Map(groups.flatMap((group) => group.reportIds.map((id) => [id, group] as const)));
  const representedReports = new Set(liveOrders.flatMap((order) => order.sourceReportId ? [order.sourceReportId] : []));
  const scoreFor = (clusterId: string | null | undefined, pest: PestType) =>
    (input.scores ?? []).find((score) => (score.clusterId === clusterId || score.localityId === clusterId) &&
      (score.pestType ?? PestType.Mosquito) === pest);
  const explanationFor = (localityId: string | null | undefined, pest: string | null | undefined,
    relevantReports: readonly Report[], workOrderPriority?: string): TaskScoreExplanation | undefined =>
    composeTaskScoreExplanation({ workOrderPriority,
      reportTriage: highestReportTriage(relevantReports.map((report) => triageForReport(report))),
      localityScore: storedLocalityScore(input.scores ?? [], localityId, pest) });
  const jobs: DispatchJob[] = [];
  const referrals: DispatchReferral[] = [];
  const reportTargets = new Set<string>();
  const addJob = (job: Omit<DispatchJob, 'requiredCapability'>, pest: PestType): void => {
    const profile = input.profiles.get(pest) ?? null;
    if (!permittedTasksFor(pest, profile).includes(job.taskType as TaskType)) return;
    const pestClass = pestClassOf(pest, profile);
    const allowedCapabilities = coveringSpecialisations(job.taskType as TaskType, pestClass, pest, profile);
    const preferred = primarySpecialisation(job.taskType as TaskType, pestClass, pest, profile);
    if (allowedCapabilities.length === 0 || jobs.some((j) => j.workOrderId === job.workOrderId)) return;
    jobs.push({ ...job, requiredCapability: preferred ?? allowedCapabilities[0]!, allowedCapabilities,
      requiredStaff: estimateRequiredStaff(job.taskType, pest) });
  };

  for (const order of liveOrders) {
    if (order.scheduledDate > input.date || order.pestType === null) continue;
    const source = order.sourceReportId ? reports.get(order.sourceReportId) : undefined;
    const linkedReports = [...reports.values()].filter((r) => r.workOrderId === order.id || r.id === order.sourceReportId ||
      (!order.sourceReportId && order.taskType === taskForReport(r) && order.clusterId !== null && r.clusterId === order.clusterId && r.pestType === order.pestType));
    const targetReport = source ?? linkedReports.sort((a, b) =>
      (tierRank[triageForReport(a).priority] ?? 2) - (tierRank[triageForReport(b).priority] ?? 2))[0];
    const group = targetReport ? groupByReport.get(targetReport.id) : undefined;
    const cluster = order.clusterId ? clusters.get(order.clusterId) : undefined;
    const point = source?.point ?? order.targetPoint ?? targetReport?.point ?? (cluster?.boundary?.rings[0]?.length ? cluster.boundary.centroid() : undefined);
    if (!validPoint(point)) continue;
    const score = scoreFor(order.clusterId, order.pestType);
    const scoreExplanation = explanationFor(order.clusterId, order.pestType, group?.reports ?? linkedReports, order.priority);
    addJob({ workOrderId: order.id, point, taskType: order.taskType, pestType: order.pestType,
      ...(!order.sourceReportId && !targetReport && !order.targetPoint && cluster?.boundary?.rings[0]?.length
        ? { serviceArea: cluster.boundary } : {}),
      isDemo: demoEvidence(order.instructions) || demoEvidence(source?.description ?? targetReport?.description),
      clusterId: order.clusterId, sourceReportId: order.sourceReportId ?? undefined,
      ...(group ? reportGroupProvenance(group) : {}),
      mapClusterId: group?.id ?? (targetReport ? `pest-${targetReport.id}` : order.pestType !== PestType.Mosquito && score ?
        `inat-${score.clusterId}-${order.pestType}` : order.clusterId ?? undefined),
      priority: higherPriority(order.priority, score?.tier, group?.priority, ...linkedReports.map((r) => triageForReport(r).priority)),
      ...(scoreExplanation ? { scoreExplanation } : {}),
      locality: cleanTitle(order.location ?? source?.localityBinding ?? cluster?.locality, 'Unassigned'), status: order.currentStatus(), scheduledDate: order.scheduledDate,
      score: score?.score }, order.pestType);
  }

  // Reports are operational targets even when no dengue locality score exists for them.
  for (const group of groups) {
    if (ordersForReportGroup(group, input.orders).length > 0) continue;
    const report = group.representative;
    const taskType = taskForReport(report);
    const priority = group.priority;
    const scoreExplanation = explanationFor(report.clusterId, report.pestType, group.reports);
    addJob({ workOrderId: `report-${report.id}`, sourceReportId: report.id, clusterId: report.clusterId,
      isDemo: demoEvidence(report.description),
      ...reportGroupProvenance(group), mapClusterId: group.id, point: report.point, taskType, pestType: report.pestType,
      priority, ...(scoreExplanation ? { scoreExplanation } : {}),
      locality: cleanTitle(report.localityBinding, 'Unassigned'), status: 'Pending', scheduledDate: input.date }, report.pestType);
    for (const member of group.reports) if (member.clusterId) reportTargets.add(`${member.clusterId}:${member.pestType}:${taskType}`);
  }

  for (const proposal of input.proposals) {
    const pest = proposal.pestType ?? PestType.Mosquito;
    // Non-mosquito work needs a verified source report. A score-only proposal can
    // otherwise bypass proposeDailyList when this builder is called independently.
    if (pest !== PestType.Mosquito && !proposal.sourceReportId) continue;
    const source = proposal.sourceReportId ? reports.get(proposal.sourceReportId) : undefined;
    if (proposal.sourceReportId && (!source || source.pestType !== pest || !validPoint(source.point))) continue;
    if (proposal.sourceReportId) {
      // Avoid repeating report groups or existing work orders.
      const ids = proposal.reportIds ?? [proposal.sourceReportId];
      if (ids.some((id) => representedReports.has(id) || jobs.some((j) => j.sourceReportId === id || j.reportIds?.includes(id)) ||
          referrals.some((r) => r.reportId === id || r.reportIds?.includes(id))) ||
          groups.some((group) => group.reportIds.some((id) => ids.includes(id)) && ordersForReportGroup(group, input.orders).length > 0)) continue;
    } else {
      const target = `${proposal.clusterId}:${pest}:${proposal.suggestedTaskType}`;
      if (reportTargets.has(target)) continue;
      if (liveOrders.some((o) => o.clusterId === proposal.clusterId && o.pestType === pest &&
          o.taskType === proposal.suggestedTaskType)) continue;
    }
    const cluster = clusters.get(proposal.clusterId);
    const sourcePoint = source?.point;
    // A report's recorded location is authoritative; callers cannot substitute a locality point.
    const proposalPoint = proposal.sourceReportId ? sourcePoint : proposal.point;
    const point = proposalPoint ?? sourcePoint ?? (cluster?.boundary?.rings[0]?.length ? cluster.boundary.centroid() : undefined);
    if (!validPoint(point)) continue;
    const workOrderId = proposal.sourceReportId ? `report-${proposal.sourceReportId}` : `prop-${proposal.clusterId}-${pest}`;
    const proposalGroup = source ? groupByReport.get(source.id) : undefined;
    const fallbackExplanation = explanationFor(source?.clusterId ?? (proposal.sourceReportId ? undefined : proposal.clusterId), pest,
      proposalGroup?.reports ?? (source ? [source] : []));
    const scoreExplanation: TaskScoreExplanation = {
      ...(proposal.scoreExplanation?.workOrderPriority ? { workOrderPriority: proposal.scoreExplanation.workOrderPriority } : {}),
      ...((proposal.scoreExplanation?.reportTriage ?? fallbackExplanation?.reportTriage)
        ? { reportTriage: proposal.scoreExplanation?.reportTriage ?? fallbackExplanation?.reportTriage } : {}),
      ...((proposal.scoreExplanation?.localityScore ?? fallbackExplanation?.localityScore)
        ? { localityScore: proposal.scoreExplanation?.localityScore ?? fallbackExplanation?.localityScore } : {}),
    };
    addJob({ workOrderId, sourceReportId: proposal.sourceReportId, clusterId: cluster?.id ?? null,
      isDemo: demoEvidence(source?.description),
      reportIds: proposal.reportIds, reportCount: proposal.reportCount, individualCounts: proposal.individualCounts,
      mapClusterId: proposal.mapClusterId ?? (proposal.sourceReportId ? `pest-${proposal.sourceReportId}` :
        pest === PestType.Mosquito ? proposal.clusterId : `inat-${proposal.clusterId}-${pest}`),
      point, taskType: proposal.suggestedTaskType, pestType: pest,
      ...(pest === PestType.Mosquito && !proposal.sourceReportId && !proposal.point && cluster?.isActive && cluster.boundary?.rings[0]?.length
        ? { serviceArea: cluster.boundary } : {}),
      priority: proposal.tier, ...(Object.keys(scoreExplanation).length ? { scoreExplanation } : {}),
      locality: cleanTitle(proposal.locality, 'Unassigned'),
      score: proposal.score, status: 'Pending', scheduledDate: proposal.scheduledDate }, pest);
  }
  jobs.sort((a, b) => (tierRank[a.priority ?? 'Medium'] ?? 2) - (tierRank[b.priority ?? 'Medium'] ?? 2));
  referrals.sort((a, b) => (tierRank[a.priority] ?? 2) - (tierRank[b.priority] ?? 2));
  return { teams: [...pools.values()], jobs, referrals };
}
