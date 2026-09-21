import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { TechnicalQueryResponse } from '@thenodewalk/contracts';

import type { UseTechnicalQuery } from '../hooks/useTechnicalQuery';
import { TechnicalQueryView } from './TechnicalQueryView';

const mockUseTechnicalQuery = vi.fn<() => UseTechnicalQuery>();

vi.mock('../hooks/useTechnicalQuery', () => ({
  useTechnicalQuery: (): UseTechnicalQuery => mockUseTechnicalQuery(),
}));

vi.mock('./KnowledgeGraph', () => ({
  KnowledgeGraph: ({ graph }: { graph: TechnicalQueryResponse['graph'] }) => (
    <div data-testid="knowledge-graph">{graph.nodes.length} nodes</div>
  ),
}));

function setHook(partial: Partial<UseTechnicalQuery>): void {
  mockUseTechnicalQuery.mockReturnValue({
    ask: vi.fn(),
    data: null,
    status: 'idle',
    lastQuery: null,
    ...partial,
  });
}

const RESPONSE: TechnicalQueryResponse = {
  summary: 'Netflix relies on a federated API gateway.',
  graph: {
    nodes: [
      {
        id: 'gateway',
        label: 'API Gateway',
        type: 'concept',
        sourceUrl: 'https://netflixtechblog.com/gateway',
      },
    ],
    edges: [],
  },
};

describe('TechnicalQueryView', () => {
  beforeEach(() => {
    mockUseTechnicalQuery.mockReset();
  });

  it('renders the accessible form and the idle placeholder', () => {
    setHook({ status: 'idle' });
    render(<TechnicalQueryView />);

    expect(screen.getByRole('form', { name: /technical query/i })).toBeInTheDocument();
    expect(screen.getByText(/your knowledge graph will appear here/i)).toBeInTheDocument();
  });

  it('shows the loading message while building the graph', () => {
    setHook({ status: 'loading', lastQuery: 'kafka' });
    render(<TechnicalQueryView />);

    expect(screen.getByText(/building your knowledge graph/i)).toBeInTheDocument();
  });

  it('renders the summary and the graph on success', () => {
    setHook({ status: 'success', data: RESPONSE, lastQuery: 'netflix' });
    render(<TechnicalQueryView />);

    expect(screen.getByText(/federated api gateway/i)).toBeInTheDocument();
    expect(screen.getByTestId('knowledge-graph')).toHaveTextContent('1 nodes');
  });

  it('renders a no-results message when the graph is empty', () => {
    setHook({
      status: 'success',
      data: { summary: '', graph: { nodes: [], edges: [] } },
      lastQuery: 'unknown',
    });
    render(<TechnicalQueryView />);

    expect(screen.getByText(/no sources matched your question/i)).toBeInTheDocument();
    expect(screen.queryByTestId('knowledge-graph')).not.toBeInTheDocument();
  });

  it('renders a recoverable error with a retry that re-asks the last query', () => {
    const ask = vi.fn();
    setHook({ status: 'error', lastQuery: 'kafka', ask });
    render(<TechnicalQueryView />);

    expect(screen.getByRole('alert')).toHaveTextContent(/something went wrong/i);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(ask).toHaveBeenCalledWith('kafka');
  });
});
