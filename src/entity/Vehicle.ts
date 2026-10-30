import { HqLocation } from './enums';

/** Recorded vehicle capacities. Demo values are explicitly illustrative, never an actual fleet claim. */
export interface Vehicle {
  id: string;
  registration: string;
  name: string;
  /** Recorded make/model and a matching vehicle photograph, when known. */
  model?: string | null;
  photoUrl?: string | null;
  hqLocation: HqLocation;
  maxPayloadKg: number;
  maxCargoVolumeM3: number;
  cargoLengthCm: number;
  cargoWidthCm: number;
  cargoHeightCm: number;
  seatCapacity: number;
  isAvailable: boolean;
  isDemo: boolean;
}
