// tmux-mocks.jsx — tmux 化 workspace：共用元件 + 三個整體版面
// 命名全部加 Tx 前綴避免與其他 mock 衝突

/* ---------- 共用 ---------- */
function TxTabBar({ tabs, activeIdx = 0 }) {
  return (
    <div className="tx-tabbar">
      <div className="cq-logo" style={{ marginRight: 10 }}><span className="cq-logo-mark">⚔</span>Code Quest</div>
      {tabs.map((t, i) => (
        <span key={t.label} className={'tx-tab' + (i === activeIdx ? ' active' : '')}>
          <span className="no">{i + 1}</span>
          {t.busy && <span className="busy"></span>}
          <span>{t.label}</span>
          <span className="x">×</span>
        </span>
      ))}
      <span className="tx-tab" style={{ color: 'var(--text-subtle)' }}>＋</span>
      <div className="cq-topbar-actions">
        <span className="cq-kbd">⌘K</span>
        <span>⚙</span>
      </div>
    </div>
  );
}

function TxStatus() {
  return (
    <div className="cq-statusline">
      <span className="seg" style={{ color: 'var(--accent-strong)', fontWeight: 600 }}>code-quest</span>
      <span className="seg mono">⎇ feat/discuss-layout</span>
      <span className="right">
        <span className="seg kbd-hint"><b>⌘K</b> picker</span>
        <span className="seg kbd-hint"><b>⌘D</b> 垂直分割</span>
        <span className="seg kbd-hint"><b>⌘⇧D</b> 水平分割</span>
        <span className="seg kbd-hint"><b>⌘⇧Z</b> zoom</span>
        <span className="seg"><span className="busy-dot"></span>1 busy</span>
      </span>
    </div>
  );
}

function TxPaneHead({ no, icon, title, meta, group, zoomed }) {
  return (
    <div className="cq-pane-head">
      <span className="cq-pane-no">{no}</span>
      <span>{icon}</span>
      <span className="ttl">{title}</span>
      {meta && <span className="mono" style={{ fontSize: 10, color: 'var(--text-subtle)' }}>{meta}</span>}
      {zoomed && <span style={{ color: 'var(--accent)' }}>⤢</span>}
      <span className="acts"><span title="垂直分割">◫</span><span title="水平分割">⬓</span><span title="zoom">⤢</span><span>×</span></span>
    </div>
  );
}

function TxToolRow({ icon, name, detail, right }) {
  return (
    <div className="cq-tool">
      <span>{icon}</span><span className="tname">{name}</span><span>{detail}</span>{right}
    </div>
  );
}

function TxChatBody({ short }) {
  return (
    <div className="cq-msgs" style={{ padding: '14px 0 4px', gap: 12 }}>
      <div className="cq-msg">
        <div className="cq-user">把 drawer 改成可以釘選成獨立 pane</div>
      </div>
      <div className="cq-msg cq-assistant">
        <div className="cq-think"><span className="spark">✦</span><span>思考了 8 秒</span><span>›</span></div>
        <p>好，我先看 drawer 目前的實作，再加「釘選」動作。</p>
        <TxToolRow icon="◇" name="Read" detail="DrawerHost.tsx · 96 行" right={<span className="ok">✓</span>} />
        <TxToolRow icon="✎" name="Edit" detail="DrawerHost.tsx" right={<span className="diffstat"><span className="add">+32</span> <span className="del">−6</span></span>} />
        {!short && <p>釘選後 drawer 內容會轉成 pane tree 的新 leaf，沿用同一個 content descriptor。</p>}
        {!short && <TxToolRow icon="❯" name="Bash" detail="pnpm test --filter web" right={<span className="ok">18 passed ✓</span>} />}
      </div>
    </div>
  );
}

function TxComposer() {
  return (
    <div className="cq-composer-wrap" style={{ padding: '6px 14px 10px' }}>
      <div className="cq-composer mode-normal">
        <div className="cq-input"><span className="caret">▌</span> 想做什麼？</div>
        <div className="cq-toolbar">
          <span className="cq-mode-pill">● 一般模式</span>
          <span className="spacer"></span>
          <span className="model">claude-sonnet-4-5</span>
          <span className="cq-ring"></span>
          <span className="cq-send">↑</span>
        </div>
      </div>
    </div>
  );
}

function TxFilesBody({ rows = 6 }) {
  const data = [
    ['M', 'DrawerHost.tsx', '+32'], ['M', 'Pane.tsx', '+8'], ['A', 'PinAction.tsx', '+41'],
    ['M', 'TabContext.tsx', '+12'], ['M', 'Pane.test.tsx', '+25'], ['M', 'PanePicker.tsx', '+6'],
  ].slice(0, rows);
  return (
    <div style={{ padding: '6px 0' }}>
      {data.map(([b, f, s]) => (
        <div className="cq-file-row" key={f}>
          <span className={'badge ' + b}>{b}</span><span>{f}</span>
          <span className="stat" style={{ color: 'var(--success)' }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function TxDiffBody() {
  const L = (cls, txt) => <div className={'cq-diff-line ' + cls}>{txt}</div>;
  return (
    <div className="cq-diff">
      {L('hunk', '@@ -41,6 +41,14 @@ export function DrawerHost({')}
      {L('', '   const { content, onClose } = props;')}
      {L('add', '+  const { pinToPane } = usePaneActions();')}
      {L('add', '+  const handlePin = () => {')}
      {L('add', '+    pinToPane(focusedPaneId, content.descriptor);')}
      {L('add', '+    onClose();')}
      {L('add', '+  };')}
      {L('del', '-  return <aside className="drawer">')}
      {L('add', '+  return <aside className="drawer" data-pinnable>')}
    </div>
  );
}

function TxSpecBody() {
  return (
    <div style={{ padding: '8px 4px' }}>
      <div className="cq-spec-row">
        <div className="name">pin-drawer-pane <span className="cq-tag">進行中</span></div>
        <div className="tasks">任務 2 / 5</div>
        <div className="bar"><i style={{ width: '40%' }}></i></div>
      </div>
      <div className="cq-spec-row">
        <div className="name">session-rail</div>
        <div className="tasks">任務 8 / 8 · 待封存</div>
        <div className="bar"><i style={{ width: '100%' }}></i></div>
      </div>
    </div>
  );
}

function TxTermBody() {
  return (
    <div className="tx-term">
      <div><span className="ps">❯</span> <span className="cmd">pnpm dev</span></div>
      <div className="dim">VITE v6.0.3  ready in 412 ms</div>
      <div>➜  Local:   http://localhost:5173/</div>
      <div><span className="ps">❯</span> <span className="cmd">git status -sb</span></div>
      <div className="dim">## feat/discuss-layout...origin/feat/discuss-layout</div>
      <div> M apps/web/src/components/workspace/Pane.tsx</div>
      <div><span className="ps">❯</span> <span className="cmd">▌</span></div>
    </div>
  );
}

function TxNote({ text, style, pt = 'b' }) {
  return <div className={'tx-note pt-' + pt} style={style}>{text}</div>;
}

const TX_TABS = [
  { label: 'drawer 釘選', busy: true },
  { label: '佈局討論' },
  { label: 'e2e 排查' },
];

/* ---------- 版面 A：全分割（附帶工具＝真 pane，同色繫帶） ---------- */
function TxLayoutA() {
  return (
    <div className="cq theme-clay-dark" style={{ position: 'relative' }}>
      <TxTabBar tabs={TX_TABS} />
      <div className="cq-panes">
        <div className="cq-pane focused tx-group-a" style={{ flex: 13 }}>
          <TxPaneHead no="1" icon="✦" title="drawer 釘選" meta="⎇ feat/discuss-layout" />
          <div className="cq-pane-body">
            <TxChatBody />
            <TxComposer />
          </div>
        </div>
        <div className="cq-col" style={{ flex: 7 }}>
          <div className="cq-pane tx-group-a" style={{ flex: 4 }}>
            <TxPaneHead no="2" icon="▤" title="files" meta="6 變更" />
            <div className="cq-pane-body"><TxFilesBody /></div>
          </div>
          <div className="cq-pane tx-group-a" style={{ flex: 5 }}>
            <TxPaneHead no="3" icon="±" title="git · DrawerHost.tsx" />
            <div className="cq-pane-body"><TxDiffBody /></div>
          </div>
          <div className="cq-pane tx-group-a" style={{ flex: 4 }}>
            <TxPaneHead no="4" icon="◈" title="openspec" meta="2 changes" />
            <div className="cq-pane-body"><TxSpecBody /></div>
          </div>
        </div>
      </div>
      <TxStatus />
      <TxNote text="chat 附帶的 files / git / openspec＝真正的 pane，左側同色繫帶標示群組" style={{ right: 24, top: 50 }} pt="b" />
      <TxNote text="session bar 移除：tab = pane tree，busy 燈在 tab 上" style={{ left: 210, top: 6 }} pt="b" />
      <TxNote text="每條分隔線都可拖曳調整大小" style={{ left: '58%', bottom: 120 }} pt="t" />
    </div>
  );
}

/* ---------- 版面 B：chat 內建側欄（附帶工具收進 chat pane） ---------- */
function TxRailSide({ active }) {
  return (
    <div className="tx-rail-side">
      <div className="tx-rail-tabs">
        <span className={'tx-rail-tab' + (active === 'files' ? ' active' : '')}>▤<span className="cnt">files · 6</span></span>
        <span className={'tx-rail-tab' + (active === 'git' ? ' active' : '')}>±<span className="cnt">git · +118</span></span>
        <span className={'tx-rail-tab' + (active === 'spec' ? ' active' : '')}>◈<span className="cnt">spec · 2</span></span>
        <span className="tx-rail-collapse" title="收合">⇥</span>
      </div>
      {active === 'files' && <TxFilesBody rows={5} />}
      {active === 'git' && <TxDiffBody />}
      {active === 'spec' && <TxSpecBody />}
      <div style={{ marginTop: 'auto', padding: '8px 10px', fontSize: 10, color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)' }}>
        ⤢ 點項目開 drawer　⌘⏎ 升級成 pane
      </div>
    </div>
  );
}

function TxLayoutB() {
  return (
    <div className="cq theme-clay-dark" style={{ position: 'relative' }}>
      <TxTabBar tabs={TX_TABS} />
      <div className="cq-panes">
        <div className="cq-pane focused" style={{ flex: 1 }}>
          <TxPaneHead no="1" icon="✦" title="drawer 釘選" meta="⎇ feat/discuss-layout" />
          <div className="tx-rail">
            <div className="tx-rail-main">
              <TxChatBody />
              <TxComposer />
            </div>
            <TxRailSide active="files" />
          </div>
        </div>
        <div className="cq-pane dimmed" style={{ flex: 1 }}>
          <TxPaneHead no="2" icon="✦" title="e2e 排查" meta="⎇ main" />
          <div className="tx-rail">
            <div className="tx-rail-main">
              <TxChatBody short />
              <TxComposer />
            </div>
            <TxRailSide active="spec" />
          </div>
        </div>
      </div>
      <TxStatus />
      <TxNote text="附帶工具＝chat pane 的內建右欄（可收合、可換分頁），不佔 pane tree" style={{ left: 320, top: 50 }} pt="b" />
      <TxNote text="每個 chat 自帶自己的 files/git/spec，多 chat 不互搶" style={{ right: 40, top: 50 }} pt="b" />
    </div>
  );
}

/* ---------- 版面 C：dock + drawer ---------- */
function TxLayoutC() {
  return (
    <div className="cq theme-clay-dark" style={{ position: 'relative' }}>
      <TxTabBar tabs={TX_TABS} />
      <div className="cq-panes" style={{ position: 'relative' }}>
        <div className="cq-pane focused" style={{ flex: 6 }}>
          <TxPaneHead no="1" icon="✦" title="drawer 釘選" meta="⎇ feat/discuss-layout" />
          <div className="cq-pane-body">
            <TxChatBody short />
            <TxComposer />
            <div className="tx-dock">
              <span className="tx-dock-chip active">▤ files <span className="badge">6</span></span>
              <span className="tx-dock-chip">± git <span className="badge">+118</span></span>
              <span className="tx-dock-chip">◈ spec <span className="badge">2</span></span>
              <span className="tx-dock-chip">❯ terminal</span>
              <span className="tx-dock-hint">點 chip 開 drawer・⌘⏎ 升級成 pane</span>
            </div>
          </div>
        </div>
        <div className="cq-pane" style={{ flex: 4 }}>
          <TxPaneHead no="2" icon="❯" title="terminal" meta="~/code-quest" />
          <div className="cq-pane-body"><TxTermBody /></div>
        </div>

        {/* drawer 開啟狀態 */}
        <div className="tx-drawer-back"></div>
        <div className="tx-drawer">
          <div className="tx-drawer-grab"></div>
          <div className="tx-drawer-head">
            <span>▤</span><span className="ttl">apps/web/src/components/workspace/DrawerHost.tsx</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--success)' }}>+32 −6</span>
            <span className="acts">
              <span className="tx-btn primary">⊞ 釘選成 pane</span>
              <span className="tx-btn">⤢ 全螢幕</span>
              <span className="tx-btn">✕</span>
            </span>
          </div>
          <TxDiffBody />
          <div style={{ padding: '8px 16px', fontSize: 10.5, color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)' }}>
            esc 關閉　／　拖左緣調寬度　／　釘選後成為 pane tree 的新 leaf
          </div>
        </div>
      </div>
      <TxStatus />
      <TxNote text="工具收成 chat 底部 dock，點開＝drawer 浮層看完整內容" style={{ left: 100, bottom: 86 }} pt="t" />
      <TxNote text="drawer 右上「釘選成 pane」→ 內容轉成獨立 pane" style={{ right: 270, top: 44 }} pt="b" />
    </div>
  );
}

Object.assign(window, {
  TxTabBar, TxStatus, TxPaneHead, TxToolRow, TxChatBody, TxComposer,
  TxFilesBody, TxDiffBody, TxSpecBody, TxTermBody, TxNote,
  TxLayoutA, TxLayoutB, TxLayoutC,
});
