// tmux-tokens-full.jsx — tmux workspace 完整 component token 總表
// 色彩 palette 另一張畫板用 TokenSheet（V1 陶土暗）呈現

function TxTokensFull() {
  const Row = ({ name, val, note }) => (
    <div className="tk-type-row" style={{ alignItems: 'center', padding: '5px 0' }}>
      <span className="spec" style={{ width: 240, flexShrink: 0 }}>{name}</span>
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: 'var(--text-bright)', width: 170, flexShrink: 0 }}>{val}</span>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{note}</span>
    </div>
  );
  const H = ({ children }) => <div className="tk-section-title" style={{ marginTop: 14, marginBottom: 2 }}>{children}</div>;

  return (
    <div className="tk theme-clay-dark" style={{ gap: 6 }}>
      <h2>Design Tokens 總表<small>tmux workspace 全元件 — 已寫入 tokens/App.proposal.css，色彩見「V1 陶土・暗」畫板</small></h2>

      <H>Typography（--font-sans: Outfit／--font-mono: JetBrains Mono）</H>
      <Row name="--text-body" val="13px / 1.5" note="訊息、一般 UI 內文" />
      <Row name="--text-ui" val="12px / 1.4" note="pane header、tab、picker 列" />
      <Row name="--text-label" val="10px · 700 · +12%" note="section 標籤（大寫）" />
      <Row name="--text-code" val="11.5px / 1.75 mono" note="diff、terminal、檔名" />
      <Row name="--text-statusline" val="10.5px mono" note="底部狀態列" />

      <H>Spacing（4px 基準）＋ Radius</H>
      <Row name="--spacing" val="4 / 8 / 12 / 16 / 24 / 32" note="所有 padding、gap 取階" />
      <Row name="--pane-gap" val="6px" note="pane 之間與外框留白" />
      <Row name="--radius-chip / row" val="4px / 7px" note="徽章、選單列、dock chip 用 99 pill" />
      <Row name="--radius-card" val="10px" note="pane、卡片、drawer 圓角" />
      <Row name="--radius-composer" val="14px" note="輸入框" />
      <Row name="--radius-sheet" val="16px" note="mobile bottom sheet 上緣" />

      <H>Pane（核心元件）</H>
      <Row name="--pane-header-h" val="30px" note="編號徽章 16px、動作 icon 12px" />
      <Row name="--pane-border" val="1px var(--border)" note="一般框線" />
      <Row name="--pane-focus-ring" val="accent 35% · 1px 外圈" note="focused：邊框 accent 55%＋外圈；mode 變色（plan=info）" />
      <Row name="--pane-group-stripe" val="3px accent 70%" note="chat 附帶工具的同色繫帶（inset 左緣）" />
      <Row name="--pane-dim-opacity" val="0.75" note="非 focus 的 pane 內容" />
      <Row name="--pane-min-w / h" val="320px / 160px" note="低於下限拒絕分割" />

      <H>Tab bar ＋ 狀態列（session bar 移除後的兩端）</H>
      <Row name="--tabbar-h / tab-h" val="38px / 32px" note="tab 圓角 8 8 0 0、active 接縫蓋線" />
      <Row name="--busy-dot" val="6px · pulse 1.2s" note="tab 與狀態列共用的 busy 指示" />
      <Row name="--statusline-h" val="26px" note="左：project＋branch；右：快捷鍵提示" />

      <H>Drawer／Sheet／Slide-over（完整內容檢視）</H>
      <Row name="--drawer-w" val="56%（min 480px）" note="右側滑入；左緣 6px 拖拉把手" />
      <Row name="--sheet-snap" val="0 / 66% / 100%" note="mobile 三段；grabber 44×5px" />
      <Row name="--slideover-w" val="58%" note="tablet 直向浮層，拖到底固定成分割" />
      <Row name="--shadow-floating" val="0 16px 40px #08060499" note="drawer、sheet、ghost、picker 共用" />

      <H>Dock ＋ Picker ＋ 拖曳</H>
      <Row name="--dock-chip-h" val="28px（mobile 40px）" note="pill、count 用 mono 9.5px accent" />
      <Row name="--picker-w" val="560–980px" note="modal 置中、頂部搜尋、底部鍵位列" />
      <Row name="--dropzone" val="accent 虛線 2px · soft 底" note="命中時實線＋25% 底；ghost 旋轉 -1.5°" />
      <Row name="--divider-hit" val="6px（視覺 1px）" note="hover 顯把手、雙擊回 50%、⌥方向鍵微調" />

      <H>Z-index（沿用 repo 既有 tiers）＋ Motion</H>
      <Row name="--z-float / overlay / modal" val="30 / 40 / 50" note="drawer·sheet＝float、遮罩＝overlay、picker＝modal" />
      <Row name="--dur-fast / base" val="120ms / 200ms" note="hover、focus ring／pane 開合、drawer 240ms ease-out" />
      <Row name="--ease" val="cubic-bezier(.2,.8,.2,1)" note="所有位移動畫；reduced-motion 時關閉" />
    </div>
  );
}

window.TxTokensFull = TxTokensFull;
