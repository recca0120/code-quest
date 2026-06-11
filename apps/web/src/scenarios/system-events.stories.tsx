import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatView } from '../components/chat/ChatView.tsx';
import { expectTextbox, withScenario } from '../test/story-decorator.tsx';
import {
  makeCompactBoundary,
  makeErrorRecovery,
  makeHookExecution,
  makeInterrupt,
  makeRateLimitEvent,
} from '../test/story-fixtures.ts';

const meta: Meta<typeof ChatView> = {
  component: ChatView,
  title: 'Scenarios/System Events',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const ErrorRecovery: Story = {
  decorators: [withScenario(makeErrorRecovery())],
  play: expectTextbox,
};

export const RateLimit: Story = {
  decorators: [withScenario(makeRateLimitEvent())],
  play: expectTextbox,
};

export const CompactBoundary: Story = {
  decorators: [withScenario(makeCompactBoundary())],
  play: expectTextbox,
};

export const Interrupt: Story = {
  decorators: [withScenario(makeInterrupt())],
  play: expectTextbox,
};

export const HookExecution: Story = {
  decorators: [withScenario(makeHookExecution())],
  play: expectTextbox,
};
