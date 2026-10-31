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
  it('uses the recorded model title and photo, with an honest fallback if the photo fails', async () => {
    const vehicle = { ...demo, model: 'Toyota Hiace', photoUrl: '/visuals/vehicles/toyota-hiace.jpg' };
    const fetcher: Fetcher = async () => ({ ok: true, status: 200, json: async () => ({ vehicles: [vehicle] }) }) as Response;
    render(<VehicleRegistryScreen {...props(fetcher)} />);
    expect(await screen.findByText('Toyota Hiace')).toBeTruthy();
    const photo = screen.getByRole('img', { name: 'Toyota Hiace reference photograph' });
    expect(photo.getAttribute('src')).toBe(vehicle.photoUrl);
    expect(screen.getByText('Model reference photo')).toBeTruthy();
    fireEvent.error(photo);
    expect(screen.getByText('Vehicle photo unavailable')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Edit DEMO-CENTRAL-VAN/i })).toBeNull();
  });
  it('shows demo status, capacity, dimensions and an HQ filter', async () => {
    const fetcher: Fetcher = async () => ({ ok: true, status: 200, json: async () => ({ vehicles: [demo] }) }) as Response;
    render(<VehicleRegistryScreen {...props(fetcher)} />);
    expect(await screen.findByText('Cargo van')).toBeTruthy();
    expect(screen.getByText('CENTRAL VAN')).toBeTruthy();
    expect(screen.getByText('Demo vehicle')).toBeTruthy();
    expect(screen.getByText('750 kg')).toBeTruthy();
    expect(screen.getByText('6 m³')).toBeTruthy();
    expect(screen.getByText('300 × 160 × 140 cm')).toBeTruthy();
    expect(screen.getByText('Fleet capacity and availability')).toBeTruthy();
    expect(screen.getByText(/capacity after fixed fittings/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Filter by HQ'), { target: { value: 'SouthWest' } });
    expect(screen.getByText('No vehicles are recorded at this HQ.')).toBeTruthy();
  });

  it('adds a vehicle with capacity and availability while retaining the explicit demo flag', async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetcher: Fetcher = async (url, init) => {
      if (init?.method === 'POST') {
        calls.push({ url, body: JSON.parse(String(init.body)) });
        return { ok: true, status: 200, json: async () => ({ vehicle: { ...demo, ...calls[0]?.body } }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ vehicles: [demo] }) } as Response;
    };
    render(<VehicleRegistryScreen {...props(fetcher)} />);
    await screen.findByText('Cargo van');
    fireEvent.change(screen.getByLabelText('Registration'), { target: { value: 'GBD 1234 K' } });
    fireEvent.change(screen.getByLabelText('Vehicle name'), { target: { value: 'New Van' } });
    fireEvent.change(screen.getByLabelText('Make and model'), { target: { value: 'Toyota Hiace' } });
    fireEvent.change(screen.getByLabelText('Maximum payload (kg)'), { target: { value: '600' } });
    fireEvent.change(screen.getByLabelText('Usable cargo volume (m³)'), { target: { value: '6' } });
    fireEvent.change(screen.getByLabelText('Cargo bay length (cm)'), { target: { value: '300' } });
    fireEvent.change(screen.getByLabelText('Cargo bay width (cm)'), { target: { value: '160' } });
    fireEvent.change(screen.getByLabelText('Cargo bay height (cm)'), { target: { value: '140' } });
    fireEvent.change(screen.getByLabelText('Seats including driver'), { target: { value: '3' } });
    fireEvent.click(screen.getByLabelText('Available for dispatch'));
    fireEvent.click(screen.getByLabelText('Demo data (illustrative vehicle)'));
    fireEvent.click(screen.getByRole('button', { name: 'Add vehicle' }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toMatchObject({ url: '/api/ops/vehicles',
      body: { registration: 'GBD 1234 K', name: 'New Van', model: 'Toyota Hiace', maxPayloadKg: 600, isAvailable: false, isDemo: true } });
    expect(await screen.findByRole('status')).toBeTruthy();
  });
});
