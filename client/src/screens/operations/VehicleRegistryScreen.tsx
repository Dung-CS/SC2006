import { useState } from 'react';
import { Vehicle } from '../../../../src/entity/Vehicle';
import { HqLocation } from '../../../../src/entity/enums';
import { ApiError } from '../../lib/ApiClient';
import { useLoad } from '../../lib/useLoad';
import { StateView } from '../../components/States';
import { Pill } from '../../components/Presentation';
import { ScreenProps } from '../ScreenProps';
import { cleanTitle } from '../../../../src/presentation/DisplayNames';

const NUMBER_FIELDS = [
  ['maxPayloadKg', 'Maximum payload (kg)'],
  ['maxCargoVolumeM3', 'Usable cargo volume (m³)'],
  ['cargoLengthCm', 'Cargo bay length (cm)'],
  ['cargoWidthCm', 'Cargo bay width (cm)'],
  ['cargoHeightCm', 'Cargo bay height (cm)'],
  ['seatCapacity', 'Seats including driver'],
] as const;
type NumberKey = typeof NUMBER_FIELDS[number][0];
type FormValues = Record<NumberKey, string> & {
  registration: string; name: string; hqLocation: HqLocation; isAvailable: boolean; isDemo: boolean;
};
const blank = (): FormValues => ({ registration: '', name: '', hqLocation: HqLocation.Central,
  maxPayloadKg: '', maxCargoVolumeM3: '', cargoLengthCm: '', cargoWidthCm: '', cargoHeightCm: '',
  seatCapacity: '', isAvailable: true, isDemo: false });

export function VehicleRegistryScreen(props: ScreenProps): JSX.Element {
  const loaded = useLoad<{ vehicles: Vehicle[] }>(props.api, '/api/ops/vehicles', {
    isEmpty: (value) => value.vehicles.length === 0, emptyMessage: 'No vehicles are recorded. Add a vehicle below.',
  });
  const [form, setForm] = useState<FormValues>(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<HqLocation | 'All'>('All');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const vehicles = (loaded.value?.vehicles ?? []).filter((vehicle) => filter === 'All' || vehicle.hqLocation === filter);
  const change = <K extends keyof FormValues>(key: K, value: FormValues[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));

  function edit(vehicle: Vehicle): void {
    setEditingId(vehicle.id);
    setForm({ ...vehicle, maxPayloadKg: String(vehicle.maxPayloadKg), maxCargoVolumeM3: String(vehicle.maxCargoVolumeM3),
      cargoLengthCm: String(vehicle.cargoLengthCm), cargoWidthCm: String(vehicle.cargoWidthCm),
      cargoHeightCm: String(vehicle.cargoHeightCm), seatCapacity: String(vehicle.seatCapacity) });
    setFailure(null); setMessage(null);
  }

  async function submit(event: { preventDefault(): void }): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setFailure(null); setMessage(null);
    try {
      const payload = { ...form, ...Object.fromEntries(NUMBER_FIELDS.map(([key]) => [key, Number(form[key])])) };
      await props.api.post(editingId ? `/api/ops/vehicles/${encodeURIComponent(editingId)}` : '/api/ops/vehicles', payload);
      setMessage(editingId ? 'Vehicle updated. Dispatch planning will refresh.' : 'Vehicle added. Dispatch planning will refresh.');
      setEditingId(null); setForm(blank()); loaded.retry();
    } catch (error) {
      setFailure(error instanceof ApiError ? error.failure.error : 'The vehicle could not be saved. Try again.');
    } finally { setBusy(false); }
  }

  return <section data-screen="VehicleRegistry" data-requirement="11.2.29">
    <h1>Vehicle registry</h1>
    <p>Fleet capacity and availability</p>
    {message ? <p role="status">{message}</p> : null}
    <label htmlFor="vehicle-hq-filter">Filter by HQ</label>{' '}
    <select id="vehicle-hq-filter" value={filter} onChange={(event) => setFilter(event.target.value as HqLocation | 'All')}>
      <option value="All">All HQs</option>
      {Object.values(HqLocation).map((hq) => <option key={hq} value={hq}>{hq}</option>)}
    </select>
    <StateView state={loaded.state} onRetry={loaded.retry}>
      <div data-part="vehicle-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {vehicles.map((vehicle) => <article key={vehicle.id} data-entity-id={vehicle.id} data-hq={vehicle.hqLocation} data-registration={vehicle.registration}
          style={{ overflow: 'hidden', border: '1px solid #dbe3ea', borderRadius: 12, background: '#fff' }}>
          <img src="/visuals/vehicle-van.svg" alt="Illustrative service van" style={{ display: 'block', width: '100%', height: 112, objectFit: 'cover' }} />
          <div style={{ padding: 14, display: 'grid', gap: 10 }}>
            <div><strong data-part="entity-title">{cleanTitle(vehicle.name, 'Vehicle')}</strong><div data-part="hq">{vehicle.hqLocation}</div>
              <small>{cleanTitle(vehicle.registration, 'Registration unrecorded')}</small>{' '}{vehicle.isDemo ? <Pill tone="warn" title="Illustrative capacities; confirm before operational use">Demo vehicle</Pill> : null}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.9rem' }}>
              <span>Payload <strong>{vehicle.maxPayloadKg} kg</strong></span><span>Cargo <strong>{vehicle.maxCargoVolumeM3} m³</strong></span>
              <span>Bay <strong>{vehicle.cargoLengthCm} × {vehicle.cargoWidthCm} × {vehicle.cargoHeightCm} cm</strong></span>
              <span>Seats <strong>{vehicle.seatCapacity}</strong></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Pill tone={vehicle.isAvailable ? 'good' : 'neutral'}>{vehicle.isAvailable ? 'Available' : 'Unavailable'}</Pill>
              <button type="button" aria-label={`Edit ${vehicle.registration}`} onClick={() => edit(vehicle)}>Edit vehicle</button>
            </div>
          </div>
        </article>)}
        {vehicles.length === 0 && (loaded.value?.vehicles.length ?? 0) > 0 ? <p>No vehicles are recorded at this HQ.</p> : null}
      </div>
    </StateView>
    <h2>{editingId ? 'Edit vehicle' : 'Add vehicle'}</h2>
    <form onSubmit={submit}>
      {failure ? <p role="alert">{failure}</p> : null}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        <label>Registration<input required maxLength={60} value={form.registration} onChange={(event) => change('registration', event.target.value)} /></label>
        <label>Vehicle name<input required maxLength={120} value={form.name} onChange={(event) => change('name', event.target.value)} /></label>
        <label>Vehicle HQ<select value={form.hqLocation} onChange={(event) => change('hqLocation', event.target.value as HqLocation)}>
          {Object.values(HqLocation).map((hq) => <option key={hq} value={hq}>{hq}</option>)}
        </select></label>
        {NUMBER_FIELDS.map(([key, label]) => <label key={key}>{label}<input required type="number" min={key === 'seatCapacity' ? 1 : 0.001}
          step={key === 'seatCapacity' ? 1 : 'any'} value={form[key]} onChange={(event) => change(key, event.target.value)} /></label>)}
      </div>
      <small>Enter usable capacity after fixed fittings; volume must fit inside the cargo bay.</small>
      <label><input type="checkbox" checked={form.isAvailable} onChange={(event) => change('isAvailable', event.target.checked)} /> Available for dispatch</label>{' '}
      <label><input type="checkbox" checked={form.isDemo} onChange={(event) => change('isDemo', event.target.checked)} /> Demo data (illustrative vehicle)</label>
      <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
        <button type="submit" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save vehicle' : 'Add vehicle'}</button>
        {editingId ? <button type="button" disabled={busy} onClick={() => { setEditingId(null); setForm(blank()); setFailure(null); }}>Cancel edit</button> : null}
      </div>
    </form>
  </section>;
}
