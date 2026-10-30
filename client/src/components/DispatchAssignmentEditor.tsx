import { useState } from 'react';
import { ApiClient, ApiError } from '../lib/ApiClient';
import { staffDisplayName, staffPhotoUrl, vehicleLabel } from '../lib/staffVisuals';
import { cleanTitle } from '../../../src/presentation/DisplayNames';

interface CrewOption { id: string; email: string; displayName?: string | null }
interface VehicleOption { id: string; name: string; model?: string | null; photoUrl?: string | null; registration: string }
interface AssignmentOptions {
  crew: CrewOption[]; vehicles: VehicleOption[]; requiredStaff: number; computedAt: string;
  /** Staff each stop needs, keyed by work order id. */
  stopStaff?: Record<string, number>;
}
/** One stop the manager can order, add or remove. */
export interface DispatchStop { workOrderId: string; label: string }
interface SavedAssignment {
  id: string; teamId: string; crewIds: string[]; vehicleId: string; workOrderIds: string[]; status: string; needsRoadCheck?: boolean;
  crew?: CrewOption[];
  routeSnapshot: { depotLocation?: string; waypointOrder: Array<{ isHq?: boolean; workOrderId?: string; label: string; locality?: string }> };
}
type Saved = { id: string; workOrderIds: string[] };

const failureText = (error: unknown, fallback: string): string => error instanceof ApiError ? error.failure.error : fallback;

export function DispatchAssignmentEditor(props: {
  api: ApiClient; date: string; teamId: string; proposedCrewIds: string[]; proposedVehicleId?: string;
  /** The planned stops in order. Without it the planned route is saved as proposed. */
  stops?: DispatchStop[];
  /** Unassigned tasks the manager may add. */
  candidates?: DispatchStop[];
  /** Set to edit a saved dispatch instead of creating one. */
  assignmentId?: string;
  onAssigned: (result: Saved) => void;
}): JSX.Element {
  const [options, setOptions] = useState<AssignmentOptions | null>(null);
  const [crewIds, setCrewIds] = useState<string[]>([]);
  const [vehicleId, setVehicleId] = useState('');
  const [stops, setStops] = useState<DispatchStop[]>(props.stops ?? []);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [assigned, setAssigned] = useState(false);
  const editing = props.assignmentId !== undefined;
  // The server's rule: the planned crew size for the unchanged plan, otherwise the largest staff need of any stop.
  const changed = editing || stops.map((stop) => stop.workOrderId).join() !== (props.stops ?? []).map((stop) => stop.workOrderId).join();
  const requiredStaff = !options ? 0 : props.stops && changed
    ? Math.max(1, ...stops.map((stop) => options.stopStaff?.[stop.workOrderId] ?? 1)) : options.requiredStaff;
  const addable = (props.candidates ?? []).filter((task) => !stops.some((stop) => stop.workOrderId === task.workOrderId));
  async function load(): Promise<void> {
    setBusy(true); setFailure(null);
    try {
      const query = new URLSearchParams({ date: props.date, teamId: props.teamId, ...(editing ? { assignmentId: props.assignmentId! } : {}) });
      const value = await props.api.get<AssignmentOptions>(`/api/ops/dispatch/assignment-options?${query}`);
      setOptions(value);
      const proposed = props.proposedCrewIds.filter((id) => value.crew.some((member) => member.id === id));
      setCrewIds(proposed.length >= value.requiredStaff ? proposed : value.crew.slice(0, value.requiredStaff).map((member) => member.id));
      setVehicleId(value.vehicles.some((vehicle) => vehicle.id === props.proposedVehicleId) ? props.proposedVehicleId! : value.vehicles[0]?.id ?? '');
    } catch (error) { setFailure(failureText(error, 'Assignment options could not be loaded. Try again.')); }
    finally { setBusy(false); }
  }
  function move(index: number, by: number): void {
    setStops((previous) => {
      const next = [...previous];
      [next[index], next[index + by]] = [next[index + by]!, next[index]!];
      return next;
    });
  }
  async function save(): Promise<void> {
    if (!options) return;
    setBusy(true); setFailure(null);
    const workOrderIds = stops.map((stop) => stop.workOrderId);
    try {
      const result = editing
        ? await props.api.post<Saved>('/api/ops/dispatch/assignment-edit', { date: props.date, assignmentId: props.assignmentId, crewIds, vehicleId, workOrderIds })
        : await props.api.post<Saved>('/api/ops/dispatch/assign', {
          date: props.date, teamId: props.teamId, crewIds, vehicleId, computedAt: options.computedAt, ...(props.stops ? { workOrderIds } : {}) });
      setAssigned(true);
      props.onAssigned(result);
    } catch (error) { setFailure(failureText(error, 'The dispatch could not be saved. Reload the options and try again.')); }
    finally { setBusy(false); }
  }
  return <section className="dispatch-assignment-editor" data-part="dispatch-assignment" aria-label={editing ? 'Edit dispatch' : 'Dispatch assignment'}>
    <h3>{editing ? 'Edit dispatch' : 'Assignment'}</h3>
    {failure ? <p role="alert">{failure}</p> : null}
    {assigned ? <p role="status">{editing ? 'Dispatch updated. Route, crew and vehicle saved.' : 'Dispatch assigned. Crew and vehicle saved.'}</p> : <>
      <button type="button" disabled={busy} onClick={() => void load()}>{options ? 'Reload assignment options' : editing ? 'Edit this dispatch' : 'Choose crew and vehicle'}</button>
      {options ? <>
        {props.stops ? <fieldset><legend>Stops · in visit order</legend>
          <ol className="dispatch-stop-list">{stops.map((stop, index) => <li key={stop.workOrderId}>
            <span>{stop.label}</span>
            <button type="button" aria-label={`Move ${stop.label} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}>Up</button>
            <button type="button" aria-label={`Move ${stop.label} down`} disabled={busy || index === stops.length - 1} onClick={() => move(index, 1)}>Down</button>
            <button type="button" aria-label={`Remove ${stop.label}`} disabled={busy || stops.length === 1}
              onClick={() => setStops((previous) => previous.filter((item) => item.workOrderId !== stop.workOrderId))}>Remove</button>
          </li>)}</ol>
          {addable.length ? <label>Add task{' '}
            <select value={adding} disabled={busy} onChange={(event) => setAdding(event.target.value)}>
              <option value="">Choose an unassigned task</option>
              {addable.map((task) => <option key={task.workOrderId} value={task.workOrderId}>{task.label}</option>)}
            </select>
            <button type="button" disabled={busy || !adding} onClick={() => {
              const task = addable.find((item) => item.workOrderId === adding);
              if (task) setStops((previous) => [...previous, task]);
              setAdding('');
            }}>Add task</button>
          </label> : null}
        </fieldset> : null}
        <fieldset><legend>Crew · at least {requiredStaff}</legend>
          <div className="dispatch-crew-options">{options.crew.map((member) => <label key={member.id}>
            <input type="checkbox" value={member.id} checked={crewIds.includes(member.id)} disabled={busy}
              onChange={(event) => setCrewIds((previous) => event.target.checked ? [...previous, member.id] : previous.filter((id) => id !== member.id))} />
            <img src={staffPhotoUrl(member.email, 'CleaningCrew')} alt="Reference portrait" />
            <a href={`/ops/staff/${member.id}`}>{staffDisplayName(member.email, 'CleaningCrew', member.displayName)}</a>
          </label>)}</div>
          {!options.crew.length ? <p>No eligible crew is available.</p> : null}
        </fieldset>
        <fieldset><legend>Vehicle</legend>
          <div className="dispatch-vehicle-options">{options.vehicles.map((vehicle) => <label key={vehicle.id}>
            <input type="radio" name={`dispatch-vehicle-${props.assignmentId ?? props.teamId}`} value={vehicle.id} checked={vehicleId === vehicle.id} disabled={busy}
              onChange={() => setVehicleId(vehicle.id)} />
            {vehicle.photoUrl ? <img src={vehicle.photoUrl} alt={`${vehicle.model || 'Vehicle'} model reference`} /> : null}
            <span>{vehicleLabel(vehicle)}</span>
          </label>)}</div>
          {!options.vehicles.length ? <p>No suitable HQ vehicle is available.</p> : null}
        </fieldset>
        <button type="button" disabled={busy || crewIds.length < requiredStaff || !vehicleId || (!!props.stops && !stops.length)}
          onClick={() => void save()}>{editing ? 'Save changes' : 'Assign dispatch'}</button>
      </> : null}
    </>}
  </section>;
}

/** HQ and crew names for a saved dispatch; the raw team id only when neither is recorded. */
const teamName = (item: SavedAssignment): string => [item.routeSnapshot.depotLocation ? `${cleanTitle(item.routeSnapshot.depotLocation, 'Field')} HQ` : '',
  (item.crew ?? []).map((member) => staffDisplayName(member.email, 'CleaningCrew', member.displayName)).join(', ')]
  .filter(Boolean).join(' · ') || cleanTitle(item.teamId, 'Field team');

/** Saved dispatches for a day, each with an Edit button that opens the same editor. */
export function SavedDispatches(props: { api: ApiClient; date: string; candidates: DispatchStop[]; onSaved: (result: Saved) => void }): JSX.Element {
  const [saved, setSaved] = useState<SavedAssignment[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  async function load(): Promise<void> {
    setFailure(null);
    try { setSaved((await props.api.get<{ assignments: SavedAssignment[] }>(`/api/ops/dispatch/assignments?${new URLSearchParams({ date: props.date })}`)).assignments); }
    catch (error) { setFailure(failureText(error, 'Saved dispatches could not be loaded. Try again.')); }
  }
  return <section className="dispatch-saved" data-part="saved-dispatches" aria-label="Saved dispatches">
    <button type="button" onClick={() => void load()}>{saved ? 'Reload saved dispatches' : 'Show saved dispatches'}</button>
    {failure ? <p role="alert">{failure}</p> : null}
    {saved && !saved.length ? <p>No dispatch is saved for this date.</p> : null}
    {saved?.map((item) => {
      const stops = item.routeSnapshot.waypointOrder.filter((stop) => !stop.isHq && stop.workOrderId)
        .map((stop) => ({ workOrderId: stop.workOrderId!, label: cleanTitle(stop.locality || stop.label, 'Task') }));
      return <article key={item.id} data-assignment-id={item.id}>
        <p><strong>{teamName(item)}</strong> · {stops.length} stops · {item.status === 'Cancelled' ? 'Cancelled' : item.status}
          {item.needsRoadCheck && item.status !== 'Cancelled' ? <span role="note"> · Road check needed: edit and save to re-verify the route</span> : null}</p>
        {item.status === 'Assigned' ? <button type="button" onClick={() => setOpen(open === item.id ? null : item.id)}>{open === item.id ? 'Close editor' : 'Edit'}</button> : null}
        {open === item.id ? <DispatchAssignmentEditor api={props.api} date={props.date} teamId={item.teamId} assignmentId={item.id}
          proposedCrewIds={item.crewIds} proposedVehicleId={item.vehicleId} stops={stops} candidates={props.candidates}
          onAssigned={(result) => { props.onSaved(result); void load(); }} /> : null}
      </article>;
    })}
  </section>;
}
