import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { usageOpenSignal } from '@/features/usage/usage-feature';
import { renderWithChannel } from '@/test/render-with-channel';
import { useChannelCompose, useChannelComposeActions } from '../channel/index.ts';

/** Renders a test harness that exposes compose context via UI */
function ComposeTestUI() {
  const compose = useChannelCompose();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    compose.registerFocus((pos?: number) => {
      const el = textareaRef.current;
      if (!el) return;
      if (pos !== undefined) {
        setTimeout(() => {
          el.focus();
          el.setSelectionRange(pos, pos);
        }, 0);
      } else {
        el.focus();
      }
    });
  }, [compose.registerFocus]);

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={compose.value}
        onChange={(e) => {
          const pos = e.target.selectionStart;
          compose.updateValue(e.target.value, pos);
        }}
        placeholder="compose"
      />
      <span role="status" aria-label="hasText">
        {String(compose.hasText)}
      </span>
      <span role="status" aria-label="slashFilter">
        {compose.slashFilter ?? 'null'}
      </span>
      <span role="status" aria-label="mentionOpen">
        {String(compose.mentionOpen)}
      </span>
      <span role="status" aria-label="hasTextBeforeSlash">
        {String(compose.hasTextBeforeSlash)}
      </span>
      <button type="button" onClick={compose.submit}>
        Submit
      </button>
      <button type="button" onClick={compose.focusTextarea}>
        Focus
      </button>
      <button type="button" onClick={compose.mentionFile}>
        Mention
      </button>
      <button type="button" onClick={compose.closeMention}>
        CloseMention
      </button>
      <button type="button" onClick={() => compose.addAttachments([new File([''], 'test.txt')])}>
        Attach
      </button>
      <button type="button" onClick={() => compose.insertSlashCommand('/compact ')}>
        Insert
      </button>
      <button type="button" onClick={() => compose.executeSlashCommand('/compact')}>
        Execute
      </button>
      <button type="button" onClick={compose.closeSlash}>
        CloseSlash
      </button>
      {compose.attachedFiles.map(({ file }, i) => (
        <span key={file.name}>
          {file.name}
          <button type="button" onClick={() => compose.removeAttachment(i)}>
            Remove
          </button>
        </span>
      ))}
    </div>
  );
}

async function setup() {
  return renderWithChannel(<ComposeTestUI />);
}

describe('ChannelComposeProvider', () => {
  afterEach(() => {
    usageOpenSignal.setOpen(false, null);
  });
  it('provides initial empty state', async () => {
    await setup();
    expect(screen.getByPlaceholderText('compose')).toHaveValue('');
    expect(screen.getByRole('status', { name: 'hasText' })).toHaveTextContent('false');
    expect(screen.getByRole('status', { name: 'slashFilter' })).toHaveTextContent('null');
  });

  it('hasText reflects textarea value', async () => {
    await setup();
    await userEvent.type(screen.getByPlaceholderText('compose'), 'hello');
    expect(screen.getByRole('status', { name: 'hasText' })).toHaveTextContent('true');
  });

  it('submit clears value after sending', async () => {
    await setup();
    await userEvent.type(screen.getByPlaceholderText('compose'), 'hello');
    await userEvent.click(screen.getByText('Submit'));

    expect(screen.getByPlaceholderText('compose')).toHaveValue('');
  });

  it('submit does nothing when value is empty', async () => {
    await setup();
    const textarea = screen.getByPlaceholderText('compose');
    expect(textarea).toHaveValue('');
    await userEvent.click(screen.getByText('Submit'));
    // Still empty, no error thrown
    expect(textarea).toHaveValue('');
  });

  it('focusTextarea focuses the textarea', async () => {
    await setup();
    await userEvent.click(screen.getByText('Focus'));
    expect(screen.getByPlaceholderText('compose')).toHaveFocus();
  });

  it('mentionFile sets mentionOpen to true in context', async () => {
    await setup();
    await userEvent.type(screen.getByPlaceholderText('compose'), 'hello ');
    expect(screen.getByRole('status', { name: 'mentionOpen' })).toHaveTextContent('false');
    await userEvent.click(screen.getByText('Mention'));
    expect(screen.getByRole('status', { name: 'mentionOpen' })).toHaveTextContent('true');
  });

  it('closeMention in context sets mentionOpen to false', async () => {
    await setup();
    await userEvent.type(screen.getByPlaceholderText('compose'), 'hello ');
    await userEvent.click(screen.getByText('Mention'));
    expect(screen.getByRole('status', { name: 'mentionOpen' })).toHaveTextContent('true');
    await userEvent.click(screen.getByText('CloseMention'));
    expect(screen.getByRole('status', { name: 'mentionOpen' })).toHaveTextContent('false');
  });

  it('mentionFile inserts @ at cursor position', async () => {
    await setup();
    await userEvent.type(screen.getByPlaceholderText('compose'), 'hello ');
    await userEvent.click(screen.getByText('Mention'));
    expect(screen.getByPlaceholderText('compose')).toHaveValue('hello @');
  });

  it('mentionFile does not insert duplicate @ when cursor is already after @', async () => {
    await setup();
    await userEvent.type(screen.getByPlaceholderText('compose'), '@');
    await userEvent.click(screen.getByText('Mention'));
    expect(screen.getByPlaceholderText('compose')).toHaveValue('@');
  });

  it('mentionFile called twice on / does not produce @@', async () => {
    await setup();
    await userEvent.type(screen.getByPlaceholderText('compose'), '/');
    // Simulate being called twice (e.g. StrictMode double-invoke side effect)
    await userEvent.click(screen.getByText('Mention'));
    await userEvent.click(screen.getByText('Mention'));
    expect(screen.getByPlaceholderText('compose')).toHaveValue('@');
  });

  describe('re-render isolation', () => {
    it('action-only consumer does not re-render on typing', async () => {
      const renderCount = { current: 0 };

      function Typer() {
        const { value, updateValue } = useChannelCompose();
        return (
          <textarea
            value={value}
            onChange={(e) => updateValue(e.target.value, e.target.selectionStart)}
            placeholder="typer"
          />
        );
      }

      function SiblingSpy() {
        useChannelComposeActions();
        renderCount.current += 1;
        return <span />;
      }

      await renderWithChannel(
        <>
          <Typer />
          <SiblingSpy />
        </>,
      );
      const initial = renderCount.current;

      await userEvent.type(screen.getByPlaceholderText('typer'), 'hello');

      expect(renderCount.current).toBe(initial);
    });
  });

  describe('executeSlashCommand routing', () => {
    it('falls through to sendMessage when command has no execute handler', async () => {
      const { claude } = await setup();
      const before = claude.received('user').length;
      const executeBtn = screen.getByText('Execute');
      await userEvent.click(executeBtn); // calls executeSlashCommand('/compact')
      // /compact has no execute, falls through to sendMessage → message sent
      expect(claude.received('user').length).toBeGreaterThan(before);
    });

    it('executes registry feature.execute() and opens signal instead of sending CLI message', async () => {
      // Render a UI that calls executeSlashCommand('/usage')
      const UsageExecuteUI = () => {
        const compose = useChannelCompose();
        return (
          <button type="button" onClick={() => compose.executeSlashCommand('/usage')}>
            ExecUsage
          </button>
        );
      };
      const { claude, channelId } = await renderWithChannel(<UsageExecuteUI />);
      const before = claude.received('user').length;
      await userEvent.click(screen.getByText('ExecUsage'));
      // /usage has execute() → opens signal, no CLI message
      expect(usageOpenSignal.isOpenFor(channelId)).toBe(true);
      expect(claude.received('user').length).toBe(before);
    });
  });
});
