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

function rectFor(el, window) {
  if (el.classList && el.classList.contains('dsh-deco-stage')) return new window.DOMRect(0, 0, 1200, 800);
  const raw = el.getAttribute && el.getAttribute('data-rect');
  if (raw) {
    const [x, y, w, h] = raw.split(',').map(Number);
    return new window.DOMRect(x, y, w, h);
  }
  return new window.DOMRect(0, 0, 0, 0);
}

function scene() {
  const dom = new JSDOM('<!doctype html><html lang="en"><head></head><body></body></html>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
    runScripts: 'dangerously',
  });
  const { window } = dom;
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    return rectFor(this, window);
  };
  return dom;
}

function loadClient(dom) {
  let plugin;
  dom.window.__ModuleLoader__ = { load(def) { plugin = def; } };
  vm.runInContext(read('client.js'), dom.getInternalVMContext());
  let cleanup;
  plugin.factory().apply({ effect(fn) { cleanup = fn; } });
  return () => cleanup();
}

function chatHtml() {
  return `
    <div id="root">
      <div class="_frame_app" data-rect="0,0,1200,800">
        <div class="_sidebarCol_app" data-rect="0,0,240,800">
          <div data-slot="sidebar"><div class="_sideRoot_app" data-rect="0,16,240,784"></div></div>
        </div>
        <div class="_centerCol_app" data-rect="240,0,960,800">
          <div class="_mainPanel_app" data-rect="240,0,960,800">
            <header data-window-drag="true" data-rect="240,0,960,48"></header>
            <div class="_body_conv" data-conversation-content data-content-phase="active" data-rect="240,48,960,752">
              <div data-conversation-scroll data-rect="240,48,960,752">
                <div data-chat-flow data-rect="360,64,720,600">
                  <div data-chat-flow-kind="user" data-rect="360,64,720,40"></div>
                  <div data-chat-flow-kind="assistant-step" data-chat-group-part="response" data-rect="360,112,720,552"></div>
                </div>
                <div data-composer-seat data-rect="280,680,880,100">
                  <div data-composer-card data-rect="300,692,840,76"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="_rightbarCol_app" data-rect="1200,0,0,800"></div>
      </div>
    </div>`;
}

test('desk pool centers on the lower half of the assistant column', () => {
  const dom = scene();
  const { window } = dom;
  window.document.body.innerHTML = chatHtml();
  let cleanup;
  try {
    cleanup = loadClient(dom);
    const beam = window.document.querySelector('.dsh-lamp-beam');
    const stage = window.document.querySelector('.dsh-deco-stage');
    assert.equal(beam.getAttribute('data-pool'), 'desk');
    assert.equal(beam.getAttribute('data-mode'), 'warm');
    assert.equal(beam.style.transformOrigin, '50% 75%');
    assert.equal(window.getComputedStyle(stage).pointerEvents, 'none');
    assert.equal(window.getComputedStyle(beam).pointerEvents, 'none');
    const stageZ = window.getComputedStyle(stage).zIndex;
    assert.match(stageZ, /^(20|var\(--dsk-z-stage,\s*20\))$/);
    // Column 360,64 720x600 clipped to the scrollport above the composer (top 680).
    assert.equal(parseFloat(beam.style.left), 360);
    assert.equal(parseFloat(beam.style.top), 64);
    assert.equal(parseFloat(beam.style.width), 720);
    assert.equal(parseFloat(beam.style.height), 600);
    const theme = window.document.getElementById('dsh-desk-scene').textContent;
    assert.match(theme, /radial-gradient\(ellipse var\(--dsh-pool-rx, 48%\)/);
    assert.equal(beam.style.getPropertyValue('--dsh-pool-rx'), '62.40%');
    assert.equal(beam.style.getPropertyValue('--dsh-pool-ry'), '31.20%');
    assert.equal(window.getComputedStyle(beam).transform, 'none');

    const column = window.document.querySelector('[data-chat-flow]');
    column.setAttribute('data-rect', '420,80,480,520');
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(parseFloat(beam.style.left), 420);
    assert.equal(parseFloat(beam.style.top), 80);
    assert.equal(parseFloat(beam.style.width), 480);
    assert.equal(parseFloat(beam.style.height), 520);
    assert.equal(beam.getAttribute('data-pool'), 'desk');
  } finally {
    if (cleanup) cleanup();
    window.close();
  }
});

test('plugins, hero, and a missing reply fall back to the shade beam', () => {
  const dom = scene();
  const { window } = dom;
  window.document.body.innerHTML = chatHtml();
  let cleanup;
  try {
    cleanup = loadClient(dom);
    const beam = window.document.querySelector('.dsh-lamp-beam');
    const main = window.document.querySelector('[data-dsh-main]');
    const content = window.document.querySelector('[data-conversation-content]');

    main.setAttribute('data-global-panel', '');
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(beam.getAttribute('data-pool'), null);
    assert.equal(beam.style.width, '502px');

    main.removeAttribute('data-global-panel');
    content.setAttribute('data-content-phase', 'hero');
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(beam.getAttribute('data-pool'), null);

    content.setAttribute('data-content-phase', 'active');
    window.document.querySelector('[data-chat-group-part="response"]').setAttribute('data-chat-group-part', 'reasoning');
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(beam.getAttribute('data-pool'), null, 'reasoning alone is not the reply surface');

    window.document.querySelector('[data-chat-flow-kind="assistant-step"]').setAttribute('data-chat-group-part', 'response');
    const dialog = window.document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    window.document.body.appendChild(dialog);
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(window.document.body.getAttribute('data-dsh-modal'), '1');
    assert.equal(beam.getAttribute('data-pool'), null);
    dialog.remove();
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(beam.getAttribute('data-pool'), 'desk');
    assert.equal(window.localStorage.getItem('dsh-cozy-hanging-plant'), null);
    assert.equal(window.localStorage.getItem('dsh-desk-light-v3'), null);
    const saved = window.localStorage.getItem('dsh-desk-light-v2');
    assert.equal(saved === null || saved.includes('"mode":"warm"'), true);
  } finally {
    if (cleanup) cleanup();
    window.close();
  }
});
