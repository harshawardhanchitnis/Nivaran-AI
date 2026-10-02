import { describe, expect, it, vi } from 'vitest';
import { checkPdfQuotes, matchesQuote, verifyImageQuotes } from '../../server/verify/quote.js';

describe('PDF quote matching', () => {
  it.each([
    ['Paid\n INR\u00a09,999', 'Paid INR 9,999', true],
    ['Paid INR 9,999', 'paid INR 9,999', false],
    ['Paid INR 9,999', 'Paid INR 8,999', false],
    ['Anything', '', false],
  ])('matches only whitespace-normalised literal quotes', (text, quote, result) => {
    expect(matchesQuote(text as string, quote as string)).toBe(result);
  });
  it('checks the named page and refuses a quote found only on another page', () => {
    const result = checkPdfQuotes(['Order 00123', 'Refund INR 9999'], [
      { id: 'right', quote: 'Refund INR 9999', page: 2 },
      { id: 'wrong', quote: 'Refund INR 9999', page: 1 },
      { id: 'outside', quote: 'Order 00123', page: 3 },
    ]);
    expect(result).toEqual({ right: true, wrong: false, outside: false });
  });
});

describe('one image quote pass', () => {
  const image = { id: 'image', bytes: new Uint8Array([1]), mediaType: 'image/png', fileName: 'support.png' };
  const quotes = [{ id: 'one', documentId: 'image', quote: 'Refund INR 9999', page: 1 }, { id: 'two', documentId: 'image', quote: 'Order MM123', page: 1 }];
  it('charges once before confirming all quotes in one tool-free call', async () => {
    const charge = vi.fn(async () => {});
    const callModel = vi.fn(async () => ({ checks: [{ id: 'one', found: true }, { id: 'two', found: false }] }));
    expect(await verifyImageQuotes([image], quotes, { charge, callModel })).toEqual({ one: true, two: false });
    expect(charge).toHaveBeenCalledTimes(1); expect(callModel).toHaveBeenCalledTimes(1);
    expect(charge.mock.invocationCallOrder[0]).toBeLessThan(callModel.mock.invocationCallOrder[0]!);
  });
  it('does not charge or call when there are no image quotes', async () => {
    const charge = vi.fn(); const callModel = vi.fn();
    expect(await verifyImageQuotes([], [], { charge, callModel })).toEqual({});
    expect(charge).not.toHaveBeenCalled(); expect(callModel).not.toHaveBeenCalled();
  });
  it('does not call after a refused charge', async () => {
    const charge = vi.fn().mockRejectedValue(new Error('Daily limit reached.')); const callModel = vi.fn();
    await expect(verifyImageQuotes([image], quotes, { charge, callModel })).rejects.toThrow('Daily limit');
    expect(callModel).not.toHaveBeenCalled();
  });
  it.each([
    { checks: [{ id: 'one', found: true }] },
    { checks: [{ id: 'one', found: true }, { id: 'one', found: true }] },
    { checks: [{ id: 'one', found: true }, { id: 'unknown', found: true }] },
  ])('rejects incomplete, duplicate or invented check IDs', async output => {
    await expect(verifyImageQuotes([image], quotes, { charge: async () => {}, callModel: async () => output })).rejects.toThrow();
  });
});
