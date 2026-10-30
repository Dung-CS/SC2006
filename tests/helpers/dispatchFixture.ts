/** T5 test fixture: two crew, one van, two saved dispatches, one legacy order and one unassigned order. */
import { ConfigLoader } from '../../src/config/ConfigLoader';
import { AccessControlService } from '../../src/control/AccessControlService';
import { AccessPolicy } from '../../src/control/AccessPolicy';
import { DispatchListController } from '../../src/control/DispatchListController';
import { StaffAccountController } from '../../src/control/StaffAccountController';
import type { PlannedTeamRoute } from '../../src/control/RouteOptimizationService';
import { Account } from '../../src/entity/Account';
import { WorkOrder } from '../../src/entity/WorkOrder';
import { HqLocation, PestType, PriorityTier, Role, StaffSpecialisation, StaffStatus, TaskType, WorkOrderStatus } from '../../src/entity/enums';
import { DispatchAssignmentUnit } from '../../src/persistence/DispatchAssignmentUnit';
import { InMemoryVehicleStore } from '../../src/persistence/VehicleRepository';
import { InMemoryAccountStore, InMemorySessionStore, LocalAuthProvider } from '../../src/persistence/memory/InMemoryAccountStores';
import { InMemoryReportStore } from '../../src/persistence/memory/InMemoryReportStores';
import { InMemoryAuditStore, InMemoryClusterStore, InMemoryPriorityScoreStore } from '../../src/persistence/memory/InMemoryStores';
import { InMemoryTreatmentRecordStore, InMemoryWorkOrderStore } from '../../src/persistence/memory/InMemoryWorkOrderStores';

export async function dispatchFixture() {
  const accounts = new InMemoryAccountStore();
  const workOrders = new InMemoryWorkOrderStore();
  const vehicles = new InMemoryVehicleStore();
  const audit = new InMemoryAuditStore();
  const ac = new AccessControlService(new AccessPolicy(), audit);
  for (const [id, name] of [['crew-1', 'Siti Tan'], ['crew-2', 'Ah Seng']]) {
    await accounts.save(Object.assign(new Account(), { id, email: `${id}@example.test`, displayName: name, role: Role.CleaningCrew, isActive: true,
      specialisation: StaffSpecialisation.VectorControl, hqLocation: HqLocation.Central, staffStatus: StaffStatus.Available, onCallLagHours: 1,
      profileDescription: 'Fogging lead', createdAt: new Date('2026-01-02T00:00:00Z') }));
  }
  await vehicles.save({ id: 'van-1', registration: 'GBC 4821 K', name: 'van-1', model: 'Toyota Hiace', hqLocation: HqLocation.Central, maxPayloadKg: 1000,
    maxCargoVolumeM3: 10, cargoLengthCm: 300, cargoWidthCm: 200, cargoHeightCm: 200, seatCapacity: 4, isAvailable: true, isDemo: false });
  const order = async (id: string, date: string, over: Partial<WorkOrder>, status = WorkOrderStatus.Assigned) => {
    const wo = Object.assign(new WorkOrder(), { id, clusterId: null, scheduledDate: date, pestType: PestType.Mosquito, taskType: TaskType.Inspection,
      priority: PriorityTier.Low, location: `Stop ${id}`, assigneeId: 'crew-1', ...over });
    wo.applyStatus(status);
    await workOrders.save(wo);
  };
  await order('a', '2099-01-01', { dispatchAssignmentId: 'da-new', assignedCrewIds: ['crew-1', 'crew-2'] });
  await order('b', '2099-01-01', { dispatchAssignmentId: 'da-new', assignedCrewIds: ['crew-1', 'crew-2'] });
  await order('c', '2020-01-01', { dispatchAssignmentId: 'da-old' }, WorkOrderStatus.Completed);
  await order('legacy', '2098-06-01', {});
  await order('unassigned', '2099-01-01', { assigneeId: null }, WorkOrderStatus.Created);
  const stores = { accounts, workOrders, reports: new InMemoryReportStore(), clusters: new InMemoryClusterStore(), scores: new InMemoryPriorityScoreStore(),
    audit, treatments: new InMemoryTreatmentRecordStore(), vehicles };
  const unit = new DispatchAssignmentUnit(null, stores, ac, ConfigLoader.load());
  const snapshot = (ids: string[]) => ({ depotLocation: 'Central HQ', workOrderIds: ids, waypointOrder: [] }) as unknown as PlannedTeamRoute;
  const base = { teamId: 'team-1', vehicleId: 'van-1', computedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', createdBy: 'manager-1' };
  await unit.read().assignments.save({ ...base, id: 'da-new', date: '2099-01-01', crewIds: ['crew-1', 'crew-2'], workOrderIds: ['b', 'a'], routeSnapshot: snapshot(['b', 'a']) });
  await unit.read().assignments.save({ ...base, id: 'da-old', date: '2020-01-01', crewIds: ['crew-1'], workOrderIds: ['c'], routeSnapshot: snapshot(['c']) });
  const staff = new StaffAccountController(ac, new LocalAuthProvider(), accounts, new InMemorySessionStore(), audit);
  const list = new DispatchListController(ac, unit);
  staff.linkDispatches(list);
  return { staff, list, ac };
}
