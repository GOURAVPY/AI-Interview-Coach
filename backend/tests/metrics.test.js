import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeSpeechMetrics } from '../src/services/metrics.js';

const say = (text, durationMs = 0) => [{ speaker: 'candidate', text, durationMs }];
const count = (result, label) => result.fillers.find((f) => f.label === label)?.count ?? 0;

test('counts English filler words', () => {
  const m = computeSpeechMetrics(say('Um, so I like built it. Uh, yeah, like, you know.'), 'English');
  assert.equal(count(m, 'um / uh'), 2);
  assert.equal(count(m, 'like'), 2);
  assert.equal(count(m, 'you know'), 1);
  assert.equal(m.totalFillers, 5);
});

test('does not count filler words hidden inside other words', () => {
  const m = computeSpeechMetrics(say('It is unlikely, likely, and the umbrella is humming'), 'English');
  assert.equal(m.totalFillers, 0);
});

test('ignores what the interviewer said', () => {
  const turns = [
    { speaker: 'interviewer', text: 'Um, uh, like, you know', durationMs: 5000 },
    { speaker: 'candidate', text: 'I built a REST API', durationMs: 5000 },
  ];
  assert.equal(computeSpeechMetrics(turns, 'English').totalFillers, 0);
});

test('speaking speed in words per minute from per-turn timing', () => {
  const m = computeSpeechMetrics(say('word '.repeat(150), 60000), 'English');
  assert.equal(m.paceUnit, 'words per minute');
  assert.equal(m.pace, 150);
});

test('microphone speech time wins over transcript timing', () => {
  const m = computeSpeechMetrics(say('word '.repeat(150), 60000), 'English', 30000);
  assert.equal(m.pace, 300);
  assert.equal(m.speakingSec, 30);
});

test('no speaking speed when there is less than 5 seconds of speech', () => {
  assert.equal(computeSpeechMetrics(say('hello there', 3000), 'English').pace, null);
});

test('Japanese is measured in characters per minute and fillers are found', () => {
  const m = computeSpeechMetrics(say('えーと、私はバックエンドを担当しました。あの、頑張りました。', 9000), 'Japanese');
  assert.equal(m.paceUnit, 'characters per minute');
  assert.ok(count(m, 'えーと / えっと') >= 1);
  assert.ok(count(m, 'あのー') >= 1);
});

test('German fillers work with umlauts and capital letters', () => {
  const m = computeSpeechMetrics(say('Äh, ich habe ähm Software gebaut.'), 'German');
  assert.equal(count(m, 'äh / ähm'), 2);
});
