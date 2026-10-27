import { GeoPoint } from '../../entity/valueTypes';

export interface RoutePlan {
  coordinates: GeoPoint[];
  distanceMetres: number;
  durationSeconds: number;
  source: 'onemap' | 'direct-distance';
}

export interface IRouteStrategy {
  calculateRoute(stops: GeoPoint[]): Promise<RoutePlan>;
}
