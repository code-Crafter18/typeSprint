const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  kind: { type: String, enum: ['word', 'quote', 'code'], required: true },
  text: { type: String, required: true, trim: true },
  title: String,
  language: String,
  author: {
    type: String,
    trim: true,
    required() { return this.kind === 'quote'; }
  }
}, {
  collection: 'passages',
  bufferCommands: false,
  versionKey: false
});

schema.index({ kind: 1 });

module.exports = mongoose.model('Passage', schema);
