import { DrivingRouteLeg, isUsableDrivingRoute, OneMapGateway } from '../../boundary/gateways/OneMapGateway';
import { GeoPoint } from '../../entity/valueTypes';
import { IRouteStrategy, RoutePlan } from './IRouteStrategy';

export class OneMapRoadRoutingStrategy implements IRouteStrategy {
  private readonly legs = new Map<string, { value: DrivingRouteLeg; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<DrivingRouteLeg>>();
  constructor(private readonly gateway: OneMapGateway | null) {}

  /** Reuse directed road legs while the planner tests overlapping candidate circuits. */
  private async drivingLeg(start: GeoPoint, end: GeoPoint): Promise<DrivingRouteLeg> {
    const key = `${start.latitude},${start.longitude};${end.latitude},${end.longitude}`;
    const cached = this.legs.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.legs.delete(key);
      this.legs.set(key, cached);
      return this.copyLeg(cached.value);
    }
    this.legs.delete(key);
    let pending = this.inFlight.get(key);
    if (!pending) {
      if (!this.gateway) throw new Error('OneMap driving routes are unavailable');
      pending = this.gateway.drivingRoute(start, end).then((value) => {
        if (!isUsableDrivingRoute(value, [start, end])) throw new Error('OneMap driving leg did not verify road access');
        const copy = this.copyLeg(value);
        this.legs.set(key, { value: copy, expiresAt: Date.now() + 5 * 60_000 });
        while (this.legs.size > 512) this.legs.delete(this.legs.keys().next().value!);
        return copy;
      });
      this.inFlight.set(key, pending);
    }
    try {
      return this.copyLeg(await pending);
    } finally {
      if (this.inFlight.get(key) === pending) this.inFlight.delete(key);
    }
  }

  private copyLeg(leg: DrivingRouteLeg): DrivingRouteLeg {
    return { ...leg, coordinates: leg.coordinates.map((point) => new GeoPoint(point.latitude, point.longitude)) };
  }

  async calculateRoute(stops: GeoPoint[]): Promise<RoutePlan> {
    if (stops.length < 2) throw new Error('A driving route needs at least two stops');
    const legs = await Promise.all(stops.slice(1).map((end, index) => this.drivingLeg(stops[index]!, end)));
    const coordinates: GeoPoint[] = [];
    for (const leg of legs) {
      if (coordinates.length && coordinates.at(-1)!.distanceTo(leg.coordinates[0]!) > 50) {
        throw new Error('OneMap driving legs do not form a continuous circuit');
      }
      for (const point of leg.coordinates) {
        if (coordinates.length === 0 || coordinates[coordinates.length - 1]!.distanceTo(point) > 1) coordinates.push(point);
      }
    }
    const route: RoutePlan = {
      coordinates,
      distanceMetres: legs.reduce((sum, leg) => sum + leg.distanceMetres, 0),
      durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
      source: 'onemap',
    };
    if (!isUsableDrivingRoute(route, stops)) throw new Error('OneMap returned an unusable driving circuit');
    return route;
  }
}
