/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { VehicleRegistryScreen } from '../client/src/screens/operations/VehicleRegistryScreen';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { ScreenProps } from '../client/src/screens/ScreenProps';
import { Role } from '../src/entity/enums';

afterEach(cleanup);
const demo = { id: 'demo-vehicle-Central-van', registration: 'DEMO-CENTRAL-VAN', name: 'Demo cargo van', hqLocation: 'Central',
  maxPayloadKg: 750, maxCargoVolumeM3: 6, cargoLengthCm: 300, cargoWidthCm: 160, cargoHeightCm: 140,
  seatCapacity: 3, isAvailable: true, isDemo: true };
function props(fetcher: Fetcher): ScreenProps {
  return { api: new ApiClient('', fetcher), params: {}, principal: { accountId: 'manager', role: Role.OperationsManager },
    onNavigate: vi.fn(), onPrincipalChange: vi.fn() };
}

describe('Vehicle registry manager screen', () => {
  it('shows demo status, capacity, dimensions and an HQ filter', async () => {
    const fetcher: Fetcher = async () => ({ ok: true, status: 200, json: async () => ({ vehicles: [demo] }) }) as Response;
    render(<VehicleRegistryScreen {...props(fetcher)} />);
    expect(await screen.findByText('DEMO-CENTRAL-VAN')).toBeTruthy();
    expect(screen.getByText('Demo vehicle')).toBeTruthy();
    expect(screen.getByText('750 kg')).toBeTruthy();
    expect(screen.getByText('6 m³')).toBeTruthy();
    expect(screen.getByText('300 × 160 × 140 cm')).toBeTruthy();
    expect(screen.getByText(/illustrative capacities/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter by HQ'), { target: { value: 'SouthWest' } });
    expect(screen.getByText('No vehicles are recorded at this HQ.')).toBeTruthy();
  });

  it('edits capacity and availability while retaining the explicit demo flag', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher: Fetcher = async (url, init) => {
      if (init?.method === 'POST') {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return { ok: true, status: 200, json: async () => ({ vehicle: { ...demo, ...calls[0]?.body } }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ vehicles: [demo] }) } as Response;
    };
    render(<VehicleRegistryScreen {...props(fetcher)} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit DEMO-CENTRAL-VAN' }));
    fireEvent.change(screen.getByLabelText('Maximum payload (kg)'), { target: { value: '600' } });
    fireEvent.click(screen.getByLabelText('Available for dispatch'));
    fireEvent.click(screen.getByRole('button', { name: 'Save vehicle' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ url: '/api/ops/vehicles/demo-vehicle-Central-van',
      body: { maxPayloadKg: 600, maxCargoVolumeM3: 6, isAvailable: false, isDemo: true } });
    expect(await screen.findByRole('status')).toBeTruthy();
  });
});
