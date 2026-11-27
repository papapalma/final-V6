import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HoldToConfirmButton } from '../ui/hold-to-confirm-button';

describe('HoldToConfirmButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not confirm if pointer is released before duration completes', () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm} durationMs={1500} />);

    const btn = screen.getByRole('button');
    fireEvent.pointerDown(btn, { button: 0, pointerId: 1 });
    expect(btn).toHaveAttribute('data-holding', 'true');

    act(() => {
      vi.advanceTimersByTime(800);
    });
    fireEvent.pointerUp(btn, { pointerId: 1 });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(btn).toHaveAttribute('data-holding', 'false');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('fires onConfirm once after holding pointer for full duration', () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm} durationMs={1500} />);

    const btn = screen.getByRole('button');
    fireEvent.pointerDown(btn, { button: 0, pointerId: 1 });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(btn).toHaveAttribute('data-holding', 'false');
  });

  it('supports keyboard Space hold and cancels on early release', () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirmButton onConfirm={onConfirm} durationMs={1500} />);

    const btn = screen.getByRole('button');

    // Early release cancels
    fireEvent.keyDown(btn, { key: ' ' });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    fireEvent.keyUp(btn, { key: ' ' });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onConfirm).not.toHaveBeenCalled();

    // Full hold confirms
    fireEvent.keyDown(btn, { key: ' ' });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
