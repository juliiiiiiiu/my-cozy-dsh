import { execFile } from 'node:child_process';
import { isIP } from 'node:net';

const target = 'api.github.com';

function bypassesGitHub(settings) {
  const list = settings.match(/^ {2}ExceptionsList[ \t]*:[ \t]*<array>[ \t]*\{([^}]*)\}/m)?.[1] ?? '';
  for (const entry of list.matchAll(/^\s*\d+\s*:\s*(.+)$/gm)) {
    const pattern = entry[1].trim().toLowerCase();
    if (pattern.startsWith('.') && (target.endsWith(pattern) || target === pattern.slice(1))) return true;
    const parts = pattern.split(/\*+/);
    if (parts.length === 1) {
      if (target === pattern) return true;
      continue;
    }
    const first = parts.shift();
    const last = parts.pop();
    if (!target.startsWith(first) || !target.endsWith(last) || first.length + last.length > target.length) continue;
    let middle = target.slice(first.length, target.length - last.length);
    if (parts.every(part => {
      const index = middle.indexOf(part);
      if (index < 0) return false;
      middle = middle.slice(index + part.length);
      return true;
    })) return true;
  }
  return false;
}

export function systemHttpsProxy(settings) {
  const values = Object.fromEntries(Array.from(settings.matchAll(/^ {2}(\w+)[ \t]*:[ \t]*([^\r\n]+)$/gm), match => [match[1], match[2].trim()]));
  if (values.HTTPSEnable !== '1' || values.ProxyAutoConfigEnable === '1' || values.ProxyAutoDiscoveryEnable === '1' || bypassesGitHub(settings)) return undefined;
  const host = (values.HTTPSProxy ?? '').replace(/^\[([^\]]+)\]$/, '$1');
  const port = Number(values.HTTPSPort);
  if (!/^\d+$/.test(values.HTTPSPort ?? '') || port < 1 || port > 65535) return undefined;
  if (!host.includes('%') && isIP(host) === 6) return `http://[${host}]:${port}`;
  if (host !== values.HTTPSProxy || host.length > 254) return undefined;
  const labels = host.replace(/\.$/, '').split('.');
  if (!labels.every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))) return undefined;
  return `http://${host}:${port}`;
}

export async function macOSHttpsProxy(signal) {
  return new Promise(resolve => {
    execFile('/usr/sbin/scutil', ['--proxy'], { env: { LC_ALL: 'C' }, signal, timeout: 1500, maxBuffer: 64 * 1024 },
      (error, stdout) => resolve(error ? undefined : systemHttpsProxy(stdout)));
  });
}
