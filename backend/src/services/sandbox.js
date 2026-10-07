import { Worker } from 'node:worker_threads';

// Runs AI-written reference code against the tests in a separate thread with hard time and memory limits.
// Only the problem generator uses this. A candidate's own code never runs on the server.

const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads');
const vm = require('node:vm');
const { isDeepStrictEqual } = require('node:util');

const { code, tests } = workerData;
const results = [];

try {
  const ctx = vm.createContext(Object.create(null));
  vm.runInContext(code, ctx, { timeout: 1000 });

  for (const t of tests) {
    try {
      ctx.__argsJson = t.argsJson;
      vm.runInContext('__out = JSON.stringify(solve(...JSON.parse(__argsJson)))', ctx, { timeout: 1000 });
      const actual = ctx.__out === undefined ? null : JSON.parse(ctx.__out);
      results.push({ passed: isDeepStrictEqual(actual, JSON.parse(t.expectedJson)), actual });
    } catch (err) {
      results.push({ passed: false, error: String(err && err.message ? err.message : err) });
    }
  }
  parentPort.postMessage({ ok: true, results });
} catch (err) {
  parentPort.postMessage({ ok: false, error: String(err && err.message ? err.message : err) });
}
`;

export function runReference(code, tests, timeoutMs = 4000) {
  return new Promise((resolve) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { code, tests },
      resourceLimits: { maxOldGenerationSizeMb: 64, maxYoungGenerationSizeMb: 16 },
    });

    const timer = setTimeout(() => {
      void worker.terminate();
      resolve({ ok: false, error: 'Timed out' });
    }, timeoutMs);

    worker.once('message', (msg) => {
      clearTimeout(timer);
      void worker.terminate();
      resolve(msg);
    });
    worker.once('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });
  });
}
