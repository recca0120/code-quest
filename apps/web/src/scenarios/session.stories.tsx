import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatView } from '../components/chat/ChatView.tsx';
import { expectTextbox, withScenario } from '../test/story-decorator.tsx';
import {
  makeDisconnectedSession,
  makeLongConversation,
  makeProcessingWithTool,
} from '../test/story-fixtures.ts';

const meta: Meta<typeof ChatView> = {
  component: ChatView,
  title: 'Scenarios/Session',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const CompletedSession: Story = {
  decorators: [withScenario(makeLongConversation())],
  play: expectTextbox,
};

export const Processing: Story = {
  decorators: [withScenario({ ...makeProcessingWithTool(), status: 'processing' })],
  play: expectTextbox,
};

export const Disconnected: Story = {
  decorators: [withScenario({ ...makeDisconnectedSession(), status: 'disconnected' })],
  play: expectTextbox,
};
