/**
 * D-Fence — the moderation queue and the verify/reject decision.
 * Stereotype: <<control>>. Realises use case 3.4. Traces: 5.2.3–5.2.5, 5.3.1–5.3.5, 4.1.3.
 *
 * The point of this class is 5.2.5: only Verified and Actioned reports reach the score. Without
 * moderation, the community driver is an open channel from any resident straight into the ranking
 * that sends a crew somewhere — which is the one place in the design where a user can move an
 * operational decision, and therefore the one that needs a human in it.
 */
import { ReportStatus, ReportType, Role, WorkOrderStatus } from '../entity/enums';
import { PestType } from '../entity/enums';
import { Uuid } from '../entity/valueTypes';
import { Report } from '../entity/Report';
import { ReportPhoto } from '../entity/ReportPhoto';
import { AccountStore, ReportStore, WorkOrderStore } from '../ports/Stores';
import { AccessControlService } from './AccessControlService';
import { ReportLifecycleController, ReportTransitionRefused } from './ReportLifecycleController';
import { Principal } from './Principal';

/** One row of the queue. Identified: 2.3.4 gives the manager all reports, reporter included. */
export interface ModerationRow {
  reportId: Uuid;
  type: ReportType;
  description: string;
  localityBinding: string;
  clusterId: Uuid | null;
  corroborationCount: number;
  submittedAt: Date;
  photoCount: number;
  /** How long it has been waiting, in hours — the number that makes a stale queue visible. */
  waitingHours: number;
}

/** One row of the rejected list: who turned a report down, when and why. */
export interface RejectedReportRow {
  reportId: Uuid;
  pestType: PestType;
  localityBinding: string;
  reason: string;
  /** Display name, else email, else the account id when no account is found. */
  rejectedBy: string | null;
  rejectedAt: Date | null;
}

/** The part of `DispatchController` a reject needs: cancelling a work order with a reason. */
export interface WorkOrderCanceller {
  cancel(id: Uuid, reason: string, by: Principal): Promise<unknown>;
}

/** The part of `DispatchAssignmentService` a reject needs: take the orders off every dispatch, atomically with `then`. */
export interface DispatchRemoval {
  removeWorkOrders<T>(ids: Uuid[], reason: string, by: Principal,
    then: (context: { reportLifecycle: Pick<ReportLifecycleController, 'transition'> }) => Promise<T>): Promise<T>;
}

export class ModerationController {
  private dispatch: DispatchRemoval | null = null;
  private workOrders: WorkOrderStore | null = null;
  private canceller: WorkOrderCanceller | null = null;
  private accounts: AccountStore | null = null;

  constructor(
    private readonly ac: AccessControlService,
    private readonly reports: ReportStore,
    private readonly lifecycle: ReportLifecycleController,
  ) {}

  /**
   * 5.3.1, 5.3.2, 5.3.3 — every Submitted report, oldest first, filtered by cluster and by type.
   *
   * Both filters are applied server-side. A queue filtered in the browser would ship every pending
   * report to the client and rely on the screen to hide them, which for 2.3.4 happens to be
   * harmless and for 5.3.5's photographs would not be.
   */
  async listQueue(
    by: Principal,
    filter: { clusterId?: Uuid; type?: ReportType } = {},
    now = new Date(),
  ): Promise<ModerationRow[]> {
    await this.ac.authorise(by, 'report:moderate', { kind: 'report' });
    const queue = await this.lifecycle.queue(filter);
    const rows: ModerationRow[] = [];
    for (const report of queue) {
      rows.push({
        reportId: report.id,
        type: report.type,
        description: report.description,
        localityBinding: report.localityBinding,
        clusterId: report.clusterId,
        corroborationCount: report.corroborationCount,
        submittedAt: report.submittedAt,
        photoCount: (await this.reports.photosFor(report.id)).length,
        waitingHours: Math.floor((now.getTime() - report.submittedAt.getTime()) / 3_600_000),
      });
    }
    return rows;
  }

  /** Wired after construction because the dispatch controller is built later in `server.ts`. */
  linkWorkOrders(workOrders: WorkOrderStore, canceller: WorkOrderCanceller, accounts: AccountStore | null = null): void {
    this.accounts = accounts;
    this.workOrders = workOrders;
    this.canceller = canceller;
  }

  /** Wired once the dispatch assignment service exists, later still in `server.ts`. */
  linkDispatch(dispatch: DispatchRemoval): void {
    this.dispatch = dispatch;
  }

  /** Rejected reports, newest first, for the manager's rejected list. */
  async listRejected(by: Principal): Promise<RejectedReportRow[]> {
    await this.ac.authorise(by, 'report:moderate', { kind: 'report' });
    const rejected = await this.reports.findByStatus(ReportStatus.Rejected);
    const names = new Map<Uuid, string>();
    for (const r of rejected) {
      if (r.moderatorId !== null && !names.has(r.moderatorId)) {
        const account = (await this.accounts?.findById(r.moderatorId)) ?? null;
        names.set(r.moderatorId, account?.displayName || account?.email || r.moderatorId);
      }
    }
    return rejected
      .map((r) => ({
        reportId: r.id,
        pestType: r.pestType,
        localityBinding: r.localityBinding,
        reason: r.moderationReason ?? '',
        rejectedBy: r.moderatorId === null ? null : (names.get(r.moderatorId) ?? r.moderatorId),
        rejectedAt: r.moderatedAt,
      }))
      .sort((a, b) => (b.rejectedAt?.getTime() ?? 0) - (a.rejectedAt?.getTime() ?? 0));
  }

  /** The Report Review screen: the full report and its photographs, which 2.3.4 permits here. */
  async review(reportId: Uuid, by: Principal): Promise<{ report: Report; photos: ReportPhoto[] }> {
    await this.ac.authorise(by, 'report:readAll', { kind: 'report', id: reportId });
    const report = await this.reports.findById(reportId);
    if (report === null) {
      throw new Error(`no report ${reportId}`);
    }
    return { report, photos: await this.reports.photosFor(reportId) };
  }

  /**
   * 5.2.3, 5.3.4 — verify. From here the report counts toward 4.1.3, so the moderator id and
   * timestamp are recorded on the same write that changes the status.
   */
  async verify(reportId: Uuid, by: Principal, reason?: string): Promise<Report> {
    await this.ac.authorise(by, 'report:moderate', { kind: 'report', id: reportId });
    return this.lifecycle.transition(reportId, ReportStatus.Verified, ReportLifecycleController.actorFor(by), {
      moderatorId: by.accountId,
      ...(reason === undefined ? {} : { reason }),
    });
  }

  /**
   * 5.2.3, 5.2.4, 5.3.4 — reject with a reason of at least ten characters. The length check lives
   * in the transition table's rule, so it cannot be bypassed by any other path into Rejected.
   */
  async reject(reportId: Uuid, reason: string, by: Principal): Promise<Report> {
    await this.ac.authorise(by, 'report:moderate', { kind: 'report', id: reportId });
    const report = await this.reports.findById(reportId);
    const reject = (lifecycle: Pick<ReportLifecycleController, 'transition'>): Promise<Report> =>
      lifecycle.transition(reportId, ReportStatus.Rejected, ReportLifecycleController.actorFor(by), { moderatorId: by.accountId, reason });
    if (report?.currentStatus() === ReportStatus.Verified || report?.currentStatus() === ReportStatus.Actioned) {
      const linked = await this.linkedWorkOrders(report, reason);
      if (this.dispatch !== null) {
        // The stop removal, any dispatch cancellation and the report reject commit together or not at all.
        return this.dispatch.removeWorkOrders([...linked.keys()], `Source report rejected: ${reason.trim()}`, by,
          (context) => reject(context.reportLifecycle));
      }
      await this.cancelUnassigned(linked, reason, by);
    }
    return reject(this.lifecycle);
  }

  /**
   * Before a Verified report is rejected: its open work orders. The reason is checked first so a bad
   * reason cancels nothing, and a missing store link refuses rather than guessing.
   */
  private async linkedWorkOrders(report: Report, reason: string): Promise<Map<Uuid, WorkOrderStatus>> {
    const refuse = (message: string): never => {
      throw new ReportTransitionRefused(ReportStatus.Verified, ReportStatus.Rejected, message);
    };
    if (reason.trim().length < 10) {
      refuse('a reason of at least ten characters is required (5.2.4)');
    }
    if (this.workOrders === null || this.canceller === null) {
      // Fail closed: without the work-order stores a committed order cannot be ruled out.
      return refuse('work-order check unavailable; the report was not rejected');
    }
    const linked = new Map<Uuid, WorkOrderStatus>();
    for (const order of await this.workOrders.findOpenForReport(report.id)) {
      linked.set(order.id, order.currentStatus());
    }
    if (report.workOrderId !== null) {
      const order = await this.workOrders.findById(report.workOrderId);
      if (order !== null && !order.isTerminal()) {
        linked.set(order.id, order.currentStatus());
      }
    }
    return linked;
  }

  /** Without the dispatch link a committed order cannot be taken off its route, so refuse; else cancel Created ones. */
  private async cancelUnassigned(linked: Map<Uuid, WorkOrderStatus>, reason: string, by: Principal): Promise<void> {
    const committed = [WorkOrderStatus.Assigned, WorkOrderStatus.Accepted, WorkOrderStatus.InProgress];
    if ([...linked.values()].some((status) => committed.includes(status))) {
      throw new ReportTransitionRefused(ReportStatus.Verified, ReportStatus.Rejected,
        'dispatch link unavailable; a linked work order is assigned, so the report was not rejected');
    }
    for (const [id, status] of linked) {
      if (status === WorkOrderStatus.Created) {
        await this.canceller!.cancel(id, `Source report rejected: ${reason.trim()}`, by);
      }
    }
  }

  /**
   * 5.2.5 into 4.1.3 — the verified open report count per cluster, for the scoring cycle.
   *
   * Every active cluster must appear, including with zero. A cluster missing from the map reads to
   * `PriorityScoringEngine` as a driver with no value, which excludes it and marks the score
   * DEGRADED (4.1.12); "no reports" and "we do not know about reports" are different facts and the
   * score has to tell them apart.
   */
  async verifiedOpenCounts(activeClusterIds: Uuid[]): Promise<Map<Uuid, number>> {
    const counted = await this.reports.verifiedOpenCountByCluster();
    const complete = new Map<Uuid, number>();
    for (const id of activeClusterIds) {
      complete.set(id, counted.get(id) ?? 0);
    }
    return complete;
  }

  /** 7.5.3 — how many reports are waiting on a moderator, for the dashboard's attention panel. */
  async awaitingModerationCount(): Promise<number> {
    return (await this.reports.findByStatus(ReportStatus.Submitted)).length;
  }

  /** 5.2.3, stated where a reader looks for it; the table holds the enforcement. */
  static mayModerate(by: Principal): boolean {
    return by.role === Role.OperationsManager;
  }
}
