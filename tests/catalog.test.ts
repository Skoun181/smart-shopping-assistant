import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
describe('baseline security and schema checks',()=>{
  test('migrations create sessions and product variants',()=>{
    const sql=readFileSync('scripts/migrations/0001_initial.sql','utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS sessions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS product_variants');
    expect(sql).toContain('CHECK (quantity > 0');
  });
  test('one shared LAN and proxy port by default',()=>{
    const env=readFileSync('.env.example','utf8');
    const compose=readFileSync('compose.yaml','utf8');
    expect(compose).toMatch(/"(?:0\.0\.0\.0:)?3000:3000"/);
    expect(compose).not.toContain(':3001');
    expect(env).not.toContain('password123');
    for(const file of ['compose.yaml','compose.registry.yaml','compose.dockerhub.yaml','compose.develop.yaml','compose.synology.yaml']){
      const contents=readFileSync(file,'utf8');
      expect(contents).not.toMatch(/env_file:|APP_PASSWORD_HASH|\$\{[^}]+:\?/);
    }
  });
});
