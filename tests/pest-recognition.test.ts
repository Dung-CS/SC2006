/** Old tests asserted filename-based fictional counts. These exercise the actual provider seam. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PestVisionGateway } from '../src/boundary/gateways/PestVisionGateway';
import { PestRecognitionService } from '../src/control/PestRecognitionService';
import { ConfigLoader } from '../src/config/ConfigLoader';
import { ConfigSet } from '../src/config/ConfigSet';
import { computeTriagePriority } from '../client/src/lib/pestRecognition';
import { PestType } from '../src/entity/enums';
const imageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlHkAAAAASUVORK5CYII=';
const input = { imageBase64, mimeType: 'image/png' };
const specimen = { pestType: PestType.Rat, confidence: 0.8, box: [0.1, 0.2, 0.3, 0.4] };
function provider(specimens: unknown) {
  return vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ specimens }) }] } }] })));
}
function reusableProvider(specimens: unknown) {
  return vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ specimens }) }] } }] })));
}
function pngInput(seed: number) {
  const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, seed >> 8, seed & 255]);
  return { imageBase64: btoa(String.fromCharCode(...bytes)), mimeType: 'image/png' };
}
afterEach(() => vi.useRealTimers());
describe('Image inference boundary', () => {
  it('sends actual image bytes, not filename, description or count; derives count from specimens', async () => {
    const request = provider([specimen]);
    const result = await PestRecognitionService.recognize({ ...input, filename: 'mosquito.jpg', description: '500 pigeons indoors', count: 500 }, new PestVisionGateway('test-key', undefined, request));
    expect(result).toMatchObject({ status: 'detected', pestType: PestType.Rat, estimatedCount: 1, boundingBoxes: [{ box: specimen.box }] });
    const sent = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(sent.generationConfig.temperature).toBe(1);
    expect(sent.generationConfig.maxOutputTokens).toBe(512);
    expect(sent.generationConfig.thinkingConfig).toBeUndefined();
    const schema = sent.generationConfig.responseJsonSchema;
    expect(schema.required).toEqual(['specimens']);
    expect(schema.properties.specimens).toMatchObject({ type: 'array' });
    expect(schema.properties.specimens).not.toHaveProperty('minItems');
    expect(schema.properties.specimens).not.toHaveProperty('maxItems');
    const item = schema.properties.specimens.items;
    expect(item.required).toEqual(['pestType', 'confidence', 'box']);
    expect(item.additionalProperties).toBe(false);
    expect(item.properties.pestType.enum).toEqual(Object.values(PestType));
    expect(item.properties.confidence).toEqual({ type: 'number', minimum: 0.6, maximum: 1 });
    expect(item.properties.box).toMatchObject({ type: 'array', minItems: 4, maxItems: 4, items: { type: 'number', minimum: 0, maximum: 1 } });
    expect(sent.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/png', data: imageBase64 });
    expect(JSON.stringify(sent)).not.toContain('500 pigeons');
    expect(request.mock.calls[0]![0]).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent');
  });
  it('uses the fixed Vertex Express endpoint and omits Developer API thinking settings', async () => {
    const request = provider([specimen]);
    const result = await new PestVisionGateway('vertex-key', 'gemini-2.5-flash', request, 'vertex-express').detect(input);
    expect(result).toMatchObject({ status: 'detected', estimatedCount: 1 });
    expect(request.mock.calls[0]![0]).toBe('https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-flash:generateContent');
    expect(request.mock.calls[0]![1]?.headers).toMatchObject({ 'x-goog-api-key': 'vertex-key' });
    const sent = JSON.parse(String(request.mock.calls[0]![1]?.body));
    expect(sent.contents[0].role).toBe('user');
    expect(sent.contents[0].parts[1].inline_data).toEqual({ mime_type: 'image/png', data: imageBase64 });
    expect(sent.generationConfig.responseJsonSchema.required).toEqual(['specimens']);
    expect(sent.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('uses Gemini 3 thinking levels instead of the legacy Gemini 2.5 budget', async () => {
    const request = provider([specimen]);
    await new PestVisionGateway('test-key', 'gemini-3-flash-preview', request, 'vertex-express').detect(input);
    const sent = JSON.parse(String(request.mock.calls[0]?.[1]?.body));
    expect(sent.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'LOW' });
    expect(sent.generationConfig.thinkingConfig).not.toHaveProperty('thinkingBudget');
  });
  it('fails closed to manual reporting for an unknown configured provider', async () => {
    const config = new ConfigSet();
    config.setEnv('DFENCE_VISION_PROVIDER', 'https://attacker.example');
    const load = vi.spyOn(ConfigLoader, 'load').mockReturnValue(config);
    try {
      expect(await PestRecognitionService.recognize(input)).toMatchObject({ status: 'unavailable' });
    } finally { load.mockRestore(); }
  });
  it('returns honest zero without a fallback mosquito', async () => {
    expect(await new PestVisionGateway('test', undefined, provider([])).detect(input)).toMatchObject({ status: 'no-detection', estimatedCount: 0, boundingBoxes: [] });
  });
  it('normalises corner coordinates and clamps xywh boxes to the image', async () => {
    const corners = await new PestVisionGateway('corner-key', undefined, provider([{ ...specimen, box: [0.3, 0.1, 0.9, 0.95] }])).detect(input);
    expect(corners).toMatchObject({ status: 'detected', estimatedCount: 1, boundingBoxes: [{ box: [0.1, 0.3, 0.85, 0.6] }] });
    const clamped = await new PestVisionGateway('clamped-key', undefined, provider([{ ...specimen, box: [0.8, 0.2, 0.5, 0.4] }])).detect(input);
    expect(clamped).toMatchObject({ status: 'detected', estimatedCount: 1, boundingBoxes: [{ box: [0.8, 0.2, 0.2, 0.4] }] });
  });
  it.each([
    [{ ...specimen, box: [0, 0, 0, 0.5] }],
    [{ ...specimen, confidence: 2 }], [{ ...specimen, box: [365, 435, 268, 255] }], [{ ...specimen, pestType: 'Dragon' }],
    [specimen, specimen], Array(501).fill(specimen), [{ ...specimen, box: [0, 0, '1', 1] }],
    [specimen, { ...specimen, pestType: PestType.Pigeon, box: [0.5, 0.5, 0.2, 0.2] }],
  ].map((bad) => ({ bad })))('rejects malformed, duplicate, excessive or mixed-species detections: %j', async ({ bad }) => {
    expect((await new PestVisionGateway('test', undefined, provider(bad)).detect(input)).status).toBe('unavailable');
  });
  it('requires image bytes and the dedicated key; never fetches URLs', async () => {
    const request = provider([specimen]);
    for (const photo of [{ filename: 'rat.jpg' }, { imageBase64: 'https://internal/', mimeType: 'image/png' }, { ...input, imageBase64: 'YWJj' }]) {
      expect((await new PestVisionGateway('test', undefined, request).detect(photo)).status).toBe('unavailable');
    }
    expect((await new PestVisionGateway('', undefined, request).detect(input)).status).toBe('unavailable');
    expect(request).not.toHaveBeenCalled();
  });
  it('contains provider rejection, HTTP errors, truncated output and invalid JSON', async () => {
    for (const request of [vi.fn<typeof fetch>().mockRejectedValue(new Error('private provider detail')), vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 })), vi.fn<typeof fetch>().mockResolvedValue(new Response('{')), vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] })))]) {
      const result = await new PestVisionGateway('test', undefined, request).detect(input);
      expect(result.status).toBe('unavailable');
      expect(JSON.stringify(result)).not.toContain('private');
    }
  });
  it('aborts a slow provider request after 10 seconds', async () => {
    vi.useFakeTimers();
    const request = vi.fn<typeof fetch>().mockImplementation((_url, init) => new Promise((_resolve, reject) => { init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))); }));
    const pending = new PestVisionGateway('test', undefined, request).detect(input);
    await vi.advanceTimersByTimeAsync(10001);
    expect((await pending).status).toBe('unavailable');
  });
  it('does not infer pigeon fouling from count', () => {
    expect(computeTriagePriority(PestType.Pigeon, 25).priority).toBe('Medium');
  });
});

describe('Successful exact-image analysis cache', () => {
  it('reuses a validated result across gateway instances and clones cached detections', async () => {
    const request = reusableProvider([specimen]);
    const first = await new PestVisionGateway('same-key', 'gemini-3.8-flash', request).detect(input);
    expect(first.status).toBe('detected');
    if (first.status !== 'detected') throw new Error('expected detection');
    first.boundingBoxes[0]!.box[0] = 0.9;
    const cached = await new PestVisionGateway('same-key', 'gemini-3.8-flash', request).detect(input);
    expect(cached).toMatchObject({ status: 'detected', cacheHit: true, boundingBoxes: [{ box: [0.1, 0.2, 0.3, 0.4] }] });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('misses when image bytes, MIME, model, provider, or key differ', async () => {
    const request = reusableProvider([specimen]);
    await new PestVisionGateway('same-key', 'gemini-3.8-flash', request).detect(input);
    await new PestVisionGateway('same-key', 'gemini-3.8-flash', request).detect(pngInput(1));
    await new PestVisionGateway('same-key', 'gemini-2.5-flash', request, 'vertex-express').detect(input);
    await new PestVisionGateway('different-key', 'gemini-3.8-flash', request).detect(input);
    expect(request).toHaveBeenCalledTimes(4);
  });

  it('caches no-detection, but never caches provider failures or bypasses required input/key checks', async () => {
    const emptyRequest = reusableProvider([]);
    const emptyFirst = await new PestVisionGateway('empty-key', undefined, emptyRequest).detect(input);
    const emptyCached = await new PestVisionGateway('empty-key', undefined, emptyRequest).detect(input);
    expect(emptyFirst.status).toBe('no-detection');
    expect(emptyCached).toMatchObject({ status: 'no-detection', cacheHit: true });
    expect(emptyRequest).toHaveBeenCalledTimes(1);

    let calls = 0;
    const failingThenValid = vi.fn<typeof fetch>().mockImplementation(async () => {
      calls += 1;
      return calls === 1 ? new Response('', { status: 503 })
        : new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ specimens: [specimen] }) }] } }] }));
    });
    expect((await new PestVisionGateway('failure-key', undefined, failingThenValid).detect(input)).status).toBe('unavailable');
    expect((await new PestVisionGateway('failure-key', undefined, failingThenValid).detect(input)).status).toBe('detected');
    const successfulRetry = await new PestVisionGateway('failure-key', undefined, failingThenValid).detect(input);
    expect('cacheHit' in successfulRetry && successfulRetry.cacheHit).toBe(true);
    expect(failingThenValid).toHaveBeenCalledTimes(2);
    expect((await new PestVisionGateway('', undefined, failingThenValid).detect(input)).status).toBe('unavailable');
    expect((await new PestVisionGateway('failure-key', undefined, failingThenValid).detect({ ...input, imageBase64: 'not-image' })).status).toBe('unavailable');
    expect(failingThenValid).toHaveBeenCalledTimes(2);
  });

  it('shares an in-flight request and isolates both callers from cached object mutation', async () => {
    let finish!: (response: Response) => void;
    const waiting = new Promise<Response>((resolve) => { finish = resolve; });
    const request = vi.fn<typeof fetch>().mockReturnValue(waiting);
    const firstPromise = new PestVisionGateway('flight-key', undefined, request).detect(input);
    const secondPromise = new PestVisionGateway('flight-key', undefined, request).detect(input);
    expect(request).toHaveBeenCalledTimes(1);
    finish(new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ specimens: [specimen] }) }] } }] })));
    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    if (first.status !== 'detected' || second.status !== 'detected') throw new Error('expected detections');
    expect('cacheHit' in first && first.cacheHit).toBe(false);
    expect('cacheHit' in second && second.cacheHit).toBe(false);
    first.boundingBoxes[0]!.box[0] = 0.9;
    expect(second.boundingBoxes[0]!.box[0]).toBe(0.1);
    const completedHit = await new PestVisionGateway('flight-key', undefined, request).detect(input);
    expect('cacheHit' in completedHit && completedHit.cacheHit).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('expires entries after 24 hours and evicts the oldest entry at capacity', async () => {
    vi.useFakeTimers();
    const ttlRequest = reusableProvider([specimen]);
    await new PestVisionGateway('ttl-key', undefined, ttlRequest).detect(input);
    await vi.advanceTimersByTimeAsync(24 * 60 * 60_000 + 1);
    const afterExpiry = await new PestVisionGateway('ttl-key', undefined, ttlRequest).detect(input);
    expect('cacheHit' in afterExpiry ? afterExpiry.cacheHit : undefined).toBeUndefined();
    expect(ttlRequest).toHaveBeenCalledTimes(2);

    const capacityRequest = reusableProvider([specimen]);
    const first = input;
    for (let i = 0; i < 129; i++) {
      const image = i === 0 ? first : pngInput(i);
      await new PestVisionGateway('capacity-key', undefined, capacityRequest).detect(image);
    }
    expect(capacityRequest).toHaveBeenCalledTimes(129);
    const afterEviction = await new PestVisionGateway('capacity-key', undefined, capacityRequest).detect(first);
    expect('cacheHit' in afterEviction ? afterEviction.cacheHit : undefined).toBeUndefined();
    expect(capacityRequest).toHaveBeenCalledTimes(130);
  });
});

import { ReportRoutes } from '../src/boundary/http/ReportRoutes';
import type { ReportController } from '../src/control/ReportController';
import { AccessControlService } from '../src/control/AccessControlService';
import { AccessPolicy } from '../src/control/AccessPolicy';
import { InMemoryAuditStore } from '../src/persistence/memory/InMemoryStores';
import { Principal } from '../src/control/Principal';
import { Role } from '../src/entity/enums';
import type { Response as RouteResponse } from '../src/boundary/http/RouteHandler';
function reply() {
  const result: { code: number; body?: unknown } = { code: 200 };
  const res: RouteResponse = { status(code) { result.code = code; return res; }, json(body) { result.body = body; }, text() {} };
  return { result, res };
}
describe('Recognition route access and spend bounds', () => {
  const req = { headers: {}, params: { route: '/api/reports/recognize-pest' }, body: input };
  function route(principal: Principal | null) {
    const handler = new ReportRoutes(new AccessControlService(new AccessPolicy(), new InMemoryAuditStore()), {} as ReportController);
    handler.useResolver({ resolve: async () => principal });
    return handler;
  }
  it('refuses anonymous calls before inference', async () => {
    const inference = vi.spyOn(PestRecognitionService, 'recognize');
    const { res, result } = reply();
    try {
      await route(null).handle(req, res);
      expect(result.code).toBe(401);
      expect(inference).not.toHaveBeenCalled();
    } finally { inference.mockRestore(); }
  });
  it('requires report:create permission', async () => {
    const inference = vi.spyOn(PestRecognitionService, 'recognize');
    const { res, result } = reply();
    try {
      await route(new Principal('manager', Role.OperationsManager, 'session')).handle({ ...req, headers: { authorization: 'Bearer token' } }, res);
      expect(result.code).toBe(403);
      expect(inference).not.toHaveBeenCalled();
    } finally { inference.mockRestore(); }
  });
  it('allows only five attempts per account per minute', async () => {
    const inference = vi.spyOn(PestRecognitionService, 'recognize').mockResolvedValue({ status: 'unavailable', message: 'Manual' });
    const handler = route(new Principal('vision-budget-user', Role.Resident, 'session'));
    try {
      for (let i = 0; i < 5; i++) {
        const { res, result } = reply(); await handler.handle({ ...req, headers: { authorization: 'Bearer token' } }, res); expect(result.code).toBe(200);
      }
      const { res, result } = reply(); await handler.handle({ ...req, headers: { authorization: 'Bearer token' } }, res);
      expect(result.code).toBe(429); expect(inference).toHaveBeenCalledTimes(5);
    } finally { inference.mockRestore(); }
  });
  it('caps concurrent requests across accounts and releases slots after completion', async () => {
    let finish!: (v: import('../src/control/PestRecognitionService').PestRecognitionOutcome) => void;
    const waiting = new Promise<import('../src/control/PestRecognitionService').PestRecognitionOutcome>((resolve) => { finish = resolve; });
    const inference = vi.spyOn(PestRecognitionService, 'recognize').mockReturnValue(waiting);
    const a = route(new Principal('vision-a', Role.Resident, 'session'));
    const b = route(new Principal('vision-b', Role.Resident, 'session'));
    try {
      const authenticated = { ...req, headers: { authorization: 'Bearer token' } };
      const p = a.handle(authenticated, reply().res); const q = b.handle(authenticated, reply().res);
      await vi.waitFor(() => expect(inference).toHaveBeenCalledTimes(2));
      const blocked = reply(); await route(new Principal('vision-c', Role.Resident, 'session')).handle(authenticated, blocked.res);
      expect(blocked.result.code).toBe(429);
      finish({ status: 'unavailable', message: 'Manual' }); await Promise.all([p, q]);
      const retry = reply(); await a.handle(authenticated, retry.res); expect(retry.result.code).toBe(200);
    } finally { inference.mockRestore(); }
  });
});
