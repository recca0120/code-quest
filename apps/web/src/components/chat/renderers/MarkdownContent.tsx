import * as ContextMenu from '@radix-ui/react-context-menu';
import { isValidElement, lazy, Suspense } from 'react';
import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { copyToClipboard } from '@/utils/clipboard';
import { Highlight } from './Highlight.tsx';
import { Pre } from './Pre.tsx';

const MermaidDiagram = lazy(() =>
  import('./MermaidDiagram.tsx').then((m) => ({ default: m.MermaidDiagram })),
);

function isElementWithLanguageClass(node: React.ReactNode): boolean {
  if (!isValidElement<{ className?: string }>(node)) return false;
  const className = node.props.className;
  return typeof className === 'string' && /language-\w+/.test(className);
}

function LinkWithContextMenu({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return <span>{children}</span>;
  return (
    <ContextMenu.Root>
      <ContextMenu.Trigger asChild>
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="z-modal bg-surface border border-border rounded shadow py-1 min-w-32">
          <ContextMenu.Item
            onSelect={() => void copyToClipboard(href)}
            className="block px-3 py-1 text-sm text-text data-[highlighted]:bg-surface-hover outline-none cursor-pointer"
          >
            Copy Link
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}

const components: Components = {
  code({ className, children }) {
    const lang = /language-(\w+)/.exec(className ?? '')?.[1];
    const code = String(children).replace(/\n$/, '');
    if (lang === 'mermaid')
      return (
        <Suspense fallback={null}>
          <MermaidDiagram code={code} />
        </Suspense>
      );
    if (lang) return <Highlight lang={lang}>{code}</Highlight>;
    return <code className={className}>{children}</code>;
  },
  pre({ children }) {
    // When inner <code> has a language class, react-markdown already rendered
    // a CodeBlock (which owns its own <pre> layout + copy button).
    // Pass it through untouched to avoid double wrappers + duplicate copy.
    if (isElementWithLanguageClass(children)) return <>{children}</>;
    return <Pre>{children}</Pre>;
  },
  a({ href, children }) {
    return (
      <LinkWithContextMenu href={typeof href === 'string' ? href : undefined}>
        {children}
      </LinkWithContextMenu>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3 rounded-lg border border-border">
        <table className="min-w-full text-sm border-collapse">{children}</table>
      </div>
    );
  },
  thead({ children }) {
    return (
      <thead className="bg-surface-hover border-b border-border text-bright">{children}</thead>
    );
  },
  th({ children, style }) {
    return (
      <th
        className="px-3 py-2 text-left font-semibold text-xs uppercase tracking-wider whitespace-nowrap"
        style={style}
      >
        {children}
      </th>
    );
  },
  tbody({ children }) {
    return <tbody className="divide-y divide-border">{children}</tbody>;
  },
  tr({ children }) {
    return <tr className="hover:bg-hover-tint transition-colors">{children}</tr>;
  },
  td({ children, style }) {
    return (
      <td className="px-3 py-2 whitespace-pre-wrap break-words" style={style}>
        {children}
      </td>
    );
  },
};

export function MarkdownContent({ content }: { content: string }): React.JSX.Element {
  return (
    <div className="prose prose-themed prose-sm max-w-none">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}
