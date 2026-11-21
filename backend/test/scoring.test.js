const assert = require('node:assert/strict');
const test = require('node:test');
const { matchCharacters, scoreSprint } = require('../../frontend/src/utils/scoring.mjs');

test('net speed uses matching spaces and counts a corrected character once', () => {
  const counts = matchCharacters(['cat', 'dog'], ['cat', 'dog'], true);
  assert.deepEqual(counts, { correct: 7, incorrect: 0, extra: 0, missed: 0 });
  const score = scoreSprint(counts, { correct: 7, incorrect: 1 }, 12, []);
  assert.equal(score.wpm, 7);
  assert.equal(score.raw_wpm, 8);
  assert.equal(score.accuracy, 87.5);
});

test('unfinished timed words leave the untyped suffix out of the missed count', () => {
  const words = ['hello', 'world', 'again'];
  const typed = ['hel', 'wo'];
  assert.deepEqual(matchCharacters(words, typed), { correct: 6, incorrect: 0, extra: 0, missed: 2 });
});

test('short and extra finite words retain distinct error categories', () => {
  const counts = matchCharacters(['const', 'value'], ['cos', 'value;'], true);
  assert.deepEqual(counts, { correct: 8, incorrect: 1, extra: 1, missed: 2 });
  assert.equal(scoreSprint(counts, { correct: 8, incorrect: 2 }, 1, []).errors, 4);
});
