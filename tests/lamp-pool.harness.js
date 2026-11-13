/**
 * Headless Chromium harness for the desk-lamp pool.
 *
 * Loads the built client.js into a static shell whose DOM matches the
 * DeepSeek Harness 0.2.2 client packages (layout, conversation, chat,
 * plugin manager, plugin market, and the right-hand file panel). It is
 * not the real React app: views are swapped in place, and the resize
 * handles update the same grid tracks AppFrame would. What it does check
 * is the theme's own layout code against those selectors, including
 * pointer drags and route changes.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { shellHtml } from './dsh-shell.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.env.LAMP_OUT || '/opt/cursor/artifacts';
const shellPath = '/tmp/dsh-lamp-shell.html';
const clientPath = path.join(root, 'client.js');
const modes = ['warm', 'white', 'rainbow'];
const shots = [];

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(shellPath, shellHtml());

function frames(page, count = 2) {
  return page.evaluate(async (n) => {
    for (let i = 0; i < n; i += 1) {
      await new Promise((resolve) => { requestAnimationFrame(() => resolve()); });
    }
  }, count);
}

async function boot(page, mode) {
  await page.addInitScript((lightMode) => {
    localStorage.setItem('dsh-desk-light-v2', JSON.stringify({
      on: true,
      mode: lightMode,
      sizes: { warm: 130, white: 100, rainbow: 100 },
    }));
  }, mode);
  await page.goto('file://' + shellPath);
  await page.addStyleTag({
    content: `
      [data-chat-flow] { background: rgba(228, 210, 164, 0.78) !important; border-radius: 18px; }
      #upper-half, #lower-half { color: #333824; }
      ._sideRoot_app button { color: #333824; background: rgba(246, 237, 208, 0.88); border: 0; border-radius: 8px; padding: 8px 10px; font: 14px sans-serif; }
      #files-body, .page, #settings .card { color: #333824; }
    `,
  });
  await page.evaluate(() => {
    window.__ModuleLoader__ = { load(def) { window.__dshPlugin = def; } };
  });
  await page.addScriptTag({ path: clientPath });
  await page.evaluate(() => {
    window.__dshPlugin.factory().apply({ effect() {} });
  });
  await page.waitForSelector('.dsh-lamp-beam');
  await frames(page);
}

async function readPool(page) {
  return page.evaluate(() => {
    const beam = document.querySelector('.dsh-lamp-beam');
    const stage = document.querySelector('.dsh-deco-stage');
    const expected = window.__outputBox();
    const sr = stage.getBoundingClientRect();
    const left = parseFloat(beam.style.left);
    const top = parseFloat(beam.style.top);
    const width = parseFloat(beam.style.width);
    const height = parseFloat(beam.style.height);
    const stageCss = getComputedStyle(stage);
    const beamCss = getComputedStyle(beam);
    const before = getComputedStyle(beam, '::before');
    const reading = {
      pool: beam.getAttribute('data-pool'),
      mode: beam.getAttribute('data-mode'),
      display: beamCss.display,
      stageDisplay: stageCss.display,
      stageZ: stageCss.zIndex,
      stagePe: stageCss.pointerEvents,
      beamPe: beamCss.pointerEvents,
      width, height,
      bg: beamCss.backgroundImage.slice(0, 160),
      beforeBg: before.backgroundImage.slice(0, 120),
      view: document.getElementById('main').getAttribute('data-view'),
      global: document.body.getAttribute('data-dsh-global'),
      modal: document.body.getAttribute('data-dsh-modal'),
      right: document.body.getAttribute('data-dsh-rightpanel'),
    };
    if (expected && reading.pool === 'desk') {
      const cx = sr.left + left + width / 2;
      const cy = sr.top + top + height * 0.75;
      reading.errX = cx - (expected.left + expected.width / 2);
      reading.errY = cy - (expected.top + expected.height * 0.75);
      reading.errW = width - expected.width;
      reading.errH = height - expected.height;
      const center = document.querySelector('[data-dsh-col="center"]').getBoundingClientRect();
      const rightbar = document.querySelector('[data-dsh-col="rightbar"]').getBoundingClientRect();
      reading.insideCenter = cx > center.left + 4 && cx < center.right - 4;
      reading.overlapsRight = rightbar.width > 40 && cx > rightbar.left + 4;
      const lower = document.getElementById('lower-half');
      const upper = document.getElementById('upper-half');
      if (lower && upper) {
        const lr = lower.getBoundingClientRect();
        const ur = upper.getBoundingClientRect();
        reading.lowerHit = cy >= lr.top - 16 && cy <= lr.bottom + 16;
        reading.upperClear = (ur.top + ur.height / 2) < cy - expected.height * 0.1;
      }
    }
    return reading;
  });
}

function assertDesk(reading, label) {
  const detail = label + ' ' + JSON.stringify(reading);
  assert.equal(reading.pool, 'desk', detail);
  assert.equal(reading.stagePe, 'none', detail);
  assert.equal(reading.beamPe, 'none', detail);
  assert.equal(reading.stageZ, '20', detail);
  assert.ok(Math.abs(reading.errX) < 4, detail);
  assert.ok(Math.abs(reading.errY) < 4, detail);
  assert.ok(Math.abs(reading.errW) < 4, detail);
  assert.ok(Math.abs(reading.errH) < 4, detail);
  assert.equal(reading.insideCenter, true, detail);
  assert.notEqual(reading.overlapsRight, true, detail);
  if (reading.lowerHit !== undefined) assert.equal(reading.lowerHit, true, detail);
  if (reading.upperClear !== undefined) assert.equal(reading.upperClear, true, detail);
  if (reading.mode === 'rainbow') assert.match(reading.beforeBg, /gradient|rgb|color/i, detail);
  else assert.match(reading.bg, /radial-gradient/, detail);
}

function assertFallback(reading, label) {
  const detail = label + ' ' + JSON.stringify(reading);
  assert.notEqual(reading.pool, 'desk', detail);
  assert.ok(Math.abs(reading.width - 502) < 1, detail);
  assert.equal(reading.stagePe, 'none', detail);
  assert.equal(reading.beamPe, 'none', detail);
}

async function shot(page, mode, name) {
  const file = path.join(outDir, `lamp_${mode}_${name}.png`);
  await page.screenshot({ path: file });
  shots.push({ mode, name, file });
  return file;
}

async function clickNav(page, name) {
  await page.locator(`[data-nav="${name}"]`).click();
  await frames(page);
}

async function waitKind(page, desk) {
  await page.waitForFunction((want) => {
    const beam = document.querySelector('.dsh-lamp-beam');
    if (!beam) return false;
    const pool = beam.getAttribute('data-pool');
    const stageHidden = getComputedStyle(document.querySelector('.dsh-deco-stage')).display === 'none';
    if (want === 'hidden') return stageHidden;
    return want ? pool === 'desk' : pool !== 'desk';
  }, desk, { timeout: 4000 });
  await frames(page);
}

async function dragRight(page, deltas, { steps = 1 } = {}) {
  await page.evaluate(() => window.__setTracks(220, 200));
  await frames(page);
  const handle = page.locator('[data-side="rightbar"]');
  const box = await handle.boundingBox();
  assert.ok(box, 'right resize handle has a box');
  const samples = [];
  await page.mouse.move(box.x + box.width / 2, box.y + 120);
  await page.mouse.down();
  for (const dx of deltas) {
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + 120, { steps });
    await frames(page);
    const reading = await readPool(page);
    reading.dx = dx;
    samples.push(reading);
    assertDesk(reading, 'drag dx ' + dx);
  }
  await page.mouse.up();
  await frames(page);
  return samples;
}

test('lamp pool follows chat output across pages, drags, and the file panel', { timeout: 240000 }, async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    for (const mode of modes) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await boot(page, mode);
      await waitKind(page, true);
      let reading = await readPool(page);
      assert.equal(reading.mode, mode);
      assertDesk(reading, mode + ' chat');
      await shot(page, mode, 'chat');

      const fallbacks = [
        ['hero', 'hero'],
        ['plugins', 'plugins'],
        ['market', 'market'],
        ['automation', 'automation'],
        ['trajectory', 'trajectory'],
      ];
      for (const [nav, name] of fallbacks) {
        await clickNav(page, nav);
        await waitKind(page, false);
        reading = await readPool(page);
        assertFallback(reading, mode + ' ' + name);
        assert.equal(reading.mode, mode);
        if (mode === 'warm' && name === 'market') {
          const sticky = await page.locator('[data-dsh-sticky-bar]').count();
          assert.ok(sticky >= 1, 'market sticky bars still get the paper background');
        }
        await shot(page, mode, name);
      }

      await clickNav(page, 'chat');
      await waitKind(page, true);
      assertDesk(await readPool(page), mode + ' chat restored');

      await clickNav(page, 'settings');
      await waitKind(page, 'hidden');
      reading = await readPool(page);
      assert.equal(reading.stageDisplay, 'none', JSON.stringify(reading));
      assert.equal(reading.modal, '1');
      await shot(page, mode, 'settings');
      await page.locator('#settings-close').click();
      await waitKind(page, true);
      assertDesk(await readPool(page), mode + ' settings closed');

      await clickNav(page, 'files');
      await waitKind(page, true);
      reading = await readPool(page);
      assert.equal(reading.right, '1');
      assertDesk(reading, mode + ' files open');
      await shot(page, mode, 'files_open');

      const samples = await dragRight(page, [-40, -120, -220, -120, 0, 80]);
      const moved = samples.map((sample) => sample.errX);
      assert.ok(moved.every((err) => Math.abs(err) < 4));
      fs.writeFileSync(path.join(outDir, `lamp_drag_${mode}_samples.json`), JSON.stringify(samples, null, 2));
      await page.evaluate(() => window.__setTracks(220, 180));
      await frames(page);
      await shot(page, mode, 'drag_narrow');
      await page.evaluate(() => window.__setTracks(220, 360));
      await frames(page);
      assertDesk(await readPool(page), mode + ' drag mid');
      await shot(page, mode, 'drag_mid');
      await page.evaluate(() => window.__setTracks(220, 560));
      await frames(page);
      assertDesk(await readPool(page), mode + ' drag wide panel');
      await shot(page, mode, 'drag_wide');

      await clickNav(page, 'files');
      await waitKind(page, true);
      reading = await readPool(page);
      assert.equal(reading.right, '0');
      assertDesk(reading, mode + ' files closed');
      await shot(page, mode, 'files_closed');

      await page.setViewportSize({ width: 860, height: 720 });
      await frames(page, 3);
      await waitKind(page, true);
      assertDesk(await readPool(page), mode + ' window narrow');
      await shot(page, mode, 'window_narrow');

      await page.setViewportSize({ width: 1680, height: 900 });
      await frames(page, 3);
      assertDesk(await readPool(page), mode + ' window wide');
      reading = await readPool(page);
      assert.ok(reading.width < 900, 'wide window keeps the pool on the transcript column ' + reading.width);
      await shot(page, mode, 'window_wide');

      await page.setViewportSize({ width: 1280, height: 800 });
      await page.evaluate(() => window.__setTracks(200, 640));
      await frames(page, 3);
      reading = await readPool(page);
      assert.equal(reading.right, '1');
      assertDesk(reading, mode + ' panel narrow');
      await shot(page, mode, 'panel_narrow');

      await page.evaluate(() => window.__setTracks(200, 0));
      await page.setViewportSize({ width: 1600, height: 800 });
      await frames(page, 3);
      assertDesk(await readPool(page), mode + ' panel wide');
      await shot(page, mode, 'panel_wide');

      if (mode === 'warm') {
        await page.evaluate(() => document.getElementById('session-row').remove());
        await page.waitForFunction(() => document.body.getAttribute('data-dsh-tree') === '1');
        await page.evaluate(() => document.querySelector('.dsh-vine-close').click());
        assert.equal(await page.evaluate(() => localStorage.getItem('dsh-cozy-hanging-plant')), 'collapsed');
        await page.evaluate(() => document.querySelector('.dsh-vine-show').click());
        assert.equal(await page.evaluate(() => localStorage.getItem('dsh-cozy-hanging-plant')), 'open');
        assert.equal(await page.evaluate(() => localStorage.getItem('dsh-desk-light-v3')), null);
      }
      await context.close();
    }

    for (const mode of modes) {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        recordVideo: { dir: outDir, size: { width: 1280, height: 800 } },
      });
      const page = await context.newPage();
      await boot(page, mode);
      await page.evaluate(() => { window.__show('chat'); window.__setTracks(220, 200); });
      await waitKind(page, true);
      await dragRight(page, [-30, -90, -160, -230, -160, -80, 0, 70], { steps: 6 });
      const video = page.video();
      await page.close();
      const dest = path.join(outDir, `lamp_drag_${mode}.webm`);
      await video.saveAs(dest);
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const names = [...new Set(shots.map((shot) => shot.name))];
  const cells = names.map((name) => {
    const imgs = modes.map((mode) => {
      const found = shots.find((shot) => shot.mode === mode && shot.name === name);
      const src = found ? 'file://' + found.file : '';
      return `<img alt="${mode} ${name}" src="${src}">`;
    }).join('');
    return `<div class="label">${name.replaceAll('_', ' ')}</div>${imgs}`;
  }).join('');
  const sheetHtml = `<!doctype html><html><head><style>
    body { margin: 0; background: #241f18; color: #f6edd0; font: 16px/1.3 sans-serif; }
    h1 { margin: 16px; font-size: 22px; }
    .grid { display: grid; grid-template-columns: 150px repeat(3, 320px); gap: 10px; padding: 12px; align-items: start; }
    .head { font-weight: 700; text-align: center; }
    img { width: 320px; height: auto; background: #fff; border-radius: 6px; }
    .label { padding-top: 8px; }
  </style></head><body>
    <h1>Desk lamp pool — modes across DSH layouts</h1>
    <div class="grid"><div></div><div class="head">Warm</div><div class="head">White</div><div class="head">Rainbow</div>${cells}</div>
  </body></html>`;
  const sheetPath = '/tmp/dsh-lamp-sheet.html';
  fs.writeFileSync(sheetPath, sheetHtml);
  const browser2 = await chromium.launch({
    executablePath: '/usr/local/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser2.newPage({ viewport: { width: 1180, height: 900 } });
    await page.goto('file://' + sheetPath);
    await page.screenshot({ path: path.join(outDir, 'lamp_contact_sheet.png'), fullPage: true });
  } finally {
    await browser2.close();
  }

  for (const mode of modes) {
    const webm = path.join(outDir, `lamp_drag_${mode}.webm`);
    const gif = path.join(outDir, `lamp_drag_${mode}.gif`);
    execFileSync('ffmpeg', ['-y', '-i', webm, '-vf', 'fps=10,scale=720:-1:flags=lanczos', gif], { stdio: 'ignore' });
  }
});
