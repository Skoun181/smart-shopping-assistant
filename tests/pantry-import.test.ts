import { describe, expect, test } from 'vitest';
import { parseCSV,receiptSuggestions,CSV_HEADER,importPrompt } from '../src/lib/pantry-import';

describe('reviewable pantry imports',()=>{
  test('accepts BOM, CRLF, quoted delimiters and decimal comma',()=>{
    expect(parseCSV('\uFEFF'+CSV_HEADER+'\r\n"Milch; frisch";1,5;l;Milchprodukte & Eier;"1,5 %"\r\n')[0]).toEqual({
      name:'Milch; frisch',quantity:1.5,unit:'l',category:'Milchprodukte & Eier',variant:'1,5 %'
    });
  });
  test('unknown amount remains unconfirmed',()=>{
    expect(parseCSV(CSV_HEADER+'\nÄpfel;;pcs;;')[0].quantity).toBeNull();
  });
  test('malformed/negative or oversized input is rejected',()=>{
    for(const bad of [CSV_HEADER+'\nMilch;-1;l;;',CSV_HEADER+'\nMilch;1;USD;;',CSV_HEADER+'\n"Milch;1;l;;',CSV_HEADER+'\nMilch;1;l',CSV_HEADER+'\n'+('x'.repeat(100001))])expect(()=>parseCSV(bad)).toThrow();
  });
  test('receipt prices are not mistaken for amount, refunds and totals ignored',()=>{
    const result=receiptSuggestions('MILCH 1,29 A\n2 x JOGHURT 2,58 A\nPFAND 0,25 A\nSUMME 4,12\nKARTENZAHLUNG 4,12');
    expect(result.map(r=>[r.name,r.quantity])).toEqual([['MILCH',null],['JOGHURT',2]]);
  });
  test('external prompt includes current categories',()=>expect(importPrompt(['Tierbedarf'])).toContain('Tierbedarf'));
});
