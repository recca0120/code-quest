import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: '' }));

// Simulate ResizeObserver firing with a fixed width so baseWidth > 0
vi.stubGlobal(
  'ResizeObserver',
  class {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe(_el: Element) {
      this.cb([{ contentRect: { width: 600 } } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  },
);

vi.mock('react-pdf', () => ({
  Document: ({
    onLoadSuccess,
    children,
  }: {
    onLoadSuccess?: (pdf: { numPages: number }) => void;
    children?: React.ReactNode;
  }) => {
    useEffect(() => {
      onLoadSuccess?.({ numPages: 3 });
    }, [onLoadSuccess]);
    return <section aria-label="PDF document">{children}</section>;
  },
  Page: ({ pageNumber }: { pageNumber: number }) => (
    <section aria-label="pdf-page">page-{pageNumber}</section>
  ),
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' } },
}));

import { PdfViewer } from '../PdfViewer.tsx';

const prev = () => screen.getAllByRole('button', { name: /previous/i })[0]!;
const next = () => screen.getAllByRole('button', { name: /next/i })[0]!;
const zoomIn = () => screen.getAllByRole('button', { name: /zoom in/i })[0]!;
const zoomOut = () => screen.getAllByRole('button', { name: /zoom out/i })[0]!;

describe('PdfViewer', () => {
  const base64Data = 'JVBERi0xLjQ='; // minimal fake base64

  it('renders the first page and page counter on load', () => {
    render(<PdfViewer data={base64Data} />);
    expect(screen.getByLabelText('pdf-page')).toHaveTextContent('page-1');
    expect(screen.getAllByText('1 / 3')[0]).toBeInTheDocument();
  });

  it('previous button is disabled on first page', () => {
    render(<PdfViewer data={base64Data} />);
    expect(prev()).toBeDisabled();
  });

  it('next button is enabled when there are multiple pages', () => {
    render(<PdfViewer data={base64Data} />);
    expect(next()).toBeEnabled();
  });

  it('advances to page 2 when next is clicked', async () => {
    render(<PdfViewer data={base64Data} />);
    await userEvent.click(next());
    expect(screen.getByLabelText('pdf-page')).toHaveTextContent('page-2');
    expect(screen.getAllByText('2 / 3')[0]).toBeInTheDocument();
  });

  it('next button is disabled on last page', async () => {
    render(<PdfViewer data={base64Data} />);
    await userEvent.click(next());
    await userEvent.click(next());
    expect(next()).toBeDisabled();
  });

  it('goes back to page 1 when previous is clicked from page 2', async () => {
    render(<PdfViewer data={base64Data} />);
    await userEvent.click(next());
    await userEvent.click(prev());
    expect(screen.getByLabelText('pdf-page')).toHaveTextContent('page-1');
    expect(screen.getAllByText('1 / 3')[0]).toBeInTheDocument();
  });

  it('shows 100% zoom by default', () => {
    render(<PdfViewer data={base64Data} />);
    expect(screen.getAllByText('100%')[0]).toBeInTheDocument();
  });

  it('zoom in increases scale to 125%', async () => {
    render(<PdfViewer data={base64Data} />);
    await userEvent.click(zoomIn());
    expect(screen.getAllByText('125%')[0]).toBeInTheDocument();
  });

  it('zoom out decreases scale to 75%', async () => {
    render(<PdfViewer data={base64Data} />);
    await userEvent.click(zoomOut());
    expect(screen.getAllByText('75%')[0]).toBeInTheDocument();
  });

  it('zoom out button is disabled at minimum scale (25%)', async () => {
    render(<PdfViewer data={base64Data} />);
    for (let i = 0; i < 4; i++) await userEvent.click(zoomOut());
    expect(zoomOut()).toBeDisabled();
    expect(screen.getAllByText('25%')[0]).toBeInTheDocument();
  });

  it('zoom in button is disabled at maximum scale (200%)', async () => {
    render(<PdfViewer data={base64Data} />);
    for (let i = 0; i < 4; i++) await userEvent.click(zoomIn());
    expect(zoomIn()).toBeDisabled();
    expect(screen.getAllByText('200%')[0]).toBeInTheDocument();
  });

  const nativeMouseDown = async (target: Element, init: MouseEventInit) => {
    await act(async () => {
      target.dispatchEvent(
        new MouseEvent('mousedown', { bubbles: true, cancelable: true, ...init }),
      );
    });
  };

  describe('drag to pan', () => {
    it('cursor changes to grabbing while dragging', async () => {
      render(<PdfViewer data={base64Data} />);
      const viewport = screen.getByRole('region', { name: 'PDF viewport' });
      expect(viewport).toHaveStyle({ cursor: 'grab' });
      await nativeMouseDown(viewport, { clientX: 100, clientY: 100 });
      expect(viewport).toHaveStyle({ cursor: 'grabbing' });
      fireEvent.mouseUp(document);
      expect(viewport).toHaveStyle({ cursor: 'grab' });
    });

    it('scrolls the viewport when dragged', async () => {
      render(<PdfViewer data={base64Data} />);
      const viewport = screen.getByRole('region', { name: 'PDF viewport' });
      Object.defineProperty(viewport, 'scrollLeft', { writable: true, value: 0 });
      Object.defineProperty(viewport, 'scrollTop', { writable: true, value: 0 });
      await nativeMouseDown(viewport, { clientX: 200, clientY: 150 });
      fireEvent.mouseMove(document, { clientX: 180, clientY: 130 });
      expect(viewport.scrollLeft).toBe(20);
      expect(viewport.scrollTop).toBe(20);
    });

    it('stops scrolling after mouseup', async () => {
      render(<PdfViewer data={base64Data} />);
      const viewport = screen.getByRole('region', { name: 'PDF viewport' });
      Object.defineProperty(viewport, 'scrollLeft', { writable: true, value: 0 });
      Object.defineProperty(viewport, 'scrollTop', { writable: true, value: 0 });
      await nativeMouseDown(viewport, { clientX: 200, clientY: 150 });
      fireEvent.mouseUp(document);
      fireEvent.mouseMove(document, { clientX: 180, clientY: 130 });
      expect(viewport.scrollLeft).toBe(0);
      expect(viewport.scrollTop).toBe(0);
    });
  });

  describe('Ctrl+wheel zoom', () => {
    const wheel = async (el: HTMLElement, opts: { ctrlKey: boolean; deltaY: number }) => {
      await act(async () => {
        const event = new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: opts.deltaY,
        });
        Object.defineProperty(event, 'ctrlKey', { value: opts.ctrlKey, configurable: true });
        el.dispatchEvent(event);
      });
    };

    it('zooms in when Ctrl+wheel scrolls up', async () => {
      render(<PdfViewer data={base64Data} />);
      const viewport = screen.getByRole('region', { name: 'PDF viewport' });
      await wheel(viewport, { ctrlKey: true, deltaY: -100 });
      expect(screen.getAllByText('125%')[0]).toBeInTheDocument();
    });

    it('zooms out when Ctrl+wheel scrolls down', async () => {
      render(<PdfViewer data={base64Data} />);
      const viewport = screen.getByRole('region', { name: 'PDF viewport' });
      await wheel(viewport, { ctrlKey: true, deltaY: 100 });
      expect(screen.getAllByText('75%')[0]).toBeInTheDocument();
    });

    it('does not zoom without Ctrl key', async () => {
      render(<PdfViewer data={base64Data} />);
      const viewport = screen.getByRole('region', { name: 'PDF viewport' });
      await wheel(viewport, { ctrlKey: false, deltaY: -100 });
      expect(screen.getAllByText('100%')[0]).toBeInTheDocument();
    });

    it('does not exceed max scale via Ctrl+wheel', async () => {
      render(<PdfViewer data={base64Data} />);
      const viewport = screen.getByRole('region', { name: 'PDF viewport' });
      for (let i = 0; i < 10; i++) await wheel(viewport, { ctrlKey: true, deltaY: -100 });
      expect(screen.getAllByText('200%')[0]).toBeInTheDocument();
    });

    it('does not go below min scale via Ctrl+wheel', async () => {
      render(<PdfViewer data={base64Data} />);
      const viewport = screen.getByRole('region', { name: 'PDF viewport' });
      for (let i = 0; i < 10; i++) await wheel(viewport, { ctrlKey: true, deltaY: 100 });
      expect(screen.getAllByText('25%')[0]).toBeInTheDocument();
    });
  });

  it('controls appear both above and below the PDF', () => {
    render(<PdfViewer data={base64Data} />);
    expect(screen.getAllByRole('button', { name: /previous/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /next/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /zoom in/i })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /zoom out/i })).toHaveLength(2);
  });
});
