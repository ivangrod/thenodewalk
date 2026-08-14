import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('HomePage', () => {
  it('presents a clear entry point to create a map', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: /da forma a las ideas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear mi primer mapa/i })).toBeEnabled();
  });
});
