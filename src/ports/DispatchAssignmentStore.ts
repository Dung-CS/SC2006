import type { PlannedTeamRoute } from '../control/RouteOptimizationService';

export interface ChecklistItem {
  id: string;
  item: string;
  quantity?: string;
  icon?: string;
  category?: string;
  checked: boolean;
  checkedBy?: string;
  checkedAt?: string;
}

export interface DispatchAssignment {
  id: string;
  date: string;
  teamId: string;
  crewIds: string[];
  vehicleId: string;
  workOrderIds: string[];
  computedAt: string;
  routeSnapshot: PlannedTeamRoute;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
  /** Manually created or edited dispatches are fixed and unchanged by automatic assignment. */
  isFixed?: boolean;
  /** Logistics equipment checklist verified by crew. */
  checklist?: ChecklistItem[];
  /** Cancelled when its last task was removed; its crew and vehicle are then free. */
  status?: 'Cancelled';
  /** Set when stops were removed but the road re-check of the rest failed or timed out. */
  needsRoadCheck?: boolean;
}

export interface DispatchAssignmentStore {
  list(date: string): Promise<DispatchAssignment[]>;
  /** Inclusive date range, newest date first. */
  listBetween(from: string, to: string): Promise<DispatchAssignment[]>;
  /** Every assignment whose crew includes this account, newest date first. */
  listByCrew(accountId: string): Promise<DispatchAssignment[]>;
  findById(id: string): Promise<DispatchAssignment | null>;
  save(assignment: DispatchAssignment): Promise<void>;
}
