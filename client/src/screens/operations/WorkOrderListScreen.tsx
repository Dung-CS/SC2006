/**
 * D-Fence — Work Order List (REQUIREMENTS.md 11.2.25).
 * Stereotype: <<boundary>>. Traces: 11.2.25, 8.2.x, 8.3.14, 2.3.4, 11.4.2.
 *
 * Every work order, terminal ones included — which is why this reads the manager endpoint rather
 * than the crew one. The two answer different questions: a crew member's list is "what is assigned
 * to me", a manager's is "what is the state of the work". Cancelled and verified orders belong in
 * the second and not the first.
 *
 * Both filters are query parameters, so the server does the filtering. That matters less here than
 * on the moderation queue, but keeping the convention means there is one place where "which orders
 * may this person see" is decided.
 */
import { useState } from 'react';
import { useLoad } from '../../lib/useLoad';
import { Freshness, QUEUE_REFRESH_MS, StateView } from '../../components/States';
import { link } from '../../components/Link';
import { WorkOrderStatus } from '../../../../src/entity/enums';
import { Pill, statusTone, tierTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { staffPhotoUrl } from '../../lib/staffVisuals';
import { Pagination, usePagination } from '../../components/Pagination';
import { ScreenProps } from '../ScreenProps';

/** 11.2.22 — the crew accounts a manager may assign to, used here only to put a name to an id. */
interface CrewPayload {
  crew: Array<{ accountId: string; email: string }>;
}

interface ListPayload {
  workOrders: Array<{
    id: string;
    clusterId: string;
    location?: string;
    assigneeId: string | null;
    taskType: string;
    status: string;
    scheduledDate: string;
    priority: string;
    issueFlag: boolean;
  }>;
}

export function WorkOrderListScreen(props: ScreenProps): JSX.Element {
  const [status, setStatus] = useState('');
  const path = status === '' ? '/api/ops/work-orders' : `/api/ops/work-orders?status=${encodeURIComponent(status)}`;
  const { state, value, retry, lastLoadedAt } = useLoad<ListPayload>(props.api, path, {
    isEmpty: (v) => v.workOrders.length === 0,
    emptyMessage: 'No work orders match. Raise one from the dispatch list or from a cluster.',
    refreshMs: QUEUE_REFRESH_MS,
  });

  const roster = useLoad<CrewPayload>(props.api, '/api/ops/staff/crew');
  const crewById = new Map((roster.value?.crew ?? []).map((member) => [member.accountId, member.email]));

  const { currentPage, setCurrentPage, pageSize, totalItems, pagedItems } = usePagination(
    value?.workOrders ?? [],
    10,
  );

  return (
    <section data-screen="WOList" data-requirement="11.2.25">
      <h1>Work orders</h1>
      <Freshness at={lastLoadedAt} everyMs={QUEUE_REFRESH_MS} onRefresh={retry} />

      <div data-part="toolbar">
        <a href="/ops/work-orders/new" data-variant="primary" onClick={link(props, '/ops/work-orders/new')}>
          New work order
        </a>

        <div data-component="field" data-part="filter">
          <label htmlFor="status-filter">Filter by status</label>
          <select id="status-filter" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {Object.values(WorkOrderStatus).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <StateView state={state} onRetry={retry}>
        <table>
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Location</th>
              <th scope="col">Status</th>
              <th scope="col">Scheduled</th>
              <th scope="col">Priority</th>
              <th scope="col">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {pagedItems.map((order) => (
              <tr key={order.id} data-status={order.status} data-issue={order.issueFlag}>
                <td>
                  <a href={`/ops/work-orders/${order.id}`} onClick={link(props, `/ops/work-orders/${order.id}`)}>
                    {label(order.taskType)}
                  </a>
                </td>
                <td className="wo-location-cell">
                  <span>{order.location ?? 'Singapore'}</span>
                </td>
                <td>
                  <Pill tone={statusTone(order.status)}>{label(order.status)}</Pill>
                  {order.issueFlag ? <span style={{ marginLeft: '6px', fontSize: '0.8rem', color: '#A4342B' }}>⚠️ Issue</span> : null}
                </td>
                <td>{order.scheduledDate}</td>
                <td>
                  <Pill tone={tierTone(order.priority)} tier={order.priority}>
                    {order.priority}
                  </Pill>
                </td>
                <td>
                  {order.assigneeId === null ? (
                    <span style={{ color: 'var(--ink-quiet)' }}>Unassigned</span>
                  ) : (
                    <div className="staff-profile-cell">
                      <img
                        src={staffPhotoUrl(crewById.get(order.assigneeId) ?? '')}
                        alt=""
                        className="staff-avatar-img"
                        style={{ width: '28px', height: '28px', minWidth: '28px' }}
                      />
                      <span>{crewById.get(order.assigneeId) ?? order.assigneeId}</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemName="work orders"
        />
      </StateView>
    </section>
  );
}
