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

function loadClient(dom) {
  let plugin;
  const { window } = dom;
  window.__ModuleLoader__ = { load(def) { plugin = def; } };
  vm.runInContext(read('client.js'), dom.getInternalVMContext());
  assert.ok(plugin, 'client bundle registered');
  let cleanup;
  plugin.factory().apply({ effect(fn) { cleanup = fn; } });
  return () => cleanup();
}

test('version is 1.0.5 and vine copy matches the locale files', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.version, '1.0.5');
  const en = JSON.parse(read('locale/en.json'));
  const zh = JSON.parse(read('locale/zh.json'));
  const src = read('client.js');
  const vine = JSON.parse(src.match(/const VINE_LOCALE = (\{.*?\});/)[1]);
  assert.deepEqual(vine.en, en.vine);
  assert.deepEqual(vine.zh, zh.vine);
  assert.match(src, /dsh-cozy-hanging-plant/);
  assert.match(src, /dsh-desk-light-v2/);
  assert.doesNotMatch(src, /dsh-desk-light-v3/);
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
