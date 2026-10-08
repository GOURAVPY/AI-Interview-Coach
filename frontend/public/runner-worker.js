// Runs the candidate's code against the tests, inside a throwaway Web Worker.
//
// In production the server sends this file with its own Content-Security-Policy:
// it may evaluate code (that is the whole job) but it has no network access at all,
// so the code written in the editor cannot send anything anywhere.

function deepEqual(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

function show(v) {
  try {
    return typeof v === 'string' ? v : JSON.stringify(v);
  } catch (e) {
    return String(v);
  }
}

self.onmessage = (event) => {
  const { code, tests } = event.data;
  const logs = [];
  const line = (...a) => logs.push(a.map(show).join(' '));
  const sandboxConsole = { log: line, info: line, warn: line, error: line };

  let solve;
  try {
    solve = new Function('console', code + '\n;return typeof solve === "function" ? solve : undefined;')(sandboxConsole);
  } catch (err) {
    self.postMessage({ type: 'fatal', error: String(err && err.message ? err.message : err) });
    return;
  }
  if (!solve) {
    self.postMessage({ type: 'fatal', error: 'Define a function named solve.' });
    return;
  }

  tests.forEach((t, index) => {
    let actual;
    let error;
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
