import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { cn } from '@/utils/cn';
import { Button } from '../ui/Button.tsx';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const SCALE_STEP = 0.25;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.0;
const INITIAL_BASE_WIDTH = 560;

interface ControlsProps {
  page: number;
  numPages: number;
  scale: number;
  onPrev: () => void;
  onNext: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
}

function Controls({ page, numPages, scale, onPrev, onNext, onZoomOut, onZoomIn }: ControlsProps) {
  return (
    <div className="flex items-center gap-3 flex-shrink-0">
      <Button
        variant="secondary"
        size="sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={onPrev}
      >
        ←
      </Button>
      <span className="text-sm text-muted">
        {page} / {numPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        aria-label="Next page"
        disabled={page >= numPages}
        onClick={onNext}
      >
        →
      </Button>
      <span className="flex-1" />
      <Button
        variant="secondary"
        size="sm"
        aria-label="Zoom out"
        disabled={scale <= MIN_SCALE}
        onClick={onZoomOut}
      >
        −
      </Button>
      <span className="text-sm text-muted w-12 text-center">{Math.round(scale * 100)}%</span>
      <Button
        variant="secondary"
        size="sm"
        aria-label="Zoom in"
        disabled={scale >= MAX_SCALE}
        onClick={onZoomIn}
      >
        +
      </Button>
    </div>
  );
}

export function PdfViewer({
  data,
  className,
}: {
  data: string;
  className?: string;
}): React.JSX.Element {
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [baseWidth, setBaseWidth] = useState(INITIAL_BASE_WIDTH);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setBaseWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setScale((s) =>
        e.deltaY < 0 ? Math.min(MAX_SCALE, s + SCALE_STEP) : Math.max(MIN_SCALE, s - SCALE_STEP),
      );
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Drag-to-pan — native listener so preventDefault fires before browser selection mode
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    el.style.cursor = 'grab';
    const onMouseDown = (e: MouseEvent) => {
      e.preventDefault();
      el.style.cursor = 'grabbing';

      const start = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: el.scrollLeft,
        scrollTop: el.scrollTop,
      };

      const onMouseMove = (ev: MouseEvent) => {
        el.scrollLeft = start.scrollLeft + (start.x - ev.clientX);
        el.scrollTop = start.scrollTop + (start.y - ev.clientY);
      };
      const onMouseUp = () => {
        el.style.cursor = 'grab';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };
    el.addEventListener('mousedown', onMouseDown);
    return () => el.removeEventListener('mousedown', onMouseDown);
  }, []);

  const file = useMemo(() => {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  }, [data]);

  useEffect(() => {
    return () => URL.revokeObjectURL(file);
  }, [file]);
  const onPrev = () => setPage((p) => p - 1);
  const onNext = () => setPage((p) => p + 1);
  const onZoomOut = () => setScale((s) => Math.max(MIN_SCALE, s - SCALE_STEP));
  const onZoomIn = () => setScale((s) => Math.min(MAX_SCALE, s + SCALE_STEP));

  return (
    <div className={cn('flex flex-col gap-2 min-h-0', className)}>
      <Controls {...{ page, numPages, scale, onPrev, onNext, onZoomOut, onZoomIn }} />
      <section
        ref={viewportRef}
        aria-label="PDF viewport"
        className="overflow-auto flex-1 min-h-0 select-none"
      >
        {loadError && <div className="text-sm text-warning p-2">{loadError}</div>}
        <Document
          file={file}
          onLoadSuccess={({ numPages: n }) => {
            setNumPages(n);
            setLoadError(null);
          }}
          onLoadError={(err) => setLoadError(err.message)}
          className="border border-border rounded overflow-hidden w-fit"
        >
          <Page pageNumber={page} width={baseWidth * scale} />
        </Document>
      </section>
      <Controls {...{ page, numPages, scale, onPrev, onNext, onZoomOut, onZoomIn }} />
    </div>
  );
}
