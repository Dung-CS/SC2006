/**
 * D-Fence — Staff Accounts (REQUIREMENTS.md 11.2.22).
 * Stereotype: <<boundary>>. Traces: 11.2.22, 2.2.1–2.2.6, 2.3.4, 11.4.6, 10.5.3.
 */
import { useState } from 'react';
import { ApiError } from '../../lib/ApiClient';
import { useLoad } from '../../lib/useLoad';
import { ConfirmDialog, StateView, Toast } from '../../components/States';
import { Field, field, FormField } from '../../components/Field';
import { emailRule, evaluate, formIsValid, passwordRules, required } from '../../components/FieldValidation';
import { HqLocation, Role, StaffSpecialisation, StaffStatus } from '../../../../src/entity/enums';
import { Pill } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { staffPhotoUrl, staffDisplayName, staffRoleLocationLabel } from '../../lib/staffVisuals';
import { SPECIALISATION_LABEL, specialisationLabel } from '../../lib/dispatchRouting';
import { Pagination, usePagination } from '../../components/Pagination';
import { link } from '../../components/Link';
import { ScreenProps } from '../ScreenProps';

interface StaffMember {
  id: string;
  email: string;
  displayName?: string | null;
  profileDescription?: string | null;
  role: string;
  isActive: boolean;
  specialisation?: StaffSpecialisation | null;
  hqLocation?: HqLocation | null;
  staffStatus?: StaffStatus;
  onCallLagHours?: number;
}

interface StaffPayload {
  staff: StaffMember[];
}

interface WorkloadPayload {
  crew: Array<{ crewId: string; openWorkOrders: number }>;
}

const HQ_LABEL: Record<HqLocation, string> = {
  [HqLocation.Central]: 'Central Regional Office',
  [HqLocation.NorthEast]: 'Eastern Regional Office',
  [HqLocation.NorthWest]: 'North-West Regional Office',
  [HqLocation.SouthEast]: 'South-East Regional Office',
  [HqLocation.SouthWest]: 'South-West Regional Office',
};

export function StaffAccountsScreen(props: ScreenProps): JSX.Element {
  const { state, value, retry } = useLoad<StaffPayload>(props.api, '/api/ops/staff', {
    isEmpty: (v) => v.staff.length === 0,
    emptyMessage: 'No staff accounts exist yet.',
  });
  const workload = useLoad<WorkloadPayload>(props.api, '/api/ops/work-orders/crew-workload');
  const [pending, setPending] = useState<{ id: string; email: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<FormField>(field());
  const [password, setPassword] = useState<FormField>(field());
  const [displayName, setDisplayName] = useState('');
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [profileDescription, setProfileDescription] = useState('');
  const [descriptionDrafts, setDescriptionDrafts] = useState<Record<string, string>>({});
  const [role, setRole] = useState<Role>(Role.CleaningCrew);
  // Capability and HQ are compulsory during creation
  const [specialisation, setSpecialisation] = useState<StaffSpecialisation | ''>(StaffSpecialisation.VectorControl);
  const [hqLocation, setHqLocation] = useState<HqLocation | ''>('');
  const [creationTouched, setCreationTouched] = useState(false);
  const [hqFilter, setHqFilter] = useState<HqLocation | 'All' | null>(null);
  const [specFilter, setSpecFilter] = useState<StaffSpecialisation | null>(null);
  const [failure, setFailure] = useState<{ cause: string; remedy: string } | null>(null);

  const emailRules = [required('Email'), emailRule()];
  const pwRules = [required('Password'), ...passwordRules()];

  const specError = false;
  const hqError = hqLocation === '';
  const canCreate =
    formIsValid([evaluate(email.value, emailRules), evaluate(password.value, pwRules)]) &&
    !specError &&
    !hqError;

  async function create(event: { preventDefault: () => void }): Promise<void> {
    event.preventDefault();
    setCreationTouched(true);
    setEmail((f) => ({ ...f, touched: true }));
    setPassword((f) => ({ ...f, touched: true }));

    if (!canCreate || busy) {
      if (specError || hqError) {
        setFailure({
          cause: 'Capability and Regional HQ are compulsory.',
          remedy: 'Please select both capability and regional HQ depot before submitting.',
        });
      }
      return;
    }

    setBusy(true);
    setFailure(null);
    try {
      await props.api.post('/api/ops/staff', {
        email: email.value.trim(),
        displayName: displayName.trim() || null,
        profileDescription: profileDescription.trim() || null,
        role,
        password: password.value,
        ...(role === Role.CleaningCrew && specialisation !== '' ? { specialisation } : {}),
        hqLocation,
      });
      setToast(
        `${email.value.trim()} created as ${role === Role.CleaningCrew ? 'Cleaning Crew' : 'Operations Manager'}.`,
      );
      setEmail(field());
      setPassword(field());
      setDisplayName('');
      setProfileDescription('');
      setSpecialisation(StaffSpecialisation.VectorControl);
      setHqLocation('');
      setCreationTouched(false);
      retry();
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setFailure({
        cause: f?.error ?? 'the account could not be created',
        remedy: f?.remedy ?? 'check the details and try again',
      });
    } finally {
      setBusy(false);
    }
  }

  async function change(id: string, action: 'deactivate' | 'reactivate', email: string): Promise<void> {
    setPending(null);
    setBusy(true);
    try {
      const result = await props.api.post<{ sessionsEnded?: number }>(`/api/ops/staff/${id}/${action}`, {});
      setToast(
        action === 'reactivate'
          ? `${email} reactivated.`
          : `${email} deactivated; ${result.sessionsEnded ?? 0} session(s) ended.`,
      );
      retry();
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setToast(`${f?.error ?? 'that could not be done'} — ${f?.remedy ?? 'try again shortly'}`);
    } finally {
      setBusy(false);
    }
  }

  async function recordCapability(id: string, email: string, value: string): Promise<void> {
    setBusy(true);
    try {
      await props.api.post(`/api/ops/staff/${id}/specialisation`, { specialisation: value });
      setToast(`${email} recorded as ${specialisationLabel(value)}.`);
      retry();
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setToast(`${f?.error ?? 'that could not be done'} — ${f?.remedy ?? 'try again shortly'}`);
    } finally {
      setBusy(false);
    }
  }

  async function recordName(member: StaffMember): Promise<void> {
    setBusy(true);
    try {
      await props.api.post(`/api/ops/staff/${member.id}/display-name`, {
        displayName: nameDrafts[member.id] ?? member.displayName ?? null,
        profileDescription: descriptionDrafts[member.id] ?? member.profileDescription ?? null,
      });
      setToast('Staff profile saved.');
      retry();
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setToast(f?.error ?? 'The name could not be saved. Try again.');
    } finally { setBusy(false); }
  }

  async function recordHq(id: string, email: string, location: HqLocation): Promise<void> {
    setBusy(true);
    try {
      await props.api.post(`/api/ops/staff/${id}/hq-location`, { hqLocation: location });
      setToast(`${email} assigned to ${HQ_LABEL[location]}.`);
      retry();
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setToast(`${f?.error ?? 'that could not be done'} — ${f?.remedy ?? 'try again shortly'}`);
    } finally {
      setBusy(false);
    }
  }

  async function updateStaffStatus(id: string, email: string, newStatus: StaffStatus): Promise<void> {
    setBusy(true);
    try {
      await props.api.post(`/api/ops/staff/${id}/status`, { status: newStatus });
      setToast(`${email} status updated to ${newStatus}.`);
      retry();
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setToast(`${f?.error ?? 'status update failed'} — ${f?.remedy ?? 'try again shortly'}`);
    } finally {
      setBusy(false);
    }
  }

  const staff = value?.staff ?? [];
  const openCounts = new Map((workload.value?.crew ?? []).map((item) => [item.crewId, item.openWorkOrders]));
  const workloadReady = workload.state.kind === 'ready' || workload.state.kind === 'empty';

  const isAvailable = (member: StaffMember) =>
    workloadReady &&
    member.isActive &&
    (member.staffStatus === StaffStatus.Available || member.staffStatus === undefined) &&
    (openCounts.get(member.id) ?? 0) === 0;

  const isOnCall = (member: StaffMember) =>
    workloadReady && member.isActive && member.staffStatus === StaffStatus.OnCall;

  function getCellColorStyle(available: number, total: number): { background: string; color: string; border: string; fontWeight: string } {
    if (total === 0) return { background: '#f8fafc', color: '#64748b', border: '#e2e8f0', fontWeight: 'normal' };
    const pct = Math.round((available / total) * 100);
    if (pct >= 80) {
      return { background: '#dcfce7', color: '#166534', border: '#86efac', fontWeight: 'bold' }; // >=80% Green
    } else if (pct >= 50) {
      return { background: '#ecfdf5', color: '#065f46', border: '#a7f3d0', fontWeight: '600' }; // 50-79% Soft green
    } else if (pct > 0) {
      return { background: '#fef3c7', color: '#92400e', border: '#fde68a', fontWeight: '600' }; // 1-49% Amber
    } else {
      return { background: '#fee2e2', color: '#991b1b', border: '#fca5a5', fontWeight: 'bold' }; // 0% Alert Red
    }
  }

  const filteredStaff = staff.filter(
    (member) =>
      (hqFilter === null || hqFilter === 'All' || member.hqLocation === hqFilter) &&
      (specFilter === null || member.specialisation === specFilter),
  );

  const { currentPage, setCurrentPage, pageSize, totalItems, pagedItems } = usePagination(filteredStaff, 10);

  return (
    <section data-screen="StaffAccounts" data-requirement="11.2.22">
      <h1>Staff</h1>

      <section aria-label="Staff Availability Dashboard" data-part="availability-dashboard">
        <h2>Staff Availability Dashboard</h2>
        {!workloadReady ? (
          <p role="status">
            {workload.state.kind === 'error' ? 'Availability data could not be loaded.' : 'Loading availability…'}
          </p>
        ) : null}

        <table>
          <thead>
            <tr>
              <th scope="col">Capability</th>
              {Object.values(HqLocation).map((hq) => (
                <th key={hq} scope="col">
                  {hq}
                </th>
              ))}
              <th scope="col">All Locations</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(StaffSpecialisation).map((spec) => {
              const matching = staff.filter((member) => member.specialisation === spec);
              const allAvail = matching.filter(isAvailable).length;
              const allOnCall = matching.filter(isOnCall).length;
              const allTotal = matching.length;
              const allPct = allTotal > 0 ? Math.round((allAvail / allTotal) * 100) : 0;
              const allStyle = getCellColorStyle(allAvail, allTotal);

              return (
                <tr key={spec}>
                  <th scope="row">{SPECIALISATION_LABEL[spec]}</th>
                  {Object.values(HqLocation).map((hq) => {
                    const cell = matching.filter((member) => member.hqLocation === hq);
                    const availCount = cell.filter(isAvailable).length;
                    const onCallCount = cell.filter(isOnCall).length;
                    const total = cell.length;
                    const pct = total > 0 ? Math.round((availCount / total) * 100) : 0;
                    const style = getCellColorStyle(availCount, total);

                    return (
                      <td key={hq} style={{ padding: '4px' }}>
                        <button
                          type="button"
                          style={{
                            width: '100%',
                            padding: '6px 8px',
                            borderRadius: '6px',
                            background: style.background,
                            color: style.color,
                            border: `1.5px solid ${style.border}`,
                            fontWeight: style.fontWeight,
                            cursor: 'pointer',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '2px',
                          }}
                          aria-label={`${SPECIALISATION_LABEL[spec]}, ${hq}: ${availCount} available / ${total}`}
                          onClick={() => {
                            setSpecFilter(spec);
                            setHqFilter(hq);
                          }}
                        >
                          <span>{total > 0 ? `${availCount}/${total} (${pct}%)` : '0/0'}</span>
                          {onCallCount > 0 ? (
                            <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                              {onCallCount} on-call (2h lag)
                            </span>
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                  <td style={{ padding: '4px' }}>
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        background: allStyle.background,
                        color: allStyle.color,
                        border: `1.5px solid ${allStyle.border}`,
                        fontWeight: allStyle.fontWeight,
                        cursor: 'pointer',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                      aria-label={`${SPECIALISATION_LABEL[spec]}, all locations: ${allAvail} available / ${allTotal}`}
                      onClick={() => {
                        setSpecFilter(spec);
                        setHqFilter('All');
                      }}
                    >
                      <span>{allTotal > 0 ? `${allAvail}/${allTotal} (${allPct}%)` : '0/0'}</span>
                      {allOnCall > 0 ? (
                        <span style={{ fontSize: '0.72rem', opacity: 0.9 }}>
                          {allOnCall} on-call
                        </span>
                      ) : null}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* % Available Readiness Legend */}
        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            marginTop: '8px',
            fontSize: '0.82rem',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 600 }}>% Available Legend:</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: '#dcfce7', border: '1px solid #86efac' }} />
            &ge;80% Available (Optimal readiness)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: '#ecfdf5', border: '1px solid #a7f3d0' }} />
            50–79% Available (Good readiness)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: '#fef3c7', border: '1px solid #fde68a' }} />
            1–49% Available (Constrained)
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: 14, height: 14, borderRadius: 3, background: '#fee2e2', border: '1px solid #fca5a5' }} />
            0% Available (Fully Dispatched)
          </span>
        </div>

        <div aria-label="Quick filters" style={{ marginTop: '10px' }}>
          <button
            type="button"
            onClick={() => {
              setSpecFilter(null);
              setHqFilter(null);
            }}
          >
            All staff
          </button>
          {Object.values(HqLocation).map((hq) => (
            <button type="button" key={hq} aria-pressed={hqFilter === hq} onClick={() => setHqFilter(hq)}>
              {hq}
            </button>
          ))}
        </div>
      </section>

      <StateView state={state} onRetry={retry}>
        <div data-part="staff-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
            {pagedItems.map((member) => (
              <article key={member.id} data-entity-id={member.id} data-email={member.email} data-active={member.isActive} style={{ border: '1px solid #dbe3ea', borderRadius: 12, padding: 14, display: 'grid', gap: 12, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={staffPhotoUrl(member.email, member.role)} alt="" className="staff-avatar-img" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                  <div>
                    <a href={`/ops/staff/${member.id}`} onClick={link(props, `/ops/staff/${member.id}`)} data-part="crew-detail-link">
                      <strong data-part="entity-title">{staffDisplayName(member.email, member.role, member.displayName)}</strong>
                    </a>
                    <div className="staff-email-sub">{staffRoleLocationLabel(member.role, member.hqLocation)}</div>
                    <small data-part="identity">{member.email}</small>
                  </div>
                </div>
                <details>
                  <summary>Staff record</summary>
                  <label>Name<input aria-label={`Recorded name for ${member.email}`} maxLength={120}
                    value={nameDrafts[member.id] ?? member.displayName ?? ''}
                    onChange={(event) => setNameDrafts((previous) => ({ ...previous, [member.id]: event.target.value }))} /></label>
                  <label>Notes<textarea aria-label={`Staff notes for ${member.email}`} maxLength={500}
                    value={descriptionDrafts[member.id] ?? member.profileDescription ?? ''}
                    onChange={(event) => setDescriptionDrafts((previous) => ({ ...previous, [member.id]: event.target.value }))} /></label>
                  <button type="button" disabled={busy} onClick={() => void recordName(member)}>Save profile</button>
                </details>
                <div className="staff-role-cell" style={{ display: 'grid', gap: 8 }}>
                    <span className="staff-role-main">{label(member.role)}</span>
                    {member.role === Role.CleaningCrew ? (
                      <Pill tone={member.specialisation ? 'good' : 'neutral'}>
                        {member.specialisation ? SPECIALISATION_LABEL[member.specialisation] : specialisationLabel(null)}
                      </Pill>
                    ) : null}
                    {member.role === Role.CleaningCrew ? (
                      <select
                        className="staff-spec-tag"
                        aria-label={`Capability for ${member.email}`}
                        value={member.specialisation ?? ''}
                        disabled={busy}
                        onChange={(e) => {
                          if (e.target.value !== '') {
                            void recordCapability(member.id, member.email, e.target.value);
                          }
                        }}
                      >
                        {member.specialisation == null ? <option value="">{specialisationLabel(null)}</option> : null}
                        {Object.values(StaffSpecialisation).map((s) => (
                          <option key={s} value={s}>
                            {SPECIALISATION_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <span className="staff-hq-pill" data-part="hq">{member.hqLocation ? HQ_LABEL[member.hqLocation] : 'HQ unassigned'}</span>
                    <select
                      className="staff-hq-select"
                      aria-label={`HQ location for ${member.email}`}
                      value={member.hqLocation ?? ''}
                      disabled={busy}
                      onChange={(e) => {
                        if (e.target.value) void recordHq(member.id, member.email, e.target.value as HqLocation);
                      }}
                    >
                      {!member.hqLocation ? <option value="">Assign HQ</option> : null}
                      {Object.values(HqLocation).map((hq) => (
                        <option key={hq} value={hq}>
                          {HQ_LABEL[hq]}
                        </option>
                      ))}
                    </select>
                </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Pill
                      tone={
                        member.staffStatus === StaffStatus.Available
                          ? 'good'
                          : member.staffStatus === StaffStatus.OnCall
                          ? 'neutral'
                          : 'warn'
                      }
                    >
                      {member.staffStatus === StaffStatus.OnCall
                        ? `On Call (${member.onCallLagHours ?? 2}h lag)`
                        : member.staffStatus ?? StaffStatus.Available}
                    </Pill>
                    <select
                      className="staff-status-select"
                      aria-label={`Readiness status for ${member.email}`}
                      value={member.staffStatus ?? StaffStatus.Available}
                      disabled={busy || !member.isActive}
                      style={{ fontSize: '0.8rem', padding: '2px 4px', borderRadius: '4px' }}
                      onChange={(e) => void updateStaffStatus(member.id, member.email, e.target.value as StaffStatus)}
                    >
                      <option value={StaffStatus.Available}>Available</option>
                      <option value={StaffStatus.OnCall}>On Call (2h lag)</option>
                      <option value={StaffStatus.Unavailable}>Unavailable</option>
                      <option value={StaffStatus.Dispatched}>Dispatched</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <Pill tone={member.isActive ? 'good' : 'neutral'}>{member.isActive ? 'Active' : 'Deactivated'}</Pill>
                    {member.isActive ? (
                      <button type="button" data-variant="danger" disabled={busy} onClick={() => setPending({ id: member.id, email: member.email })} aria-label={`Deactivate ${member.email}`}>Deactivate</button>
                    ) : (
                      <button type="button" aria-label={`Reactivate ${member.email}`} disabled={busy} onClick={() => void change(member.id, 'reactivate', member.email)}>Reactivate account</button>
                    )}
                  </div>
              </article>
            ))}
        </div>

        <Pagination
          currentPage={currentPage}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          itemName="staff accounts"
        />
      </StateView>

      {/* Adding staff account with compulsory capability & HQ */}
      <form onSubmit={create} noValidate data-part="create">
        <h2>Add a staff account</h2>
        <label htmlFor="staff-display-name">Name</label>
        <input id="staff-display-name" maxLength={120} value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        <label htmlFor="staff-profile-description">Notes</label>
        <textarea id="staff-profile-description" maxLength={500} value={profileDescription} onChange={(event) => setProfileDescription(event.target.value)} />
        <Field
          id="staff-email"
          label="Email"
          type="email"
          value={email.value}
          touched={email.touched}
          rules={emailRules}
          onChange={(v) => setEmail({ value: v, touched: email.touched })}
        />
        <label htmlFor="staff-role">Role</label>
        <select id="staff-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value={Role.CleaningCrew}>Cleaning Crew</option>
          <option value={Role.OperationsManager}>Operations Manager</option>
        </select>

        {role === Role.CleaningCrew ? (
          <>
            <label htmlFor="staff-specialisation">Capability</label>
            <select
              id="staff-specialisation"
              value={specialisation}
              required
              onChange={(e) => setSpecialisation(e.target.value as StaffSpecialisation | '')}
            >
              <option value="">Select Capability (Required)</option>
              {Object.values(StaffSpecialisation).map((s) => (
                <option key={s} value={s}>
                  {SPECIALISATION_LABEL[s]}
                </option>
              ))}
            </select>
            {creationTouched && specError ? (
              <span className="field-error" style={{ color: '#dc2626', fontSize: '0.85rem' }}>
                Capability is compulsory for Cleaning Crew.
              </span>
            ) : null}
          </>
        ) : null}

        <label htmlFor="staff-hq">HQ Location</label>
        <select
          id="staff-hq"
          value={hqLocation}
          required
          onChange={(e) => setHqLocation(e.target.value as HqLocation | '')}
        >
          <option value="">Select Regional HQ (Required)</option>
          {Object.values(HqLocation).map((hq) => (
            <option key={hq} value={hq}>
              {HQ_LABEL[hq]}
            </option>
          ))}
        </select>
        {creationTouched && hqError ? (
          <span className="field-error" style={{ color: '#dc2626', fontSize: '0.85rem' }}>
            Regional HQ depot is compulsory.
          </span>
        ) : null}

        <Field
          id="staff-password"
          label="Temporary password"
          type="password"
          value={password.value}
          touched={password.touched}
          rules={pwRules}
          onChange={(v) => setPassword({ value: v, touched: password.touched })}
        />
        {failure === null ? null : (
          <div role="alert" data-part="error">
            <p>{failure.cause}</p>
            <p>{failure.remedy}</p>
          </div>
        )}
        <button type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      {pending === null ? null : (
        <ConfirmDialog
          title={`Deactivate ${pending.email}?`}
          body="They will be signed out immediately, on every device, even if they are recording work right now. Their past work orders are kept."
          confirmLabel="Deactivate"
          onConfirm={() => void change(pending.id, 'deactivate', pending.email)}
          onDismiss={() => setPending(null)}
        />
      )}
      {toast === null ? null : <Toast message={toast} />}
    </section>
  );
}
