import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { ChatView } from '../components/chat/ChatView.tsx';
import {
  expectTextbox,
  SCENARIO_CLASS,
  withScenario,
  withStoryChannel,
} from '../test/story-decorator.tsx';
import { makeSimpleQA } from '../test/story-fixtures.ts';

const meta: Meta<typeof ChatView> = {
  component: ChatView,
  title: 'Scenarios/Getting Started',
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const EmptySession: Story = {
  decorators: [withStoryChannel({ className: SCENARIO_CLASS })],
  play: async ({ canvas }) => {
    await expect(await canvas.findByPlaceholderText(/focus or unfocus/i)).toBeInTheDocument();
  },
};

export const SimpleQA: Story = {
  decorators: [withScenario(makeSimpleQA())],
  play: expectTextbox,
};
