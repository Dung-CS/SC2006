import { DrivingRouteLeg, isUsableDrivingRoute, MAX_ROAD_SNAP_METRES, OneMapGateway, WalkingRouteLeg } from '../../boundary/gateways/OneMapGateway';
import { GeoPoint } from '../../entity/valueTypes';
import { IRouteStrategy, RoutePlan, WalkingVisit, isVerifiedAccessRoute, isInsideServiceArea, ServiceArea, AreaVisit } from './IRouteStrategy';

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
  private async drivingLeg(start: GeoPoint, end: GeoPoint, signal: AbortSignal, profile: 'drive' | 'walk' = 'drive'): Promise<DrivingRouteLeg> {
    if (signal.aborted) throw new Error('Road route request was cancelled');
    const key = `${profile}:${start.latitude},${start.longitude};${end.latitude},${end.longitude}`;
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
          return profile === 'walk' ? await this.gateway!.walkingRoute(start, end) :
            await (this.gateway!.rawDrivingRoute?.(start, end) ?? this.gateway!.drivingRoute(start, end));
        }
        finally { release(); }
      }).then((value) => {
        if (!isUsableDrivingRoute(value, [value.coordinates?.[0]!, value.coordinates?.at(-1)!])) throw new Error('OneMap leg did not verify route geometry');
        if (profile === 'walk' && ((value as WalkingRouteLeg).source !== 'onemap' || (value as WalkingRouteLeg).mode !== 'walk' ||
            value.durationSeconds > 600 || start.distanceTo(value.coordinates[0]!) > 25 || end.distanceTo(value.coordinates.at(-1)!) > 25)) {
          throw new Error('OneMap walking leg did not verify ten-minute access');
        }
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

  async calculateRoute(stops: GeoPoint[], signal?: AbortSignal, serviceAreas?: readonly (ServiceArea | undefined)[], depotStopIndices?: readonly number[]): Promise<RoutePlan> {
    if (stops.length < 2) throw new Error('A driving route needs at least two stops');
    const controller = new AbortController();
    const abort = (): void => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', abort, { once: true });
    try {
      const initial = await Promise.all(stops.slice(1).map((end, index) => this.drivingLeg(stops[index]!, end, controller.signal)));
      const drivingStops = [initial[0]!.coordinates[0]!, ...initial.map((leg) => leg.coordinates.at(-1)!)];
      // Depot coordinates represent a compound centre; retain its existing road-gate tolerance.
      // This never supplies task access proof: non-depot sites still need direct coverage or walks.
      const depots = new Set([0, ...(stops.at(-1)!.distanceTo(stops[0]!) <= 1 ? [stops.length - 1] : []), ...(depotStopIndices ?? [])]);
      if (stops[0]!.distanceTo(drivingStops[0]!) > MAX_ROAD_SNAP_METRES ||
          stops.at(-1)!.distanceTo(drivingStops.at(-1)!) > (depots.has(stops.length - 1) ? MAX_ROAD_SNAP_METRES : 25)) {
        throw new Error('OneMap did not verify depot road access');
      }
      const areaVisits: AreaVisit[] = stops.slice(1, -1).flatMap((targetPoint, index) => {
        const stopIndex = index + 1, accessPoint = drivingStops[stopIndex]!;
        return isInsideServiceArea(accessPoint, serviceAreas?.[stopIndex]) ? [{ stopIndex, targetPoint, accessPoint }] : [];
      });
      const walkingVisits: WalkingVisit[] = await Promise.all(stops.slice(1, -1).map(async (targetPoint, index) => {
        const stopIndex = index + 1;
        const accessPoint = drivingStops[stopIndex]!;
        if (areaVisits.some((visit) => visit.stopIndex === stopIndex) ||
            targetPoint.distanceTo(accessPoint) <= (depots.has(stopIndex) ? MAX_ROAD_SNAP_METRES : 25)) return null;
        const [outbound, returning] = await Promise.all([
          this.drivingLeg(accessPoint, targetPoint, controller.signal, 'walk'),
          this.drivingLeg(targetPoint, accessPoint, controller.signal, 'walk'),
        ]);
        return { stopIndex, targetPoint, accessPoint, outbound: outbound as WalkingRouteLeg, return: returning as WalkingRouteLeg };
      })).then((visits) => visits.filter((visit): visit is WalkingVisit => visit !== null));
      const legs = await Promise.all(initial.map(async (leg, index) => {
        const start = drivingStops[index]!, end = drivingStops[index + 1]!;
        // Reuse the raw leg only if it actually joins the chosen vehicle access points.
        const result = leg.coordinates[0]!.distanceTo(start) <= 25 && leg.coordinates.at(-1)!.distanceTo(end) <= 25
          ? leg : await this.drivingLeg(start, end, controller.signal);
        if (result.coordinates[0]!.distanceTo(start) > 25 || result.coordinates.at(-1)!.distanceTo(end) > 25) {
          throw new Error('OneMap driving legs do not join verified access points');
        }
        return result;
      }));
      const coordinates: GeoPoint[] = [];
      for (const leg of legs) {
        if (coordinates.length && coordinates.at(-1)!.distanceTo(leg.coordinates[0]!) > 50) {
          throw new Error('OneMap driving legs do not form a continuous circuit');
        }
        for (const point of leg.coordinates) {
          if (coordinates.length === 0 || coordinates.at(-1)!.distanceTo(point) > 1) coordinates.push(point);
        }
      }
      const walkingDurationSeconds = walkingVisits.reduce((sum, visit) => sum + visit.outbound.durationSeconds + visit.return.durationSeconds, 0);
      // A stationary vehicle can still serve a task by walking from its road gate.
      // Preserve the provider's second endpoint when de-duplication leaves one point.
      if (coordinates.length === 1) coordinates.push(legs.at(-1)!.coordinates.at(-1)!);
      const drivingDurationSeconds = legs.reduce((sum, leg) => sum + leg.durationSeconds, 0);
      const route: RoutePlan = {
        coordinates, drivingStops, walkingVisits, areaVisits, drivingDurationSeconds, walkingDurationSeconds,
        distanceMetres: legs.reduce((sum, leg) => sum + leg.distanceMetres, 0) +
          walkingVisits.reduce((sum, visit) => sum + visit.outbound.distanceMetres + visit.return.distanceMetres, 0),
        durationSeconds: drivingDurationSeconds + walkingDurationSeconds,
        source: 'onemap',
        legs: legs.map((leg, index) => {
          const returning = walkingVisits.find((visit) => visit.stopIndex === index)?.return;
          const outbound = walkingVisits.find((visit) => visit.stopIndex === index + 1)?.outbound;
          return {
            durationSeconds: leg.durationSeconds + (returning?.durationSeconds ?? 0) + (outbound?.durationSeconds ?? 0),
            distanceMetres: leg.distanceMetres + (returning?.distanceMetres ?? 0) + (outbound?.distanceMetres ?? 0),
          };
        }),
      };
      if (controller.signal.aborted) throw new Error('Road route request was cancelled');
      if (!isVerifiedAccessRoute(route, stops, serviceAreas, depotStopIndices)) throw new Error('OneMap returned an unusable access circuit');
      return route;
    } catch (error) {
      controller.abort();
      throw error;
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }
}
