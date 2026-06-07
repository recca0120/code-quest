import type { PlanCommentData } from '@code-quest/schemas';
import { fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PlanCommentPopover } from '../PlanCommentPopover.tsx';

function Wrapper({ onAddComment }: { onAddComment: (comment: PlanCommentData) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <p>Some plan content to select</p>
      <PlanCommentPopover containerRef={ref} onAddComment={onAddComment} />
    </div>
  );
}

describe('PlanCommentPopover', () => {
  it('does not show overlay when no selection', () => {
    const onAddComment = vi.fn<(comment: PlanCommentData) => void>();
    render(<Wrapper onAddComment={onAddComment} />);
    // Trigger mouseup without selection
    fireEvent.mouseUp(screen.getByText('Some plan content to select'));
    expect(screen.queryByPlaceholderText('Add comment...')).toBeNull();
  });
});
