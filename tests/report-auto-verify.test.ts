import { describe, expect, it } from 'vitest';
import { ReportStatus, Role } from '../src/entity/enums';
import { ReportTransitionTable } from '../src/control/ReportTransitionTable';
import { reportRejectFixture } from './helpers/reportRejectFixture';

describe('reports are verified by default', () => {
  it('a submitted report is Verified and both history rows are kept', async () => {
    const f = await reportRejectFixture();
    const report = await f.submit();
    expect(report.currentStatus()).toBe(ReportStatus.Verified);
    const history = await f.reports.statusHistory(report.id);
    expect(history.map((h) => [h.from, h.to])).toEqual([
      [null, ReportStatus.Submitted],
      [ReportStatus.Submitted, ReportStatus.Verified],
    ]);
  });

  it('the verification is audited and the report counts toward the score', async () => {
    const f = await reportRejectFixture();
    const report = await f.submit();
    const trail = (await f.audit.forTarget('Report', report.id, 10)).map((e) => e.action);
    expect(trail).toContain('report:status:Submitted -> Verified');
    expect(report.isVerified()).toBe(true);
    expect(await f.moderation.awaitingModerationCount()).toBe(0);
  });

  it('the table has a SYSTEM Submitted->Verified row and a manager Verified->Rejected row needing a reason', () => {
    const table = new ReportTransitionTable();
    expect(table.find(ReportStatus.Submitted, ReportStatus.Verified, 'SYSTEM')).toBeDefined();
    expect(table.find(ReportStatus.Verified, ReportStatus.Rejected, Role.OperationsManager)?.requiresReason).toBe(true);
  });
});
