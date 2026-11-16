import React from 'react';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import EnrollmentManagementSection from '../EnrollmentManagementSection';
import { enrollmentService, Enrollment } from '../../services/enrollmentService';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('../../services/enrollmentService', () => ({
  enrollmentService: {
    fetchEnrollments: vi.fn(),
    setEnrollmentUpdateHandler: vi.fn(),
    getConnectionStatus: vi.fn(),
    forceRefresh: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('EnrollmentManagementSection Integration Tests', () => {
  const mockTraineeId = 'trainee-123';

  const mockEnrollment: Enrollment = {
    id: 'enroll-1',
    trainee_id: mockTraineeId,
    program_id: 'prog-1',
    status: 'active',
    enrollment_date: '2024-01-15',
    completion_date: null,
    final_grade: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    program: {
      id: 'prog-1',
      name: 'Python 101',
    },
  };

  const mockEnrollment2: Enrollment = {
    id: 'enroll-2',
    trainee_id: mockTraineeId,
    program_id: 'prog-2',
    status: 'enrolled',
    enrollment_date: '2024-02-01',
    completion_date: null,
    final_grade: null,
    created_at: '2024-02-01T10:00:00Z',
    updated_at: '2024-02-01T10:00:00Z',
    program: {
      id: 'prog-2',
      name: 'JavaScript 101',
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (enrollmentService.fetchEnrollments as any).mockResolvedValue([
      mockEnrollment,
      mockEnrollment2,
    ]);
    (enrollmentService.setEnrollmentUpdateHandler as any).mockReturnValue(vi.fn());
    (enrollmentService.getConnectionStatus as any).mockReturnValue('connected');
    (enrollmentService.updateStatus as any).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  /**
   * Test: Enrollment list updates when admin makes a change via WebSocket
   * Validates: Requirements 4.6, 3.4
   */
  it('should update enrollment list when admin modifies enrollment and WebSocket event received', async () => {
    let enrollmentUpdateCallback: any;

    (enrollmentService.setEnrollmentUpdateHandler as any).mockImplementation((cb) => {
      enrollmentUpdateCallback = cb;
      return vi.fn();
    });

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Python 101')).toBeInTheDocument();
      expect(screen.getByText('JavaScript 101')).toBeInTheDocument();
    });

    // Simulate admin updating enrollment status via WebSocket
    const updatedEnrollment = {
      ...mockEnrollment,
      status: 'completed' as const,
      completion_date: '2024-03-15',
    };

    act(() => {
      enrollmentUpdateCallback({
        type: 'updated',
        enrollment: updatedEnrollment,
      });
    });

    // Verify UI reflects new data
    await waitFor(() => {
      const cards = screen.getAllByText(/Python 101/);
      expect(cards.length).toBeGreaterThan(0);
      // Look for the completed badge
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  /**
   * Test: UI immediately reflects new data without manual refresh
   * Validates: Requirements 4.6
   */
  it('should immediately update UI when WebSocket updates received without user action', async () => {
    let enrollmentUpdateCallback: any;

    (enrollmentService.setEnrollmentUpdateHandler as any).mockImplementation((cb) => {
      enrollmentUpdateCallback = cb;
      return vi.fn();
    });

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(screen.getByText('Python 101')).toBeInTheDocument();
    });

    // Initially shows 'Active' status
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Simulate rapid WebSocket updates
    const updates = [
      { ...mockEnrollment, status: 'active' as const },
      { ...mockEnrollment, status: 'completed' as const, completion_date: '2024-03-15' },
      { ...mockEnrollment, status: 'completed' as const, completion_date: '2024-03-16' },
    ];

    for (const update of updates) {
      act(() => {
        enrollmentUpdateCallback({
          type: 'updated',
          enrollment: update,
        });
      });
    }

    // Verify final state is reflected in UI
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  /**
   * Test: Connection status indicator shows WebSocket connection status
   * Validates: Requirements 6.5
   */
  it('should display connection status indicator showing WebSocket status', async () => {
    (enrollmentService.getConnectionStatus as any)
      .mockReturnValueOnce('connected')
      .mockReturnValueOnce('connected')
      .mockReturnValue('connected');

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  /**
   * Test: Actions work and UI updates reflect success
   * Validates: Requirements 4.6
   */
  it('should update enrollment status and show success message', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(screen.getByText('Python 101')).toBeInTheDocument();
    });

    // Click "Mark as Complete" button
    const completeButtons = screen.getAllByText(/Mark as Complete/);
    await user.click(completeButtons[0]);

    // Confirm action in dialog
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirm/i });
    await user.click(confirmButton);

    // Verify success toast
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Python 101'),
        expect.objectContaining({
          description: expect.stringContaining('real-time'),
        })
      );
    });
  });

  /**
   * Test: Multiple simultaneous updates work correctly
   * Validates: Requirements 4.6, 11.5
   */
  it('should handle multiple simultaneous WebSocket updates correctly', async () => {
    let enrollmentUpdateCallback: any;

    (enrollmentService.setEnrollmentUpdateHandler as any).mockImplementation((cb) => {
      enrollmentUpdateCallback = cb;
      return vi.fn();
    });

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(screen.getByText('Python 101')).toBeInTheDocument();
      expect(screen.getByText('JavaScript 101')).toBeInTheDocument();
    });

    // Simulate multiple simultaneous updates
    act(() => {
      // Update 1: Change first enrollment status
      enrollmentUpdateCallback({
        type: 'updated',
        enrollment: { ...mockEnrollment, status: 'completed' as const },
      });

      // Update 2: Change second enrollment status
      enrollmentUpdateCallback({
        type: 'updated',
        enrollment: { ...mockEnrollment2, status: 'failed' as const },
      });

      // Update 3: Add new enrollment
      const newEnrollment: Enrollment = {
        id: 'enroll-3',
        trainee_id: mockTraineeId,
        program_id: 'prog-3',
        status: 'active',
        enrollment_date: '2024-03-01',
        completion_date: null,
        final_grade: null,
        created_at: '2024-03-01T10:00:00Z',
        updated_at: '2024-03-01T10:00:00Z',
        program: { id: 'prog-3', name: 'React 101' },
      };

      enrollmentUpdateCallback({
        type: 'added',
        enrollment: newEnrollment,
      });
    });

    // Verify all updates are reflected
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
      expect(screen.getByText('React 101')).toBeInTheDocument();
    });
  });

  /**
   * Test: Error handling for network issues
   * Validates: Requirements 4.6, 10.1
   */
  it('should handle network errors gracefully', async () => {
    (enrollmentService.fetchEnrollments as any).mockRejectedValue(
      new Error('Network error: Failed to fetch')
    );

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
      expect(screen.getByText(/check your internet connection/)).toBeInTheDocument();
    });
  });

  /**
   * Test: Fallback to API on WebSocket unavailable
   * Validates: Requirements 6.1, 6.2
   */
  it('should work with REST API fallback when WebSocket unavailable', async () => {
    (enrollmentService.getConnectionStatus as any).mockReturnValue('disconnected');

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(screen.getByText('Python 101')).toBeInTheDocument();
      // Should still show disconnected status
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    // Enrollments should still be displayed
    expect(screen.getByText('JavaScript 101')).toBeInTheDocument();
  });

  /**
   * Test: Empty state when no enrollments
   * Validates: Requirements 4.6
   */
  it('should show empty state when trainee has no enrollments', async () => {
    (enrollmentService.fetchEnrollments as any).mockResolvedValue([]);

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(screen.getByText('No Enrollments')).toBeInTheDocument();
      expect(
        screen.getByText(/does not have any active or past enrollments/)
      ).toBeInTheDocument();
    });
  });

  /**
   * Test: Retry button works after error
   * Validates: Requirements 4.6
   */
  it('should retry fetching enrollments after error', async () => {
    const user = userEvent.setup({ delay: null });

    (enrollmentService.fetchEnrollments as any)
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce([mockEnrollment]);

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });

    // Click retry button
    const retryButton = screen.getByRole('button', { name: /Retry/i });
    await user.click(retryButton);

    // Verify enrollments are now displayed
    await waitFor(() => {
      expect(screen.getByText('Python 101')).toBeInTheDocument();
    });
  });

  /**
   * Test: Connection status changes reflect in UI
   * Validates: Requirements 6.5, 13.2
   */
  it('should update connection status indicator when connection changes', async () => {
    vi.useFakeTimers();
    try {
      (enrollmentService.getConnectionStatus as any)
        .mockReturnValueOnce('connecting')
        .mockReturnValueOnce('connected')
        .mockReturnValue('reconnecting');

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      expect(screen.getByText('Connecting')).toBeInTheDocument();

      // Advance timers to trigger status update
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('Connected')).toBeInTheDocument();

      // Advance timers again to simulate reconnection
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('Reconnecting')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  /**
   * Test: Cancel action dismisses confirmation dialog
   * Validates: Requirements 4.6
   */
  it('should cancel action and dismiss dialog without updating', async () => {
    const user = userEvent.setup({ delay: null });

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(screen.getByText('Python 101')).toBeInTheDocument();
    });

    // Click "Mark as Complete" button
    const completeButtons = screen.getAllByText(/Mark as Complete/);
    await user.click(completeButtons[0]);

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    // Click cancel
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    await user.click(cancelButton);

    // Dialog should close
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();

    // updateStatus should not have been called
    expect(enrollmentService.updateStatus).not.toHaveBeenCalled();
  });

  /**
   * Test: Loading state shows skeleton cards
   * Validates: Requirements 4.6
   */
  it('should show loading skeleton while fetching enrollments', async () => {
    let resolveFetch: any;
    (enrollmentService.fetchEnrollments as any).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        })
    );

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    // Should show skeleton cards initially
    const skeletonCards = screen.getAllByRole('status', { hidden: true });
    expect(skeletonCards.length).toBeGreaterThan(0);

    // Resolve fetch
    act(() => {
      resolveFetch([mockEnrollment, mockEnrollment2]);
    });

    // Enrollments should now be visible
    await waitFor(() => {
      expect(screen.getByText('Python 101')).toBeInTheDocument();
    });
  });
});

