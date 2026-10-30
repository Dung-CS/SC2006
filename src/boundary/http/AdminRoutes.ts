/**
 * D-Fence — AdminRoutes.
 * Stereotype: <<boundary>>. Traces: 2.2.3, 2.2.4, 2.3.4, 2.4.1.
 *
 * Routes:
 *   GET  /api/ops/staff                    the staff list (2.2.3, 2.2.4)
 *   GET  /api/ops/staff/crew               assignable crew, active only (8.2.2, 8.2.3)
 *   GET  /api/ops/staff/:id                one staff member's profile and their dispatches
 *   POST /api/ops/staff                    create a manager or crew account (2.2.3)
 *   POST /api/ops/staff/:id/deactivate     (2.2.4, 2.2.5)
 *   POST /api/ops/staff/:id/reactivate     (2.2.4)
 *   POST /api/ops/staff/:id/specialisation body { specialisation } — crew capability, audited
 *
 * Every path here is manager-only, and none of them checks that: `StaffAccountController` calls
 * `AccessControlService` first. A boundary class that repeated the role test would be a second
 * place for 2.2.3 to live, and the one that drifts.
 */
import { RouteHandler, Request, Response } from './RouteHandler';
import { AccessControlService } from '../../control/AccessControlService';
import { StaffAccountController } from '../../control/StaffAccountController';
import { AuthenticationRefused } from '../../control/AuthenticationController';
import { HqLocation, Role, StaffSpecialisation, StaffStatus } from '../../entity/enums';

interface StaffBody {
  email?: string;
  displayName?: string | null;
  profileDescription?: string | null;
  password?: string;
  role?: string;
  specialisation?: string | null;
  hqLocation?: string | null;
  staffStatus?: string | null;
  onCallLagHours?: number | null;
}

function parseHqLocation(value: unknown): HqLocation {
  const found = Object.values(HqLocation).find((location) => location === value);
  if (found === undefined) throw new AuthenticationRefused(`${String(value)} is not an HQ location — one of: ${Object.values(HqLocation).join(', ')}`);
  return found;
}

/** 10.3.6 — a capability from a request body, or the refusal listing the accepted values. */
function parseSpecialisation(value: unknown): StaffSpecialisation {
  const found = Object.values(StaffSpecialisation).find((s) => s === value);
  if (found === undefined) {
    throw new AuthenticationRefused(
      `${String(value)} is not a capability — one of: ${Object.values(StaffSpecialisation).join(', ')}`,
    );
  }
  return found;
}

export class AdminRoutes extends RouteHandler {
  constructor(
    ac: AccessControlService,
    private readonly staff: StaffAccountController,
  ) {
    super(ac);
  }

  routes(): string[] {
    return ['/api/ops/staff/crew', '/api/ops/staff', '/api/ops/staff/:id'];
  }

  override writeRoutes(): string[] {
    return [
      '/api/ops/staff',
      '/api/ops/staff/:id/deactivate',
      '/api/ops/staff/:id/reactivate',
      '/api/ops/staff/:id/specialisation',
      '/api/ops/staff/:id/hq-location',
      '/api/ops/staff/:id/status',
      '/api/ops/staff/:id/display-name',
    ];
  }

  async handle(req: Request, res: Response): Promise<void> {
    const id = req.params.id ?? '';
    try {
      const principal = await this.resolvePrincipal(req);
      switch (req.params.route) {
        case '/api/ops/staff': {
          if (req.body === undefined || req.body === null || Object.keys(req.body as object).length === 0) {
            res.json({ staff: (await this.staff.listStaff(principal)).map(AdminRoutes.project) });
            return;
          }
          const body = req.body as StaffBody;
          const role = Object.values(Role).find((r) => r === body.role);
          if (role === undefined) {
            throw new AuthenticationRefused(`${String(body.role)} is not one of the three roles (2.2.1)`);
          }
          // Absent or null records "not set yet"; anything else must be a real capability.
          const specialisation =
            body.specialisation === undefined || body.specialisation === null
              ? null
              : parseSpecialisation(body.specialisation);
          const account = await this.staff.createStaffAccount(
            body.email ?? '',
            role,
            body.password ?? '',
            principal,
            new Date(),
            specialisation,
            body.hqLocation == null ? null : parseHqLocation(body.hqLocation),
            body.displayName,
            body.profileDescription,
          );
          res.status(201).json(AdminRoutes.project(account));
          return;
        }
        case '/api/ops/staff/crew':
          res.json({ crew: (await this.staff.assignableCrew(principal)).map(AdminRoutes.project) });
          return;
        case '/api/ops/staff/:id': {
          const detail = await this.staff.staffDetail(id, principal);
          res.json({ staff: AdminRoutes.project(detail.account), dispatches: detail.dispatches });
          return;
        }
        case '/api/ops/staff/:id/deactivate': {
          const result = await this.staff.deactivateAccount(id, principal);
          // The session count is stated, not hidden: a manager deactivating someone mid-shift needs
          // to know whether they were signed in at the time (2.2.5).
          res.json({ ...AdminRoutes.project(result.account), sessionsEnded: result.sessionsEnded });
          return;
        }
        case '/api/ops/staff/:id/reactivate':
          res.json(AdminRoutes.project(await this.staff.reactivateAccount(id, principal)));
          return;
        case '/api/ops/staff/:id/display-name':
          res.json(AdminRoutes.project(await this.staff.setDisplayName(id, ((req.body ?? {}) as StaffBody).displayName, principal,
            ((req.body ?? {}) as StaffBody).profileDescription)));
          return;
        case '/api/ops/staff/:id/specialisation': {
          const value = ((req.body ?? {}) as { specialisation?: unknown }).specialisation;
          res.json(AdminRoutes.project(await this.staff.setSpecialisation(id, parseSpecialisation(value), principal)));
          return;
        }
        case '/api/ops/staff/:id/status': {
          const b = (req.body ?? {}) as { status?: unknown; lagHours?: number };
          const status = Object.values(StaffStatus).find((s) => s === b.status);
          if (status === undefined) {
            throw new AuthenticationRefused(
              `${String(b.status)} is not a staff status — one of: ${Object.values(StaffStatus).join(', ')}`,
            );
          }
          res.json(
            AdminRoutes.project(
              await this.staff.setStaffStatus(id, status, principal, b.lagHours ?? 2),
            ),
          );
          return;
        }
        case '/api/ops/staff/:id/hq-location': {
          const value = ((req.body ?? {}) as { hqLocation?: unknown }).hqLocation;
          res.json(AdminRoutes.project(await this.staff.setHqLocation(id, parseHqLocation(value), principal)));
          return;
        }
        default:
          res.status(404).json({ error: 'no such route', remedy: 'check the path' });
      }
    } catch (error) {
      if (error instanceof AuthenticationRefused) {
        res.status(400).json({ error: error.reason, remedy: 'correct the details and try again' });
        return;
      }
      this.fail(res, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Never the `authUserId`: it is the provider's credential handle, and no screen needs it. */
  private static project(account: {
    id: string;
    email: string;
    displayName?: string | null;
    profileDescription?: string | null;
    role: Role;
    isActive: boolean;
    specialisation: StaffSpecialisation | null;
    hqLocation: HqLocation | null;
    staffStatus?: StaffStatus;
    onCallLagHours?: number;
    createdAt: Date;
  }): {
    id: string;
    accountId: string;
    email: string;
    displayName: string | null;
    profileDescription: string | null;
    role: Role;
    isActive: boolean;
    specialisation: StaffSpecialisation | null;
    hqLocation: HqLocation | null;
    staffStatus: StaffStatus;
    onCallLagHours: number;
    createdAt: Date;
  } {
    return {
      id: account.id,
      accountId: account.id,
      email: account.email,
      displayName: account.displayName ?? null,
      profileDescription: account.profileDescription ?? null,
      role: account.role,
      isActive: account.isActive,
      specialisation: account.specialisation,
      hqLocation: account.hqLocation,
      staffStatus: account.staffStatus ?? StaffStatus.Available,
      onCallLagHours: account.onCallLagHours ?? 0,
      createdAt: account.createdAt,
    };
  }
}
