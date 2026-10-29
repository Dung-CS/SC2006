import { describe, expect, it } from 'vitest';
import { cleanTitle, displayTaskName } from '../src/presentation/DisplayNames';
import { staffDisplayName, staffRoleLocationLabel } from '../client/src/lib/staffVisuals';

describe('presentation names', () => {
  it('removes demo markers and opaque identifiers while retaining readable text', () => {
    expect(cleanTitle('DEMO: Rat inspection 56cbbfcb-1c77-4224-aadd-001122334455', 'Work')).toBe('Rat inspection');
    expect(cleanTitle('[DEMO 20261029 SW-INSPECT] Mosquito Inspection', 'Work')).toBe('Mosquito Inspection');
    expect(cleanTitle('[DEMO 20261029 SW-INSPECT]', 'Work')).toBe('Work');
    expect(cleanTitle('DEMO 20261029 DEMO-VAN-01', 'Vehicle')).toBe('Vehicle');
    expect(cleanTitle('Alexandra Canal Community Garden North', 'Site')).toBe('Alexandra Canal Community Garden North');
    expect(cleanTitle('b47a6ab1-b890-4e31-98d2-0d2179b4f920', 'Reported location')).toBe('Reported location');
    expect(cleanTitle('report-b47a6ab1-b890-4e31-98d2-0d2179b4f920', 'Reported location')).toBe('Reported location');
    expect(cleanTitle('prop-b47a6ab1-b890-4e31-98d2-0d2179b4f920', 'Task stop')).toBe('Task stop');
    expect(cleanTitle('Unassigned', 'Reported location')).toBe('Reported location');
    expect(cleanTitle('---', 'Work')).toBe('Work');
  });

  it('builds concise task names and honest staff role labels', () => {
    expect(displayTaskName('VectorControl', 'Mosquito', 'Tampines')).toBe('Vector Control · Mosquito · Tampines');
    expect(staffDisplayName('demo.20261029.sw-inspect@example.test')).toBe('Field crew');
    expect(staffRoleLocationLabel('CleaningCrew', 'NorthEast')).toBe('Field crew · North East');
  });
});
