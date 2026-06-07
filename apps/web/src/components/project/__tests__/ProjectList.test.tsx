import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Project } from '@/contexts/ProjectContext';
import { createTestWrapper } from '@/test/create-test-wrapper';
import { ProjectList } from '../ProjectList.tsx';

function makeWrapper() {
  const { summoner, Wrapper } = createTestWrapper();
  if (!summoner.claude().hasInitSegments) summoner.claude().prepareInit();
  return Wrapper;
}

const projects: Project[] = [
  { cwd: '/code-quest', name: 'code-quest', pinned: false, lastOpenedAt: '2025-01-01T00:00:00Z' },
  { cwd: '/DQ', name: 'DQ', pinned: false, lastOpenedAt: '2025-01-01T00:00:00Z' },
];

describe('ProjectList', () => {
  it('renders project cards', () => {
    render(
      <ProjectList
        projects={projects}
        activeProjectCwd="/code-quest"
        onSelect={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText(/code-quest/)).toBeInTheDocument();
    expect(screen.getByText(/DQ/)).toBeInTheDocument();
  });

  it('renders Add Project button with dashed border style', () => {
    render(
      <ProjectList projects={[]} activeProjectCwd={null} onSelect={() => {}} onAdd={() => {}} />,
    );
    const btn = screen.getByRole('button', { name: /add project/i });
    expect(btn.textContent).toBe('+ Add Project');
    // dashed-border + hover:accent per mockup .add-btn
    expect(btn.className).toContain('border-dashed');
    expect(btn.className).toContain('hover:border-accent');
  });

  it('calls onAdd when Add Project button clicked', async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<ProjectList projects={[]} activeProjectCwd={null} onSelect={() => {}} onAdd={onAdd} />);
    await user.click(screen.getByRole('button', { name: /add project/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('calls onSelect with cwd when card clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ProjectList
        projects={projects}
        activeProjectCwd="/code-quest"
        onSelect={onSelect}
        onAdd={() => {}}
      />,
    );
    await user.click(screen.getByText(/DQ/));
    expect(onSelect).toHaveBeenCalledWith('/DQ');
  });

  describe('Pinned / Recent grouping', () => {
    const mixed: Project[] = [
      { cwd: '/a', name: 'A', pinned: true, lastOpenedAt: '2025-01-03T10:00:00Z' },
      { cwd: '/b', name: 'B', pinned: false, lastOpenedAt: '2025-01-04T10:00:00Z' },
      { cwd: '/c', name: 'C', pinned: true, lastOpenedAt: '2025-01-01T10:00:00Z' },
      { cwd: '/d', name: 'D', pinned: false, lastOpenedAt: '2025-01-02T10:00:00Z' },
    ];

    it('renders both Pinned and Recent headers when both groups have items', () => {
      render(
        <ProjectList
          projects={mixed}
          activeProjectCwd={null}
          onSelect={() => {}}
          onAdd={() => {}}
        />,
      );
      expect(screen.getByText(/Pinned/i)).toBeInTheDocument();
      expect(screen.getByText(/Recent/i)).toBeInTheDocument();
    });

    it('orders pinned by lastOpenedAt desc, then recent by lastOpenedAt desc', () => {
      render(
        <ProjectList
          projects={mixed}
          activeProjectCwd={null}
          onSelect={() => {}}
          onAdd={() => {}}
        />,
      );
      const cards = screen
        .getAllByRole('button')
        .filter((b) => /^[A-D]$/.test(b.textContent ?? ''));
      // Expected: A (pinned, newer), C (pinned, older), B (recent, newer), D (recent, older)
      expect(cards.map((c) => c.textContent)).toEqual(['A', 'C', 'B', 'D']);
    });

    it('omits Recent header when all projects pinned', () => {
      const allPinned = mixed.map((p) => ({ ...p, pinned: true }));
      render(
        <ProjectList
          projects={allPinned}
          activeProjectCwd={null}
          onSelect={() => {}}
          onAdd={() => {}}
        />,
      );
      expect(screen.getByText(/Pinned/i)).toBeInTheDocument();
      expect(screen.queryByText(/Recent/i)).not.toBeInTheDocument();
    });

    it('propagates pinned flag so pinned cards show Unpin and unpinned show Pin', () => {
      const Wrapper = makeWrapper();
      render(
        <Wrapper>
          <ProjectList
            projects={[
              { cwd: '/a', name: 'A', pinned: true, lastOpenedAt: '2025-01-03T10:00:00Z' },
              { cwd: '/b', name: 'B', pinned: false, lastOpenedAt: '2025-01-02T10:00:00Z' },
            ]}
            activeProjectCwd={null}
            onSelect={() => {}}
            onAdd={() => {}}
          />
        </Wrapper>,
      );
      expect(screen.getByRole('button', { name: /unpin/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^pin$/i })).toBeInTheDocument();
    });

    it('omits Pinned header when none pinned', () => {
      const nonePinned = mixed.map((p) => ({ ...p, pinned: false }));
      render(
        <ProjectList
          projects={nonePinned}
          activeProjectCwd={null}
          onSelect={() => {}}
          onAdd={() => {}}
        />,
      );
      expect(screen.queryByText(/Pinned/i)).not.toBeInTheDocument();
      // No section header when only one group — keeps existing single-group layout
    });
  });
});
