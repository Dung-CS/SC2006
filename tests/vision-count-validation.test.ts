import { describe, expect, it, vi } from 'vitest';
import { ReportController, ReportDraft, ReportRejected } from '../src/control/ReportController';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { Principal } from '../src/control/Principal';
import { InMemoryAuditStore, InMemoryClusterStore } from '../src/persistence/memory/InMemoryStores';
import { InMemoryClusterLocator, InMemoryReportStore } from '../src/persistence/memory/InMemoryReportStores';
import { ReportLifecycleController } from '../src/control/ReportLifecycleController';
import { ReportTransitionTable } from '../src/control/ReportTransitionTable';
import { GeoPoint } from '../src/entity/valueTypes';
import { PestType, ReportType, Role } from '../src/entity/enums';
function setup() {
  const store = new InMemoryReportStore();
  const controller = new ReportController(new AccessControlService(new AccessPolicy(), new InMemoryAuditStore()), store, new InMemoryClusterLocator(new InMemoryClusterStore()), new ReportLifecycleController(new ReportTransitionTable(), store, null));
  const draft: ReportDraft = { point: new GeoPoint(1.3, 103.8), type: ReportType.Other, pestType: PestType.Rat, description: 'One rat observed', photos: [] };
  return { store, controller, draft };
}
const by = new Principal('count-resident', Role.Resident, 'session');
describe('Report observed count validation', () => {
  it.each([0, -1, 501, 1.5, NaN, Infinity, -Infinity, '2', '', false])('rejects explicit invalid count %s before persistence', async (count) => {
    const { store, controller, draft } = setup();
    const save = vi.spyOn(store, 'save');
    await expect(controller.submitReport({ ...draft, estimatedCount: count as number }, by)).rejects.toBeInstanceOf(ReportRejected);
    expect(save).not.toHaveBeenCalled();
  });
  it.each([1, 500, undefined, null])('preserves valid boundary or unknown %s', async (count) => {
    const { controller, draft } = setup();
    const report = await controller.submitReport({ ...draft, estimatedCount: count }, by);
    expect(report.estimatedCount).toBe(count ?? null);
  });
});
