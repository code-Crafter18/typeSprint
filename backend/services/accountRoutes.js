const express = require('express');
const User = require('../models/User');
const { passwordAccounts } = require('./passwordAccounts');

function accountRoutes({ databaseReady, sessions }) {
  const router = express.Router();
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  router.get('/session', sessions.resolve, async (req, res) => {
    if (req.accountUnavailable) return res.status(503).json({ error: 'Account service temporarily unavailable' });
    const account = req.userId && await User.findById(req.userId, 'displayName -_id').lean();
    res.json({ user: account ? { displayName: account.displayName } : null });
  });

  passwordAccounts(router, { databaseReady, sessions });

  router.post('/logout', async (req, res) => {
    await sessions.signOut(req, res);
    res.json({ user: null });
  });

  return router;
}

module.exports = { accountRoutes };
