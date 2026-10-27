import { LocationContext, PestType } from '../entity/enums';
import { ConfigLoader } from '../config/ConfigLoader';
import { PestVisionGateway } from '../boundary/gateways/PestVisionGateway';
import { GeminiVisionStrategy } from './vision/GeminiVisionStrategy';
import type { IPestVisionStrategy } from './vision/IPestVisionStrategy';
import { PestVisionStrategyFactory } from './vision/PestVisionStrategyFactory';
export interface BoundingBox { label: string; confidence: number; box: [number, number, number, number] }
export type PriorityTier = 'Critical' | 'High' | 'Medium' | 'Low';
export interface TriageResult { priority: PriorityTier; rationale: string }
export type PestRecognitionOutcome =
  | { status: 'detected'; pestType: PestType; estimatedCount: number; boundingBoxes: BoundingBox[]; cacheHit?: true }
  | { status: 'no-detection'; estimatedCount: 0; boundingBoxes: []; message: string; cacheHit?: true }
  | { status: 'unavailable'; message: string; cacheHit?: never };
export function formatPestName(value: string): string { return value.replace(/([a-z])([A-Z])/g, '$1 $2'); }
export function computeTriagePriority(
  pestType: string, count: number, locationContext?: LocationContext | string,
  injuryReported = false, unhygienicFouling = false,
): TriageResult {
  if (injuryReported) return { priority: 'Critical', rationale: 'Injury reported. Seek urgent medical help where needed.' };
  if ([PestType.WildBoar, PestType.Snake, PestType.Macaque].includes(pestType as PestType)) {
    const indoor = locationContext === LocationContext.Indoor;
    return { priority: indoor ? 'Critical' : pestType === PestType.Macaque ? 'Medium' : 'High', rationale: `${pestType} reported${indoor ? ' indoors' : ''}. Keep a safe distance and contact the relevant wildlife authority.` };
  }
  if (pestType === PestType.Rat || pestType === PestType.Cockroach) return {
    priority: count >= 5 ? 'High' : 'Medium', rationale: `${count} ${pestType} reported. ${count >= 5 ? 'Count meets the high-density threshold.' : 'Count is below the high-density threshold.'}`,
  };
  if (pestType === PestType.Pigeon || pestType === PestType.HouseCrow) return {
    priority: count >= 15 && unhygienicFouling ? 'High' : pestType === PestType.Pigeon && count < 15 ? 'Low' : 'Medium',
    rationale: `${count} ${pestType} reported. ${unhygienicFouling ? 'Resident reports surface fouling.' : 'Surface fouling has not been confirmed.'}`,
  };
  if ([PestType.BeeWasp, PestType.Termite, PestType.BedBug].includes(pestType as PestType)) return { priority: 'High', rationale: `${pestType} reported. Assessment is required to confirm the hazard.` };
  if (pestType === PestType.Mosquito) return { priority: count >= 10 ? 'High' : 'Medium', rationale: `${count} mosquitoes reported. Inspection is required to confirm any breeding site.` };
  return { priority: 'Medium', rationale: pestType ? `${pestType} reported. Assessment is required.` : 'Choose the pest you observed.' };
}
export class PestRecognitionService {
  static async recognize(input: unknown, gateway?: PestVisionGateway | IPestVisionStrategy): Promise<PestRecognitionOutcome> {
    try {
      let strategy: IPestVisionStrategy;
      if (gateway instanceof PestVisionGateway) {
        strategy = new GeminiVisionStrategy(gateway);
      } else if (gateway) {
        strategy = gateway;
      } else {
        // ConfigLoader merges src/.env and deployed process settings. Never use unrelated API keys.
        const config = ConfigLoader.load();
        strategy = PestVisionStrategyFactory.create(config);
      }
      if (!input || typeof input !== 'object' || typeof (input as { imageBase64?: unknown }).imageBase64 !== 'string' ||
        typeof (input as { mimeType?: unknown }).mimeType !== 'string') {
        return { status: 'unavailable', message: 'Photo analysis is unavailable. Choose the pest and enter your observed count manually.' };
      }
      const photo = input as { imageBase64: string; mimeType: string };
      return await strategy.analyze(photo);
    } catch {
      return { status: 'unavailable', message: 'Photo analysis is unavailable. Choose the pest and enter your observed count manually.' };
    }
  }
}
