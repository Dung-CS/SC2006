/**
 * D-Fence — "Reject report" control for the dispatch task callout.
 * Stereotype: <<boundary>>. Traces: 5.2.3b, 5.2.4.
 *
 * Built with DOM calls, not JSX, because the Leaflet popup that hosts it is plain DOM. The caller
 * supplies `reject`, so this file knows no API path and the server stays the one place that decides.
 */
export type RejectReport = (reportId: string, reason: string) => Promise<void>;

export const MIN_REJECT_REASON = 10;

export function createReportRejectControl(reportId: string, reject: RejectReport): HTMLElement {
  const wrap = document.createElement('div');
  wrap.dataset.part = 'report-reject';
  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = 'Reject report';
  const form = document.createElement('form');
  form.hidden = true;
  const reason = document.createElement('textarea');
  reason.setAttribute('aria-label', 'Reason for rejecting this report');
  reason.placeholder = `Reason (at least ${MIN_REJECT_REASON} characters)`;
  const confirm = document.createElement('button');
  confirm.type = 'submit';
  confirm.textContent = 'Confirm reject';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  form.append(reason, confirm);
  wrap.append(open, form, status);

  open.addEventListener('click', () => {
    form.hidden = false;
    reason.focus();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = reason.value.trim();
    if (text.length < MIN_REJECT_REASON) {
      status.textContent = `Give a reason of at least ${MIN_REJECT_REASON} characters.`;
      return;
    }
    confirm.disabled = true;
    status.textContent = 'Rejecting...';
    reject(reportId, text).then(
      () => {
        status.textContent = 'Report rejected. The dispatch plan will refresh.';
        form.hidden = true;
        open.hidden = true;
      },
      (error: unknown) => {
        status.textContent = error instanceof Error ? error.message : 'The report could not be rejected.';
        confirm.disabled = false;
      },
    );
  });
  return wrap;
}
