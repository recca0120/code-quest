import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatView } from '../components/chat/ChatView.tsx';
import { expectTextbox, withScenario } from '../test/story-decorator.tsx';
import {
  makeBashExecution,
  makeEditWithDiff,
  makeLongConversation,
  makeReadAndGrep,
} from '../test/story-fixtures.ts';

const meta: Meta<typeof ChatView> = {
  component: ChatView,
  title: 'Scenarios/Tool Use',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ReadAndGrep: Story = {
  decorators: [withScenario(makeReadAndGrep())],
  play: expectTextbox,
};

export const EditWithDiff: Story = {
  decorators: [withScenario(makeEditWithDiff())],
  play: expectTextbox,
};

export const BashExecution: Story = {
  decorators: [withScenario(makeBashExecution())],
  play: expectTextbox,
};

export const MultiToolChain: Story = {
  decorators: [withScenario(makeLongConversation())],
  play: expectTextbox,
};
