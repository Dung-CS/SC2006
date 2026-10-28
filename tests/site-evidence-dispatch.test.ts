import { describe, expect, it } from 'vitest';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { DispatchController } from '../src/control/DispatchController';
import { principalFor } from '../src/control/DashboardController';
import { WorkOrderLifecycleController } from '../src/control/WorkOrderLifecycleController';
import { WorkOrderTransitionTable } from '../src/control/WorkOrderTransitionTable';
import { Cluster } from '../src/entity/Cluster';
import { PriorityScore } from '../src/entity/PriorityScore';
import { GeoPoint, Polygon, PremisesMix } from '../src/entity/valueTypes';
import { PestType, PriorityTier, Role } from '../src/entity/enums';
import { InMemoryAuditStore, InMemoryClusterStore, InMemoryPriorityScoreStore } from '../src/persistence/memory/InMemoryStores';
import { InMemoryReportStore } from '../src/persistence/memory/InMemoryReportStores';
import { InMemoryTreatmentRecordStore, InMemoryWorkOrderStore } from '../src/persistence/memory/InMemoryWorkOrderStores';

describe('Soon Lee score-only site evidence boundary', () => {
  it('keeps only the official mosquito cluster proposal and leaves scores unchanged', async () => {
    const reports = new InMemoryReportStore();
    const orders = new InMemoryWorkOrderStore();
    const clusters = new InMemoryClusterStore();
    const scores = new InMemoryPriorityScoreStore();
    const cluster = Object.assign(new Cluster(), { id: 'soon-lee', objectId: 'soon-lee', locality: 'Soon Lee Rd',
      isActive: true, premisesMix: new PremisesMix([], [], []),
      boundary: new Polygon([[new GeoPoint(1.32, 103.85)]]) });
    await clusters.upsertFromFeed({ records: [cluster], retrievedAt: new Date() });
    const observations = [PestType.Mosquito, PestType.Fly, PestType.Ant].map((pestType, rank) =>
      Object.assign(new PriorityScore(), { clusterId: 'soon-lee', localityId: 'soon-lee', pestType,
        tier: PriorityTier.High, score: 90 - rank, rank: rank + 1 }));
    await scores.saveAll(observations);
    const ac = new AccessControlService(new AccessPolicy(), new InMemoryAuditStore());
    const lifecycle = new WorkOrderLifecycleController(new WorkOrderTransitionTable(), orders,
      new InMemoryTreatmentRecordStore(), null, null);
    const dispatch = new DispatchController(ac, lifecycle, orders, clusters, scores, null, null, 10,
      null, ConfigLoader.load(), null, reports);

    const proposals = await dispatch.proposeDailyList('2099-01-01', principalFor(Role.OperationsManager, 'manager'));
    expect(proposals).toMatchObject([{ clusterId: 'soon-lee', pestType: PestType.Mosquito, priorityBasis: 'LocalityScore' }]);
    expect(await scores.latest()).toEqual(observations);
  });
});
