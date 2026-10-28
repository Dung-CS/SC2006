import { afterEach, describe, expect, it, vi } from 'vitest';
import { OneMapGateway, DrivingRouteLeg } from '../src/boundary/gateways/OneMapGateway';
import { GeoPoint } from '../src/entity/valueTypes';
import { OneMapRoadRoutingStrategy } from '../src/control/routing/OneMapRoadRoutingStrategy';

const a = new GeoPoint(1.3, 103.8);
const b = new GeoPoint(1.4, 103.9);
const leg = (start: GeoPoint, end: GeoPoint): DrivingRouteLeg => ({ coordinates: [start, end], distanceMetres: 100, durationSeconds: 20 });
const strategy = (drivingRoute: ReturnType<typeof vi.fn>) => new OneMapRoadRoutingStrategy({ drivingRoute } as unknown as OneMapGateway);
afterEach(() => vi.restoreAllMocks());

describe('Road routing directed-leg reuse', () => {
  it('reuses overlapping circuits, keeps directions separate and does not expose cached points', async () => {
    const drivingRoute = vi.fn(async (start, end) => leg(start, end));
    const routes = strategy(drivingRoute);
    const first = await routes.calculateRoute([a, b, a]);
    expect(drivingRoute).toHaveBeenCalledTimes(2);
    expect(first.durationSeconds).toBe(40);
    (first.coordinates[0] as unknown as { latitude: number }).latitude = 8;
    const repeated = await routes.calculateRoute([a, b, a]);
    expect(drivingRoute).toHaveBeenCalledTimes(2);
    expect(repeated.coordinates[0]?.latitude).toBe(1.3);
    expect(repeated.source).toBe('onemap');
    expect(repeated.durationSeconds).toBe(40);
  });

  it('coalesces concurrent identical legs and retries failed legs without caching fallback', async () => {
    let finish!: (value: DrivingRouteLeg) => void;
    const drivingRoute = vi.fn(() => new Promise<DrivingRouteLeg>((done) => { finish = done; }));
    const routes = strategy(drivingRoute);
    const first = routes.calculateRoute([a, b]);
    const second = routes.calculateRoute([a, b]);
    await Promise.resolve();
    expect(drivingRoute).toHaveBeenCalledTimes(1);
    finish(leg(a, b));
    expect((await first).durationSeconds).toBe(20);
    expect((await second).durationSeconds).toBe(20);
    const failing = vi.fn().mockRejectedValueOnce(new Error('unavailable')).mockResolvedValue(leg(a, b));
    const retry = strategy(failing);
    await expect(retry.calculateRoute([a, b])).rejects.toThrow('unavailable');
    expect((await retry.calculateRoute([a, b])).source).toBe('onemap');
    expect(failing).toHaveBeenCalledTimes(2);
  });

  it('refreshes road time at the five-minute expiry', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0);
    const drivingRoute = vi.fn(async (start, end) => leg(start, end));
    const routes = strategy(drivingRoute);
    await routes.calculateRoute([a, b]);
    now.mockReturnValue(299_999);
    await routes.calculateRoute([a, b]);
    expect(drivingRoute).toHaveBeenCalledTimes(1);
    now.mockReturnValue(300_000);
    await routes.calculateRoute([a, b]);
    expect(drivingRoute).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used leg after 512 successful directed legs', async () => {
    const drivingRoute = vi.fn(async (start, end) => leg(start, end));
    const routes = strategy(drivingRoute);
    for (let i = 0; i < 513; i++) await routes.calculateRoute([a, new GeoPoint(1.4, 103 + i / 10000)]);
    expect(drivingRoute).toHaveBeenCalledTimes(513);
    await routes.calculateRoute([a, new GeoPoint(1.4, 103)]);
    expect(drivingRoute).toHaveBeenCalledTimes(514);
  });
});
