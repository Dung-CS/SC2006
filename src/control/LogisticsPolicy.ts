/** Provisional demonstration envelopes. Replace them with measured equipment data before operational use. */
export interface PackingItem {
  item: string;
  quantity: string;
  quantityCount: number;
  category: 'Safety' | 'Specialist Equipment' | 'Consumables & Chemicals' | 'Containment & Transport';
  icon: string;
  reason: string;
  unitWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  totalWeightKg: number;
  totalVolumeM3: number;
  isProvisional: boolean;
}

export interface LogisticsJob { taskType?: string; pestType?: string; requiredStaff?: number }
export interface LogisticsLoad { weightKg: number; volumeM3: number }
export const LOGISTICS_LOAD_BASIS = 'Provisional equipment dimensions and conservative full-route load envelopes; shared equipment is reused, consumables and collection capacity accumulate per task. Volume and individual-item fit are checked, not an exact 3D packing solution.';

export function generatePackingList(jobs: LogisticsJob[], staffCount = Math.max(1, ...jobs.map((job) => job.requiredStaff ?? 1))): PackingItem[] {
  if (jobs.length === 0) return [];
  const list: PackingItem[] = [];
  const add = (item: string, quantityCount: number, unit: string, category: PackingItem['category'],
    unitWeightKg: number, dimensions: [number, number, number], reason: string, icon = '📦') => {
    if (!quantityCount) return;
    const [lengthCm, widthCm, heightCm] = dimensions;
    list.push({ item, quantity: `${quantityCount} ${unit}`, quantityCount, category, icon, reason,
      unitWeightKg, lengthCm, widthCm, heightCm,
      totalWeightKg: quantityCount * unitWeightKg,
      totalVolumeM3: quantityCount * lengthCm * widthCm * heightCm / 1_000_000,
      isProvisional: true });
  };
  const count = (task: string) => jobs.filter((job) => job.taskType === task).length;
  const pestCount = (pest: string) => jobs.filter((job) => job.pestType === pest).length;
  add('High-Visibility Safety Vests (Class 2)', staffCount, 'vests', 'Safety', 0.3, [30, 25, 3], 'One folded vest per planned crew member', '🦺');
  add('Field Operations Rugged Tablet & GPS', 1, 'unit', 'Safety', 1.2, [30, 22, 5], 'Shared route logging device', '📱');
  add('Industrial First Aid & Eyewash Kit', 1, 'kit', 'Safety', 4, [40, 25, 20], 'Shared response kit', '🩹');
  add('High-Intensity LED Torches (1000 lm)', staffCount, 'units', 'Specialist Equipment', 0.4, [25, 8, 8], 'One torch per crew member', '🔦');
  if (pestCount('Snake')) {
    add('Heavy-Duty Snake Tongs (1.5m) & Handling Hook', 2, 'sets', 'Specialist Equipment', 2, [150, 15, 10], 'Shared capture equipment', '🐍');
    add('Puncture-Proof Snake Transport Container with Ventilation Lock', pestCount('Snake'), 'containers', 'Containment & Transport', 10, [70, 45, 40], 'Conservative loaded-container envelope per task; no automatic depot return');
    add('Kevlar-Reinforced Animal Handling Gauntlets', staffCount, 'pairs', 'Safety', 0.6, [40, 20, 8], 'One pair per crew member');
  }
  if (pestCount('WildBoar') || pestCount('Crocodile') || pestCount('MonitorLizard')) {
    add('Rapid-Deployment Animal Capture Net & Catch Pole', 1, 'set', 'Specialist Equipment', 8, [180, 35, 25], 'Shared capture equipment');
    add('AVS Specimen Containment Vehicle Crate', pestCount('WildBoar') + pestCount('Crocodile') + pestCount('MonitorLizard'), 'crates', 'Containment & Transport', 150, [150, 80, 100], 'Conservative loaded-crate envelope per task');
    add('Perimeter Hazard Exclusion Barrier Tape (100m)', 1, 'roll', 'Safety', 0.5, [20, 20, 10], 'Shared perimeter control');
  }
  if (count('Fogging')) {
    add('Thermal Fogger ULV Machine (Pre-tested)', 1, 'unit', 'Specialist Equipment', 12, [130, 35, 45], 'Shared fogger reused across sequential jobs', '💨');
    add('Permethrin Water-Based Formulation (5L)', count('Fogging'), 'canisters', 'Consumables & Chemicals', 6, [25, 20, 35], 'One full planning canister per fogging task', '🧪');
    add('EN136 Full-Face Respirator with Organic Vapour Filters', staffCount, 'units', 'Safety', 0.8, [25, 20, 20], 'One respirator per planned crew member');
  }
  if (count('Larviciding')) {
    add('Bti (Bacillus thuringiensis israelensis) Granules/Tablets', count('Larviciding') * 12, 'packs', 'Consumables & Chemicals', 0.25, [15, 10, 5], 'Twelve planning packs per larviciding task');
    add('15L Knapsack Pressure Sprayer', 1, 'unit', 'Specialist Equipment', 20, [45, 30, 65], 'One shared filled sprayer envelope');
  }
  const clearance = count('DrainClearance') + count('RefuseClearance');
  if (clearance) {
    add('Telescopic Drain Silt Scoops & Grate Hooks', 2, 'sets', 'Specialist Equipment', 3, [160, 25, 15], 'Shared clearance tools');
    add('Heavy-Duty Bio-Debris Sacks (50L)', clearance * 5, 'sacks', 'Containment & Transport', 10, [60, 40, 25], 'Five full collection envelopes per clearance task; accumulated route load');
  }
  if (pestCount('Rat')) add('Tamper-Resistant Rodent Bait Stations', pestCount('Rat') * 6, 'units', 'Specialist Equipment', 1.2, [30, 25, 15], 'Six placement units per rat task');
  if (count('Inspection')) add('Extendable Telescopic Inspection Mirror', 1, 'unit', 'Specialist Equipment', 0.8, [80, 15, 10], 'Shared inspection tool');
  return list;
}

export function logisticsLoad(items: PackingItem[]): LogisticsLoad {
  return items.reduce((total, item) => ({ weightKg: total.weightKg + item.totalWeightKg,
    volumeM3: total.volumeM3 + item.totalVolumeM3 }), { weightKg: 0, volumeM3: 0 });
}

export function itemFitsCargo(item: PackingItem, vehicle: { cargoLengthCm: number; cargoWidthCm: number; cargoHeightCm: number }): boolean {
  const itemSides = [item.lengthCm, item.widthCm, item.heightCm].sort((a, b) => a - b);
  const cargoSides = [vehicle.cargoLengthCm, vehicle.cargoWidthCm, vehicle.cargoHeightCm].sort((a, b) => a - b);
  return itemSides.every((side, index) => side <= cargoSides[index]!);
}
