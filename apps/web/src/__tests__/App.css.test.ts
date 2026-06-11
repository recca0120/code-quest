import { describe, expect, it } from 'vitest';
import { readSrc } from '../test/read-src.ts';

const appCss = readSrc('App.css');
const chatInputAreaSrc = readSrc('components/chat/compose/ChatInputArea.tsx');
const composeToolbarSrc = readSrc('components/chat/compose/ComposeToolbar.tsx');

const hoverTintConsumers = {
  IconButton: readSrc('components/ui/IconButton.tsx'),
  PermissionModePicker: readSrc('components/chat/compose/PermissionModePicker.tsx'),
  AttachMenu: readSrc('components/chat/compose/AttachMenu.tsx'),
  ReviewUpsellBanner: readSrc('components/chat/plan-review/ReviewUpsellBanner.tsx'),
  MentionDropdown: readSrc('components/chat/compose/MentionDropdown.tsx'),
  ModelPickerPopover: readSrc('components/settings/ModelPickerPopover.tsx'),
  CommandMenu: readSrc('components/chat/compose/command-menu/CommandMenu.tsx'),
  // EffortSwitch intentionally uses `bg-white` for the slider thumb — a
  // theme-invariant affordance on the colored `bg-toggle` fill. Excluded
  // from the hover-tint consumer list for that reason.
} as const;

function extractBlock(selector: RegExp): string {
  const block = appCss.match(selector)?.[1];
  // 非空守門：block 不存在時直接 throw，避免空字串讓 not.toMatch 斷言恆真。
  if (!block) throw new Error(`extractBlock: no match in App.css for ${selector}`);
  return block;
}

// 合併所有 @theme 區塊內容（App.css 拆成多段 @theme 方便註解分組）
const themeBlock = (() => {
  const blocks: string[] = [];
  const re = /@theme\s*\{([\s\S]*?)\n\}/g;
  let m: RegExpExecArray | null;
  for (m = re.exec(appCss); m !== null; m = re.exec(appCss)) blocks.push(m[1]!);
  if (blocks.length === 0) throw new Error('No @theme blocks found in App.css');
  return blocks.join('\n');
})();
const clayDarkBlock = extractBlock(/:root\[data-theme="clay-dark"\]\s*\{([\s\S]*?)\n\}/);
const lightBlock = extractBlock(/:root\[data-theme="light"\]\s*\{([\s\S]*?)\n\}/);

describe('App.css static shape', () => {
  describe('T1 — chat-input-* token removal', () => {
    it('does not declare --color-chat-input-bg', () => {
      expect(appCss).not.toMatch(/--color-chat-input-bg\b/);
    });
    it('does not declare --color-chat-input-border', () => {
      expect(appCss).not.toMatch(/--color-chat-input-border\b/);
    });
  });

  describe('T2 — tint utilities (theme-adaptive overlay)', () => {
    it('declares @utility tint-5', () => {
      expect(appCss).toMatch(/@utility\s+tint-5\s*\{[^}]*--color-hover-tint-rgb[^}]*0\.05/);
    });
    it('declares @utility tint-10', () => {
      expect(appCss).toMatch(/@utility\s+tint-10\s*\{[^}]*--color-hover-tint-rgb[^}]*0\.1\b/);
    });
    it('does not declare the old hover-tint-* names', () => {
      expect(appCss).not.toMatch(/@utility\s+hover-tint-/);
    });
  });

  describe('T3 — permission-mode global visual CSS removed', () => {
    it('does not contain .send-btn rule', () => {
      expect(appCss).not.toMatch(/\.send-btn\b/);
    });
    it('does not contain [data-permission-mode=...]:focus-within selector', () => {
      expect(appCss).not.toMatch(/\[data-permission-mode="[^"]+"\]:focus-within/);
    });
    it('does not contain hardcoded accent/button/text rgb values', () => {
      expect(appCss).not.toMatch(/rgba\(\s*217\s*,\s*119\s*,\s*87\s*,\s*0\.2\s*\)/);
      expect(appCss).not.toMatch(/rgba\(\s*0\s*,\s*127\s*,\s*212\s*,\s*0\.2\s*\)/);
      expect(appCss).not.toMatch(/rgba\(\s*204\s*,\s*204\s*,\s*204\s*,\s*0\.1\s*\)/);
    });
  });

  describe('T4 — rgb-split tokens (clay palette)', () => {
    it('@theme declares --color-info-rgb (dark default)', () => {
      expect(themeBlock).toMatch(/--color-info-rgb:\s*130\s*,\s*163\s*,\s*201/);
    });
    it('@theme declares --color-text-rgb (dark default)', () => {
      expect(themeBlock).toMatch(/--color-text-rgb:\s*216\s*,\s*210\s*,\s*198/);
    });
    it('does not declare the removed --color-button/--color-toggle tokens', () => {
      expect(appCss).not.toMatch(/--color-button\b/);
      expect(appCss).not.toMatch(/--color-toggle\b/);
    });
    it('[data-theme="clay-dark"] re-declares info/text rgb in sync with @theme defaults', () => {
      expect(clayDarkBlock).toMatch(/--color-info-rgb:\s*130\s*,\s*163\s*,\s*201/);
      expect(clayDarkBlock).toMatch(/--color-text-rgb:\s*216\s*,\s*210\s*,\s*198/);
    });
    it('[data-theme="light"] declares info/text rgb with light values', () => {
      expect(lightBlock).toMatch(/--color-info-rgb:\s*79\s*,\s*116\s*,\s*164/);
      expect(lightBlock).toMatch(/--color-text-rgb:\s*64\s*,\s*60\s*,\s*51/);
    });
  });

  describe('T5 — mode → CSS var dispatch', () => {
    const modes = [
      ['normal', /--color-claude-clay-orange/, '0.2', '45'],
      ['plan', /--color-info\b/, '0.2', '55'],
      ['acceptEdits', /--color-text\b/, '0.1', '55'],
      ['bypassPermissions', /--color-danger/, '0', '55'],
      ['auto', /--color-danger/, '0', '55'],
    ] as const;

    for (const [mode, accentRef, shadowAlpha, composerMix] of modes) {
      it(`declares --mode-accent + --mode-shadow-alpha=${shadowAlpha} for data-mode="${mode}"`, () => {
        const block = extractBlock(
          new RegExp(`\\[data-mode="${mode}"\\][^{]*\\{([\\s\\S]*?)\\n\\}`),
        );
        expect(block).toMatch(accentRef);
        // (?!\.\d) — `0` 不可誤配 `0.2`（\b 會在 `0.` 處成立）；dot 需跳脫。
        const alphaPattern = shadowAlpha.replace('.', '\\.');
        expect(block).toMatch(new RegExp(`--mode-shadow-alpha:\\s*${alphaPattern}(?!\\.\\d)`));
      });

      it(`declares --color-composer-border as ${composerMix}% mode-accent mix for data-mode="${mode}"`, () => {
        const block = extractBlock(
          new RegExp(`\\[data-mode="${mode}"\\][^{]*\\{([\\s\\S]*?)\\n\\}`),
        );
        expect(block).toMatch(
          new RegExp(
            `--color-composer-border:\\s*color-mix\\(in srgb,\\s*var\\(--color-mode-accent\\)\\s*${composerMix}%,\\s*var\\(--color-border\\)\\)`,
          ),
        );
      });
    }
  });
});

describe('Design alignment audit — token values', () => {
  it('--radius-chip is 5px (design spec §2 badge corner radius)', () => {
    expect(themeBlock).toMatch(/--radius-chip:\s*5px/);
  });

  it('prefers-reduced-motion zeroes --theme-transition', () => {
    const rmBlock = extractBlock(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?:root\s*\{([\s\S]*?)\}/,
    );
    expect(rmBlock).toMatch(/--theme-transition:\s*0(ms|s)/);
  });

  it('[data-theme="clay-dark"] selector exists (not "dark")', () => {
    expect(appCss).toMatch(/:root\[data-theme="clay-dark"\]/);
    expect(appCss).not.toMatch(/:root\[data-theme="dark"\]/);
  });
});

// TODO(audit): 以下三個 describe 對 TSX 原始碼做 regex 斷言（脆弱、易受 refactor 影響）。
// 應改為 DOM 層測試（render 後驗 className / data-mode attribute）——屬大改，另開 change 處理。
describe('T2 tint consumers use theme tokens (no bg-white*, no hover-tint-*)', () => {
  for (const [name, src] of Object.entries(hoverTintConsumers)) {
    it(`${name}.tsx is hardcode-free`, () => {
      expect(src).not.toMatch(/\bbg-white(?:\/\d+)?\b/);
      expect(src).not.toMatch(/hover-tint-/);
    });
  }
});

describe('T1 ChatInputArea uses surface/border tokens', () => {
  it('uses bg-surface + at-rest mode-tinted composer border', () => {
    expect(chatInputAreaSrc).toMatch(/bg-surface\b/);
    expect(chatInputAreaSrc).toMatch(/border-\(--color-composer-border\)/);
    expect(chatInputAreaSrc).not.toMatch(/border-border\b/);
    expect(chatInputAreaSrc).not.toMatch(/(bg|border)-chat-input-/);
  });
  it('outer div has data-mode attribute derived from permissionMode', () => {
    expect(chatInputAreaSrc).toMatch(/data-mode=\{toPermissionMode\(permissionMode\)\}/);
  });
  it('uses CSS-var dispatch instead of per-mode focus-within variants', () => {
    expect(chatInputAreaSrc).toMatch(/focus-within:border-mode-accent\b/);
    expect(chatInputAreaSrc).toMatch(
      /focus-within:shadow-\[0_1px_2px_rgba\(var\(--color-mode-accent-rgb\),\s*var\(--mode-shadow-alpha/,
    );
    expect(chatInputAreaSrc).not.toMatch(/focus-within:data-\[mode=/);
  });
});

describe('T3 ComposeToolbar send button uses data-mode + CSS var dispatch', () => {
  it('has no send-btn legacy class', () => {
    expect(composeToolbarSrc).not.toMatch(/\bsend-btn\b/);
  });
  it('has no per-mode bg constants', () => {
    expect(composeToolbarSrc).not.toMatch(/SEND_BTN_MODE_CLASSES/);
    expect(composeToolbarSrc).not.toMatch(/SEND_BTN_CLASS_/);
    expect(composeToolbarSrc).not.toMatch(/data-\[mode=[a-zA-Z]+\]:bg-/);
  });
  it('extracted SendButton renders bg-mode-accent and data-mode from its prop', () => {
    expect(composeToolbarSrc).toMatch(/function SendButton\(/);
    expect(composeToolbarSrc).toMatch(/data-mode=\{mode\}/);
    expect(composeToolbarSrc).toMatch(/bg-mode-accent\b/);
  });
});

// ── T6 — font-scale axis (App.proposal.css §4) ──
describe('T6 — font-scale axis', () => {
  it('@theme declares --font-scale, --text-body, --text-ui, --text-code, --text-statusline', () => {
    expect(themeBlock).toMatch(/--font-scale:\s*1\b/);
    expect(themeBlock).toMatch(/--text-body:\s*calc\(13px\s*\*\s*var\(--font-scale\)\)/);
    expect(themeBlock).toMatch(/--text-ui:\s*calc\(12px\s*\*\s*var\(--font-scale\)\)/);
    expect(themeBlock).toMatch(/--text-code:\s*calc\(11\.5px\s*\*\s*var\(--font-scale\)\)/);
    expect(themeBlock).toMatch(/--text-statusline:\s*calc\(10\.5px\s*\*\s*var\(--font-scale\)\)/);
  });

  it('declares data-fontsize="s" with --font-scale: 0.92', () => {
    expect(appCss).toMatch(/:root\[data-fontsize="s"\]\s*\{\s*--font-scale:\s*0\.92/);
  });

  it('declares data-fontsize="l" and "xl"', () => {
    expect(appCss).toMatch(/:root\[data-fontsize="l"\]\s*\{\s*--font-scale:\s*1\.08/);
    expect(appCss).toMatch(/:root\[data-fontsize="xl"\]\s*\{\s*--font-scale:\s*1\.15/);
  });
});

// ── T7 — density component-token overrides (App.proposal.css §5) ──
describe('T7 — density component-token overrides', () => {
  it('@theme declares --density-row-pad-y and --msg-gap', () => {
    expect(themeBlock).toMatch(/--density-row-pad-y:\s*5px/);
    expect(themeBlock).toMatch(/--msg-gap:\s*16px/);
  });

  it('compact overrides pane-header-h / tabbar-h / tab-h / statusline-h', () => {
    const compact = extractBlock(/:root\[data-density="compact"\]\s*\{([\s\S]*?)\n\}/);
    expect(compact).toMatch(/--pane-header-h:\s*26px/);
    expect(compact).toMatch(/--tabbar-h:\s*34px/);
    expect(compact).toMatch(/--tab-h:\s*28px/);
    expect(compact).toMatch(/--statusline-h:\s*22px/);
  });

  it('relaxed overrides pane-header-h / tabbar-h / tab-h / statusline-h', () => {
    const relaxed = extractBlock(/:root\[data-density="relaxed"\]\s*\{([\s\S]*?)\n\}/);
    expect(relaxed).toMatch(/--pane-header-h:\s*34px/);
    expect(relaxed).toMatch(/--tabbar-h:\s*42px/);
    expect(relaxed).toMatch(/--statusline-h:\s*30px/);
  });
});

// ── T8 — command palette tokens (App.proposal.css §4) ──
describe('T8 — command palette tokens', () => {
  it('@theme declares palette-w, palette-input-h, palette-row-h, palette-max-h', () => {
    expect(themeBlock).toMatch(/--palette-w:\s*640px/);
    expect(themeBlock).toMatch(/--palette-input-h:\s*48px/);
    expect(themeBlock).toMatch(/--palette-row-h:\s*36px/);
    expect(themeBlock).toMatch(/--palette-max-h:\s*min\(480px,\s*64vh\)/);
  });

  it('@theme declares --color-palette-match and --dur-palette', () => {
    expect(themeBlock).toMatch(/--color-palette-match:\s*var\(--color-accent-mark-bg\)/);
    expect(themeBlock).toMatch(/--dur-palette:\s*160ms/);
  });
});

// ── T9 — V3 roast theme (App.proposal.css §6) ──
describe('T9 — V3 roast theme', () => {
  it('declares data-theme="roast" with distinct bg and accent', () => {
    const roast = extractBlock(/:root\[data-theme="roast"\]\s*\{([\s\S]*?)\n\}/);
    expect(roast).toMatch(/--color-bg:\s*#14100c/);
    expect(roast).toMatch(/--color-accent:\s*#e08348/);
    expect(roast).toMatch(/--color-text:\s*#e0d5c2/);
  });
});

// ── T10 — theme-transition token ──
describe('T10 — theme-transition token', () => {
  it('@theme declares --theme-transition', () => {
    expect(themeBlock).toMatch(/--theme-transition:\s*120ms\s+ease/);
  });
});

// ── T11 — theme transition rule ──
describe('T11 — theme transition CSS rule', () => {
  it('base layer has bg/text/border transition using --theme-transition', () => {
    expect(appCss).toMatch(/transition[\s\S]*?var\(--theme-transition\)/);
  });
});
