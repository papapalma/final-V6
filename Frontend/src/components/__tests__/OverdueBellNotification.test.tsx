import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import OverdueBellNotification from '../OverdueBellNotification';
import notificationService, { type InAppNotification } from '../../services/notificationService';

let mockUser: { id: string; role: string; tenantId?: string } | null = {
  id: 'admin-1',
  role: 'local_admin',
  tenantId: 'tenant-a',
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: Boolean(mockUser),
    isAuthReady: true,
  }),
}));

vi.mock('../../services/notificationService', () => ({
  default: {
    getNotifications: vi.fn(),
  },
}));

const sampleNotifications: InAppNotification[] = [
  {
    id: 'activity-101',
    type: 'activity',
    title: 'Program updated',
    description: 'Program activity by Admin',
    createdAt: '2026-11-22T10:00:00.000Z',
    href: '/programs/1',
  },
  {
    id: 'overdue-55',
    type: 'overdue',
    title: 'Overdue item',
    description: 'Projector is overdue for Juan',
    createdAt: '2026-11-20T08:00:00.000Z',
    href: '/lendings',
  },
];

function renderBell() {
  return render(
    <MemoryRouter>
      <OverdueBellNotification />
    </MemoryRouter>,
  );
}

describe('OverdueBellNotification (Rules 1, 3, 6 & 7)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockUser = { id: 'admin-1', role: 'local_admin', tenantId: 'tenant-a' };
  });

  it('displays exact unread count badge and clears immediately when the bell is opened', async () => {
    vi.mocked(notificationService.getNotifications).mockResolvedValue({
      notifications: sampleNotifications,
      unreadCount: 2,
    });

    renderBell();

    const bellButton = await screen.findByRole('button', {
      name: 'Notifications, 2 unread notifications',
    });
    expect(bellButton).toBeInTheDocument();
    expect(bellButton.querySelector('[data-slot="notification-badge"]')).toHaveTextContent('2');

    // Click bell -> clears unread badge immediately on open (Rule 6)
    fireEvent.click(bellButton);

    await waitFor(() => {
      expect(bellButton).toHaveAttribute('aria-label', 'Notifications');
    });

    // Modal highlights newly arrived items and uses WCAG AA red-600 Overdue badge
    expect(await screen.findByText('Program updated')).toBeInTheDocument();
    expect(screen.getAllByText('New')).toHaveLength(2);
    const overdueTag = screen.getByText('Overdue');
    expect(overdueTag.className).toContain('bg-red-600');
    expect(overdueTag.getAttribute('style')).toBeNull();
  });

  it('persists seen IDs across remounts and re-lights only when a newer unseen ID arrives (including older-dated overdue items)', async () => {
    vi.mocked(notificationService.getNotifications).mockResolvedValue({
      notifications: sampleNotifications,
      unreadCount: 2,
    });

    const firstRender = renderBell();
    const bellButton = await screen.findByRole('button', {
      name: 'Notifications, 2 unread notifications',
    });
    fireEvent.click(bellButton);
    firstRender.unmount();

    // Remount with identical feed -> stays cleared (0 unread)
    const secondRender = renderBell();
    await waitFor(() => {
      expect(notificationService.getNotifications).toHaveBeenCalledTimes(2);
    });
    const clearedBell = screen.getByRole('button', { name: 'Notifications' });
    expect(clearedBell.querySelector('[data-slot="notification-badge"]')).toBeNull();
    secondRender.unmount();

    // A newly overdue item arrives whose expected_return_date is earlier than the previous activity log
    vi.mocked(notificationService.getNotifications).mockResolvedValue({
      notifications: [
        ...sampleNotifications,
        {
          id: 'overdue-99',
          type: 'overdue',
          title: 'Overdue item',
          description: 'Drill Kit is overdue for Maria',
          createdAt: '2026-11-18T08:00:00.000Z',
          href: '/lendings',
        },
      ],
      unreadCount: 3,
    });

    renderBell();
    const relitBell = await screen.findByRole('button', {
      name: 'Notifications, 1 unread notification',
    });
    expect(relitBell.querySelector('[data-slot="notification-badge"]')).toHaveTextContent('1');
  });

  it('isolates seen notification state per user/tenant in localStorage', async () => {
    vi.mocked(notificationService.getNotifications).mockResolvedValue({
      notifications: sampleNotifications,
      unreadCount: 2,
    });

    // User A clears notifications
    const userARender = renderBell();
    const userABell = await screen.findByRole('button', {
      name: 'Notifications, 2 unread notifications',
    });
    fireEvent.click(userABell);
    userARender.unmount();

    // User B on the same browser still sees 2 unread notifications
    mockUser = { id: 'admin-2', role: 'local_admin', tenantId: 'tenant-a' };
    renderBell();
    const userBBell = await screen.findByRole('button', {
      name: 'Notifications, 2 unread notifications',
    });
    expect(userBBell.querySelector('[data-slot="notification-badge"]')).toHaveTextContent('2');
  });

  it('hides completely for trainee role', () => {
    mockUser = { id: 'trainee-1', role: 'trainee', tenantId: 'tenant-a' };
    const { container } = renderBell();
    expect(container.firstChild).toBeNull();
    expect(notificationService.getNotifications).not.toHaveBeenCalled();
  });
});
