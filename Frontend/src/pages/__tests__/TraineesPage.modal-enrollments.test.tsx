/**
 * Bug Condition Exploration Test for Modal Preview All Enrollments
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 * 
 * This test encodes the EXPECTED BEHAVIOR after the fix is implemented.
 * When run on UNFIXED code, this test MUST FAIL - failure confirms the bug exists.
 * 
 * Bug Condition (C):
 *   The modal preview displays trainee data without fetching actual enrollments from the database.
 *   Instead, it constructs the trainings array from only trainee.program_id (single cached field).
 *   This causes the modal to show incomplete/stale enrollment data compared to actual enrollments
 *   stored in the enrollments table.
 *   
 *   isBugCondition(action) where:
 *   - action is TraineeClickedToOpenModal
 *   - trainee has multiple enrollments in database (enrollments table)
 *   - BUT trainee.program_id only contains reference to first/primary enrollment
 *   - RETURN trainee.program_id is used to build trainings array
 *     AND enrollments table is NOT queried
 *     AND modal displays incomplete enrollment data
 * 
 * Expected Behavior Properties (after fix):
 *   P1: For any trainee with multiple enrollments, modal SHALL display all enrollments fetched from API
 *   P2: For any trainee with deleted enrollment but stale trainee.program_id, modal SHALL show "No Enrollments"
 *   P3: Modal SHALL fetch fresh enrollment data from /api/enrollments?trainee_id=:id when trainee is clicked
 * 
 * CRITICAL: DO NOT attempt to fix the test or the code when it fails.
 * The test failure is the SUCCESS case for exploration - it proves the bug exists.
 * 
 * EXPECTED OUTCOME ON UNFIXED CODE: Test FAILS
 *   Actual: modal shows 1 training from trainee.program_id
 *   Expected: modal shows 2 trainings from enrollments API
 * 
 * Document counterexamples found:
 *   - Trainee with 2 enrollments shows only 1 in modal
 *   - Modal displays stale enrollment after database deletion
 *   - Edit page shows multiple enrollments but modal shows one
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import TraineesPage from '../TraineesPage';
import traineeService from '../../services/traineeService';
import programService from '../../services/programService';
import { enrollmentService } from '../../services/enrollmentService';

// Mock dependencies
vi.mock('../../services/traineeService');
vi.mock('../../services/programService');
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
vi.mock('../../utils/activityLogger');
vi.mock('../../utils/pdfGenerator');
vi.mock('../../components/DashboardLayout', () => ({
  default: ({ children }: any) => <div data-testid="dashboard">{children}</div>
}));
vi.mock('../../components/PaginationWrapper', () => ({
  default: () => null
}));
vi.mock('../../components/DeleteConfirmationDialog', () => ({
  default: () => null
}));

// Mock TraineeDetailsModal to capture what data is passed
let passedTraineeData: any = null;
vi.mock('../../components/TraineeDetailsModal', () => ({
  default: ({ open, trainee, onOpenChange }: any) => {
    if (open && trainee) {
      passedTraineeData = trainee;
    }
    return open ? (
      <div data-testid="modal" onClick={() => onOpenChange(false)}>
        <div data-testid="modal-trainings-count">{trainee?.trainings?.length || 0}</div>
        {trainee?.trainings?.map((t: any, i: number) => (
          <div key={i} data-testid={`training-${i}`}>{t.program}</div>
        ))}
      </div>
    ) : null;
  }
}));

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'User', tenantName: 'Tenant' },
    hasPermission: () => true,
    isAuthenticated: true,
  })
}));

describe('TraineesPage - Bug Condition: Modal Shows Incomplete Enrollments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passedTraineeData = null;
  });

  /**
   * COUNTEREXAMPLE 1: Multiple Enrollments Test
   * 
   * Trainee with 2 enrollments in database but only 1 program_id reference
   * 
   * EXPECTED (after fix): Modal shows 2 trainings from API
   * ACTUAL (unfixed code): Modal shows 1 training from program_id
   * 
   * This directly demonstrates the bug
   */
  it('should show all enrollments from API for trainee with multiple enrollments', async () => {
    const user = userEvent.setup();
    
    const programs = [
      { id: 'p1', name: 'JavaScript 101' },
      { id: 'p2', name: 'React Fundamentals' }
    ];
    
    const trainee = {
      id: '1',
      first_name: 'Alice',
      last_name: 'Johnson',
      email: 'alice@test.com',
      phone: '1234567890',
      status: 'active',
      program_id: 'p1', // Only references first program
      enrollment_date: '2024-01-15',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      thumbnail_path: null,
      photo_path: null,
    };

    const enrollments = [
      {
        id: 'e1',
        trainee_id: '1',
        program_id: 'p1',
        status: 'active',
        enrollment_date: '2024-01-15',
        completion_date: null,
        program: { id: 'p1', name: 'JavaScript 101' }
      },
      {
        id: 'e2',
        trainee_id: '1',
        program_id: 'p2',
        status: 'active',
        enrollment_date: '2024-02-20',
        completion_date: null,
        program: { id: 'p2', name: 'React Fundamentals' }
      }
    ];

    vi.mocked(programService.getPrograms).mockResolvedValue({ data: programs });
    vi.mocked(traineeService.getTrainees).mockResolvedValue({ data: [trainee] });
    vi.mocked(enrollmentService.fetchEnrollments).mockResolvedValue(enrollments);

    render(
      <BrowserRouter>
        <TraineesPage />
      </BrowserRouter>
    );

    // Wait for page to load
    await waitFor(() => {
      const allNames = screen.queryAllByText('Alice Johnson');
      expect(allNames.length).toBeGreaterThan(0);
    }, { timeout: 10000 });

    // Click to open modal - get first occurrence
    const allNames = screen.getAllByText('Alice Johnson');
    await user.click(allNames[0]);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Check trainings count
    const count = parseInt(screen.getByTestId('modal-trainings-count').textContent || '0');
    
    /**
     * COUNTEREXAMPLE 1 (Bug Found):
     * On UNFIXED code: count = 1 (only shows program_id)
     * On FIXED code: count = 2 (shows all enrollments from API)
     */
    expect(count).toBe(2);
    
    // Verify both programs are shown
    expect(screen.getByTestId('training-0')).toHaveTextContent('JavaScript 101');
    expect(screen.getByTestId('training-1')).toHaveTextContent('React Fundamentals');
  });

  /**
   * COUNTEREXAMPLE 2: Stale Data Test
   * 
   * Trainee has stale program_id reference to deleted enrollment
   * API returns empty array (no enrollments)
   * 
   * EXPECTED (after fix): Modal shows 0 trainings
   * ACTUAL (unfixed code): Modal shows 1 training from stale program_id
   * 
   * This demonstrates stale data bug
   */
  it('should show no enrollments when enrollment was deleted but program_id is stale', async () => {
    const user = userEvent.setup();
    
    const programs = [
      { id: 'p1', name: 'JavaScript 101' }
    ];
    
    const trainee = {
      id: '2',
      first_name: 'Bob',
      last_name: 'Smith',
      email: 'bob@test.com',
      phone: '0987654321',
      status: 'active',
      program_id: 'p1', // Stale - enrollment was deleted
      enrollment_date: '2023-12-01',
      created_at: '2023-12-01T00:00:00Z',
      updated_at: '2023-12-01T00:00:00Z',
      thumbnail_path: null,
      photo_path: null,
    };

    // Empty enrollments - the enrollment was deleted
    const enrollments: any[] = [];

    vi.mocked(programService.getPrograms).mockResolvedValue({ data: programs });
    vi.mocked(traineeService.getTrainees).mockResolvedValue({ data: [trainee] });
    vi.mocked(enrollmentService.fetchEnrollments).mockResolvedValue(enrollments);

    render(
      <BrowserRouter>
        <TraineesPage />
      </BrowserRouter>
    );

    // Wait for page to load
    await waitFor(() => {
      const allNames = screen.queryAllByText('Bob Smith');
      expect(allNames.length).toBeGreaterThan(0);
    }, { timeout: 10000 });

    // Click to open modal - get first occurrence
    const allNames = screen.getAllByText('Bob Smith');
    await user.click(allNames[0]);

    // Wait for modal to open
    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Check trainings count
    const count = parseInt(screen.getByTestId('modal-trainings-count').textContent || '0');
    
    /**
     * COUNTEREXAMPLE 2 (Bug Found - Stale Data):
     * On UNFIXED code: count = 1 (shows stale program_id even though no enrollments)
     * On FIXED code: count = 0 (correctly shows empty from API)
     */
    expect(count).toBe(0);
  });

  /**
   * Verification: enrollmentService should be called
   * 
   * This ensures the fix properly calls the API instead of relying on cached data
   */
  it('should call enrollmentService when opening modal', async () => {
    const user = userEvent.setup();
    
    const programs = [{ id: 'p1', name: 'Program 1' }];
    const trainee = {
      id: '3',
      first_name: 'Charlie',
      last_name: 'Brown',
      email: 'charlie@test.com',
      phone: '5555555555',
      status: 'active',
      program_id: 'p1',
      enrollment_date: '2024-01-01',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      thumbnail_path: null,
      photo_path: null,
    };
    const enrollments = [{
      id: 'e1',
      trainee_id: '3',
      program_id: 'p1',
      status: 'active',
      enrollment_date: '2024-01-01',
      completion_date: null,
      program: { id: 'p1', name: 'Program 1' }
    }];

    vi.mocked(programService.getPrograms).mockResolvedValue({ data: programs });
    vi.mocked(traineeService.getTrainees).mockResolvedValue({ data: [trainee] });
    vi.mocked(enrollmentService.fetchEnrollments).mockResolvedValue(enrollments);

    render(
      <BrowserRouter>
        <TraineesPage />
      </BrowserRouter>
    );

    // Wait for page to load
    await waitFor(() => {
      const allNames = screen.queryAllByText('Charlie Brown');
      expect(allNames.length).toBeGreaterThan(0);
    }, { timeout: 10000 });

    // Click to open modal - get first occurrence
    const allNames = screen.getAllByText('Charlie Brown');
    await user.click(allNames[0]);

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument();
    });

    // Verify that on FIXED code, enrollmentService.fetchEnrollments was called
    // On UNFIXED code, this will fail (method never called)
    expect(vi.mocked(enrollmentService.fetchEnrollments)).toHaveBeenCalledWith('3');
  });
});
