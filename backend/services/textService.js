const { createHash } = require('node:crypto');
const mongoose = require('mongoose');
const Passage = require('../models/Passage');
const WordBank = require('../models/WordBank');
const WORD_BANK = require('../data/passages/words.json');
const QUOTES = require('../data/passages/quotes.json');
const CODE_SNIPPETS = require('../../frontend/src/data/codePassages.json');
const { CODE_LANGUAGES, isCodePassage, pickCodePassage } = require('../../frontend/src/utils/codeTyping.mjs');

const DEFAULT_WORD_BANK = 'en-default';

function generateWords(count = 25, withPunctuation = false, withNumbers = false, wordBank = WORD_BANK) {
  const selected = [];
  let previousIndex = -1;

  for (let i = 0; i < count; i++) {
    const available = wordBank.length - (previousIndex === -1 ? 0 : 1);
    let index = Math.floor(Math.random() * available);
    if (previousIndex !== -1 && index >= previousIndex) index++;
    selected.push(wordBank[index]);
    previousIndex = index;
  }

  // Inject numbers if requested (~15% chance)
  if (withNumbers) {
    for (let i = 0; i < selected.length; i++) {
      if (Math.random() < 0.15) {
        const num = [
          Math.floor(Math.random() * 99) + 1,
          Math.floor(Math.random() * 1900) + 100,
          Math.floor(Math.random() * 490) + 10
        ][Math.floor(Math.random() * 3)];
        selected[i] = num.toString();
      }
    }
  }

  // Inject punctuation if requested
  if (withPunctuation) {
    let capitalizeNext = true;
    for (let i = 0; i < selected.length; i++) {
      let word = selected[i];
      if (capitalizeNext && /^[a-zA-Z]+$/.test(word)) {
        word = word.charAt(0).toUpperCase() + word.slice(1);
        capitalizeNext = false;
      }
      if (i === selected.length - 1) {
        word += ".";
      } else if (Math.random() < 0.2) {
        const punctuationMarks = [",", ",", ".", ";", "?", "!"];
        const punct = punctuationMarks[Math.floor(Math.random() * punctuationMarks.length)];
        word += punct;
        if ([".", "?", "!"].includes(punct)) {
          capitalizeNext = true;
        }
      }
      selected[i] = word;
    }
  }

  return selected.join(" ");
}

function getQuote(quotes = QUOTES) {
  const q = quotes[Math.floor(Math.random() * quotes.length)];
  return `${q.quote} — ${q.author}`;
}

async function getCodePassage(language, previousTitle) {
  const filter = { kind: 'code', language: language === 'all'
    ? { $in: Object.keys(CODE_LANGUAGES).filter((key) => key !== 'all') } : language };
  const entries = await loadPassages(filter, 'text title language -_id');
  const saved = entries.filter(isCodePassage);
  return pickCodePassage(saved, language, previousTitle) ?? pickCodePassage(CODE_SNIPPETS, language, previousTitle);
}

function validWords(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((word) => typeof word === 'string' && /^[a-z]+$/.test(word)))];
}

async function seedWordBank() {
  if (await WordBank.exists({ _id: DEFAULT_WORD_BANK })) return;

  const legacy = validWords(await Passage.distinct('text', { kind: 'word' }));
  await WordBank.updateOne(
    { _id: DEFAULT_WORD_BANK },
    { $setOnInsert: { words: legacy.length >= 2 ? legacy : WORD_BANK } },
    { upsert: true, runValidators: true }
  );
}

async function getWordBank() {
  if (mongoose.connection.readyState !== 1) return WORD_BANK;

  try {
    const bank = await WordBank.findById(DEFAULT_WORD_BANK, 'words -_id').lean();
    const words = validWords(bank?.words);
    if (words.length >= 2) return words;
  } catch (error) {
    console.warn('[MongoDB] Word bank lookup failed:', error.name);
  }

  const legacy = await loadPassages({ kind: 'word' }, 'text -_id');
  const words = validWords(legacy.map(({ text }) => text));
  return words.length >= 2 ? words : WORD_BANK;
}

async function seedPassages() {
  await seedWordBank();

  const builtIn = [
    ...QUOTES.map(({ quote, author }) => ({ kind: 'quote', text: quote, author })),
    ...CODE_SNIPPETS.map((entry) => ({ kind: 'code', ...entry }))
  ];

  const operations = builtIn.map((entry) => {
    const identity = entry.kind === 'code' ? entry.language + ':' + entry.title : entry.text;
    const digest = createHash('sha256').update(identity).digest('hex');
    return {
      updateOne: {
        filter: { _id: entry.kind + ':' + digest },
        update: { $setOnInsert: entry },
        upsert: true
      }
    };
  });

  return Passage.bulkWrite(operations, { ordered: false });
}

async function loadPassages(filter, projection) {
  if (mongoose.connection.readyState === 1) {
    try {
      return await Passage.find(filter, projection).lean();
    } catch (error) {
      console.warn('[MongoDB] Passage lookup failed:', error.name);
    }
  }
  return [];
}

async function getPassage({ mode, count, punctuation, numbers }) {
  if (mode === 'quote') {
    const entries = await loadPassages({ kind: 'quote' }, 'text author -_id');
    const quotes = entries
      .filter(({ text, author }) => typeof text === 'string' && text.trim() && typeof author === 'string' && author.trim())
      .map(({ text, author }) => ({ quote: text, author }));
    return getQuote(quotes.length ? quotes : undefined);
  }

  return generateWords(count, punctuation, numbers, await getWordBank());
}

module.exports = {
  generateWords,
  getQuote,
  getCodePassage,
  getPassage,
  seedPassages
};
