import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import AccountManagementPage from '../AccountManagementPage';
import userService, { User } from '../../services/userService';

const mockUsers: User[] = [
  {
    id: 'u-admin',
    username: 'LocalAdmin',
    email: 'admin@bmdc.site',
    role: 'local_admin',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  },
  {
    id: 'u-train-staff',
    username: 'demo_training_staff',
    email: 'demo.training@bmdc.site',
    role: 'staff_training_coordinator',
    created_at: '2026-09-02T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
  },
  {
    id: 'u-inv-staff',
    username: 'demo_inventory_staff',
    email: 'demo.inventory@bmdc.site',
    role: 'staff_inventory_manager',
    created_at: '2026-09-03T00:00:00Z',
    updated_at: '2026-09-03T00:00:00Z',
  },
  ...Array.from({ length: 11 }, (_, idx) => ({
    id: `u-trainee-${idx + 1}`,
    username: `trainee_user_${idx + 1}`,
    email: `trainee${idx + 1}@bmdc.site`,
    role: 'trainee' as const,
    created_at: `2026-10-${String(idx + 1).padStart(2, '0')}T00:00:00Z`,
    updated_at: `2026-10-${String(idx + 1).padStart(2, '0')}T00:00:00Z`,
  })),
];

vi.mock('../../components/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../components/TraineePreviewModal', () => ({
  default: () => null,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u-admin',
      username: 'LocalAdmin',
      email: 'admin@bmdc.site',
      role: 'local_admin',
    },
    hasPermission: () => true,
  }),
}));

vi.mock('../../services/userService', () => ({
  default: {
    getUsers: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

vi.mock('../../services/registrationService', () => ({
  default: {
    getRegistrations: vi.fn().mockResolvedValue([]),
    approveRegistration: vi.fn(),
    rejectRegistration: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('AccountManagementPage role filter', () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false;
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {};
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {};
    }
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = () => {};
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userService.getUsers).mockResolvedValue(mockUsers);
  });

  const selectRoleFilter = async (optionLabel: string) => {
    const trigger = screen.getByRole('combobox', { name: 'Filter by role' });
    fireEvent.click(trigger);
    const option = await screen.findByRole('option', { name: optionLabel });
    fireEvent.click(option);
  };

  it('filters accounts by Admin & Staff, specific staff role, and Trainees, resetting pagination to page 1', async () => {
    render(<AccountManagementPage />);

    // Wait for initial load (page 1 shows first 10 of 14 users)
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(within(table).getByText('LocalAdmin')).toBeInTheDocument();
      expect(within(table).getByText('trainee_user_1')).toBeInTheDocument();
      expect(within(table).queryByText('trainee_user_11')).not.toBeInTheDocument();
    });

    // Navigate to page 2 so we can prove role filter resets pagination to page 1
    fireEvent.click(screen.getByText('2'));
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(within(table).getByText('trainee_user_11')).toBeInTheDocument();
      expect(within(table).queryByText('LocalAdmin')).not.toBeInTheDocument();
    });

    // Filter to Admin & Staff -> immediately resets to page 1 and hides trainees
    await selectRoleFilter('Admin & Staff');
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(within(table).getByText('LocalAdmin')).toBeInTheDocument();
      expect(within(table).getByText('demo_training_staff')).toBeInTheDocument();
      expect(within(table).getByText('demo_inventory_staff')).toBeInTheDocument();
      expect(within(table).queryByText('trainee_user_1')).not.toBeInTheDocument();
    });

    // Filter to Staff (Trainees)
    await selectRoleFilter('Staff (Trainees)');
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(within(table).getByText('demo_training_staff')).toBeInTheDocument();
      expect(within(table).queryByText('demo_inventory_staff')).not.toBeInTheDocument();
      expect(within(table).queryByText('LocalAdmin')).not.toBeInTheDocument();
    });

    // Filter to Trainees
    await selectRoleFilter('Trainees');
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(within(table).getByText('trainee_user_1')).toBeInTheDocument();
      expect(within(table).queryByText('LocalAdmin')).not.toBeInTheDocument();
      expect(within(table).queryByText('demo_training_staff')).not.toBeInTheDocument();
    });

    // Back to All Roles -> page 1 again
    await selectRoleFilter('All Roles');
    await waitFor(() => {
      const table = screen.getByRole('table');
      expect(within(table).getByText('LocalAdmin')).toBeInTheDocument();
      expect(within(table).getByText('trainee_user_1')).toBeInTheDocument();
    });
  });
});
