import { Report } from '../entity/Report';
import { WorkOrder } from '../entity/WorkOrder';
import { PriorityTier, WorkOrderStatus } from '../entity/enums';
import { PriorityScore } from '../entity/PriorityScore';
import { PestType } from '../entity/enums';
import { WorkOrderStore } from '../ports/Stores';
import { taskForReport, triageForReport } from './ReportTriagePolicy';

export const DEFAULT_REPORT_CLUSTER_DISTANCE_METRES = 100;
const tierRank: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

/** Startup setting: small enough to describe one nearby issue, rather than a locality. */
export function reportClusterDistance(value: string | number | undefined): number {
  const distance = value === undefined ? DEFAULT_REPORT_CLUSTER_DISTANCE_METRES : Number(value);
  if (!Number.isFinite(distance) || distance < 1 || distance > 1000) {
    throw new Error('DFENCE_REPORT_CLUSTER_DISTANCE_METRES must be between 1 and 1000 metres');
  }
  return distance;
}

export interface ReportGroupProvenance {
  reportIds: string[];
  reportCount: number;
  individualCounts: Array<{ reportId: string; estimatedCount: number | null }>;
}

export interface ReportSpatialGroup extends ReportGroupProvenance {
  id: string;
  reports: Report[];
  representative: Report;
  priority: PriorityTier;
  score: number;
}

export function isPendingOrder(order: WorkOrder): boolean {
  return ![WorkOrderStatus.Completed, WorkOrderStatus.Verified, WorkOrderStatus.Cancelled].includes(order.currentStatus());
}

/** Read only linked historical jobs, rather than scanning the full work-order history. */
export async function withLinkedReportOrders(reports: Report[], orders: WorkOrder[], store: WorkOrderStore | null): Promise<WorkOrder[]> {
  if (!store) return orders;
  const known = new Set(orders.map((order) => order.id));
  const missing = [...new Set(reports.flatMap((report) => report.workOrderId && !known.has(report.workOrderId) ? [report.workOrderId] : []))];
  const linked = await Promise.all(missing.map((id) => store.findById(id)));
  return [...orders, ...linked.filter((order): order is WorkOrder => order !== null)];
}

export function ordersForReportGroup(group: ReportSpatialGroup, orders: WorkOrder[]): WorkOrder[] {
  return orders.filter((order) => isPendingOrder(order) && group.reports.some((report) =>
    order.sourceReportId === report.id || report.workOrderId === order.id ||
    (!order.sourceReportId && report.clusterId !== null && order.clusterId === report.clusterId &&
      order.pestType === report.pestType && order.taskType === taskForReport(report))));
}

export function reportGroupProvenance(group: ReportSpatialGroup): ReportGroupProvenance {
  return { reportIds: group.reportIds, reportCount: group.reportCount, individualCounts: group.individualCounts };
}

/**
 * Deterministic complete-link grouping: every pair must fit the threshold, so a chain cannot
 * join distant issues. This is a possible duplicate view; no report or photograph is changed.
 */
export function groupNearbyReports(reports: Report[], distance = DEFAULT_REPORT_CLUSTER_DISTANCE_METRES,
  orders: WorkOrder[] = [], scores: PriorityScore[] = []): ReportSpatialGroup[] {
  reportClusterDistance(distance);
  const resolvedIds = new Set(orders.filter((order) =>
    order.currentStatus() === WorkOrderStatus.Completed || order.currentStatus() === WorkOrderStatus.Verified).map((order) => order.id));
  const resolvedSources = new Set(orders.filter((order) => resolvedIds.has(order.id)).map((order) => order.sourceReportId));
  const active = [...new Map(reports.filter((report) => report.isVerified() &&
    !resolvedSources.has(report.id) && !(report.workOrderId && resolvedIds.has(report.workOrderId)) &&
    Number.isFinite(report.point?.latitude) && Number.isFinite(report.point?.longitude) &&
    Math.abs(report.point.latitude) <= 90 && Math.abs(report.point.longitude) <= 180)
    .map((report) => [report.id, report])).values()].sort((a, b) => a.id.localeCompare(b.id));
  const groups: Report[][] = [];
  // ponytail: quadratic complete-link scan; spatial indexing only if operational volumes demand it.
  for (const report of active) {
    const group = groups.find((members) => members[0]!.pestType === report.pestType &&
      members[0]!.type === report.type && taskForReport(members[0]!) === taskForReport(report) &&
      members.every((member) => member.point.distanceTo(report.point) <= distance));
    if (group) group.push(report);
    else groups.push([report]);
  }
  return groups.map((members) => {
    const memberPriority = (report: Report): PriorityTier => {
      const tiers = [triageForReport(report).priority, ...scores.filter((score) => report.clusterId !== null &&
        (score.clusterId === report.clusterId || score.localityId === report.clusterId) &&
        (score.pestType ?? PestType.Mosquito) === report.pestType).map((score) => score.tier)];
      return tiers.sort((a, b) => tierRank[a]! - tierRank[b]!)[0] as PriorityTier;
    };
    const representative = [...members].sort((a, b) => tierRank[memberPriority(a)]! - tierRank[memberPriority(b)]! || a.id.localeCompare(b.id))[0]!;
    return { id: `pest-${members[0]!.id}`, reports: members, representative, priority: memberPriority(representative),
      score: Math.max(0, ...scores.filter((score) => members.some((report) => report.clusterId !== null &&
        (score.clusterId === report.clusterId || score.localityId === report.clusterId) &&
        (score.pestType ?? PestType.Mosquito) === report.pestType)).map((score) => score.score)),
      reportIds: members.map((report) => report.id), reportCount: members.length,
      individualCounts: members.map((report) => ({ reportId: report.id, estimatedCount: report.estimatedCount })) };
  });
}
