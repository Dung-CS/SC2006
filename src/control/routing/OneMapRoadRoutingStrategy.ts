import { DrivingRouteLeg, isUsableDrivingRoute, OneMapGateway } from '../../boundary/gateways/OneMapGateway';
import { GeoPoint } from '../../entity/valueTypes';
import { IRouteStrategy, RoutePlan } from './IRouteStrategy';

export class OneMapRoadRoutingStrategy implements IRouteStrategy {
  private readonly legs = new Map<string, { value: DrivingRouteLeg; expiresAt: number }>();
  private readonly inFlight = new Map<string, {
    promise: Promise<DrivingRouteLeg>;
    controller: AbortController;
    waiters: Set<symbol>;
  }>();
  private activeLegRequests = 0;
  private readonly queuedLegRequests: Array<{
    signal: AbortSignal;
    resolve: (release: () => void) => void;
    reject: (error: Error) => void;
    abort: () => void;
  }> = [];
  constructor(private readonly gateway: OneMapGateway | null) {}

  /** Bound provider fan-out across all circuits computed by this strategy instance. */
  private acquireLegRequest(signal: AbortSignal): Promise<() => void> {
    if (signal.aborted) return Promise.reject(new Error('Road route request was cancelled'));
    if (this.activeLegRequests < 4) {
      this.activeLegRequests++;
      return Promise.resolve(() => this.releaseLegRequest());
    }
    return new Promise((resolve, reject) => {
      const queued = {
        signal,
        resolve,
        reject,
        abort: () => {
          const index = this.queuedLegRequests.indexOf(queued);
          if (index >= 0) this.queuedLegRequests.splice(index, 1);
          reject(new Error('Road route request was cancelled'));
        },
      };
      signal.addEventListener('abort', queued.abort, { once: true });
      this.queuedLegRequests.push(queued);
    });
  }

  private releaseLegRequest(): void {
    while (this.queuedLegRequests.length) {
      const next = this.queuedLegRequests.shift()!;
      next.signal.removeEventListener('abort', next.abort);
      if (next.signal.aborted) {
        next.reject(new Error('Road route request was cancelled'));
        continue;
      }
      next.resolve(() => this.releaseLegRequest());
      return;
    }
    this.activeLegRequests--;
  }

  /** Reuse directed road legs while the planner tests overlapping candidate circuits. */
  private async drivingLeg(start: GeoPoint, end: GeoPoint, signal: AbortSignal): Promise<DrivingRouteLeg> {
    if (signal.aborted) throw new Error('Road route request was cancelled');
    const key = `${start.latitude},${start.longitude};${end.latitude},${end.longitude}`;
    const cached = this.legs.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      this.legs.delete(key);
      this.legs.set(key, cached);
      return this.copyLeg(cached.value);
    }
    this.legs.delete(key);
    let entry = this.inFlight.get(key);
    if (!entry) {
      if (!this.gateway) throw new Error('OneMap driving routes are unavailable');
      const controller = new AbortController();
      entry = { promise: null as unknown as Promise<DrivingRouteLeg>, controller, waiters: new Set() };
      const current = entry;
      entry.promise = this.acquireLegRequest(controller.signal).then(async (release) => {
        try {
          if (controller.signal.aborted) throw new Error('Road route request was cancelled');
          return await this.gateway!.drivingRoute(start, end);
        }
        finally { release(); }
      }).then((value) => {
        if (!isUsableDrivingRoute(value, [start, end])) throw new Error('OneMap driving leg did not verify road access');
        const copy = this.copyLeg(value);
        this.legs.set(key, { value: copy, expiresAt: Date.now() + 5 * 60_000 });
        while (this.legs.size > 512) this.legs.delete(this.legs.keys().next().value!);
        return copy;
      }).finally(() => {
        if (this.inFlight.get(key) === current) this.inFlight.delete(key);
      });
      this.inFlight.set(key, entry);
    }
    const waiter = Symbol(key);
    entry.waiters.add(waiter);
    const detach = (): void => {
      entry!.waiters.delete(waiter);
      if (entry!.waiters.size === 0) entry!.controller.abort();
    };
    try {
      if (signal.aborted) throw new Error('Road route request was cancelled');
      return this.copyLeg(await new Promise<DrivingRouteLeg>((resolve, reject) => {
        const abort = (): void => reject(new Error('Road route request was cancelled'));
        signal.addEventListener('abort', abort, { once: true });
        entry!.promise.then((value) => {
          signal.removeEventListener('abort', abort);
          resolve(value);
        }, (error: unknown) => {
          signal.removeEventListener('abort', abort);
          reject(error);
        });
      }));
    } finally {
      detach();
    }
  }

  private copyLeg(leg: DrivingRouteLeg): DrivingRouteLeg {
    return { ...leg, coordinates: leg.coordinates.map((point) => new GeoPoint(point.latitude, point.longitude)) };
  }

  async calculateRoute(stops: GeoPoint[], signal?: AbortSignal): Promise<RoutePlan> {
    if (stops.length < 2) throw new Error('A driving route needs at least two stops');
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abort, { once: true });
    let legs: DrivingRouteLeg[];
    try {
      legs = await Promise.all(stops.slice(1).map((end, index) => this.drivingLeg(stops[index]!, end, controller.signal)));
    } catch (error) {
      controller.abort();
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
    }
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
      legs: legs.map(({ durationSeconds, distanceMetres }) => ({ durationSeconds, distanceMetres })),
    };
    if (!Number.isFinite(route.distanceMetres) || route.distanceMetres < 0 ||
        !Number.isFinite(route.durationSeconds) || route.durationSeconds < 0) {
      throw new Error('OneMap driving route returned invalid metric totals');
    }
    if (!isUsableDrivingRoute(route, stops)) throw new Error('OneMap returned an unusable driving circuit');
    return route;
  }
}
