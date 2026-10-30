import { AccessControlService } from '../../src/control/AccessControlService';
import { AccessPolicy } from '../../src/control/AccessPolicy';
import { ReportController } from '../../src/control/ReportController';
import { ModerationController } from '../../src/control/ModerationController';
import { ReportLifecycleController } from '../../src/control/ReportLifecycleController';
import { ReportTransitionTable } from '../../src/control/ReportTransitionTable';
import { WorkOrderTransitionTable } from '../../src/control/WorkOrderTransitionTable';
import { WorkOrderLifecycleController } from '../../src/control/WorkOrderLifecycleController';
import { DispatchController } from '../../src/control/DispatchController';
import { InMemoryAuditStore, InMemoryClusterStore, InMemoryPriorityScoreStore } from '../../src/persistence/memory/InMemoryStores';
import { InMemoryClusterLocator, InMemoryReportStore } from '../../src/persistence/memory/InMemoryReportStores';
import {
  InMemoryTreatmentRecordStore,
  InMemoryWorkOrderStore,
  RecordingNotifier,
} from '../../src/persistence/memory/InMemoryWorkOrderStores';
import { Cluster } from '../../src/entity/Cluster';
import { GeoPoint, Polygon, PremisesMix } from '../../src/entity/valueTypes';
import { PestType, ReportType, Role, TaskType } from '../../src/entity/enums';
import { principalFor } from '../../src/control/DashboardController';
import { Principal } from '../../src/control/Principal';

export const MANAGER = principalFor(Role.OperationsManager, 'manager-1');
export const RESIDENT = new Principal('resident-1', Role.Resident, 'session-r1');
export const CREW = new Principal('crew-1', Role.CleaningCrew, 'session-crew');
export const INSIDE = new GeoPoint(1.43, 103.79);

/** Reports, moderation and dispatch wired together the way server.ts wires them. */
export async function reportRejectFixture() {
  const clusters = new InMemoryClusterStore();
  const cluster = new Cluster();
  cluster.objectId = 'c-1';
  cluster.locality = 'Marsiling Rise';
  cluster.caseSize = 12;
  cluster.caseDelta = 0;
  cluster.isActive = true;
  cluster.premisesMix = new PremisesMix(['Bin'], [], []);
  cluster.boundary = new Polygon([[
    new GeoPoint(1.427, 103.787), new GeoPoint(1.433, 103.787), new GeoPoint(1.433, 103.793),
    new GeoPoint(1.427, 103.793), new GeoPoint(1.427, 103.787),
  ]]);
  await clusters.upsertFromFeed({ retrievedAt: new Date(), records: [cluster] });
  const stored = (await clusters.findActive())[0] as Cluster;
  const reports = new InMemoryReportStore();
  const notifier = new RecordingNotifier();
  const audit = new InMemoryAuditStore();
  const ac = new AccessControlService(new AccessPolicy(), audit);
  const lifecycle = new ReportLifecycleController(new ReportTransitionTable(), reports, notifier, audit);
  const controller = new ReportController(ac, reports, new InMemoryClusterLocator(clusters), lifecycle, audit);
  const moderation = new ModerationController(ac, reports, lifecycle);
  const workOrderStore = new InMemoryWorkOrderStore();
  const workOrders = new WorkOrderLifecycleController(
    new WorkOrderTransitionTable(), workOrderStore, new InMemoryTreatmentRecordStore(), notifier, null, lifecycle,
  );
  const dispatch = new DispatchController(
    ac, workOrders, workOrderStore, clusters, new InMemoryPriorityScoreStore(), notifier, lifecycle, 10, null, null, null, reports,
  );
  moderation.linkWorkOrders(workOrderStore, dispatch);

  const submit = (at = new Date(), point = INSIDE) =>
    controller.submitReport(
      { point, type: ReportType.StandingWater, pestType: PestType.Mosquito, description: 'Standing water in a disused tray.' },
      RESIDENT,
      at,
    );
  const tomorrow = () => new Date(Date.now() + 8 * 3_600_000 + 86_400_000).toISOString().slice(0, 10);
  const linkedOrder = async (reportId: string) =>
    dispatch.createWorkOrder(
      { clusterId: stored.id, taskType: TaskType.Fogging, scheduledDate: tomorrow(), sourceReportId: reportId },
      MANAGER,
    );
  return { reports, audit, moderation, dispatch, workOrderStore, submit, linkedOrder };
}
