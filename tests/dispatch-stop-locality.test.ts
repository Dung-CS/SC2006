import { describe, expect, it } from 'vitest';
import { withLocalities } from '../src/control/DispatchPlanService';

describe('proposal stop names', () => {
  it('puts the locality name on each task stop, not only coordinates', () => {
    const routes = [{ waypointOrder: [{ isHq: true, label: 'HQ' }, { workOrderId: 'w1', label: 'Stop 1', lat: 1.3, lng: 103.8 }] }];
    const [route] = withLocalities(routes as never[], [{ workOrderId: 'w1', locality: 'Bukit Batok' }] as never[]) as typeof routes;
    expect(route!.waypointOrder[1]).toMatchObject({ locality: 'Bukit Batok' });
    expect(route!.waypointOrder[0]).not.toHaveProperty('locality');
  });
});
