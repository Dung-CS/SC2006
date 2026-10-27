import type { ConfigSet } from '../../config/ConfigSet';
import { PestVisionGateway, type PestVisionProvider } from '../../boundary/gateways/PestVisionGateway';
import type { IPestVisionStrategy } from './IPestVisionStrategy';
import { GeminiVisionStrategy, MockVisionStrategy } from './GeminiVisionStrategy';

export class PestVisionStrategyFactory {
  static create(config: ConfigSet): IPestVisionStrategy {
    const provider = config.get('DFENCE_VISION_PROVIDER') || 'gemini-developer';
    if (provider !== 'gemini-developer' && provider !== 'vertex-express') return new MockVisionStrategy();
    const key = config.get('DFENCE_VISION_API_KEY');
    if (!key) return new MockVisionStrategy();
    return new GeminiVisionStrategy(new PestVisionGateway(
      key,
      config.get('DFENCE_VISION_MODEL') || 'gemini-1.5-flash-latest',
      fetch,
      provider as PestVisionProvider,
    ));
  }
}
