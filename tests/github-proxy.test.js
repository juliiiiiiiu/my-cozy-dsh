import assert from 'node:assert/strict';
import test from 'node:test';
import { systemHttpsProxy } from '../github-proxy.js';
import { starTheme } from '../github-star.js';

const proxy = (extras = '', host = '127.0.0.1', port = '5081') => `<dictionary> {
  HTTPSEnable : 1
  HTTPSProxy : ${host}
  HTTPSPort : ${port}
${extras}
}`;

test('reads a manual HTTPS proxy without hard-coding the host or port', () => {
  assert.equal(systemHttpsProxy(proxy()), 'http://127.0.0.1:5081');
  assert.equal(systemHttpsProxy(proxy('', 'proxy.example', '3128')), 'http://proxy.example:3128');
  assert.equal(systemHttpsProxy(proxy('', '::1', '1080')), 'http://[::1]:1080');
  for (const host of ['user@proxy.example', 'proxy..example', '[proxy.example]', '[fe80::1%en0]']) {
    assert.equal(systemHttpsProxy(proxy('', host, '1080')), undefined);
  }
  assert.equal(systemHttpsProxy(proxy('', 'proxy.example', '65536')), undefined);
  assert.equal(systemHttpsProxy(proxy().replace('HTTPSEnable : 1', 'HTTPSEnable : 0')), undefined);
});

test('skips automatic proxy rules and GitHub bypasses', () => {
  for (const mode of ['ProxyAutoConfigEnable', 'ProxyAutoDiscoveryEnable']) {
    assert.equal(systemHttpsProxy(proxy(`  ${mode} : 1`)), undefined);
  }
  for (const pattern of ['api.github.com', '*.github.com', '.github.com', '*', 'a***.git*com']) {
    assert.equal(systemHttpsProxy(proxy(`  ExceptionsList : <array> {\n    0 : ${pattern}\n  }`)), undefined);
  }
  assert.equal(systemHttpsProxy(proxy('  ExceptionsList : <array> {\n    0 : localhost\n    1 : *.example.com\n  }')), 'http://127.0.0.1:5081');
  assert.equal(systemHttpsProxy(proxy('  __SCOPED__ : <dictionary> {\n    en0 : <dictionary> {\n      HTTPSEnable : 0\n      HTTPSPort : 9999\n    }\n  }')), 'http://127.0.0.1:5081');
});

test('applies the macOS proxy only to gh and preserves explicit network configuration', async () => {
  let reads = 0, forwarded;
  const run = (_file, _args, options, done) => { forwarded = options.env; done(null, 'HTTP/2.0 204 No Content\r\n', ''); };
  const readProxy = async () => { reads++; return 'http://proxy.example:5081'; };
  const env = { PATH: '/bin', NO_PROXY: '.example.org' };
  assert.deepEqual(await starTheme(run, env, undefined, { platform: 'darwin', readProxy }), { result: 'starred' });
  assert.equal(forwarded.HTTPS_PROXY, 'http://proxy.example:5081');
  assert.equal(forwarded.NO_PROXY, '.example.org');
  assert.equal(env.HTTPS_PROXY, undefined);
  await starTheme(run, { ...env, https_proxy: 'http://explicit.example:80' }, undefined, { platform: 'darwin', readProxy });
  assert.equal(forwarded.https_proxy, 'http://explicit.example:80');
  assert.equal(forwarded.HTTPS_PROXY, undefined);
  await starTheme(run, env, undefined, { platform: 'linux', readProxy });
  assert.equal(forwarded.HTTPS_PROXY, undefined);
  assert.equal(reads, 1);
});
