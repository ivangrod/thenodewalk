import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeGraph } from '@thenodewalk/contracts';

import KnowledgeGraphCanvas from './KnowledgeGraphCanvas';
import { useSelectedConceptStore } from '../stores/useSelectedConceptStore';

interface MockReactFlowProps {
  nodes: {
    id: string;
    type: string;
    position: { x: number; y: number };
    data: Record<string, unknown>;
  }[];
  nodeTypes: Record<string, (props: { id: string; data: Record<string, unknown> }) => ReactElement>;
}

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, nodeTypes }: MockReactFlowProps) => (
    <div data-testid="react-flow">
      {nodes.map((node) => {
        const NodeComponent = nodeTypes[node.type]!;
        return (
          <div
            key={node.id}
            data-testid={`flow-node-${node.id}`}
            data-x={node.position.x}
            data-y={node.position.y}
          >
            <NodeComponent id={node.id} data={node.data} />
          </div>
        );
      })}
    </div>
  ),
  Background: () => null,
  Controls: () => null,
  Handle: () => null,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}));

const GRAPH: KnowledgeGraph = {
  nodes: [
    {
      id: 'kafka',
      label: 'Apache Kafka',
      type: 'concept',
      source: { kind: 'post', url: 'https://blog.test/kafka' },
    },
    {
      id: 'broker',
      label: 'Broker',
      type: 'concept',
      source: { kind: 'post', url: 'https://blog.test/broker' },
    },
  ],
  edges: [{ source: 'kafka', target: 'broker', relationship: 'contains' }],
  centralNodeId: null,
};

function positionOf(nodeId: string): { x: number; y: number } {
  const element = screen.getByTestId(`flow-node-${nodeId}`);
  return { x: Number(element.dataset.x), y: Number(element.dataset.y) };
}

describe('KnowledgeGraphCanvas', () => {
  it('renders a book as a selectable button with badge and source-aware accessible name', () => {
    render(
      <KnowledgeGraphCanvas
        graph={{
          nodes: [
            {
              id: 'book',
              label: 'Feedback',
              type: 'concept',
              source: {
                kind: 'book',
                bookTitle: 'Engineering Feedback',
                sectionTitle: 'Small loops',
                pageStart: null,
              },
            },
          ],
          edges: [],
          centralNodeId: null,
        }}
      />,
    );
    const button = screen.getByRole('button', {
      name: 'Feedback, from the book Engineering Feedback, Small loops',
    });
    expect(button).toHaveTextContent('Book');
    expect(button).not.toHaveAttribute('href');
    act(() => button.focus());
    expect(button).toHaveFocus();
    expect(useSelectedConceptStore.getState().selectedNodeId).toBe('book');
  });
  it('renders every concept as an accessible link to its source that opens in a new tab', () => {
    render(<KnowledgeGraphCanvas graph={GRAPH} />);

    const kafkaLink = screen.getByRole('link', { name: /apache kafka, open source in a new tab/i });
    expect(kafkaLink).toHaveAttribute('href', 'https://blog.test/kafka');
    expect(kafkaLink).toHaveAttribute('target', '_blank');
    expect(kafkaLink).toHaveAttribute('rel', expect.stringContaining('noreferrer'));
    expect(kafkaLink).toHaveTextContent('Post');
    expect(screen.getAllByText('Post')).toHaveLength(2);

    expect(screen.getByRole('link', { name: /broker, open source in a new tab/i })).toHaveAttribute(
      'href',
      'https://blog.test/broker',
    );
  });

  it('renders a concept without a source as a focusable button that is not a link', () => {
    const graph: KnowledgeGraph = {
      nodes: [
        {
          id: 'kafka',
          label: 'Apache Kafka',
          type: 'concept',
          source: { kind: 'post', url: 'https://blog.test/kafka' },
        },
        { id: 'partition', label: 'Partition', type: 'concept', source: null },
      ],
      edges: [{ source: 'kafka', target: 'partition', relationship: 'splits into' }],
      centralNodeId: null,
    };

    render(<KnowledgeGraphCanvas graph={graph} />);

    const partition = screen.getByRole('button', { name: /partition, no linked source/i });
    expect(partition).toHaveAttribute('type', 'button');
    expect(partition).not.toHaveAttribute('href');
    expect(partition).not.toHaveTextContent('Post');
    act(() => partition.focus());
    expect(partition).toHaveFocus();
    expect(useSelectedConceptStore.getState().selectedNodeId).toBe('partition');
    expect(screen.queryByRole('link', { name: /partition/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('places the central node in the middle and labels it as the main idea', () => {
    const graph: KnowledgeGraph = {
      nodes: [
        {
          id: 'broker',
          label: 'Broker',
          type: 'concept',
          source: { kind: 'post', url: 'https://blog.test/broker' },
        },
        {
          id: 'kafka',
          label: 'Apache Kafka',
          type: 'concept',
          source: { kind: 'post', url: 'https://blog.test/kafka' },
        },
        { id: 'topic', label: 'Topic', type: 'concept', source: null },
        { id: 'partition', label: 'Partition', type: 'concept', source: null },
      ],
      edges: [
        { source: 'kafka', target: 'broker', relationship: 'runs on' },
        { source: 'kafka', target: 'topic', relationship: 'organizes' },
        { source: 'topic', target: 'partition', relationship: 'splits into' },
      ],
      centralNodeId: 'kafka',
    };

    render(<KnowledgeGraphCanvas graph={graph} />);

    const mainIdea = screen.getByRole('link', {
      name: 'Apache Kafka, main idea, open source in a new tab',
    });
    expect(mainIdea).toHaveTextContent('Main idea');
    expect(screen.getAllByText('Main idea')).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'Broker, open source in a new tab' }),
    ).not.toHaveTextContent('Main idea');

    const centre = positionOf('kafka');
    const distances = ['broker', 'topic', 'partition'].map((nodeId) => {
      const position = positionOf(nodeId);
      return Math.hypot(position.x - centre.x, position.y - centre.y);
    });
    expect(distances[0]).toBeGreaterThan(0);
    distances.forEach((distance) => expect(distance).toBeCloseTo(distances[0] ?? 0));
  });
});
