/**
 * D-Fence — entity class `TreatmentRecord`
 * Stereotype: <<entity>>. Traces: 8.3.12, 8.5.x
 */

import { Uuid, IsoDate, GeoPoint, Polygon, PremisesMix } from './valueTypes';
import {
  Role, LocationLabel, ExposureStatus, AlertTrigger, ChangeClass,
  ForecastRegion, Trajectory, PriorityTier, Driver, ReportType, ReportStatus,
  TaskType, WorkOrderStatus, SourceKind, DeliveryOutcome, PestType,
} from './enums';

export class TreatmentRecord {
  id!: Uuid;
  /** Null for a report-only work order (8.1.2): its target is the work order, not a cluster. */
  clusterId!: Uuid | null;
  workOrderId!: Uuid;
  taskType!: TaskType;
  completionDate!: IsoDate;
  /**
   * The work order's pest, so a rat inspection does not reset the Mosquito treatment driver.
   * Null on a legacy record whose pest is unknown; such a record counts for every pest, as it did
   * before the field existed.
   */
  pestType: PestType | null = null;
}
