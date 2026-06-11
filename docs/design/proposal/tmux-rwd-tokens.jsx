// tmux-rwd-tokens.jsx — RWD design token 規格表
// 斷點、pane 約束、觸控目標、層級、字級——全部對應 Tailwind v4 @theme 寫法

function TxRwdTokens() {
  const Row = ({ name, val, note }) => (
    <div className="tk-type-row" style={{ alignItems: 'center' }}>
      <span className="spec" style={{ width: 250 }}>{name}</span>
      <span className="mono" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: 'var(--text-bright)', width: 150 }}>{val}</span>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{note}</span>
    </div>
  );
  return (
    <div className="tk theme-clay-dark" style={{ gap: 14 }}>
      <h2>RWD Tokens<small>新增於 @theme — 配合 tablet / mobile 降級策略</small></h2>

      <div>
        <div className="tk-section-title" style={{ marginBottom: 4 }}>Breakpoints（Tailwind v4 --breakpoint-*）</div>
        <Row name="--breakpoint-sm" val="40rem / 640px" note="< sm：mobile — 單 pane、卡片牆切換、bottom sheet" />
        <Row name="--breakpoint-lg" val="64rem / 1024px" note="sm–lg：tablet — 上限 2 pane、邊條收納、slide-over" />
        <Row name="—" val="≥ 1024px" note="desktop — 完整 pane tree、drawer、zoom" />
      </div>

      <div>
        <div className="tk-section-title" style={{ marginBottom: 4 }}>Pane 約束</div>
        <Row name="--pane-min-w" val="320px" note="分割時任一 pane 低於此寬 → 拒絕分割、提示改用 tab" />
        <Row name="--pane-min-h" val="160px" note="水平分割下限" />
        <Row name="--pane-max-visible-sm" val="1" note="mobile 一次只渲染一個 pane（其餘保留狀態）" />
        <Row name="--pane-max-visible-md" val="2" note="tablet 超過 2 個 → 自動收進邊條" />
      </div>

      <div>
        <div className="tk-section-title" style={{ marginBottom: 4 }}>觸控目標（≥ 44px 原則）</div>
        <Row name="--hit-min" val="44px" note="所有可點元素的最小高度（mobile）" />
        <Row name="--hit-dock-chip" val="40px" note="dock chips（含 8px 外距合計 ≥ 48）" />
        <Row name="--hit-edge-tab" val="34px 寬" note="tablet 邊條直立 tab" />
        <Row name="--safe-bottom" val="env(safe-area-inset-bottom)" note="dock / sheet / composer 底部內距加上" />
      </div>

      <div className="tk-row" style={{ gap: 40 }}>
        <div style={{ flex: 1 }}>
          <div className="tk-section-title" style={{ marginBottom: 4 }}>字級（mobile 覆寫）</div>
          <Row name="--text-body-sm" val="14px" note="桌機 13 → 手機 14" />
          <Row name="--text-input-sm" val="16px" note="composer 輸入字 16px：避免 iOS 聚焦自動縮放" />
          <Row name="--text-statusline-sm" val="9.5px" note="狀態列精簡版" />
        </div>
        <div style={{ flex: 1 }}>
          <div className="tk-section-title" style={{ marginBottom: 4 }}>層級／圓角（沿用既有 z-index tiers）</div>
          <Row name="--z-index-float" val="30" note="slide-over、bottom sheet" />
          <Row name="--z-index-overlay" val="40" note="sheet 後方遮罩" />
          <Row name="--radius-sheet" val="16px" note="bottom sheet 上緣（radius 階新增第 5 階）" />
        </div>
      </div>

      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.6, borderTop: '1px dashed var(--border-subtle)', paddingTop: 10 }}>
        手勢對應：左右滑＝切 pane（mobile）／拖 grabber＝sheet 三段（關・半・全）／slide-over 拖到底＝固定成分割（tablet）。
        斷點切換時 pane tree 不銷毀——mobile 只是改變「渲染幾個」，回到桌機原樹還原。
      </div>
    </div>
  );
}

window.TxRwdTokens = TxRwdTokens;
