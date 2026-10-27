import { GeoPoint } from '../../src/entity/valueTypes';
import { DirectDistanceRoutingStrategy } from '../../src/control/routing/DirectDistanceRoutingStrategy';
import { RoutePlan } from '../../src/control/routing/IRouteStrategy';

/** Deterministic provider stub for allocation tests; it does not test real road access. */
export class MockRoadRoutingStrategy extends DirectDistanceRoutingStrategy {
  override async calculateRoute(stops: GeoPoint[]): Promise<RoutePlan> {
    return { ...await super.calculateRoute(stops), source: 'onemap' };
  }
}
