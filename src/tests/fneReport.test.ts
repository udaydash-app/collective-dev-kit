import { describe, it, expect } from 'vitest';
import { splitTva, TVA_RATE } from '@/lib/fneReport';

describe('splitTva (SYSCOHADA Côte d\'Ivoire)', () => {
  it('uses the 18% standard rate', () => {
    expect(TVA_RATE).toBe(0.18);
  });

  it('splits a TTC amount into HT + TVA 18%', () => {
    const { ht, tva } = splitTva(118000);
    expect(ht).toBeCloseTo(100000, 2);
    expect(tva).toBeCloseTo(18000, 2);
  });

  it('HT + TVA always equals the TTC total', () => {
    for (const total of [1000, 5555, 470350, 999999]) {
      const { ht, tva } = splitTva(total);
      expect(ht + tva).toBeCloseTo(total, 6);
    }
  });

  it('returns zero for a zero total', () => {
    expect(splitTva(0)).toEqual({ ht: 0, tva: 0 });
  });
});
