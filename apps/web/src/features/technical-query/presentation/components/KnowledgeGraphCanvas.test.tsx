import { fireEvent, render, screen, act, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraph } from '@thenodewalk/contracts';
import KnowledgeGraphCanvas from './KnowledgeGraphCanvas';
import type { ConceptGraphNode } from './ConceptNode';

vi.mock('d3-graph-react', () => ({
  Graph: ({
    graph,
    NodeComponent,
  }: {
    graph: { nodes: ConceptGraphNode[] };
    NodeComponent: (props: { node: ConceptGraphNode }) => ReactElement;
  }) => (
    <svg>
      <foreignObject>
        {graph.nodes.map((node) => (
          <NodeComponent key={node.id} node={node} />
        ))}
      </foreignObject>
    </svg>
  ),
}));

const GRAPH: KnowledgeGraph = {
  nodes: [
    {
      id: 'kafka',
      label: 'Apache Kafka',
      type: 'concept',
      sourceUrl: 'https://blog.test/kafka',
      source: {
        articleTitle: 'Kafka at scale',
        blogName: 'Netflix',
        publishedAt: '2026-01-02T00:00:00.000Z',
      },
    },
    { id: 'broker', label: 'Broker', type: 'concept', sourceUrl: null, source: null },
  ],
  edges: [{ source: 'kafka', target: 'broker', relationship: 'contains' }],
  centralNodeId: 'kafka',
};

describe('KnowledgeGraphCanvas', () => {
  it('opens a modal with authoritative article metadata and a new-tab link', async () => {
    render(<KnowledgeGraphCanvas graph={GRAPH} />);
    const node = screen.getByRole('button', {
      name: 'Apache Kafka, main idea, view article details',
    });
    expect(node).toHaveTextContent('Main idea');
    act(() => node.focus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(node);
    expect(screen.getByRole('dialog', { name: 'Kafka at scale' })).toBeInTheDocument();
    expect(screen.getByText('January 2, 2026')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /go to netflix/i });
    expect(link).toHaveAttribute('href', 'https://blog.test/kafka');
    expect(link).toHaveAttribute('target', '_blank');
    fireEvent.click(screen.getByRole('button', { name: 'Close article details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(node).toHaveFocus());
  });

  it('keeps unsourced concepts selectable without opening a modal', () => {
    render(<KnowledgeGraphCanvas graph={GRAPH} />);
    fireEvent.click(screen.getByRole('button', { name: 'Broker, no linked source' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('handles old responses without metadata and closes details when the graph changes', () => {
    const old: KnowledgeGraph = { ...GRAPH, nodes: [{ ...GRAPH.nodes[0]!, source: undefined }] };
    const { rerender } = render(<KnowledgeGraphCanvas graph={old} />);
    fireEvent.click(screen.getByRole('button', { name: /view article details/i }));
    expect(screen.getByRole('dialog', { name: 'Article title unavailable' })).toBeInTheDocument();
    expect(screen.getByText('Publication date unavailable')).toBeInTheDocument();
    rerender(<KnowledgeGraphCanvas graph={GRAPH} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not expose unsafe source links', () => {
    render(
      <KnowledgeGraphCanvas
        graph={{ ...GRAPH, nodes: [{ ...GRAPH.nodes[0]!, sourceUrl: 'javascript:alert(1)' }] }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /view article details/i }));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
