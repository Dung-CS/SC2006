/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReportSiteScreen } from '../client/src/screens/resident/ReportSiteScreen';
import { ApiClient } from '../client/src/lib/ApiClient';
import { Role, PestType } from '../src/entity/enums';
import { analyzePestPhoto, preparePestPhoto } from '../client/src/lib/pestRecognition';
import { uploadPhoto } from '../client/src/lib/PhotoUpload';
import type { PestRecognitionOutcome } from '../src/control/PestRecognitionService';
vi.mock('../client/src/lib/pestRecognition', async (original) => {
  const actual = await original<typeof import('../client/src/lib/pestRecognition')>();
  return { ...actual, analyzePestPhoto: vi.fn(), preparePestPhoto: vi.fn(actual.preparePestPhoto) };
});
vi.mock('../client/src/lib/PhotoUpload', () => ({ uploadPhoto: vi.fn(async (_api, _purpose, file) => ({ ok: true, photo: { key: file.name } })) }));
const detected: PestRecognitionOutcome = { status: 'detected', pestType: PestType.Rat, estimatedCount: 2, boundingBoxes: [{ label: 'Rat #1', confidence: 0.8, box: [0.1, 0.1, 0.2, 0.2] }, { label: 'Rat #2', confidence: 0.8, box: [0.5, 0.5, 0.2, 0.2] }] };
function show() {
  const api = new ApiClient('', async () => ({ ok: true, status: 200, json: async () => ({ pests: [] }) }) as Response);
  render(<ReportSiteScreen api={api} params={{}} principal={{ accountId: 'resident', role: Role.Resident }} onNavigate={vi.fn()} />);
  return api;
}
async function add(name = 'photo.png') {
  fireEvent.change(screen.getByLabelText('Add a photograph'), { target: { files: [new File(['image'], name, { type: 'image/png' })] } });
  await waitFor(() => expect(screen.queryByText(/Uploading the photograph/)).toBeNull());
}
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('Photo analysis confirmation', () => {
  it('requires explicit confirmation, preserves human description and adjusts report count without changing detections', async () => {
    vi.mocked(analyzePestPhoto).mockResolvedValue(detected);
    show();
    fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'Pigeon' } });
    fireEvent.change(screen.getByLabelText('Describe what you saw'), { target: { value: 'My original observation' } });
    fireEvent.click(screen.getByLabelText('Someone was hurt'));
    await add();
    await screen.findByText('Photo analysis: 2 Rat detected');
    expect((screen.getByLabelText('What did you see?') as HTMLSelectElement).value).toBe('Pigeon');
    fireEvent.click(screen.getByText('Use detected species and count'));
    expect((screen.getByLabelText('Describe what you saw') as HTMLTextAreaElement).value).toBe('My original observation');
    expect((screen.getByLabelText('Someone was hurt') as HTMLInputElement).checked).toBe(true);
    fireEvent.change(screen.getByLabelText('Number observed / estimated density:'), { target: { value: '9' } });
    expect(screen.getByText('Photo analysis: 2 Rat detected')).toBeTruthy();
    expect(screen.getByText(/Report count: 9/)).toBeTruthy();
  });
  it('clears the applied status when the resident changes the detected species', async () => {
    vi.mocked(analyzePestPhoto).mockResolvedValue(detected);
    show();
    await add();
    await screen.findByText('Photo analysis: 2 Rat detected');
    fireEvent.click(screen.getByText('Use detected species and count'));
    fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'Pigeon' } });
    expect(screen.getByText('Use detected species and count')).toBeTruthy();
    expect(screen.getByText(/Report count: 2/)).toBeTruthy();
    expect((screen.getByLabelText('What did you see?') as HTMLSelectElement).value).toBe('Pigeon');
  });
  it('labels an exact-photo cached result and still requires resident confirmation', async () => {
    vi.mocked(analyzePestPhoto).mockResolvedValue({ ...detected, cacheHit: true });
    show();
    await add();
    await screen.findByText('Photo analysis: 2 Rat detected');
    expect(screen.getByText('Previous analysis of this exact photo.')).toBeTruthy();
    expect(screen.getByText('Use detected species and count')).toBeTruthy();
    expect((screen.getByLabelText('What did you see?') as HTMLSelectElement).value).toBe('');
  });
  it('keeps a late earlier photo result from replacing the latest photo', async () => {
    let first!: (v: PestRecognitionOutcome) => void;
    let second!: (v: PestRecognitionOutcome) => void;
    vi.mocked(analyzePestPhoto).mockImplementationOnce(() => new Promise((resolve) => { first = resolve; })).mockImplementationOnce(() => new Promise((resolve) => { second = resolve; }));
    show(); await add('first.png'); await add('second.png');
    second({ status: 'no-detection', estimatedCount: 0, boundingBoxes: [], message: 'No pests detected in the latest photo' });
    await screen.findByText('No pests detected in the latest photo');
    first(detected);
    await waitFor(() => expect(screen.queryByText('Photo analysis: 2 Rat detected')).toBeNull());
  });
  it('loads an allowlisted sample image and analyses its real converted file', async () => {
    const file = new File(['actual encoded pixels'], 'sample.jpg', { type: 'image/jpeg' });
    vi.mocked(preparePestPhoto).mockResolvedValueOnce(file);
    vi.mocked(analyzePestPhoto).mockResolvedValueOnce(detected);
    const request = vi.fn<typeof fetch>().mockResolvedValue({ ok: true, blob: async () => new Blob(['actual source pixels'], { type: 'image/webp' }) } as Response);
    vi.stubGlobal('fetch', request);
    try {
      show();
      fireEvent.click(screen.getByRole('button', { name: 'House crow' }));
      await screen.findByText('Photo analysis: 2 Rat detected');
      expect(request).toHaveBeenCalledWith('/visuals/pests/corvus-splendens-house-crow-singapore.webp', expect.objectContaining({ redirect: 'error' }));
      expect(vi.mocked(preparePestPhoto).mock.calls[0]![0]).toMatchObject({ type: 'image/webp', size: 20 });
      expect(vi.mocked(analyzePestPhoto).mock.calls[0]![0]).toMatchObject({ type: 'image/jpeg', size: 21 });
    } finally { vi.unstubAllGlobals(); }
  });
  it('discards pending detections after removing the analysed photo', async () => {
    let finish!: (v: PestRecognitionOutcome) => void;
    vi.mocked(analyzePestPhoto).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    show(); await add('remove.png');
    fireEvent.click(screen.getByText('Remove remove.png'));
    finish(detected);
    await waitFor(() => expect(screen.queryByText('Photo analysis: 2 Rat detected')).toBeNull());
    expect(screen.queryByText(/D-Fence analysing/)).toBeNull();
  });
  it('does not claim a default rat count before confirmation and preserves injury override', async () => {
    show();
    fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'Rat' } });
    expect(screen.queryByText(/1 Rat reported/)).toBeNull();
    expect(screen.getByText('Confirm the observed count to assess density. The report count is currently unknown.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Someone was hurt'));
    expect(screen.getByText('Injury reported. Seek urgent medical help where needed.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Someone was hurt'));
    fireEvent.click(screen.getByLabelText('I confirm the report count from my observation'));
    expect(screen.getByText(/1 Rat reported/)).toBeTruthy();
  });
  it('does not persist a default count of one after a zero detection', async () => {
    vi.mocked(analyzePestPhoto).mockResolvedValueOnce({ status: 'no-detection', estimatedCount: 0, boundingBoxes: [], message: 'No pests detected' });
    const api = show();
    const post = vi.spyOn(api, 'post').mockResolvedValue({ reportId: 'new-report' });
    fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'Rat' } });
    fireEvent.change(screen.getByLabelText('Describe what you saw'), { target: { value: 'Observation provided by resident' } });
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '1.3' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '103.8' } });
    await add(); await screen.findByText('No pests detected');
    fireEvent.click(screen.getByText('Submit report'));
    await waitFor(() => expect(post).toHaveBeenCalled());
    const payload = post.mock.calls[0]![1] as Record<string, unknown>;
    expect(payload.estimatedCount).toBeUndefined();
    expect(payload.description).toBe('Observation provided by resident');
    expect((screen.getByLabelText('I confirm the report count from my observation') as HTMLInputElement).checked).toBe(false);
  });
  it('shows manual entry and stops scanning after rejection', async () => {
    vi.mocked(analyzePestPhoto).mockRejectedValue(new Error('network'));
    show(); await add();
    await screen.findByText('Photo analysis failed. Confirm the pest and observed count manually.');
    expect(screen.queryByText(/D-Fence analysing/)).toBeNull();
  });
  it('keeps manual report submission available when photo upload rejects', async () => {
    vi.mocked(uploadPhoto).mockRejectedValueOnce(new Error('network'));
    const api = show();
    const post = vi.spyOn(api, 'post').mockResolvedValue({ reportId: 'manual-report' });
    fireEvent.change(screen.getByLabelText('What did you see?'), { target: { value: 'Rat' } });
    fireEvent.change(screen.getByLabelText('Describe what you saw'), { target: { value: 'One rat by the drain' } });
    fireEvent.change(screen.getByLabelText('Latitude'), { target: { value: '1.3' } });
    fireEvent.change(screen.getByLabelText('Longitude'), { target: { value: '103.8' } });
    await add();
    expect(screen.getByText('the photograph could not be attached')).toBeTruthy();
    fireEvent.click(screen.getByText('Submit report'));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0]![1]).toMatchObject({ pestType: 'Rat', description: 'One rat by the drain', photos: [] });
  });
});

// Native decoding is stubbed here; these checks verify pixel transport and resize wiring, not model accuracy.
describe('Browser image preparation', () => {
  it('decodes large WebP pixels, resizes by aspect ratio and sends JPEG bytes through ApiClient', async () => {
    const actual = await vi.importActual<typeof import('../client/src/lib/pestRecognition')>('../client/src/lib/pestRecognition');
    const draw = vi.fn();
    const decodedSource = vi.fn();
    const imageClass = globalThis.Image;
    globalThis.Image = class {
      naturalWidth = 4000; naturalHeight = 2000;
      onload?: () => void;
      set src(value: string) { decodedSource(value); queueMicrotask(() => this.onload?.()); }
    } as unknown as typeof Image;
    const context = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillStyle: '', fillRect: vi.fn(), drawImage: draw } as unknown as CanvasRenderingContext2D);
    const encode = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['JPEG pixel output'], { type: 'image/jpeg' })));
    const post = vi.fn(async () => ({ status: 'no-detection', estimatedCount: 0, boundingBoxes: [], message: 'None' }));
    const api = { post } as unknown as ApiClient;
    try {
      const file = new File([new Uint8Array(2000000)], 'rat-infestation.webp', { type: 'image/webp' });
      await actual.analyzePestPhoto(file, api);
      expect(decodedSource).toHaveBeenCalledWith(expect.stringMatching(/^data:image\/webp;base64,/));
      expect(draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 1280, 640);
      expect(encode).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.82);
      expect(post).toHaveBeenCalledWith('/api/reports/recognize-pest', { imageBase64: btoa('JPEG pixel output'), mimeType: 'image/jpeg' });
    } finally { context.mockRestore(); encode.mockRestore(); globalThis.Image = imageClass; }
  });
});
