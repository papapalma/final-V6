import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QuickActionsCard from '../QuickActionsCard';
import TraineeProgramDetailsModal from '../../TraineeProgramDetailsModal';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
  },
}));

const sampleProgram = {
  id: 'prog-101',
  name: 'SMAW NC II',
  description: 'Welding course',
  start_date: '2026-10-01',
  end_date: '2026-11-30',
  status: 'active',
};

describe('Trainee Attendance Auto-Pin & Unpin', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('pins Attendance automatically on first visit and allows unpinning and re-pinning from QuickActionsCard', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <QuickActionsCard
          traineeProfile={{ id: 't1', first_name: 'Juan', last_name: 'Cruz', program_id: 'prog-101' }}
        />
      </MemoryRouter>
    );

    // Pinned automatically with empty localStorage
    expect(screen.getByText('Attendance').closest('a')).toHaveAttribute('href', '/trainee/attendance');
    expect(screen.queryByRole('button', { name: /^Pin Attendance$/i })).not.toBeInTheDocument();

    // Unpin from dashboard quick action
    await user.click(screen.getByRole('button', { name: /Unpin attendance from dashboard/i }));
    expect(screen.queryByText('Attendance')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pin Attendance$/i })).toBeInTheDocument();

    // Re-pin from dashboard header
    await user.click(screen.getByRole('button', { name: /^Pin Attendance$/i }));
    expect(screen.getByText('Attendance').closest('a')).toHaveAttribute('href', '/trainee/attendance');
  });

  it('defaults checkbox to checked in TraineeProgramDetailsModal and syncs unpin/re-pin with QuickActionsCard', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <QuickActionsCard
          traineeProfile={{ id: 't1', first_name: 'Juan', last_name: 'Cruz', program_id: 'prog-101' }}
        />
        <TraineeProgramDetailsModal
          program={sampleProgram}
          open={true}
          onOpenChange={vi.fn()}
          isEnrolled={true}
          enrollmentStatus="in-progress"
        />
      </MemoryRouter>
    );

    const checkbox = screen.getByRole('checkbox', { name: /Pin attendance to dashboard/i });
    expect(checkbox).toBeChecked();
    expect(screen.getByText('Attendance').closest('a')).toHaveAttribute('href', '/trainee/attendance');

    // Uncheck in modal -> immediately unpins QuickActionsCard
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(localStorage.getItem('pin_attendance_prog-101')).toBe('false');
    expect(screen.queryByText('Attendance')).not.toBeInTheDocument();

    // Re-check in modal -> restores Attendance in QuickActionsCard
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(localStorage.getItem('pin_attendance_prog-101')).toBe('true');
    expect(screen.getByText('Attendance').closest('a')).toHaveAttribute('href', '/trainee/attendance');
  });

  it('shows a red top-right action dot on the Attendance icon when attendanceNeedsAction is true and hides when false', () => {
    const { rerender, container } = render(
      <MemoryRouter>
        <QuickActionsCard
          traineeProfile={{ id: 't1', first_name: 'Juan', last_name: 'Cruz', program_id: 'prog-101' }}
          attendanceNeedsAction={true}
          attendanceReminderHint="Afternoon attendance pending (4:00 PM – 5:00 PM)"
        />
      </MemoryRouter>
    );

    const badge = container.querySelector('[data-slot="notification-badge"]');
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute('data-variant', 'dot');
    expect(badge?.className).toContain('bg-red-600');
    expect(badge?.className).toContain('top-0');
    expect(badge?.className).toContain('right-0');
    expect(screen.getByRole('link', { name: /Attendance — Afternoon attendance pending/i })).toHaveAttribute(
      'href',
      '/trainee/attendance'
    );

    // Clearing attendance removes the red dot smoothly without flashing a count
    rerender(
      <MemoryRouter>
        <QuickActionsCard
          traineeProfile={{ id: 't1', first_name: 'Juan', last_name: 'Cruz', program_id: 'prog-101' }}
          attendanceNeedsAction={false}
        />
      </MemoryRouter>
    );
    expect(container.querySelector('[data-slot="notification-badge"]')).toHaveAttribute('data-state', 'exiting');
  });
});
