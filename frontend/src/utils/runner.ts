import type { CodingTest } from '../types/coding';

export interface TestResult {
  index: number;
  passed: boolean;
  actual?: unknown;
  error?: string;
  logs: string[];
}

export interface RunOutcome {
  results: TestResult[];
  fatal?: string; // the code could not even be loaded (syntax error, no solve function)
  timedOut?: boolean;
}

// Runs inside a throwaway Web Worker so a bad loop cannot freeze the page.
// The code runs in the candidate's own browser and never leaves it.
const WORKER_SOURCE = `
function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}
function show(v) {
  try { return typeof v === 'string' ? v : JSON.stringify(v); } catch (e) { return String(v); }
}
self.onmessage = (event) => {
  const { code, tests } = event.data;
  const logs = [];
  const sandboxConsole = {
    log: (...a) => logs.push(a.map(show).join(' ')),
    info: (...a) => logs.push(a.map(show).join(' ')),
    warn: (...a) => logs.push(a.map(show).join(' ')),
    error: (...a) => logs.push(a.map(show).join(' ')),
  };

  let solve;
  try {
    solve = new Function('console', code + '\\n;return typeof solve === "function" ? solve : undefined;')(sandboxConsole);
  } catch (err) {
    self.postMessage({ type: 'fatal', error: String(err && err.message ? err.message : err) });
    return;
  }
  if (!solve) {
    self.postMessage({ type: 'fatal', error: 'Define a function named solve.' });
    return;
  }

  tests.forEach((t, index) => {
    let actual, error;
    try {
      const out = solve(...JSON.parse(JSON.stringify(t.args)));
      if (out && typeof out.then === 'function') throw new Error('solve must return a value, not a Promise.');
      actual = out === undefined ? null : JSON.parse(JSON.stringify(out));
    } catch (err) {
      error = String(err && err.message ? err.message : err);
    }
    self.postMessage({ type: 'result', index, actual, error, passed: !error && deepEqual(actual, t.expected), logs: logs.splice(0) });
  });
  self.postMessage({ type: 'done' });
};
`;

export function runTests(code: string, tests: CodingTest[], timeoutMs = 3000): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: 'text/javascript' }));
    const worker = new Worker(url);
    const results: TestResult[] = [];

    const finish = (outcome: RunOutcome) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(outcome);
    };

    const timer = setTimeout(() => {
      // Mark every test that did not report as timed out.
      for (let i = 0; i < tests.length; i++) {
        if (!results.some((r) => r.index === i)) {
          results.push({ index: i, passed: false, error: 'Timed out. Is there an infinite loop?', logs: [] });
        }
      }
      finish({ results: results.sort((a, b) => a.index - b.index), timedOut: true });
    }, timeoutMs);

    worker.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'fatal') finish({ results: [], fatal: msg.error });
      else if (msg.type === 'result') results.push({ index: msg.index, passed: msg.passed, actual: msg.actual, error: msg.error, logs: msg.logs });
      else if (msg.type === 'done') finish({ results });
    };
    worker.onerror = (event) => finish({ results: [], fatal: event.message || 'Your code crashed.' });

    worker.postMessage({ code, tests });
  });
}
