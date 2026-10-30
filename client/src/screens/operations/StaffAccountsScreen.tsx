/**
 * D-Fence — Staff Accounts (REQUIREMENTS.md 11.2.22).
 * Stereotype: <<boundary>>. Traces: 11.2.22, 2.2.1–2.2.6, 2.3.4, 11.4.6, 10.5.3.
 */
import { useState } from 'react';
import { ApiError } from '../../lib/ApiClient';
import { useLoad } from '../../lib/useLoad';
import { StateView, Toast } from '../../components/States';
import { Field, field, FormField } from '../../components/Field';
import { emailRule, evaluate, formIsValid, passwordRules, required } from '../../components/FieldValidation';
import { HqLocation, Role, StaffSpecialisation, StaffStatus } from '../../../../src/entity/enums';
import { Pill } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { staffPhotoUrl, staffDisplayName } from '../../lib/staffVisuals';
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

export const HQ_LABEL: Record<HqLocation, string> = {
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
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<FormField>(field());
  const [password, setPassword] = useState<FormField>(field());
  const [displayName, setDisplayName] = useState('');
  const [profileDescription, setProfileDescription] = useState('');
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
    if (total === 0) return { background: 'var(--surface)', color: 'var(--ink-quiet)', border: 'var(--line)', fontWeight: 'normal' };
    const pct = Math.round((available / total) * 100);
    if (pct >= 80) {
      return { background: 'color-mix(in srgb, var(--tier-low) 30%, var(--surface))', color: 'var(--ink)', border: 'var(--tier-low)', fontWeight: 'bold' }; // >=80% Green
    } else if (pct >= 50) {
      return { background: 'color-mix(in srgb, var(--tier-low) 14%, var(--surface))', color: 'var(--ink)', border: 'var(--tier-low)', fontWeight: '600' }; // 50-79% Soft green
    } else if (pct > 0) {
      return { background: 'color-mix(in srgb, var(--tier-medium) 24%, var(--surface))', color: 'var(--ink)', border: 'var(--tier-medium)', fontWeight: '600' }; // 1-49% Amber
    } else {
      return { background: 'color-mix(in srgb, var(--tier-high) 28%, var(--surface))', color: 'var(--ink)', border: 'var(--tier-high)', fontWeight: 'bold' }; // 0% Alert Red
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
      <h1 className="text-2xl font-bold tracking-tight sm:text-[2rem]">Staff</h1>

      <section aria-label="Staff Availability Dashboard" data-part="availability-dashboard" className="rounded-3xl border border-line bg-surface p-4 sm:p-6">
        <h2 className="tracking-tight">Staff Availability Dashboard</h2>
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
                      <td key={hq} className="p-1">
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
                            <span className="text-xs opacity-90">
                              {onCallCount} on-call (2h lag)
                            </span>
                          ) : null}
                        </button>
                      </td>
                    );
                  })}
                  <td className="p-1">
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
                        <span className="text-xs opacity-90">
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
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[0.82rem]">
          <span className="font-semibold">% Available Legend:</span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3.5 rounded-sm border bg-[color-mix(in_srgb,var(--tier-low)_30%,var(--surface))] border-tier-low" />
            &ge;80% Available (Optimal readiness)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3.5 rounded-sm border bg-[color-mix(in_srgb,var(--tier-low)_14%,var(--surface))] border-tier-low" />
            50–79% Available (Good readiness)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3.5 rounded-sm border bg-[color-mix(in_srgb,var(--tier-medium)_24%,var(--surface))] border-tier-medium" />
            1–49% Available (Constrained)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3.5 rounded-sm border bg-[color-mix(in_srgb,var(--tier-high)_28%,var(--surface))] border-tier-high" />
            0% Available (Fully Dispatched)
          </span>
        </div>

        <div aria-label="Quick filters" className="mt-3 flex flex-wrap gap-2">
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
        <div data-part="staff-cards" className="my-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4">
            {pagedItems.map((member) => (
              <article key={member.id} data-entity-id={member.id} data-email={member.email} data-active={member.isActive} className="grid gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
                <div className="flex items-center gap-3">
                  <img src={staffPhotoUrl(member.email, member.role)} alt="" className="staff-avatar-img size-14 shrink-0 rounded-full object-cover ring-2 ring-line" />
                  <div>
                    <a href={`/ops/staff/${member.id}`} onClick={link(props, `/ops/staff/${member.id}`)} data-part="crew-detail-link" className="font-semibold tracking-tight text-ink no-underline transition-colors hover:text-accent hover:underline">
                      <strong data-part="entity-title">{staffDisplayName(member.email, member.role, member.displayName)}</strong>
                    </a>
                  </div>
                </div>
                <div className="staff-summary flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <span className="staff-hq-pill" data-part="hq">{member.hqLocation ? HQ_LABEL[member.hqLocation] : 'HQ unassigned'}</span>
                  <Pill tone={member.role === Role.CleaningCrew && member.specialisation ? 'good' : 'neutral'}>
                    <span data-part="crew-type">{member.role === Role.CleaningCrew ? specialisationLabel(member.specialisation) : label(member.role)}</span>
                  </Pill>
                  <Pill tone={!member.isActive ? 'neutral' : member.staffStatus === StaffStatus.Available || member.staffStatus === undefined ? 'good' : member.staffStatus === StaffStatus.OnCall ? 'neutral' : 'warn'}>
                    <span data-part="status">{!member.isActive ? 'Deactivated' : member.staffStatus === StaffStatus.OnCall
                      ? `On Call (${member.onCallLagHours ?? 2}h lag)` : member.staffStatus ?? StaffStatus.Available}</span>
                  </Pill>
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
              <span className="field-error" style={{ color: 'var(--refusal)', fontSize: '0.85rem' }}>
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
          <span className="field-error" style={{ color: 'var(--refusal)', fontSize: '0.85rem' }}>
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

      {toast === null ? null : <Toast message={toast} />}
    </section>
  );
}
