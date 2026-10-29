const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const OPAQUE_ID = new RegExp(`\\b(?:report|prop)[_-]${UUID}\\b|\\b${UUID}\\b|\\b[0-9a-f]{32}\\b`, 'gi');

/** A short, human-readable heading with fixture markers and opaque identifiers removed. */
export function cleanTitle(value: string | undefined | null, fallback: string): string {
  const cleaned = (value ?? '')
    .replace(/^\s*\[DEMO[^\]]*\]\s*/i, '')
    .replace(/^\s*DEMO(?:\s+\d{8}(?:\s+[A-Z0-9_-]+)?\b)?\s*[:#-]?\s*/i, '')
    .replace(OPAQUE_ID, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s:–—|]+|[\s:–—|]+$/g, '')
    .trim();
  if (!cleaned || /^unassigned$/i.test(cleaned)) return fallback;
  return cleaned.charAt(0).toLocaleUpperCase() + cleaned.slice(1);
}

/** Build a compact task heading from its recorded task, pest, and locality. */
export function displayTaskName(taskType?: string, pestType?: string, locality?: string): string {
  const task = cleanTitle(taskType, 'Inspection');
  const pest = pestType ? cleanTitle(pestType, '') : '';
  const place = locality ? cleanTitle(locality, 'Reported location') : '';
  return [task, pest && !task.toLowerCase().includes(pest.toLowerCase()) ? pest : '', place]
    .filter(Boolean)
    .join(' · ');
}
