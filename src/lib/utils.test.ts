import { describe, it, expect } from 'vitest';
import { utils } from './utils';

describe('Calculation Utilities', () => {
  it('correctly parses whole numbers and decimals', () => {
    expect(utils.parseQty('2')).toBe(2);
    expect(utils.parseQty('0.75')).toBe(0.75);
  });

  it('correctly parses fractional strings', () => {
    expect(utils.parseQty('1/2')).toBe(0.5);
    expect(utils.parseQty('1/3')).toBeCloseTo(0.3333, 4);
  });

  it('correctly parses mixed fractions', () => {
    expect(utils.parseQty('1 1/2')).toBe(1.5);
    expect(utils.parseQty('2 3/4')).toBe(2.75);
  });

  it('generates correct fractional display strings for quick splits', () => {
    // Splitting 1 item across 2 people -> "1/2"
    expect(utils.getFractionString(1, 2)).toBe('1/2');
    // Splitting 3 items across 2 people -> "1 1/2"
    expect(utils.getFractionString(3, 2)).toBe('1 1/2');
  });

  it('splits GST into CGST and SGST accurately', () => {
    const split = utils.getSplitNames('Food GST');
    expect(split.cgst).toBe('Food CGST');
    expect(split.sgst).toBe('Food SGST');
  });
});
