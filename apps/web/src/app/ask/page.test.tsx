import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import AskPage from './page';

describe('AskPage', () => {
  it('renders an accessible query form with the idle placeholder', () => {
    render(<AskPage />);

    expect(screen.getByRole('form', { name: /technical query/i })).toBeInTheDocument();
    expect(
      screen.getByRole('searchbox', { name: /ask a technical question/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search/i })).toBeEnabled();
    expect(screen.getByText(/your knowledge graph will appear here/i)).toBeInTheDocument();
  });
});
