/**
 * D-Fence — Crew member detail (11.2.22).
 * Stereotype: <<boundary>>. Manager only.
 *
 * Every stored profile field, then the dispatches this person is on: upcoming (today onwards) and
 * past. Each stop opens its work order.
 */
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ApiError } from '../../lib/ApiClient';
import { useLoad } from '../../lib/useLoad';
import { ConfirmDialog, StateView, Toast } from '../../components/States';
import { link } from '../../components/Link';
import { Facts, Pill, statusTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { staffDisplayName } from '../../lib/staffVisuals';
import { SPECIALISATION_LABEL, specialisationLabel } from '../../lib/dispatchRouting';
import { HqLocation, Role, StaffSpecialisation, StaffStatus } from '../../../../src/entity/enums';
import { HQ_LABEL } from './StaffAccountsScreen';
import { ScreenProps } from '../ScreenProps';
import { DispatchRow, DispatchRowView } from './DispatchListScreen';

interface CrewDetailPayload {
  staff: {
    id: string;
    email: string;
    displayName: string | null;
    profileDescription?: string | null;
    role: string;
    isActive: boolean;
    specialisation?: string | null;
    hqLocation?: string | null;
    staffStatus?: string | null;
    onCallLagHours?: number | null;
    createdAt?: string | null;
  };
  dispatches: DispatchRow[];
}

const today = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Singapore' });

export function CrewDetailScreen(props: ScreenProps): JSX.Element {
  const id = props.params['id'] ?? '';
  const { state, value, retry } = useLoad<CrewDetailPayload>(props.api, `/api/ops/staff/${id}`);
  const member = value?.staff;
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  async function run(path: string, body: unknown, done: string): Promise<void> {
    setBusy(true);
    try {
      await props.api.post(`/api/ops/staff/${id}/${path}`, body);
      setToast(done);
      retry();
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setToast(`${f?.error ?? 'that could not be done'} — ${f?.remedy ?? 'try again shortly'}`);
    } finally {
      setBusy(false);
    }
  }
  const now = today();
  const upcoming = (value?.dispatches ?? []).filter((row) => row.date >= now).reverse();
  const past = (value?.dispatches ?? []).filter((row) => row.date < now);
  const list = (rows: DispatchRow[], empty: string) => rows.length === 0 ? <p>{empty}</p> : (
    <ul>{rows.map((row) => <DispatchRowView key={row.id} screen={props} row={row} hideCrewId={id} />)}</ul>
  );

  return (
    <section data-screen="CrewDetail" data-requirement="11.2.22">
      <a href="/ops/staff" onClick={link(props, '/ops/staff')} className="mb-3 inline-flex min-h-11 items-center gap-1.5 font-medium no-underline hover:underline"><ArrowLeft size={16} aria-hidden="true" />Back to staff</a>
      <StateView state={state} onRetry={retry}>
        {member == null ? null : (
          <article data-entity-id={member.id}>
            <h1 className="text-2xl sm:text-[2rem]">
              <span data-part="entity-title">{staffDisplayName(member.email, member.role, member.displayName)}</span>{' '}
              <Pill tone={member.isActive ? 'good' : 'neutral'}>{member.isActive ? 'Active' : 'Deactivated'}</Pill>
            </h1>
            <Facts
              items={[
                { label: 'Email', value: member.email, part: 'email' },
                { label: 'Role', value: label(member.role), part: 'role' },
                { label: 'HQ', value: member.hqLocation ?? 'Not recorded', part: 'hq' },
                { label: 'Staff status', value: member.staffStatus ? <Pill tone={statusTone(member.staffStatus)}>{label(member.staffStatus)}</Pill> : 'Not recorded', part: 'staff-status' },
                { label: 'On-call lag', value: member.onCallLagHours == null ? 'Not recorded' : `${member.onCallLagHours} h`, part: 'on-call-lag' },
                { label: 'Capabilities', value: specialisationLabel(member.specialisation), part: 'specialisation' },
                { label: 'Created', value: member.createdAt ? member.createdAt.slice(0, 10) : 'Not recorded', part: 'created' },
                { label: 'Profile', value: member.profileDescription || 'No profile description.', part: 'profile', wide: true },
              ]}
            />
            {member.role !== Role.CleaningCrew && member.role !== Role.OperationsManager ? null : (
              <section data-part="edit-controls" aria-label="Edit staff record" className="my-4 flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6 [&_button]:self-start [&_label]:flex [&_label]:flex-col [&_label]:gap-1 [&_label]:font-medium">
                <h2>Edit</h2>
                <label>Name<input aria-label={`Recorded name for ${member.email}`} maxLength={120}
                  value={nameDraft ?? member.displayName ?? ''} onChange={(e) => setNameDraft(e.target.value)} /></label>
                <label>Notes<textarea aria-label={`Staff notes for ${member.email}`} maxLength={500}
                  value={notesDraft ?? member.profileDescription ?? ''} onChange={(e) => setNotesDraft(e.target.value)} /></label>
                <button type="button" disabled={busy} onClick={() => void run('display-name',
                  { displayName: nameDraft ?? member.displayName ?? null, profileDescription: notesDraft ?? member.profileDescription ?? null },
                  'Staff profile saved.')}>Save profile</button>
                {member.role === Role.CleaningCrew ? (
                  <select aria-label={`Capability for ${member.email}`} value={member.specialisation ?? ''} disabled={busy}
                    onChange={(e) => { if (e.target.value !== '') void run('specialisation', { specialisation: e.target.value },
                      `${member.email} recorded as ${specialisationLabel(e.target.value)}.`); }}>
                    {member.specialisation == null ? <option value="">{specialisationLabel(null)}</option> : null}
                    {Object.values(StaffSpecialisation).map((s) => <option key={s} value={s}>{SPECIALISATION_LABEL[s]}</option>)}
                  </select>
                ) : null}
                <select aria-label={`HQ location for ${member.email}`} value={member.hqLocation ?? ''} disabled={busy}
                  onChange={(e) => { if (e.target.value) void run('hq-location', { hqLocation: e.target.value },
                    `${member.email} assigned to ${HQ_LABEL[e.target.value as HqLocation]}.`); }}>
                  {!member.hqLocation ? <option value="">Assign HQ</option> : null}
                  {Object.values(HqLocation).map((hq) => <option key={hq} value={hq}>{HQ_LABEL[hq]}</option>)}
                </select>
                <select aria-label={`Readiness status for ${member.email}`} value={member.staffStatus ?? StaffStatus.Available}
                  disabled={busy || !member.isActive}
                  onChange={(e) => void run('status', { status: e.target.value }, `${member.email} status updated to ${e.target.value}.`)}>
                  <option value={StaffStatus.Available}>Available</option>
                  <option value={StaffStatus.OnCall}>On Call (2h lag)</option>
                  <option value={StaffStatus.Unavailable}>Unavailable</option>
                  <option value={StaffStatus.Dispatched}>Dispatched</option>
                </select>
                {member.isActive ? (
                  <button type="button" data-variant="danger" disabled={busy} onClick={() => setConfirming(true)}
                    aria-label={`Deactivate ${member.email}`}>Deactivate</button>
                ) : (
                  <button type="button" disabled={busy} aria-label={`Reactivate ${member.email}`}
                    onClick={() => void run('reactivate', {}, `${member.email} reactivated.`)}>Reactivate account</button>
                )}
              </section>
            )}
            <section data-part="upcoming-dispatches" className="my-4 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
              <h2>Upcoming dispatches</h2>
              {list(upcoming, 'No upcoming dispatches.')}
            </section>
            <section data-part="past-dispatches" className="my-4 rounded-3xl border border-line bg-surface p-5 shadow-sm sm:p-6">
              <h2>Past dispatches</h2>
              {list(past, 'No past dispatches.')}
            </section>
          </article>
        )}
      </StateView>
      {!confirming || member == null ? null : (
        <ConfirmDialog
          title={`Deactivate ${member.email}?`}
          body="They will be signed out immediately, on every device, even if they are recording work right now. Their past work orders are kept."
          confirmLabel="Deactivate"
          onConfirm={() => { setConfirming(false); void run('deactivate', {}, `${member.email} deactivated.`); }}
          onDismiss={() => setConfirming(false)}
        />
      )}
      {toast === null ? null : <Toast message={toast} />}
    </section>
  );
}
