/**
 * D-Fence — Dispatches (replaces the Work Order List, 11.2.25).
 * Stereotype: <<boundary>>.
 *
 * One row per saved dispatch: its date, HQ, crew, vehicle and ordered stops. A stop opens its work
 * order, which is where the score breakdown lives. Orders assigned outside a dispatch (older
 * single-crew assignments) sit in a short "Not in a dispatch" section so nothing disappears.
 */
import { useState } from 'react';
import { useLoad } from '../../lib/useLoad';
import { StateView } from '../../components/States';
import { link } from '../../components/Link';
import { Pill, statusTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { staffDisplayName, vehicleLabel } from '../../lib/staffVisuals';
import { ScreenProps } from '../ScreenProps';
import { displayTaskName } from '../../../../src/presentation/DisplayNames';
import type { DispatchRow } from '../../../../src/control/DispatchListController';

export type { DispatchRow };

const today = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });

/** One dispatch: shared by this list and the crew detail screen. `hideCrewId` drops the viewed member. */
export function DispatchRowView(props: { screen: ScreenProps; row: DispatchRow; hideCrewId?: string }): JSX.Element {
  const { row, screen } = props;
  const crew = row.crew.filter((member) => member.id !== props.hideCrewId);
  return (
    <li data-entity-id={row.id} data-part="dispatch-row" className="rounded-3xl border border-line bg-surface p-4">
      <strong data-part="dispatch-date">{row.date}</strong>{' '}
      <Pill tone={statusTone(row.status)}>{row.status}</Pill>
      {row.hqLocation ? <span data-part="dispatch-hq"> · {row.hqLocation}</span> : null}
      <span data-part="dispatch-vehicle"> · {row.vehicle ? vehicleLabel(row.vehicle) : 'No vehicle'}</span>
      <div data-part="dispatch-crew">
        {props.hideCrewId ? 'With: ' : 'Crew: '}
        {crew.length === 0 ? 'nobody else' : crew.map((member, index) => (
          <span key={member.id}>
            {index ? ', ' : ''}
            <a href={`/ops/staff/${member.id}`} onClick={link(screen, `/ops/staff/${member.id}`)}>
              {staffDisplayName(member.email, undefined, member.displayName)}
            </a>
          </span>
        ))}
      </div>
      <details data-part="dispatch-stops">
        <summary>{row.stops.length} stop{row.stops.length === 1 ? '' : 's'}</summary>
        <ol>
          {row.stops.map((stop) => (
            <li key={stop.workOrderId}>
              <a href={`/ops/work-orders/${stop.workOrderId}`} onClick={link(screen, `/ops/work-orders/${stop.workOrderId}`)}>
                {displayTaskName(stop.taskType ?? 'Task', stop.pestType ?? undefined, stop.location)}
              </a>
              {stop.status ? <> <Pill tone={statusTone(stop.status)}>{label(stop.status)}</Pill></> : null}
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

export function DispatchListScreen(props: ScreenProps): JSX.Element {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState('');
  const [status, setStatus] = useState('');
  const query = `from=${encodeURIComponent(from)}${to ? `&to=${encodeURIComponent(to)}` : ''}`;
  const { state, value, retry } = useLoad<{ dispatches: DispatchRow[]; notInDispatch: DispatchRow[] }>(
    props.api, `/api/ops/dispatches?${query}`,
    { isEmpty: (v) => v.dispatches.length + v.notInDispatch.length === 0, emptyMessage: 'No dispatches in this date range.' },
  );
  const keep = (rows: DispatchRow[]) => rows.filter((row) => status === '' || row.status === status);

  return (
    <section data-screen="DispatchList" data-requirement="11.2.25">
      <h1 className="text-2xl font-bold tracking-tight sm:text-[2rem]">Dispatches</h1>
      <a href="/ops/work-orders/new" onClick={link(props, '/ops/work-orders/new')} className="inline-flex min-h-11 items-center rounded-full bg-accent-fill px-5 font-bold text-white no-underline hover:bg-accent-dark">New work order</a>
      <div data-part="filters" className="my-4 flex flex-wrap items-center gap-2">
        <label htmlFor="from">From</label>
        <input id="from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        <label htmlFor="to">To</label>
        <input id="to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <label htmlFor="status">Status</label>
        <select id="status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Any status</option>
          <option value="Assigned">Assigned</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>
      <StateView state={state} onRetry={retry}>
        {value == null ? null : (
          <>
            <ul data-part="dispatches">
              {keep(value.dispatches).map((row) => <DispatchRowView key={row.id} screen={props} row={row} />)}
            </ul>
            {keep(value.notInDispatch).length === 0 ? null : (
              <section data-part="not-in-dispatch">
                <h2>Not in a dispatch</h2>
                <ul>{keep(value.notInDispatch).map((row) => <DispatchRowView key={row.id} screen={props} row={row} />)}</ul>
              </section>
            )}
          </>
        )}
      </StateView>
    </section>
  );
}
