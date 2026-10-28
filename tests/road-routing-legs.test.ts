import { describe, expect, it, vi } from 'vitest';
import { DrivingRouteLeg, OneMapGateway } from '../src/boundary/gateways/OneMapGateway';
import { GeoPoint } from '../src/entity/valueTypes';
import { OneMapRoadRoutingStrategy } from '../src/control/routing/OneMapRoadRoutingStrategy';

const a = new GeoPoint(1.3, 103.8);
const b = new GeoPoint(1.4, 103.9);
const c = new GeoPoint(1.5, 104);
const routeLeg = (start: GeoPoint, end: GeoPoint, durationSeconds: number, distanceMetres: number): DrivingRouteLeg => ({
  coordinates: [start, end], durationSeconds, distanceMetres,
});

describe('verified road leg metadata', () => {
  it('returns asymmetric leg metrics in stop order and isolates caller mutations', async () => {
    const strategy = new OneMapRoadRoutingStrategy({
      drivingRoute: vi.fn(async (start: GeoPoint, end: GeoPoint) => end === b
        ? routeLeg(start, end, 12, 130)
        : routeLeg(start, end, 47, 890)),
    } as unknown as OneMapGateway);

    const first = await strategy.calculateRoute([a, b, c]);
    expect(first.legs).toEqual([
      { durationSeconds: 12, distanceMetres: 130 },
      { durationSeconds: 47, distanceMetres: 890 },
    ]);
    expect(first.durationSeconds).toBe(59);
    expect(first.distanceMetres).toBe(1020);
    first.legs![0]!.durationSeconds = 999;
    first.legs!.pop();

    const cached = await strategy.calculateRoute([a, b, c]);
    expect(cached.legs).toEqual([
      { durationSeconds: 12, distanceMetres: 130 },
      { durationSeconds: 47, distanceMetres: 890 },
    ]);
  });

  it('supports repeated stops and returns no executable route when a provider leg fails', async () => {
    let fail = true;
    const drivingRoute = vi.fn(async (start: GeoPoint, end: GeoPoint) => {
      if (end === c && fail) throw new Error('provider unavailable');
      return routeLeg(start, end, end === b ? 5 : 0, end === b ? 50 : 0);
    });
    const strategy = new OneMapRoadRoutingStrategy({ drivingRoute } as unknown as OneMapGateway);

    await expect(strategy.calculateRoute([a, b, c])).rejects.toThrow('provider unavailable');
    fail = false;
    const route = await strategy.calculateRoute([a, b, c, c]);
    expect(route.legs).toEqual([
      { durationSeconds: 5, distanceMetres: 50 },
      { durationSeconds: 0, distanceMetres: 0 },
      { durationSeconds: 0, distanceMetres: 0 },
    ]);
    expect(route.durationSeconds).toBe(5);
    expect(route.distanceMetres).toBe(50);
  });

  it('limits concurrent provider legs across circuits to four', async () => {
    let active = 0;
    let maximum = 0;
    const pending: Array<() => void> = [];
    const strategy = new OneMapRoadRoutingStrategy({
      drivingRoute: vi.fn((start: GeoPoint, end: GeoPoint) => {
        active++;
        maximum = Math.max(maximum, active);
        return new Promise<DrivingRouteLeg>((resolve) => pending.push(() => {
          active--;
          resolve(routeLeg(start, end, 1, 1));
        }));
      }),
    } as unknown as OneMapGateway);
    const destinations = Array.from({ length: 6 }, (_, index) => new GeoPoint(1.4 + index / 100, 103.9));
    const routes = destinations.map((destination) => strategy.calculateRoute([a, destination]));

    for (let attempt = 0; attempt < 20 && pending.length < destinations.length; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      pending.splice(0).forEach((finish) => finish());
    }
    await Promise.all(routes);
    expect(maximum).toBe(4);
  });

  it('cancels queued legs on timeout while keeping a coalesced caller alive', async () => {
    let active = 0;
    let starts = 0;
    const pending: Array<() => void> = [];
    const strategy = new OneMapRoadRoutingStrategy({
      drivingRoute: vi.fn((start: GeoPoint, end: GeoPoint) => {
        active++;
        starts++;
        return new Promise<DrivingRouteLeg>((resolve) => pending.push(() => {
          active--;
          resolve(routeLeg(start, end, 1, 1));
        }));
      }),
    } as unknown as OneMapGateway);
    const blockers = strategy.calculateRoute([a, b, c, new GeoPoint(1.6, 104), new GeoPoint(1.7, 104)]);
    const controller = new AbortController();
    const timedOut = strategy.calculateRoute([new GeoPoint(1.8, 104), new GeoPoint(1.9, 104)], controller.signal);
    const shared = strategy.calculateRoute([new GeoPoint(1.8, 104), new GeoPoint(1.9, 104)]);
    const onlyController = new AbortController();
    const onlyTimedOut = strategy.calculateRoute([new GeoPoint(2, 104), new GeoPoint(2.1, 104)], onlyController.signal);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(starts).toBe(4);
    controller.abort();
    onlyController.abort();
    await expect(timedOut).rejects.toThrow('cancelled');
    await expect(onlyTimedOut).rejects.toThrow('cancelled');
    expect(starts).toBe(4);

    for (let attempt = 0; attempt < 10 && starts < 5; attempt++) {
      pending.splice(0).forEach((finish) => finish());
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(starts).toBe(5);
    pending.splice(0).forEach((finish) => finish());
    await Promise.all([blockers, shared]);
    expect(active).toBe(0);
  });

  it('does not start a provider request for a pre-aborted route', async () => {
    const drivingRoute = vi.fn(async (start: GeoPoint, end: GeoPoint) => routeLeg(start, end, 1, 1));
    const strategy = new OneMapRoadRoutingStrategy({ drivingRoute } as unknown as OneMapGateway);
    const controller = new AbortController();
    controller.abort();
    await expect(strategy.calculateRoute([a, b], controller.signal)).rejects.toThrow('cancelled');
    expect(drivingRoute).not.toHaveBeenCalled();
  });
});
