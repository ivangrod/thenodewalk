import { fireEvent, render, screen, act, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { KnowledgeGraph, KnowledgePostSource } from '@thenodewalk/contracts';
import KnowledgeGraphCanvas from './KnowledgeGraphCanvas';
import type { ConceptGraphNode } from './ConceptNode';
import { useSelectedConceptStore } from '../stores/useSelectedConceptStore';

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

const POST_SOURCE: KnowledgePostSource = {
  kind: 'post',
  url: 'https://blog.test/kafka',
  articleTitle: 'Kafka at scale',
  blogName: 'Netflix',
  publishedAt: '2026-01-02T00:00:00.000Z',
};

const GRAPH: KnowledgeGraph = {
  nodes: [
    { id: 'kafka', label: 'Apache Kafka', type: 'concept', source: POST_SOURCE },
    { id: 'broker', label: 'Broker', type: 'concept', source: null },
    {
      id: 'feedback',
      label: 'Feedback',
      type: 'concept',
      source: {
        kind: 'book',
        bookTitle: 'Engineering Feedback',
        sectionTitle: 'Small loops',
        pageStart: 12,
        excerpt: 'Small feedback loops make engineering changes easier to review.',
      },
    },
  ],
  edges: [
    { source: 'kafka', target: 'broker', relationship: 'contains' },
    { source: 'kafka', target: 'feedback', relationship: 'improves with' },
  ],
  centralNodeId: 'kafka',
};

function withPostSource(source: Partial<KnowledgePostSource>): KnowledgeGraph {
  return { ...GRAPH, nodes: [{ ...GRAPH.nodes[0]!, source: { ...POST_SOURCE, ...source } }] };
}

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

  it('identifies post and book sources with visible badges, never by colour alone', () => {
    render(<KnowledgeGraphCanvas graph={GRAPH} />);
    expect(
      screen.getByRole('button', { name: 'Apache Kafka, main idea, view article details' }),
    ).toHaveTextContent('Post');
    expect(screen.getAllByText('Post')).toHaveLength(1);
    expect(screen.getAllByText('Book')).toHaveLength(1);
    const unsourced = screen.getByRole('button', { name: 'Broker, no linked source' });
    expect(unsourced).not.toHaveTextContent('Post');
    expect(unsourced).not.toHaveTextContent('Book');
  });

  it('opens a book modal with the title, section, page and matching excerpt, then restores focus', async () => {
    render(<KnowledgeGraphCanvas graph={GRAPH} />);
    const book = screen.getByRole('button', {
      name: 'Feedback, from the book Engineering Feedback, Small loops, page 12, view book excerpt',
    });
    expect(book).toHaveTextContent('Book');
    expect(book).toHaveTextContent('View excerpt');
    expect(book).toHaveAttribute('aria-haspopup', 'dialog');
    act(() => book.focus());
    expect(useSelectedConceptStore.getState().selectedNodeId).toBe('feedback');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(book);

    const dialog = screen.getByRole('dialog', { name: 'Engineering Feedback' });
    expect(dialog).toHaveAccessibleDescription('Source for Feedback');
    expect(within(dialog).getByText('Small loops')).toBeInTheDocument();
    expect(within(dialog).getByText('12')).toBeInTheDocument();
    expect(
      within(dialog).getByText('Small feedback loops make engineering changes easier to review.'),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close book details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(book).toHaveFocus());
  });

  it('omits unknown book details from the name and shows explicit placeholders in the modal', () => {
    render(
      <KnowledgeGraphCanvas
        graph={{
          ...GRAPH,
          nodes: [
            {
              ...GRAPH.nodes[2]!,
              source: {
                kind: 'book',
                bookTitle: 'Engineering Feedback',
                sectionTitle: null,
                pageStart: null,
                excerpt: null,
              },
            },
          ],
          centralNodeId: null,
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Feedback, from the book Engineering Feedback, view book excerpt',
      }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Engineering Feedback' });
    expect(within(dialog).getByText('Section unavailable')).toBeInTheDocument();
    expect(within(dialog).getByText('Excerpt unavailable')).toBeInTheDocument();
    expect(within(dialog).queryByText('Section starts on page')).not.toBeInTheDocument();
  });

  it('keeps unsourced concepts selectable without opening a modal', () => {
    render(<KnowledgeGraphCanvas graph={GRAPH} />);
    fireEvent.click(screen.getByRole('button', { name: 'Broker, no linked source' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows placeholders for unknown article metadata and closes details when the graph changes', () => {
    const unknown = withPostSource({ articleTitle: null, blogName: null, publishedAt: null });
    const { rerender } = render(<KnowledgeGraphCanvas graph={unknown} />);
    fireEvent.click(screen.getByRole('button', { name: /view article details/i }));
    expect(screen.getByRole('dialog', { name: 'Article title unavailable' })).toBeInTheDocument();
    expect(screen.getByText('Publication date unavailable')).toBeInTheDocument();
    rerender(<KnowledgeGraphCanvas graph={GRAPH} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not expose unsafe source links', () => {
    render(<KnowledgeGraphCanvas graph={withPostSource({ url: 'javascript:alert(1)' })} />);
    fireEvent.click(screen.getByRole('button', { name: /view article details/i }));
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
