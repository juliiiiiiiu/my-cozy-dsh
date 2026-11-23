import assert from 'node:assert/strict';
import test from 'node:test';
import { apply } from '../index.js';

test('host registers the fixed star action and rejects non-UI or parameterized requests', async () => {
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
  assert.deepEqual(route.methods, ['POST']);
  assert.equal(route.path, '/api/my-cozy-dsh/star');
  const url = `https://dsh.example${route.path}`;
  const headers = { 'x-my-cozy-dsh-action': 'star' };
  for (const request of [
    new Request(url, { method: 'POST' }),
    new Request(`${url}?repo=other`, { method: 'POST', headers }),
    new Request(url, { method: 'POST', headers, body: 'repo=other' }),
  ]) {
    const response = await route.fetch(request);
    assert.equal(response.status, 400);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  cleanup();
  assert.equal(disposed, true);
});
