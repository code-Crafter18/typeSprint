const assert = require('node:assert/strict');
const test = require('node:test');
const words = require('../data/passages/words.json');
const quotes = require('../data/passages/quotes.json');
const code = require('../../frontend/src/data/codePassages.json');
const { CODE_LANGUAGES, isCodePassage, codeTypingTarget, appendCodeInput, matchCodeCharacters } =
  require('../../frontend/src/utils/codeTyping.mjs');
const Passage = require('../models/Passage');
const WordBank = require('../models/WordBank');
const { generateWords, getQuote, getCodePassage, seedPassages } = require('../services/textService');

test('passage files contain unique entries that fit the typing interface', () => {
  assert.ok(words.length > 180);
  assert.equal(new Set(words).size, words.length);
  assert.ok(words.every((word) => /^[a-z]+$/.test(word)));

  assert.ok(quotes.length > 12);
  assert.equal(new Set(quotes.map(({ quote }) => quote)).size, quotes.length);
  assert.ok(quotes.every(({ quote, author }) => quote.trim() && author.trim()));

  assert.equal(new Set(code.map(({ title }) => title)).size, code.length);
  assert.ok(code.every((entry) => isCodePassage(entry) && entry.text.split('\n').length >= 10));
  for (const language of Object.keys(CODE_LANGUAGES).filter((key) => key !== 'all')) {
    assert.ok(code.filter((entry) => entry.language === language).length >= 3);
  }
});

test('word generation gives the requested count and skips the previous word', (t) => {
  t.mock.method(Math, 'random', () => 0);
  const generated = generateWords(12).split(' ');
  assert.equal(generated.length, 12);
  assert.deepEqual(generated.slice(0, 4), [words[0], words[1], words[0], words[1]]);
});

test('number and punctuation modifiers still apply', (t) => {
  t.mock.method(Math, 'random', () => 0.05);
  const text = generateWords(10, true, true);
  assert.match(text, /[.!?,;]/);
  assert.match(text, /\d/);
  assert.equal(text.split(' ').length, 10);
});

test('quote and code selection can reach the newly added passages', async (t) => {
  t.mock.method(Math, 'random', () => 0.99999);
  assert.equal(getQuote(), quotes.at(-1).quote + ' — ' + quotes.at(-1).author);
  assert.deepEqual(await getCodePassage("all"), code.at(-1));
});

test('seeding uses stable IDs and keeps edited passage text on repeat imports', async (t) => {
  const documents = new Map();
  let wordBank;
  t.mock.method(WordBank, 'exists', async () => wordBank ? { _id: 'en-default' } : null);
  t.mock.method(Passage, 'distinct', async () => []);
  t.mock.method(WordBank, 'updateOne', async (filter, update) => {
    assert.deepEqual(filter, { _id: 'en-default' });
    wordBank = [...update.$setOnInsert.words];
  });
  t.mock.method(Passage.collection, 'bulkWrite', async (operations) => {
    let upsertedCount = 0;
    for (const { updateOne: { filter, update, upsert } } of operations) {
      assert.equal(upsert, true);
      assert.deepEqual(Object.keys(update), ['$setOnInsert']);
      if (documents.has(filter._id)) continue;
      documents.set(filter._id, { ...update.$setOnInsert });
      upsertedCount++;
    }
    return { upsertedCount, matchedCount: operations.length - upsertedCount };
  });

  const total = quotes.length + code.length;
  assert.equal((await seedPassages()).upsertedCount, total);
  assert.equal(documents.size, total);
  assert.deepEqual(wordBank, words);
  wordBank = ['custom', 'catalog'];
  const edited = [...documents.values()].find(({ kind }) => kind === 'code');
  edited.text = 'const edited = true;';
  assert.deepEqual(await seedPassages(), { upsertedCount: 0, matchedCount: total });
  assert.equal(edited.text, 'const edited = true;');
  assert.deepEqual(wordBank, ['custom', 'catalog']);
});

test('code practice preserves line breaks and supplies leading indentation', () => {
  const target = codeTypingTarget('def demo():\n    total = 3\n\n    return total');
  assert.equal(target, 'def demo():\ntotal = 3\n\nreturn total');
  const result = appendCodeInput(target, '', 'def demo():\n    total = 3\n\n    return total');
  assert.equal(result.typed, target);
  assert.equal(result.completed, true);
  assert.equal(result.attempts.length, target.length);
  assert.deepEqual(matchCodeCharacters(target, result.typed), {
    correct: target.length, incorrect: 0, extra: 0, missed: 0
  });
});

test('early Enter and a character at a line break count as mistakes without moving the caret', () => {
  assert.deepEqual(appendCodeInput('ab\nc', 'a', '\nbx\nc'), {
    typed: 'ab\nc',
    attempts: [
      { correct: false, separator: true },
      { correct: true, separator: false },
      { correct: false, separator: false },
      { correct: true, separator: true },
      { correct: true, separator: false }
    ],
    completed: true
  });
});
