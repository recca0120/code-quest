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
  return appCss.match(selector)?.[1] ?? '';
}

const themeBlock = extractBlock(/@theme\s*\{([\s\S]*?)\n\}/);
const darkBlock = extractBlock(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
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
    it('[data-theme="dark"] re-declares info/text rgb in sync with @theme defaults', () => {
      expect(darkBlock).toMatch(/--color-info-rgb:\s*130\s*,\s*163\s*,\s*201/);
      expect(darkBlock).toMatch(/--color-text-rgb:\s*216\s*,\s*210\s*,\s*198/);
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
        expect(block).toMatch(new RegExp(`--mode-shadow-alpha:\\s*${shadowAlpha}\\b`));
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
