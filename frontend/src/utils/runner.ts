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

// The code runs in a throwaway Web Worker (public/runner-worker.js) so a bad loop cannot freeze the page.
// It runs in the candidate's own browser and never leaves it. In production that worker is served with a
// policy that gives it no network access.
export function runTests(code: string, tests: CodingTest[], timeoutMs = 3000): Promise<RunOutcome> {
  return new Promise((resolve) => {
    const worker = new Worker('/runner-worker.js');
    const results: TestResult[] = [];

    const finish = (outcome: RunOutcome) => {
      clearTimeout(timer);
      worker.terminate();
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
