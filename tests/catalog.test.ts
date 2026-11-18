import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
describe('baseline security and schema checks',()=>{
  test('migrations create sessions and product variants',()=>{
    const sql=readFileSync('scripts/migrations/0001_initial.sql','utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sessions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS product_variants');
    expect(sql).toContain('CHECK (quantity > 0');
  });
  test('no public bind address by default',()=>{
    const env=readFileSync('.env.example','utf8');
    expect(env).toContain('BIND_ADDRESS=127.0.0.1');
    expect(env).not.toContain('password123');
  });
});
