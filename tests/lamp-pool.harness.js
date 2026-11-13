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

async function boot(page, mode, scriptPath = clientPath, { closedDialog = false } = {}) {
  await page.addInitScript((lightMode) => {
    localStorage.setItem('dsh-desk-light-v2', JSON.stringify({
      on: true,
      mode: lightMode,
      sizes: { warm: 130, white: 100, rainbow: 100 },
    }));
  }, mode);
  await page.goto('file://' + shellPath);
  if (closedDialog) {
    await page.evaluate(() => {
      const dialog = document.getElementById('settings');
      if (dialog) dialog.remove();
    });
  }
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
  await page.addScriptTag({ path: scriptPath });
  await page.evaluate(() => {
    window.__dshPlugin.factory().apply({ effect() {} });
  });
  await page.waitForSelector('.dsh-lamp-beam', { state: 'attached' });
  await frames(page);
}

async function readPool(page) {
  return page.evaluate(() => {
    const beam = document.querySelector('.dsh-lamp-beam');
    const flow = document.querySelector('.dsh-lamp-flow');
    const stage = document.querySelector('.dsh-deco-stage');
    const lamp = document.querySelector('.dsh-deco-lamp:not(.dsh-lamp-beam):not(.dsh-lamp-cutout)');
    const expected = window.__outputBox();
    const stageCss = getComputedStyle(stage);
    const beamCss = getComputedStyle(beam);
    const flowCss = flow ? getComputedStyle(flow) : null;
    const reading = {
      pool: flow ? flow.getAttribute('data-pool') : null,
      mode: beam.getAttribute('data-mode'),
      display: beamCss.display,
      stageDisplay: stageCss.display,
      stageZ: stageCss.zIndex,
      stagePe: stageCss.pointerEvents,
      beamPe: beamCss.pointerEvents,
      flowPe: flowCss ? flowCss.pointerEvents : null,
      width: parseFloat(beam.style.width),
      view: document.getElementById('main').getAttribute('data-view'),
      global: document.body.getAttribute('data-dsh-global'),
      modal: document.body.getAttribute('data-dsh-modal'),
      right: document.body.getAttribute('data-dsh-rightpanel'),
    };
    if (expected && reading.pool === 'desk' && flow && lamp) {
      const fr = flow.getBoundingClientRect();
      const lx = expected.left + expected.width / 2;
      const ly = expected.top + expected.height * 0.75;
      const lr = lamp.getBoundingClientRect();
      const lampScale = lr.width / 502;
      const sx = lr.left + 365 * lampScale;
      const sy = lr.top + (reading.mode === 'rainbow' ? 56 : 51) * lampScale;
      reading.coversLand = fr.left - 2 <= lx && lx <= fr.right + 2 && fr.top - 2 <= ly && ly <= fr.bottom + 2;
      reading.coversShade = fr.left - 8 <= sx && sx <= fr.right + 8 && fr.top - 8 <= sy && sy <= fr.bottom + 8;
      reading.errX = 0;
      reading.errY = 0;
      const center = document.querySelector('[data-dsh-col="center"]').getBoundingClientRect();
      const rightbar = document.querySelector('[data-dsh-col="rightbar"]').getBoundingClientRect();
      reading.insideCenter = lx > center.left + 4 && lx < center.right - 4;
      reading.overlapsRight = rightbar.width > 40 && fr.right > rightbar.left + 2;
      const lower = document.getElementById('lower-half');
      if (lower) {
        const box = lower.getBoundingClientRect();
        reading.lowerHit = ly >= box.top - 16 && ly <= box.bottom + 16;
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
  assert.equal(reading.flowPe, 'none', detail);
  assert.equal(reading.stageZ, '20', detail);
  assert.ok(Math.abs(reading.width - 502) < 1, detail);
  assert.equal(reading.coversLand, true, detail);
  assert.equal(reading.coversShade, true, detail);
  assert.equal(reading.insideCenter, true, detail);
  assert.notEqual(reading.overlapsRight, true, detail);
  if (reading.lowerHit !== undefined) assert.equal(reading.lowerHit, true, detail);
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
    const flow = document.querySelector('.dsh-lamp-flow');
    if (!beam) return false;
    const pool = flow ? flow.getAttribute('data-pool') : null;
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
      assert.equal(reading.coversLand, true, 'wide window still lands in the transcript');
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

    fs.writeFileSync('/tmp/client-1.0.5.js', execFileSync('git', ['show', 'c90eaaa:client.js'], { cwd: root, maxBuffer: 8 * 1024 * 1024 }));
    for (const mode of modes) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await boot(page, mode, '/tmp/client-1.0.5.js', { closedDialog: true });
      await frames(page, 3);
      await page.screenshot({ path: path.join(outDir, `lamp_before_${mode}_chat.png`) });
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
    for (const mode of modes) {
      const comparePath = `/tmp/dsh-compare-${mode}.html`;
      fs.writeFileSync(comparePath, `<!doctype html><meta charset="utf-8"><style>
        body { margin: 0; background: #241f18; color: #f6edd0; font: 15px sans-serif; }
        .row { display: flex; gap: 12px; padding: 12px; }
        figure { margin: 0; }
        img { width: 560px; height: auto; background: #fff; }
        figcaption { margin: 0 0 6px; }
      </style><div class="row">
        <figure><figcaption>1.0.5 ${mode}</figcaption><img src="file://${path.join(outDir, `lamp_before_${mode}_chat.png`)}"></figure>
        <figure><figcaption>1.0.6 ${mode}</figcaption><img src="file://${path.join(outDir, `lamp_${mode}_chat.png`)}"></figure>
      </div>`);
      await page.setViewportSize({ width: 1180, height: 760 });
      await page.goto('file://' + comparePath);
      await page.screenshot({ path: path.join(outDir, `lamp_compare_${mode}.png`), fullPage: true });
    }
  } finally {
    await browser2.close();
  }

  for (const mode of modes) {
    const webm = path.join(outDir, `lamp_drag_${mode}.webm`);
    const gif = path.join(outDir, `lamp_drag_${mode}.gif`);
    execFileSync('ffmpeg', ['-y', '-i', webm, '-vf', 'fps=10,scale=720:-1:flags=lanczos', gif], { stdio: 'ignore' });
  }
});
