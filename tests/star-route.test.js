import assert from 'node:assert/strict';
import childProcess, { execFile } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import test from 'node:test';
import { apply } from '../index.js';

const fallback = { result: 'fallback', url: 'https://github.com/juliiiiiiiu/my-cozy-dsh' };
const url = 'https://dsh.example/api/my-cozy-dsh/star';
const headers = { 'x-my-cozy-dsh-action': 'star' };

function stubExecFile(t, run) {
  const stub = t.mock.method(childProcess, 'execFile', run);
  t.after(() => {
    stub.mock.restore();
    syncBuiltinESMExports();
  });
  syncBuiltinESMExports();
  assert.equal(execFile, stub);
  return stub;
}

function registerRoute(t) {
  let route, cleanup, disposed = false;
  apply({
    inject(services, start) {
      assert.deepEqual(services, ['connection']);
      start({
        effect(register) { cleanup = register(); },
        connection: { fetch: { register(options) { route = options; return () => { disposed = true; }; } } },
      });
    },
  });
  t.after(() => {
    cleanup();
    assert.equal(disposed, true);
  });
  return route;
}

test('host registers the buffered POST and rejects non-UI or parameterized requests with the fixed fallback', async t => {
  const run = stubExecFile(t, () => { throw new Error('must not launch a process'); });
  const route = registerRoute(t);
  assert.deepEqual(route.methods, ['POST']);
  assert.equal(route.path, '/api/my-cozy-dsh/star');
  assert.equal(route.requestBody, 'buffered');
  const unreadable = new Request(url, { method: 'POST', headers, body: 'repo=other' });
  await unreadable.arrayBuffer();
  for (const request of [
    new Request(url, { method: 'POST' }),
    new Request(`${url}?repo=other`, { method: 'POST', headers }),
    new Request(url, { method: 'POST', headers, body: 'repo=other' }),
    unreadable,
  ]) {
    const response = await route.fetch(request);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), fallback);
  }
  assert.equal(run.mock.callCount(), 0);
});

test('host serializes success and timeout fallback for a valid star action', async t => {
  let ghCalls = 0;
  stubExecFile(t, (file, _args, _options, done) => {
    if (file === '/usr/sbin/scutil') return done(null, '');
    if (file !== 'gh') throw new Error(`unexpected executable: ${file}`);
    if (++ghCalls === 1) return done(null, 'HTTP/2.0 204 No Content\r\n');
    return done({ killed: true, signal: 'SIGTERM' }, '', '');
  });
  const route = registerRoute(t);
  for (const expected of [{ result: 'starred' }, fallback]) {
    const response = await route.fetch(new Request(url, { method: 'POST', headers }));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), expected);
  }
  assert.equal(ghCalls, 2);
});
