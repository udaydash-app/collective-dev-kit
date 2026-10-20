import { describe, it, expect } from 'vitest';
import { splitTva, TVA_RATE, invoiceTva, reportTva, mapTransactionToInvoice } from '@/lib/fneReport';

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

describe('product-wise FNE TVA', () => {
  const mixedInvoice = () => mapTransactionToInvoice({ id: 'sale', total: 128800, tax: 0, items: [
    { id: 'a', name: 'Standard', quantity: 1, price: 118000, tvaRate: 18 },
    { id: 'b', name: 'Reduced', quantity: 1, price: 10800, tvaRate: 8 },
  ] });
  it('uses each product rate instead of taxing the entire bill at 18%', () => {
    const result = invoiceTva(mixedInvoice());
    expect(result.ht).toBeCloseTo(110000, 6);
    expect(result.tva).toBeCloseTo(18800, 6);
    expect(result.lines[1].tva).toBeCloseTo(800, 6);
  });
  it('treats explicit zero as exempt, not a missing rate', () => {
    const invoice = mapTransactionToInvoice({ total: 1000, items: [{ name: 'Exempt', price: 1000, quantity: 1, tvaRate: 0 }] });
    expect(invoiceTva(invoice)).toMatchObject({ ht: 1000, tva: 0, missing: false });
  });
  it('flags missing product rates rather than assuming 18%', () => {
    const invoice = mapTransactionToInvoice({ total: 1000, items: [{ name: 'Unknown', price: 1000, quantity: 1 }] });
    expect(reportTva([invoice]).missing).toBe(true);
  });
  it('sums product TVA at report end by rate', () => {
    const summary = reportTva([mixedInvoice(), mixedInvoice()]);
    expect(summary.tva).toBeCloseTo(37600, 6);
    expect(summary.rates.map(row => row.rate)).toEqual([8, 18]);
    expect(summary.rates[0].tva).toBeCloseTo(1600, 6);
  });
  it('allocates bill discounts proportionally and does not levy TVA on Timbre', () => {
    const invoice = mixedInvoice();
    invoice.total = 64500; invoice.tax = 100; invoice.discount = 64400;
    const detail = invoiceTva(invoice);
    expect(detail.tva).toBeCloseTo(9400, 6);
    expect(detail.ht + detail.tva + invoice.tax).toBeCloseTo(invoice.total, 6);
  });
});
