/**
 * D-Fence — Report Review (REQUIREMENTS.md 11.2.15).
 * Stereotype: <<boundary>>. Traces: 11.2.15, 5.2.3, 5.2.4, 5.3.4, 2.3.4, 11.4.6, 10.5.3.
 *
 * Verify and Reject are not symmetrical, and the screen says so. Rejection requires a reason
 * (5.2.4) because the reason is what the resident is shown and what a later dispute is settled by;
 * verification does not, because "it is real" adds nothing to the record.
 *
 * Both are confirmed before they are sent (11.4.6). Neither is reversible from here — 5.2.3 makes
 * moderation a one-way transition — and a one-way action reached by a single click on a list is an
 * action that will occasionally be taken by accident.
 */
import { useState } from 'react';
import { ApiError } from '../../lib/ApiClient';
import { useLoad } from '../../lib/useLoad';
import { ConfirmDialog, StateView } from '../../components/States';
import { Field, field, FormField } from '../../components/Field';
import { evaluate, formIsValid, required } from '../../components/FieldValidation';
import { link } from '../../components/Link';
import { Facts, PhotoGrid, Pill, statusTone } from '../../components/Presentation';
import { label } from '../../lib/labels';
import { reportPhotoUrl, reportPhotoAttribution } from '../../lib/reportVisuals';
import { PestClass, PestType, ReportStatus } from '../../../../src/entity/enums';
import { isExternalReferral } from '../../../../src/control/StaffRoutingPolicy';
import { ScreenProps } from '../ScreenProps';

interface PestReference {
  pestType: PestType;
  pestClass: string;
  authority: string;
  contactNumber: string;
  referred: boolean;
}

interface ReviewPayload {
  report: {
    id: string;
    pestType: PestType;
    clusterId: string | null;
    type: string;
    description: string;
    localityBinding: string;
    status: string;
    corroborationCount: number;
    submittedAt: string;
  };
  /**
   * `storageKey` is what names the object in the private bucket, and it is what `PhotoGrid` needs
   * to ask `GET /api/images/report-photo/:key` for a link. It was always in the response — the
   * server serialises the whole `ReportPhoto` — and this interface simply did not declare it, which
   * is why the screen could only ever render the file name.
   */
  photos: Array<{ id: string; filename: string; storageKey: string; contentType?: string }>;
}

export function ReportReviewScreen(props: ScreenProps): JSX.Element {
  const id = props.params['id'] ?? '';
  const { state, value, retry } = useLoad<ReviewPayload>(props.api, `/api/ops/moderation/${id}`);
  const catalogue = useLoad<{ pests: PestReference[] }>(props.api, '/api/pests');
  const [confirming, setConfirming] = useState<'verify' | 'reject' | null>(null);
  const [reason, setReason] = useState<FormField>(field());
  const [failure, setFailure] = useState<{ cause: string; remedy: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const reasonRules = [required('Reason')];

  async function send(action: 'verify' | 'reject'): Promise<void> {
    setConfirming(null);
    setBusy(true);
    setFailure(null);
    try {
      await props.api.post(
        `/api/ops/moderation/${id}/${action}`,
        action === 'reject' ? { reason: reason.value.trim() } : {},
      );
      // Back to the queue: the next report is the manager's next action, and staying on a report
      // that can no longer be acted on is a dead end.
      props.onNavigate('/ops/moderation');
    } catch (error) {
      const f = error instanceof ApiError ? error.failure : null;
      setFailure({ cause: f?.error ?? 'that could not be recorded', remedy: f?.remedy ?? 'try again shortly' });
    } finally {
      setBusy(false);
    }
  }

  const report = value?.report;
  const pestReference = catalogue.value?.pests.find((pest) => pest.pestType === report?.pestType);
  const externalReferral = pestReference !== undefined && isExternalReferral(pestReference.pestClass as PestClass, pestReference.authority);

  return (
    <section data-screen="ReportReview" data-requirement="11.2.15">
      <a href="/ops/moderation" onClick={link(props, '/ops/moderation')}>
        Back to the queue
      </a>

      <StateView state={state} onRetry={retry}>
        {report === undefined ? null : (
          <article>
            <h1>
              {label(report.type)}{' '}
              <Pill tone={statusTone(report.status)} title={`Report status (5.2.3)`}>
                {label(report.status)}
              </Pill>
            </h1>

            {/*
              Six facts that used to be six unlabelled paragraphs. The reader could tell which was
              the description and which the locality only by reading them; `Facts` names each one.
            */}
            <Facts
              items={[
                { label: 'Where', value: report.localityBinding, part: 'locality' },
                {
                  label: 'Submitted',
                  value: new Date(report.submittedAt).toISOString().slice(0, 16).replace('T', ' ') + ' SGT',
                  part: 'submitted',
                },
                {
                  label: 'Corroborations',
                  // 5.1.13 — how many neighbours said they saw it too. Zero is a real answer and
                  // is shown as one, rather than omitted as if it had not been counted.
                  value: `${report.corroborationCount} neighbour${report.corroborationCount === 1 ? '' : 's'} confirmed this`,
                  part: 'corroborations',
                },
                ...(report.description?.match(/\[(?:Specimen )?Count:\s*(\d+)\]/i)
                  ? [
                      {
                        label: 'Specimen count',
                        value: `${report.description.match(/\[(?:Specimen )?Count:\s*(\d+)\]/i)?.[1] ?? '1'} specimens`,
                        part: 'specimen-count',
                      },
                    ]
                  : []),
                { label: 'What the resident wrote', value: report.description, part: 'description', wide: true },
              ]}
            />
            {report.status === ReportStatus.Verified && catalogue.state.kind !== 'ready' ? (
              <div role="status" data-part="routing-check-unavailable">
                <p>Checking which team handles this pest…</p>
                {catalogue.state.kind === 'error' ? <button type="button" onClick={catalogue.retry}>Retry check</button> : null}
              </div>
            ) : report.status === ReportStatus.Verified && externalReferral ? (
              <p data-part="external-referral">
                This case is handled by {pestReference.authority}.{' '}
                <a href={`/ops/referrals/${encodeURIComponent(report.id)}`} onClick={link(props, `/ops/referrals/${encodeURIComponent(report.id)}`)}>
                  Refer this report
                </a>
              </p>
            ) : report.status === ReportStatus.Verified && pestReference !== undefined ? (
              <a
                href={`/ops/work-orders/new?sourceReportId=${encodeURIComponent(report.id)}&pestType=${encodeURIComponent(report.pestType)}`}
                onClick={link(
                  props,
                  `/ops/work-orders/new?sourceReportId=${encodeURIComponent(report.id)}&pestType=${encodeURIComponent(report.pestType)}`,
                )}
              >
                Create work order for this verified {label(report.pestType)} report
              </a>
            ) : report.status === ReportStatus.Verified ? (
              <p role="status" data-part="routing-check-unavailable">This pest is missing from the catalogue. Dispatch is unavailable until its handling is confirmed.</p>
            ) : null}

            {/* 2.3.4, 5.3.4 — a manager sees the photographs; this is the screen they exist for. */}
            <h2>Photographs</h2>
            <PhotoGrid
              path={`report/${id}`}
              photos={value?.photos ?? []}
              emptyMessage="This report carries no photographs. 5.1.5 makes them optional, so this is not an error — verify it on the description and the location."
            />
            {(value?.photos ?? []).length === 0 && (
              <div className="report-reference-photo-card" data-component="report-photo">
                <div className="report-reference-visual">
                  <img
                    src={reportPhotoUrl(report.type)}
                    alt={`${label(report.type)} condition reference`}
                    className="report-reference-img"
                  />
                  <span className="report-reference-badge">Verified condition reference</span>
                </div>
                <p className="report-reference-caption">
                  Standard condition exemplar: {reportPhotoAttribution(report.type).title}
                </p>
              </div>
            )}

            <Field
              id="reason"
              label="Reason for rejection"
              multiline
              value={reason.value}
              touched={reason.touched}
              rules={reasonRules}
              hint="Shown to the resident who submitted the report (5.2.4). Required to reject; ignored when verifying."
              onChange={(v) => setReason({ value: v, touched: reason.touched })}
            />

            <div data-part="actions">
              <button type="button" data-variant="primary" onClick={() => setConfirming('verify')} disabled={busy}>
                Verify
              </button>
              <button
                type="button"
                data-variant="danger"
                onClick={() => {
                  setReason((f) => ({ ...f, touched: true }));
                  // 5.2.4 — a rejection with no reason is refused here, not sent and bounced.
                  if (formIsValid([evaluate(reason.value, reasonRules)])) {
                    setConfirming('reject');
                  }
                }}
                disabled={busy}
              >
                Reject
              </button>
            </div>

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
          title={confirming === 'verify' ? 'Verify this report?' : 'Reject this report?'}
          body={
            confirming === 'verify'
              ? report?.clusterId === null
                ? 'This verifies the report at its recorded location. Internal reports can be scheduled without assigning them to a dengue cluster. This cannot be undone.'
                : 'A verified report counts towards its cluster’s priority and can be linked to a work order. This cannot be undone.'
              : 'The resident will be shown your reason. This cannot be undone.'
          }
          confirmLabel={confirming === 'verify' ? 'Verify' : 'Reject'}
          onConfirm={() => void send(confirming)}
          onDismiss={() => setConfirming(null)}
        />
      )}
    </section>
  );
}
