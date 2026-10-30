/**
 * D-Fence — Crew member detail (11.2.22).
 * Stereotype: <<boundary>>. Manager only.
 *
 * Every stored profile field, then the dispatches this person is on: upcoming (today onwards) and
 * past. Each stop opens its work order.
 */
import { useLoad } from '../../lib/useLoad';
import { StateView } from '../../components/States';
import { link } from '../../components/Link';
import { Facts, Pill, statusTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { staffDisplayName } from '../../lib/staffVisuals';
import { specialisationLabel } from '../../lib/dispatchRouting';
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
  const now = today();
  const upcoming = (value?.dispatches ?? []).filter((row) => row.date >= now).reverse();
  const past = (value?.dispatches ?? []).filter((row) => row.date < now);
  const list = (rows: DispatchRow[], empty: string) => rows.length === 0 ? <p>{empty}</p> : (
    <ul>{rows.map((row) => <DispatchRowView key={row.id} screen={props} row={row} hideCrewId={id} />)}</ul>
  );

  return (
    <section data-screen="CrewDetail" data-requirement="11.2.22">
      <a href="/ops/staff" onClick={link(props, '/ops/staff')}>Back to staff</a>
      <StateView state={state} onRetry={retry}>
        {member == null ? null : (
          <article data-entity-id={member.id}>
            <h1>
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
            <section data-part="upcoming-dispatches">
              <h2>Upcoming dispatches</h2>
              {list(upcoming, 'No upcoming dispatches.')}
            </section>
            <section data-part="past-dispatches">
              <h2>Past dispatches</h2>
              {list(past, 'No past dispatches.')}
            </section>
          </article>
        )}
      </StateView>
    </section>
  );
}
