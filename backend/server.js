require('dotenv').config();
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const TestResult = require('./models/TestResult');
const { getPassage, getCodePassage, seedPassages } = require('./services/textService');
const { renderPlot } = require('./services/pythonPlotter');
const { accountSessions } = require('./services/accountSession');
const { accountRoutes } = require('./services/accountRoutes');
const { scoreSprint, MAX_SPRINT_SECONDS, MAX_SPRINT_CHARACTERS, MAX_SERIES_POINTS } =
  require('../frontend/src/utils/scoring.mjs');
const { CODE_LANGUAGES } = require('../frontend/src/utils/codeTyping.mjs');

const app = express();
const PORT = process.env.PORT || 5000;
const production = process.env.NODE_ENV === 'production';
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/typesprint';
const origins = (process.env.CORS_ORIGIN || '').split(',').map((value) => value.trim()).filter(Boolean);
const appOrigin = production
  ? (process.env.APP_ORIGIN?.trim() || process.env.RENDER_EXTERNAL_URL?.trim() || '')
  : (process.env.APP_ORIGIN?.trim() || 'http://localhost:5173');
const allowedOrigins = new Set([...origins, appOrigin].filter(Boolean));
const mutationOrigins = allowedOrigins;
const crossSite = process.env.CROSS_SITE_SESSION === 'true';
const modes = new Set(['words', 'time', 'quote', 'code', 'zen']);
const historySort = { createdAt: -1, _id: -1 };

if (production && !process.env.MONGODB_URI) {
  throw new Error('Production requires MONGODB_URI.');
}
if (Array.from(allowedOrigins).some((origin) => {
  const url = URL.parse(origin);
  return !url || !['https:', 'http:'].includes(url.protocol) || url.origin !== origin
    || (production && url.protocol !== 'https:');
})) {
  throw new Error('CORS_ORIGIN and APP_ORIGIN must use exact origins (HTTPS in production).');
}
if (crossSite && (!production || !origins.length)) {
  throw new Error('CROSS_SITE_SESSION requires production HTTPS and explicit CORS_ORIGIN entries.');
}

const proxy = process.env.TRUST_PROXY?.trim();
if (proxy) app.set('trust proxy', /^\d+$/.test(proxy) ? Number(proxy) : proxy);

app.use(helmet({
  contentSecurityPolicy: production ? {
    directives: {
      connectSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com']
    }
  } : false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: true
}));
app.use(express.json({ limit: '256kb' }));

const databaseReady = () => mongoose.connection.readyState === 1;
app.get('/api/live', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (_req, res) => {
  const mongoConnected = databaseReady();
  res.status(mongoConnected ? 200 : 503).json({
    status: mongoConnected ? 'healthy' : 'degraded',
    mongoConnected,
    environment: process.env.NODE_ENV || 'development',
    time: new Date().toISOString()
  });
});

app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
}));
app.use('/api', (req, res, next) => {
  const origin = req.get('origin');
  const host = req.get('host');
  const sameHost = Boolean(host) && URL.parse(origin || '')?.host === host.toLowerCase();
  if (['POST', 'DELETE'].includes(req.method) && origin && !sameHost && !mutationOrigins.has(origin)) {
    return res.status(403).json({ error: 'Origin is not allowed' });
  }
  next();
});

const sessions = accountSessions({ production, crossSite, databaseReady });
app.use('/api/auth', accountRoutes({ databaseReady, sessions }));

app.get('/api/text', async (req, res) => {
  const punctuation = req.query.punctuation === 'true';
  const numbers = req.query.numbers === 'true';
  const mode = req.query.testMode || 'words';
  if (!modes.has(mode)) return res.status(400).json({ error: 'Unsupported test mode' });

  if (mode === 'code') {
    const language = req.query.language ?? 'all';
    if (typeof language !== 'string' || !Object.hasOwn(CODE_LANGUAGES, language)) {
      return res.status(400).json({ error: 'Unsupported code language' });
    }
    const previousTitle = typeof req.query.previousTitle === 'string' ? req.query.previousTitle : '';
    return res.json({ ...await getCodePassage(language, previousTitle), mode });
  }

  const wordCount = Math.max(5, Math.min(parseInt(req.query.wordCount, 10) || 25, 200));
  const duration = Math.max(5, Math.min(parseInt(req.query.testDuration, 10) || 15, 300));
  const count = mode === 'time' ? Math.max(50, Math.floor(duration * 3.5))
    : mode === 'zen' ? 100 : wordCount;
  const text = await getPassage({ mode, count, punctuation, numbers });
  res.json({ text, mode });
});

function validCount(value, max) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}

function readSeries(series, field, max, elapsed, defaultValue) {
  if (!Array.isArray(series) || series.length > MAX_SERIES_POINTS) return null;
  const points = [];
  for (const point of series) {
    if (!point || !Number.isFinite(point.time) || point.time < 0 || point.time > Math.ceil(elapsed)) return null;
    const value = point[field] === undefined ? defaultValue : point[field];
    if (!validCount(value, max)) return null;
    points.push({ time: point.time, [field]: value });
  }
  return points.sort((a, b) => a.time - b.time);
}

app.post('/api/calculate', sessions.resolve, async (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Expected a JSON result' });
  }

  const {
    finalUserInput = '', timeElapsed, finalErrorCount = 0, wpmData = [], errorData = [],
    keystrokes, attempts, testMode = 'words', testConfig = ''
  } = req.body;
  const seconds = Number(timeElapsed);
  if ((!['number', 'string'].includes(typeof timeElapsed)) ||
    !Number.isFinite(seconds) || seconds <= 0 || seconds > MAX_SPRINT_SECONDS) {
    return res.status(400).json({ error: 'timeElapsed must be between 0 and 3600 seconds' });
  }
  if (!modes.has(testMode) || typeof testConfig !== 'string') {
    return res.status(400).json({ error: 'Invalid test settings' });
  }

  const speeds = readSeries(wpmData, 'wpm', 10000, seconds);
  const errorPoints = readSeries(errorData, 'count', 100000, seconds, 1);
  if (!speeds || !errorPoints) return res.status(400).json({ error: 'Invalid chart data' });

  let counts;
  if (keystrokes?.correct != null) {
    counts = {
      correct: keystrokes.correct,
      incorrect: keystrokes.incorrect ?? finalErrorCount,
      extra: keystrokes.extra ?? 0,
      missed: keystrokes.missed ?? 0
    };
  } else {
    if (attempts !== undefined || typeof finalUserInput !== 'string' || finalUserInput.length > MAX_SPRINT_CHARACTERS ||
      !validCount(finalErrorCount, MAX_SPRINT_CHARACTERS)) {
      return res.status(400).json({ error: 'Invalid typing data' });
    }
    const length = Array.from(finalUserInput).length;
    const incorrect = Math.min(length, finalErrorCount);
    counts = { correct: length - incorrect, incorrect, extra: 0, missed: 0 };
  }

  const typedAttempts = attempts === undefined
    ? { correct: counts.correct, incorrect: counts.incorrect + counts.extra }
    : attempts;
  if (!Object.values(counts).every((value) => validCount(value, MAX_SPRINT_CHARACTERS)) ||
    !typedAttempts || !validCount(typedAttempts.correct, 100000) || !validCount(typedAttempts.incorrect, 100000) ||
    typedAttempts.correct < counts.correct || typedAttempts.incorrect < counts.incorrect + counts.extra) {
    return res.status(400).json({ error: 'Invalid keystroke counts' });
  }

  const scored = scoreSprint(counts, typedAttempts, seconds, speeds);
  const result = { ...scored, mode: testMode, config: testConfig.slice(0, 100), errorData: errorPoints };
  const { raw_wpm, ...stored } = result;
  const save = req.userId && databaseReady()
    ? TestResult.create({ ...stored, rawWpm: raw_wpm, userId: req.userId }).catch((error) => {
      console.warn('[MongoDB] Result save failed:', error.name);
      return null;
    })
    : Promise.resolve(null);
  const [saved, graphImage] = await Promise.all([
    save,
    speeds.length ? renderPlot('current', { wpmData: speeds, errorData: errorPoints }) : null
  ]);

  res.json({
    ...result,
    id: saved ? saved._id.toString() : null,
    saved: Boolean(saved),
    saveStatus: saved ? 'saved' : (req.userId || req.accountUnavailable) ? 'unavailable' : 'guest',
    timestamp: saved ? saved.createdAt.toISOString() : new Date().toISOString(),
    graph_image: graphImage
  });
});

app.use('/api/history', sessions.resolve, (req, res, next) => {
  if (req.accountUnavailable || (req.userId && !databaseReady())) {
    return res.status(503).json({ error: 'History is temporarily unavailable. Try again shortly.' });
  }
  if (!req.userId) return res.status(401).json({ error: 'Sign in to see your history.' });
  next();
});

app.get('/api/history', async (req, res) => {
  const requestedPage = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 50));
  const mode = req.query.mode;
  const filter = { userId: req.userId };
  if (mode && mode !== 'all') {
    if (!modes.has(mode)) return res.status(400).json({ error: 'Unsupported test mode' });
    filter.mode = mode;
  }

  const [[summary], trendRecords] = await Promise.all([
    TestResult.aggregate([
      { $match: filter },
      { $group: {
        _id: null, totalTests: { $sum: 1 }, bestWpm: { $max: '$wpm' },
        avgWpm: { $avg: '$wpm' }, avgAccuracy: { $avg: '$accuracy' }, totalTime: { $sum: '$time' }
      } }
    ]),
    TestResult.find(filter).sort(historySort).limit(200)
      .select({ createdAt: 1, wpm: 1, accuracy: 1, time: 1 }).lean()
  ]);

  const totalTests = summary?.totalTests ?? 0;
  const totalPages = Math.ceil(totalTests / pageSize);
  const page = Math.min(requestedPage, Math.max(1, totalPages));
  const [historyRecords, trendGraphImage] = await Promise.all([
    TestResult.find(filter).sort(historySort).skip((page - 1) * pageSize).limit(pageSize)
      .select('-userId -wpmData -errorData').lean(),
    trendRecords.length >= 2 ? renderPlot('history', { history: trendRecords.reverse() }) : null
  ]);

  const round = (value) => Math.round((value ?? 0) * 10) / 10;
  res.json({
    stats: {
      totalTests, bestWpm: summary?.bestWpm ?? 0, avgWpm: round(summary?.avgWpm),
      avgAccuracy: round(summary?.avgAccuracy), totalTime: round(summary?.totalTime)
    },
    history: historyRecords.map((doc) => ({
      id: doc._id.toString(), timestamp: doc.createdAt, wpm: doc.wpm, raw_wpm: doc.rawWpm,
      accuracy: doc.accuracy, errors: doc.errors, time: doc.time, consistency: doc.consistency,
      mode: doc.mode, config: doc.config, keystrokes: doc.keystrokes
    })),
    trendGraphImage,
    pagination: { page, pageSize, totalTests, totalPages }
  });
});

app.delete('/api/history/:id', async (req, res) => {
  const { id } = req.params;
  if (!mongoose.isObjectIdOrHexString(id)) {
    return res.status(400).json({ error: 'Invalid history record id' });
  }
  const result = await TestResult.deleteOne({ _id: id, userId: req.userId });
  if (!result.deletedCount) return res.status(404).json({ error: 'Sprint record not found' });
  res.json({ id, message: 'Record deleted successfully' });
});

app.delete('/api/history', async (req, res) => {
  await TestResult.deleteMany({ userId: req.userId });
  res.json({ message: 'History cleared successfully' });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.use((req, res, next) => {
  if (!['GET', 'HEAD'].includes(req.method) || path.extname(req.path)) return next();
  res.sendFile(path.join(frontendDist, 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || (databaseReady() ? 500 : 503);
  if (status >= 500) console.error('Request failed:', error.name);
  const messages = {
    400: 'Invalid request body', 404: 'Resource not found', 413: 'Request body is too large',
    503: 'Service temporarily unavailable'
  };
  res.status(status).json({ error: messages[status] || 'Internal server error' });
});

if (require.main === module) {
  let shuttingDown = false;
  let retryTimer;
  async function connectDatabase() {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 2500, socketTimeoutMS: 4000, maxPoolSize: 10, timeoutMS: 4000
      });
      console.log('Connected to MongoDB');
    } catch (error) {
      console.warn('[MongoDB] Connection failed:', error.name);
      if (!shuttingDown) retryTimer = setTimeout(connectDatabase, 5000).unref();
      return;
    }

    if (!shuttingDown) {
      try {
        const result = await seedPassages();
        if (result.upsertedCount) console.log('Imported ' + result.upsertedCount + ' built-in passages');
      } catch (error) {
        console.warn('[MongoDB] Passage import failed:', error.name);
      }
    }
  }

  connectDatabase();
  const server = app.listen(PORT, () => console.log('TypeSprint API listening on ' + PORT));
  const shutdown = () => {
    shuttingDown = true;
    clearTimeout(retryTimer);
    server.close(() => mongoose.disconnect().catch(() => {}));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}

module.exports = app;
