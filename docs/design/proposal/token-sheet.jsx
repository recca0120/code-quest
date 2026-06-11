// token-sheet.jsx — design token 規格表（每個主題一張）

const TOKEN_SETS = {
  'theme-clay-dark': {
    title: 'V1 陶土・暗',
    note: '主推 dark theme — 取代 VS Code Dark+ 的冷灰',
    surfaces: [
      ['bg', '#191613'], ['surface', '#211d18'], ['surface-hover', '#29241e'],
      ['border', '#38322a'], ['input-bg', '#262019'], ['code-block', '#141109'],
    ],
    text: [
      ['text-bright', '#f2ede3'], ['text', '#d8d2c6'], ['text-muted', '#a39b8d'],
      ['text-subtle', '#756d5e'], ['text-dim', '#5a523f'], ['text-faint', '#3b362c'],
    ],
    accents: [
      ['accent', '#d97757'], ['success', '#84b07e'], ['warning', '#d4ab6a'],
      ['danger', '#df6c55'], ['info', '#82a3c9'], ['gold', '#d4ab6a'],
    ],
  },
  'theme-paper-light': {
    title: 'V2 紙・亮',
    note: '對應 light theme — Anthropic 紙感象牙白',
    surfaces: [
      ['bg', '#faf9f5'], ['surface', '#f1efe8'], ['surface-hover', '#e9e6dc'],
      ['border', '#ddd9cc'], ['input-bg', '#ffffff'], ['code-block', '#f3f1e9'],
    ],
    text: [
      ['text-bright', '#211d15'], ['text', '#403c33'], ['text-muted', '#71695c'],
      ['text-subtle', '#8d8576'], ['text-dim', '#a59d8e'], ['text-faint', '#d4cfc2'],
    ],
    accents: [
      ['accent', '#c6613f'], ['success', '#5f8a4e'], ['warning', '#9c7a2d'],
      ['danger', '#bf4d33'], ['info', '#4f74a4'], ['gold', '#9c7a2d'],
    ],
  },
  'theme-roast': {
    title: 'V3 焙茶・金',
    note: '更深的焙茶底 + 金色強調 — 與 DQ 遊戲模式共用視覺 DNA',
    surfaces: [
      ['bg', '#14100c'], ['surface', '#1d1712'], ['surface-hover', '#261e16'],
      ['border', '#41372a'], ['input-bg', '#241c14'], ['code-block', '#0f0c08'],
    ],
    text: [
      ['text-bright', '#f5ecdc'], ['text', '#e0d5c2'], ['text-muted', '#a8977e'],
      ['text-subtle', '#7d6f59'], ['text-dim', '#5d5240'], ['text-faint', '#3d352a'],
    ],
    accents: [
      ['accent', '#e08348'], ['success', '#8fb37c'], ['warning', '#d9b36b'],
      ['danger', '#e26b50'], ['info', '#8aa6c8'], ['gold', '#d9b36b'],
    ],
  },
};

function SwatchGroup({ label, items }) {
  return (
    <div>
      <div className="tk-section-title" style={{ marginBottom: 6 }}>{label}</div>
      <div className="tk-grid">
        {items.map(([nm, hx]) => (
          <div className="tk-sw" key={nm}>
            <div className="chip" style={{ background: hx }}></div>
            <div className="info">
              <div className="nm">{nm}</div>
              <div className="hx">{hx}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenSheet({ theme }) {
  const t = TOKEN_SETS[theme];
  return (
    <div className={'tk ' + theme}>
      <h2>{t.title}<small>{t.note}</small></h2>
      <SwatchGroup label="Surfaces" items={t.surfaces} />
      <SwatchGroup label="Text — 6 階灰階（沿用現有命名，值改暖）" items={t.text} />
      <SwatchGroup label="Accent + 語意色 — oklch 等彩度・等明度" items={t.accents} />
      <div className="tk-row" style={{ gap: 40 }}>
        <div style={{ flex: 1 }}>
          <div className="tk-section-title" style={{ marginBottom: 8 }}>Type Scale</div>
          <div className="tk-type-row"><span className="spec">display · Outfit 600 · 18/24</span><span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-bright)' }}>標題 Heading</span></div>
          <div className="tk-type-row"><span className="spec">body · Outfit 400 · 13/19.5</span><span style={{ fontSize: 13 }}>內文 Body text</span></div>
          <div className="tk-type-row"><span className="spec">ui · Outfit 400 · 12/16</span><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>介面 UI label</span></div>
          <div className="tk-type-row"><span className="spec">code · JetBrains Mono · 11.5/19.5</span><span className="mono" style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5 }}>const quest = true;</span></div>
          <div className="tk-type-row"><span className="spec">label · Outfit 700 · 10 · +12% 字距</span><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-dim)' }}>SECTION LABEL</span></div>
        </div>
        <div style={{ width: 290 }}>
          <div className="tk-section-title" style={{ marginBottom: 8 }}>Radius</div>
          <div className="tk-pill-row" style={{ marginBottom: 14 }}>
            {[['4', 'chip'], ['7', 'row'], ['10', 'card'], ['14', 'composer']].map(([r, nm]) => (
              <div key={r} className="tk-radius" style={{ width: 52, height: 40, borderRadius: Number(r) }}>{r} {nm}</div>
            ))}
          </div>
          <div className="tk-section-title" style={{ marginBottom: 8 }}>Spacing · 4px 基準</div>
          <div className="tk-pill-row">
            {[4, 8, 12, 16, 24, 32].map((s) => (
              <div key={s} style={{ textAlign: 'center' }}>
                <div className="tk-space" style={{ width: s, height: 22 }}></div>
                <div style={{ fontSize: 9, color: 'var(--text-subtle)', fontFamily: '"JetBrains Mono", monospace', marginTop: 3 }}>{s}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.TokenSheet = TokenSheet;
