import { randomUUID } from 'node:crypto';
import { Vehicle } from '../entity/Vehicle';
import { HqLocation } from '../entity/enums';
import { VehicleStore } from '../ports/VehicleStore';
import { AccessControlService } from './AccessControlService';
import { Principal } from './Principal';

export class VehicleRejected extends Error {}
export class VehicleNotFound extends Error {}

export class VehicleController {
  constructor(private readonly ac: AccessControlService, private readonly store: VehicleStore,
    private readonly onChanged?: () => Promise<void> | void) {}

  async list(by: Principal): Promise<Vehicle[]> {
    await this.ac.authorise(by, 'staff:manage', { kind: 'vehicle' });
    return this.store.list();
  }

  async save(draft: unknown, by: Principal, id?: string): Promise<Vehicle> {
    await this.ac.authorise(by, 'staff:manage', { kind: 'vehicle', ...(id ? { id } : {}) });
    const existing = id ? await this.store.findById(id) : null;
    if (id && !existing) throw new VehicleNotFound('vehicle not found');
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) throw new VehicleRejected('Enter vehicle details.');
    const input = draft as Record<string, unknown>;
    const text = (key: string, max: number): string => {
      if (typeof input[key] !== 'string' || !input[key].trim() || input[key].length > max) {
        throw new VehicleRejected(`${key === 'registration' ? 'Registration' : 'Vehicle name'} is required and must be no longer than ${max} characters.`);
      }
      return input[key].trim();
    };
    const positive = (key: string): number => {
      const value = input[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        throw new VehicleRejected(`${key} must be a positive finite number.`);
      }
      return value;
    };
    const registration = text('registration', 60).toUpperCase();
    const name = text('name', 120);
    const optionalText = (key: 'model' | 'photoUrl', max: number): string | null => {
      const value = input[key] === undefined ? existing?.[key] : input[key];
      if (value === undefined || value === null || value === '') return null;
      if (typeof value !== 'string' || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) {
        throw new VehicleRejected(`${key === 'model' ? 'Vehicle model' : 'Photo URL'} is invalid.`);
      }
      return value.trim() || null;
    };
    const model = optionalText('model', 120);
    const photoUrl = optionalText('photoUrl', 2048);
    if (photoUrl && !(/^\/(?!\/)[^\\]*$/.test(photoUrl) || (() => {
      try { const url = new URL(photoUrl); return url.protocol === 'https:' && !url.username && !url.password; }
      catch { return false; }
    })())) throw new VehicleRejected('Photo URL must be a local image path or an HTTPS URL.');
    if (!Object.values(HqLocation).includes(input.hqLocation as HqLocation)) throw new VehicleRejected('Select a regional HQ.');
    const maxPayloadKg = positive('maxPayloadKg');
    const maxCargoVolumeM3 = positive('maxCargoVolumeM3');
    const cargoLengthCm = positive('cargoLengthCm');
    const cargoWidthCm = positive('cargoWidthCm');
    const cargoHeightCm = positive('cargoHeightCm');
    const seatCapacity = positive('seatCapacity');
    if (!Number.isInteger(seatCapacity)) throw new VehicleRejected('Seat capacity must be a positive whole number.');
    if (maxCargoVolumeM3 > cargoLengthCm * cargoWidthCm * cargoHeightCm / 1_000_000 + 1e-9) {
      throw new VehicleRejected('Usable cargo volume cannot exceed the cargo bay dimensions.');
    }
    if (typeof input.isAvailable !== 'boolean' || typeof input.isDemo !== 'boolean') {
      throw new VehicleRejected('Availability and demo-data status must be specified.');
    }
    if ((await this.store.list()).some((v) => v.id !== id && v.registration.toUpperCase() === registration)) {
      throw new VehicleRejected('A vehicle with this registration already exists.');
    }
    const vehicle: Vehicle = { id: id ?? randomUUID(), registration, name, model, photoUrl, hqLocation: input.hqLocation as HqLocation,
      maxPayloadKg, maxCargoVolumeM3, cargoLengthCm, cargoWidthCm, cargoHeightCm, seatCapacity,
      isAvailable: input.isAvailable, isDemo: input.isDemo };
    let saved: Vehicle;
    try { saved = await this.store.save(vehicle); }
    catch (error) {
      if ((error as { code?: string }).code === '23505') throw new VehicleRejected('A vehicle with this registration already exists.');
      throw error;
    }
    await this.onChanged?.();
    return saved;
  }
}
