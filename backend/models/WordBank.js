const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  words: {
    type: [{ type: String, match: /^[a-z]+$/ }],
    required: true,
    validate: {
      validator: (words) => words.length >= 2 && new Set(words).size === words.length,
      message: 'A word bank requires at least two distinct lowercase words'
    }
  }
}, {
  collection: 'wordbanks',
  bufferCommands: false,
  versionKey: false
});

module.exports = mongoose.model('WordBank', schema);
