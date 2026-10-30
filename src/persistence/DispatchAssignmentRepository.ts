import { Database } from './Database';
import { DispatchAssignment, DispatchAssignmentStore } from '../ports/DispatchAssignmentStore';

export class DispatchAssignmentRepository implements DispatchAssignmentStore {
  constructor(private readonly db: Database) {}
  async list(date: string): Promise<DispatchAssignment[]> {
    return (await this.db.query('SELECT payload FROM dispatch_assignment WHERE scheduled_date=$1 ORDER BY created_at, id', [date]))
      .map((row) => row.payload as DispatchAssignment);
  }
  async listBetween(from: string, to: string): Promise<DispatchAssignment[]> {
    return (await this.db.query('SELECT payload FROM dispatch_assignment WHERE scheduled_date BETWEEN $1 AND $2 ORDER BY scheduled_date DESC, created_at, id', [from, to]))
      .map((row) => row.payload as DispatchAssignment);
  }
  async listByCrew(accountId: string): Promise<DispatchAssignment[]> {
    return (await this.db.query('SELECT payload FROM dispatch_assignment WHERE crew_ids @> ARRAY[$1]::uuid[] ORDER BY scheduled_date DESC, created_at, id', [accountId]))
      .map((row) => row.payload as DispatchAssignment);
  }
  async findById(id: string): Promise<DispatchAssignment | null> {
    return ((await this.db.query('SELECT payload FROM dispatch_assignment WHERE id=$1', [id]))[0]?.payload as DispatchAssignment | undefined) ?? null;
  }
  async save(assignment: DispatchAssignment): Promise<void> {
    await this.db.query(`INSERT INTO dispatch_assignment
      (id,scheduled_date,source_team_id,crew_ids,vehicle_id,computed_at,created_by,created_at,payload)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
      ON CONFLICT(id) DO UPDATE SET crew_ids=EXCLUDED.crew_ids, vehicle_id=EXCLUDED.vehicle_id, payload=EXCLUDED.payload`,
    [assignment.id, assignment.date, assignment.teamId, assignment.crewIds, assignment.vehicleId,
      assignment.computedAt, assignment.createdBy, assignment.createdAt, JSON.stringify(assignment)]);
  }
}

export class InMemoryDispatchAssignmentStore implements DispatchAssignmentStore {
  private readonly assignments = new Map<string, DispatchAssignment>();
  async list(date: string): Promise<DispatchAssignment[]> {
    return [...this.assignments.values()].filter((assignment) => assignment.date === date).map((value) => structuredClone(value));
  }
  async listBetween(from: string, to: string): Promise<DispatchAssignment[]> {
    return this.matching((assignment) => assignment.date >= from && assignment.date <= to);
  }
  async listByCrew(accountId: string): Promise<DispatchAssignment[]> {
    return this.matching((assignment) => assignment.crewIds.includes(accountId));
  }
  private matching(keep: (assignment: DispatchAssignment) => boolean): DispatchAssignment[] {
    return [...this.assignments.values()].filter(keep).sort((a, b) => b.date.localeCompare(a.date)).map((value) => structuredClone(value));
  }
  async findById(id: string): Promise<DispatchAssignment | null> {
    const found = this.assignments.get(id);
    return found ? structuredClone(found) : null;
  }
  async save(assignment: DispatchAssignment): Promise<void> {
    this.assignments.set(assignment.id, structuredClone(assignment));
  }
}
