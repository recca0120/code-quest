import { describe, expect, it } from 'vitest';
import { findLeafById, type PaneNode } from '@/contexts/pane-tree';

function leaf(id: string): Extract<PaneNode, { type: 'leaf' }> {
  return { type: 'leaf', id, content: { type: 'session', channelId: id, cwd: '/test' } };
}

function split(first: PaneNode, second: PaneNode): PaneNode {
  return { type: 'split', id: 's', direction: 'h', ratio: 0.5, first, second };
}

describe('findLeafById', () => {
  it('returns the leaf when root is a single leaf matching id', () => {
    const node = leaf('a');
    expect(findLeafById(node, 'a')).toBe(node);
  });

  it('returns null when root is a leaf with different id', () => {
    expect(findLeafById(leaf('a'), 'b')).toBeNull();
  });

  it('finds a leaf in the left subtree', () => {
    const target = leaf('left');
    const root = split(target, leaf('right'));
    expect(findLeafById(root, 'left')).toBe(target);
  });

  it('finds a leaf in the right subtree', () => {
    const target = leaf('right');
    const root = split(leaf('left'), target);
    expect(findLeafById(root, 'right')).toBe(target);
  });

  it('finds a deeply nested leaf', () => {
    const target = leaf('deep');
    const root = split(leaf('a'), split(leaf('b'), target));
    expect(findLeafById(root, 'deep')).toBe(target);
  });

  it('returns null when id does not exist in tree', () => {
    const root = split(leaf('a'), leaf('b'));
    expect(findLeafById(root, 'missing')).toBeNull();
  });
});
