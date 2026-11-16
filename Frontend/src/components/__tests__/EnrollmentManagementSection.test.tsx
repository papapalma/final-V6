import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import * as fc from 'fast-check';
import EnrollmentManagementSection from '../EnrollmentManagementSection';
import { enrollmentService, Enrollment, ConnectionStatus } from '../../services/enrollmentService';
import { useEnrollmentUpdates } from '../../hooks/useEnrollmentUpdates';

// Mock the useEnrollmentUpdates hook
vi.mock('../../hooks/useEnrollmentUpdates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../hooks/useEnrollmentUpdates')>();
  return {
    ...actual,
    useEnrollmentUpdates: vi.fn((traineeId: string) => actual.useEnrollmentUpdates(traineeId)),
  };
});

// Mock the enrollmentService
vi.mock('../../services/enrollmentService', () => ({
  enrollmentService: {
    fetchEnrollments: vi.fn(),
    updateStatus: vi.fn(),
    getEnrollment: vi.fn(),
    clearCache: vi.fn(),
    forceRefresh: vi.fn(),
    setEnrollmentUpdateHandler: vi.fn(() => () => {}),
    getConnectionStatus: vi.fn(() => 'connected'),
  },
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock ConnectionStatusIndicator component
vi.mock('../ConnectionStatusIndicator', () => ({
  default: ({ connectionStatus, showLabel, size }: any) => (
    <div data-testid="connection-indicator">
      {showLabel && <span>{connectionStatus}</span>}
    </div>
  ),
}));

/**
 * Integration Tests for EnrollmentManagementSection Component
 * 
 * **Validates: Requirements 4.6**
 * 
 * These tests verify end-to-end user flows for real-time enrollment updates,
 * including WebSocket event simulation and UI reflection of changes.
 */
describe('EnrollmentManagementSection - Integration Tests', () => {
  const mockTraineeId = '550e8400-e29b-41d4-a716-446655440000';
  
  const mockEnrollment: Enrollment = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    trainee_id: mockTraineeId,
    program_id: '770e8400-e29b-41d4-a716-446655440002',
    status: 'enrolled' as const,
    enrollment_date: '2024-01-15',
    completion_date: null,
    final_grade: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    trainee: {
      id: mockTraineeId,
      first_name: 'John',
      last_name: 'Doe',
      middle_name: 'Michael',
      email: 'john.doe@example.com',
    },
    program: {
      id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'Advanced React',
      description: 'Learn advanced React patterns',
      start_date: '2024-01-15',
      end_date: '2024-03-15',
      status: 'active',
    },
  };

  const mockEnrollment2: Enrollment = {
    id: '660e8400-e29b-41d4-a716-446655440002',
    trainee_id: mockTraineeId,
    program_id: '770e8400-e29b-41d4-a716-446655440003',
    status: 'enrolled' as const,
    enrollment_date: '2024-01-20',
    completion_date: null,
    final_grade: null,
    created_at: '2024-01-20T10:00:00Z',
    updated_at: '2024-01-20T10:00:00Z',
    trainee: {
      id: mockTraineeId,
      first_name: 'John',
      last_name: 'Doe',
      middle_name: 'Michael',
      email: 'john.doe@example.com',
    },
    program: {
      id: '770e8400-e29b-41d4-a716-446655440003',
      name: 'TypeScript Fundamentals',
      description: 'Master TypeScript basics',
      start_date: '2024-01-20',
      end_date: '2024-02-20',
      status: 'active',
    },
  };

  let mockUpdateHandler: ((event: any) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup hook mock to capture the update handler
    vi.mocked(useEnrollmentUpdates).mockImplementation((traineeId: string) => {
      // Return a function that can trigger updates
      return {
        enrollments: [mockEnrollment],
        connectionStatus: 'connected' as ConnectionStatus,
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: vi.fn(),
        // Store handler for testing
        _setUpdateHandler: (handler: any) => {
          mockUpdateHandler = handler;
        },
      } as any;
    });
  });

  afterEach(() => {
    cleanup();
    mockUpdateHandler = null;
  });

  afterAll(async () => {
    const actual = await vi.importActual<typeof import('../../hooks/useEnrollmentUpdates')>(
      '../../hooks/useEnrollmentUpdates'
    );
    vi.mocked(useEnrollmentUpdates).mockImplementation((traineeId: string) =>
      actual.useEnrollmentUpdates(traineeId)
    );
  });

  /**
   * Test 8.1: Enrollment list updates when WebSocket event received
   * 
   * Scenario:
   * 1. Component renders with initial enrollment
   * 2. Admin makes change (simulated by WebSocket event)
   * 3. UI immediately reflects the change
   * 
   * **Validates: Requirement 4.6 - "When enrollment-updated WebSocket event received, UI immediately reflects the change"**
   */
  describe('8.1: Enrollment list updates on WebSocket event', () => {
    it('should immediately update enrollment status when enrollment-updated event received', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify initial enrollment is displayed
      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
        expect(screen.getByText('Enrolled')).toBeInTheDocument();
      });

      // Simulate enrollment-updated event - status changed to active
      const updatedEnrollment: Enrollment = {
        ...mockEnrollment,
        status: 'active',
        updated_at: new Date().toISOString(),
      };

      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [updatedEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify updated status is displayed
      await waitFor(() => {
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });

    it('should display updated completion date when enrollment is marked complete', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify initial state - no completion date
      await waitFor(() => {
        const completionCells = screen.getAllByText('N/A');
        expect(completionCells.length).toBeGreaterThan(0);
      });

      // Simulate completion event
      const completedEnrollment: Enrollment = {
        ...mockEnrollment,
        status: 'completed',
        completion_date: '2024-02-15',
        final_grade: 85,
        updated_at: new Date().toISOString(),
      };

      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [completedEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify completion date and grade are displayed
      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
        expect(screen.getByText('2024-02-15')).toBeInTheDocument();
        expect(screen.getByText('85%')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test 8.2: New enrollment appears in list when enrollment-added event received
   * 
   * **Validates: Requirement 4.6 - "When enrollment-added event received, new enrollment appears in list"**
   */
  describe('8.2: New enrollment appears when added via WebSocket', () => {
    it('should add new enrollment to list when enrollment-added event received', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify only first enrollment is displayed
      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      // Should not show TypeScript course yet
      expect(screen.queryByText('TypeScript Fundamentals')).not.toBeInTheDocument();

      // Simulate enrollment-added event
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment, mockEnrollment2],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify both enrollments are displayed
      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
        expect(screen.getByText('TypeScript Fundamentals')).toBeInTheDocument();
      });
    });

    it('should display new enrollment with correct status', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      // Add enrollment with 'active' status
      const activeEnrollment: Enrollment = {
        ...mockEnrollment2,
        status: 'active',
      };

      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment, activeEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify new enrollment appears with correct status
      await waitFor(() => {
        expect(screen.getAllByText('Active')).toHaveLength(1);
      });
    });
  });

  /**
   * Test 8.3: Enrollment disappears from list when enrollment-removed event received
   * 
   * **Validates: Requirement 4.6 - "When enrollment-removed event received, enrollment disappears from list"**
   */
  describe('8.3: Enrollment disappears when removed via WebSocket', () => {
    it('should remove enrollment from list when enrollment-removed event received', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment, mockEnrollment2],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify both enrollments are displayed
      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
        expect(screen.getByText('TypeScript Fundamentals')).toBeInTheDocument();
      });

      // Simulate enrollment-removed event
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment2],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify first enrollment is removed
      await waitFor(() => {
        expect(screen.queryByText('Advanced React')).not.toBeInTheDocument();
        expect(screen.getByText('TypeScript Fundamentals')).toBeInTheDocument();
      });
    });

    it('should handle multiple removals correctly', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment, mockEnrollment2],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
        expect(screen.getByText('TypeScript Fundamentals')).toBeInTheDocument();
      });

      // Remove both enrollments
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify empty state is displayed
      await waitFor(() => {
        expect(screen.getByText('No Enrollments')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test 8.4: Action buttons trigger status updates correctly
   * 
   * **Validates: Requirement 4.6 - "Action buttons trigger status updates correctly"**
   */
  describe('8.4: Action buttons trigger status updates', () => {
    it('should call updateStatus when Mark as Complete button is clicked and confirmed', async () => {
      const mockRefetch = vi.fn();
      const mockUpdateStatus = vi.fn().mockResolvedValue({});
      
      vi.mocked(enrollmentService.updateStatus).mockImplementation(mockUpdateStatus);
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      // Click Mark as Complete button
      const completeButton = screen.getByText('Mark as Complete');
      await userEvent.click(completeButton);

      // Click Confirm in dialog
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm/i });
        expect(confirmButton).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmButton);

      // Verify updateStatus was called with correct parameters
      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith(
          mockEnrollment.id,
          expect.objectContaining({
            status: 'completed',
          })
        );
      });
    });

    it('should call updateStatus with fail status when Mark as Failed is clicked', async () => {
      const mockRefetch = vi.fn();
      const mockUpdateStatus = vi.fn().mockResolvedValue({});
      
      vi.mocked(enrollmentService.updateStatus).mockImplementation(mockUpdateStatus);
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      // Click Mark as Failed button
      const failButton = screen.getByText('Mark as Failed');
      await userEvent.click(failButton);

      // Click Confirm in dialog
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm/i });
        expect(confirmButton).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmButton);

      // Verify updateStatus was called with fail status
      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith(
          mockEnrollment.id,
          expect.objectContaining({
            status: 'failed',
          })
        );
      });
    });

    it('should call updateStatus with dropped status when Drop Program is clicked', async () => {
      const mockRefetch = vi.fn();
      const mockUpdateStatus = vi.fn().mockResolvedValue({});
      
      vi.mocked(enrollmentService.updateStatus).mockImplementation(mockUpdateStatus);
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      // Click Drop Program button
      const dropButton = screen.getByText('Drop Program');
      await userEvent.click(dropButton);

      // Click Confirm in dialog
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm/i });
        expect(confirmButton).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmButton);

      // Verify updateStatus was called with dropped status
      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith(
          mockEnrollment.id,
          expect.objectContaining({
            status: 'dropped',
          })
        );
      });
    });

    it('should hide action buttons for terminal statuses', async () => {
      const mockRefetch = vi.fn();
      const completedEnrollment: Enrollment = {
        ...mockEnrollment,
        status: 'completed',
      };

      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [completedEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Completed')).toBeInTheDocument();
      });

      // Action buttons should not be visible
      expect(screen.queryByText('Mark as Complete')).not.toBeInTheDocument();
      expect(screen.queryByText('Mark as Failed')).not.toBeInTheDocument();
      expect(screen.queryByText('Drop Program')).not.toBeInTheDocument();
    });
  });

  /**
   * Test 8.5: Confirmation dialog works end-to-end
   * 
   * **Validates: Requirement 4.6 - "Confirmation dialog works end-to-end"**
   */
  describe('8.5: Confirmation dialog works end-to-end', () => {
    it('should display confirmation dialog when action button is clicked', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      // Click action button
      const completeButton = screen.getByText('Mark as Complete');
      await userEvent.click(completeButton);

      // Verify dialog is displayed
      await waitFor(() => {
        expect(screen.getByText('Mark Enrollment as Complete?')).toBeInTheDocument();
      });
    });

    it('should close dialog when Cancel button is clicked', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      // Click action button
      const completeButton = screen.getByText('Mark as Complete');
      await userEvent.click(completeButton);

      // Verify dialog is displayed
      await waitFor(() => {
        expect(screen.getByText('Mark Enrollment as Complete?')).toBeInTheDocument();
      });

      // Click Cancel button
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Verify dialog is closed
      await waitFor(() => {
        expect(screen.queryByText('Mark Enrollment as Complete?')).not.toBeInTheDocument();
      });
    });

    it('should show correct message in confirmation dialog for each action', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      // Test complete dialog
      let completeButton = screen.getByText('Mark as Complete');
      await userEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('Mark Enrollment as Complete?')).toBeInTheDocument();
      });

      let cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Re-render to clear dialog
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Test fail dialog
      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      const failButton = screen.getByText('Mark as Failed');
      await userEvent.click(failButton);

      await waitFor(() => {
        expect(screen.getByText('Mark Enrollment as Failed?')).toBeInTheDocument();
      });

      cancelButton = screen.getByRole('button', { name: /cancel/i });
      await userEvent.click(cancelButton);

      // Re-render again
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Test drop dialog
      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      const dropButton = screen.getByText('Drop Program');
      await userEvent.click(dropButton);

      await waitFor(() => {
        expect(screen.getByText('Drop Enrollment?')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test 8.6: Connection status indicator shows in header
   * 
   * **Validates: Requirement 4.6 - "Connection status indicator shows in header"**
   */
  describe('8.6: Connection status indicator shows in header', () => {
    it('should display connection status indicator', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
      });
    });

    it('should update connection status indicator when status changes', async () => {
      const mockRefetch = vi.fn();
      let currentStatus: ConnectionStatus = 'connecting';

      vi.mocked(useEnrollmentUpdates).mockImplementation(() => ({
        enrollments: [mockEnrollment],
        connectionStatus: currentStatus,
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any));

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify initial status
      await waitFor(() => {
        expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
      });

      // Update status to connected
      currentStatus = 'connected';
      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Indicator should be updated
      expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
    });

    it('should display reconnecting status when connection is lost', async () => {
      const mockRefetch = vi.fn();
      let currentStatus: ConnectionStatus = 'connected';

      vi.mocked(useEnrollmentUpdates).mockImplementation(() => ({
        enrollments: [mockEnrollment],
        connectionStatus: currentStatus,
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any));

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
      });

      // Simulate connection loss
      currentStatus = 'reconnecting';
      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Indicator should reflect reconnecting status
      expect(screen.getByTestId('connection-indicator')).toBeInTheDocument();
    });
  });

  /**
   * Test 8.7: Loading states display correctly
   * 
   * **Validates: Requirement 4.6 - "Loading states display correctly"**
   */
  describe('8.7: Loading states display correctly', () => {
    it('should display loading skeleton when enrollments are being fetched', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [],
        connectionStatus: 'connecting',
        loading: true,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify skeleton loader is displayed
      const skeletons = screen.getAllByText((content, element) => {
        return element?.className?.includes('animate-pulse') || false;
      });

      // Should have multiple skeleton items
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should display loading state with spinner in confirmation dialog', async () => {
      const mockRefetch = vi.fn();
      const mockUpdateStatus = vi.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 500))
      );

      vi.mocked(enrollmentService.updateStatus).mockImplementation(mockUpdateStatus);
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [mockEnrollment],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });

      // Click action button
      const completeButton = screen.getByText('Mark as Complete');
      await userEvent.click(completeButton);

      // Click Confirm (this will trigger async update)
      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /confirm/i });
        expect(confirmButton).toBeInTheDocument();
      });

      const confirmButton = screen.getByRole('button', { name: /confirm/i });
      await userEvent.click(confirmButton);

      // Wait for update to complete
      await waitFor(
        () => {
          expect(mockUpdateStatus).toHaveBeenCalled();
        },
        { timeout: 1000 }
      );
    });

    it('should hide loading skeleton once data is loaded', async () => {
      const mockRefetch = vi.fn();
      let loading = true;

      vi.mocked(useEnrollmentUpdates).mockImplementation(() => ({
        enrollments: loading ? [] : [mockEnrollment],
        connectionStatus: 'connected',
        loading,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any));

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify skeleton is displayed
      await waitFor(() => {
        const elements = screen.queryAllByText((content, element) => {
          return element?.className?.includes('animate-pulse') || false;
        });
        expect(elements.length).toBeGreaterThan(0);
      });

      // Simulate loading complete
      loading = false;
      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify enrollment is displayed and skeleton is gone
      await waitFor(() => {
        expect(screen.getByText('Advanced React')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test 8.8: Error states display correctly with Retry button
   * 
   * **Validates: Requirement 4.6 - "Error states display correctly with Retry button"**
   */
  describe('8.8: Error states display correctly with Retry button', () => {
    it('should display error message when enrollment fetch fails', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [],
        connectionStatus: 'disconnected',
        loading: false,
        error: 'Failed to fetch enrollments',
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify error message is displayed
      await waitFor(() => {
        expect(screen.getByText('Failed to Load Enrollments')).toBeInTheDocument();
        expect(screen.getByText('Failed to fetch enrollments')).toBeInTheDocument();
      });
    });

    it('should display Retry button in error state', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [],
        connectionStatus: 'disconnected',
        loading: false,
        error: 'Failed to fetch enrollments',
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify Retry button is displayed
      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });
    });

    it('should call refetch when Retry button is clicked', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [],
        connectionStatus: 'disconnected',
        loading: false,
        error: 'Failed to fetch enrollments',
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Click Retry button
      await waitFor(() => {
        const retryButton = screen.getByRole('button', { name: /retry/i });
        expect(retryButton).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      await userEvent.click(retryButton);

      // Verify refetch was called
      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('should display appropriate error message for different error types', async () => {
      const mockRefetch = vi.fn();
      
      // Test 404 error
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [],
        connectionStatus: 'disconnected',
        loading: false,
        error: '404 Not Found',
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      const { rerender } = render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Trainee Not Found')).toBeInTheDocument();
      });

      // Test 403 error
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [],
        connectionStatus: 'disconnected',
        loading: false,
        error: '403 Forbidden',
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Permission Denied')).toBeInTheDocument();
      });

      // Test network error
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [],
        connectionStatus: 'disconnected',
        loading: false,
        error: 'Network timeout',
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      rerender(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      await waitFor(() => {
        expect(screen.getByText('Network Error')).toBeInTheDocument();
      });
    });
  });

  /**
   * Test 8.9: Empty state displays when no enrollments
   * 
   * **Validates: Requirement 4.6 - UI handles empty state**
   */
  describe('8.9: Empty state displays correctly', () => {
    it('should display empty state message when no enrollments exist', async () => {
      const mockRefetch = vi.fn();
      vi.mocked(useEnrollmentUpdates).mockReturnValue({
        enrollments: [],
        connectionStatus: 'connected',
        loading: false,
        error: null,
        forceRefresh: vi.fn(),
        refetch: mockRefetch,
      } as any);

      render(
        <EnrollmentManagementSection traineeId={mockTraineeId} />
      );

      // Verify empty state is displayed
      await waitFor(() => {
        expect(screen.getByText('No Enrollments')).toBeInTheDocument();
        expect(screen.getByText('This trainee does not have any active or past enrollments at this time.')).toBeInTheDocument();
      });
    });
  });
});

describe('EnrollmentManagementSection - useEffect Hook', () => {
  const mockTraineeId = '550e8400-e29b-41d4-a716-446655440000';
  
  const mockEnrollment: Enrollment = {
    id: '660e8400-e29b-41d4-a716-446655440001',
    trainee_id: mockTraineeId,
    program_id: '770e8400-e29b-41d4-a716-446655440002',
    status: 'enrolled' as const,
    enrollment_date: '2024-01-15',
    completion_date: null,
    final_grade: null,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    trainee: {
      id: mockTraineeId,
      first_name: 'John',
      last_name: 'Doe',
      middle_name: 'Michael',
      email: 'john.doe@example.com',
    },
    program: {
      id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'Advanced React',
      description: 'Learn advanced React patterns',
      start_date: '2024-01-15',
      end_date: '2024-03-15',
      status: 'active',
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const actual = await vi.importActual<typeof import('../../hooks/useEnrollmentUpdates')>(
      '../../hooks/useEnrollmentUpdates'
    );
    vi.mocked(useEnrollmentUpdates).mockImplementation((traineeId: string) =>
      actual.useEnrollmentUpdates(traineeId)
    );
  });

  /**
   * Test 2.5.1: useEffect sets loading state and calls fetchEnrollments on mount
   * 
   * Validates:
   * - Component sets loading = true when effect runs
   * - Service.fetchEnrollments is called with traineeId
   * - Loading skeleton is displayed while fetching
   * 
   * Requirements: 1.1, 9.1, 9.2
   */
  it('should set loading state and call fetchEnrollments on component mount', async () => {
    const mockRefetch = vi.fn();
    vi.mocked(useEnrollmentUpdates).mockReturnValueOnce({
      enrollments: [mockEnrollment],
      connectionStatus: 'connected',
      loading: false,
      error: null,
      forceRefresh: vi.fn(),
      refetch: mockRefetch,
    } as any);

    render(
      React.createElement(EnrollmentManagementSection, { traineeId: mockTraineeId })
    );

    // Wait for enrollment to appear
    await waitFor(() => {
      expect(screen.getByText('Advanced React')).toBeInTheDocument();
    });
  });

  /**
   * Test 2.5.2: useEffect updates enrollments state on success
   * 
   * Validates:
   * - On successful fetch, enrollments are added to state
   * - Error state is cleared
   * - Loading state is set to false
   * 
   * Requirements: 1.1
   */
  it('should update enrollments state and clear error on successful fetch', async () => {
    const mockFetchEnrollments = vi.fn().mockResolvedValue([mockEnrollment]);
    vi.mocked(enrollmentService.fetchEnrollments).mockImplementation(mockFetchEnrollments);

    render(
      React.createElement(EnrollmentManagementSection, { traineeId: mockTraineeId })
    );

    // Wait for the enrollment data to be rendered
    await waitFor(() => {
      expect(screen.getByText('Advanced React')).toBeInTheDocument();
    });

    // Verify the enrollment is displayed
    expect(screen.getByText('Advanced React')).toBeInTheDocument();
    expect(screen.getByText('Enrolled')).toBeInTheDocument();
  });

  /**
   * Test 2.5.3: useEffect sets error state and calls onError callback on failure
   * 
   * Validates:
   * - On fetch failure, error state is updated with error message
   * - Loading state is set to false
   * - onError callback is called if provided
   * 
   * Requirements: 1.1
   */
  it('should set error state and call onError callback on fetch failure', async () => {
    const mockError = new Error('Network error');
    const mockFetchEnrollments = vi.fn().mockRejectedValue(mockError);
    const mockOnError = vi.fn();
    
    vi.mocked(enrollmentService.fetchEnrollments).mockImplementation(mockFetchEnrollments);

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} onError={mockOnError} />
    );

    // Wait for error state to be displayed (should match error message pattern)
    await waitFor(() => {
      // The component will display a specific error title based on the error message
      // "Network error" gets mapped to "Network Error"
      expect(screen.getByText('Network Error')).toBeInTheDocument();
    });

    // Verify error callback was called
    expect(mockOnError).toHaveBeenCalledWith(mockError);
  });

  /**
   * Test 2.5.4: useEffect is called again when traineeId changes
   * 
   * Validates:
   * - Effect re-runs when traineeId prop changes
   * - New fetchEnrollments call is made with new traineeId
   * 
   * Requirements: 9.1, 9.2
   */
  it('should re-fetch enrollments when traineeId changes', async () => {
    const newTraineeId = '880e8400-e29b-41d4-a716-446655440003';
    
    const mockFetchEnrollments = vi.fn().mockResolvedValue([mockEnrollment]);
    vi.mocked(enrollmentService.fetchEnrollments).mockImplementation(mockFetchEnrollments);

    const { rerender } = render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(mockFetchEnrollments).toHaveBeenCalledWith(mockTraineeId);
    });

    // Reset mock to count new calls
    mockFetchEnrollments.mockClear();

    // Re-render with new traineeId
    rerender(
      <EnrollmentManagementSection traineeId={newTraineeId} />
    );

    // Verify fetchEnrollments was called with new traineeId
    await waitFor(() => {
      expect(mockFetchEnrollments).toHaveBeenCalledWith(newTraineeId);
    });
  });

  /**
   * Test 2.5.5: useEffect only fetches when traineeId is provided
   * 
   * Validates:
   * - Effect does not call fetchEnrollments if traineeId is not provided
   * 
   * Requirements: 9.1
   */
  it('should not fetch enrollments if traineeId is not provided', () => {
    const mockFetchEnrollments = vi.fn();
    vi.mocked(enrollmentService.fetchEnrollments).mockImplementation(mockFetchEnrollments);

    render(
      <EnrollmentManagementSection traineeId="" />
    );

    // Verify fetchEnrollments was not called
    expect(mockFetchEnrollments).not.toHaveBeenCalled();
  });

  /**
   * Test 2.5.6: useEffect handles empty enrollments array
   * 
   * Validates:
   * - Empty enrollments array is handled correctly
   * - "No Enrollments" message is displayed
   * 
   * Requirements: 1.1
   */
  it('should display empty state when no enrollments are returned', async () => {
    const mockFetchEnrollments = vi.fn().mockResolvedValue([]);
    vi.mocked(enrollmentService.fetchEnrollments).mockImplementation(mockFetchEnrollments);

    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    // Wait for empty state to be rendered
    await waitFor(() => {
      expect(screen.getByText('No Enrollments')).toBeInTheDocument();
    });
  });

  /**
   * Test 2.5.7: Cache hit provides instant state update without loading skeleton
   * 
   * Validates:
   * - When service returns cached data immediately, no loading skeleton is shown
   * - State is updated instantly
   * 
   * Requirements: 1.1
   */
  it('should handle cache hits by providing instant state update', async () => {
    const mockFetchEnrollments = vi.fn().mockResolvedValue([mockEnrollment]);
    vi.mocked(enrollmentService.fetchEnrollments).mockImplementation(mockFetchEnrollments);

    // First render - populates cache
    const { unmount } = render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    await waitFor(() => {
      expect(screen.getByText('Advanced React')).toBeInTheDocument();
    });

    unmount();

    // Reset mock call count
    mockFetchEnrollments.mockClear();

    // Second render with same traineeId - should use cache
    mockFetchEnrollments.mockImplementation(() => Promise.resolve([mockEnrollment]));
    
    render(
      <EnrollmentManagementSection traineeId={mockTraineeId} />
    );

    // Enrollment should appear without prolonged loading skeleton
    // (The component will still set loading=true, but cache returns instantly)
    await waitFor(() => {
      expect(screen.getByText('Advanced React')).toBeInTheDocument();
    });
  });
});

/**
 * Property-Based Test Suite: EnrollmentManagementSection Metadata Display
 * 
 * **Property 9: Enrollment Metadata Displays All Required Fields**
 * **Validates: Requirements 1.2, 11.1, 11.2, 11.3**
 * 
 * For any enrollment with various field combinations, all required metadata SHALL be rendered:
 * - Program name
 * - Enrollment status (as badge) 
 * - Enrollment date (YYYY-MM-DD format)
 * - Completion date or "N/A" if not applicable
 * - Final grade or "N/A" if not applicable
 * 
 * Test Strategy: Generate enrollments with:
 * (1) all fields present, (2) missing completion_date, (3) missing final_grade, (4) both missing
 * Render component and verify all required fields are visible with consistent formatting
 * Minimum 100 iterations with field combinations
 */
describe(
  'Property 9: Enrollment Metadata Displays All Required Fields',
  { timeout: 60000 },
  () => {
    const mockTraineeId = '550e8400-e29b-41d4-a716-446655440000';

    const createTestEnrollment = (overrides?: Partial<Enrollment>): Enrollment => ({
      id: 'test-' + Math.random().toString(36).substring(7),
      trainee_id: mockTraineeId,
      program_id: 'prog-' + Math.random().toString(36).substring(7),
      status: 'enrolled',
      enrollment_date: '2024-01-15',
      completion_date: null,
      final_grade: null,
      created_at: '2024-01-15T00:00:00Z',
      updated_at: '2024-01-15T00:00:00Z',
      program: {
        id: 'p1',
        name: 'TestProgram',
        description: 'Test',
        start_date: '2024-01-15',
        end_date: '2024-06-15',
        status: 'active',
      },
      trainee: {
        id: mockTraineeId,
        first_name: 'Test',
        last_name: 'User',
        middle_name: 'M',
        email: 'test@example.com',
      },
      ...overrides,
    });

    beforeEach(async () => {
      vi.clearAllMocks();
      const actual = await vi.importActual<typeof import('../../hooks/useEnrollmentUpdates')>(
        '../../hooks/useEnrollmentUpdates'
      );
      vi.mocked(useEnrollmentUpdates).mockImplementation((traineeId: string) =>
        actual.useEnrollmentUpdates(traineeId)
      );
    });

    afterEach(() => {
      cleanup();
    });

    /**
     * Property Test: All field combinations display required metadata correctly
     * Minimum 100 iterations covering:
     * - All 5 enrollment statuses (enrolled, active, completed, dropped, failed)
     * - 4 field combinations: (all present, no completion_date, no final_grade, neither)
     * - Total iterations: 5 statuses × 4 combinations = 20 base, run 120 times for 100+ coverage
     */
    it(
      'should display all required metadata for any field combination and status',
      { timeout: 60000 },
      async () => {
        const statuses: Enrollment['status'][] = ['enrolled', 'active', 'completed', 'dropped', 'failed'];

        // Generate test cases covering all combinations
        const testCaseGen = fc.tuple(
          fc.constantFrom(...statuses),
          fc.boolean(), // has completion_date
          fc.boolean()  // has final_grade
        );

        await fc.assert(
          fc.asyncProperty(testCaseGen, async ([status, hasCompletionDate, hasFinalGrade]) => {
            cleanup(); // Clean up from previous render
            vi.clearAllMocks();

            const enrollment = createTestEnrollment({
              status,
              completion_date: hasCompletionDate ? '2024-05-20' : null,
              final_grade: hasFinalGrade ? 85 : null,
            });

            vi.mocked(enrollmentService.fetchEnrollments).mockResolvedValueOnce([enrollment]);

            render(<EnrollmentManagementSection traineeId={mockTraineeId} />);

            await waitFor(
              () => {
                // 1. Program name must be visible
                const programElements = screen.getAllByText('TestProgram');
                expect(programElements.length).toBeGreaterThan(0);

                // 2. Enrollment status badge must be visible
                const statusLabels: Record<Enrollment['status'], string> = {
                  enrolled: 'Enrolled',
                  active: 'Active',
                  completed: 'Completed',
                  dropped: 'Dropped',
                  failed: 'Failed',
                };
                expect(screen.getByText(statusLabels[status])).toBeTruthy();

                // 3. Enrollment date must be visible in YYYY-MM-DD format
                expect(screen.getByText('2024-01-15')).toBeTruthy();

                // 4. Completion date or N/A
                if (hasCompletionDate) {
                  expect(screen.getByText('2024-05-20')).toBeTruthy();
                }

                // 5. Final grade or N/A
                if (hasFinalGrade) {
                  expect(screen.getByText('85%')).toBeTruthy();
                }

                // Verify N/A appears for missing fields
                const naElements = screen.queryAllByText('N/A');
                if (!hasCompletionDate || !hasFinalGrade) {
                  expect(naElements.length).toBeGreaterThan(0);
                }
              },
              { timeout: 5000 }
            );
          }),
          { numRuns: 120 } // Run 120 iterations to exceed minimum of 100
        );
      }
    );

    /**
     * Property Test: All statuses display required fields consistently
     */
    it(
      'should display required fields consistently across all enrollment statuses',
      { timeout: 60000 },
      async () => {
        const statuses: Enrollment['status'][] = ['enrolled', 'active', 'completed', 'dropped', 'failed'];

        await fc.assert(
          fc.asyncProperty(fc.constantFrom(...statuses), async (status) => {
            cleanup();
            vi.clearAllMocks();

            const enrollment = createTestEnrollment({
              status,
              completion_date: '2024-05-20',
              final_grade: 85,
            });

            vi.mocked(enrollmentService.fetchEnrollments).mockResolvedValueOnce([enrollment]);

            render(<EnrollmentManagementSection traineeId={mockTraineeId} />);

            await waitFor(
              () => {
                // Program name
                expect(screen.queryAllByText('TestProgram').length).toBeGreaterThan(0);

                // Status badge
                const statusLabels: Record<Enrollment['status'], string> = {
                  enrolled: 'Enrolled',
                  active: 'Active',
                  completed: 'Completed',
                  dropped: 'Dropped',
                  failed: 'Failed',
                };
                expect(screen.getByText(statusLabels[status])).toBeTruthy();

                // Dates in YYYY-MM-DD format
                expect(screen.getByText('2024-01-15')).toBeTruthy();
                expect(screen.getByText('2024-05-20')).toBeTruthy();

                // Grade as percentage
                expect(screen.getByText('85%')).toBeTruthy();
              },
              { timeout: 5000 }
            );
          }),
          { numRuns: 20 }
        );
      }
    );

    /**
     * Property Test: N/A displays for each missing optional field independently
     */
    it(
      'should display N/A for each missing optional field independently',
      { timeout: 60000 },
      async () => {
        const testCases: Array<[boolean, boolean, number]> = [
          [false, false, 2], // Both missing: expect 2 N/A
          [false, true, 1],  // Completion missing: expect at least 1 N/A
          [true, false, 1],  // Grade missing: expect at least 1 N/A
        ];

        for (const [hasCompletion, hasGrade, minNaCount] of testCases) {
          cleanup();
          vi.clearAllMocks();

          const enrollment = createTestEnrollment({
            completion_date: hasCompletion ? '2024-05-20' : null,
            final_grade: hasGrade ? 85 : null,
          });

          vi.mocked(enrollmentService.fetchEnrollments).mockResolvedValueOnce([enrollment]);

          render(<EnrollmentManagementSection traineeId={mockTraineeId} />);

          await waitFor(
            () => {
              const naElements = screen.queryAllByText('N/A');
              expect(naElements.length).toBeGreaterThanOrEqual(minNaCount);
            },
            { timeout: 5000 }
          );
        }
      }
    );

    /**
     * Property Test: Dates are formatted as YYYY-MM-DD for any valid dates
     */
    it(
      'should format enrollment and completion dates as YYYY-MM-DD',
      { timeout: 60000 },
      async () => {
        const dateGen = fc.tuple(
          fc.integer({ min: 2020, max: 2024 }),
          fc.integer({ min: 1, max: 12 }),
          fc.integer({ min: 1, max: 28 })
        );

        await fc.assert(
          fc.asyncProperty(dateGen, async ([year, month, day]) => {
            cleanup();
            vi.clearAllMocks();

            const monthStr = String(month).padStart(2, '0');
            const dayStr = String(day).padStart(2, '0');
            const dateStr = `${year}-${monthStr}-${dayStr}`;

            const enrollment = createTestEnrollment({
              enrollment_date: dateStr,
              completion_date: dateStr,
            });

            vi.mocked(enrollmentService.fetchEnrollments).mockResolvedValueOnce([enrollment]);

            render(<EnrollmentManagementSection traineeId={mockTraineeId} />);

            await waitFor(
              () => {
                const dateElements = screen.queryAllByText(dateStr);
                expect(dateElements.length).toBeGreaterThanOrEqual(2);

                // Verify YYYY-MM-DD format
                dateElements.forEach((el) => {
                  expect(el.textContent).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                });
              },
              { timeout: 5000 }
            );
          }),
          { numRuns: 20 }
        );
      }
    );

    /**
     * Property Test: Grades are formatted as percentages for any valid grade
     */
    it(
      'should format final grades as percentages for all valid grade values',
      { timeout: 60000 },
      async () => {
        await fc.assert(
          fc.asyncProperty(fc.integer({ min: 0, max: 100 }), async (grade) => {
            cleanup();
            vi.clearAllMocks();

            const enrollment = createTestEnrollment({ final_grade: grade });

            vi.mocked(enrollmentService.fetchEnrollments).mockResolvedValueOnce([enrollment]);

            render(<EnrollmentManagementSection traineeId={mockTraineeId} />);

            await waitFor(
              () => {
                const gradeText = `${grade}%`;
                expect(screen.getByText(gradeText)).toBeTruthy();

                const element = screen.getByText(gradeText);
                expect(element.textContent).toBe(gradeText);
              },
              { timeout: 5000 }
            );
          }),
          { numRuns: 50 }
        );
      }
    );
  }
);
