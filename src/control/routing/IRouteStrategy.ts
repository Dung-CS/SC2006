import { GeoPoint } from '../../entity/valueTypes';

export interface RoutePlan {
  coordinates: GeoPoint[];
  distanceMetres: number;
  durationSeconds: number;
  source: 'onemap' | 'direct-distance';
  /** Verified road metrics in requested stop order; absent for routes without per-leg road data. */
  legs?: Array<{ durationSeconds: number; distanceMetres: number }>;
}

export interface IRouteStrategy {
  calculateRoute(stops: GeoPoint[], signal?: AbortSignal): Promise<RoutePlan>;
}
