import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import HomePage from './page';

describe('HomePage', () => {
  it('presents a clear entry point to create a map', () => {
    render(<HomePage />);

    expect(screen.getByRole('heading', { name: /give shape to ideas/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create my first map/i })).toBeEnabled();
  });
});
