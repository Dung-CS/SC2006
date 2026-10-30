import { describe, expect, it, vi } from 'vitest';
import { DispatchPlanService } from '../src/control/DispatchPlanService';
import { buildDispatchRouteInputs } from '../src/control/DispatchRouteInputs';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { ReportStatus } from '../src/entity/enums';
import { reportRejectFixture } from './helpers/reportRejectFixture';

const date = '2099-01-01';

describe('A new verified report refreshes the dispatch plan', () => {
  it('marks the plan refreshing and the next horizon lists the new task as unplanned', async () => {
    let plans!: DispatchPlanService;
    const f = await reportRejectFixture(() => plans.invalidateAll());
    const profiles = ConfigLoader.load().pestProfiles;
    plans = new DispatchPlanService(async () => ({ vehicles: [], ...buildDispatchRouteInputs({ date, profiles, crew: [],
      orders: [], clusters: [], proposals: [], reports: await f.reports.findByStatus(ReportStatus.Verified) }) }),
    { plan: vi.fn().mockResolvedValue([]) });
    await plans.refresh(date);
    expect(plans.snapshot(date)).toMatchObject({ planStatus: 'ready', unplanned: [] });
    const before = plans.snapshot(date).computedAt;

    const report = await f.submit();
    expect(report.currentStatus()).toBe(ReportStatus.Verified);
    expect(plans.snapshot(date).planStatus).toBe('refreshing');
    await plans.refresh(date);
    const next = plans.snapshot(date);
    expect(next.computedAt).not.toBe(before);
    expect(next.unplanned.map((job) => job.sourceReportId)).toContain(report.id);
  });
});
