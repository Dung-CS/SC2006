/**
 * D-Fence — WorkOrderRepository and TreatmentRecordRepository.
 * Stereotype: <<persistence>>. Traces: 8.1.11, 8.2.7, 8.3.x, 8.4.1, 7.3.4, 4.1.15, 4.1.16.
 *
 * Implements the same `WorkOrderStore` and `TreatmentRecordStore` ports as the in-memory pair, so
 * `DispatchController` and `WorkOrderLifecycleController` are unchanged by the swap.
 *
 * **Three things are held in SQL rather than in a field**, each because a field would go stale:
 *
 * - "Open" is `status NOT IN ('Verified','Cancelled')`, matching `WorkOrder.isTerminal()`. Rejected
 *   is open, because 8.3.19 makes a rejected completion work still outstanding; a second work order
 *   raised for a job the crew is about to resume is exactly what 8.1.11 exists to prevent.
 * - The assignment history is its own table (8.2.7), so "who was on this before" survives a
 *   reassignment rather than being overwritten by it.
 * - The completion evidence is append-only (8.3.6, 8.3.10), because a work order may be completed,
 *   rejected and completed again, and the rejection reason belongs to the attempt it refuses.
 */
import { randomUUID } from 'node:crypto';
import { Database, Row } from './Database';
import { WorkOrder } from '../entity/WorkOrder';
import { CompletionEvidence } from '../entity/CompletionEvidence';
import { TreatmentRecord } from '../entity/TreatmentRecord';
import { GeoPoint, IsoDate, Uuid } from '../entity/valueTypes';
import { PestType, PriorityTier, TaskType, WorkOrderStatus } from '../entity/enums';
import { TreatmentRecordStore, WorkOrderStore } from '../ports/Stores';

const SELECT_WORK_ORDERS = `
  SELECT w.id, w.cluster_id, w.assignee_id, w.source_report_id, w.task_type, w.scheduled_date, w.priority,
         w.instructions, w.status, w.started_at, w.created_at, w.verified_at, w.cancellation_reason,
         w.issue_flag, w.issue_reason, w.pest_type, w.dispatch_assignment_id,
         da.crew_ids AS assigned_crew_ids, da.vehicle_id AS assigned_vehicle_id,
         COALESCE(c.locality, r.locality_binding, 'Singapore') AS location,
         ST_Y(r.point::geometry) AS target_latitude, ST_X(r.point::geometry) AS target_longitude
  FROM work_order w
  LEFT JOIN cluster c ON c.id = w.cluster_id
  LEFT JOIN dispatch_assignment da ON da.id = w.dispatch_assignment_id
  LEFT JOIN report r ON r.id = w.source_report_id`;

/** `WorkOrder.isTerminal()`, expressed once for SQL. The two must not drift. */
const TERMINAL = `('Verified','Cancelled')`;

/**
 * A `date` column, not a timestamp — and `pg` hands it back as a JavaScript `Date` at local
 * midnight. Reformatting it with `toISOString()` would shift it back a day for anyone east of
 * Greenwich, which is every user of this system: 8.3.14's overdue check compares
 * `scheduledDate` against the Singapore calendar date, so an off-by-one here makes today's work
 * read as yesterday's backlog. The local components are already the intended calendar date.
 */
function toIsoDate(value: unknown): IsoDate {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const date = value as Date;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}


export class WorkOrderRepository implements WorkOrderStore {
  constructor(private readonly db: Database) {}

  async findById(id: Uuid): Promise<WorkOrder | null> {
    const rows = await this.db.query(`${SELECT_WORK_ORDERS} WHERE w.id = $1`, [id]);
    return rows.length === 0 ? null : WorkOrderRepository.toWorkOrder(rows[0] as Row);
  }

  async save(workOrder: WorkOrder): Promise<WorkOrder> {
    workOrder.id = workOrder.id || randomUUID();
    await this.db.query(
      `INSERT INTO work_order (
         id, cluster_id, assignee_id, source_report_id, task_type, scheduled_date, priority,
         instructions, status, started_at, created_at, verified_at, cancellation_reason,
         issue_flag, issue_reason, pest_type, dispatch_assignment_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (id) DO UPDATE SET
         cluster_id          = EXCLUDED.cluster_id,
         pest_type           = EXCLUDED.pest_type,
         assignee_id         = EXCLUDED.assignee_id,
         source_report_id    = EXCLUDED.source_report_id,
         task_type           = EXCLUDED.task_type,
         scheduled_date      = EXCLUDED.scheduled_date,
         priority            = EXCLUDED.priority,
         instructions        = EXCLUDED.instructions,
         status              = EXCLUDED.status,
         started_at          = EXCLUDED.started_at,
         verified_at         = EXCLUDED.verified_at,
         cancellation_reason = EXCLUDED.cancellation_reason,
         issue_flag          = EXCLUDED.issue_flag,
         issue_reason        = EXCLUDED.issue_reason,
         dispatch_assignment_id = EXCLUDED.dispatch_assignment_id`,
      [
        workOrder.id,
        workOrder.clusterId,
        workOrder.assigneeId,
        workOrder.sourceReportId,
        workOrder.taskType,
        workOrder.scheduledDate,
        workOrder.priority,
        workOrder.instructions,
        workOrder.currentStatus(),
        workOrder.startedAt,
        workOrder.createdAt,
        workOrder.verifiedAt,
        workOrder.cancellationReason,
        workOrder.issueFlag,
        workOrder.issueReason,
        workOrder.pestType,
        workOrder.dispatchAssignmentId,
      ],
    );
    return workOrder;
  }

  /** 8.1.11 — served by the partial index `work_order_cluster_open_idx`. */
  async findOpenForCluster(clusterId: Uuid): Promise<WorkOrder[]> {
    const rows = await this.db.query(
      `${SELECT_WORK_ORDERS}
        WHERE w.cluster_id = $1 AND w.status NOT IN ${TERMINAL}
        ORDER BY w.scheduled_date`,
      [clusterId],
    );
    return rows.map((r) => WorkOrderRepository.toWorkOrder(r));
  }

  /** 8.1.2 — served by the partial index `work_order_source_open_idx` (migration 011). */
  async findOpenForReport(sourceReportId: Uuid): Promise<WorkOrder[]> {
    const rows = await this.db.query(
      `${SELECT_WORK_ORDERS}
        WHERE w.source_report_id = $1 AND w.status NOT IN ${TERMINAL}
        ORDER BY w.scheduled_date`,
      [sourceReportId],
    );
    return rows.map((r) => WorkOrderRepository.toWorkOrder(r));
  }

  /** 8.4.1 — a crew member sees only what is assigned to them. */
  async findForAssignee(assigneeId: Uuid): Promise<WorkOrder[]> {
    const rows = await this.db.query(
      `${SELECT_WORK_ORDERS} WHERE w.assignee_id = $1 OR $1 = ANY(da.crew_ids) ORDER BY w.scheduled_date`,
      [assigneeId],
    );
    return rows.map((r) => WorkOrderRepository.toWorkOrder(r));
  }

  async findAllOpen(): Promise<WorkOrder[]> {
    const rows = await this.db.query(
      `${SELECT_WORK_ORDERS} WHERE w.status NOT IN ${TERMINAL} ORDER BY w.scheduled_date`,
    );
    return rows.map((r) => WorkOrderRepository.toWorkOrder(r));
  }

  /** 2.3.4, 8.2.x — terminal ones included: a manager reviewing the week needs the evidence. */
  async findAll(): Promise<WorkOrder[]> {
    const rows = await this.db.query(`${SELECT_WORK_ORDERS} ORDER BY w.scheduled_date`);
    return rows.map((r) => WorkOrderRepository.toWorkOrder(r));
  }

  /** 7.3.4 — verified inside the window, oldest first. */
  async findVerifiedSince(since: Date): Promise<WorkOrder[]> {
    const rows = await this.db.query(
      `${SELECT_WORK_ORDERS}
        WHERE w.verified_at IS NOT NULL AND w.verified_at >= $1
        ORDER BY w.verified_at`,
      [since],
    );
    return rows.map((r) => WorkOrderRepository.toWorkOrder(r));
  }

  async appendAssignmentHistory(workOrderId: Uuid, assigneeId: Uuid | null, at: Date): Promise<void> {
    await this.db.query(
      `INSERT INTO work_order_assignment (work_order_id, assignee_id, assigned_at) VALUES ($1,$2,$3)`,
      [workOrderId, assigneeId, at],
    );
  }

  async assignmentHistory(workOrderId: Uuid): Promise<Array<{ assigneeId: Uuid | null; at: Date }>> {
    const rows = await this.db.query(
      `SELECT assignee_id, assigned_at FROM work_order_assignment
        WHERE work_order_id = $1 ORDER BY assigned_at, id`,
      [workOrderId],
    );
    return rows.map((r) => ({ assigneeId: (r.assignee_id as Uuid | null) ?? null, at: r.assigned_at as Date }));
  }

  async saveEvidence(evidence: CompletionEvidence): Promise<void> {
    evidence.id = evidence.id || randomUUID();
    await this.db.query(
      `INSERT INTO completion_evidence (
         id, work_order_id, completed_at, task_performed, notes, photo_keys, rejection_reason)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         rejection_reason = EXCLUDED.rejection_reason`,
      [
        evidence.id,
        evidence.workOrderId,
        evidence.completedAt,
        evidence.taskPerformed,
        evidence.notes,
        evidence.photoKeys,
        evidence.rejectionReason,
      ],
    );
  }

  /**
   * The evidence for the **current** attempt: the most recently submitted row.
   *
   * 8.3.10's rejection reason is written back onto the attempt it refuses, which is why the upsert
   * above updates that one column — a rejection creates no new attempt, it annotates the one the
   * crew already made.
   */
  async latestEvidence(workOrderId: Uuid): Promise<CompletionEvidence | null> {
    const rows = await this.db.query(
      `SELECT id, work_order_id, completed_at, task_performed, notes, photo_keys, rejection_reason
         FROM completion_evidence
        WHERE work_order_id = $1
        ORDER BY submitted_at DESC, id DESC
        LIMIT 1`,
      [workOrderId],
    );
    if (rows.length === 0) {
      return null;
    }
    const row = rows[0] as Row;
    const evidence = new CompletionEvidence();
    evidence.id = row.id as Uuid;
    evidence.workOrderId = row.work_order_id as Uuid;
    evidence.completedAt = row.completed_at as Date;
    evidence.taskPerformed = row.task_performed as TaskType;
    evidence.notes = row.notes as string;
    evidence.photoKeys = (row.photo_keys as string[] | null) ?? [];
    evidence.rejectionReason = (row.rejection_reason as string | null) ?? null;
    return evidence;
  }

  /**
   * Row to entity. `applyStatus` is the only way in, for the same reason as on `Report`: 8.3.2
   * permits only the transitions in the state table, and rehydration is the one exception, confined
   * to this method rather than opened up by a public setter.
   */
  private static toWorkOrder(row: Row): WorkOrder {
    const order = new WorkOrder();
    order.id = row.id as Uuid;
    order.dispatchAssignmentId = (row.dispatch_assignment_id as Uuid | null) ?? null;
    order.assignedCrewIds = (row.assigned_crew_ids as Uuid[] | null) ?? [];
    order.assignedVehicleId = (row.assigned_vehicle_id as Uuid | null) ?? null;
    order.clusterId = (row.cluster_id as Uuid | null) ?? null;
    // Null stays null: an unresolved legacy pest is unknown, never Mosquito by default.
    order.pestType = (row.pest_type as PestType | null) ?? null;
    order.location = (row.location as string | null) ?? (row.locality as string | null) ?? undefined;
    order.targetPoint =
      row.target_latitude === null || row.target_latitude === undefined
        ? null
        : new GeoPoint(Number(row.target_latitude), Number(row.target_longitude));
    order.assigneeId = (row.assignee_id as Uuid | null) ?? null;
    order.sourceReportId = (row.source_report_id as Uuid | null) ?? null;
    order.taskType = row.task_type as TaskType;
    order.scheduledDate = toIsoDate(row.scheduled_date);
    order.priority = row.priority as PriorityTier;
    order.instructions = row.instructions as string;
    order.startedAt = (row.started_at as Date | null) ?? null;
    order.createdAt = row.created_at as Date;
    order.verifiedAt = (row.verified_at as Date | null) ?? null;
    order.cancellationReason = (row.cancellation_reason as string | null) ?? null;
    order.issueFlag = row.issue_flag === true;
    order.issueReason = (row.issue_reason as string | null) ?? null;
    order.applyStatus(row.status as WorkOrderStatus);
    return order;
  }

}

/** 8.3.12 — written when a work order is Verified; it is what moves 4.1.15's driver. */
export class TreatmentRecordRepository implements TreatmentRecordStore {
  constructor(private readonly db: Database) {}

  async save(record: TreatmentRecord): Promise<TreatmentRecord> {
    record.id = record.id || randomUUID();
    await this.db.query(
      `INSERT INTO treatment_record (id, cluster_id, work_order_id, task_type, completion_date, pest_type)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO NOTHING`,
      [record.id, record.clusterId, record.workOrderId, record.taskType, record.completionDate, record.pestType ?? null],
    );
    return record;
  }

  async latestForCluster(clusterId: Uuid): Promise<TreatmentRecord | null> {
    const all = await this.allForCluster(clusterId);
    return all.length === 0 ? null : (all[all.length - 1] as TreatmentRecord);
  }

  /** Oldest first, matching the in-memory store: `latestForCluster` reads the last element. */
  async allForCluster(clusterId: Uuid): Promise<TreatmentRecord[]> {
    const rows = await this.db.query(
      `SELECT id, cluster_id, work_order_id, task_type, completion_date, pest_type FROM treatment_record
        WHERE cluster_id = $1 ORDER BY completion_date`,
      [clusterId],
    );
    return rows.map((r) => TreatmentRecordRepository.toRecord(r));
  }

  private static toRecord(r: Row): TreatmentRecord {
    const record = new TreatmentRecord();
    record.id = r.id as Uuid;
    record.clusterId = (r.cluster_id as Uuid | null) ?? null;
    record.workOrderId = r.work_order_id as Uuid;
    record.taskType = r.task_type as TaskType;
    record.completionDate = toIsoDate(r.completion_date);
    record.pestType = (r.pest_type as PestType | null) ?? null;
    return record;
  }

  /**
   * 4.1.15, 4.1.16 — days since the most recent verified treatment, or the 90-day default when
   * there has never been one. Duplicated from the in-memory store rather than shared, because it
   * is part of the port's behaviour: a cluster with no treatment enters the driver saturated, and
   * a store that returned 0 there would make an untreated cluster look freshly treated.
   */
  async daysSinceLastTreatment(clusterId: Uuid, now: Date, pestType = PestType.Mosquito): Promise<number> {
    // Same filter as the in-memory store: this pest, plus legacy records of unknown pest.
    const rows = await this.db.query(
      `SELECT id, cluster_id, work_order_id, task_type, completion_date, pest_type FROM treatment_record
        WHERE cluster_id = $1 AND (pest_type IS NULL OR pest_type = $2)
        ORDER BY completion_date DESC LIMIT 1`,
      [clusterId, pestType],
    );
    const latest = rows.length === 0 ? null : TreatmentRecordRepository.toRecord(rows[0] as Row);
    if (latest === null) {
      return 90;
    }
    const days = (now.getTime() - new Date(`${latest.completionDate}T00:00:00+08:00`).getTime()) / 86_400_000;
    return Math.max(0, Math.floor(days));
  }
}
