/**
 * D-Fence — recording a crew member's capability, and keeping it when stored.
 *
 * Capability decides who may be dispatched (StaffRoutingPolicy), so changing it is a manager's
 * decision, audited like any other state change (2.4.1), and an unrecorded value must survive a
 * round trip through Postgres as "unknown" rather than turning into some capability.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { AuthenticationRefused } from '../src/control/AuthenticationController';
import { StaffAccountController } from '../src/control/StaffAccountController';
import { principalFor } from '../src/control/DashboardController';
import { Principal } from '../src/control/Principal';
import { AdminRoutes } from '../src/boundary/http/AdminRoutes';
import { Request, Response } from '../src/boundary/http/RouteHandler';
import { AccountRepository } from '../src/persistence/AccountRepository';
import { Database, Row } from '../src/persistence/Database';
import {
  InMemoryAccountStore,
  InMemorySessionStore,
  LocalAuthProvider,
} from '../src/persistence/memory/InMemoryAccountStores';
import { InMemoryAuditStore } from '../src/persistence/memory/InMemoryStores';
import { Account } from '../src/entity/Account';
import { Role, StaffSpecialisation } from '../src/entity/enums';

const PASSWORD = 'FieldWork2026';
const MANAGER = principalFor(Role.OperationsManager, 'manager-1');
const CREW = new Principal('crew-x', Role.CleaningCrew, 'session-crew');

interface Fixture {
  staff: StaffAccountController;
  accounts: InMemoryAccountStore;
  audit: InMemoryAuditStore;
  routes: AdminRoutes;
}

function fixture(): Fixture {
  const accounts = new InMemoryAccountStore();
  const audit = new InMemoryAuditStore();
  const ac = new AccessControlService(new AccessPolicy(), audit);
  const staff = new StaffAccountController(ac, new LocalAuthProvider(), accounts, new InMemorySessionStore(), audit);
  const routes = new AdminRoutes(ac, staff);
  routes.useResolver({ resolve: async (t) => (t === 'mgr' ? MANAGER : t === 'crew' ? CREW : null) });
  return { staff, accounts, audit, routes };
}

async function actions(audit: InMemoryAuditStore): Promise<string[]> {
  return (await audit.recent(100)).map((e) => e.action);
}

describe('Capability on the account — create and update', () => {
  let f: Fixture;
  beforeEach(() => {
    f = fixture();
  });

  it('C1 — a new crew member can be created with a capability, and the choice is audited', async () => {
    const a = await f.staff.createStaffAccount('vc@d-fence.test', Role.CleaningCrew, PASSWORD, MANAGER, new Date(), StaffSpecialisation.VectorControl);
    expect((await f.accounts.findById(a.id))?.specialisation).toBe(StaffSpecialisation.VectorControl);
    expect(await actions(f.audit)).toContain('account:specialisation:Unknown -> VectorControl');
  });

  it('C2 — created without one, it is explicitly unknown, never defaulted', async () => {
    const a = await f.staff.createStaffAccount('new@d-fence.test', Role.CleaningCrew, PASSWORD, MANAGER);
    expect(a.specialisation).toBeNull();
    expect(new Account().specialisation).toBeNull(); // legacy fixtures built without the field
  });

  it('C3 — a manager records and then changes a capability; each change names old and new', async () => {
    const a = await f.staff.createStaffAccount('crew@d-fence.test', Role.CleaningCrew, PASSWORD, MANAGER);
    await f.staff.setSpecialisation(a.id, StaffSpecialisation.Sanitation, MANAGER);
    await f.staff.setSpecialisation(a.id, StaffSpecialisation.Structural, MANAGER);
    expect((await f.accounts.findById(a.id))?.specialisation).toBe(StaffSpecialisation.Structural);
    const log = await actions(f.audit);
    expect(log).toContain('account:specialisation:Unknown -> Sanitation');
    expect(log).toContain('account:specialisation:Sanitation -> Structural');
  });

  it('C4 — a crew member cannot change anyone’s capability, their own included', async () => {
    const a = await f.staff.createStaffAccount('crew@d-fence.test', Role.CleaningCrew, PASSWORD, MANAGER);
    await expect(f.staff.setSpecialisation(a.id, StaffSpecialisation.VectorControl, CREW)).rejects.toThrow(/not authorised/);
    await expect(
      f.staff.createStaffAccount('other@d-fence.test', Role.CleaningCrew, PASSWORD, CREW, new Date(), StaffSpecialisation.VectorControl),
    ).rejects.toThrow(/not authorised/);
    expect((await f.accounts.findById(a.id))?.specialisation).toBeNull();
  });

  it('C5 — a capability is crew-only: not on a manager, so it can never stand in for a Role', async () => {
    await expect(
      f.staff.createStaffAccount('m@d-fence.test', Role.OperationsManager, PASSWORD, MANAGER, new Date(), StaffSpecialisation.VectorControl),
    ).rejects.toBeInstanceOf(AuthenticationRefused);
    const m = await f.staff.createStaffAccount('m2@d-fence.test', Role.OperationsManager, PASSWORD, MANAGER);
    await expect(f.staff.setSpecialisation(m.id, StaffSpecialisation.Sanitation, MANAGER)).rejects.toThrow(/only a Cleaning Crew/);
    expect(m.role).toBe(Role.OperationsManager);
  });
});

function response(): Response & { code: number; body: unknown } {
  const res = {
    code: 200,
    body: undefined as unknown,
    status(code: number) {
      res.code = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
    },
    text() {},
  };
  return res;
}

const req = (route: string, params: Record<string, string> = {}, body: unknown = undefined, token = 'mgr'): Request => ({
  headers: { authorization: `Bearer ${token}` },
  params: { route, ...params },
  body,
});

describe('HTTP — the audited capability endpoint and the staff payload', () => {
  let f: Fixture;
  let crewId = '';
  beforeEach(async () => {
    f = fixture();
    crewId = (await f.staff.createStaffAccount('crew@d-fence.test', Role.CleaningCrew, PASSWORD, MANAGER)).id;
  });

  it('A1 — the staff list carries the capability, null for a member who has none recorded', async () => {
    const res = response();
    await f.routes.handle(req('/api/ops/staff'), res);
    const staff = (res.body as { staff: Array<{ id: string; specialisation: string | null }> }).staff;
    expect(staff.find((s) => s.id === crewId)?.specialisation).toBeNull();
  });

  it('A2 — a manager sets it over HTTP; the answer carries the new value', async () => {
    const res = response();
    await f.routes.handle(req('/api/ops/staff/:id/specialisation', { id: crewId }, { specialisation: 'GeneralInspection' }), res);
    expect(res.code).toBe(200);
    expect((res.body as { specialisation: string }).specialisation).toBe('GeneralInspection');
  });

  it('A3 — an unknown value is refused with the accepted list, and nothing changes', async () => {
    const res = response();
    await f.routes.handle(req('/api/ops/staff/:id/specialisation', { id: crewId }, { specialisation: 'Exterminator' }), res);
    expect(res.code).toBe(400);
    expect((res.body as { error: string }).error).toContain('VectorControl, Sanitation, Structural, GeneralInspection');
    expect((await f.accounts.findById(crewId))?.specialisation).toBeNull();
  });

  it('A4 — a crew bearer is refused with 403 and no detail (2.3.7)', async () => {
    const res = response();
    await f.routes.handle(req('/api/ops/staff/:id/specialisation', { id: crewId }, { specialisation: 'VectorControl' }, 'crew'), res);
    expect(res.code).toBe(403);
    expect((await f.accounts.findById(crewId))?.specialisation).toBeNull();
  });

  it('A5 — POST /api/ops/staff accepts a capability for a new crew member', async () => {
    const res = response();
    await f.routes.handle(
      req('/api/ops/staff', {}, { email: 'san@d-fence.test', role: 'CleaningCrew', password: PASSWORD, specialisation: 'Sanitation' }),
      res,
    );
    expect(res.code).toBe(201);
    expect((res.body as { specialisation: string }).specialisation).toBe('Sanitation');
  });
});

/** A Database that records what it was asked and answers with the given rows. */
function fakeDb(rows: Row[] = []): { db: Database; calls: Array<{ sql: string; params: unknown[] }> } {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const db = {
    query: async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return rows;
    },
  } as unknown as Database;
  return { db, calls };
}

function row(specialisation: unknown): Row {
  return {
    id: 'acc-1', email: 'crew@d-fence.test', auth_user_id: 'auth-1', email_verified: true,
    role: 'CleaningCrew', is_active: true, telegram_chat_id: null, failed_attempts: 0,
    first_failure_at: null, locked_until: null, created_at: new Date(0), specialisation,
  };
}

describe('Persistence — the Postgres mapping and migration 010', () => {
  it('P1 — save writes the capability, including an update of an existing row', async () => {
    const { db, calls } = fakeDb();
    const a = new Account();
    Object.assign(a, { id: 'acc-1', email: 'crew@x', authUserId: 'auth-1', emailVerified: true, role: Role.CleaningCrew, isActive: true, telegramChatId: null, createdAt: new Date(0) });
    a.specialisation = StaffSpecialisation.Sanitation;
    await new AccountRepository(db).save(a);
    expect(calls[0]?.params[11]).toBe('Sanitation');
    expect(calls[0]?.sql).toMatch(/specialisation\s+=\s+EXCLUDED\.specialisation/);
  });

  it('P2 — reads map a stored value back; NULL and an unrecognised value both read as unknown', async () => {
    expect((await new AccountRepository(fakeDb([row('Structural')]).db).findById('acc-1'))?.specialisation).toBe(StaffSpecialisation.Structural);
    expect((await new AccountRepository(fakeDb([row('AuthorityResponse')]).db).findById('acc-1'))?.specialisation).toBe(StaffSpecialisation.AuthorityResponse);
    expect((await new AccountRepository(fakeDb([row(null)]).db).findById('acc-1'))?.specialisation).toBeNull();
    expect((await new AccountRepository(fakeDb([row('Wizard')]).db).findById('acc-1'))?.specialisation).toBeNull();
  });

  it('P3 — migrations retain nullable capability without upgrades and permit exactly the current enum, crew only', () => {
    const initial = readFileSync(new URL('../src/persistence/migrations/010_staff_specialisation.sql', import.meta.url), 'utf8');
    expect(initial).toMatch(/ADD COLUMN IF NOT EXISTS specialisation text;/);
    const sql = readFileSync(new URL('../src/persistence/migrations/015_authority_response.sql', import.meta.url), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(sql).not.toMatch(/DEFAULT/i);
    expect(sql).not.toMatch(/UPDATE\s+account/i);
    const listed = [...(/IN \(([^)]*)\)/.exec(sql)?.[1] ?? '').matchAll(/'(\w+)'/g)].map((m) => m[1]);
    expect(listed).toEqual(Object.values(StaffSpecialisation));
    expect(sql).toMatch(/role = 'CleaningCrew'/);
  });
});
