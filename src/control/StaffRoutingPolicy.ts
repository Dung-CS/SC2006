/**
 * D-Fence — who may be sent to which job.
 * Stereotype: <<control>> (pure policy, no stores). Traces: 8.1.14, 8.1.17, 8.2.1, 8.2.2, 8.2.3,
 * 8.6.2.
 *
 * One table, read by three callers: `DispatchController.assign` (enforcement), the work-order
 * detail payload (recommendation) and the client's labels. A second copy of the table in a screen
 * is how the recommendation and the refusal end up disagreeing.
 *
 * **Capability is recorded, never inferred.** `Account.specialisation` is set by an Operations
 * Manager. A null value means "not recorded" and makes the person ineligible for every job; it is
 * never read as "qualified for everything".
 *
 * **No workload cap.** §8.2 asks for each candidate's open count to be shown (8.2.2) and states no
 * maximum, so the count orders the list and refuses nobody.
 */
import { PestClass, PestType, Role, StaffSpecialisation, TaskType } from '../entity/enums';
import type { PestProfile } from '../entity/PestProfile';

/** The task types each specialisation may carry out. Only the five of 8.1.3. */
export const SPECIALISATION_TASKS: Readonly<Record<StaffSpecialisation, readonly TaskType[]>> = {
  [StaffSpecialisation.VectorControl]: [TaskType.Fogging, TaskType.Larviciding, TaskType.Inspection],
  [StaffSpecialisation.Sanitation]: [TaskType.RefuseClearance, TaskType.DrainClearance, TaskType.Inspection],
  [StaffSpecialisation.Structural]: [TaskType.Inspection],
  [StaffSpecialisation.GeneralInspection]: [TaskType.Inspection],
  [StaffSpecialisation.AuthorityResponse]: [TaskType.Inspection],
};

/** Pest-class coverage; authority species are further restricted by the shared matcher below. */
export const SPECIALISATION_PEST_CLASSES: Readonly<Record<StaffSpecialisation, readonly PestClass[]>> = {
  [StaffSpecialisation.VectorControl]: [PestClass.VectorBorne],
  [StaffSpecialisation.Sanitation]: [PestClass.VectorBorne, PestClass.Structural, PestClass.Nuisance],
  [StaffSpecialisation.Structural]: [PestClass.Structural],
  [StaffSpecialisation.GeneralInspection]: [PestClass.VectorBorne, PestClass.Structural, PestClass.Nuisance],
  [StaffSpecialisation.AuthorityResponse]: [PestClass.Wildlife, PestClass.Nuisance],
};

/** Historical referral destination classifier, also used to identify specialist authority work. */
// ponytail: matches the catalogue's display name; move to an authority key on PestProfile if names change.
const EXTERNAL_AUTHORITY = /^(AVS|NParks)\b/;

/** Legacy referral classification. This does not exclude a case from unified dispatch. */
export function isExternalReferral(pestClass: PestClass, authority: string): boolean {
  return pestClass === PestClass.Wildlife || EXTERNAL_AUTHORITY.test(authority);
}

export interface RoutingJob {
  taskType: TaskType;
  pestType: PestType;
}

export interface RoutingStaff {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  specialisation?: StaffSpecialisation | null;
}

export interface RankedCandidate {
  crewId: string;
  email: string;
  specialisation: StaffSpecialisation;
  openWorkOrders: number;
  /** True when this specialisation is the first choice for the job, not merely permitted. */
  primary: boolean;
}

export interface IneligibleStaff {
  crewId: string;
  email: string;
  specialisation: StaffSpecialisation | null;
  openWorkOrders: number;
  reason: string;
}

export interface RoutingDecision {
  /** Legacy referral payload. Unified operations returns null; historical referrals remain stored. */
  referral: { authority: string; contactNumber: string } | null;
  candidates: RankedCandidate[];
  ineligible: IneligibleStaff[];
}

/** The pest class, from the catalogue; Mosquito alone is known without one (the v0.8 default). */
export function pestClassOf(pestType: PestType, profile: PestProfile | null): PestClass | null {
  if (profile !== null) {
    return profile.pestClass;
  }
  return pestType === PestType.Mosquito ? PestClass.VectorBorne : null;
}

/** Task types allowed for a pest, shared by creation, assignment and recommendation. */
export function permittedTasksFor(pestType: PestType, profile: PestProfile | null): TaskType[] {
  const pestClass = pestClassOf(pestType, profile);
  if (requiresAuthorityResponse(pestClass, pestType, profile)) return [TaskType.Inspection];
  let tasks: TaskType[];
  switch (pestClass) {
    case PestClass.VectorBorne:
      tasks = Object.values(TaskType);
      break;
    case PestClass.Structural:
    case PestClass.Nuisance:
      tasks = [TaskType.Inspection, TaskType.RefuseClearance, TaskType.DrainClearance];
      break;
    default:
      tasks = [TaskType.Inspection];
  }
  // 8.1.17 names rat as an explicit exception: fogging is not a rat response.
  return pestType === PestType.Rat ? tasks.filter((task) => task !== TaskType.Fogging) : tasks;
}

/** Catalogue authority metadata for historical referrals and capability matching. */
export function externalAuthority(profile: PestProfile | null): string | null {
  if (profile === null) {
    return null;
  }
  return isExternalReferral(profile.pestClass, profile.dispatchAuthority)
    ? profile.dispatchAuthority
    : null;
}

/** The specialisations that may do this job at all, in enum order. */
export function coveringSpecialisations(
  taskType: TaskType,
  pestClass: PestClass | null,
  pestType?: PestType,
  profile: PestProfile | null = null,
): StaffSpecialisation[] {
  if (pestClass === null) return [];
  if (pestType === PestType.Rat && taskType === TaskType.Fogging) return [];
  if (requiresAuthorityResponse(pestClass, pestType, profile)) {
    return taskType === TaskType.Inspection ? [StaffSpecialisation.AuthorityResponse] : [];
  }
  return Object.values(StaffSpecialisation).filter(
    (s) =>
      s !== StaffSpecialisation.AuthorityResponse &&
      pestClass !== null &&
      SPECIALISATION_TASKS[s].includes(taskType) &&
      SPECIALISATION_PEST_CLASSES[s].includes(pestClass),
  );
}

/** Authority cases enter the same dispatch workflow with an explicitly recorded capability. */
function requiresAuthorityResponse(pestClass: PestClass | null, pestType?: PestType, profile: PestProfile | null = null): boolean {
  return pestClass === PestClass.Wildlife || externalAuthority(profile) !== null ||
    [PestType.HouseCrow, PestType.Pigeon, PestType.JavanMyna, PestType.BeeWasp].includes(pestType as PestType);
}

/** The first-choice specialisation: the one whose equipment the task is. */
export function primarySpecialisation(
  taskType: TaskType,
  pestClass: PestClass | null,
  pestType?: PestType,
  profile: PestProfile | null = null,
): StaffSpecialisation | null {
  if (pestClass === null) return null;
  if (requiresAuthorityResponse(pestClass, pestType, profile)) return StaffSpecialisation.AuthorityResponse;
  switch (taskType) {
    case TaskType.Fogging:
    case TaskType.Larviciding:
      return StaffSpecialisation.VectorControl;
    case TaskType.RefuseClearance:
    case TaskType.DrainClearance:
      return StaffSpecialisation.Sanitation;
    default:
      if (taskType === TaskType.Inspection && (pestType === PestType.Rat || pestType === PestType.Cockroach)) {
        return StaffSpecialisation.Sanitation;
      }
      return pestClass === PestClass.Structural
        ? StaffSpecialisation.Structural
        : pestClass === PestClass.VectorBorne
          ? StaffSpecialisation.VectorControl
          : StaffSpecialisation.GeneralInspection;
  }
}

/** @returns null when this person may hold the job, otherwise why not, in the manager's words. */
export function ineligibilityReason(
  staff: RoutingStaff | null,
  job: RoutingJob,
  profile: PestProfile | null,
): string | null {
  if (staff === null || staff.role !== Role.CleaningCrew) {
    return 'not a member of the cleaning crew';
  }
  if (!staff.isActive) {
    return 'the account is deactivated';
  }
  if (!permittedTasksFor(job.pestType, profile).includes(job.taskType)) {
    return `${job.taskType} is not permitted for ${job.pestType}`;
  }
  const specialisation = staff.specialisation ?? null;
  if (specialisation === null) {
    return 'no capability is recorded for this person; set one on the Staff screen';
  }
  const pestClass = pestClassOf(job.pestType, profile);
  if (pestClass === null) {
    return `${job.pestType} has no pest catalogue entry, so no capability can be matched to it`;
  }
  if (requiresAuthorityResponse(pestClass, job.pestType, profile)) {
    return specialisation === StaffSpecialisation.AuthorityResponse && job.taskType === TaskType.Inspection
      ? null : `${specialisation} does not cover this authority response; AuthorityResponse is required`;
  }
  if (specialisation === StaffSpecialisation.AuthorityResponse) {
    return `AuthorityResponse does not cover ${job.pestType}`;
  }
  if (!SPECIALISATION_TASKS[specialisation].includes(job.taskType)) {
    return `${specialisation} does not cover ${job.taskType}`;
  }
  if (!SPECIALISATION_PEST_CLASSES[specialisation].includes(pestClass)) {
    return `${specialisation} does not cover ${pestClass} pests`;
  }
  return null;
}

/**
 * 8.2.2 — eligible people first choice first, then fewest open orders, then email so the order is
 * stable between two reloads. Ineligible people are returned with their reason, never ranked.
 */
export function rankStaff(
  staff: ReadonlyArray<RoutingStaff & { openWorkOrders: number }>,
  job: RoutingJob,
  profile: PestProfile | null,
): RoutingDecision {
  const primary = primarySpecialisation(job.taskType, pestClassOf(job.pestType, profile), job.pestType, profile);
  const candidates: RankedCandidate[] = [];
  const ineligible: IneligibleStaff[] = [];
  for (const member of staff) {
    const reason = ineligibilityReason(member, job, profile);
    const specialisation = member.specialisation ?? null;
    if (reason !== null || specialisation === null) {
      ineligible.push({
        crewId: member.id,
        email: member.email,
        specialisation,
        openWorkOrders: member.openWorkOrders,
        reason: reason ?? 'no capability recorded',
      });
      continue;
    }
    candidates.push({
      crewId: member.id,
      email: member.email,
      specialisation,
      openWorkOrders: member.openWorkOrders,
      primary: specialisation === primary,
    });
  }
  candidates.sort(
    (a, b) =>
      Number(b.primary) - Number(a.primary) ||
      a.openWorkOrders - b.openWorkOrders ||
      a.email.localeCompare(b.email),
  );
  ineligible.sort((a, b) => a.email.localeCompare(b.email));
  return {
    referral: null,
    candidates,
    ineligible,
  };
}
