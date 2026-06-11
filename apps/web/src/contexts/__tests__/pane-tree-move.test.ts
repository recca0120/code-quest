/**
 * movePaneTo 純函式（tmux-workspace-ui P4；spec: 拖曳重排五落點）
 * 四方向落點＝source 移除（樹收斂）＋ target 該方向 split 放入 source content。
 */
import { describe, expect, it } from 'vitest';
import { movePaneTo, type PaneNode } from '@/contexts/pane-tree';

function leaf(id: string, cwd: string): PaneNode {
  return { type: 'leaf', id, content: { type: 'git', target: { kind: 'fixed', cwd } } };
}

function threePanes(): PaneNode {
  // [A | [B / C]]
  return {
    type: 'split',
    id: 's1',
    direction: 'h',
    ratio: 0.5,
    first: leaf('A', '/a'),
    second: {
      type: 'split',
      id: 's2',
      direction: 'v',
      ratio: 0.5,
      first: leaf('B', '/b'),
      second: leaf('C', '/c'),
    },
  };
}

describe('movePaneTo', () => {
  it('right：A 拖到 C 的右落點 → C 變 h-split、A 在右半、原 s1 收斂', () => {
    const next = movePaneTo(threePanes(), 'A', 'C', 'right');
    // A 原位置移除後 s1 收斂成 s2；C 位置變成 split(h, C, A)
    if (next.type !== 'split') throw new Error('root should be s2');
    expect(next.id).toBe('s2');
    const cSpot = next.second;
    if (cSpot.type !== 'split') throw new Error('C spot should be split');
    expect(cSpot.direction).toBe('h');
    expect(cSpot.first).toMatchObject({ id: 'C' });
    expect(cSpot.second).toMatchObject({ content: { target: { cwd: '/a' } } });
  });

  it('top：A 拖到 B 的上落點 → B 變 v-split、A 在上半', () => {
    const next = movePaneTo(threePanes(), 'A', 'B', 'top');
    if (next.type !== 'split') throw new Error('root');
    const bSpot = next.first;
    if (bSpot.type !== 'split') throw new Error('B spot');
    expect(bSpot.direction).toBe('v');
    expect(bSpot.first).toMatchObject({ content: { target: { cwd: '/a' } } });
    expect(bSpot.second).toMatchObject({ id: 'B' });
  });

  it('source 與 target 相同或不存在 → 原樹不變（same reference）', () => {
    const root = threePanes();
    expect(movePaneTo(root, 'A', 'A', 'left')).toBe(root);
    expect(movePaneTo(root, 'nope', 'C', 'left')).toBe(root);
    expect(movePaneTo(root, 'A', 'nope', 'left')).toBe(root);
  });

  it('兩-pane 樹移動後仍是兩-pane（方向重排）', () => {
    const root: PaneNode = {
      type: 'split',
      id: 's1',
      direction: 'h',
      ratio: 0.5,
      first: leaf('A', '/a'),
      second: leaf('B', '/b'),
    };
    // A 拖到 B 的下落點 → root 收斂成 B 後 split v(B, A)
    const next = movePaneTo(root, 'A', 'B', 'bottom');
    if (next.type !== 'split') throw new Error('split');
    expect(next.direction).toBe('v');
    expect(next.first).toMatchObject({ id: 'B' });
    expect(next.second).toMatchObject({ content: { target: { cwd: '/a' } } });
  });
});
