const mongoose = require('mongoose');

const TestResultSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, immutable: true },
    wpm: { type: Number, required: true, min: 0, max: 10000 },
    rawWpm: { type: Number, default: 0, min: 0, max: 10000 },
    accuracy: { type: Number, required: true, min: 0, max: 100 },
    errors: { type: Number, default: 0, min: 0, max: 100000 },
    time: { type: Number, required: true, min: 0.5, max: 3600 },
    consistency: { type: Number, default: 100, min: 0, max: 100 },
    mode: { type: String, enum: ['words', 'time', 'quote', 'code', 'zen'], default: 'words' },
    config: { type: String, default: '', maxlength: 100 },
    keystrokes: {
      correct: { type: Number, default: 0 },
      incorrect: { type: Number, default: 0 },
      extra: { type: Number, default: 0 },
      missed: { type: Number, default: 0 }
    },
    wpmData: {
      type: [
      {
        time: { type: Number, min: 0, max: 3600 },
        wpm: { type: Number, min: 0, max: 10000 }
      }
      ],
      validate: [(value) => value.length <= 600, 'Too many WPM data points']
    },
    errorData: {
      type: [
      {
        time: { type: Number, min: 0, max: 3600 },
        count: { type: Number, min: 0, max: 100000 }
      }
      ],
      validate: [(value) => value.length <= 600, 'Too many error data points']
    }
  },
  {
    timestamps: true,
    bufferCommands: false,
    suppressReservedKeysWarning: true
  }
);

TestResultSchema.index({ userId: 1, createdAt: -1, _id: -1 });
TestResultSchema.index({ userId: 1, mode: 1, createdAt: -1, _id: -1 });

// Virtual getter to maintain field naming compatibility with existing frontend
TestResultSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    ret.raw_wpm = ret.rawWpm;
    ret.timestamp = ret.createdAt;
    return ret;
  }
});

module.exports = mongoose.model('TestResult', TestResultSchema);
