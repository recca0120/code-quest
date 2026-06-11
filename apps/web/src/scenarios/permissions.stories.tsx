import type { PendingControl } from '@code-quest/schemas';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatView } from '../components/chat/ChatView.tsx';
import { expectTextbox, SCENARIO_CLASS, withStoryChannel } from '../test/story-decorator.tsx';
import {
  makePlanReviewFlow,
  makeToolApprovalFlow,
  makeToolDenialFlow,
} from '../test/story-fixtures.ts';
import type { Message } from '../types/ui.ts';

const meta: Meta<typeof ChatView> = {
  component: ChatView,
  title: 'Scenarios/Permissions',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

function withPendingChannel(createFlow: () => { messages: Message[]; pending: PendingControl[] }) {
  const { messages, pending } = createFlow();
  return withStoryChannel({
    className: SCENARIO_CLASS,
    messages: { messages },
    pendingControls: pending,
  });
}

export const ToolApproval: Story = {
  decorators: [withPendingChannel(makeToolApprovalFlow)],
  play: expectTextbox,
};

export const ToolDenial: Story = {
  decorators: [withPendingChannel(makeToolDenialFlow)],
  play: expectTextbox,
};

export const PlanReview: Story = {
  decorators: [withPendingChannel(makePlanReviewFlow)],
  play: expectTextbox,
};
