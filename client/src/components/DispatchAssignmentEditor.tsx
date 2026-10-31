import { useState } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
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
export interface DispatchStop { workOrderId: string; label: string; taskType?: string; pestType?: string }

/** "<locality> - <task type> - <pest>", leaving out what the client does not have. */
const optionLabel = (task: DispatchStop): string =>
  [task.label, cleanTitle(task.taskType, ''), cleanTitle(task.pestType, '')].filter(Boolean).join(' - ');

const BinIcon = (): JSX.Element => <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" focusable="false" />;
const GripIcon = (): JSX.Element => <GripVertical size={18} strokeWidth={1.5} aria-hidden="true" focusable="false" />;
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
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newLocality, setNewLocality] = useState('');
  const [newTaskType, setNewTaskType] = useState('Inspection');
  const [newPestType, setNewPestType] = useState('Mosquito');
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
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
  function drop(target: number): void {
    const from = dragFrom;
    setDragFrom(null); setDragOver(null);
    if (from === null || from === target) return;
    setStops((previous) => {
      const next = [...previous];
      const [moved] = next.splice(from, 1);
      next.splice(target, 0, moved!);
      return next;
    });
  }
  async function createAndAddTask(): Promise<void> {
    if (!newLocality.trim()) return;
    setBusy(true); setFailure(null);
    try {
      const created = await props.api.post<{ id: string }>('/api/ops/work-orders', {
        taskType: newTaskType,
        pestType: newPestType,
        scheduledDate: props.date,
        instructions: `Field task at ${newLocality.trim()}`,
      });
      const newStop: DispatchStop = {
        workOrderId: created.id,
        label: `${newLocality.trim()} · ${cleanTitle(newTaskType, '')}`,
        taskType: newTaskType,
        pestType: newPestType,
      };
      setStops((prev) => [...prev, newStop]);
      setNewLocality('');
      setShowNewTaskForm(false);
    } catch (error) {
      setFailure(failureText(error, 'Could not create task.'));
    } finally {
      setBusy(false);
    }
  }

  async function save(): Promise<void> {
    if (!options) return;
    setBusy(true); setFailure(null);
    const workOrderIds = stops.map((stop) => stop.workOrderId);
    try {
      const result = editing
        ? await props.api.post<Saved>('/api/ops/dispatch/assignment-edit', { date: props.date, assignmentId: props.assignmentId, crewIds, vehicleId, workOrderIds })
        : await props.api.post<Saved>('/api/ops/dispatch/assign', {
          date: props.date, teamId: props.teamId, crewIds, vehicleId, computedAt: options.computedAt, workOrderIds });
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
        {props.stops !== undefined ? <fieldset><legend>Stops · in visit order</legend>
          {stops.length === 0 ? <p className="text-sm text-ink-quiet py-2">No stops added yet. Choose an unassigned task or create a new task below.</p> : null}
          <ol className="dispatch-stop-list">{stops.map((stop, index) => <li key={stop.workOrderId} draggable={!busy}
            data-dragging={dragFrom === index || undefined} data-drop-target={dragOver === index && dragFrom !== index || undefined}
            onDragStart={(event) => { setDragFrom(index); event.dataTransfer?.setData('text/plain', stop.workOrderId); }}
            onDragOver={(event) => { if (dragFrom === null) return; event.preventDefault(); setDragOver(index); }}
            onDrop={(event) => { event.preventDefault(); drop(index); }}
            onDragEnd={() => { setDragFrom(null); setDragOver(null); }}>
            <span className="dispatch-drag-handle" title="Drag to reorder" aria-hidden="true"><GripIcon /></span>
            <span className="dispatch-stop-label">{stop.label}</span>
            <button type="button" aria-label={`Move ${stop.label} up`} disabled={busy || index === 0} onClick={() => move(index, -1)}>Up</button>
            <button type="button" aria-label={`Move ${stop.label} down`} disabled={busy || index === stops.length - 1} onClick={() => move(index, 1)}>Down</button>
            <button type="button" className="dispatch-bin" aria-label={`Remove ${stop.label}`} title={`Remove ${stop.label}`} disabled={busy || stops.length === 1}
              onClick={() => setStops((previous) => previous.filter((item) => item.workOrderId !== stop.workOrderId))}><BinIcon /></button>
          </li>)}</ol>
          {addable.length ? <label className="dispatch-add-task">Add task{' '}
            <select value={adding} disabled={busy} onChange={(event) => setAdding(event.target.value)}>
              <option value="">Choose an unassigned task</option>
              {addable.map((task) => <option key={task.workOrderId} value={task.workOrderId}>{optionLabel(task)}</option>)}
            </select>
            <button type="button" disabled={busy || !adding} onClick={() => {
              const task = addable.find((item) => item.workOrderId === adding);
              if (task) setStops((previous) => [...previous, task]);
              setAdding('');
            }}>Add task</button>
          </label> : null}
          <div className="dispatch-create-task-block mt-3 border-t border-line pt-2">
            {!showNewTaskForm ? (
              <button type="button" className="text-xs" disabled={busy} onClick={() => setShowNewTaskForm(true)}>
                + Create new task for this dispatch
              </button>
            ) : (
              <div className="grid gap-2 rounded-xl border border-line bg-surface p-3 text-sm my-2">
                <div className="flex items-center justify-between">
                  <strong>Create new task</strong>
                  <button type="button" className="text-xs" onClick={() => setShowNewTaskForm(false)}>Cancel</button>
                </div>
                <label className="flex flex-col gap-1">Location description
                  <input maxLength={100} placeholder="e.g. Blk 123 Tampines St 11" value={newLocality} onChange={(e) => setNewLocality(e.target.value)} disabled={busy} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex flex-col gap-1">Task type
                    <select value={newTaskType} onChange={(e) => setNewTaskType(e.target.value)} disabled={busy}>
                      <option value="Inspection">Inspection</option>
                      <option value="Fogging">Fogging</option>
                      <option value="Larviciding">Larviciding</option>
                      <option value="SourceReduction">Source Reduction</option>
                      <option value="RefuseRemoval">Refuse Removal</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">Pest type
                    <select value={newPestType} onChange={(e) => setNewPestType(e.target.value)} disabled={busy}>
                      <option value="Mosquito">Mosquito</option>
                      <option value="Rat">Rat</option>
                      <option value="Cockroach">Cockroach</option>
                      <option value="AsianHornetWasp">Hornet / Wasp</option>
                    </select>
                  </label>
                </div>
                <button type="button" disabled={busy || !newLocality.trim()} onClick={() => void createAndAddTask()}>
                  {busy ? 'Creating...' : 'Create & add to dispatch'}
                </button>
              </div>
            )}
          </div>
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
