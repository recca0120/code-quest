import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolBlock } from '../ToolBlock.tsx';

describe('ToolBlock', () => {
  it('renders children in a border-styled container', () => {
    render(
      <ToolBlock>
        <div>content</div>
      </ToolBlock>,
    );
    const content = screen.getByText('content');
    expect(content.closest('[class*="border"]')).toBeInTheDocument();
  });
});
