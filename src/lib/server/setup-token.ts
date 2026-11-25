import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

let memoryToken: string | undefined;

function token(): string {
  if (process.env.APP_SETUP_TOKEN) return process.env.APP_SETUP_TOKEN;
  const path = process.env.DATABASE_PATH || './data/shopping.db';
  if (path === ':memory:') return memoryToken ??= randomBytes(24).toString('base64url');
  const file = join(dirname(path), 'setup-token');
  try {
    writeFileSync(file, randomBytes(24).toString('base64url') + '\n', { flag: 'wx', mode: 0o600 });
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== 'EEXIST') throw cause;
  }
  return readFileSync(file, 'utf8').trim();
}

export function prepareSetupToken(): void {
  token();
}

export function validSetupToken(input: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return !!input && timingSafeEqual(digest(input), digest(token()));
}
