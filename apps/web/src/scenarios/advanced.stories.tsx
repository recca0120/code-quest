import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatView } from '../components/chat/ChatView.tsx';
import { expectTextbox, withScenario } from '../test/story-decorator.tsx';
import {
  makeMultiToolChainAdvanced,
  makeStreamlinedOutput,
  makeTaskStarted,
  makeThinkingBlock,
} from '../test/story-fixtures.ts';

const meta: Meta<typeof ChatView> = {
  component: ChatView,
  title: 'Scenarios/Advanced',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ThinkingBlock: Story = {
  decorators: [withScenario(makeThinkingBlock())],
  play: expectTextbox,
};

export const MultiToolChain: Story = {
  decorators: [withScenario(makeMultiToolChainAdvanced())],
  play: expectTextbox,
};

export const StreamlinedOutput: Story = {
  decorators: [withScenario(makeStreamlinedOutput())],
  play: expectTextbox,
};

export const TaskStarted: Story = {
  decorators: [withScenario(makeTaskStarted())],
  play: expectTextbox,
};
