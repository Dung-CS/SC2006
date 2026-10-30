import { describe, expect, it } from 'vitest';
import { ReportStatus, WorkOrderStatus } from '../src/entity/enums';
import { ReportTransitionRefused } from '../src/control/ReportLifecycleController';
import { NotAuthorised } from '../src/control/AccessControlService';
import { ModerationRoutes } from '../src/boundary/http/ModerationRoutes';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { InMemoryAuditStore } from '../src/persistence/memory/InMemoryStores';
import { CREW, MANAGER, reportRejectFixture } from './helpers/reportRejectFixture';

const REASON = 'Photo shows a neighbour pond, not a breeding site.';

describe('manager rejects a Verified report', () => {
  it('rejects with a reason, records moderator and reason, and audits it', async () => {
    const f = await reportRejectFixture();
    const report = await f.submit();
    const rejected = await f.moderation.reject(report.id, REASON, MANAGER);
    expect(rejected.currentStatus()).toBe(ReportStatus.Rejected);
    expect(rejected.moderatorId).toBe(MANAGER.accountId);
    expect(rejected.moderationReason).toBe(REASON);
    const trail = (await f.audit.forTarget('Report', report.id, 10)).map((e) => e.action);
    expect(trail).toContain('report:status:Verified -> Rejected');
  });

  it('refuses a short reason and changes nothing, including linked work orders', async () => {
    const f = await reportRejectFixture();
    const report = await f.submit();
    const order = await f.linkedOrder(report.id);
    await expect(f.moderation.reject(report.id, 'no', MANAGER)).rejects.toBeInstanceOf(ReportTransitionRefused);
    expect((await f.reports.findById(report.id))?.currentStatus()).toBe(ReportStatus.Verified);
    expect((await f.workOrderStore.findById(order.id))?.currentStatus()).toBe(WorkOrderStatus.Created);
  });

  it('cancels a linked work order that is still Created', async () => {
    const f = await reportRejectFixture();
    const report = await f.submit();
    const order = await f.linkedOrder(report.id);
    await f.moderation.reject(report.id, REASON, MANAGER);
    const after = await f.workOrderStore.findById(order.id);
    expect(after?.currentStatus()).toBe(WorkOrderStatus.Cancelled);
    expect(after?.cancellationReason).toContain(REASON);
    expect((await f.reports.findById(report.id))?.currentStatus()).toBe(ReportStatus.Rejected);
  });

  it('refuses when a linked work order is Assigned, without the dispatch link', async () => {
    const f = await reportRejectFixture();
    const report = await f.submit();
    const order = await f.linkedOrder(report.id);
    await f.dispatch.assign(order.id, CREW.accountId, MANAGER);
    await expect(f.moderation.reject(report.id, REASON, MANAGER)).rejects.toThrow(/dispatch link unavailable/);
    expect((await f.workOrderStore.findById(order.id))?.currentStatus()).toBe(WorkOrderStatus.Assigned);
    expect((await f.reports.findById(report.id))?.currentStatus()).not.toBe(ReportStatus.Rejected);
  });

  it('is manager-only', async () => {
    const f = await reportRejectFixture();
    const report = await f.submit();
    await expect(f.moderation.reject(report.id, REASON, CREW)).rejects.toBeInstanceOf(NotAuthorised);
  });

  it('the reject route is a write route, so a success invalidates the dispatch plans', async () => {
    const f = await reportRejectFixture();
    const routes = new ModerationRoutes(new AccessControlService(new AccessPolicy(), new InMemoryAuditStore()), f.moderation);
    expect(routes.writeRoutes()).toContain('/api/ops/moderation/:id/reject');
  });
});
