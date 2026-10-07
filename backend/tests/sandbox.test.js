import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runReference } from '../src/services/sandbox.js';

const tests = [{ argsJson: '[[1,2,3]]', expectedJson: '6' }];

test('a correct solution passes', async () => {
  const r = await runReference('function solve(a){ return a.reduce((x,y)=>x+y,0); }', tests);
  assert.equal(r.ok, true);
  assert.equal(r.results[0].passed, true);
});

test('a wrong solution fails without crashing', async () => {
  const r = await runReference('function solve(a){ return 0; }', tests);
  assert.equal(r.ok, true);
  assert.equal(r.results[0].passed, false);
});

test('an infinite loop is stopped', async () => {
  const started = Date.now();
  const r = await runReference('function solve(a){ while(true){} }', tests);
  assert.equal(r.results[0].passed, false);
  assert.match(r.results[0].error, /timed out/i);
  assert.ok(Date.now() - started < 4000, 'should stop within the time limit');
});

test('a memory bomb is contained', async () => {
  const r = await runReference('function solve(a){ const x=[]; while(true) x.push(new Array(1e6).fill(1)); }', tests);
  assert.equal(r.ok, false);
});

test('the code cannot reach process or require', async () => {
  const code = 'function solve(a){ return (typeof process === "undefined" && typeof require === "undefined") ? 6 : 99; }';
  const r = await runReference(code, tests);
  assert.equal(r.results[0].actual, 6);
});

test('a syntax error is reported, not thrown', async () => {
  const r = await runReference('function solve( {', tests);
  assert.equal(r.ok, false);
  assert.ok(r.error);
});
