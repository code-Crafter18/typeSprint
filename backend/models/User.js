const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  displayName: { type: String, required: true, maxlength: 80 },
  passwordHash: { type: String, select: false }
}, { timestamps: true, bufferCommands: false });

module.exports = mongoose.model('User', schema);
