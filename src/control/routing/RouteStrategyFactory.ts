import { OneMapGateway } from '../../boundary/gateways/OneMapGateway';
import { IRouteStrategy } from './IRouteStrategy';
import { OneMapRoadRoutingStrategy } from './OneMapRoadRoutingStrategy';

export class RouteStrategyFactory {
  static create(oneMapGateway: OneMapGateway | null): IRouteStrategy {
    return new OneMapRoadRoutingStrategy(oneMapGateway);
  }
}
