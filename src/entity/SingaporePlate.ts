/**
 * Singapore goods-vehicle plates, e.g. "GBC 4821 K": prefix (starts with G), number 1-9999,
 * and an LTA checksum letter. Letters count A=1..Z=26 (last two prefix letters only; a missing
 * letter counts 0); the number is padded to four digits. Weights 9,4,5,4,3,2, sum mod 19,
 * mapped through the checksum alphabet (F, I, N, O, Q, V, W are never checksum letters).
 */
const WEIGHTS = [9, 4, 5, 4, 3, 2];
const CHECKSUM_LETTERS = 'AZYXUTSRPMLKJHGEDCB';
const PLATE = /^([A-Z]{1,3})\s?(\d{1,4})\s?([A-Z])$/;

export function checksumLetter(prefix: string, number: number): string {
  const letters = prefix.slice(-2).padStart(2, '0').split('').map((c) => (c === '0' ? 0 : c.charCodeAt(0) - 64));
  const digits = String(number).padStart(4, '0').split('').map(Number);
  const sum = [...letters, ...digits].reduce((total, value, i) => total + value * (WEIGHTS[i] ?? 0), 0);
  return CHECKSUM_LETTERS[sum % 19] ?? 'A';
}

/** Formats a goods-vehicle plate with its checksum letter. */
export function formatGoodsPlate(prefix: string, number: number): string {
  const p = prefix.toUpperCase();
  if (!/^G[A-Z]{0,2}$/.test(p) || !Number.isInteger(number) || number < 1 || number > 9999) {
    throw new Error('goods plate needs a prefix starting with G and a number from 1 to 9999');
  }
  return `${p} ${number} ${checksumLetter(p, number)}`;
}

/** True when the text is a well-formed plate whose checksum letter is correct. */
export function isValidPlate(text: string): boolean {
  const m = PLATE.exec(text.trim().toUpperCase());
  return !!m && checksumLetter(m[1]!, Number(m[2])) === m[3];
}

export function isValidGoodsPlate(text: string): boolean {
  return isValidPlate(text) && text.trim().toUpperCase().startsWith('G');
}

/** Deterministic, checksum-valid goods plate for a seed string; `taken` keeps plates distinct. */
export function demoGoodsPlate(seed: string, taken: ReadonlySet<string> = new Set()): string {
  let hash = 7;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  const alphabet = 'ABCDEFGHJKLMPRSTUXYZ';
  const prefix = `G${alphabet[hash % alphabet.length]}${alphabet[Math.floor(hash / 20) % alphabet.length]}`;
  let n = (Math.floor(hash / 400) % 9000) + 1000;
  for (let tries = 0; tries < 9000; tries += 1, n = n === 9999 ? 1000 : n + 1) {
    const plate = formatGoodsPlate(prefix, n);
    if (!taken.has(plate)) return plate;
  }
  throw new Error('no free demo plate');
}
