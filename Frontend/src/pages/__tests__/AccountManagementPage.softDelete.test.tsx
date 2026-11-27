import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AccountManagementPage from '../AccountManagementPage';
import userService, { User } from '../../services/userService';
import { toast } from 'sonner';

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
    id: 'u-staff-paolo',
    username: 'Paolo',
    email: 'paolo@bmdc.site',
    role: 'staff_training_coordinator',
    created_at: '2026-09-02T00:00:00Z',
    updated_at: '2026-09-02T00:00:00Z',
  },
  {
    id: 'u-trainee-1',
    username: 'trainee_juan',
    email: 'juan@bmdc.site',
    role: 'trainee',
    created_at: '2026-09-03T00:00:00Z',
    updated_at: '2026-09-03T00:00:00Z',
  },
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

describe('AccountManagementPage soft-delete workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(userService.getUsers).mockResolvedValue(mockUsers);
    vi.mocked(userService.deleteUser).mockResolvedValue(undefined);
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

  it('disables self-archive and replaces native confirm() with DeleteUserDialog', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);

    render(<AccountManagementPage />);

    const table = await screen.findByRole('table');
    const selfBtn = within(table).getByRole('button', {
      name: /Cannot archive your own account \(LocalAdmin\)/i,
    });
    expect(selfBtn).toBeDisabled();

    const paoloArchiveBtn = within(table).getByRole('button', { name: 'Archive Paolo' });
    fireEvent.click(paoloArchiveBtn);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByText('Archive User Account?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Archive Account/i }));

    await waitFor(() => {
      expect(userService.deleteUser).toHaveBeenCalledWith('u-staff-paolo');
      expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/archived/i));
    });

    confirmSpy.mockRestore();
  });

  it('shows independent trainee-profile warning when opening archive dialog for a trainee user', async () => {
    render(<AccountManagementPage />);

    const table = await screen.findByRole('table');
    fireEvent.click(within(table).getByRole('button', { name: 'Archive trainee_juan' }));

    expect(await screen.findByText(/Portal login only:/i)).toBeInTheDocument();
  });
});
