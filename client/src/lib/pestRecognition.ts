/** Image inference uses the authenticated server boundary. No metadata classification. */
import type { ApiClient } from './ApiClient';
export type { BoundingBox, PestRecognitionOutcome as PestRecognitionResult } from '../../../src/control/PestRecognitionService';
import type { PestRecognitionOutcome } from '../../../src/control/PestRecognitionService';
export { computeTriagePriority } from '../../../src/control/ReportTriagePolicy';
export type { TriagePriority as PriorityTier, TriageResult } from '../../../src/control/ReportTriagePolicy';
export function readable(value: string): string { return value.replace(/([a-z])([A-Z])/g, '$1 $2'); }

export async function analyzePestPhoto(file: File, api: ApiClient): Promise<PestRecognitionOutcome> {
  const prepared = await preparePestPhoto(file);
  const imageBase64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('Could not read photograph'));
    reader.onabort = () => reject(new Error('Photograph reading cancelled'));
    reader.readAsDataURL(prepared);
  });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      api.post<PestRecognitionOutcome>('/api/reports/recognize-pest', { imageBase64, mimeType: prepared.type }),
      new Promise<PestRecognitionOutcome>((resolve) => {
        timeout = setTimeout(() => resolve({ status: 'unavailable', message: 'Photo analysis timed out. Enter your observation manually.' }), 25000);
      }),
    ]);
  } finally { clearTimeout(timeout); }
}

/** Decode actual pixels, retain aspect ratio, and fit the existing JSON request limit. */
export async function preparePestPhoto(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('Unsupported photo');
  // data: is permitted by the app CSP; blob: image URLs are deliberately excluded.
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image'));
    reader.onabort = () => reject(new Error('Image read cancelled'));
    reader.readAsDataURL(file);
  });
  {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Image decoding timed out')), 10000);
      image.onload = () => { clearTimeout(timer); resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error('Could not decode image')); };
      image.src = url;
    });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 100000000) throw new Error('Invalid image dimensions');
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing unavailable');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not encode image')), 'image/jpeg', 0.82));
    if (blob.size > 1400000) throw new Error('Processed photograph exceeds analysis limit');
    return new File([blob], 'analysis.jpg', { type: 'image/jpeg' });
  }
}
