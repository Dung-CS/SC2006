import { GeoPoint } from '../../entity/valueTypes';
import { IRouteStrategy, RoutePlan } from './IRouteStrategy';

/** Offline fallback. Travel time uses a conservative, explicit 30 km/h planning assumption. */
export class DirectDistanceRoutingStrategy implements IRouteStrategy {
  async calculateRoute(stops: GeoPoint[]): Promise<RoutePlan> {
    const coordinates: GeoPoint[] = [];
    for (let i = 0; i < stops.length; i++) {
      const start = stops[i]!;
      if (i === 0) { coordinates.push(start); continue; }
      const end = start;
      const from = stops[i - 1]!;
      const latSteps = Math.max(1, Math.ceil(Math.abs(end.latitude - from.latitude) / 0.001));
      const lonSteps = Math.max(1, Math.ceil(Math.abs(end.longitude - from.longitude) / 0.001));
      const steps = Math.max(latSteps, lonSteps);
      // Approximate a street grid with alternating horizontal and vertical legs.
      const bend = new GeoPoint(from.latitude, end.longitude);
      if (from.distanceTo(bend) > 1) coordinates.push(bend);
      coordinates.push(end);
    }
    const distanceMetres = coordinates.slice(1).reduce((sum, point, index) => sum + (coordinates[index]?.distanceTo(point) ?? 0), 0);
    return {
      coordinates,
      distanceMetres,
      durationSeconds: distanceMetres / (30_000 / 3_600),
      source: 'direct-distance',
    };
  }
}
