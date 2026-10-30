/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { ScreenProps } from '../client/src/screens/ScreenProps';
import { RejectedReportsScreen } from '../client/src/screens/operations/RejectedReportsScreen';
import { createReportRejectControl } from '../client/src/components/ReportRejectControl';
import { createReportRejectSection } from '../client/src/components/TaskScoreCallout';
import { navigationFor } from '../client/src/app/Navigation';
import { ROUTES } from '../client/src/app/routes';
import { ModerationRoutes } from '../src/boundary/http/ModerationRoutes';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { InMemoryAuditStore } from '../src/persistence/memory/InMemoryStores';
import { Role } from '../src/entity/enums';
import { GeoPoint } from '../src/entity/valueTypes';
import { MANAGER, RESIDENT, reportRejectFixture } from './helpers/reportRejectFixture';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function props(fetcher: Fetcher, onNavigate = vi.fn()): ScreenProps {
  return {
    api: new ApiClient('', fetcher),
    params: {},
    principal: { accountId: 'manager-1', role: Role.OperationsManager },
    onNavigate,
  };
}

describe('rejected list', () => {
  it('lists rows in server order, with reason, and a link to report review', async () => {
    const rows = [
      { reportId: 'r2', pestType: 'Rat', localityBinding: 'Bedok', reason: 'Duplicate of another report.', rejectedBy: 'manager-1', rejectedAt: '2026-10-30T02:00:00Z' },
      { reportId: 'r1', pestType: 'Mosquito', localityBinding: 'Woodlands', reason: 'Not a breeding site.', rejectedBy: 'manager-1', rejectedAt: '2026-10-29T02:00:00Z' },
    ];
    const fetcher: Fetcher = async (url) => {
      expect(url).toBe('/api/ops/moderation/rejected');
      return { ok: true, status: 200, json: async () => ({ rejected: rows }) } as Response;
    };
    const onNavigate = vi.fn();
    render(<RejectedReportsScreen {...props(fetcher, onNavigate)} />);
    const links = await screen.findAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/ops/moderation/r2', '/ops/moderation/r1']);
    expect(screen.getByText('Not a breeding site.')).toBeTruthy();
    fireEvent.click(links[0] as HTMLElement);
    expect(onNavigate).toHaveBeenCalledWith('/ops/moderation/r2');
  });

  it('is routed at /ops/reports/rejected and linked in manager navigation only', () => {
    expect(ROUTES.find((r) => r.screenId === 'RejectedReports')?.path).toBe('/ops/reports/rejected');
    expect(navigationFor(Role.OperationsManager).some((n) => n.route === '/ops/reports/rejected')).toBe(true);
    expect(navigationFor(Role.Resident).some((n) => n.route === '/ops/reports/rejected')).toBe(false);
  });

  it('the API returns Rejected reports newest first and refuses residents', async () => {
    const f = await reportRejectFixture();
    const a = await f.submit();
    const b = await f.submit(new Date(), new GeoPoint(1.4315, 103.79));
    await f.moderation.reject(a.id, 'First rejected report here.', MANAGER);
    await new Promise((r) => setTimeout(r, 5));
    await f.moderation.reject(b.id, 'Second rejected report here.', MANAGER);
    const rows = await f.moderation.listRejected(MANAGER);
    expect(rows.map((r) => r.reportId)).toEqual([b.id, a.id]);
    await expect(f.moderation.listRejected(RESIDENT)).rejects.toThrow();
    const routes = new ModerationRoutes(new AccessControlService(new AccessPolicy(), new InMemoryAuditStore()), f.moderation);
    expect(routes.routes().indexOf('/api/ops/moderation/rejected')).toBeLessThan(routes.routes().indexOf('/api/ops/moderation/:id'));
  });
});

describe('reject control in the task callout', () => {
  it('appears only for report-sourced tasks', () => {
    const reject = vi.fn(async () => undefined);
    expect(createReportRejectSection({}, reject)).toBeNull();
    expect(createReportRejectSection({ sourceReportId: 'r1' }, reject)).not.toBeNull();
  });

  it('asks for a reason of ten characters and then calls the API', async () => {
    const reject = vi.fn(async () => undefined);
    document.body.append(createReportRejectControl('r1', reject));
    fireEvent.click(screen.getByText('Reject report'));
    const box = screen.getByLabelText('Reason for rejecting this report');
    fireEvent.change(box, { target: { value: 'short' } });
    fireEvent.click(screen.getByText('Confirm reject'));
    expect(reject).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: 'A long enough reason.' } });
    fireEvent.click(screen.getByText('Confirm reject'));
    await waitFor(() => expect(reject).toHaveBeenCalledWith('r1', 'A long enough reason.'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/rejected/i));
  });

  it('shows the server refusal', async () => {
    document.body.append(
      createReportRejectControl('r1', async () => {
        throw new Error('a linked work order is already assigned; unassign it');
      }),
    );
    fireEvent.click(screen.getByText('Reject report'));
    fireEvent.change(screen.getByLabelText('Reason for rejecting this report'), { target: { value: 'A long enough reason.' } });
    fireEvent.click(screen.getByText('Confirm reject'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/unassign/));
  });
});
