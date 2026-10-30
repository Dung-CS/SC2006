/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { OperationsDashboardScreen } from '../client/src/screens/operations/OperationsDashboardScreen';
import { SCREENS } from '../client/src/app/ScreenRegistry';
import { navigationFor, isCurrent } from '../client/src/app/Navigation';
import { matchRoute } from '../client/src/app/routes';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { Role } from '../src/entity/enums';

vi.mock('../client/src/screens/operations/DispatchProposalScreen', () => ({
  DispatchProposalScreen: ({ embedded }: { embedded?: boolean }) => <section data-screen="DispatchProposal" data-embedded={String(embedded)}>
    <div data-part="dispatch-routes-map" />
  </section>,
}));

afterEach(cleanup);

describe('Merged Operations workspace', () => {
  it('serves the same workspace at the primary and legacy dispatch URLs with one navigation item', () => {
    expect(SCREENS.OpsDashboard).toBe(OperationsDashboardScreen);
    expect(SCREENS.DispatchProposal).toBe(OperationsDashboardScreen);
    for (const path of ['/ops', '/ops/dispatch']) {
      const route = matchRoute(path)!.route;
      expect(SCREENS[route.screenId]).toBe(OperationsDashboardScreen);
      expect(route.roles).toEqual([Role.OperationsManager]);
      expect(route.title).toBe('Operations');
    }
    const nav = navigationFor(Role.OperationsManager);
    expect(nav.filter((item) => item.label === 'Operations')).toHaveLength(1);
    expect(nav.some((item) => item.route === '/ops/dispatch')).toBe(false);
    expect(nav.some((item) => item.route === '/ops/work-orders')).toBe(false);
    const operations = nav.find((item) => item.route === '/ops')!;
    expect(isCurrent(operations, '/ops')).toBe(true);
    expect(isCurrent(operations, '/ops/dispatch?date=2026-10-30')).toBe(true);
    expect(isCurrent(operations, '/ops/clusters/site')).toBe(true);
    expect(isCurrent(operations, '/ops/staff')).toBe(false);
  });

  it('shows one dispatch map and keeps image cards and recorded metrics in a closed summary', async () => {
    const calls: string[] = [];
    const fetcher: Fetcher = async (url) => {
      calls.push(url);
      const body = url === '/api/ops/dashboard' ? {
        overview: { activeClusters: 12, totalActiveCases: 90, highTierClusters: 2, openVerifiedReports: null,
          openWorkOrders: 3, overdueWorkOrders: 1, tierDistribution: {}, dataAsOf: '2026-10-30T02:00:00Z', staleSources: [] },
        attention: [{ kind: 'reportAwaitingModeration', detail: 'A report needs review.', link: '/ops/moderation' }],
      } : { rows: Array.from({ length: 12 }, (_, i) => ({ clusterId: `site-${i}`, locality: `Site ${i}`,
        rank: i + 1, caseSize: 10, caseDelta: 2, score: 67.3, tier: 'High', workOrderStatus: null,
        isDegraded: i === 0, excludedDrivers: i === 0 ? ['Rainfall24h'] : [] })) };
      return { ok: true, status: 200, json: async () => body } as Response;
    };
    render(<OperationsDashboardScreen api={new ApiClient('', fetcher)} params={{}}
      principal={{ accountId: 'manager', role: Role.OperationsManager }} onNavigate={vi.fn()} />);
    await screen.findByText('Active clusters');
    expect(screen.getAllByRole('heading', { level: 1 }).map((heading) => heading.textContent)).toEqual(['Operations']);
    expect(document.querySelector('[data-screen="DispatchProposal"]')?.getAttribute('data-embedded')).toBe('true');
    expect(document.querySelectorAll('[data-part="dispatch-routes-map"]')).toHaveLength(1);
    expect(document.querySelector('[data-part="ops-map"]')).toBeNull();
    expect(document.querySelector<HTMLDetailsElement>('[data-part="operations-summary"]')?.open).toBe(false);
    await waitFor(() => expect(document.querySelectorAll('[data-part="priority-cards"] .cluster-card')).toHaveLength(10));
    expect(document.querySelectorAll('[data-part="priority-cards"] img')).toHaveLength(10);
    expect(document.querySelector('[data-part="attention-list"] img')).toBeTruthy();
    expect(document.querySelector('[data-part="degraded"]')?.textContent).toContain('Rainfall24h');
    expect(calls).toEqual(['/api/ops/dashboard', '/api/ops/priority']);
  });
});
