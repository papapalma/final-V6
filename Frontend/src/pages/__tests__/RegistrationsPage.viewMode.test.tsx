import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import RegistrationsPage from '../RegistrationsPage';

const mockRegistrations = [
  {
    id: 'reg-1',
    username: 'juandelacruz',
    email: 'juan@bmdc.local',
    first_name: 'Juan',
    last_name: 'Dela Cruz',
    phone: '09171234567',
    program: { id: 'prog-1', name: 'Organic Agriculture Production' },
    registration_status: 'pending' as const,
    created_at: '2026-11-24T00:00:00.000Z',
  },
  {
    id: 'reg-2',
    username: 'mariasantos',
    email: 'maria@bmdc.local',
    first_name: 'Maria',
    last_name: 'Santos',
    phone: '09187654321',
    program: { id: 'prog-2', name: 'Shielded Metal Arc Welding' },
    registration_status: 'completed' as const,
    created_at: '2026-10-26T00:00:00.000Z',
  },
];

vi.mock('../../components/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../services/registrationService', () => ({
  default: {
    getRegistrations: vi.fn(() => Promise.resolve(mockRegistrations)),
    approveRegistration: vi.fn(() => Promise.resolve({})),
    rejectRegistration: vi.fn(() => Promise.resolve({})),
  },
}));

vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ files: [] }),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RegistrationsPage card & table view toggle', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('defaults to card view, toggles to table view, persists preference, and supports row/action dialogs', async () => {
    render(<RegistrationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
    });

    const cardBtn = screen.getByRole('button', { name: 'Card view' });
    const tableBtn = screen.getByRole('button', { name: 'Table view' });
    expect(cardBtn).toHaveAttribute('aria-pressed', 'true');
    expect(tableBtn).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    fireEvent.click(tableBtn);

    expect(tableBtn).toHaveAttribute('aria-pressed', 'true');
    expect(localStorage.getItem('registrationsViewMode')).toBe('table');

    const table = screen.getByRole('table');
    expect(within(table).getByText('Juan Dela Cruz')).toBeInTheDocument();
    expect(within(table).getByText('juan@bmdc.local')).toBeInTheDocument();
    expect(within(table).getByText('Organic Agriculture Production')).toBeInTheDocument();
    expect(within(table).getByText('Maria Santos')).toBeInTheDocument();

    // Pending row exposes Approve/Reject buttons without triggering row details dialog
    const approveBtn = within(table).getByRole('button', { name: 'Approve' });
    fireEvent.click(approveBtn);
    expect(await screen.findByText('Confirm Approval')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Clicking a table row opens the Registration Details dialog
    fireEvent.click(within(table).getByText('Maria Santos'));
    expect(await screen.findByText('Registration Details')).toBeInTheDocument();
  });

  it('restores saved table view from localStorage on mount', async () => {
    localStorage.setItem('registrationsViewMode', 'table');
    render(<RegistrationsPage />);

    await waitFor(() => {
      expect(screen.getByRole('table')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Table view' })).toHaveAttribute('aria-pressed', 'true');
  });
});
