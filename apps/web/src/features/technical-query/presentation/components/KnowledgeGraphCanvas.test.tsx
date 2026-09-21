import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { KnowledgeGraph } from '@thenodewalk/contracts';

import KnowledgeGraphCanvas from './KnowledgeGraphCanvas';

interface MockReactFlowProps {
  nodes: { id: string; type: string; data: Record<string, unknown> }[];
  nodeTypes: Record<string, (props: { id: string; data: Record<string, unknown> }) => ReactElement>;
}

vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes, nodeTypes }: MockReactFlowProps) => (
    <div data-testid="react-flow">
      {nodes.map((node) => {
        const NodeComponent = nodeTypes[node.type]!;
        return <NodeComponent key={node.id} id={node.id} data={node.data} />;
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
    { id: 'kafka', label: 'Apache Kafka', type: 'concept', sourceUrl: 'https://blog.test/kafka' },
    { id: 'broker', label: 'Broker', type: 'concept', sourceUrl: 'https://blog.test/broker' },
  ],
  edges: [{ source: 'kafka', target: 'broker', relationship: 'contains' }],
};

describe('KnowledgeGraphCanvas', () => {
  it('renders every concept as an accessible link to its source that opens in a new tab', () => {
    render(<KnowledgeGraphCanvas graph={GRAPH} />);

    const kafkaLink = screen.getByRole('link', { name: /apache kafka, open source in a new tab/i });
    expect(kafkaLink).toHaveAttribute('href', 'https://blog.test/kafka');
    expect(kafkaLink).toHaveAttribute('target', '_blank');
    expect(kafkaLink).toHaveAttribute('rel', expect.stringContaining('noreferrer'));

    expect(screen.getByRole('link', { name: /broker, open source in a new tab/i })).toHaveAttribute(
      'href',
      'https://blog.test/broker',
    );
  });
});
