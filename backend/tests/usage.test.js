import assert from 'node:assert/strict';
import { test } from 'node:test';

// usage.js reads the environment on import, so give it harmless values first.
process.env.MONGODB_URI ||= 'mongodb://localhost/test';
process.env.JWT_SECRET ||= 'test-secret';
const { periodKeys } = await import('../src/services/usage.js');

test('budget periods are UTC days and months', () => {
  assert.deepEqual(periodKeys(new Date('2026-10-07T23:59:59Z')), { day: '2026-10-07', month: '2026-10' });
});

test('the budget rolls over at midnight UTC', () => {
  assert.equal(periodKeys(new Date('2026-12-31T23:59:59Z')).day, '2026-12-31');
  assert.deepEqual(periodKeys(new Date('2027-01-01T00:00:00Z')), { day: '2027-01-01', month: '2027-01' });
});
