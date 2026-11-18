import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { categoryEmoji, productEmoji, productEmojiMap, defaultUnit } from '../src/lib/ui/product-emoji';

describe('curated product tile illustrations',()=>{
  test('every seeded catalog product has a specific emoji',()=>{
    const source=readFileSync('src/lib/server/seed.ts','utf8');
    const catalog=source.split('const catalog: Record<string, string> = {')[1].split('\n};')[0];
    const missing:string[]=[];
    for(const [,group] of catalog.matchAll(/^\s+\w+: '([^']+)'/gm)){
      for(const pair of group.split(',')){
        const name=pair.split('|')[0];
        if(!productEmojiMap[name])missing.push(name);
      }
    }
    expect(missing).toEqual([]);
  });
  test('every catalog category has a fallback emoji',()=>{
    for(const category of ['produce','dairy','bakery','pantry','meat','frozen','drinks','snacks','spices','cleaning','hygiene']){
      expect(categoryEmoji[category]).toBeTruthy();
    }
  });
  test('custom products fall back to the category',()=>{
    expect(productEmoji('Something custom','dairy')).toBe('🥛');
    expect(productEmoji('Something custom','nonexistent')).toBe('🛒');
  });
  test('default volumes use litres',()=>{
    expect(defaultUnit('dairy','Milch')).toBe('l');
    expect(defaultUnit('drinks','Mineralwasser')).toBe('l');
    expect(defaultUnit('produce','Äpfel')).toBe('pcs');
  });
});
