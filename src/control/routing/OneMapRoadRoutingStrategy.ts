import { DrivingRouteLeg, OneMapGateway } from '../../boundary/gateways/OneMapGateway';
import { GeoPoint } from '../../entity/valueTypes';
import { DirectDistanceRoutingStrategy } from './DirectDistanceRoutingStrategy';
import { IRouteStrategy, RoutePlan } from './IRouteStrategy';

export class OneMapRoadRoutingStrategy implements IRouteStrategy {
  private readonly fallback = new DirectDistanceRoutingStrategy();
  private readonly legs = new Map<string, { value: DrivingRouteLeg; expiresAt: number }>();
  private readonly inFlight = new Map<string, Promise<DrivingRouteLeg>>();
  constructor(private readonly gateway: OneMapGateway) {}

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
      pending = this.gateway.drivingRoute(start, end).then((value) => {
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
    if (stops.length < 2) return this.fallback.calculateRoute(stops);
    try {
      const legs = await Promise.all(stops.slice(1).map((end, index) => this.drivingLeg(stops[index]!, end)));
      const coordinates: GeoPoint[] = [];
      for (const leg of legs) {
        for (const point of leg.coordinates) {
          if (coordinates.length === 0 || coordinates[coordinates.length - 1]!.distanceTo(point) > 1) coordinates.push(point);
        }
      }
      return {
        coordinates: coordinates.length ? coordinates : [...stops],
        distanceMetres: legs.reduce((sum, leg) => sum + leg.distanceMetres, 0),
        durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
        source: 'onemap',
      };
    } catch {
      return this.fallback.calculateRoute(stops);
    }
  }
}
