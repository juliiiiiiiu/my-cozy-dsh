import assert from 'node:assert/strict';
import test from 'node:test';
import { starTheme } from '../github-star.js';

const fallback = { result: 'fallback', url: 'https://github.com/juliiiiiiiu/my-cozy-dsh' };
const starred = 'HTTP/2.0 204 No Content\r\n';
const env = { PATH: '/usr/bin', GH_TOKEN: 'test', GITHUB_TOKEN: 'test', DSH_SESSION_ID: 'test' };
const local = { platform: 'linux' };
const rejected = new Error('gh exited non-zero');

function fake(error, stdout = '', stderr = '') {
  return (_command, _args, _options, done) => done(error, stdout, stderr);
}

test('runs only the fixed gh command and confirms a final HTTP 204', async () => {
  let call;
  const signal = new AbortController().signal;
  const run = (command, args, options, done) => {
    call = { command, args, options };
    done(null, `HTTP/1.1 200 Connection established\r\n\r\n${starred}`);
  };
  assert.deepEqual(await starTheme(run, env, signal, local), { result: 'starred' });
  assert.equal(call.command, 'gh');
  assert.deepEqual(call.args, [
    'api', '--hostname', 'github.com', '--include', '--method', 'PUT',
    '-H', 'Accept: application/vnd.github+json',
    '-H', 'X-GitHub-Api-Version: 2022-11-28',
    'user/starred/juliiiiiiiu/my-cozy-dsh',
  ]);
  assert.equal(call.options.timeout, 12000);
  assert.equal(call.options.signal, signal);
  assert.equal(call.options.env.GH_PROMPT_DISABLED, '1');
  assert.equal(call.options.env.GH_TOKEN, undefined);
  assert.equal(call.options.env.GITHUB_TOKEN, undefined);
  assert.equal(call.options.env.DSH_SESSION_ID, undefined);
});

for (const [name, run] of [
  ['missing gh', fake({ code: 'ENOENT' })],
  ['gh not logged in', fake(rejected, '', 'To get started with GitHub CLI, please run: gh auth login')],
  ['timeout', fake({ killed: true, signal: 'SIGTERM' })],
  ['connection error', fake(rejected, '', 'connection reset')],
  ['unauthorized request', fake(rejected, 'HTTP/2.0 401 Unauthorized\r\n')],
  ['forbidden request', fake(rejected, 'HTTP/2.0 403 Forbidden\r\n', 'Resource not accessible by personal access token')],
  ['missing authorization scope', fake(rejected, 'HTTP/2.0 404 Not Found\r\n', 'This API operation needs the "public_repo" scope')],
  ['rate limit', fake(rejected, 'HTTP/2.0 403 Forbidden\r\n', 'API rate limit exceeded')],
  ['non-2xx response even if gh exits cleanly', fake(null, `${starred}\r\nHTTP/2.0 503 Service Unavailable\r\n`)],
  ['non-204 success response', fake(null, 'HTTP/2.0 200 OK\r\n')],
  ['missing HTTP status', fake(null)],
  ['nonzero exit despite a 204 status', fake(rejected, starred)],
  ['synchronous process-launch failure', () => { throw rejected; }],
]) {
  test(`returns the fixed GitHub link on ${name}`, async () => {
    assert.deepEqual(await starTheme(run, env, undefined, local), fallback);
  });
}

test('returns the fixed GitHub link on proxy read failure', async () => {
  let launched = false;
  const run = (...args) => { launched = true; fake(null, starred)(...args); };
  const readProxy = async () => { throw new Error('proxy lookup failed'); };
  assert.deepEqual(await starTheme(run, env, undefined, { platform: 'darwin', readProxy }), fallback);
  assert.equal(launched, false);
});

test('returns the fixed GitHub link without launching gh if already aborted or aborted during proxy lookup', async () => {
  let launched = false;
  let proxyReads = 0;
  const run = (...args) => { launched = true; fake(null, starred)(...args); };
  const before = new AbortController();
  before.abort();
  const during = new AbortController();
  const readProxy = async () => { proxyReads++; during.abort(); };
  const mac = { platform: 'darwin', readProxy };
  assert.deepEqual(await starTheme(run, env, before.signal, mac), fallback);
  assert.equal(proxyReads, 0);
  assert.deepEqual(await starTheme(run, env, during.signal, mac), fallback);
  assert.equal(proxyReads, 1);
  assert.equal(launched, false);
});

test('returns the fixed GitHub link if aborted while gh is running', async () => {
  const controller = new AbortController();
  const run = (_command, _args, _options, done) => {
    controller.abort();
    done(null, starred);
  };
  assert.deepEqual(await starTheme(run, env, controller.signal, local), fallback);
});
