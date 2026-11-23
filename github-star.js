import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { macOSHttpsProxy } from './github-proxy.js';

const args = [
  'api', '--hostname', 'github.com', '--include', '--method', 'PUT',
  '-H', 'Accept: application/vnd.github+json',
  '-H', 'X-GitHub-Api-Version: 2022-11-28',
  'user/starred/juliiiiiiiu/my-cozy-dsh',
];

export async function starTheme(run = execFile, env = process.env, signal, { platform = process.platform, readProxy = macOSHttpsProxy } = {}) {
  // Use gh's own login. Never read its token or inherit token overrides.
  const safeEnv = Object.fromEntries(Object.entries(env).filter(([key]) =>
    !/KEY|PASSWORD|SECRET|TOKEN|^DSH_|^GH_(?:HOST|REPO|DEBUG|API_URL)$/i.test(key)));
  if (platform === 'darwin') {
    safeEnv.PATH = [safeEnv.PATH || '/usr/bin:/bin', '/opt/homebrew/bin', '/usr/local/bin'].join(':');
    if (!safeEnv.HTTPS_PROXY && !safeEnv.https_proxy) {
      const proxy = await readProxy(signal);
      if (proxy) safeEnv.HTTPS_PROXY = proxy;
    }
  }
  if (signal?.aborted) return 'retry';
  Object.assign(safeEnv, { GH_PROMPT_DISABLED: '1', GH_NO_UPDATE_NOTIFIER: '1', GH_PAGER: '', NO_COLOR: '1' });
  return new Promise(resolve => {
    run('gh', [...args], { env: safeEnv, cwd: homedir(), timeout: 12000, maxBuffer: 128 * 1024, windowsHide: true, signal }, (error, stdout, stderr) => {
      const statuses = Array.from(String(stdout).matchAll(/^HTTP\/\S+\s+(\d{3})\b/gm), match => Number(match[1]));
      const status = statuses.at(-1);
      if (!error && status === 204) return resolve('starred');
      if (error?.code === 'ENOENT' || status === 401) return resolve('fallback');
      const diagnostic = String(stderr) + '\n' + String(stdout);
      if (/gh auth login|bad credentials|requires authentication|not logged (?:in|into)/i.test(diagnostic)) return resolve('fallback');
      if ((status === 403 || status === 404) && /this api operation needs the .+ scope|resource not accessible|insufficient (?:permission|scope)|requires .*scope/i.test(diagnostic)) return resolve('fallback');
      return resolve('retry');
    });
  });
}
