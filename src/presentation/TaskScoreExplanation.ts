import type { PriorityScore } from '../entity/PriorityScore';

export interface TaskScoreExplanation {
  workOrderPriority?: string;
  reportTriage?: { priority: string; rationale: string };
  localityScore?: {
    value: number;
    tier: string;
    computedAt: string;
    severity: number;
    urgency: number;
    isDegraded: boolean;
    excludedDrivers: string[];
    overrideRuleName: string;
    breakdown: Array<{ driver: string; rawValue: number; normalisedValue: number; weight: number; contribution: number }>;
  };
}

export interface ReportTriageExplanation {
  priority: string;
  rationale: string;
}

const priorityRank: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

/** Copy the recorded score components for presentation. This does not recompute the score. */
export function explainStoredLocalityScore(score: PriorityScore): TaskScoreExplanation['localityScore'] | undefined {
  const computedAt = score.computedAt instanceof Date ? score.computedAt : undefined;
  if (!computedAt || !Number.isFinite(computedAt.getTime()) || !Number.isFinite(score.score) || !score.tier ||
      !Number.isFinite(score.severityMultiplier) || !Number.isFinite(score.urgency) || typeof score.isDegraded !== 'boolean' ||
      !Array.isArray(score.excludedDrivers) || typeof score.overrideRuleName !== 'string' || !Array.isArray(score.contributions)) return undefined;
  return {
    value: score.score,
    tier: score.tier,
    computedAt: computedAt.toISOString(),
    severity: score.severityMultiplier,
    urgency: score.urgency,
    isDegraded: score.isDegraded,
    excludedDrivers: [...score.excludedDrivers],
    overrideRuleName: score.overrideRuleName,
    breakdown: score.breakdown().map((item) => ({
      driver: item.driver,
      rawValue: item.rawValue,
      normalisedValue: item.normalisedValue,
      weight: item.weight,
      contribution: item.contribution,
    })),
  };
}

export function composeTaskScoreExplanation(input: {
  workOrderPriority?: string;
  reportTriage?: ReportTriageExplanation;
  localityScore?: PriorityScore;
}): TaskScoreExplanation | undefined {
  const localityScore = input.localityScore ? explainStoredLocalityScore(input.localityScore) : undefined;
  const result: TaskScoreExplanation = {
    ...(input.workOrderPriority ? { workOrderPriority: input.workOrderPriority } : {}),
    ...(input.reportTriage ? { reportTriage: input.reportTriage } : {}),
    ...(localityScore ? { localityScore } : {}),
  };
  return Object.keys(result).length ? result : undefined;
}

/** Select the strongest report triage in a group while keeping its reason separate from locality scoring. */
export function highestReportTriage(triages: readonly ReportTriageExplanation[]): ReportTriageExplanation | undefined {
  return [...triages].sort((a, b) => (priorityRank[a.priority] ?? 4) - (priorityRank[b.priority] ?? 4))[0];
}

/** Match stored explanations by canonical locality ID and exact pest identity. */
export function storedLocalityScore(
  scores: readonly PriorityScore[], localityId: string | null | undefined, pestType: string | null | undefined,
): PriorityScore | undefined {
  if (!localityId || !pestType) return undefined;
  return scores.find((score) => score.localityId === localityId && score.pestType === pestType);
}

