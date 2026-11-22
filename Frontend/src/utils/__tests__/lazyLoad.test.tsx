import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { importWithChunkRetry, isChunkLoadError } from '../lazyLoad';
import ErrorBoundary from '../../components/ErrorBoundary';

function Boom({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render boom');
  }
  return <div>Recovered page</div>;
}

describe('lazyLoad chunk retry & ErrorBoundary route reset', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('detects dynamic import / chunk errors and retries once before failing', async () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isChunkLoadError(new Error('Normal runtime bug'))).toBe(false);

    const loader = vi
      .fn<() => Promise<{ default: string }>>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch dynamically imported module'))
      .mockResolvedValueOnce({ default: 'ok' });

    const mod = await importWithChunkRetry(loader);
    expect(mod).toEqual({ default: 'ok' });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not retry non-chunk runtime errors', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('Bad state'));
    await expect(importWithChunkRetry(loader)).rejects.toThrow('Bad state');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('resets ErrorBoundary automatically when resetKey changes', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ErrorBoundary resetKey="/programs">
        <Boom shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong. Please refresh the page.')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="/trainees">
        <Boom shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Recovered page')).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
