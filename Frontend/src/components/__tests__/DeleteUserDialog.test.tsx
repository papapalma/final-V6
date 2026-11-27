import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import DeleteUserDialog from '../DeleteUserDialog';
import type { User } from '../../services/userService';

const staffUser: User = {
  id: 'u-staff-1',
  username: 'Paolo',
  email: 'paolo@bmdc.site',
  role: 'staff_training_coordinator',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

const traineeUser: User = {
  id: 'u-trainee-1',
  username: 'juan_delacruz',
  email: 'juan@bmdc.site',
  role: 'trainee',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z',
};

describe('DeleteUserDialog', () => {
  it('displays user details and soft-delete assurance for staff accounts without trainee-only notice', () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onCancel = vi.fn();

    render(
      <DeleteUserDialog
        open
        user={staffUser}
        isDeleting={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Archive User Account?')).toBeInTheDocument();
    expect(screen.getAllByText('Paolo').length).toBeGreaterThan(0);
    expect(screen.getByText('paolo@bmdc.site')).toBeInTheDocument();
    expect(screen.getByText(/Archive → User Accounts/i)).toBeInTheDocument();
    expect(screen.queryByText(/Portal login only/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Archive Account/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('displays independent portal-login-only warning for trainee-role accounts', () => {
    render(
      <DeleteUserDialog
        open
        user={traineeUser}
        isDeleting={false}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText(/Portal login only:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/preserving|without deleting their trainee profile/i)
    ).toBeInTheDocument();
  });

  it('disables Cancel and Confirm buttons while archiving is in progress', () => {
    const onCancel = vi.fn();

    render(
      <DeleteUserDialog
        open
        user={staffUser}
        isDeleting
        onConfirm={vi.fn().mockResolvedValue(undefined)}
        onCancel={onCancel}
      />
    );

    expect(screen.getByRole('button', { name: /Cancel/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Archiving/i })).toBeDisabled();
  });
});
