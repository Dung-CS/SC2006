import type { TaskScoreExplanation } from '../../../src/presentation/TaskScoreExplanation';
import { driverHelp, driverLabel, withUnit } from '../lib/labels';
import { createReportRejectControl, type RejectReport } from './ReportRejectControl';

/** Display stored scoring evidence; never calculate a replacement score in the browser. */
export function createScoreBreakdown(explanation?: TaskScoreExplanation): HTMLElement {
  const section = document.createElement('section');
  section.className = 'task-score-breakdown';
  section.dataset.part = 'score-breakdown';
  const heading = document.createElement('h3');
  heading.textContent = 'Score breakdown';
  section.append(heading);
  const text = (value: string, className?: string) => {
    const paragraph = document.createElement('p');
    paragraph.textContent = value;
    if (className) paragraph.className = className;
    section.append(paragraph);
  };
  const number = (value: number | undefined, digits = 2) =>
    Number.isFinite(value) ? value!.toFixed(digits) : 'Not recorded';
  if (explanation?.workOrderPriority) text(`Work-order priority: ${explanation.workOrderPriority}`);
  if (explanation?.reportTriage) {
    text(`Report triage: ${explanation.reportTriage.priority}`, 'task-score-summary');
    text(explanation.reportTriage.rationale);
  }
  const score = explanation?.localityScore;
  if (!score) {
    text(explanation?.reportTriage ? 'No locality score recorded for this task.' : 'No score breakdown recorded for this task.');
    return section;
  }
  text(`Locality risk: ${number(score.value, 1)} / 100 · ${score.tier}`, 'task-score-summary');
  text(`Severity ${number(score.severity)} × urgency ${number(score.urgency)} × 100`);
  text('Locality risk is context; report triage or a recorded work-order priority can raise the task priority.', 'task-score-note');
  const computedAt = new Date(score.computedAt);
  if (Number.isFinite(computedAt.getTime())) text(`Scored ${computedAt.toLocaleString('en-SG', { timeZone: 'Asia/Singapore' })} SGT`, 'task-score-note');
  if (score.overrideRuleName) text(`Critical rule: ${score.overrideRuleName}`);
  if (score.isDegraded) text('Some inputs are missing or stale.', 'task-score-warning');
  if (score.excludedDrivers.length) text(`Excluded: ${score.excludedDrivers.map(driverLabel).join(', ')}`, 'task-score-warning');
  if (!score.breakdown.length) {
    text('No driver contributions recorded.');
    return section;
  }
  text('Stored urgency contributions', 'task-score-note');
  const drivers = document.createElement('div');
  drivers.className = 'task-score-drivers';
  for (const row of score.breakdown) {
    const card = document.createElement('div');
    card.className = 'task-score-driver';
    card.dataset.driver = row.driver;
    const name = document.createElement('strong');
    name.textContent = driverLabel(row.driver);
    name.title = driverHelp(row.driver);
    const value = document.createElement('span');
    value.textContent = number(row.contribution);
    value.dataset.part = 'score-contribution';
    const input = document.createElement('small');
    input.textContent = `Measured: ${Number.isFinite(row.rawValue) ? withUnit(row.driver, row.rawValue) : 'Not recorded'}`;
    const weights = document.createElement('small');
    weights.textContent = `Normalised ${number(row.normalisedValue)} · weight ${number(row.weight)}`;
    card.append(name, value, input, weights);
    drivers.append(card);
  }
  section.append(drivers);
  return section;
}

/**
 * Report-sourced tasks get a "Reject report" control; other tasks get nothing. The caller owns the
 * API call, so the callout stays free of network code.
 */
export function createReportRejectSection(
  task: { sourceReportId?: string },
  reject?: RejectReport,
): HTMLElement | null {
  return task.sourceReportId && reject ? createReportRejectControl(task.sourceReportId, reject) : null;
}
