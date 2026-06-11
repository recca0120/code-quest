import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi
      .fn()
      .mockResolvedValue({ svg: '<svg><text>diagram</text></svg>', diagramType: 'flowchart' }),
  },
}));

vi.mock('@/hooks/useEffectiveColorTheme', () => ({
  useEffectiveColorTheme: vi.fn(),
}));

import mermaid from 'mermaid';
import { useEffectiveColorTheme } from '@/hooks/useEffectiveColorTheme';
import { _resetMermaidThemeCache, MermaidDiagram } from '../MermaidDiagram.tsx';

const mockUseEffectiveColorTheme = vi.mocked(useEffectiveColorTheme);
const mockMermaid = vi.mocked(mermaid);

describe('MermaidDiagram', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetMermaidThemeCache();
    mockMermaid.render.mockResolvedValue({
      svg: '<svg><text>diagram</text></svg>',
      diagramType: 'flowchart',
    });
  });

  it('initializes mermaid with dark theme when effective theme is clay-dark', async () => {
    mockUseEffectiveColorTheme.mockReturnValue('clay-dark');
    render(<MermaidDiagram code="graph TD; A-->B" />);
    await vi.waitFor(() => expect(mockMermaid.initialize).toHaveBeenCalled());
    expect(mockMermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
  });

  it('initializes mermaid with dark theme when effective theme is roast', async () => {
    mockUseEffectiveColorTheme.mockReturnValue('roast');
    render(<MermaidDiagram code="graph TD; A-->B" />);
    await vi.waitFor(() => expect(mockMermaid.initialize).toHaveBeenCalled());
    expect(mockMermaid.initialize).toHaveBeenCalledWith(expect.objectContaining({ theme: 'dark' }));
  });

  it('initializes mermaid with default theme when effective theme is light', async () => {
    mockUseEffectiveColorTheme.mockReturnValue('light');
    render(<MermaidDiagram code="graph TD; A-->B" />);
    await vi.waitFor(() => expect(mockMermaid.initialize).toHaveBeenCalled());
    expect(mockMermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ theme: 'default' }),
    );
  });

  it('inserts the rendered SVG into the container', async () => {
    mockUseEffectiveColorTheme.mockReturnValue('clay-dark');
    const { container } = render(<MermaidDiagram code="graph TD; A-->B" />);
    await vi.waitFor(() => expect(container.querySelector('svg')).toBeInTheDocument());
    expect(container.querySelector('text')).toHaveTextContent('diagram');
  });

  it('shows error message when mermaid.render throws', async () => {
    mockUseEffectiveColorTheme.mockReturnValue('clay-dark');
    mockMermaid.render.mockRejectedValue(new Error('parse error'));
    render(<MermaidDiagram code="invalid diagram" />);
    expect(await screen.findByText('parse error')).toBeInTheDocument();
  });

  it('initializes mermaid with securityLevel strict', async () => {
    mockUseEffectiveColorTheme.mockReturnValue('clay-dark');
    render(<MermaidDiagram code="graph TD; A-->B" />);
    await vi.waitFor(() => expect(mockMermaid.initialize).toHaveBeenCalled());
    expect(mockMermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: 'strict' }),
    );
  });

  it('uses the same element id when code changes', async () => {
    mockUseEffectiveColorTheme.mockReturnValue('clay-dark');
    const { rerender } = render(<MermaidDiagram code="graph TD; A-->B" />);
    await vi.waitFor(() => expect(mockMermaid.render).toHaveBeenCalledTimes(1));
    const firstId = mockMermaid.render.mock.calls[0]![0] as string;

    rerender(<MermaidDiagram code="graph TD; C-->D" />);
    await vi.waitFor(() => expect(mockMermaid.render).toHaveBeenCalledTimes(2));
    const secondId = mockMermaid.render.mock.calls[1]![0] as string;

    expect(firstId).toBe(secondId);
  });
});
