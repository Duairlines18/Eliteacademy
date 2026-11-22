const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('./visits.js');

test('foreground observer deduplicates in-flight requests and rolls over at Chicago midnight', async () => {
  let now = Date.parse('2026-11-22T05:59:00Z');
  let active = null;
  let release;
  const calls = [];
  const observe = create({
    now: () => now,
    entry: () => active,
    send: id => {
      calls.push(id);
      return new Promise(resolve => { release = resolve; });
    },
  });

  await observe();
  active = 'first synthetic session';
  const pending = observe();
  await observe();
  assert.deepEqual(calls, [active]);
  release({ recorded: true });
  await pending;
  await observe();

  now += 60_000;
  const nextDay = observe();
  assert.equal(calls.length, 2);
  const releaseOld = release;
  active = 'new synthetic session';
  const newSession = observe();
  assert.equal(calls.at(-1), active);
  release({ recorded: false });
  await newSession;
  await observe({ retry: true });
  assert.equal(calls.length, 3);
  // A late completion for the first session cannot clear the new session's result.
  releaseOld({ recorded: true });
  await nextDay;
  await observe();
  assert.equal(calls.length, 3);
});
