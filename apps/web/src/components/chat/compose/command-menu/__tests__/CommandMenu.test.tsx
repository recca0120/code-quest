import { segments as s } from '@code-quest/test-kit';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComposeInput } from '@/components/chat/compose/ComposeInput';
import { generalConfigSignal } from '@/features/general-config/general-config-feature';
import { modelOpenSignal } from '@/features/model/model-feature';
import { resumeOpenSignal } from '@/features/resume/resume-feature';
import { rewindOpenSignal } from '@/features/rewind/rewind-feature';
import { switchAccountSignal } from '@/features/switch-account/switch-account-feature';
import { usageOpenSignal } from '@/features/usage/usage-feature';
import { COMPOSE_PLACEHOLDER } from '@/test/helpers';
import { renderWithChannel } from '@/test/render-with-channel';
import { CommandMenu } from '../CommandMenu.tsx';

const containerRef = createRef<HTMLDivElement>();

const defaultControlResponse = s.controlResponse('init', {
  models: [{ value: 'claude-sonnet-4-6', displayName: 'Sonnet 4.6' }],
});

async function renderCommandMenu(
  props: Partial<React.ComponentProps<typeof CommandMenu>> = {},
  initOpts?: Parameters<typeof s.init>[1],
  extraSegments?: string[],
) {
  return renderWithChannel(<CommandMenu containerRef={containerRef} {...props} />, {
    initSegment: s.init('sess-1', initOpts),
    extraSegments: extraSegments ?? [defaultControlResponse],
  });
}

async function openMenu() {
  await userEvent.click(screen.getByTitle('Show command menu (/)'));
}

describe('CommandMenu', () => {
  afterEach(() => {
    modelOpenSignal.setOpen(false, null);
    resumeOpenSignal.setOpen(false, null);
    switchAccountSignal.setOpen(false, null);
    generalConfigSignal.setOpen(false, null);
    rewindOpenSignal.setOpen(false, null);
    usageOpenSignal.setOpen(false, null);
  });
  it('renders / command menu button', async () => {
    await renderCommandMenu();
    expect(screen.getByTitle('Show command menu (/)')).toBeInTheDocument();
  });

  it('reads slashCommands from context and shows them in menu', async () => {
    // /compact is registry-managed → filtered from CLI list; /cost is CLI-only → shown
    await renderCommandMenu({}, { slashCommands: ['compact', 'cost'] });
    await openMenu();
    expect(screen.queryByText('/compact')).not.toBeInTheDocument();
    expect(screen.getByText('/cost')).toBeInTheDocument();
  });

  it('reads effort from context and shows Effort item', async () => {
    await renderCommandMenu();
    await userEvent.click(screen.getByTitle('Show command menu (/)'));
    expect(screen.getByText('Effort')).toBeInTheDocument();
  });

  it('sets modelOpenSignal when Switch model clicked', async () => {
    const { channelId } = await renderCommandMenu();
    await userEvent.click(screen.getByTitle('Show command menu (/)'));
    await userEvent.click(screen.getByText('Switch model'));
    expect(modelOpenSignal.isOpenFor(channelId)).toBe(true);
  });

  it('only accepts dialog callback props — no modelLabel/effort/slashCommands props', async () => {
    await renderCommandMenu({}, { slashCommands: ['test'] });
    // No error — context provides the data
  });

  describe('filter input visibility', () => {
    it('shows filter input when opened via button', async () => {
      await renderCommandMenu();
      await userEvent.click(screen.getByTitle('Show command menu (/)'));
      expect(screen.getByPlaceholderText('Filter actions...')).toBeInTheDocument();
    });
  });

  describe('feature signals and callbacks', () => {
    it('clicking "Clear conversation" sends /clear to CLI', async () => {
      const { claude } = await renderCommandMenu();
      await openMenu();
      await userEvent.click(await screen.findByText('Clear conversation'));
      expect(claude.received('user').at(-1)).toMatchObject({
        message: { content: [{ text: '/clear' }] },
      });
    });

    it('filtering "new" reveals "New conversation" and clicking sends /new to CLI', async () => {
      const { claude } = await renderCommandMenu();
      await openMenu();
      await userEvent.type(screen.getByPlaceholderText('Filter actions...'), 'new');
      await userEvent.click(await screen.findByText('New conversation'));
      expect(claude.received('user').at(-1)).toMatchObject({
        message: { content: [{ text: '/new' }] },
      });
    });

    it('clicking "Attach file…" triggers onAttachFile callback', async () => {
      const onAttachFile = vi.fn();
      await renderCommandMenu({ onAttachFile });
      await openMenu();
      await userEvent.click(await screen.findByText('Attach file…'));
      expect(onAttachFile).toHaveBeenCalledOnce();
    });

    it('clicking "Manage plugins" triggers onManagePlugins callback', async () => {
      const onManagePlugins = vi.fn();
      await renderCommandMenu({ onManagePlugins });
      await openMenu();
      await userEvent.click(await screen.findByText('Manage plugins'));
      expect(onManagePlugins).toHaveBeenCalledOnce();
    });

    it('clicking "Resume conversation…" sets resumeOpenSignal', async () => {
      const { channelId } = await renderCommandMenu();
      await openMenu();
      await userEvent.click(await screen.findByText('Resume conversation…'));
      expect(resumeOpenSignal.isOpenFor(channelId)).toBe(true);
    });

    it('clicking "Switch account" sets switchAccountSignal', async () => {
      await renderCommandMenu();
      await openMenu();
      await userEvent.click(await screen.findByText('Switch account'));
      expect(switchAccountSignal.isOpenFor('__global__')).toBe(true);
    });

    it('clicking "General config…" sets generalConfigSignal', async () => {
      await renderCommandMenu();
      await openMenu();
      await userEvent.click(await screen.findByText('General config…'));
      expect(generalConfigSignal.isOpenFor('__global__')).toBe(true);
    });

    it('clicking "Rewind" sets rewindOpenSignal', async () => {
      const { channelId } = await renderCommandMenu();
      await openMenu();
      await userEvent.click(await screen.findByText('Rewind'));
      expect(rewindOpenSignal.isOpenFor(channelId)).toBe(true);
    });

    it('clicking "Account & usage…" sets usageOpenSignal', async () => {
      const { channelId } = await renderCommandMenu();
      await openMenu();
      await userEvent.click(await screen.findByText('Account & usage…'));
      expect(usageOpenSignal.isOpenFor(channelId)).toBe(true);
    });

    it('clicking "Manage MCP servers" triggers onToggleMcp callback', async () => {
      const onToggleMcp = vi.fn();
      await renderCommandMenu({ onToggleMcp });
      await openMenu();
      await userEvent.click(await screen.findByText('Manage MCP servers'));
      expect(onToggleMcp).toHaveBeenCalledOnce();
    });

    it('clicking "MCP status" triggers onMcpStatus callback', async () => {
      const onMcpStatus = vi.fn();
      await renderCommandMenu({ onMcpStatus });
      await openMenu();
      await userEvent.click(await screen.findByText('MCP status'));
      expect(onMcpStatus).toHaveBeenCalledOnce();
    });
  });

  describe('model feature interactions', () => {
    it('clicking Effort item cycles effort level and server emits settings:update', async () => {
      const effortModel = s.controlResponse('init', {
        models: [
          {
            value: 'claude-sonnet-4-6',
            displayName: 'Sonnet',
            supportsEffort: true,
            supportedEffortLevels: ['low', 'medium', 'high', 'max'],
          },
        ],
      });
      const { summoner, claude, channelId } = await renderCommandMenu({}, undefined, [effortModel]);
      // Set effort to 'low' via server push so context has a known starting state
      await act(async () => {
        claude.pushServerEvent('settings:update', { channelId, effort: 'low' });
      });
      await openMenu();
      await userEvent.click(screen.getByText(/^Effort/));
      await vi.waitFor(() => {
        const updates = summoner.receivedEvents('settings:update');
        expect(updates.some((u) => u.effort === 'medium')).toBe(true);
      });
    });

    it('clicking Thinking item toggles thinking level and server emits settings:update', async () => {
      const { summoner, claude, channelId } = await renderCommandMenu();
      await act(async () => {
        claude.pushServerEvent('settings:update', { channelId, thinkingLevel: 'off' });
      });
      await openMenu();
      await userEvent.click(screen.getByText('Thinking'));
      const updates = summoner.receivedEvents('settings:update');
      expect(updates.some((u) => u.thinkingLevel === 'default_on')).toBe(true);
    });

    it('clicking a toggle item keeps the menu open (so user can flip multiple toggles)', async () => {
      const { claude, channelId } = await renderCommandMenu();
      await act(async () => {
        claude.pushServerEvent('settings:update', { channelId, thinkingLevel: 'off' });
      });
      await openMenu();
      const thinking = screen.getByText('Thinking');
      await userEvent.click(thinking);
      // Toggle items should NOT collapse the menu — user expects to keep
      // flipping switches without re-opening.
      expect(screen.getByText('Thinking')).toBeInTheDocument();
    });

    it('clicking fast mode item toggles fast mode and server emits settings:update', async () => {
      const { summoner } = await renderWithChannel(<CommandMenu containerRef={containerRef} />, {
        initSegment: s.init('sess-1', { fastModeState: 'off' }),
        extraSegments: [
          s.controlResponse('init', {
            models: [
              {
                value: 'claude-sonnet-4-6',
                displayName: 'Sonnet',
                supportsFastMode: true,
              },
            ],
          }),
        ],
      });
      await openMenu();
      await userEvent.click(screen.getByText('Toggle fast mode'));
      const updates = summoner.receivedEvents('settings:update');
      expect(updates.some((u) => u.fastModeState === 'on')).toBe(true);
    });
  });

  describe('semantic HTML / a11y roles', () => {
    it('popup container has role="menu"', async () => {
      await renderCommandMenu();
      await userEvent.click(screen.getByTitle('Show command menu (/)'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('each action button has role="menuitem"', async () => {
      await renderCommandMenu();
      await userEvent.click(screen.getByTitle('Show command menu (/)'));
      const items = screen.getAllByRole('menuitem');
      expect(items.length).toBeGreaterThan(0);
    });

    it('each section is a role="group" with aria-label', async () => {
      await renderCommandMenu({}, { slashCommands: ['compact'] });
      await userEvent.click(screen.getByTitle('Show command menu (/)'));
      // At least one group should exist (e.g. "Slash commands" section)
      const groups = screen.getAllByRole('group');
      expect(groups.length).toBeGreaterThan(0);
      for (const g of groups) {
        expect(g).toHaveAttribute('aria-label');
      }
    });
  });

  describe('slash palette visibility on external (compose-driven) open', () => {
    function ComposeAndMenu() {
      return (
        <>
          <ComposeInput containerRef={containerRef} />
          <CommandMenu containerRef={containerRef} />
        </>
      );
    }

    it('keeps the palette visible for unmatched filter with no whitespace', async () => {
      await renderWithChannel(<ComposeAndMenu />, {
        initSegment: s.init('sess-1'),
        extraSegments: [defaultControlResponse],
      });
      await userEvent.type(screen.getByPlaceholderText(COMPOSE_PLACEHOLDER), '/zzznomatch');
      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getByText('No matching commands')).toBeInTheDocument();
    });

    it('hides the palette the moment the user types a space after the slash', async () => {
      await renderWithChannel(<ComposeAndMenu />, {
        initSegment: s.init('sess-1'),
        extraSegments: [defaultControlResponse],
      });
      await userEvent.type(screen.getByPlaceholderText(COMPOSE_PLACEHOLDER), '/test ');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('shows the palette when a registered slash matches', async () => {
      await renderWithChannel(<ComposeAndMenu />, {
        initSegment: s.init('sess-1'),
        extraSegments: [defaultControlResponse],
      });
      await userEvent.type(screen.getByPlaceholderText(COMPOSE_PLACEHOLDER), '/btw');
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('hides the palette for a leading-space filter like "/ wiki"', async () => {
      await renderWithChannel(<ComposeAndMenu />, {
        initSegment: s.init('sess-1'),
        extraSegments: [defaultControlResponse],
      });
      await userEvent.type(screen.getByPlaceholderText(COMPOSE_PLACEHOLDER), '/ wiki');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('Enter with unmatched slash sends raw text to CLI', async () => {
      const { claude } = await renderWithChannel(<ComposeAndMenu />, {
        initSegment: s.init('sess-1'),
        extraSegments: [defaultControlResponse],
      });
      const compose = screen.getByPlaceholderText(COMPOSE_PLACEHOLDER);
      const before = claude.received('user').length;
      await userEvent.type(compose, '/zzznomatch{Enter}');
      const sent = claude.received('user').slice(before);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({
        message: { content: [{ text: '/zzznomatch' }] },
      });
      expect(compose).toHaveValue('');
    });
  });
});
