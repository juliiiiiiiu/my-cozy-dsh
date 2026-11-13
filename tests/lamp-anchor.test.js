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
  if (el.classList && el.classList.contains('dsh-deco-lamp') &&
      !el.classList.contains('dsh-lamp-beam') && !el.classList.contains('dsh-lamp-cutout')) {
    return new window.DOMRect(640, 8, 220, 152);
  }
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

function boxOf(el) {
  return {
    left: parseFloat(el.style.left),
    top: parseFloat(el.style.top),
    right: parseFloat(el.style.left) + parseFloat(el.style.width),
    bottom: parseFloat(el.style.top) + parseFloat(el.style.height),
  };
}

function contains(box, x, y) {
  return box.left <= x + 1 && x <= box.right + 1 && box.top <= y + 1 && y <= box.bottom + 1;
}

test('the shade beam continues softly to the lower half of the assistant column', () => {
  const dom = scene();
  const { window } = dom;
  window.document.body.innerHTML = chatHtml();
  let cleanup;
  try {
    cleanup = loadClient(dom);
    const beam = window.document.querySelector('.dsh-lamp-beam');
    const flow = window.document.querySelector('.dsh-lamp-flow');
    const stage = window.document.querySelector('.dsh-deco-stage');
    assert.equal(flow.getAttribute('data-pool'), 'desk');
    assert.equal(flow.getAttribute('data-mode'), 'warm');
    assert.equal(beam.getAttribute('data-pool'), null);
    assert.equal(beam.getAttribute('data-mode'), 'warm');
    assert.equal(parseFloat(beam.style.width), 502);
    assert.equal(window.getComputedStyle(stage).pointerEvents, 'none');
    assert.equal(window.getComputedStyle(flow).pointerEvents, 'none');
    assert.equal(window.getComputedStyle(beam).pointerEvents, 'none');
    const stageZ = window.getComputedStyle(stage).zIndex;
    assert.match(stageZ, /^(20|var\(--dsk-z-stage,\s*20\))$/);
    const lampScale = 220 / 502;
    const shade = { x: 640 + 365 * lampScale, y: 8 + 51 * lampScale };
    const land = { x: 360 + 360, y: 64 + 600 * 0.75 };
    let box = boxOf(flow);
    assert.equal(contains(box, shade.x, shade.y), true, JSON.stringify({ box, shade }));
    assert.equal(contains(box, land.x, land.y), true, JSON.stringify({ box, land }));
    assert.match(flow.innerHTML, /feGaussianBlur/);
    assert.match(flow.innerHTML, /stop-opacity="0.28"/);

    const column = window.document.querySelector('[data-chat-flow]');
    column.setAttribute('data-rect', '420,80,480,520');
    window.dispatchEvent(new window.Event('resize'));
    const moved = { x: 420 + 240, y: 80 + 520 * 0.75 };
    box = boxOf(flow);
    assert.equal(contains(box, moved.x, moved.y), true, JSON.stringify({ box, moved }));
    assert.equal(flow.getAttribute('data-pool'), 'desk');
    assert.equal(parseFloat(beam.style.width), 502);
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
    const flow = window.document.querySelector('.dsh-lamp-flow');
    const main = window.document.querySelector('[data-dsh-main]');
    const content = window.document.querySelector('[data-conversation-content]');

    main.setAttribute('data-global-panel', '');
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(flow.getAttribute('data-pool'), null);
    assert.equal(parseFloat(beam.style.width), 502);

    main.removeAttribute('data-global-panel');
    content.setAttribute('data-content-phase', 'hero');
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(flow.getAttribute('data-pool'), null);

    content.setAttribute('data-content-phase', 'active');
    window.document.querySelector('[data-chat-group-part="response"]').setAttribute('data-chat-group-part', 'reasoning');
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(flow.getAttribute('data-pool'), null, 'reasoning alone is not the reply surface');

    window.document.querySelector('[data-chat-flow-kind="assistant-step"]').setAttribute('data-chat-group-part', 'response');
    const dialog = window.document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    window.document.body.appendChild(dialog);
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(window.document.body.getAttribute('data-dsh-modal'), '1');
    assert.equal(flow.getAttribute('data-pool'), null);
    dialog.remove();
    window.dispatchEvent(new window.Event('resize'));
    assert.equal(flow.getAttribute('data-pool'), 'desk');
    assert.equal(window.localStorage.getItem('dsh-cozy-hanging-plant'), null);
    assert.equal(window.localStorage.getItem('dsh-desk-light-v3'), null);
    const saved = window.localStorage.getItem('dsh-desk-light-v2');
    assert.equal(saved === null || saved.includes('"mode":"warm"'), true);
  } finally {
    if (cleanup) cleanup();
    window.close();
  }
});
