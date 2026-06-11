// tmux-details.jsx — PanePicker 變體、zoom、拖曳重排、原子元件
// 依賴 tmux-mocks.jsx 的共用元件（透過 window）

const TxD = window; // 共用元件來源

function TxTypeGrid({ activeKey }) {
  const types = [
    ['✦', 'chat', '⏎'], ['▤', 'files', 'F'], ['±', 'git', 'G'],
    ['◈', 'openspec', 'O'], ['≷', 'diff', 'D'], ['❯', 'terminal', 'T'],
  ];
  return (
    <div className="tx-typegrid">
      {types.map(([ico, k, key]) => (
        <div key={k} className={'tx-type' + (k === activeKey ? ' active' : '')}>
          <span className="ico">{ico}</span><span>{k}</span><span className="k">{key}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------- Picker 甲：階層樹（單欄） ---------- */
function TxPickerTree() {
  return (
    <div className="tx-picker theme-clay-dark">
      <div className="tx-picker-head"><span>⌕</span><span>搜尋 project / worktree / session…</span><span className="cq-kbd" style={{ marginLeft: 'auto' }}>esc</span></div>
      <div className="tx-tree">
        <div className="tx-node"><span className="glyph">⌂</span><span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>code-quest</span><span className="meta">~/code-quest</span></div>
        <div className="tx-node lv1"><span className="glyph">⎇</span><span className="mono" style={{ fontSize: 11.5 }}>main</span><span className="meta"><span>2 chats</span></span></div>
        <div className="tx-node lv2"><span className="glyph">●</span><span>e2e 排查</span><span className="meta"><span style={{ color: 'var(--accent)' }}>busy</span><span>pane ③</span></span></div>
        <div className="tx-node lv1 active"><span className="glyph">⎇</span><span className="mono" style={{ fontSize: 11.5 }}>feat/discuss-layout</span><span className="meta"><span>1 chat</span></span></div>
        <div className="tx-node lv2"><span className="glyph">●</span><span>drawer 釘選</span><span className="meta"><span style={{ color: 'var(--accent)' }}>busy</span><span>pane ①</span></span></div>
        <div className="tx-node lv2" style={{ display: 'block' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><span className="glyph">＋</span><span>在此 worktree 新增 pane：</span></div>
          <TxTypeGrid activeKey="chat" />
        </div>
        <div className="tx-node lv1"><span className="glyph">＋</span><span style={{ color: 'var(--text-subtle)' }}>新增 worktree…</span></div>
        <div className="tx-node" style={{ marginTop: 6 }}><span className="glyph">⌂</span><span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>dotfiles</span><span className="meta">~/dotfiles</span></div>
        <div className="tx-node" style={{ marginTop: 6 }}><span className="glyph">＋</span><span style={{ color: 'var(--text-subtle)' }}>新增 Project（選資料夾）…</span></div>
      </div>
      <div className="cq-picker-foot"><span>↑↓ 移動</span><span>→ 展開</span><span>⏎ 開啟到目前 pane</span><span>⌘⏎ 分割開啟</span><span>F/G/O/D/T 直接選類型</span></div>
    </div>
  );
}

/* ---------- Picker 乙：Miller 三欄 ---------- */
function TxPickerCols() {
  return (
    <div className="tx-picker theme-clay-dark">
      <div className="tx-picker-head"><span>⌕</span><span>搜尋…</span><span className="cq-kbd" style={{ marginLeft: 'auto' }}>esc</span></div>
      <div className="tx-cols">
        <div className="tx-col" style={{ flex: 4 }}>
          <div className="tx-col-title">Projects</div>
          <div className="tx-node active"><span className="glyph">⌂</span><span>code-quest</span><span className="meta">2⎇</span></div>
          <div className="tx-node"><span className="glyph">⌂</span><span>dotfiles</span><span className="meta">1⎇</span></div>
          <div className="tx-node"><span className="glyph">⌂</span><span>my-blog</span><span className="meta">1⎇</span></div>
          <div className="tx-node"><span className="glyph">＋</span><span style={{ color: 'var(--text-subtle)' }}>新增 Project…</span></div>
        </div>
        <div className="tx-col" style={{ flex: 5 }}>
          <div className="tx-col-title">Worktrees</div>
          <div className="tx-node"><span className="glyph">⎇</span><span className="mono" style={{ fontSize: 11.5 }}>main</span><span className="meta">2 chats</span></div>
          <div className="tx-node active"><span className="glyph">⎇</span><span className="mono" style={{ fontSize: 11.5 }}>feat/discuss-layout</span><span className="meta">1 chat・busy</span></div>
          <div className="tx-node"><span className="glyph">＋</span><span style={{ color: 'var(--text-subtle)' }}>新增 worktree…</span></div>
        </div>
        <div className="tx-col" style={{ flex: 6 }}>
          <div className="tx-col-title">新增 pane</div>
          <TxTypeGrid activeKey="chat" />
          <div className="tx-col-title" style={{ marginTop: 10 }}>進行中</div>
          <div className="tx-node"><span className="glyph">●</span><span>drawer 釘選</span><span className="meta"><span style={{ color: 'var(--accent)' }}>busy</span></span></div>
          <div className="tx-col-title" style={{ marginTop: 10 }}>歷史（resume）</div>
          <div className="tx-node"><span className="glyph">⟲</span><span>修正捲動位置</span><span className="meta">昨天</span></div>
          <div className="tx-node"><span className="glyph">⟲</span><span>SessionBar 側欄化</span><span className="meta">3 天前</span></div>
        </div>
      </div>
      <div className="cq-picker-foot"><span>←→ 換欄</span><span>↑↓ 移動</span><span>⏎ 開啟到目前 pane</span><span>⌘⏎ 分割開啟</span></div>
    </div>
  );
}

/* ---------- Picker 丙：指令分段式 ---------- */
function TxPickerCmd() {
  return (
    <div className="tx-picker theme-clay-dark">
      <div className="tx-picker-head">
        <span>⌕</span>
        <span className="cq-mode-pill" style={{ fontSize: 11 }}>code-quest</span>
        <span className="cq-mode-pill plan" style={{ fontSize: 11 }}>⎇ feat/discuss-layout</span>
        <span style={{ color: 'var(--text-subtle)' }}>選擇 pane 類型…</span>
        <span className="cq-kbd" style={{ marginLeft: 'auto' }}>⌫ 退一段</span>
      </div>
      <div className="tx-tree">
        <TxTypeGrid activeKey="terminal" />
        <div className="tx-col-title" style={{ marginTop: 12 }}>常用組合</div>
        <div className="tx-node active"><span className="glyph">⊞</span><span>chat＋files＋git（標準工作組）</span><span className="meta">⌘1</span></div>
        <div className="tx-node"><span className="glyph">⊞</span><span>chat＋terminal（除錯組）</span><span className="meta">⌘2</span></div>
        <div className="tx-node"><span className="glyph">⊞</span><span>git＋openspec（審查組）</span><span className="meta">⌘3</span></div>
      </div>
      <div className="cq-picker-foot"><span>逐段選：project → worktree → 類型</span><span>每段皆可打字過濾</span><span>⏎ 確定</span></div>
    </div>
  );
}

/* ---------- Zoom（完整內容的另一條路） ---------- */
function TxZoomDemo() {
  return (
    <div className="cq theme-clay-dark" style={{ position: 'relative' }}>
      <TxD.TxTabBar tabs={[{ label: 'drawer 釘選', busy: true }, { label: '佈局討論' }]} />
      <div className="tx-zoom-bar">
        <span>⤢ Zoom 中 — pane ② git · DrawerHost.tsx（共 4 個 pane）</span>
        <span style={{ marginLeft: 'auto', fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5 }}>⌘⇧Z 或 esc 返回分割</span>
      </div>
      <div className="cq-panes">
        <div className="cq-pane focused" style={{ flex: 1 }}>
          <TxD.TxPaneHead no="2" icon="±" title="git · DrawerHost.tsx" meta="+32 −6" zoomed />
          <div className="cq-pane-body"><TxD.TxDiffBody /></div>
        </div>
      </div>
      <TxD.TxStatus />
      <TxD.TxNote text="方案乙：不用 drawer，任何 pane ⌘⇧Z 暫時放大成全版（tmux zoom）" style={{ left: 280, top: 64 }} pt="b" />
    </div>
  );
}

/* ---------- 拖曳重排示意 ---------- */
function TxDragDemo() {
  return (
    <div className="cq theme-clay-dark" style={{ position: 'relative' }}>
      <TxD.TxTabBar tabs={[{ label: 'drawer 釘選', busy: true }]} />
      <div className="cq-panes" style={{ position: 'relative' }}>
        <div className="cq-pane" style={{ flex: 6, position: 'relative', opacity: 0.85 }}>
          <TxD.TxPaneHead no="1" icon="✦" title="drawer 釘選" />
          <div className="cq-pane-body"><TxD.TxChatBody short /></div>
          {/* drop zones */}
          <div className="tx-dropzones">
            <div className="tx-dz" style={{ left: 8, top: 8, bottom: 8, width: '26%' }}>左</div>
            <div className="tx-dz hot" style={{ right: 8, top: 8, bottom: 8, width: '26%' }}>右・垂直分割</div>
            <div className="tx-dz" style={{ left: '30%', right: '30%', top: 8, height: '24%' }}>上</div>
            <div className="tx-dz" style={{ left: '30%', right: '30%', bottom: 8, height: '24%' }}>下</div>
            <div className="tx-dz" style={{ left: '36%', right: '36%', top: '40%', height: '22%' }}>置換</div>
          </div>
        </div>
        <div className="cq-pane dimmed" style={{ flex: 4 }}>
          <TxD.TxPaneHead no="3" icon="❯" title="terminal" />
          <div className="cq-pane-body"><TxD.TxTermBody /></div>
        </div>
        {/* 拖曳中的 ghost */}
        <div className="tx-ghost" style={{ left: '38%', top: 90, width: 330, height: 170 }}>
          <TxD.TxPaneHead no="2" icon="±" title="git · DrawerHost.tsx" />
          <div style={{ height: '100%' }}><TxD.TxDiffBody /></div>
        </div>
      </div>
      <TxD.TxStatus />
      <TxD.TxNote text="抓 pane header 拖曳 → 目標 pane 浮出五個落點（上下左右＋置換）" style={{ left: 120, top: 50 }} pt="b" />
    </div>
  );
}

/* ---------- 原子元件：divider／pane registry ---------- */
function TxAtoms() {
  const reg = [
    ['✦', 'chat'], ['▤', 'files'], ['±', 'git'], ['◈', 'openspec'], ['≷', 'diff'], ['❯', 'terminal'],
  ];
  return (
    <div className="cq theme-clay-dark" style={{ padding: 26, display: 'block', overflow: 'hidden' }}>
      <div className="cq-label" style={{ padding: '0 0 8px' }}>分隔線（resize）三態</div>
      <div className="tx-divider-demo" style={{ marginBottom: 22 }}>
        <div style={{ textAlign: 'center' }}><div className="tx-div-v"></div><div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 6 }}>預設 1px</div></div>
        <div style={{ textAlign: 'center' }}><div className="tx-div-v hover"></div><div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 6 }}>hover：6px 熱區＋把手</div></div>
        <div style={{ textAlign: 'center' }}><div className="tx-div-v hover" style={{ background: 'var(--accent-soft)' }}></div><div style={{ fontSize: 10, color: 'var(--text-subtle)', marginTop: 6 }}>拖曳中＋雙擊回 50%</div></div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', maxWidth: 300, lineHeight: 1.6 }}>
          熱區 6px、視覺 1px；拖曳時即時 reflow，雙擊重設平分。鍵盤：focus pane 後 ⌥方向鍵 微調。
        </div>
      </div>
      <div className="cq-label" style={{ padding: '0 0 8px' }}>Pane 類型 registry — 隨時可擴充</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {reg.map(([ico, k]) => (
          <span key={k} className="tx-dock-chip" style={{ fontSize: 12 }}>{ico} {k}</span>
        ))}
        <span className="tx-dock-chip" style={{ borderStyle: 'dashed', color: 'var(--text-subtle)' }}>＋ 未來：preview / logs / db…</span>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.65, maxWidth: 640 }}>
        每種 pane 實作同一個 <span className="mono" style={{ fontFamily: '"JetBrains Mono", monospace' }}>PaneContent</span> 介面（descriptor：type＋cwd＋params），
        picker 的類型清單、dock chips、drawer「釘選成 pane」都從 registry 讀——新增 terminal pane 只要註冊一筆，三個入口自動出現。
      </div>
    </div>
  );
}

Object.assign(window, { TxPickerTree, TxPickerCols, TxPickerCmd, TxZoomDemo, TxDragDemo, TxAtoms, TxTypeGrid });
