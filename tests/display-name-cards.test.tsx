/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ApiClient, Fetcher } from '../client/src/lib/ApiClient';
import { StaffAccountsScreen } from '../client/src/screens/operations/StaffAccountsScreen';
import { VehicleRegistryScreen } from '../client/src/screens/operations/VehicleRegistryScreen';
import { ScreenProps } from '../client/src/screens/ScreenProps';
import { Role } from '../src/entity/enums';

afterEach(cleanup);

const demoStaff = { id: 'a-staff-opaque-id', email: 'demo.20261029.sw-inspect@example.test', role: 'CleaningCrew', isActive: true,
  specialisation: 'VectorControl', hqLocation: 'SouthWest', staffStatus: 'Available' };
const demoVehicle = { id: 'a-vehicle-opaque-id', registration: 'DEMO-CENTRAL-VAN', name: 'Demo cargo van', hqLocation: 'Central',
  maxPayloadKg: 750, maxCargoVolumeM3: 6, cargoLengthCm: 300, cargoWidthCm: 160, cargoHeightCm: 140,
  seatCapacity: 3, isAvailable: true, isDemo: true };

function props(fetcher: Fetcher): ScreenProps {
  return { api: new ApiClient('', fetcher), params: {}, principal: { accountId: 'manager', role: Role.OperationsManager },
    onNavigate: () => undefined, onPrincipalChange: () => undefined };
}

describe('staff and fleet display cards', () => {
  it('shows clean staff titles and a real portrait while retaining identity metadata', async () => {
    const fetcher: Fetcher = async (url) => ({ ok: true, status: 200, json: async () => url.endsWith('/crew-workload')
      ? { crew: [] } : { staff: [demoStaff] } }) as Response;
    render(<StaffAccountsScreen {...props(fetcher)} />);
    const title = await screen.findByText('Field crew', { selector: '[data-part="entity-title"]' });
    const card = title.closest('article');
    expect(card).toBeTruthy();
    expect(card?.getAttribute('data-entity-id')).toBe(demoStaff.id);
    expect(card?.getAttribute('data-email')).toBe(demoStaff.email);
    expect(within(card as HTMLElement).getByText('Field crew · South West')).toBeTruthy();
    const image = card?.querySelector('img');
    expect(image?.getAttribute('src')).toMatch(/^\/visuals\/staff\/crew-.*\.jpg$/);
    expect(title.textContent).not.toMatch(/DEMO|20261029|opaque-id/i);
  });

  it('shows the illustrative fleet image and a clean vehicle title while preserving the registration', async () => {
    const fetcher: Fetcher = async () => ({ ok: true, status: 200, json: async () => ({ vehicles: [demoVehicle] }) }) as Response;
    render(<VehicleRegistryScreen {...props(fetcher)} />);
    const title = await screen.findByText('Cargo van', { selector: '[data-part="entity-title"]' });
    const card = title.closest('article');
    expect(card).toBeTruthy();
    expect(card?.getAttribute('data-entity-id')).toBe(demoVehicle.id);
    expect(card?.getAttribute('data-registration')).toBe(demoVehicle.registration);
    expect(within(card as HTMLElement).getByRole('img', { name: 'Illustrative service van' }).getAttribute('src')).toBe('/visuals/vehicle-van.svg');
    expect(title.textContent).not.toMatch(/DEMO|opaque-id/i);
  });
});
