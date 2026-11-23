import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function sceneDom(lang) {
  return new JSDOM(`<!doctype html><html lang="${lang}"><head></head><body></body></html>`, {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  });
}

function loadClient(dom, requestStar) {
  let plugin;
  const { window } = dom;
  if (requestStar) window.fetch = async (url, options) => {
    assert.equal(url, '/api/my-cozy-dsh/star');
    assert.equal(options.method, 'POST');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.headers['x-my-cozy-dsh-action'], 'star');
    return { ok: true, json: async () => ({ result: await requestStar() }) };
  };
  window.__ModuleLoader__ = { load(def) { plugin = def; } };
  vm.runInContext(read('client.js'), dom.getInternalVMContext());
  assert.ok(plugin, 'client bundle registered');
  let cleanup;
  plugin.factory().apply({ effect(fn) { cleanup = fn(); } });
  return () => cleanup();
}

test('version is 1.0.11 and vine copy matches the locale files', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '1.0.11');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  const en = JSON.parse(read('locale/en.json'));
  const zh = JSON.parse(read('locale/zh.json'));
  const src = read('client.js');
  const vine = JSON.parse(src.match(/const VINE_LOCALE = (\{.*?\});/)[1]);
  assert.deepEqual(vine.en, en.vine);
  assert.deepEqual(vine.zh, zh.vine);
  assert.match(src, /dsh-cozy-hanging-plant/);
  assert.match(src, /dsh-desk-light-v2/);
  assert.doesNotMatch(src, /dsh-desk-light-v3/);
  assert.match(src, /dsh-lamp-flow/);
  assert.match(src, /data-pool=\\"desk\\"/);
});

test('light-mode dialogs use opaque paper without changing the transparent shell', () => {
  // Source regression only; this does not verify browser-computed backgrounds.
  const match = read('client.js').match(/const CSS = ("(?:\\.|[^"\\])*");/);
  assert.ok(match, 'client contains a literal theme stylesheet');
  const css = JSON.parse(match[1]);
  const rule = css.match(/body:not\(\[data-ds-dark-theme\]\) :is\(\[role="dialog"\], \.dshRemoteBackdrop\)\s*\{([^}]+)\}/);
  assert.ok(rule, 'dialog and Remote backdrop overrides are restricted to light mode');
  assert.equal(rule[1].trim(), '--dsw-alias-bg-base: var(--dsk-surface-paper, #f6edd0) !important;');
  const adapter = css.match(/body:not\(\[data-ds-dark-theme\]\)\s*\{([^}]+)\}/);
  assert.ok(adapter, 'light-mode shell token adapter exists');
  assert.match(adapter[1], /--dsw-alias-bg-base:\s*transparent !important;/);
  assert.match(adapter[1], /--dsw-alias-bg-overlay:\s*#f6edd0 !important;/);
  assert.match(css, /:root\s*\{[^}]*--dsk-surface-paper:\s*#f6edd0;/);
});

test('chat width and first-drag baseline stay owned by native controls', () => {
  // Source regression check; real pointer drags are verified in the running app.
  const source = read('client.js');
  const match = source.match(/const CSS = ("(?:\\.|[^"\\])*");/);
  assert.ok(match, 'client contains a literal theme stylesheet');
  const css = JSON.parse(match[1]);
  assert.doesNotMatch(css, /--dsh-chat-(?:user|content)-width\s*:/,
    'do not shadow native inherited widths or supply a different first-drag baseline');
  assert.doesNotMatch(source, /localStorage\.setItem\(['"]dsh\.conversation\.contentWidth/);
  assert.match(source, /var showLeft = leftRoom >= 90/);
  assert.match(source, /var showRight = rightRoom >= 80/);
  assert.ok(source.includes("add(doc.querySelector('[data-composer-card]'))"));
  assert.ok(source.includes('ro.observe(next[j])'));
});

test('sidebar plant, sticky bars, and hanging plant follow the scene', async () => {
  const dom = sceneDom('en');
  const { window } = dom;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const cls = typeof this.className === 'string' ? this.className : '';
    if (this.hasAttribute('data-dsh-sidebar') || cls.includes('_sideRoot')) {
      return new window.DOMRect(0, 16, 280, 760);
    }
    if (cls.includes('_footArea')) return new window.DOMRect(8, 700, 260, 48);
    if (cls.includes('_sessionRow')) return new window.DOMRect(8, 120, 260, 36);
    if (this.tagName === 'HEADER') return new window.DOMRect(300, 0, 860, 48);
    if (cls.includes('_mainPanel')) return new window.DOMRect(300, 0, 860, 800);
    if (cls.includes('_centerCol')) return new window.DOMRect(296, 0, 880, 820);
    if (cls.includes('_frame')) return new window.DOMRect(0, 0, 1200, 820);
    return new window.DOMRect(0, 0, 120, 32);
  };

  window.document.body.innerHTML = `
    <div id="root">
      <div class="_frame_x">
        <div class="_sidebarCol_x">
          <div data-slot="sidebar"><div class="_sideRoot"></div></div>
        </div>
        <div class="_centerCol_x">
          <div class="_mainPanel_x">
            <header data-window-drag="true"></header>
            <div id="host-tabs" data-plugin-bar data-natural style="position:sticky;top:0;z-index:2">
              <div role="tablist">
                <button type="button" role="tab">Installed</button>
                <button type="button" role="tab">Plugin Market</button>
              </div>
            </div>
            <div data-dsh-market-root data-dsh-market-plugins-tab="true">
              <div class="Market_head_x" style="position:sticky;top:36px">
                <button type="button" class="Market_tab_x">Discover</button>
                <button type="button" class="Market_tab_x">Themes</button>
              </div>
              <div class="Market_stickyHead_x" style="display:contents">
                <div class="Market_cats_x" style="position:sticky;top:72px">
                  <button type="button" data-chip="1">All</button>
                  <button type="button" data-chip="1">Themes &amp; Appearance</button>
                </div>
              </div>
            </div>
            <div id="static-tabs" style="position:relative">
              <div role="tablist"><button type="button" role="tab">Chat</button></div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  let cleanup;
  try {
    cleanup = loadClient(dom);
    const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
    const body = window.document.body;
    const sidebar = window.document.querySelector('[data-dsh-sidebar]');
    assert.ok(sidebar, 'sidebar root tagged');
    assert.equal(body.getAttribute('data-dsh-tree'), '1', 'empty session list shows the plant');

    const row = window.document.createElement('div');
    row.className = '_sessionRow_x';
    row.textContent = 'Notes';
    sidebar.appendChild(row);
    await flush();
    assert.equal(body.getAttribute('data-dsh-tree'), '0', 'a session hides the plant');

    row.remove();
    await flush();
    assert.equal(body.getAttribute('data-dsh-tree'), '1', 'removing the last session shows the plant again');

    const host = window.document.getElementById('host-tabs');
    const head = window.document.querySelector('.Market_head_x');
    const cats = window.document.querySelector('.Market_cats_x');
    const ghost = window.document.querySelector('.Market_stickyHead_x');
    const plain = window.document.getElementById('static-tabs');
    assert.equal(host.getAttribute('data-dsh-sticky-bar'), '');
    assert.equal(head.getAttribute('data-dsh-sticky-bar'), '');
    assert.equal(cats.getAttribute('data-dsh-sticky-bar'), '');
    assert.equal(ghost.getAttribute('data-dsh-sticky-bar'), null, 'display:contents wrapper is not the bar');
    assert.equal(plain.getAttribute('data-dsh-sticky-bar'), null, 'non-sticky tab rows stay transparent');
    for (const bar of [host, head, cats]) {
      const bg = window.getComputedStyle(bar).backgroundColor;
      assert.match(bg, /246,\s*237,\s*208|#f6edd0|dsk-surface-paper/);
    }
    const themeCss = window.document.getElementById('dsh-desk-scene').textContent;
    const paperAt = themeCss.indexOf('[data-dsh-sticky-bar]');
    assert.ok(paperAt > 0, 'sticky bar rule exists');
    assert.ok(themeCss.slice(paperAt, paperAt + 220).includes('#f6edd0) !important'), 'sticky bars use opaque paper');
    assert.ok(themeCss.includes('.dsh-lamp-beam {\n  z-index: 2;\n  pointer-events: none;'));

    const stage = window.document.querySelector('.dsh-deco-stage');
    const beam = window.document.querySelector('.dsh-lamp-beam');
    const frame = window.document.querySelector('[data-dsh-frame]');
    assert.equal(stage.parentElement, frame);
    const stageZ = window.getComputedStyle(stage).zIndex;
    assert.match(stageZ, /^(20|var\(--dsk-z-stage,\s*20\))$/);
    assert.equal(window.getComputedStyle(stage).pointerEvents, 'none');
    assert.equal(window.getComputedStyle(beam).pointerEvents, 'none');
    assert.equal(beam.closest('[data-dsh-sticky-bar]'), null, 'opaque bars do not contain the beam');
    assert.ok(host.closest('[data-dsh-col]'), 'tab bars stay inside the panel');
    assert.equal(stage.closest('[data-dsh-col]'), null, 'the lamp stage is not clipped by a panel');

    const close = window.document.querySelector('.dsh-vine-close');
    const show = window.document.querySelector('.dsh-vine-show');
    assert.equal(close.getAttribute('aria-label'), 'Hide hanging plant');
    assert.equal(show.querySelector('svg'), show.lastElementChild);
    assert.equal(show.textContent.trim(), '', 'restore control is a leaf, not a plus');
    assert.equal(window.getComputedStyle(close).width, '28px');
    assert.equal(window.getComputedStyle(close).borderRadius, '999px');
    const vineAt = themeCss.indexOf('.dsh-vine-btn {\n  position: absolute;');
    assert.ok(vineAt > 0, 'vine button rule exists');
    const vineRule = themeCss.slice(vineAt, vineAt + 700);
    assert.match(vineRule, /width:\s*28px/);
    assert.match(vineRule, /border-radius:\s*999px/);
    assert.match(vineRule, /var\(--dsk-btn-soft-bg,\s*#b9bd92\)/);
    assert.match(vineRule, /var\(--dsk-text-brand,\s*#475e29\)/);
    assert.equal(window.getComputedStyle(show).display, 'none');

    close.click();
    assert.equal(body.getAttribute('data-dsh-vine'), '0');
    assert.equal(window.localStorage.getItem('dsh-cozy-hanging-plant'), 'collapsed');
    assert.equal(window.getComputedStyle(window.document.querySelector('.dsh-deco-vine')).display, 'none');
    assert.equal(window.getComputedStyle(show).display, 'grid');

    window.document.documentElement.lang = 'zh-CN';
    close.click();
    show.click();
    assert.equal(show.getAttribute('aria-label'), '显示垂吊植物');
    assert.equal(window.localStorage.getItem('dsh-cozy-hanging-plant'), 'open');
    assert.equal(body.getAttribute('data-dsh-vine'), '1');
    assert.equal(window.localStorage.getItem('dsh-desk-light-v2') === null || window.localStorage.getItem('dsh-desk-light-v2').includes('"on"'), true);
  } finally {
    if (cleanup) cleanup();
    window.close();
  }
});

test('hanging plant choice survives a remount', () => {
  const dom = sceneDom('zh');
  const { window } = dom;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    const cls = typeof this.className === 'string' ? this.className : '';
    if (this.hasAttribute('data-dsh-sidebar') || cls.includes('_sideRoot')) return new window.DOMRect(0, 0, 280, 700);
    if (this.tagName === 'HEADER') return new window.DOMRect(280, 0, 800, 40);
    if (cls.includes('_mainPanel')) return new window.DOMRect(280, 0, 800, 700);
    if (cls.includes('_frame')) return new window.DOMRect(0, 0, 1100, 700);
    return new window.DOMRect(0, 0, 80, 24);
  };
  window.localStorage.setItem('dsh-cozy-hanging-plant', 'collapsed');
  window.document.body.innerHTML = `
    <div id="root"><div class="_frame_x">
      <div class="_sidebarCol_x"><div data-slot="sidebar"><div class="_sideRoot"></div></div></div>
      <div class="_centerCol_x"><div class="_mainPanel_x"><header data-window-drag="true"></header></div></div>
    </div></div>`;
  let cleanup;
  try {
    cleanup = loadClient(dom);
    assert.equal(window.document.body.getAttribute('data-dsh-vine'), '0');
    assert.equal(window.document.querySelector('.dsh-vine-show').getAttribute('aria-label'), '显示垂吊植物');
    assert.equal(window.localStorage.getItem('dsh-desk-light-v2') !== 'collapsed', true);
  } finally {
    if (cleanup) cleanup();
    window.close();
  }
});

test('star invite waits 48 hours and only reports GitHub-confirmed success', async () => {
  const dom = sceneDom('zh-CN');
  const { window } = dom;
  const key = 'my-cozy-dsh:star-invite:v1';
  const start = 1_800_000_000_000;
  const hours48 = 48 * 60 * 60 * 1000;
  let now = start, tick, unmount;
  window.Date.now = () => now;
  window.setInterval = handler => { tick = handler; return 1; };
  window.clearInterval = () => {};
  window.document.body.innerHTML = `<div id="root"><div class="_frame_x"><div class="_centerCol_x"><div class="_mainPanel_x"><div data-conversation-content data-content-phase="hero"><div data-composer-card><textarea></textarea></div></div></div></div></div></div>`;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('data-composer-card')) return new window.DOMRect(300, 520, 500, 90);
    return new window.DOMRect(0, 0, 1024, 768);
  };
  try {
    let calls = 0, confirm;
    unmount = loadClient(dom, () => { calls++; return new Promise(resolve => { confirm = resolve; }); });
    const note = () => window.document.querySelector('.dsh-local-star-preview');
    assert.equal(JSON.parse(window.localStorage.getItem(key)).firstUse, start);
    now += hours48 - 1;
    tick();
    assert.equal(note().hidden, true);
    now += 1;
    tick();
    assert.equal(note().hidden, true, 'wait for the conversation to settle');
    now += 2000;
    tick();
    assert.equal(note().hidden, false, 'opens without a cat click, including on the hero composer');
    const input = window.document.querySelector('textarea');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    assert.equal(note().hidden, true);
    assert.equal(JSON.parse(window.localStorage.getItem(key)).outcome, '', 'typing does not consume the invite');
    now += 2000;
    tick();
    now += 2000;
    tick();
    assert.equal(note().hidden, false);
    assert.equal(calls, 0, 'no authorization check before clicking');
    note().querySelector('.dsh-star-action').click();
    note().querySelector('.dsh-star-action').click();
    await settleStar();
    assert.equal(calls, 1, 'pending repeated clicks cannot duplicate the request');
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    confirm('starred');
    await settleStar();
    assert.equal(note().hidden, true, 'confirmation does not interrupt typing');
    now += 2000;
    tick();
    now += 2000;
    tick();
    assert.equal(note().hidden, false, 'confirmation returns after typing stops');
    assert.equal(note().querySelector('.dsh-star-label').textContent, '已在 GitHub 加星');
    note().querySelector('.dsh-star-close').click();
    now += 2000;
    tick();
    assert.equal(note().hidden, true, 'explicitly closing the confirmation keeps it closed');
    assert.equal(JSON.parse(window.localStorage.getItem(key)).outcome, 'github-starred');
    unmount();
    assert.equal(note(), null);
    unmount = loadClient(dom);
    now += 10000;
    tick();
    assert.equal(note().hidden, true, 'does not reappear after reload');
  } finally {
    if (unmount) unmount();
    dom.window.close();
  }
});

const settleStar = () => new Promise(resolve => setImmediate(resolve));

test('a legacy local star does not hide the invite; fallback opens GitHub only on the second click', async () => {
  const dom = sceneDom('zh-CN');
  const { window } = dom;
  const key = 'my-cozy-dsh:star-invite:v1';
  let now = 1_800_000_000_000, tick, unmount, calls = 0;
  const opens = [];
  window.open = (...args) => opens.push(args);
  window.Date.now = () => now;
  window.setInterval = handler => { tick = handler; return 1; };
  window.clearInterval = () => {};
  window.localStorage.setItem(key, JSON.stringify({ firstUse: now - 49 * 3600000, outcome: 'starred' }));
  window.document.body.innerHTML = `<div id="root"><div class="_frame_x"><div class="_centerCol_x"><div class="_mainPanel_x"><div data-conversation-content data-content-phase="hero"><div data-composer-card></div></div></div></div></div></div>`;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('data-composer-card')) return new window.DOMRect(300, 520, 500, 90);
    return new window.DOMRect(0, 0, 1024, 768);
  };
  try {
    unmount = loadClient(dom, async () => ++calls === 1 ? 'retry' : 'fallback');
    now += 2000;
    tick();
    const button = window.document.querySelector('.dsh-star-action');
    const label = () => button.querySelector('.dsh-star-label').textContent;
    assert.equal(button.closest('aside').hidden, false);
    assert.equal(label(), '加一颗星');
    button.click();
    await settleStar();
    assert.equal(label(), '重试加星');
    button.click();
    await settleStar();
    assert.equal(label(), '去 GitHub 加星');
    assert.equal(opens.length, 0);
    button.click();
    assert.equal(opens[0][0], 'https://github.com/juliiiiiiiu/my-cozy-dsh');
    assert.equal(calls, 2);
    assert.notEqual(JSON.parse(window.localStorage.getItem(key)).outcome, 'github-starred');
  } finally {
    if (unmount) unmount();
    window.close();
  }
});
