import { describe, expect, it } from 'vitest';
import { checksumLetter, demoGoodsPlate, formatGoodsPlate, isValidGoodsPlate, isValidPlate } from '../src/entity/SingaporePlate';

describe('Singapore plates', () => {
  it.each([['SBA', 1234, 'G'], ['SBS', 9889, 'U'], ['E', 23, 'H'], ['SG', 2017, 'C']])(
    'matches published plate %s %i %s', (prefix, num, letter) => {
      expect(checksumLetter(prefix, num)).toBe(letter);
      expect(isValidPlate(`${prefix} ${num} ${letter}`)).toBe(true);
    });
  it('rejects a wrong checksum letter and malformed text', () => {
    expect(isValidPlate('SBA 1234 H')).toBe(false);
    expect(isValidPlate('SBA 12345 G')).toBe(false);
    expect(isValidGoodsPlate('SBA 1234 G')).toBe(false);
  });
  it('formats goods plates', () => {
    const plate = formatGoodsPlate('GBC', 4821);
    expect(plate).toMatch(/^GBC 4821 [A-Z]$/);
    expect(isValidGoodsPlate(plate)).toBe(true);
    expect(() => formatGoodsPlate('SBA', 1)).toThrow();
  });
  it('generates distinct valid deterministic demo plates', () => {
    const taken = new Set<string>();
    for (let i = 0; i < 50; i += 1) {
      const plate = demoGoodsPlate('same-seed', taken);
      expect(isValidGoodsPlate(plate)).toBe(true);
      expect(taken.has(plate)).toBe(false);
      taken.add(plate);
    }
    expect(demoGoodsPlate('x')).toBe(demoGoodsPlate('x'));
  });
});
