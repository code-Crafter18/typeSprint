const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { once } = require('node:events');
const { mkdtempSync, rmdirSync } = require('node:fs');
const http = require('node:http');
const { tmpdir } = require('node:os');
const path = require('node:path');
const test = require('node:test');
const mongoose = require('mongoose');
const TestResult = require('../models/TestResult');
const User = require('../models/User');
const AccountSession = require('../models/AccountSession');
const Passage = require('../models/Passage');
const WordBank = require('../models/WordBank');
const { seedPassages } = require('../services/textService');
const { renderPlot } = require('../services/pythonPlotter');

const mongo = process.env.TYPESPRINT_TEST_MONGODB_URI;
process.env.NODE_ENV = 'production';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/typesprint';
process.env.CORS_ORIGIN = 'https://frontend.example.test';
process.env.APP_ORIGIN = 'https://app.example.test';
delete process.env.CROSS_SITE_SESSION;
delete process.env.TRUST_PROXY;
const app = require('../server');

const storedCode = { language: 'python', title: 'Stored example', text: 'def stored():\n    return True' };

const sprint = {
  timeElapsed: 12,
  testMode: 'code',
  keystrokes: { correct: 7, incorrect: 0, extra: 0, missed: 0 },
  attempts: { correct: 7, incorrect: 1 }
};

function request(socketPath, route, { method = 'GET', cookie, body, origin } = {}) {
  const payload = body ? JSON.stringify(body) : '';
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (origin) headers.origin = origin;
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  }
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath, path: route, method, headers }, (res) => {
      let text = '';
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => {
        try {
          const body = res.headers['content-type']?.includes('application/json') ? JSON.parse(text) : text;
          resolve({ status: res.statusCode, headers: res.headers, body });
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

function mockHistory(t) {
  let entries = [{ _id: new mongoose.Types.ObjectId(), createdAt: new Date(0), wpm: 99 }];
  const select = (query) => entries.filter((entry) =>
    Object.entries(query).every(([key, value]) => String(value) === String(entry[key])));

  t.mock.method(TestResult, 'create', async (record) => {
    const entry = { ...record, _id: new mongoose.Types.ObjectId(), createdAt: new Date() };
    entries.push(entry);
    return entry;
  });

  t.mock.method(TestResult, 'aggregate', async ([{ $match }]) => {
    const rows = select($match);
    return rows.length ? [{
      totalTests: rows.length,
      bestWpm: Math.max(...rows.map((row) => row.wpm)),
      avgWpm: rows[0].wpm, avgAccuracy: rows[0].accuracy, totalTime: rows[0].time
    }] : [];
  });

  t.mock.method(TestResult, 'find', (filter) => {
    let skip = 0;
    let limit = Infinity;
    return {
      sort() { return this; },
      skip(value) { skip = value; return this; },
      limit(value) { limit = value; return this; },
      select() { return this; },
      async lean() { return select(filter).reverse().slice(skip, skip + limit); }
    };
  });

  t.mock.method(TestResult, 'deleteOne', async (filter) => {
    const [match] = select(filter);
    if (match) entries = entries.filter((entry) => entry !== match);
    return { deletedCount: Number(Boolean(match)) };
  });
  t.mock.method(TestResult, 'deleteMany', async (filter) => {
    const matches = new Set(select(filter));
    entries = entries.filter((entry) => !matches.has(entry));
  });
}

function mockAccounts(t) {
  const users = new Map();
  const sessions = new Map();
  t.mock.method(User, 'create', async (record) => {
    if (users.has(record._id)) throw Object.assign(new Error('Duplicate username'), { code: 11000 });
    users.set(record._id, record);
  });
  t.mock.method(User, 'findById', (id) => ({
    select() { return this; },
    lean: async () => users.get(id)
  }));
  t.mock.method(AccountSession, 'create', async (record) => { sessions.set(record._id, record); });
  t.mock.method(AccountSession, 'findOne', ({ _id, expiresAt }) => ({
    async lean() {
      const session = sessions.get(_id);
      return session?.expiresAt > expiresAt.$gt ? session : null;
    }
  }));
  t.mock.method(AccountSession, 'deleteOne', async ({ _id }) => { sessions.delete(_id); });
}

test('production API validates sprints, signs users in, and isolates account history', async (t) => {
  const directory = process.platform === 'win32' ? null : mkdtempSync(path.join(tmpdir(), 'typesprint-'));
  const socket = directory ? path.join(directory, 'http.sock') : '\\\\.\\pipe\\typesprint-test-' + process.pid;
  const server = app.listen(socket);
  // Named pipes have no remote IP. Supply a local address so the normal limiter runs.
  server.prependListener('request', (req) => {
    Object.defineProperty(req.socket, 'remoteAddress', { value: '127.0.0.1' });
  });
  t.after(async () => {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    if (directory) rmdirSync(directory);
  });
  await once(server, 'listening');
  const call = (route, opts) => request(socket, route, opts);
  const submit = (body, options) => call('/api/calculate', { method: 'POST', body, ...options });

  assert.equal((await call('/api/live')).status, 200);
  assert.equal((await call('/api/health')).status, 503);
  assert.equal((await call('/api/history')).status, 401);
  assert.equal((await call('/api/auth/register', { method: 'POST', body: {} })).status, 503);
  const unknownSession = 'typesprint_account=' + 'a'.repeat(64);
  assert.equal((await call('/api/history', { cookie: unknownSession })).status, 503);
  const offlinePassage = await call('/api/text?testMode=words&wordCount=10');
  assert.equal(offlinePassage.status, 200);
  assert.equal(offlinePassage.body.text.split(' ').length, 10);
  const codeUrl = '/api/text?testMode=code&language=python';
  const offlineCode = await call(codeUrl);
  assert.equal(offlineCode.body.language, 'python');
  assert.match(offlineCode.body.text, /\n {4}/);
  const nextCode = await call(codeUrl + '&previousTitle=' + encodeURIComponent(offlineCode.body.title));
  assert.notEqual(nextCode.body.title, offlineCode.body.title);
  assert.equal((await call('/api/text?testMode=code&language=invalid')).status, 400);
  for (const wpmData of [[null, null], [{ time: 1, wpm: '20' }], [{ time: 90, wpm: 20 }]]) {
    assert.equal((await submit({ ...sprint, wpmData })).status, 400);
  }
  assert.equal((await submit(sprint, { origin: 'https://other.example.test' })).status, 403);

  const offline = await submit(sprint, { origin: 'https://frontend.example.test' });
  assert.equal(offline.status, 200);
  assert.equal(offline.headers['access-control-allow-credentials'], 'true');
  assert.equal(offline.body.saved, false);
  assert.equal(offline.body.saveStatus, 'guest');
  assert.equal(offline.body.id, null);
  assert.equal(offline.body.wpm, 7);
  assert.equal(offline.body.raw_wpm, 8);
  assert.equal(offline.body.accuracy, 87.5);
  assert.equal((await submit(sprint, { cookie: unknownSession })).body.saveStatus, 'unavailable');

  if (mongo) {
    const dbName = 'typesprint_test_' + new mongoose.Types.ObjectId().toString();
    await mongoose.connect(mongo, { dbName, serverSelectionTimeoutMS: 5000 });
    t.after(async () => {
      try {
        if (mongoose.connection.name === dbName) await mongoose.connection.dropDatabase();
      } finally {
        await mongoose.disconnect();
      }
    });
    await TestResult.collection.insertOne({ createdAt: new Date(0), visitorId: 'old-browser', wpm: 99 });

    await Passage.insertMany([{ kind: 'word', text: 'orchard' }, { kind: 'word', text: 'garden' }]);
    const firstImport = await seedPassages();
    assert.deepEqual(new Set((await WordBank.findById('en-default').lean()).words), new Set(['orchard', 'garden']));
    await WordBank.updateOne({ _id: 'en-default' }, { $set: { words: ['maple', 'spruce'] } });
    assert.ok(firstImport.upsertedCount > 0);
    await Passage.updateMany({ kind: 'code', language: 'python' }, { $set: storedCode });
    const secondImport = await seedPassages();
    assert.equal(secondImport.upsertedCount, 0);
    assert.equal(secondImport.matchedCount, firstImport.upsertedCount);
    const generated = await call('/api/text?testMode=words&wordCount=10');
    assert.deepEqual(new Set(generated.body.text.split(' ')), new Set(['maple', 'spruce']));
    assert.equal(await Passage.countDocuments({ kind: 'word' }), 2);
    assert.deepEqual((await call(codeUrl)).body, { ...storedCode, mode: 'code' });
  } else {
    const descriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');
    Object.defineProperty(mongoose.connection, 'readyState', { configurable: true, get: () => 1 });
    t.after(() => {
      if (descriptor) Object.defineProperty(mongoose.connection, 'readyState', descriptor);
      else delete mongoose.connection.readyState;
    });
    mockHistory(t);
    mockAccounts(t);
    t.mock.method(WordBank, 'findById', () => ({ lean: async () => null }));
    t.mock.method(Passage, 'find', ({ kind }) => ({
      lean: async () => kind === 'code' ? [storedCode] : []
    }));
    assert.deepEqual((await call(codeUrl)).body, { ...storedCode, mode: 'code' });
    const emptyCategory = await call('/api/text?testMode=words&wordCount=10');
    assert.equal(emptyCategory.body.text.split(' ').length, 10);
  }

  assert.equal((await call('/api/health')).status, 200);
  const guest = await submit({ ...sprint, userId: 'local:runner-a' });
  assert.equal(guest.body.saveStatus, 'guest');
  assert.equal(guest.body.id, null);
  assert.equal(guest.headers['set-cookie'], undefined);
  assert.equal((await call('/api/history')).status, 401);
  assert.equal((await call('/api/history', { method: 'DELETE' })).status, 401);

  const appOrigin = process.env.APP_ORIGIN;
  const account = (cookie) => call('/api/auth/session', { cookie });
  assert.deepEqual((await account()).body, { user: null });

  async function authenticate(username, action) {
    const signed = await call('/api/auth/' + action, {
      method: 'POST', origin: appOrigin, body: { username, password: 'Private test passphrase for ' + username }
    });
    assert.equal(signed.status, action === 'register' ? 201 : 200);
    const sessionHeader = signed.headers['set-cookie'][0];
    assert.match(sessionHeader, /HttpOnly; Secure; SameSite=Lax/);
    const cookie = sessionHeader.split(';')[0];
    assert.deepEqual((await account(cookie)).body.user, { displayName: username });
    return cookie;
  }

  const a = await authenticate('runner-a', 'register');
  const aSecondBrowser = await authenticate('runner-a', 'login');
  const b = await authenticate('runner-b', 'register');
  assert.notEqual(a, aSecondBrowser);
  assert.notEqual(a, b);
  const first = await submit({ ...sprint, userId: 'local:runner-b' }, { cookie: a });
  const second = await submit({ ...sprint, testMode: 'quote' }, { cookie: b });
  assert.equal(first.body.saved, true);
  assert.equal(first.body.saveStatus, 'saved');
  assert.equal(second.body.saved, true);
  const list = (cookie, query = '') => call('/api/history' + query, { cookie });
  assert.deepEqual((await list(a)).body.history.map((row) => row.id), [first.body.id]);
  assert.deepEqual((await list(aSecondBrowser)).body.history.map((row) => row.id), [first.body.id]);
  assert.deepEqual((await list(b)).body.history.map((row) => row.id), [second.body.id]);

  if (mongo) {
    assert.equal(await TestResult.countDocuments(), 3);
    assert.equal(await User.countDocuments(), 2);
    assert.equal(await AccountSession.countDocuments(), 3);
    const hash = createHash('sha256').update(a.split('=')[1]).digest('hex');
    await AccountSession.updateOne({ _id: hash }, { $set: { expiresAt: new Date(0) } });
    assert.equal((await list(a)).status, 401);
  }

  const changedCharacter = a.endsWith('a') ? 'b' : 'a';
  const tampered = a.slice(0, -1) + changedCharacter;
  assert.equal((await list(tampered)).status, 401);
  const aQuote = await submit({ ...sprint, testMode: 'quote' }, { cookie: aSecondBrowser });
  const filtered = await list(aSecondBrowser, '?mode=quote&page=200&pageSize=1');
  assert.equal(filtered.body.pagination.page, 1);
  assert.equal(filtered.body.stats.totalTests, 1);
  assert.equal(filtered.body.history[0].id, aQuote.body.id);
  assert.equal((await call('/api/history/' + second.body.id, { method: 'DELETE', cookie: aSecondBrowser })).status, 404);
  assert.equal((await call('/api/history/' + aQuote.body.id, { method: 'DELETE', cookie: aSecondBrowser })).status, 200);
  assert.equal((await call('/api/history', { method: 'DELETE', cookie: aSecondBrowser })).status, 200);
  assert.equal((await list(aSecondBrowser)).body.stats.totalTests, 0);
  assert.equal((await list(b)).body.stats.totalTests, 1);
  const logout = await call('/api/auth/logout', { method: 'POST', cookie: b, origin: appOrigin });
  assert.equal(logout.status, 200);
  assert.match(logout.headers['set-cookie'][0], /^typesprint_account=; Path=\/api;/);
  assert.equal((await account(b)).body.user, null);
  assert.equal((await list(b)).status, 401);
  const bAgain = await authenticate('runner-b', 'login');
  assert.deepEqual((await list(bAgain)).body.history.map((row) => row.id), [second.body.id]);
  if (mongo) assert.equal(await TestResult.countDocuments({ userId: { $exists: false } }), 1);

  await t.test('username accounts register, sign in again, and save private sprints', async () => {
    const credentials = { username: 'Alicia', password: 'Test passphrase with spaces and é' };
    const post = (route, body, origin = appOrigin) => call('/api/auth/' + route, { method: 'POST', body, origin });
    assert.equal((await post('register', credentials, 'https://untrusted.example.test')).status, 403);
    assert.equal((await post('register', { username: 'short-user', password: 'short' })).status, 201);
    const registered = await post('register', credentials);
    assert.equal(registered.status, 201);
    assert.deepEqual(registered.body, { user: { displayName: 'alicia' } });
    const localCookie = registered.headers['set-cookie'][0].split(';')[0];
    assert.match(registered.headers['set-cookie'][0], /HttpOnly; Secure; SameSite=Lax/);
    assert.deepEqual((await account(localCookie)).body.user, { displayName: 'alicia' });
    assert.equal((await post('register', { ...credentials, username: 'ALICIA' })).status, 409);
    const wrong = await post('login', { ...credentials, password: 'Wrong passphrase for this account' });
    const missing = await post('login', { ...credentials, username: 'unknown' });
    assert.equal(wrong.status, 401);
    assert.deepEqual(wrong.body, missing.body);
    assert.equal(wrong.headers['set-cookie'], undefined);
    if (mongo) {
      const stored = await User.findById('local:alicia').select('+passwordHash').lean();
      assert.match(stored.passwordHash, /^scrypt-v1:[a-f0-9]{32}:[a-f0-9]{64}$/);
      assert.equal((await User.findById('local:alicia').lean()).passwordHash, undefined);
    }
    const recorded = await submit(sprint, { cookie: localCookie });
    assert.equal(recorded.body.saveStatus, 'saved');
    assert.deepEqual((await list(aSecondBrowser)).body.history, []);
    assert.equal((await call('/api/auth/logout', { method: 'POST', cookie: localCookie })).status, 200);
    assert.equal((await list(localCookie)).status, 401);
    const loggedIn = await post('login', {
      username: 'ALICIA',
      password: credentials.password.normalize('NFD')
    });
    assert.equal(loggedIn.status, 200);
    const newCookie = loggedIn.headers['set-cookie'][0].split(';')[0];
    assert.notEqual(newCookie, localCookie);
    assert.deepEqual((await list(newCookie)).body.history.map((row) => row.id), [recorded.body.id]);
  });
});

test('Matplotlib renders result and history PNGs', {
  skip: process.env.TYPESPRINT_TEST_PLOTTER !== '1'
}, async () => {
  const current = await renderPlot('current', {
    wpmData: [{ time: 1, wpm: 30 }, { time: 2, wpm: 42 }],
    errorData: [{ time: 1, count: 3 }]
  });
  const history = await renderPlot('history', { history: [{ wpm: 30 }, { wpm: 42 }, { wpm: 38 }] });
  for (const image of [current, history]) {
    assert.equal(typeof image, 'string');
    assert.equal(Buffer.from(image.split(',')[1], 'base64').subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  }
});
