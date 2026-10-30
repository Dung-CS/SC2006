import { AssignmentContext, AssignmentUnit } from '../control/DispatchAssignmentService';
import { DispatchController } from '../control/DispatchController';
import { WorkOrderLifecycleController } from '../control/WorkOrderLifecycleController';
import { WorkOrderTransitionTable } from '../control/WorkOrderTransitionTable';
import { ReportLifecycleController } from '../control/ReportLifecycleController';
import { ReportTransitionTable } from '../control/ReportTransitionTable';
import { AccessControlService } from '../control/AccessControlService';
import { ConfigSet } from '../config/ConfigSet';
import { AccountStore, AuditStore, ClusterStore, Notifier, PriorityScoreStore, ReportStore, TreatmentRecordStore, WorkOrderStore } from '../ports/Stores';
import { VehicleStore } from '../ports/VehicleStore';
import { DispatchAssignmentStore } from '../ports/DispatchAssignmentStore';
import { Database } from './Database';
import { DataStoreFactory } from './DataStoreFactory';
import { VehicleRepository } from './VehicleRepository';
import { DispatchAssignmentRepository, InMemoryDispatchAssignmentStore } from './DispatchAssignmentRepository';

interface Stores {
  accounts: AccountStore; workOrders: WorkOrderStore; reports: ReportStore; clusters: ClusterStore;
  scores: PriorityScoreStore; audit: AuditStore; treatments: TreatmentRecordStore; vehicles: VehicleStore;
}

/** Preserve entity methods and Maps when staging in-memory writes. Nothing is published before success. */
function stage<T>(value: T, seen = new Map<object, unknown>()): T {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value) as T;
  if (value instanceof Date) return new Date(value) as T;
  if (value instanceof Map) {
    const out = new Map(); seen.set(value, out);
    for (const [key, item] of value) out.set(stage(key, seen), stage(item, seen));
    return out as T;
  }
  if (value instanceof Set) return new Set([...value].map((item) => stage(item, seen))) as T;
  const out = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
  seen.set(value, out);
  for (const key of Object.keys(value)) out[key] = stage((value as Record<string, unknown>)[key], seen);
  return out as T;
}

export class DispatchAssignmentUnit implements AssignmentUnit {
  private readonly assignments: DispatchAssignmentStore;
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly db: Database | null, private readonly stores: Stores,
    private readonly ac: AccessControlService, private readonly config: ConfigSet,
    private readonly notifier: Notifier | null = null, private readonly reportGroupDistance = 100) {
    this.assignments = db ? new DispatchAssignmentRepository(db) : new InMemoryDispatchAssignmentStore();
  }

  private context(stores: Stores, assignments: DispatchAssignmentStore, notices: Array<{ id: string; message: string }>): AssignmentContext {
    const deferred: Notifier = { notify: async (id, message) => { notices.push({ id, message }); } };
    const reportLifecycle = new ReportLifecycleController(new ReportTransitionTable(), stores.reports, deferred, stores.audit);
    const lifecycle = new WorkOrderLifecycleController(new WorkOrderTransitionTable(), stores.workOrders, stores.treatments,
      deferred, null, reportLifecycle, stores.audit);
    const dispatch = new DispatchController(this.ac, lifecycle, stores.workOrders, stores.clusters, stores.scores,
      deferred, reportLifecycle, 10, stores.audit, this.config, stores.accounts, stores.reports, this.reportGroupDistance);
    return { ...stores, assignments, dispatch, lifecycle, reportLifecycle };
  }

  read(): AssignmentContext { return this.context(this.stores, this.assignments, []); }

  async run<T>(work: (context: AssignmentContext) => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise((resolve) => { release = resolve; });
    await previous;
    const notices: Array<{ id: string; message: string }> = [];
    let result!: T;
    try {
      if (this.db) {
        await this.db.transaction(async (scoped) => {
          await scoped.query("SELECT pg_advisory_xact_lock(hashtext('d-fence-dispatch-assignment'))");
          // ponytail: short whole-table write locks protect existing legacy writers and source duplicate checks.
          // Replace with row-level reservations only when measured dispatch volume warrants the extra machinery.
          await scoped.query('LOCK TABLE account, vehicle, work_order, report IN SHARE ROW EXCLUSIVE MODE');
          const stores: Stores = { ...this.stores, accounts: DataStoreFactory.createAccountStore(scoped),
            workOrders: DataStoreFactory.createWorkOrderStore(scoped), reports: DataStoreFactory.createReportStore(scoped),
            clusters: DataStoreFactory.createClusterStore(scoped), scores: DataStoreFactory.createPriorityScoreStore(scoped),
            audit: DataStoreFactory.createAuditStore(scoped), vehicles: new VehicleRepository(scoped) };
          result = await work(this.context(stores, new DispatchAssignmentRepository(scoped), notices));
        });
      } else {
        const staged = stage({ stores: this.stores, assignments: this.assignments });
        result = await work(this.context(staged.stores, staged.assignments, notices));
        // Publish together without an await, so no other request can observe a partial memory commit.
        Object.assign(this.stores.workOrders, staged.stores.workOrders);
        Object.assign(this.stores.reports, staged.stores.reports);
        Object.assign(this.stores.audit, staged.stores.audit);
        Object.assign(this.assignments, staged.assignments);
      }
    } finally { release(); }
    // Notify only after commit. A delivery failure cannot turn a committed booking into a failed booking response.
    for (const notice of notices) {
      try { await this.notifier?.notify(notice.id, notice.message); }
      catch { console.warn('Dispatch assignment notification could not be delivered. The booking remains saved.'); }
    }
    return result;
  }
}
