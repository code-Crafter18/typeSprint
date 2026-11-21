require('dotenv').config();
const mongoose = require('mongoose');
const { seedPassages } = require('../services/textService');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/typesprint';
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000, timeoutMS: 5000 });
    const result = await seedPassages();
    console.log('Default word bank ready. Passages added: ' + result.upsertedCount + '. Existing passages kept: ' + result.matchedCount + '.');
  } catch (error) {
    const reason = error.reason?.servers?.values().next().value?.error?.cause?.code;
    console.error('Passage import failed: ' + error.name + (reason ? ' (' + reason + ')' : ''));
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
