import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterPill } from '../filter-pill';

describe('FilterPill', () => {
  it('renders button with accessible aria-pressed state and triggers onClick', () => {
    const onClick = vi.fn();
    render(
      <FilterPill tone="success" active={true} onClick={onClick}>
        Active (12)
      </FilterPill>
    );

    const pill = screen.getByRole('button', { name: 'Active (12)' });
    expect(pill).toHaveAttribute('aria-pressed', 'true');
    expect(pill).toHaveAttribute('data-active', 'true');
    expect(pill.className).toContain('bg-emerald-600');

    fireEvent.click(pill);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('defaults to inactive neutral tone with button type', () => {
    render(<FilterPill>All</FilterPill>);

    const pill = screen.getByRole('button', { name: 'All' });
    expect(pill).toHaveAttribute('type', 'button');
    expect(pill).toHaveAttribute('aria-pressed', 'false');
    expect(pill).toHaveAttribute('data-active', 'false');
  });
});
