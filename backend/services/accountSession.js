const { createHash, randomBytes } = require('node:crypto');
const AccountSession = require('../models/AccountSession');

const COOKIE_NAME = 'typesprint_account';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000;

function readCookie(req, name) {
  return req.headers.cookie?.split(';').map((item) => item.trim())
    .find((item) => item.startsWith(name + '='))?.slice(name.length + 1);
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function sessionId(req) {
  const token = readCookie(req, COOKIE_NAME);
  return token && /^[a-f0-9]{64}$/.test(token) ? hashToken(token) : null;
}

function accountSessions({ production, crossSite, databaseReady }) {
  const cookieOptions = {
    httpOnly: true, secure: production, sameSite: crossSite ? 'none' : 'lax', path: '/api'
  };

  async function resolve(req, res, next) {
    res.set('Cache-Control', 'private, no-store');
    const id = sessionId(req);
    if (id) {
      try {
        if (!databaseReady()) {
          req.accountUnavailable = true;
        } else {
          const session = await AccountSession.findOne(
            { _id: id, expiresAt: { $gt: new Date() } }, 'userId -_id'
          ).lean();
          req.userId = session?.userId;
        }
      } catch (error) {
        console.warn('[Auth] Session lookup failed:', error.name);
        req.accountUnavailable = true;
      }
    }
    next();
  }

  async function signIn(req, res, userId) {
    const token = randomBytes(32).toString('hex');
    const id = sessionId(req);
    if (id) await AccountSession.deleteOne({ _id: id });
    await AccountSession.create({
      _id: hashToken(token), userId, expiresAt: new Date(Date.now() + SESSION_DURATION)
    });
    res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: SESSION_DURATION });
  }

  async function signOut(req, res) {
    const id = sessionId(req);
    if (id) await AccountSession.deleteOne({ _id: id });
    res.clearCookie(COOKIE_NAME, cookieOptions);
  }

  return { resolve, signIn, signOut };
}

module.exports = { accountSessions };
