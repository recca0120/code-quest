import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../PdfViewer.tsx', () => ({
  PdfViewer: ({ data }: { data: string }) => <div>pdf:{data}</div>,
}));

import { createFakeSummoner } from '@/test/fake-summoner';
import { FsProvidersWrapper } from '@/test/wrap-fs-providers';
import { FilePreviewModal } from '../FilePreviewModal.tsx';

function setup() {
  const summoner = createFakeSummoner();
  summoner.filesystem().setRoots(['/repo']);
  summoner.filesystem().addDirectory('/repo', []);
  function Wrapper({ children }: { children: ReactNode }) {
    return <FsProvidersWrapper socket={summoner.socket}>{children}</FsProvidersWrapper>;
  }
  return { summoner, Wrapper };
}

function installClipboardSpy() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

describe('FilePreviewModal', () => {
  beforeEach(() => {
    installClipboardSpy();
  });

  it('renders path in header and Mention / Copy path actions', async () => {
    const { summoner, Wrapper } = setup();
    summoner.filesystem().addFile('/repo/README.md', '# hi');
    render(<FilePreviewModal path="/repo/README.md" onClose={vi.fn()} onMention={vi.fn()} />, {
      wrapper: Wrapper,
    });

    expect(await screen.findByText('/repo/README.md')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mention/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy path/i })).toBeInTheDocument();
  });

  it('Mention button invokes onMention with path', async () => {
    const user = userEvent.setup();
    const { summoner, Wrapper } = setup();
    summoner.filesystem().addFile('/repo/a.ts', 'export {}');
    const onMention = vi.fn();
    render(<FilePreviewModal path="/repo/a.ts" onClose={vi.fn()} onMention={onMention} />, {
      wrapper: Wrapper,
    });
    await screen.findByText('/repo/a.ts');
    await user.click(screen.getByRole('button', { name: /mention/i }));
    expect(onMention).toHaveBeenCalledWith('/repo/a.ts');
  });

  it('Copy path writes to clipboard', async () => {
    const user = userEvent.setup({ writeToClipboard: false });
    const writeText = installClipboardSpy();
    const { summoner, Wrapper } = setup();
    summoner.filesystem().addFile('/repo/a.ts', 'export {}');
    render(<FilePreviewModal path="/repo/a.ts" onClose={vi.fn()} onMention={vi.fn()} />, {
      wrapper: Wrapper,
    });
    await screen.findByText('/repo/a.ts');
    await user.click(screen.getByRole('button', { name: /copy path/i }));
    expect(writeText).toHaveBeenCalledWith('/repo/a.ts');
  });

  it('renders file contents fetched from server', async () => {
    const { summoner, Wrapper } = setup();
    summoner.filesystem().addFile('/repo/hello.txt', 'hello world');
    render(<FilePreviewModal path="/repo/hello.txt" onClose={vi.fn()} onMention={vi.fn()} />, {
      wrapper: Wrapper,
    });
    expect(await screen.findByText(/hello world/)).toBeInTheDocument();
  });

  it('shows fallback when server returns error', async () => {
    const { Wrapper } = setup();
    render(<FilePreviewModal path="/repo/missing.txt" onClose={vi.fn()} onMention={vi.fn()} />, {
      wrapper: Wrapper,
    });
    expect(await screen.findByText(/file not found/i)).toBeInTheDocument();
  });

  describe('PDF preview', () => {
    it('renders PdfViewer for .pdf files', async () => {
      const { summoner, Wrapper } = setup();
      summoner.filesystem().addFile('/repo/doc.pdf', '%PDF-fake');
      render(<FilePreviewModal path="/repo/doc.pdf" onClose={vi.fn()} onMention={vi.fn()} />, {
        wrapper: Wrapper,
      });
      expect(await screen.findByText(/^pdf:/)).toBeInTheDocument();
    });

    it('Mention works when viewing a PDF', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      summoner.filesystem().addFile('/repo/doc.pdf', '%PDF-fake');
      const onMention = vi.fn();
      render(<FilePreviewModal path="/repo/doc.pdf" onClose={vi.fn()} onMention={onMention} />, {
        wrapper: Wrapper,
      });
      await screen.findByText(/^pdf:/);
      await user.click(screen.getByRole('button', { name: /mention/i }));
      expect(onMention).toHaveBeenCalledWith('/repo/doc.pdf');
    });

    it('shows error message when fs:read-binary returns error', async () => {
      const { Wrapper } = setup();
      render(<FilePreviewModal path="/repo/missing.pdf" onClose={vi.fn()} onMention={vi.fn()} />, {
        wrapper: Wrapper,
      });
      expect(await screen.findByText(/file not found/i)).toBeInTheDocument();
    });
  });

  describe('image preview', () => {
    it('renders <img> for image files', async () => {
      const { summoner, Wrapper } = setup();
      summoner.filesystem().addFile('/repo/photo.png', 'fake-png');
      render(<FilePreviewModal path="/repo/photo.png" onClose={vi.fn()} onMention={vi.fn()} />, {
        wrapper: Wrapper,
      });
      const img = await screen.findByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expect.stringMatching(/^data:image\/png;base64,/));
    });

    it('does not show Preview/Raw toggle for image files', async () => {
      const { summoner, Wrapper } = setup();
      summoner.filesystem().addFile('/repo/photo.png', 'fake-png');
      render(<FilePreviewModal path="/repo/photo.png" onClose={vi.fn()} onMention={vi.fn()} />, {
        wrapper: Wrapper,
      });
      await screen.findByRole('img');
      expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /raw/i })).not.toBeInTheDocument();
    });

    it('Mention works when viewing an image', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      summoner.filesystem().addFile('/repo/photo.png', 'fake-png');
      const onMention = vi.fn();
      render(<FilePreviewModal path="/repo/photo.png" onClose={vi.fn()} onMention={onMention} />, {
        wrapper: Wrapper,
      });
      await screen.findByRole('img');
      await user.click(screen.getByRole('button', { name: /mention/i }));
      expect(onMention).toHaveBeenCalledWith('/repo/photo.png');
    });
  });

  describe('markdown preview toggle', () => {
    it('renders .md file as markdown by default', async () => {
      const { summoner, Wrapper } = setup();
      summoner.filesystem().addFile('/repo/README.md', '# Hello World');
      render(<FilePreviewModal path="/repo/README.md" onClose={vi.fn()} onMention={vi.fn()} />, {
        wrapper: Wrapper,
      });
      const heading = await screen.findByRole('heading', { name: /hello world/i });
      expect(heading).toBeInTheDocument();
    });

    it('shows Preview and Raw toggle buttons for .md files', async () => {
      const { summoner, Wrapper } = setup();
      summoner.filesystem().addFile('/repo/README.md', '# Hello');
      render(<FilePreviewModal path="/repo/README.md" onClose={vi.fn()} onMention={vi.fn()} />, {
        wrapper: Wrapper,
      });
      await screen.findByRole('heading', { name: /hello/i });
      expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /raw/i })).toBeInTheDocument();
    });

    it('switches to raw source when Raw button is clicked', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      summoner.filesystem().addFile('/repo/README.md', '# Hello World');
      render(<FilePreviewModal path="/repo/README.md" onClose={vi.fn()} onMention={vi.fn()} />, {
        wrapper: Wrapper,
      });
      await screen.findByRole('heading', { name: /hello world/i });
      await user.click(screen.getByRole('button', { name: /raw/i }));
      expect(screen.queryByRole('heading', { name: /hello world/i })).not.toBeInTheDocument();
      // raw mode shows source text (may be split across tokens by syntax highlighter)
      expect(document.body.textContent).toContain('# Hello World');
    });

    it('switches back to markdown when Preview button is clicked after Raw', async () => {
      const user = userEvent.setup();
      const { summoner, Wrapper } = setup();
      summoner.filesystem().addFile('/repo/README.md', '# Hello World');
      render(<FilePreviewModal path="/repo/README.md" onClose={vi.fn()} onMention={vi.fn()} />, {
        wrapper: Wrapper,
      });
      await screen.findByRole('heading', { name: /hello world/i });
      await user.click(screen.getByRole('button', { name: /raw/i }));
      await user.click(screen.getByRole('button', { name: /preview/i }));
      expect(screen.getByRole('heading', { name: /hello world/i })).toBeInTheDocument();
    });

    it('does not show toggle buttons for non-.md files', async () => {
      const { summoner, Wrapper } = setup();
      summoner.filesystem().addFile('/repo/index.ts', 'export {}');
      render(<FilePreviewModal path="/repo/index.ts" onClose={vi.fn()} onMention={vi.fn()} />, {
        wrapper: Wrapper,
      });
      // wait for file to load (syntax highlighter may split text across tokens)
      await waitFor(() => expect(document.body.textContent).toContain('export'));
      expect(screen.queryByRole('button', { name: /preview/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /raw/i })).not.toBeInTheDocument();
    });
  });
});
