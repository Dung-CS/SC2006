import { OneMapGateway } from '../../boundary/gateways/OneMapGateway';
import { DirectDistanceRoutingStrategy } from './DirectDistanceRoutingStrategy';
import { IRouteStrategy } from './IRouteStrategy';
import { OneMapRoadRoutingStrategy } from './OneMapRoadRoutingStrategy';

export class RouteStrategyFactory {
  static create(oneMapGateway: OneMapGateway | null): IRouteStrategy {
    return oneMapGateway === null ? new DirectDistanceRoutingStrategy() : new OneMapRoadRoutingStrategy(oneMapGateway);
  }
}
