// tmux-rwd.jsx — tablet / mobile 降級策略 mockups（依賴 tmux-mocks.jsx）

const TxR = window;

/* ---------- Tablet 橫向：最多 2 pane，其餘收進右側直立條 ---------- */
function TxTabletLand() {
  return (
    <div className="cq theme-clay-dark" style={{ position: 'relative' }}>
      <TxR.TxTabBar tabs={[{ label: 'drawer 釘選', busy: true }, { label: '佈局討論' }]} />
      <div className="cq-panes">
        <div className="cq-pane focused tx-group-a" style={{ flex: 6 }}>
          <TxR.TxPaneHead no="1" icon="✦" title="drawer 釘選" meta="⎇ feat/discuss-layout" />
          <div className="cq-pane-body">
            <TxR.TxChatBody short />
            <TxR.TxComposer />
          </div>
        </div>
        <div className="cq-pane tx-group-a" style={{ flex: 4 }}>
          <TxR.TxPaneHead no="2" icon="±" title="git · DrawerHost.tsx" />
          <div className="cq-pane-body"><TxR.TxDiffBody /></div>
        </div>
        <div className="tx-edge">
          <span className="tx-edge-tab"><span className="cq-pane-no">3</span>▤ files</span>
          <span className="tx-edge-tab"><span className="cq-pane-no">4</span>❯ terminal</span>
          <span className="tx-edge-tab" style={{ borderStyle: 'dashed', color: 'var(--text-subtle)' }}>＋</span>
        </div>
      </div>
      <TxR.TxStatus />
      <TxR.TxNote text="平板上限 2 個可見 pane；放不下的收成右側直立 tab，點了與目前 pane 交換" style={{ right: 60, bottom: 130 }} pt="t" />
    </div>
  );
}

/* ---------- Tablet 直向：單 pane + slide-over ---------- */
function TxTabletPort() {
  return (
    <div className="cq theme-clay-dark" style={{ position: 'relative' }}>
      <TxR.TxTabBar tabs={[{ label: 'drawer 釘選', busy: true }, { label: '佈局討論' }]} />
      <div className="cq-panes" style={{ position: 'relative' }}>
        <div className="cq-pane focused" style={{ flex: 1 }}>
          <TxR.TxPaneHead no="1" icon="✦" title="drawer 釘選" meta="⎇ feat/discuss-layout" />
          <div className="cq-pane-body">
            <TxR.TxChatBody />
            <TxR.TxComposer />
          </div>
        </div>
        <div className="tx-edge">
          <span className="tx-edge-tab" style={{ background: 'var(--accent-soft)', color: 'var(--text-bright)', borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border))' }}><span className="cq-pane-no">2</span>± git</span>
          <span className="tx-edge-tab"><span className="cq-pane-no">3</span>▤ files</span>
        </div>
        {/* slide-over */}
        <div className="tx-slideover">
          <TxR.TxPaneHead no="2" icon="±" title="git · DrawerHost.tsx" meta="+32 −6" />
          <TxR.TxDiffBody />
          <div style={{ padding: '8px 14px', fontSize: 10.5, color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)' }}>
            往右滑收回邊條　／　往左拖到底＝固定成分割
          </div>
        </div>
      </div>
      <TxR.TxStatus />
      <TxR.TxNote text="直向：單 pane 為主，第二個 pane 用 slide-over 浮層（iPad 慣例）" style={{ left: 40, top: 50 }} pt="b" />
    </div>
  );
}

/* ---------- Mobile 共用 ---------- */
function TxMBar({ dots = true }) {
  return (
    <div className="txm-bar">
      <span className="txm-tabdrop">⚔ drawer 釘選 <span style={{ color: 'var(--text-subtle)' }}>▾</span></span>
      {dots && (
        <div className="txm-dots">
          <span className="txm-dot active">1</span>
          <span className="txm-dot">2</span>
          <span className="txm-dot">3</span>
        </div>
      )}
      <span className="txm-iconbtn" title="pane 切換器">⊞</span>
    </div>
  );
}

function TxMStatus() {
  return (
    <div className="txm-status">
      <span style={{ color: 'var(--accent-strong)' }}>code-quest</span>
      <span>⎇ discuss-layout</span>
      <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}><span className="busy-dot" style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }}></span>1 busy</span>
    </div>
  );
}

/* ---------- Mobile 甲：chat 全幅 + 底部 dock ---------- */
function TxMobileChat() {
  return (
    <div className="cq theme-clay-dark" style={{ position: 'relative' }}>
      <TxMBar />
      <div className="cq-pane-body" style={{ flex: 1 }}>
        <TxR.TxChatBody />
        <TxR.TxComposer />
      </div>
      <div className="txm-dock">
        <span className="tx-dock-chip active">▤ <span className="badge">6</span></span>
        <span className="tx-dock-chip">± <span className="badge">+118</span></span>
        <span className="tx-dock-chip">◈ <span className="badge">2</span></span>
        <span className="tx-dock-chip">❯</span>
        <span className="tx-dock-hint">左右滑切 pane</span>
      </div>
      <TxMStatus />
      <TxR.TxNote text="單 pane 全幅；①②③ 點數字或左右滑切換" style={{ left: 16, bottom: 150 }} pt="t" />
    </div>
  );
}

/* ---------- Mobile 乙：bottom sheet（drawer 的手機形態） ---------- */
function TxMobileSheet() {
  return (
    <div className="cq theme-clay-dark" style={{ position: 'relative' }}>
      <TxMBar />
      <div className="cq-pane-body" style={{ flex: 1, opacity: 0.55 }}>
        <TxR.TxChatBody short />
      </div>
      <div className="txm-sheet-back"></div>
      <div className="txm-sheet">
        <div className="txm-grabber"></div>
        <div className="tx-drawer-head" style={{ background: 'transparent' }}>
          <span>±</span><span className="ttl">DrawerHost.tsx</span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--success)' }}>+32 −6</span>
          <span className="acts"><span className="tx-btn">⤢ 全螢幕</span></span>
        </div>
        <TxR.TxDiffBody />
        <div style={{ padding: '8px 16px 14px', fontSize: 10.5, color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)' }}>
          上拉全螢幕　／　下拉關閉（手機不提供「釘選成 pane」——空間不夠分割）
        </div>
      </div>
      <TxR.TxNote text="drawer → bottom sheet：半開、全開、關閉三段" style={{ left: 16, top: 200 }} pt="b" />
    </div>
  );
}

/* ---------- Mobile 丙：pane 切換器（卡片牆） ---------- */
function TxMobileSwitcher() {
  return (
    <div className="cq theme-clay-dark" style={{ position: 'relative' }}>
      <TxMBar dots={false} />
      <div className="txm-switch">
        <div className="txm-card active">
          <div className="preview"><div style={{ width: 340, transform: 'scale(0.48)', transformOrigin: 'top left' }}><TxR.TxChatBody short /></div></div>
          <div className="cap"><span className="txm-dot active" style={{ width: 18, height: 18, fontSize: 9 }}>1</span>✦ drawer 釘選 <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)' }}></span><span className="x">×</span></div>
        </div>
        <div className="txm-card">
          <div className="preview"><TxR.TxDiffBody /></div>
          <div className="cap"><span className="txm-dot" style={{ width: 18, height: 18, fontSize: 9 }}>2</span>± git<span className="x">×</span></div>
        </div>
        <div className="txm-card">
          <div className="preview" style={{ padding: 4 }}><TxR.TxFilesBody rows={4} /></div>
          <div className="cap"><span className="txm-dot" style={{ width: 18, height: 18, fontSize: 9 }}>3</span>▤ files<span className="x">×</span></div>
        </div>
        <div className="txm-new">＋ 新增 pane（開 picker）</div>
      </div>
      <TxMStatus />
      <TxR.TxNote text="pane tree 在手機攤平成卡片牆（同 tab 內）；桌機回來時還原原本的分割" style={{ left: 16, top: 56 }} pt="b" />
    </div>
  );
}

Object.assign(window, { TxTabletLand, TxTabletPort, TxMobileChat, TxMobileSheet, TxMobileSwitcher });
