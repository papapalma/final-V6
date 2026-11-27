import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ArchivePage, { ENTITY_TYPES } from './ArchivePage';
import api from '../services/api';
import { toast } from 'sonner';

const mockRefetch = vi.fn().mockResolvedValue(undefined);
const mockSetFilters = vi.fn();

const mockArchiveState = {
  items: [
    {
      id: 'u-archived-1',
      username: 'Paolo',
      email: 'paolo@bmdc.site',
      role: 'staff_training_coordinator',
      deleted_at: '2026-10-01T00:00:00Z',
      daysSinceDeleted: 40,
      daysRemaining: 0,
      eligibleForPurge: true,
    },
  ],
  loading: false,
  error: null,
  filters: { entityType: 'user', search: '', page: 1, limit: 20 },
  setFilters: mockSetFilters,
  pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  refetch: mockRefetch,
};

vi.mock('react-router-dom', () => ({
  Navigate: () => <div>Redirected</div>,
}));

vi.mock('../components/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u-admin', role: 'local_admin', email: 'admin@bmdc.site', username: 'Admin' },
    hasPermission: () => true,
  }),
}));

vi.mock('../hooks/useArchiveFilters', () => ({
  useArchiveFilters: () => mockArchiveState,
}));

vi.mock('../services/api', () => ({
  default: {
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('ArchivePage — User Accounts & Dynamic Entity Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('includes User Accounts in ENTITY_TYPES and renders dynamic User Account badge instead of Trainee', () => {
    expect(ENTITY_TYPES.some((t) => t.value === 'user' && t.label === 'User Accounts')).toBe(true);

    render(<ArchivePage />);

    expect(screen.getByText('User Account')).toBeInTheDocument();
    expect(screen.queryByText('Trainee')).not.toBeInTheDocument();
    expect(screen.getByText('Paolo')).toBeInTheDocument();
    expect(screen.getByText('paolo@bmdc.site')).toBeInTheDocument();
  });

  it('sends active entityType (user) on single restore and surfaces email/username collision errors', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: {
        restored: [],
        restoredCount: 0,
        failed: [{ id: 'u-archived-1', error: 'Cannot restore user: email or username is already in use by an active account' }],
        failedCount: 1,
      },
    } as any);

    render(<ArchivePage />);

    // Click restore icon button in the row
    const buttons = screen.getAllByRole('button');
    const restoreIconBtn = buttons.find((b) => b.className.includes('hover:bg-blue-50'))!;
    fireEvent.click(restoreIconBtn);

    expect(await screen.findByText('Restore User Account')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/archive', {
        entityType: 'user',
        ids: ['u-archived-1'],
      });
      expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/already in use/i));
      expect(toast.success).not.toHaveBeenCalled();
    });
  });

  it('restores archived user successfully when no collision occurs', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({
      data: {
        restored: ['u-archived-1'],
        restoredCount: 1,
        failed: [],
        failedCount: 0,
      },
    } as any);

    render(<ArchivePage />);

    const restoreIconBtn = screen
      .getAllByRole('button')
      .find((b) => b.className.includes('hover:bg-blue-50'))!;
    fireEvent.click(restoreIconBtn);

    fireEvent.click(await screen.findByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/archive', {
        entityType: 'user',
        ids: ['u-archived-1'],
      });
      expect(toast.success).toHaveBeenCalledWith('Item restored successfully');
      expect(mockRefetch).toHaveBeenCalled();
    });
  });
});
