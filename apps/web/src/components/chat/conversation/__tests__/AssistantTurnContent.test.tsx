import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AssistantTurn } from '@/types/ui';
import { AssistantTurnContent } from '../AssistantTurnContent.tsx';

function makeAssistantTurn(textContent: string): AssistantTurn {
  return {
    id: '1',
    type: 'assistant_turn',
    role: 'assistant',
    content: textContent,
    cliUuid: 'uuid',
    blocks: [{ id: 'b1', type: 'text', content: textContent }],
  } as unknown as AssistantTurn;
}

describe('AssistantTurnContent', () => {
  it('renders text block content', () => {
    render(<AssistantTurnContent message={makeAssistantTurn('Hello world')} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('wraps text block in Expandable', () => {
    render(<AssistantTurnContent message={makeAssistantTurn('Hello world')} />);
    expect(screen.getByLabelText('truncated-inner')).toBeInTheDocument();
  });

  it('Expandable is expanded when isLastTurn={true}', () => {
    render(<AssistantTurnContent message={makeAssistantTurn('Hello world')} isLastTurn={true} />);
    expect(screen.getByLabelText('truncated-inner')).toHaveAttribute('data-expanded', 'true');
  });

  it('Expandable is expanded even when isLastTurn={false} (every completed turn shows its answer)', () => {
    render(<AssistantTurnContent message={makeAssistantTurn('Hello world')} isLastTurn={false} />);
    expect(screen.getByLabelText('truncated-inner')).toHaveAttribute('data-expanded', 'true');
  });

  it('Expandable is expanded when isLastTurn is omitted', () => {
    render(<AssistantTurnContent message={makeAssistantTurn('Hello world')} />);
    expect(screen.getByLabelText('truncated-inner')).toHaveAttribute('data-expanded', 'true');
  });

  it('passes estimatedTokens to ThinkingBlock when streaming', () => {
    const message: AssistantTurn = {
      id: '1',
      type: 'assistant_turn',
      role: 'assistant',
      content: '',
      blocks: [
        {
          id: 'b1',
          type: 'thinking',
          content: 'plan',
          isStreaming: true,
          estimatedTokens: 800,
        },
      ],
    } as unknown as AssistantTurn;
    render(<AssistantTurnContent message={message} />);
    expect(screen.getByText('· 800 tokens')).toBeInTheDocument();
  });
});
