import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getToolIcon } from '../ToolUseHeader.tsx';

function renderIcon(toolName: string) {
  const { container } = render(getToolIcon(toolName) as React.ReactElement);
  return container;
}

describe('getToolIcon', () => {
  it.each([
    'Bash',
    'Read',
    'Write',
    'Edit',
    'MultiEdit',
    'WebSearch',
    'Agent',
    'Task',
    'mcp__my_tool',
    'UnknownTool',
  ])('renders an icon for %s tool', (toolName) => {
    expect(renderIcon(toolName).querySelector('svg')).toBeInTheDocument();
  });
});
