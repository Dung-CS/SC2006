import { Vehicle } from '../entity/Vehicle';

export interface VehicleStore {
  list(): Promise<Vehicle[]>;
  findById(id: string): Promise<Vehicle | null>;
  save(vehicle: Vehicle): Promise<Vehicle>;
}
