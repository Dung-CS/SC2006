/**
 * D-Fence — what the client knows about dispatch routing: labels, and the shape the server sends.
 * Traces: 8.1.14, 8.2.1, 8.2.2, 8.6.3.
 *
 * The decision itself is `src/control/StaffRoutingPolicy.ts`, run on the server and returned with
 * the work order. Nothing here infers a capability from an email address or scores a match: the
 * screen shows the recorded capability, the open-order count and the server's reason.
 */
import { StaffSpecialisation } from '../../../src/entity/enums';
import type { RoutingDecision } from '../../../src/control/StaffRoutingPolicy';

export type { RoutingDecision };

export const SPECIALISATION_LABEL: Readonly<Record<StaffSpecialisation, string>> = {
  [StaffSpecialisation.VectorControl]: 'Vector control',
  [StaffSpecialisation.Sanitation]: 'Sanitation',
  [StaffSpecialisation.Structural]: 'Structural pests',
  [StaffSpecialisation.GeneralInspection]: 'General inspection',
  [StaffSpecialisation.AuthorityResponse]: 'Authority response',
};

/** A recorded capability in words, or the explicit unknown. */
export function specialisationLabel(value: string | null | undefined): string {
  return Object.values(StaffSpecialisation).find((s) => s === value) === undefined
    ? 'Capability not recorded'
    : SPECIALISATION_LABEL[value as StaffSpecialisation];
}
