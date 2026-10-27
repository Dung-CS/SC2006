import { PestVisionGateway } from '../../boundary/gateways/PestVisionGateway';
import type { PestRecognitionOutcome } from '../PestRecognitionService';
import type { IPestVisionStrategy, PestVisionPhoto } from './IPestVisionStrategy';

/** Adapts Gemini's provider boundary to the application recognition outcome. */
export class GeminiVisionStrategy implements IPestVisionStrategy {
  constructor(private readonly gateway: PestVisionGateway) {}

  analyze(photo: PestVisionPhoto): Promise<PestRecognitionOutcome> {
    return this.gateway.detect(photo);
  }
}

/** Safe strategy for tests and installations without an image provider. */
export class MockVisionStrategy implements IPestVisionStrategy {
  constructor(private readonly result: PestRecognitionOutcome = {
    status: 'unavailable',
    message: 'Photo analysis is unavailable. Confirm the pest and observed count manually.',
  }) {}

  async analyze(_photo: PestVisionPhoto): Promise<PestRecognitionOutcome> {
    return this.result;
  }
}
