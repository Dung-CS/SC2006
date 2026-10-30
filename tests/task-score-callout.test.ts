/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { createScoreBreakdown } from '../client/src/components/TaskScoreCallout';
import type { TaskScoreExplanation } from '../src/presentation/TaskScoreExplanation';

const explanation: TaskScoreExplanation = {
  workOrderPriority: 'Critical',
  reportTriage: { priority: 'High', rationale: 'A recorded report hazard.' },
  localityScore: { value: 27.8, tier: 'Medium', computedAt: '2026-10-30T03:00:00Z', severity: .8, urgency: .3475,
    isDegraded: true, excludedDrivers: ['Rainfall24h'], overrideRuleName: 'Recorded override',
    breakdown: [{ driver: 'CaseSize', rawValue: 12, normalisedValue: .9, weight: .4, contribution: .12 }] },
};

describe('Task score evidence', () => {
  it('shows recorded contributions and keeps report, work-order and locality priorities separate', () => {
    const card = createScoreBreakdown(explanation);
    expect(card.textContent).toContain('Work-order priority: Critical');
    expect(card.textContent).toContain('Report triage: High');
    expect(card.textContent).toContain('Locality risk: 27.8 / 100');
    expect(card.textContent).toContain('A recorded report hazard.');
    expect(card.textContent).toContain('Severity 0.80');
    expect(card.textContent).toContain('Recorded override');
    expect(card.textContent).toContain('Excluded:');
    // Deliberately distinct from .9 × .4: use the stored value, never recalculate it here.
    expect(card.querySelector('[data-part="score-contribution"]')?.textContent).toBe('0.12');
    expect(card.textContent).not.toContain('Rainfall24h');
  });

  it('shows a triage-only reason and distinguishes a missing score from a recorded zero', () => {
    const triage = createScoreBreakdown({ reportTriage: explanation.reportTriage });
    expect(triage.textContent).toContain('No locality score recorded');
    expect(triage.textContent).not.toContain('/ 100');
    expect(createScoreBreakdown().textContent).toContain('No score breakdown recorded');
    const zero = createScoreBreakdown({ localityScore: { ...explanation.localityScore!, value: 0 } });
    expect(zero.textContent).toContain('Locality risk: 0.0 / 100');
  });

  it('uses source strings as text, without turning them into markup', () => {
    const card = createScoreBreakdown({ reportTriage: { priority: 'High', rationale: '<img src=x onerror=alert(1)>' } });
    expect(card.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(card.querySelector('img')).toBeNull();
  });
});
