import { LocationContext, PestType, ReportType, TaskType } from '../entity/enums';
import type { Report } from '../entity/Report';

export type TriagePriority = 'Critical' | 'High' | 'Medium' | 'Low';
export interface TriageResult { priority: TriagePriority; rationale: string }

/** One report-level triage policy for the reporting screen, map and dispatch queue. */
export function computeTriagePriority(
  pestType: string, count: number | null, locationContext?: LocationContext | string,
  injuryReported = false, unhygienicFouling = false,
): TriageResult {
  if (injuryReported) return { priority: 'Critical', rationale: 'Injury reported. Seek urgent medical help where needed.' };
  if ([PestType.WildBoar, PestType.Snake, PestType.Macaque].includes(pestType as PestType)) {
    const indoor = locationContext === LocationContext.Indoor;
    return { priority: indoor ? 'Critical' : pestType === PestType.Macaque ? 'Medium' : 'High', rationale: `${pestType} reported${indoor ? ' indoors' : ''}. Keep a safe distance and contact the relevant wildlife authority.` };
  }
  if ([PestType.BeeWasp, PestType.Termite, PestType.BedBug].includes(pestType as PestType)) return { priority: 'High', rationale: `${pestType} reported. Assessment is required to confirm the hazard.` };
  if (count === null || !Number.isFinite(count) || count < 0) return {
    priority: 'Medium', rationale: `${pestType || 'Pest'} reported. Specimen count is unknown; assessment is required.`,
  };
  if (pestType === PestType.Rat || pestType === PestType.Cockroach) return {
    priority: count >= 5 ? 'High' : 'Medium', rationale: `${count} ${pestType} reported. ${count >= 5 ? 'Count meets the high-density threshold.' : 'Count is below the high-density threshold.'}`,
  };
  if (pestType === PestType.Pigeon || pestType === PestType.HouseCrow) return {
    priority: count >= 15 && unhygienicFouling ? 'High' : pestType === PestType.Pigeon && count < 15 ? 'Low' : 'Medium',
    rationale: `${count} ${pestType} reported. ${unhygienicFouling ? 'Resident reports surface fouling.' : 'Surface fouling has not been confirmed.'}`,
  };
  if (pestType === PestType.Mosquito) return { priority: count >= 10 ? 'High' : 'Medium', rationale: `${count} mosquitoes reported. Inspection is required to confirm any breeding site.` };
  return { priority: 'Medium', rationale: pestType ? `${pestType} reported. Assessment is required.` : 'Choose the pest you observed.' };
}

export function triageForReport(report: Pick<Report, 'pestType' | 'estimatedCount' | 'locationContext' | 'injuryReported'>): TriageResult {
  return computeTriagePriority(report.pestType, report.estimatedCount, report.locationContext ?? undefined, report.injuryReported);
}

/** A recorded condition determines clearance work; other reports start with inspection. */
export function taskForReport(report: Pick<Report, 'type'>): TaskType {
  if (report.type === ReportType.BlockedDrain) return TaskType.DrainClearance;
  if (report.type === ReportType.UnclearedRefuse) return TaskType.RefuseClearance;
  return TaskType.Inspection;
}
