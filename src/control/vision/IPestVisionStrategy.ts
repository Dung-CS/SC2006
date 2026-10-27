import type { PestRecognitionOutcome } from '../PestRecognitionService';

export interface PestVisionPhoto {
  imageBase64: string;
  mimeType: string;
}

/** Provider-independent boundary for photo analysis. */
export interface IPestVisionStrategy {
  analyze(photo: PestVisionPhoto): Promise<PestRecognitionOutcome>;
}
