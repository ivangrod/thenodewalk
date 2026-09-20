import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AskPage from './page';

describe('AskPage', () => {
  it('renders an accessible query form with an empty graph placeholder', () => {
    render(<AskPage />);

    expect(screen.getByRole('form', { name: /technical query/i })).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: /ask a technical question/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeEnabled();
    expect(screen.getByText(/your knowledge graph will appear here/i)).toBeInTheDocument();
  });

  it('acknowledges the submitted question in the reserved graph area', () => {
    render(<AskPage />);

    fireEvent.change(screen.getByRole('searchbox', { name: /ask a technical question/i }), {
      target: { value: 'How does Netflix scale its API?' },
    });
    fireEvent.submit(screen.getByRole('form', { name: /technical query/i }));

    expect(screen.getByText(/how does netflix scale its api\?/i)).toBeInTheDocument();
  });
});
