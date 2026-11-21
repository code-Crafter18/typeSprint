const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: { type: String, required: true },
  userId: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 }
}, { bufferCommands: false, versionKey: false });

module.exports = mongoose.model('AccountSession', schema);
