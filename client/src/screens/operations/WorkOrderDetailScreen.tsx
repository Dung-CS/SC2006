/**
 * D-Fence — Work Order Detail (REQUIREMENTS.md 11.2.18).
 * Stereotype: <<boundary>>. Traces: 11.2.18, 8.2.1, 8.2.5, 8.3.16, 8.3.19, 8.4.x, 11.4.6, 10.5.3.
 *
 * The manager's four actions — assign, cancel, verify a completion, reject one — each their own
 * request named for the transition. There is no "set status" control, because 8.3.x makes
 * `WorkOrderTransitionTable` the authority on what may move where, and a status dropdown on this
 * screen would quietly become a second one.
 *
 * The crew list shows each member's **open work-order count** (8.2.5) beside their name. Assigning
 * without it is assigning blind, and the count is the only thing on the screen that distinguishes
 * two otherwise identical names.
 *
 * A refused transition (8.3.16) is rendered with the state the order is actually in — "you cannot
 * verify this" is useless; "the work order is In Progress" tells the manager what to do next.
 *
 * **The history comes from the audit trail (2.4.1), not from the work order.** The entity keeps no
 * second copy of who moved it, deliberately: two records of the same fact eventually disagree, and
 * only one of them is the one that may not be edited. `WorkOrderRoutes` has documented that
 * decision since §8 was built, and until 2026-09-05 the endpoint it named did not exist — so the
 * screen showed a status with no account of how it got there.
 */
import { useState } from 'react';
import { ApiError } from '../../lib/ApiClient';
import { useLoad } from '../../lib/useLoad';
import { ConfirmDialog, StateView } from '../../components/States';
import { Field, field, FormField } from '../../components/Field';
import { evaluate, formIsValid, required } from '../../components/FieldValidation';
import { link } from '../../components/Link';
import { Facts, PhotoGrid, Pill, statusTone, tierTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { RoutingDecision, specialisationLabel } from '../../lib/dispatchRouting';
import { staffDisplayName, staffPhotoUrl } from '../../lib/staffVisuals';
import { ScreenProps } from '../ScreenProps';

interface DetailPayload {
  workOrder: {
    id: string;
    clusterId: string | null;
    location?: string;
    point?: { latitude: number; longitude: number } | null;
    assigneeId: string | null;
    taskType: string;
    pestType?: string | null;
    sourceReportId?: string | null;
    status: string;
    scheduledDate: string;
    priority: string;
    instructions: string;
    issueFlag: boolean;
    issueReason: string | null;
    cancellationReason: string | null;
    verifiedAt: string | null;
  };
  /** StaffRoutingPolicy's answer. Absent from an older server, in which case nothing is recommended. */
  routing?: RoutingDecision;
}

interface HistoryPayload {
  entries: Array<{
    accountId: string;
    action: string;
    refused: boolean;
    targetEntity: string;
    targetId: string | null;
    occurredAt: string;
  }>;
}

/**
 * 8.3.6, 8.3.10 — what the crew attached when they said the job was done.
 *
 * `photoKeys` and not URLs: each is exchanged for a five-minute link by `ImageRoutes` at the moment
 * it is rendered, which is what 10.3.5 asks for. Until 2026-09-19 this was not in the payload at
 * all, and the manager was asked to press "Verify completion" having seen none of it.
 */
interface EvidencePayload {
  notes: string;
  completedAt: string;
  taskPerformed: string;
  rejectionReason: string | null;
  photoKeys: string[];
}

interface CrewPayload {
  crew: Array<{ crewId: string; email: string; isActive: boolean; openWorkOrders: number; specialisation?: string | null }>;
}

export function WorkOrderDetailScreen(props: ScreenProps): JSX.Element {
  const id = props.params['id'] ?? '';
  const detail = useLoad<DetailPayload & { evidence: EvidencePayload | null }>(
    props.api,
    `/api/ops/work-orders/${id}`,
  );
  const crew = useLoad<CrewPayload>(props.api, '/api/ops/work-orders/crew-workload');
  const history = useLoad<HistoryPayload>(props.api, `/api/ops/work-orders/${id}/history`);

  const [chosenCrew, setChosenCrew] = useState('');
  const [reason, setReason] = useState<FormField>(field());
  const [confirming, setConfirming] = useState<'cancel' | 'verify' | 'reject' | null>(null);
  const [failure, setFailure] = useState<{ cause: string; remedy: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reasonRules = [required('Reason')];

  async function act(action: string, body: unknown): Promise<void> {
    setConfirming(null);
    setBusy(true);
    setFailure(null);
    try {
      await props.api.post(`/api/ops/work-orders/${id}/${action}`, body);
      detail.retry();
      crew.retry();
      // The action just taken is a row in the trail; re-reading it is how the manager sees that
      // their own decision was recorded, which is the only visible proof 2.4.1 is working.
      history.retry();
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setFailure({
        cause: f?.error ?? 'that could not be done',
        // 8.3.16 — the server's remedy names the state the order is in; do not paraphrase it.
        remedy: f?.remedy ?? 'reload and try again',
      });
    } finally {
      setBusy(false);
    }
  }

  const order = detail.value?.workOrder;
  const routing = detail.value?.routing;
  const ineligible = new Map((routing?.ineligible ?? []).map((m) => [m.crewId, m.reason]));
  const top = routing?.candidates[0];

  return (
    <section data-screen="WODetail" data-requirement="11.2.18">
      <a href="/ops/work-orders" onClick={link(props, '/ops/work-orders')}>
        Back to work orders
      </a>

      <StateView state={detail.state} onRetry={detail.retry}>
        {order === undefined ? null : (
          <article>
            <h1>
              {label(order.taskType)}{' '}
              <Pill tone={statusTone(order.status)}>{label(order.status)}</Pill>
            </h1>

            {/*
              Five unlabelled paragraphs — "Verified", "Scheduled 2026-09-04", "Medium", the
              instructions, "Verified 2026-09-04 09:00" — stacked in body type, with nothing
              saying which was the priority and which the status. Both are now pills; the rest is
              a labelled record.
            */}
            <Facts
              items={[
                { label: 'Scheduled', value: order.scheduledDate, part: 'scheduled' },
                { label: 'Pest', value: order.pestType == null ? 'Unknown pest' : label(order.pestType), part: 'pest' },
                {
                  label: 'Priority',
                  value: (
                    <Pill tone={tierTone(order.priority)} tier={order.priority}>
                      {order.priority}
                    </Pill>
                  ),
                  part: 'priority',
                },
                { label: 'Location', value: order.location ?? (order.point == null ? 'Singapore' : `${order.point.latitude}, ${order.point.longitude}`), part: 'location' },
                ...(order.point == null ? [] : [{ label: 'Coordinates', value: `${order.point.latitude}, ${order.point.longitude}`, part: 'coordinates' }]),
                ...(order.clusterId === null
                  ? [{
                      label: 'Target',
                      part: 'target',
                      value: order.sourceReportId == null ? 'Verified report' : (
                        <a href={`/ops/moderation/${encodeURIComponent(order.sourceReportId)}`} onClick={link(props, `/ops/moderation/${encodeURIComponent(order.sourceReportId)}`)}>
                          View source report
                        </a>
                      ),
                    }]
                  : [{
                      label: 'Cluster',
                      value: <a href={`/ops/clusters/${order.clusterId}`} onClick={link(props, `/ops/clusters/${order.clusterId}`)}>View the cluster</a>,
                    }]),
                ...(order.clusterId === null && order.priority === 'Medium'
                  ? [{ label: 'Priority basis', value: 'Unscored report default', part: 'priority-basis' }]
                  : []),
                ...(order.clusterId === null && order.priority === 'Critical'
                  ? [{ label: 'Priority basis', value: 'Critical injury override', part: 'priority-basis' }]
                  : []),
                { label: 'Instructions', value: order.instructions, part: 'instructions', wide: true },
              ]}
            />

            {/* 8.3.8 — an issue raised by the crew is the reason this order stopped moving. */}
            {order.issueFlag ? (
              <p role="status" data-part="issue">
                Issue raised: {order.issueReason ?? 'no reason recorded'}
              </p>
            ) : null}
            {order.cancellationReason === null ? null : (
              <p data-part="cancelled">Cancelled: {order.cancellationReason}</p>
            )}
            {order.verifiedAt === null ? null : (
              <p data-part="verified">
                Verified {new Date(order.verifiedAt).toISOString().slice(0, 16).replace('T', ' ')}
              </p>
            )}

            <section data-part="assign">
              <h2>Assignment</h2>
              {/*
                This line read "Assigned to 282c0058-ce23-4556-a2f3-033aa2938f49." — a primary key
                shown to a manager who needs a person. The roster below is already loaded for the
                Assign control and carries the address, so the id is resolved here rather than
                through a new endpoint. It falls back to the id when the assignee is no longer on
                the assignable list, which is a real state: 2.2.5 deactivates accounts, and the job
                they were holding keeps its history.
              */}
              <p>
                {order.assigneeId === null
                  ? 'Not assigned.'
                  : `Assigned to ${
                      (crew.value?.crew ?? []).find((member) => member.crewId === order.assigneeId)?.email ??
                      `a deactivated account (${order.assigneeId.slice(0, 8)})`
                    }.`}
              </p>

              {/*
                StaffRoutingPolicy's answer, computed on the server — the same rule `assign`
                enforces, so nothing recommended here can be refused there. Ranked by first-choice
                capability, then fewest open orders; no invented match percentage.
              */}
              {routing === undefined ? null : routing.referral !== null ? (
                <div className="dispatch-wildlife-banner" role="alert" data-part="wildlife-referral">
                  <div className="dispatch-wildlife-title">Not crew work: refer this case (8.1.14, 8.6)</div>
                  <p className="dispatch-wildlife-body">
                    {label(order.pestType ?? 'Unknown pest')} cases go to {routing.referral.authority}. No crew member can be
                    assigned.{' '}
                    {order.sourceReportId == null ? (
                      'Refer the source report from the moderation queue instead.'
                    ) : (
                      <a
                        href={`/ops/referrals/${order.sourceReportId}`}
                        onClick={link(props, `/ops/referrals/${order.sourceReportId}`)}
                      >
                        Refer the source report
                      </a>
                    )}
                  </p>
                  <div className="dispatch-wildlife-cta">
                    <strong>{routing.referral.authority}</strong>{' '}
                    <a
                      href={`tel:${routing.referral.contactNumber.replace(/\s/g, '')}`}
                      className="dispatch-wildlife-phone"
                    >
                      {routing.referral.contactNumber}
                    </a>
                  </div>
                </div>
              ) : top === undefined ? (
                <div role="status" data-part="no-eligible-crew">
                  <p>
                  No active crew member has a recorded capability that covers {label(order.taskType)} for{' '}
                    {label(order.pestType ?? 'Unknown pest')}.
                  </p>
                  <p>
                    Record a capability on the{' '}
                    <a href="/ops/staff" onClick={link(props, '/ops/staff')}>
                      Staff screen
                    </a>
                    , or cancel this order and raise one with a task the crew can do.
                  </p>
                </div>
              ) : (
                <div className="dispatch-assistant-card" data-part="dispatch-assistant">
                  <div className="dispatch-assistant-head">
                    <span className="dispatch-assistant-badge">Suggested crew member</span>
                    <span className="dispatch-assistant-match">
                      {top.primary ? 'First-choice capability' : 'Permitted capability'}
                    </span>
                  </div>
                  <div className="dispatch-assistant-body">
                    <img src={staffPhotoUrl(top.email)} alt="" className="dispatch-assistant-avatar" />
                    <div className="dispatch-assistant-info">
                      <div className="dispatch-assistant-name">{staffDisplayName(top.email)}</div>
                      <div className="dispatch-assistant-meta">
                        <span className="dispatch-spec-pill">{specialisationLabel(top.specialisation)}</span>
                        <span className="dispatch-load-pill">{top.openWorkOrders} open jobs</span>
                      </div>
                      <p className="dispatch-assistant-reasons">
                        {routing.candidates.length} eligible crew member(s), ordered by capability then
                        current load.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="dispatch-assistant-quick-btn"
                      disabled={busy || top.crewId === order.assigneeId}
                      onClick={() => {
                        setChosenCrew(top.crewId);
                        void act('assign', { crewId: top.crewId });
                      }}
                    >
                      {order.assigneeId === null ? 'Assign suggested' : 'Reassign to suggested'}
                    </button>
                  </div>
                </div>
              )}

              <StateView state={crew.state} onRetry={crew.retry}>
                <label htmlFor="crew">Assign to crew member</label>
                <select id="crew" value={chosenCrew} onChange={(event) => setChosenCrew(event.target.value)}>
                  <option value="">Choose a crew member</option>
                  {(crew.value?.crew ?? []).map((member) => (
                    // Ineligible people stay visible, so the manager sees who exists, but cannot be
                    // picked; the reason is the option's tooltip and the server refuses them anyway.
                    <option
                      key={member.crewId}
                      value={member.crewId}
                      disabled={ineligible.has(member.crewId)}
                      title={ineligible.get(member.crewId) ?? specialisationLabel(member.specialisation)}
                    >
                      {`${member.email} — ${member.openWorkOrders} open${member.isActive ? '' : ' (deactivated)'}`}
                    </option>
                  ))}
                </select>
                {routing === undefined || routing.ineligible.length === 0 ? null : (
                  <details data-part="ineligible-crew">
                    <summary>{routing.ineligible.length} crew member(s) cannot take this job</summary>
                    <ul>
                      {routing.ineligible.map((m) => (
                        <li key={m.crewId}>
                          {m.email} ({specialisationLabel(m.specialisation)}): {m.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <button
                  type="button"
                  disabled={busy || chosenCrew === ''}
                  onClick={() => void act('assign', { crewId: chosenCrew })}
                >
                  {order.assigneeId === null ? 'Assign' : 'Reassign'}
                </button>
              </StateView>
            </section>

            {/*
              8.3.6, 8.3.7 — placed above the Actions block deliberately: the photographs are what
              "Verify completion" is a judgement about, and a decision control placed above its
              evidence invites the decision to be taken without it.
            */}
            {detail.value?.evidence === null || detail.value?.evidence === undefined ? null : (
              <section data-part="evidence">
                <h2>What the crew recorded</h2>
                <Facts
                  items={[
                    { label: 'Task performed', value: label(detail.value.evidence.taskPerformed) },
                    {
                      label: 'Completed',
                      value: new Date(detail.value.evidence.completedAt).toISOString().slice(0, 16).replace('T', ' ') + ' SGT',
                    },
                    { label: 'Notes', value: detail.value.evidence.notes, wide: true },
                  ]}
                />
                <PhotoGrid
                  path="completion-evidence"
                  photos={detail.value.evidence.photoKeys.map((key) => ({ id: key, storageKey: key }))}
                  emptyMessage="No photographs are stored against this completion. 8.3.7 refuses a completion without one, so this means the images are no longer in storage — not that the crew submitted none."
                />
              </section>
            )}

            <section data-part="actions">
              <h2>Actions</h2>
              <Field
                id="reason"
                label="Reason"
                multiline
                value={reason.value}
                touched={reason.touched}
                rules={reasonRules}
                hint="Required to cancel or to reject a completion; ignored when verifying."
                onChange={(v) => setReason({ value: v, touched: reason.touched })}
              />
              <button type="button" data-variant="primary" disabled={busy} onClick={() => setConfirming('verify')}>
                Verify completion
              </button>
              <button
                type="button"
                data-variant="danger"
                disabled={busy}
                onClick={() => {
                  setReason((f) => ({ ...f, touched: true }));
                  if (formIsValid([evaluate(reason.value, reasonRules)])) {
                    setConfirming('reject');
                  }
                }}
              >
                Reject completion
              </button>
              <button
                type="button"
                data-variant="danger"
                disabled={busy}
                onClick={() => {
                  setReason((f) => ({ ...f, touched: true }));
                  // 8.3.19 — a cancellation without a reason is refused before it is sent.
                  if (formIsValid([evaluate(reason.value, reasonRules)])) {
                    setConfirming('cancel');
                  }
                }}
              >
                Cancel work order
              </button>
            </section>

            {/*
              * 2.4.1 — who did what, and when. Rendered as a real list rather than a table: it is
              * read top to bottom, one line per event, and a table would promise columns worth
              * sorting by.
              */}
            <section data-part="history">
              <h2>History</h2>
              <StateView state={history.state} onRetry={history.retry}>
                {history.value == null ? null : history.value.entries.length === 0 ? (
                  // Not an error and not an empty-state apology: a work order raised a moment ago
                  // genuinely has no history yet.
                  <p data-part="history-empty">Nothing has been recorded against this job yet.</p>
                ) : (
                  <ol data-part="history-list">
                    {history.value.entries.map((entry) => (
                      <li key={`${entry.occurredAt}-${entry.action}`} data-refused={entry.refused}>
                        <span data-part="when">{new Date(entry.occurredAt).toLocaleString()}</span>{' '}
                        <span data-part="what">
                          {/* 2.3.8's refusals mean the opposite of the rest of the list, so they
                              say so in words rather than only in a colour or an attribute. */}
                          {entry.refused ? 'Refused: ' : ''}
                          {entry.action}
                        </span>{' '}
                        <span data-part="who">by {entry.accountId}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </StateView>
            </section>

            {failure === null ? null : (
              <div role="alert" data-part="error">
                <p>{failure.cause}</p>
                <p>{failure.remedy}</p>
              </div>
            )}
          </article>
        )}
      </StateView>

      {confirming === null ? null : (
        <ConfirmDialog
          title={
            confirming === 'verify'
              ? 'Verify this completion?'
              : confirming === 'reject'
                ? 'Reject this completion?'
                : 'Cancel this work order?'
          }
          body={
            confirming === 'verify'
              ? order?.clusterId === null
                ? 'This records completion against the verified report. Its priority is an unscored scheduling default unless an injury override applies.'
                : 'This records a treatment against the cluster, which lowers its priority in the next scoring cycle.'
              : confirming === 'reject'
                ? 'The crew member will be shown your reason and the work returns to them.'
                : 'The work order will be closed without being done. Your reason is recorded.'
          }
          confirmLabel={confirming === 'verify' ? 'Verify' : confirming === 'reject' ? 'Reject' : 'Cancel work order'}
          onConfirm={() =>
            void act(confirming, confirming === 'verify' ? {} : { reason: reason.value.trim() })
          }
          onDismiss={() => setConfirming(null)}
        />
      )}
    </section>
  );
}
