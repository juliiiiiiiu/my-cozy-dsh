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
    return requestStar(options);
  };
  window.__ModuleLoader__ = { load(def) { plugin = def; } };
  vm.runInContext(read('client.js'), dom.getInternalVMContext());
  assert.ok(plugin, 'client bundle registered');
  let cleanup;
  plugin.factory().apply({ effect(fn) { cleanup = fn(); } });
  return () => cleanup();
}

test('version is 1.0.12 and vine and star copy match the locale files', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '1.0.12');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  const en = JSON.parse(read('locale/en.json'));
  const zh = JSON.parse(read('locale/zh.json'));
  const src = read('client.js');
  const vine = JSON.parse(src.match(/const VINE_LOCALE = (\{.*?\});/)[1]);
  assert.deepEqual(vine.en, en.vine);
  assert.deepEqual(vine.zh, zh.vine);
  const star = JSON.parse(src.match(/var STAR_INVITE_LOCALE = (\{.*?\});/)[1]);
  assert.deepEqual(star.en, en.starInvite);
  assert.deepEqual(star.zh, zh.starInvite);
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
  assert.ok(source.includes('add(mainComposer())'));
  assert.ok(source.includes('add(activeRightPanel)'));
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

const starV1 = 'my-cozy-dsh:star-invite:v1';
const starV2 = 'my-cozy-dsh:star-invite:v2';
const repositoryUrl = 'https://github.com/juliiiiiiiu/my-cozy-dsh';
const hour = 3600000;
const week = 7 * 24 * hour;
const settleStar = () => new Promise(resolve => setImmediate(resolve));
const starResponse = result => ({ ok: true, json: async () => ({ result }) });

function starFixture(t, lang = 'zh-CN') {
  const dom = sceneDom(lang);
  const { window } = dom;
  const doc = window.document;
  let now = 1_800_000_000_000, tick, unmount, cardTop = 520;
  window.Date.now = () => now;
  window.setInterval = handler => { tick = handler; return 1; };
  window.clearInterval = () => {};
  doc.body.innerHTML = `<div id="root"><div class="_frame_x"><div class="_centerCol_x"><div class="_mainPanel_x"><div data-conversation-content data-content-phase="hero"><div data-composer-card><textarea></textarea></div></div></div></div></div></div>`;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.hasAttribute('data-composer-card')) return new window.DOMRect(300, cardTop, 500, 90);
    return new window.DOMRect(0, 0, 1024, 768);
  };
  const note = () => doc.querySelector('.dsh-local-star-preview');
  const button = () => note().querySelector('.dsh-star-action');
  t.after(() => { if (unmount) unmount(); window.close(); });
  return {
    window, doc, note, button,
    label: () => note().querySelector('.dsh-star-label').textContent,
    close: () => note().querySelector('.dsh-star-close').click(),
    type: () => doc.querySelector('textarea').dispatchEvent(new window.Event('input', { bubbles: true })),
    state: () => JSON.parse(window.localStorage.getItem(starV2)),
    mount: request => { if (unmount) unmount(); unmount = loadClient(dom, request); },
    advance: ms => { now += ms; tick(); },
    time: () => now,
    setCardTop: top => { cardTop = top; },
  };
}

test('first invite appears after two seconds of stability, with no first-use timestamp', t => {
  const s = starFixture(t);
  s.mount();
  assert.equal(s.state(), null);
  assert.equal(s.note().hidden, true);
  s.advance(1999);
  assert.equal(s.note().hidden, true);
  s.advance(1);
  assert.equal(s.note().hidden, false, 'opens immediately after settling, even on the hero composer');
  assert.equal(s.label(), '加一颗星');
  assert.equal(s.state(), null, 'showing the invite does not start a first-use countdown');
});

for (const outcome of ['dismissed', 'starred', 'github-starred']) {
  test(`v1 outcome ${outcome} and a 47-hour-old first-use timestamp are ignored`, t => {
    const s = starFixture(t);
    const saved = JSON.stringify({ firstUse: s.time() - 47 * hour, outcome });
    s.window.localStorage.setItem(starV1, saved);
    s.mount();
    s.advance(2000);
    assert.equal(s.note().hidden, false);
    assert.equal(s.state(), null);
    assert.equal(s.window.localStorage.getItem(starV1), saved);
  });
}

test('first dismissal hides immediately and returns after seven days; second survives remount permanently', t => {
  const s = starFixture(t);
  s.mount();
  s.advance(2000);
  const firstDismissedAt = s.time();
  s.close();
  s.close();
  assert.equal(s.note().hidden, true);
  assert.deepEqual(s.state(), { starred: false, dismissals: 1, firstDismissedAt });
  s.advance(week - hour);
  s.mount();
  s.advance(2000);
  assert.equal(s.note().hidden, true, 'still hidden at 6 days, 23 hours');
  assert.equal(s.state().firstDismissedAt, firstDismissedAt);
  s.advance(2 * hour - 2000);
  s.advance(2000);
  assert.equal(s.note().hidden, false, 'returns by 7 days, 1 hour plus settling');
  assert.equal(s.label(), '加一颗星');
  s.doc.dispatchEvent(new s.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(s.note().hidden, true);
  assert.deepEqual(s.state(), { starred: false, dismissals: 2, firstDismissedAt });
  s.advance(2 * week);
  s.mount();
  s.advance(3000);
  assert.equal(s.note().hidden, true);
});

test('dialog, global panel, low composer space and typing defer without consuming the invite', t => {
  const s = starFixture(t);
  s.setCardTop(180);
  s.mount();
  s.advance(5000);
  assert.equal(s.note().hidden, true);
  s.setCardTop(520);
  const dialog = s.doc.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  s.doc.body.append(dialog);
  s.advance(5000);
  assert.equal(s.note().hidden, true);
  dialog.remove();
  const globalPanel = s.doc.createElement('div');
  globalPanel.setAttribute('data-global-panel', '');
  s.doc.querySelector('._mainPanel_x').append(globalPanel);
  s.advance(5000);
  assert.equal(s.note().hidden, true);
  globalPanel.remove();
  s.advance(0);
  s.advance(2000);
  assert.equal(s.note().hidden, false);
  s.type();
  assert.equal(s.note().hidden, true);
  s.advance(1999);
  assert.equal(s.note().hidden, true);
  s.advance(1);
  s.advance(2000);
  assert.equal(s.note().hidden, false);
  assert.equal(s.state(), null);
});

test('only GitHub-confirmed success writes starred and confirmation waits while typing', async t => {
  const s = starFixture(t);
  let calls = 0, confirm;
  s.mount(() => { calls++; return new Promise(resolve => { confirm = resolve; }); });
  s.advance(2000);
  assert.equal(calls, 0, 'does not check authorization before clicking');
  s.button().click();
  s.button().click();
  assert.equal(calls, 1, 'pending repeated clicks cannot duplicate the request');
  s.type();
  confirm(starResponse('starred'));
  await settleStar();
  assert.equal(s.note().hidden, true, 'confirmation does not interrupt typing');
  s.advance(2000);
  s.advance(2000);
  assert.equal(s.note().hidden, false, 'confirmation returns after typing stops');
  assert.equal(s.label(), '已在 GitHub 加星');
  s.close();
  s.advance(2000);
  assert.equal(s.note().hidden, true);
  assert.equal(s.state().starred, true);
  assert.equal(s.state().dismissals, 0);
  s.mount();
  s.advance(2 * week);
  assert.equal(s.note().hidden, true);
});

test('a verified star still stops reminders if the user closes while the request is pending', async t => {
  const s = starFixture(t);
  let confirm;
  s.mount(() => new Promise(resolve => { confirm = resolve; }));
  s.advance(2000);
  s.button().click();
  s.close();
  confirm(starResponse('starred'));
  await settleStar();
  assert.equal(s.state().starred, true);
  s.advance(2 * week);
  s.advance(2000);
  assert.equal(s.note().hidden, true);
});

for (const [failure, response] of [
  ['missing gh or missing login', () => starResponse('fallback')],
  ['non-2xx from the host', () => ({ ok: false, status: 503 })],
  ['unreachable host', () => { throw new TypeError('Failed to fetch'); }],
  ['invalid response body', () => ({ ok: true, json: async () => { throw new SyntaxError(); } })],
]) {
  test(`${failure} changes the main action to the fixed GitHub link`, async t => {
    const s = starFixture(t);
    let calls = 0;
    const opens = [];
    s.window.open = (...args) => opens.push(args);
    s.mount(() => { calls++; return response(); });
    s.advance(2000);
    s.button().click();
    await settleStar();
    assert.equal(s.label(), '去 GitHub 加星');
    assert.equal(s.button().hasAttribute('aria-disabled'), false);
    assert.equal(opens.length, 0);
    s.button().click();
    assert.deepEqual(opens, [[repositoryUrl, '_blank', 'noopener,noreferrer']]);
    assert.equal(calls, 1);
    assert.equal(s.state(), null, 'opening a link does not record a GitHub star');
    s.close();
    assert.equal(s.state().starred, false);
    assert.equal(s.state().dismissals, 1);
    s.advance(week);
    s.advance(2000);
    assert.equal(s.note().hidden, false);
    assert.equal(s.label(), '加一颗星', 'the reminder offers one-click starring again');
  });
}

test('client aborts a hung POST and immediately offers the GitHub link', async t => {
  const s = starFixture(t, 'en');
  const originalSetTimeout = s.window.setTimeout;
  let fireDeadline;
  s.window.setTimeout = (handler, ms, ...args) => {
    if (ms === 16000) { fireDeadline = handler; return -1; }
    return originalSetTimeout.call(s.window, handler, ms, ...args);
  };
  s.mount(({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('fetch aborted')), { once: true });
  }));
  s.advance(2000);
  s.button().click();
  assert.equal(s.label(), 'Adding star…');
  assert.ok(fireDeadline);
  fireDeadline();
  await settleStar();
  assert.equal(s.label(), 'Go to GitHub to star');
  assert.equal(s.state(), null);
});

test('native right panel owns its stroke and does not clip fullscreen or floating content', () => {
  const literal = read('client.js').match(/const CSS = ("(?:\\.|[^"\\])*");/)[1];
  const css = JSON.parse(literal);
  assert.match(css, /\[data-sidebar-right-panel="push"\]\[data-sidebar-right-open\]::after\s*\{[^}]*pointer-events:\s*none;[^}]*border:/);
  assert.doesNotMatch(css, /\[data-dsh-col="rightbar"\]\s*\{/);
  assert.doesNotMatch(css, /\[style\*="--dsh-sidebar-width"\]/);
});

test('pets follow the visible middle composer through push, resizing, fullscreen and returning to two columns', t => {
  const dom = sceneDom('zh');
  const { window } = dom;
  const doc = window.document;
  let tick;
  Object.defineProperties(window, { innerWidth: { value: 1640 }, innerHeight: { value: 900 } });
  window.setInterval = handler => { tick = handler; return 1; };
  window.clearInterval = () => {};
  doc.body.innerHTML = `<div id="root"><div class="_frame_x">
    <div class="_sidebarCol_x" id="sidebar"></div>
    <div data-rightbar-col id="track">
      <div data-sidebar-right-session="retained" hidden><div data-sidebar-right-panel="fullscreen" data-sidebar-right-open></div></div>
      <div data-sidebar-right-panel="push" id="panel">
        <div class="_mainPanel_other"><div data-composer-card id="inspector-card"></div></div>
      </div>
    </div>
    <div class="_centerCol_x" id="center"><div class="_mainPanel_x" id="main">
      <div data-conversation-content data-content-phase="hero" hidden><div data-composer-card id="hidden-card"></div></div>
      <div data-conversation-content data-content-phase="active"><div data-composer-card id="chat-card"></div></div>
    </div></div>
  </div></div>`;
  const el = id => doc.getElementById(id);
  const panel = el('panel'), frame = doc.querySelector('._frame_x');
  const rects = { sidebar: [16, 16, 240, 868], track: [1640, 0, 0, 884],
    center: [264, 16, 1360, 868], 'chat-card': [430, 720, 730, 120],
    'inspector-card': [1250, 720, 350, 120], 'hidden-card': [300, 630, 620, 100],
    panel: [1200, 16, 424, 868], main: [264, 16, 1360, 868] };
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    return new window.DOMRect(...(rects[this.id] || [0, 0, 1640, 900]));
  };
  const unmount = loadClient(dom);
  t.after(() => { unmount(); window.close(); });
  const dog = doc.querySelector('.dsh-pets-westie');
  const head = doc.querySelector('.dsh-cathead-btn');
  doc.querySelector('.dsh-cat-btn').click();
  assert.equal(doc.body.getAttribute('data-dsh-cat'), 'collapsed');
  assert.equal(doc.body.getAttribute('data-dsh-rightpanel'), '0', 'hidden retained session is ignored');
  assert.equal(dog.style.display, '', 'the dog is visible with enough space in two columns');
  assert.equal(parseFloat(head.style.left), 1160 - 2 - 32);
  assert.equal(el('main').hasAttribute('data-dsh-main'), true);
  assert.equal(doc.querySelector('._mainPanel_other').hasAttribute('data-dsh-main'), false);

  panel.setAttribute('data-sidebar-right-open', '');
  rects.center = [264, 16, 920, 868];
  rects['chat-card'] = [400, 700, 650, 140];
  tick();
  assert.equal(doc.body.getAttribute('data-dsh-rightpanel'), '1', 'live right panel wins over zero-width track');
  assert.equal(dog.style.display, 'none', 'dog is tucked away in three columns');
  assert.equal(parseFloat(head.style.left), 1050 - 2 - 32);
  assert.equal(parseFloat(head.style.top) + 22, 702);
  assert.equal(doc.querySelector('.dsh-frame-line[data-for="rightbar"]'), null, 'no mirrored right stroke');
  assert.equal(window.getComputedStyle(doc.querySelector('.dsh-deco-shelf')).display, 'none');

  frame.setAttribute('data-dragging', '');
  rects.panel = [1060, 16, 564, 868];
  rects['chat-card'] = [336, 680, 630, 160];
  tick();
  assert.equal(parseFloat(head.style.left), 966 - 2 - 32, 'new composer right edge is used during drag');
  assert.equal(doc.querySelector('.dsh-pets').style.clipPath, 'inset(16px 580px 16px 264px)', 'clip to the live panel, not the grid track');
  assert.equal(doc.querySelector('.dsh-frame-lines').style.display, 'none');
  frame.removeAttribute('data-dragging');
  let frameTime = 100;
  window.performance.now = () => frameTime;
  window.dispatchEvent(new window.Event('resize'));
  assert.equal(doc.querySelector('.dsh-frame-lines').style.display, 'none', 'window resizing also suppresses stale mirrored strokes');
  frameTime += 101;
  tick();
  assert.equal(doc.querySelector('.dsh-frame-lines').style.display, '');
  rects['chat-card'] = [336, 680, 0, 0];
  tick();
  assert.equal(doc.body.getAttribute('data-dsh-pets'), '0', 'invalid composer never leaves stale artwork');
  rects['chat-card'] = [336, 680, 630, 160];

  panel.setAttribute('data-sidebar-right-panel', 'fullscreen');
  tick();
  assert.equal(doc.body.getAttribute('data-dsh-rightfullscreen'), '1', 'fullscreen marker is read ahead of frame state');
  assert.equal(doc.body.getAttribute('data-dsh-pets'), '0');
  panel.removeAttribute('data-sidebar-right-open');
  panel.setAttribute('data-sidebar-right-panel', 'push');
  rects.center = [264, 16, 1360, 868];
  rects['chat-card'] = [430, 720, 730, 120];
  tick();
  assert.equal(doc.body.getAttribute('data-dsh-rightpanel'), '0');
  assert.equal(doc.body.getAttribute('data-dsh-rightfullscreen'), '0');
  assert.equal(doc.body.getAttribute('data-dsh-pets'), '1');
  assert.equal(dog.style.display, '');
  assert.equal(parseFloat(head.style.left), 1160 - 2 - 32);
});
