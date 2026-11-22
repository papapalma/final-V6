import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  NotificationBadge,
  formatBadgeCount,
  formatBadgeAriaLabel,
} from '../notification-badge';

describe('formatBadgeCount (Rule 1: Data Capping)', () => {
  it('returns null for zero, negative, and non-finite values', () => {
    expect(formatBadgeCount(0)).toBeNull();
    expect(formatBadgeCount(-1)).toBeNull();
    expect(formatBadgeCount(-999)).toBeNull();
    expect(formatBadgeCount(Number.NaN)).toBeNull();
    expect(formatBadgeCount(Number.POSITIVE_INFINITY)).toBeNull();
    expect(formatBadgeCount(0.4)).toBeNull();
  });

  it('formats exact integers up to max and caps above max with "+"', () => {
    expect(formatBadgeCount(1)).toBe('1');
    expect(formatBadgeCount(99)).toBe('99');
    expect(formatBadgeCount(100)).toBe('99+');
    expect(formatBadgeCount(245)).toBe('99+');
    expect(formatBadgeCount(9, 9)).toBe('9');
    expect(formatBadgeCount(10, 9)).toBe('9+');
    expect(formatBadgeCount(4.9)).toBe('4');
  });
});

describe('formatBadgeAriaLabel (Rule 1: Exact ARIA)', () => {
  it('returns base label when count is zero or negative', () => {
    expect(formatBadgeAriaLabel('Notifications', 0, 'unread notification')).toBe('Notifications');
    expect(formatBadgeAriaLabel('Open Messenger', -2, 'unread message')).toBe('Open Messenger');
  });

  it('includes exact un-capped count with proper singular/plural unit', () => {
    expect(formatBadgeAriaLabel('Notifications', 1, 'unread notification')).toBe(
      'Notifications, 1 unread notification',
    );
    expect(formatBadgeAriaLabel('Open Messenger', 142, 'unread message')).toBe(
      'Open Messenger, 142 unread messages',
    );
  });
});

describe('NotificationBadge component (7 Rules)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when count <= 0 or dot show is false', () => {
    const { container, rerender } = render(<NotificationBadge variant="count" count={0} />);
    expect(container.firstChild).toBeNull();

    rerender(<NotificationBadge variant="count" count={-3} />);
    expect(container.firstChild).toBeNull();

    rerender(<NotificationBadge variant="dot" show={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('enforces WCAG AA red-600, zero-CLS anchoring, tabular-nums, ring-2, and pointer-events-none on count', () => {
    const { container } = render(
      <NotificationBadge
        variant="count"
        count={128}
        position="corner"
        ariaLabel="128 unread messages"
      />,
    );

    const badge = screen.getByRole('status', { name: '128 unread messages' });
    expect(badge).toHaveTextContent('99+');
    expect(badge.className).toContain('bg-red-600');
    expect(badge.className).toContain('text-white');
    expect(badge.className).toContain('pointer-events-none');
    expect(badge.className).toContain('select-none');
    expect(badge.className).toContain('tabular-nums');
    expect(badge.className).toContain('ring-2');
    expect(badge.className).toContain('top-0');
    expect(badge.className).toContain('right-0');
    expect(badge.className).toContain('translate-x-1/3');
    expect(badge.className).toContain('-translate-y-1/3');
    expect(container.querySelector('.notif-badge-red')).toBeNull();
  });

  it('freezes the last positive count during the 150ms exit fade (zero "0" flash)', () => {
    const { container, rerender } = render(<NotificationBadge variant="count" count={7} />);
    const badge = container.querySelector('[data-slot="notification-badge"]');
    expect(badge).toHaveTextContent('7');
    expect(badge).toHaveAttribute('data-state', 'visible');

    rerender(<NotificationBadge variant="count" count={0} />);
    const exitingBadge = container.querySelector('[data-slot="notification-badge"]');
    expect(exitingBadge).not.toBeNull();
    expect(exitingBadge).toHaveTextContent('7');
    expect(exitingBadge).not.toHaveTextContent('0');
    expect(exitingBadge).toHaveAttribute('data-state', 'exiting');
    expect(exitingBadge?.className).toContain('opacity-0');

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(container.querySelector('[data-slot="notification-badge"]')).toBeNull();
  });

  it('cancels exit cleanly if a new notification arrives before 150ms elapses', () => {
    const { container, rerender } = render(<NotificationBadge variant="count" count={3} />);
    rerender(<NotificationBadge variant="count" count={0} />);

    act(() => {
      vi.advanceTimersByTime(75);
    });
    expect(container.querySelector('[data-slot="notification-badge"]')).toHaveAttribute(
      'data-state',
      'exiting',
    );

    rerender(<NotificationBadge variant="count" count={2} />);
    const visibleBadge = container.querySelector('[data-slot="notification-badge"]');
    expect(visibleBadge).toHaveAttribute('data-state', 'visible');
    expect(visibleBadge).toHaveTextContent('2');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(container.querySelector('[data-slot="notification-badge"]')).toHaveTextContent('2');
  });

  it('triggers a 150ms bump class on increment without unmounting the badge node', () => {
    const { container, rerender } = render(<NotificationBadge variant="count" count={2} />);
    const initialNode = container.querySelector('[data-slot="notification-badge"]');
    expect(initialNode?.className).not.toContain('notif-badge-bump');

    rerender(<NotificationBadge variant="count" count={3} />);
    const updatedNode = container.querySelector('[data-slot="notification-badge"]');
    expect(updatedNode).toBe(initialNode);
    expect(updatedNode).toHaveTextContent('3');
    expect(updatedNode?.className).toContain('notif-badge-bump');

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(updatedNode?.className).not.toContain('notif-badge-bump');
  });

  it('renders dot variant without numbers and exits cleanly after 150ms', () => {
    const { container, rerender } = render(<NotificationBadge variant="dot" show={true} />);
    const dot = container.querySelector('[data-slot="notification-badge"]');
    expect(dot).toHaveAttribute('data-variant', 'dot');
    expect(dot).toHaveTextContent('');
    expect(dot?.className).toContain('bg-red-600');
    expect(dot?.className).not.toContain('animate-ping');

    rerender(<NotificationBadge variant="dot" show={false} />);
    expect(container.querySelector('[data-slot="notification-badge"]')).toHaveAttribute(
      'data-state',
      'exiting',
    );

    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(container.querySelector('[data-slot="notification-badge"]')).toBeNull();
  });

  it('enforces semantic colors for status indicators (online=emerald, busy=amber, offline=slate, error=red)', () => {
    const { container, rerender } = render(
      <NotificationBadge variant="status" status="online" position="bottom-right" />,
    );
    let indicator = container.querySelector('[data-slot="notification-badge"]');
    expect(indicator?.className).toContain('bg-emerald-500');
    expect(indicator?.className).toContain('bottom-0');
    expect(indicator?.className).toContain('right-0');

    rerender(<NotificationBadge variant="status" status="busy" />);
    indicator = container.querySelector('[data-slot="notification-badge"]');
    expect(indicator?.className).toContain('bg-amber-500');

    rerender(<NotificationBadge variant="status" status="offline" />);
    indicator = container.querySelector('[data-slot="notification-badge"]');
    expect(indicator?.className).toContain('bg-slate-400');

    rerender(<NotificationBadge variant="status" status="error" />);
    indicator = container.querySelector('[data-slot="notification-badge"]');
    expect(indicator?.className).toContain('bg-red-600');
  });
});
