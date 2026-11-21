const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

const derive = promisify(scrypt);
const scryptOptions = { N: 32768, r: 8, p: 3, maxmem: 40 * 1024 * 1024 };
const dummySalt = randomBytes(16);
const dummyHash = randomBytes(32);
let activeHashes = 0;

async function hashPassword(password, salt) {
  if (activeHashes >= 2) throw Object.assign(new Error('Password service busy'), { status: 503 });
  activeHashes++;
  try {
    return await derive(password, salt, 32, scryptOptions);
  } finally {
    activeHashes--;
  }
}

function validateCredentials(req, res, next) {
  const { username, password } = req.body || {};
  if (!req.is('application/json') || typeof username !== 'string' ||
      typeof password !== 'string' || !password.isWellFormed()) {
    return res.status(400).json({ error: 'Enter a username and password.' });
  }
  const name = username.trim();
  if (!/^[a-z0-9][a-z0-9_.-]{2,23}$/i.test(name)) {
    return res.status(400).json({ error: 'Choose a username with 3–24 letters, numbers, periods, underscores, or hyphens. Start with a letter or number.' });
  }
  const secret = password.normalize('NFC');
  res.locals.credentials = { username: name.toLowerCase(), password: secret };
  next();
}

function passwordAccounts(router, { databaseReady, sessions }) {
  const limitMessage = { error: 'Too many sign-in attempts. Try again in a few minutes.' };
  const ipLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: limitMessage
  });
  const accountLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 12,
    keyGenerator: (_req, res) => res.locals.credentials.username,
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    message: limitMessage
  });
  const requireDatabase = (_req, res, next) => {
    if (!databaseReady()) return res.status(503).json({ error: 'Account service temporarily unavailable.' });
    next();
  };

  router.post('/register', requireDatabase, ipLimit, validateCredentials, async (req, res) => {
    const { username, password } = res.locals.credentials;
    const salt = randomBytes(16);
    const hash = await hashPassword(password, salt);
    const userId = 'local:' + username;
    try {
      await User.create({
        _id: userId, displayName: username, passwordHash: 'scrypt-v1:' + salt.toString('hex') + ':' + hash.toString('hex')
      });
    } catch (error) {
      if (error.code === 11000) return res.status(409).json({ error: 'That username is already taken.' });
      throw error;
    }
    await sessions.signIn(req, res, userId);
    res.status(201).json({ user: { displayName: username } });
  });

  router.post('/login', requireDatabase, ipLimit, validateCredentials, accountLimit, async (req, res) => {
    const { username, password } = res.locals.credentials;
    const userId = 'local:' + username;
    const account = await User.findById(userId).select('+passwordHash').lean();
    const stored = account?.passwordHash?.match(/^scrypt-v1:([0-9a-f]{32}):([0-9a-f]{64})$/);
    const salt = stored ? Buffer.from(stored[1], 'hex') : dummySalt;
    const expected = stored ? Buffer.from(stored[2], 'hex') : dummyHash;
    const actual = await hashPassword(password, salt);
    if (!timingSafeEqual(actual, expected) || !stored) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }
    await sessions.signIn(req, res, userId);
    res.json({ user: { displayName: account.displayName } });
  });
}

module.exports = { passwordAccounts };
