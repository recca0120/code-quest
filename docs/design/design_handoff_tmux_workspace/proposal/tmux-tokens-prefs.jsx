// tmux-tokens-prefs.jsx — 偏好設定 tokens（theme / font-size / density）＋ Command Palette
// 規格同步寫在 tokens/App.proposal.css 末段

function TxTokensPrefs() {
  const Row = ({ name, val, note }) => (
    <div className="tk-type-row" style={{ alignItems: 'center', padding: '5px 0' }}>
      <span className="spec" style={{ width: 240, flexShrink: 0 }}>{name}</span>
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: 'var(--text-bright)', width: 190, flexShrink: 0 }}>{val}</span>
      <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{note}</span>
    </div>
  );
  const H = ({ children }) => <div className="tk-section-title" style={{ marginTop: 16, marginBottom: 4 }}>{children}</div>;

  const themes = [
    { id: 'clay-dark', nm: 'V1 陶土・暗', def: true, chips: ['#191613', '#211d18', '#38322a', '#d8d2c6', '#d97757'] },
    { id: 'paper-light', nm: 'V2 紙・亮', chips: ['#faf9f5', '#f1efe8', '#ddd9cc', '#403c33', '#c6613f'] },
    { id: 'roast', nm: 'V3 焙茶・金', chips: ['#14100c', '#1d1712', '#41372a', '#e0d5c2', '#d9b36b'] },
  ];

  const sizes = [
    { id: 's', scale: '0.92', px: 12 },
    { id: 'm', scale: '1', px: 13, def: true },
    { id: 'l', scale: '1.08', px: 14 },
    { id: 'xl', scale: '1.15', px: 15 },
  ];

  const densities = [
    { id: 'compact', pad: 3, header: 26 },
    { id: 'default', pad: 5, header: 30, def: true },
    { id: 'relaxed', pad: 8, header: 34 },
  ];

  return (
    <div className="tk theme-clay-dark" style={{ gap: 6 }}>
      <h2>偏好設定 ＋ Command Palette<small>三個使用者軸（theme・font-size・density）互相獨立，全存 localStorage；palette 是它們的統一入口</small></h2>

      <H>Theme（data-theme — 三主題＋跟隨系統）</H>
      <div style={{ display: 'flex', gap: 10, margin: '4px 0 6px' }}>
        {themes.map((t) => (
          <div key={t.id} style={{ flex: 1, border: '1px solid var(--border-subtle)', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ display: 'flex', height: 34 }}>
              {t.chips.map((c) => <div key={c} style={{ flex: 1, background: c }}></div>)}
            </div>
            <div style={{ padding: '6px 9px', background: 'var(--surface)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-bright)' }}>{t.nm}{t.def && <span className="tk-tagdef">預設</span>}</div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: 'var(--text-subtle)' }}>data-theme="{t.id}"</div>
            </div>
          </div>
        ))}
      </div>
      <Row name="data-theme" val={'clay-dark* / light / roast / auto'} note={'auto＝跟隨系統 prefers-color-scheme（light↔clay-dark）'} />
      <Row name="--theme-transition" val="120ms ease" note="切換時 bg／text／border 過渡一次；reduced-motion 時關閉" />

      <H>Font size（--font-scale — 全 UI 等比縮放）</H>
      <div style={{ display: 'flex', gap: 18, alignItems: 'baseline', margin: '4px 0 6px' }}>
        {sizes.map((s) => (
          <div key={s.id} style={{ textAlign: 'left' }}>
            <span style={{ fontSize: s.px, color: 'var(--text-bright)' }}>Aa 內文訊息</span>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: s.def ? 'var(--accent)' : 'var(--text-subtle)', marginTop: 3 }}>{s.id} · {s.px}px{s.def ? ' *' : ''}</div>
          </div>
        ))}
      </div>
      <Row name="data-fontsize" val="s / m* / l / xl" note="設定 --font-scale；密度不變，只縮放字" />
      <Row name="--font-scale" val="0.92 / 1 / 1.08 / 1.15" note="所有 type token 乘上：body 13→12–15、code 11.5→10.5–13.2" />
      <Row name="快捷鍵" val="⌘= / ⌘− / ⌘0" note="放大／縮小／重設；statusline 短暫顯示目前字級" />
      <Row name="不縮放的例外" val="--text-input-sm 16px" note="mobile composer 固定 16px 防 iOS 聚焦縮放" />

      <H>Density（data-density — 間距軸，與字級獨立）</H>
      <div style={{ display: 'flex', gap: 10, margin: '4px 0 6px' }}>
        {densities.map((d) => (
          <div key={d.id} style={{ flex: 1, border: '1px solid var(--border-subtle)', borderRadius: 9, overflow: 'hidden' }}>
            <div style={{ height: d.header, display: 'flex', alignItems: 'center', gap: 7, padding: '0 9px', background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)', fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: 'var(--surface-hover)', display: 'grid', placeItems: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: 'var(--text-subtle)' }}>1</span>
              pane header {d.header}px
            </div>
            {['src/App.tsx', 'src/lib/panes.ts'].map((f) => (
              <div key={f} style={{ padding: `${d.pad}px 12px`, fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: 'var(--text-muted)', borderBottom: '1px dashed var(--border-subtle)' }}>M {f}</div>
            ))}
            <div style={{ padding: '5px 9px', fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: d.def ? 'var(--accent)' : 'var(--text-subtle)' }}>{d.id}{d.def ? ' *' : ''} · row-pad-y {d.pad}px</div>
          </div>
        ))}
      </div>
      <Row name="data-density" val="compact / default* / relaxed" note="只動間距與列高，不動字級" />
      <Row name="--density-row-pad-y" val="3 / 5 / 8px" note="picker 列、側欄列、file row、spec row 共用" />
      <Row name="--pane-header-h" val="26 / 30 / 34px" note="pane header 隨密度收放" />
      <Row name="--tabbar-h / --statusline-h" val="34·22 / 38·26 / 42·30" note="tab bar 與狀態列成對縮放" />
      <Row name="--msg-gap" val="12 / 16 / 20px" note="chat 訊息流的訊息間距" />

      <H>Command Palette（⌘K — 與 PanePicker 共用 shell）</H>
      <div style={{ display: 'grid', placeItems: 'center', padding: '10px 0 6px' }}>
        <div className="cq-picker" style={{ width: 560 }}>
          <div className="cq-picker-input">
            <span style={{ color: 'var(--accent)' }}>›</span>
            <span style={{ color: 'var(--text-bright)' }}>主題</span>
            <span style={{ marginLeft: 'auto' }} className="cq-kbd">⌘K</span>
          </div>
          <div style={{ padding: '6px 14px 2px' }} className="tk-section-title">指令</div>
          <div className="cq-picker-row active"><span className="glyph">◐</span>切換主題：紙・亮<span className="meta">theme</span></div>
          <div className="cq-picker-row"><span className="glyph">◐</span>切換主題：焙茶・金<span className="meta">theme</span></div>
          <div className="cq-picker-row"><span className="glyph">A</span>字級：放大（14px）<span className="meta">⌘=</span></div>
          <div className="cq-picker-row"><span className="glyph">☰</span>密度：Compact<span className="meta">density</span></div>
          <div className="cq-picker-row"><span className="glyph">⤢</span>Zoom 目前 pane<span className="meta">⌘⇧Z</span></div>
          <div className="cq-picker-foot">
            <span>↑↓ 移動</span><span>⏎ 執行</span><span>esc 關閉</span><span style={{ marginLeft: 'auto' }}>不打「›」＝回到 pane／worktree 搜尋</span>
          </div>
        </div>
      </div>
      <Row name="--palette-w" val="640px（min 90vw 取小）" note="比 PanePicker 560px 稍寬；同一 modal shell" />
      <Row name="--palette-input-h / row-h" val="48px / 36px" note="row-h 隨 density：32 / 36 / 40" />
      <Row name="--palette-max-h" val="min(480px, 64vh)" note="超出捲動；群組標籤 sticky" />
      <Row name="--palette-match" val="accent-mark-bg" note="fuzzy 命中字元的標記底色（accent 30%）" />
      <Row name="進入協定" val="⌘K 統一入口" note="預設搜 pane／worktree（=PanePicker）；輸入「›」切到指令；theme・字級・密度都是指令" />
      <Row name="z-index ＋ 動效" val="modal 50 · 160ms" note="scale 0.98→1＋fade，--ease-out-soft；backdrop＝overlay 40" />
    </div>
  );
}

window.TxTokensPrefs = TxTokensPrefs;
