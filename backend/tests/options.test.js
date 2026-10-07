import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { LANGUAGES, LEVELS, ROLES } from '../src/config/options.js';

// The backend validates against these lists and the frontend shows them. They must never drift apart.
const frontend = readFileSync(new URL('../../frontend/src/utils/options.ts', import.meta.url), 'utf8');

function frontendList(name) {
  const match = frontend.match(new RegExp(`export const ${name} = \\[([^\\]]*)\\]`));
  assert.ok(match, `${name} not found in frontend/src/utils/options.ts`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('roles match between backend and frontend', () => assert.deepEqual(frontendList('ROLES'), ROLES));
test('levels match between backend and frontend', () => assert.deepEqual(frontendList('LEVELS'), LEVELS));
test('languages match between backend and frontend', () => assert.deepEqual(frontendList('LANGUAGES'), LANGUAGES));
