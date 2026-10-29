import { GeoPoint, Polygon } from '../../entity/valueTypes';
import { isUsableDrivingRoute, MAX_ROAD_SNAP_METRES, WalkingRouteLeg } from '../../boundary/gateways/OneMapGateway';

export interface WalkingVisit {
  stopIndex: number;
  targetPoint: GeoPoint;
  accessPoint: GeoPoint;
  outbound: WalkingRouteLeg;
  return: WalkingRouteLeg;
}

export type ServiceArea = Polygon | readonly (readonly GeoPoint[])[];
export interface AreaVisit { stopIndex: number; targetPoint: GeoPoint; accessPoint: GeoPoint }
export const serviceAreaRings = (area: ServiceArea): readonly (readonly GeoPoint[])[] => Array.isArray(area)
  ? area : (area as Polygon).rings;

/** Routing-only containment of a caller-authorised service area; never changes stored exposure. */
export function isInsideServiceArea(point: GeoPoint, area: ServiceArea | undefined): boolean {
  const validPoint = (p: GeoPoint): boolean => !!p && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
  if (!validPoint(point) || !area) return false;
  const source = serviceAreaRings(area);
  if (!Array.isArray(source) || !source.length) return false;
  const same = (a: GeoPoint, b: GeoPoint): boolean => a.latitude === b.latitude && a.longitude === b.longitude;
  const cross = (a: GeoPoint, b: GeoPoint, c: GeoPoint): number =>
    (b.longitude - a.longitude) * (c.latitude - a.latitude) - (b.latitude - a.latitude) * (c.longitude - a.longitude);
  const onSegment = (p: GeoPoint, a: GeoPoint, b: GeoPoint): boolean => Math.abs(cross(a, b, p)) < 1e-12 &&
    p.longitude >= Math.min(a.longitude, b.longitude) - 1e-12 && p.longitude <= Math.max(a.longitude, b.longitude) + 1e-12 &&
    p.latitude >= Math.min(a.latitude, b.latitude) - 1e-12 && p.latitude <= Math.max(a.latitude, b.latitude) + 1e-12;
  const intersects = (a: GeoPoint, b: GeoPoint, c: GeoPoint, d: GeoPoint): boolean =>
    onSegment(a, c, d) || onSegment(b, c, d) || onSegment(c, a, b) || onSegment(d, a, b) ||
    ((cross(a, b, c) > 0) !== (cross(a, b, d) > 0) && (cross(c, d, a) > 0) !== (cross(c, d, b) > 0));
  const rings: GeoPoint[][] = [];
  for (const raw of source) {
    if (!Array.isArray(raw) || raw.some((p) => !validPoint(p))) return false;
    const ring = raw.length > 1 && same(raw[0]!, raw.at(-1)!) ? raw.slice(0, -1) : [...raw];
    if (ring.length < 3 || new Set(ring.map((p) => `${p.latitude},${p.longitude}`)).size !== ring.length) return false;
    const signedArea = ring.reduce((total, p, i) => total + p.longitude * ring[(i + 1) % ring.length]!.latitude -
      ring[(i + 1) % ring.length]!.longitude * p.latitude, 0);
    if (Math.abs(signedArea) < 1e-14) return false;
    for (let i = 0; i < ring.length; i++) for (let j = i + 1; j < ring.length; j++) {
      if (j === i + 1 || (i === 0 && j === ring.length - 1)) continue;
      if (intersects(ring[i]!, ring[(i + 1) % ring.length]!, ring[j]!, ring[(j + 1) % ring.length]!)) return false;
    }
    rings.push(ring);
  }
  // 0 = outside, 1 = inside, 2 = boundary. Outer boundary counts; holes and their boundaries do not.
  const position = (p: GeoPoint, ring: GeoPoint[]): number => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[j]!, b = ring[i]!;
      if (onSegment(p, a, b)) return 2;
      if ((a.latitude > p.latitude) !== (b.latitude > p.latitude) &&
          p.longitude < (b.longitude - a.longitude) * (p.latitude - a.latitude) / (b.latitude - a.latitude) + a.longitude) inside = !inside;
    }
    return inside ? 1 : 0;
  };
  for (let i = 1; i < rings.length; i++) {
    if (position(rings[i]![0]!, rings[0]!) !== 1) return false;
    for (let j = 0; j < i; j++) {
      const a = rings[i]!, b = rings[j]!;
      if (j > 0 && (position(a[0]!, b) !== 0 || position(b[0]!, a) !== 0)) return false;
      for (let ai = 0; ai < a.length; ai++) for (let bi = 0; bi < b.length; bi++) {
        if (intersects(a[ai]!, a[(ai + 1) % a.length]!, b[bi]!, b[(bi + 1) % b.length]!)) return false;
      }
    }
  }
  return position(point, rings[0]!) !== 0 && rings.slice(1).every((ring) => position(point, ring) === 0);
}

export interface RoutePlan {
  coordinates: GeoPoint[];
  distanceMetres: number;
  durationSeconds: number;
  source: 'onemap' | 'direct-distance';
  /** Verified road metrics in requested stop order; absent for routes without per-leg road data. */
  legs?: Array<{ durationSeconds: number; distanceMetres: number }>;
  drivingStops?: GeoPoint[];
  drivingDurationSeconds?: number;
  walkingDurationSeconds?: number;
  walkingVisits?: WalkingVisit[];
  areaVisits?: AreaVisit[];
}

/** Shared trust boundary for strategy output, including legacy direct-road test strategies. */
export function isVerifiedAccessRoute(route: RoutePlan, stops: GeoPoint[], serviceAreas?: readonly (ServiceArea | undefined)[], depotStopIndices?: readonly number[]): boolean {
  if (!route || route.source !== 'onemap') return false;
  const metric = (value: number | undefined): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const point = (value: GeoPoint | undefined): value is GeoPoint => !!value && Number.isFinite(value.latitude) &&
    Math.abs(value.latitude) <= 90 && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
  const near = (a: GeoPoint, b: GeoPoint, metres = 25): boolean => point(a) && point(b) &&
    new GeoPoint(a.latitude, a.longitude).distanceTo(new GeoPoint(b.latitude, b.longitude)) <= metres;
  const sumMatches = (a: number, b: number): boolean => Math.abs(a - b) < 0.01;
  // Only the known depot centre may stand in for a nearby vehicle gate.
  const depots = new Set([0, ...(near(stops.at(-1)!, stops[0]!, 1) ? [stops.length - 1] : []), ...(depotStopIndices ?? [])]);
  if ([...depots].some((index) => !Number.isInteger(index) || index < 0 || index >= stops.length || !near(stops[index]!, stops[0]!, 1))) return false;
  const directTolerance = (index: number): number => depots.has(index) ? MAX_ROAD_SNAP_METRES : 25;
  if (!metric(route.durationSeconds) || !metric(route.distanceMetres)) return false;
  if (serviceAreas && serviceAreas.length !== stops.length) return false;
  const accessMetadata = route.drivingStops !== undefined || route.walkingVisits !== undefined || route.areaVisits !== undefined ||
    route.drivingDurationSeconds !== undefined || route.walkingDurationSeconds !== undefined;
  if (!accessMetadata) {
    if (!isUsableDrivingRoute(route, stops)) return false;
    let cursor = 0;
    for (const [index, stop] of stops.entries()) {
      while (cursor < route.coordinates.length && !near(stop, route.coordinates[cursor]!, directTolerance(index))) cursor++;
      if (cursor === route.coordinates.length) return false;
    }
    return route.legs === undefined || (Array.isArray(route.legs) && route.legs.length === stops.length - 1 && route.legs.every((leg) => !!leg && metric(leg.durationSeconds) && metric(leg.distanceMetres)) &&
      sumMatches(route.legs.reduce((total, leg) => total + leg.durationSeconds, 0), route.durationSeconds) &&
      sumMatches(route.legs.reduce((total, leg) => total + leg.distanceMetres, 0), route.distanceMetres));
  }
  if (!Array.isArray(route.drivingStops) || route.drivingStops.length !== stops.length || !Array.isArray(route.walkingVisits) ||
      !metric(route.drivingDurationSeconds) || !metric(route.walkingDurationSeconds) || !Array.isArray(route.legs) ||
      route.legs.length !== stops.length - 1 || route.legs.some((leg) => !leg || !metric(leg.durationSeconds) || !metric(leg.distanceMetres)) ||
      route.drivingStops.some((stop) => !point(stop)) || !isUsableDrivingRoute(route, route.drivingStops)) return false;
  // Check driving coverage more tightly than the legacy 250m provider snap tolerance.
  let cursor = 0;
  for (const stop of route.drivingStops) {
    while (cursor < route.coordinates.length && !near(stop, route.coordinates[cursor]!, 25)) cursor++;
    if (cursor === route.coordinates.length) return false;
  }
  const visited = new Set<number>();
  if (route.areaVisits !== undefined && !Array.isArray(route.areaVisits)) return false;
  for (const visit of route.areaVisits ?? []) {
    const index = visit?.stopIndex;
    if (!Number.isInteger(index) || index <= 0 || index >= stops.length - 1 || visited.has(index) ||
        !near(visit.targetPoint, stops[index]!, 1) || !near(visit.accessPoint, route.drivingStops[index]!, 1) ||
        !isInsideServiceArea(visit.accessPoint, serviceAreas?.[index])) return false;
    visited.add(index);
  }
  let walkTime = 0, walkDistance = 0;
  for (const visit of route.walkingVisits) {
    const index = visit?.stopIndex;
    if (!Number.isInteger(index) || index <= 0 || index >= stops.length - 1 || visited.has(index) ||
        !near(visit.targetPoint, stops[index]!, 1) || !near(visit.accessPoint, route.drivingStops[index]!, 1)) return false;
    visited.add(index);
    for (const [leg, start, end] of [[visit.outbound, visit.accessPoint, visit.targetPoint],
      [visit.return, visit.targetPoint, visit.accessPoint]] as const) {
      if (!leg || leg.source !== 'onemap' || leg.mode !== 'walk' || !metric(leg.durationSeconds) || leg.durationSeconds > 600 ||
          !metric(leg.distanceMetres) || !Array.isArray(leg.coordinates) || leg.coordinates.length < 2 ||
          leg.coordinates.some((coordinate) => !point(coordinate)) || !near(start, leg.coordinates[0]!) ||
          !near(end, leg.coordinates.at(-1)!)) return false;
      if (!near(start, end, 1) && (leg.distanceMetres <= 0 || leg.durationSeconds <= 0)) return false;
      walkTime += leg.durationSeconds;
      walkDistance += leg.distanceMetres;
    }
  }
  if (stops.some((stop, index) => !near(stop, route.drivingStops![index]!, directTolerance(index)) && !visited.has(index))) return false;
  if (!near(stops[0]!, route.drivingStops[0]!, MAX_ROAD_SNAP_METRES) ||
      !near(stops.at(-1)!, route.drivingStops.at(-1)!, directTolerance(stops.length - 1))) return false;
  // Each interval carries the previous return and the next outbound walk, as well as driving.
  for (let index = 0; index < route.legs.length; index++) {
    const walkSeconds = (route.walkingVisits.find((visit) => visit.stopIndex === index)?.return.durationSeconds ?? 0) +
      (route.walkingVisits.find((visit) => visit.stopIndex === index + 1)?.outbound.durationSeconds ?? 0);
    const walkMetres = (route.walkingVisits.find((visit) => visit.stopIndex === index)?.return.distanceMetres ?? 0) +
      (route.walkingVisits.find((visit) => visit.stopIndex === index + 1)?.outbound.distanceMetres ?? 0);
    if (route.legs[index]!.durationSeconds < walkSeconds || route.legs[index]!.distanceMetres < walkMetres) return false;
  }
  return sumMatches(walkTime, route.walkingDurationSeconds) && sumMatches(route.drivingDurationSeconds + walkTime, route.durationSeconds) &&
    route.distanceMetres >= walkDistance && sumMatches(route.legs.reduce((total, leg) => total + leg.durationSeconds, 0), route.durationSeconds) &&
    sumMatches(route.legs.reduce((total, leg) => total + leg.distanceMetres, 0), route.distanceMetres);
}

export interface IRouteStrategy {
  calculateRoute(stops: GeoPoint[], signal?: AbortSignal, serviceAreas?: readonly (ServiceArea | undefined)[], depotStopIndices?: readonly number[]): Promise<RoutePlan>;
}
