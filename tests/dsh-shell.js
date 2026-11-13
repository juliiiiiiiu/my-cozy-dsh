/**
 * Static stand-in for the DeepSeek Harness 0.2.2 shell.
 *
 * Class fragments and data attributes match the packages the theme already
 * keys off (@deepseek-ai/dsh-client-ui-layout, -conversation, -chat,
 * -plugin-manager, -plugin-market, -sidebar, -sidebar-right):
 *   _frame / _sidebarCol / _centerCol / _rightbarCol / _mainPanel
 *   data-conversation-content, data-content-phase, data-conversation-scroll
 *   data-chat-flow, data-chat-flow-kind="assistant-step"
 *   data-composer-card, data-composer-seat, header[data-window-drag]
 *   data-global-panel, data-plugin-bar, data-side resize handles
 *   role=dialog[aria-modal=true] for Settings
 *
 * It is not the real React app: there is no session runtime, and views are
 * swapped by replacing the main panel's children.
 */
export function shellHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>DSH shell fixture</title>
  <style>
    html, body { margin: 0; height: 100%; }
    #root, ._frame_app { height: 100%; }
    ._frame_app {
      display: grid;
      grid-template-columns: var(--dsh-side, 240px) minmax(0, 1fr) var(--dsh-right, 0px);
      position: relative;
      min-height: 0;
    }
    ._sidebarCol_app, ._centerCol_app, ._rightbarCol_app { min-width: 0; min-height: 0; }
    ._centerCol_app, ._mainPanel_app, ._root_conv, ._body_conv, [data-conversation-scroll] {
      display: flex; flex-direction: column; min-height: 0; height: 100%;
    }
    ._mainPanel_app { position: relative; }
    header[data-window-drag] {
      flex: none; height: 48px; display: flex; align-items: center; gap: 12px;
      padding: 0 16px; box-sizing: border-box;
    }
    [data-conversation-scroll] { flex: 1; overflow: auto; }
    [data-chat-flow] {
      flex: 1; display: flex; flex-direction: column; min-height: 0;
      width: min(760px, calc(100% - 48px));
      margin: 12px auto; box-sizing: border-box;
    }
    [data-chat-flow-kind="user"] { flex: none; margin-bottom: 8px; }
    [data-chat-flow-kind="assistant-step"] { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .half { flex: 1; padding: 16px 18px; box-sizing: border-box; }
    .half strong { display: block; font-size: 22px; letter-spacing: 0.04em; }
    [data-composer-seat] { flex: none; padding: 8px 24px 16px; }
    [data-composer-card] { height: 72px; border-radius: 16px; display: flex; align-items: center; padding: 0 16px; }
    ._sideRoot_app { display: flex; flex-direction: column; gap: 4px; padding: 56px 10px 12px; }
    ._panelRow_app, ._sideRoot_app button { text-align: left; }
    [data-side] {
      position: absolute; top: 0; bottom: 0; width: 8px; margin-left: -4px;
      cursor: col-resize; z-index: 11; touch-action: none;
    }
    #settings[hidden], #files-body[hidden] { display: none !important; }
    #settings {
      position: fixed; inset: 0; z-index: 80; display: grid; place-items: center;
      background: rgba(45, 41, 36, 0.28);
    }
    #settings .card { width: min(560px, calc(100% - 80px)); min-height: 320px; padding: 24px; border-radius: 16px; background: #f6edd0; }
    ._rightbarCol_app { overflow: auto; }
    #files-body { padding: 16px; }
    .page { padding: 8px 24px 32px; }
    .Market_head_m, .Market_cats_m { position: sticky; background: transparent; }
  </style>
</head>
<body>
  <div id="root">
    <div class="_frame_app">
      <div class="_sidebarCol_app">
        <div data-slot="sidebar">
          <div class="_sideRoot_app">
            <button type="button" class="_panelRow_app" data-nav="chat">Chat</button>
            <button type="button" class="_panelRow_app" data-nav="hero">Home</button>
            <button type="button" class="_panelRow_app" data-nav="plugins">Plugins</button>
            <button type="button" class="_panelRow_app" data-nav="market">Plugin Market</button>
            <button type="button" class="_panelRow_app" data-nav="automation">Automation tasks</button>
            <button type="button" class="_panelRow_app" data-nav="trajectory">Trajectory</button>
            <button type="button" class="_panelRow_app" data-nav="settings">Settings</button>
            <button type="button" class="_panelRow_app" data-nav="files">Add files</button>
            <div class="_sessionRow_app" id="session-row">Notes</div>
            <div class="_footArea_app">Account</div>
          </div>
        </div>
      </div>
      <div class="_centerCol_app">
        <div class="_mainPanel_app" id="main"></div>
      </div>
      <div class="_rightbarCol_app" data-rightbar-col>
        <div id="files-body" hidden>
          <header data-window-drag="true">Files</header>
          <h2>Add files</h2>
          <ul>
            <li>notes.md</li>
            <li>cover.png</li>
            <li>src/client.js</li>
          </ul>
        </div>
      </div>
      <div class="_handle_app" data-side="sidebar"></div>
      <div class="_handle_app" data-side="rightbar"></div>
    </div>
  </div>
  <div id="settings" role="dialog" aria-modal="true" hidden>
    <div class="card">
      <h2>Settings</h2>
      <p>Appearance, keyboard shortcuts, and account.</p>
      <button type="button" id="settings-close">Close</button>
    </div>
  </div>
  <script>
    const main = document.getElementById('main');
    const frame = document.querySelector('._frame_app');
    const filesBody = document.getElementById('files-body');
    const settings = document.getElementById('settings');
    let sideW = 240;
    let rightW = 0;
    const views = {
      chat: chatView('active'),
      hero: \`<div class="_root_conv" data-phase="hero">
          <header data-window-drag="true"><span>New session</span></header>
          <div class="_body_conv" data-conversation-content data-conversation-region="chat" data-content-phase="hero">
            <div data-conversation-scroll>
              <div class="_headline_home"><div class="_titleGroup_home"><span>DeepSeek Harness</span></div></div>
              <div data-composer-seat data-conversation-region="composer"><div data-composer-card>Start a conversation</div></div>
            </div>
          </div>
        </div>\`,
      plugins: globalPage('Plugins', \`<div data-plugin-panel>
          <p>Installed plugins. My Cozy DSH is enabled.</p>
          <ul><li>my-cozy-dsh</li><li>dsh-client-ui-chat</li></ul>
        </div>\`),
      market: globalPage('Plugin Market', \`<div data-dsh-market-root data-dsh-market-plugins-tab="true">
          <div class="Market_head_m" style="position:sticky;top:0">
            <button type="button" class="Market_tab_m">Discover</button>
            <button type="button" class="Market_tab_m">Themes</button>
          </div>
          <div class="Market_stickyHead_m" style="display:contents">
            <div class="Market_cats_m" style="position:sticky;top:40px">
              <button type="button" data-chip="1">All</button>
              <button type="button" data-chip="1">Themes &amp; Appearance</button>
            </div>
          </div>
          <article class="page"><h2>Desk themes</h2><p>Browse the market. No chat transcript on this page.</p></article>
        </div>\`),
      automation: globalPage('Automation tasks', \`<div class="page"><h2>Tasks</h2><p>No conversation output on the automation page.</p><ol><li>Nightly summary</li><li>Inbox digest</li></ol></div>\`),
      trajectory: \`<div class="_root_conv" data-phase="active">
          <header data-window-drag="true"><span>Trajectory</span>
            <div role="tablist"><button type="button" role="tab">Chat</button><button type="button" role="tab" aria-selected="true">Trajectory</button></div>
          </header>
          <div class="_body_conv" data-conversation-content data-content-phase="active">
            <div data-conversation-scroll>
              <div data-chat-flow>
                <div data-chat-flow-kind="tool-call">Read notes.md</div>
                <div data-chat-flow-kind="tool-call">Searched the repo</div>
              </div>
              <div data-composer-seat><div data-composer-card>Composer</div></div>
            </div>
          </div>
        </div>\`
    };
    function chatView(phase) {
      return \`<div class="_root_conv" data-phase="\${phase}">
        <header data-window-drag="true"><span>Notes</span>
          <div role="tablist"><button type="button" role="tab">Chat</button><button type="button" role="tab">Trajectory</button></div>
        </header>
        <div class="_body_conv" data-conversation-content data-conversation-region="chat" data-content-phase="active">
          <div data-conversation-scroll>
            <div data-chat-flow id="chat-column">
              <div data-chat-flow-kind="user" data-chat-node-key="1:user">How does the desk lamp fall?</div>
              <div data-chat-flow-kind="assistant-step" data-chat-group-part="response" data-chat-node-key="2:assistant-step" data-chat-turn="1">
                <div class="half" id="upper-half"><strong>UPPER HALF</strong>The reply starts up here, away from the pool of light.</div>
                <div class="half" id="lower-half"><strong>LOWER HALF</strong>The lamp should land on this lower half of the assistant output.</div>
              </div>
            </div>
            <div data-composer-seat data-conversation-region="composer"><div data-composer-card>Message DeepSeek</div></div>
          </div>
        </div>
      </div>\`;
    }
    function globalPage(title, inner) {
      return \`<div class="page">
        <div data-plugin-bar>
          <header data-window-drag="true"><h1 class="_pageTitle_app">\${title}</h1>
            <div role="tablist"><button type="button" role="tab">Installed</button><button type="button" role="tab">Plugin Market</button></div>
          </header>
        </div>
        \${inner}
      </div>\`;
    }
    function setTracks(side, right) {
      sideW = side;
      rightW = right;
      document.documentElement.style.setProperty('--dsh-side', side + 'px');
      document.documentElement.style.setProperty('--dsh-right', right + 'px');
      filesBody.hidden = right < 40;
      const width = frame.getBoundingClientRect().width || window.innerWidth;
      document.querySelector('[data-side="sidebar"]').style.left = side + 'px';
      document.querySelector('[data-side="rightbar"]').style.left = (width - right) + 'px';
    }
    function show(name) {
      if (name === 'settings') {
        settings.hidden = false;
        return 'settings';
      }
      if (name === 'files') {
        setTracks(sideW, rightW > 40 ? 0 : 320);
        if (main.getAttribute('data-view') !== 'chat' && main.getAttribute('data-view') !== 'trajectory') show('chat');
        return rightW > 40 ? 'files-open' : 'files-closed';
      }
      settings.hidden = true;
      const global = name === 'plugins' || name === 'market' || name === 'automation';
      if (global) main.setAttribute('data-global-panel', '');
      else main.removeAttribute('data-global-panel');
      main.innerHTML = views[name];
      main.setAttribute('data-view', name);
      return name;
    }
    document.querySelectorAll('[data-nav]').forEach((button) => {
      button.addEventListener('click', () => show(button.getAttribute('data-nav')));
    });
    document.getElementById('settings-close').addEventListener('click', () => { settings.hidden = true; });
    let drag = null;
    document.querySelectorAll('[data-side]').forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        if (handle.setPointerCapture) handle.setPointerCapture(event.pointerId);
        drag = { side: handle.getAttribute('data-side'), x: event.clientX, sideW, rightW };
        frame.setAttribute('data-dragging', '');
      });
    });
    window.addEventListener('pointermove', (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.x;
      if (drag.side === 'rightbar') setTracks(drag.sideW, Math.max(160, Math.min(680, drag.rightW - dx)));
      else setTracks(Math.max(160, Math.min(460, drag.sideW + dx)), drag.rightW);
    });
    window.addEventListener('pointerup', () => { drag = null; frame.removeAttribute('data-dragging'); });
    window.addEventListener('pointercancel', () => { drag = null; frame.removeAttribute('data-dragging'); });
    window.__show = show;
    window.__setTracks = setTracks;
    window.__outputBox = function () {
      if (main.hasAttribute('data-global-panel')) return null;
      if (!settings.hidden) return null;
      const content = main.querySelector('[data-conversation-content][data-content-phase="active"]');
      if (!content) return null;
      const reply = content.querySelector('[data-chat-flow-kind="assistant-step"]:not([data-chat-group-part="reasoning"])');
      if (!reply) return null;
      const scroll = content.querySelector('[data-conversation-scroll]');
      const column = content.querySelector('[data-chat-flow]');
      const seat = content.querySelector('[data-composer-seat]');
      if (!scroll || !column || !seat) return null;
      const port = scroll.getBoundingClientRect();
      const col = column.getBoundingClientRect();
      const seatRect = seat.getBoundingClientRect();
      const bottom = Math.min(port.bottom, seatRect.top, col.bottom);
      const left = Math.max(col.left, port.left);
      const right = Math.min(col.right, port.right);
      const top = Math.max(col.top, port.top);
      if (right - left < 48 || bottom - top < 48) return null;
      return { left, top, width: right - left, height: bottom - top };
    };
    setTracks(240, 0);
    show('chat');
  </script>
</body>
</html>`;
}
