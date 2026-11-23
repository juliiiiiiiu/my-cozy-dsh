import assert from 'node:assert/strict';
import test from 'node:test';
import { starTheme } from '../github-star.js';

function fake(error, stdout = '', stderr = '') {
  return (command, args, options, done) => {
    assert.equal(command, 'gh');
    assert.equal(args.at(-1), 'user/starred/juliiiiiiiu/my-cozy-dsh');
    assert.deepEqual(args.slice(1, 6), ['--hostname', 'github.com', '--include', '--method', 'PUT']);
    assert.equal(options.env.GH_PROMPT_DISABLED, '1');
    assert.equal(options.env.GH_TOKEN, undefined);
    assert.equal(options.env.GITHUB_TOKEN, undefined);
    assert.equal(options.env.DSH_SESSION_ID, undefined);
    done(error, stdout, stderr);
  };
}

const env = { PATH: '/usr/bin', GH_TOKEN: 'test', GITHUB_TOKEN: 'test', DSH_SESSION_ID: 'test' };
const rejected = new Error('gh exited non-zero');

test('reports success only on a successful GitHub 204 response', async () => {
  assert.equal(await starTheme(fake(null, 'HTTP/2.0 204 No Content\r\n'), env), 'starred');
  assert.equal(await starTheme(fake(rejected, 'HTTP/2.0 204 No Content\r\n'), env), 'retry');
  assert.equal(await starTheme(fake(null), env), 'retry');
});

test('distinguishes missing GitHub authorization from temporary failures', async () => {
  assert.equal(await starTheme(fake({ code: 'ENOENT' }), env), 'fallback');
  assert.equal(await starTheme(fake(rejected, '', 'To get started with GitHub CLI, please run: gh auth login'), env), 'fallback');
  assert.equal(await starTheme(fake(rejected, 'HTTP/2.0 401 Unauthorized\r\n'), env), 'fallback');
  assert.equal(await starTheme(fake(rejected, 'HTTP/2.0 403 Forbidden\r\n', 'Resource not accessible by personal access token'), env), 'fallback');
  assert.equal(await starTheme(fake(rejected, 'HTTP/2.0 404 Not Found\r\n', 'This API operation needs the "public_repo" scope. To request it, run: gh auth refresh -s public_repo'), env), 'fallback');
  assert.equal(await starTheme(fake(rejected, 'HTTP/2.0 403 Forbidden\r\n', 'API rate limit exceeded'), env), 'retry');
  assert.equal(await starTheme(fake(rejected, '', 'connection reset'), env), 'retry');
});
