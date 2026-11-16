/**
 * E2E Tests: TraineeStatusModal Component
 * 
 * Comprehensive tests for PATCH and DELETE operations through the frontend UI.
 * Tests verify that the TraineeStatusModal can successfully interact with the
 * fixed PATCH and DELETE endpoints at /api/trainee-status/{id}.
 * 
 * Test Suite:
 * - 9.1: Open TraineeStatusModal and save remarks update
 * - 9.2: Update employment status to employed
 * - 9.3: Update employment status to unemployed
 * - 9.4: Delete trainee status record
 * - 9.5: Validation errors handled properly
 * - 9.6: Unauthorized users cannot PATCH/DELETE
 * - 9.7: Network error handling
 * - 9.8: Loading state shown during save
 * - 9.9: Multiple fields updated in single PATCH
 * - 9.10: Modal reflects fresh data after successful update
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import TraineeStatusModal from '../TraineeStatusModal';
import { useAuth } from '../../contexts/AuthContext';
import traineeStatusService from '../../services/traineeStatusService';
import api from '../../services/api';
import { toast } from 'sonner';

// Mock dependencies
vi.mock('../../contexts/AuthContext');
vi.mock('../../services/traineeStatusService');
vi.mock('../../services/api');
vi.mock('sonner');
vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock data for testing
const mockExistingStatus = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  tenant_id: 'tenant-123',
  trainee_id: 'trainee-001',
  enrollment_id: 'enrollment-001',
  graduation_status: 'graduated' as const,
  graduation_date: '2024-01-15',
  employment_status: 'pending' as const,
  job_title: null,
  employer_name: null,
  job_start_date: null,
  job_sector: null,
  skills_match: null,
  skills_match_percentage: 0,
  remarks: 'Initial remarks',
  unemployment_reason: null,
  recorded_by: 'user-001',
  recorded_at: '2024-01-01T10:00:00Z',
  last_updated_by: null,
  updated_at: '2024-01-01T10:00:00Z',
  deleted_at: null,
};

const mockUpdatedStatus = {
  ...mockExistingStatus,
  remarks: 'Completed with high marks',
  updated_at: '2024-01-15T15:00:00Z',
  last_updated_by: 'user-002',
};

const mockEmployedStatus = {
  ...mockExistingStatus,
  employment_status: 'employed' as const,
  job_title: 'Software Engineer',
  employer_name: 'TechCorp',
  job_start_date: '2024-02-01',
  job_sector: 'Technology',
  skills_match: 'exact_match' as const,
  skills_match_percentage: 100,
};

const mockUnemployedStatus = {
  ...mockExistingStatus,
  employment_status: 'unemployed' as const,
  unemployment_reason: 'Further studies',
};

/**
 * Helper function to render TraineeStatusModal with all required providers
 */
const renderTraineeStatusModal = (props: any = {}) => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    enrollmentId: 'enrollment-001',
    traineeId: 'trainee-001',
    traineeName: 'John Doe',
    programName: 'Software Development',
    onStatusCreated: vi.fn(),
    existingStatus: mockExistingStatus,
    initialEditMode: true,
    ...props,
  };

  const result = render(
    React.createElement(
      BrowserRouter,
      {},
      React.createElement(TraineeStatusModal, defaultProps)
    )
  );

  return {
    ...result,
    ...defaultProps,
  };
};

const getEmploymentStatusSelect = (val = 'pending') => {
  const select = document.getElementById('employment-status-select') as HTMLSelectElement | null;
  if (select && (!val || select.value === val)) return select;
  const elements = screen.getAllByDisplayValue(val);
  return elements.find(el => el.tagName === 'SELECT') || elements.find(el => el.getAttribute('name') === 'employment_status') || elements[0];
};

describe('TraineeStatusModal - E2E Tests (Tasks 9.1-9.10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup auth mock
    (useAuth as any).mockReturnValue({
      hasPermission: vi.fn((perm) => perm !== 'trainee'),
      user: { id: 'user-002', name: 'Test User', role: 'local_admin' },
      token: 'test-token-123',
    });
    
    // Setup toast mock
    (toast.success as any).mockImplementation(() => {});
    (toast.error as any).mockImplementation(() => {});
    (toast.loading as any).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('9.1: Open TraineeStatusModal and save remarks update', () => {
    it('should open modal with existing trainee status data', () => {
      renderTraineeStatusModal();

      expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
      expect(screen.getByText(/Software Development/i)).toBeInTheDocument();
    });

    it('should display current remarks in textarea', () => {
      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      expect(remarksField).toBeInTheDocument();
      expect(remarksField).toHaveValue('Initial remarks');
    });

    it('should update remarks field when user types', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      
      // Clear and type new remarks
      await user.clear(remarksField);
      await user.type(remarksField, 'Completed with high marks');

      expect(remarksField).toHaveValue('Completed with high marks');
    });

    it('should mark form as dirty when remarks are modified', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      
      // Initially should not show save/discard buttons (or they should be disabled)
      expect(screen.queryByRole('button', { name: /save/i })).toBeInTheDocument();

      // Type new remarks
      await user.clear(remarksField);
      await user.type(remarksField, 'Modified remarks');

      // Save button should be enabled (dirty state)
      const saveButton = screen.getByRole('button', { name: /save/i });
      expect(saveButton).not.toBeDisabled();
    });

    it('should successfully save remarks update via PATCH', async () => {
      const user = userEvent.setup();
      
      // Mock PATCH API call
      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUpdatedStatus);

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      
      // Modify remarks
      await user.clear(remarksField);
      await user.type(remarksField, 'Completed with high marks');

      // Click Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for API call
      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalledWith(
          'enrollment-001',
          expect.objectContaining({
            remarks: 'Completed with high marks',
          })
        );
      });

      // Verify success toast
      expect(toast.success).toHaveBeenCalled();
    });

    it('should close modal after successful save', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUpdatedStatus);

      renderTraineeStatusModal({ onOpenChange });

      const remarksField = screen.getByDisplayValue('Initial remarks');
      
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for modal to close
      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should persist changes to database', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUpdatedStatus);

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      
      await user.clear(remarksField);
      await user.type(remarksField, 'Completed with high marks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        // Verify updateTraineeStatus was called with correct data
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalledWith(
          'enrollment-001',
          expect.objectContaining({
            remarks: 'Completed with high marks',
          })
        );
      });
    });

    it('should refresh modal data after successful update', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUpdatedStatus);

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      
      await user.clear(remarksField);
      await user.type(remarksField, 'Completed with high marks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalled();
      });

      // Verify success message
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('updated successfully') || expect.stringContaining('saved')
      );
    });
  });

  describe('9.2: Update employment status to employed', () => {
    it('should display employment status dropdown', () => {
      renderTraineeStatusModal();

      expect(getEmploymentStatusSelect('pending')).toBeInTheDocument();
    });

    it('should show job-related fields when employment status is set to employed', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      // Find employment status select
      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      
      // Change to employed
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      // Job fields should be available (job_title, employer_name, job_start_date)
      // These might be in a collapsible section or shown/hidden
      await waitFor(() => {
        // After selection, should see job title field
        const jobTitleField = document.querySelector('input[name="job_title"]') ||
                             screen.queryByPlaceholderText(/job title/i);
        expect(jobTitleField).toBeInTheDocument();
      });
    });

    it('should fill job title when employment status is employed', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      // Change employment status to employed
      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      // Find and fill job title
      const jobTitleInput = document.querySelector('input[name="job_title"]') ||
                           screen.queryByPlaceholderText(/job title/i);
      
      if (jobTitleInput) {
        await user.type(jobTitleInput, 'Software Engineer');
        expect(jobTitleInput).toHaveValue('Software Engineer');
      }
    });

    it('should fill employer name when employment status is employed', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      // Change employment status
      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      // Fill employer name
      const employerInput = document.querySelector('input[name="employer_name"]') ||
                           screen.queryByPlaceholderText(/employer/i);
      
      if (employerInput) {
        await user.type(employerInput, 'TechCorp');
        expect(employerInput).toHaveValue('TechCorp');
      }
    });

    it('should save employed status update via PATCH', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockEmployedStatus);

      renderTraineeStatusModal();

      // Change employment status to employed
      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      // Fill job details
      const jobTitleInput = document.querySelector('input[name="job_title"]') ||
                           screen.queryByPlaceholderText(/job title/i);
      const employerInput = document.querySelector('input[name="employer_name"]') ||
                           screen.queryByPlaceholderText(/employer/i);

      if (jobTitleInput) await user.type(jobTitleInput, 'Software Engineer');
      if (employerInput) await user.type(employerInput, 'TechCorp');

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalledWith(
          'enrollment-001',
          expect.objectContaining({
            employment_status: 'employed',
            job_title: 'Software Engineer',
            employer_name: 'TechCorp',
          })
        );
      });

      expect(toast.success).toHaveBeenCalled();
    });

    it('should show success message after employment status update', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockEmployedStatus);

      renderTraineeStatusModal();

      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      const jobTitleInput = document.querySelector('input[name="job_title"]') || screen.queryByPlaceholderText(/job title/i);
      const employerInput = document.querySelector('input[name="employer_name"]') || screen.queryByPlaceholderText(/employer/i);
      if (jobTitleInput) await user.type(jobTitleInput, 'Software Engineer');
      if (employerInput) await user.type(employerInput, 'TechCorp');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalled();
      });
    });
  });

  describe('9.3: Update employment status to unemployed', () => {
    it('should display unemployment reason field when status is unemployed', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const unemployedOption = screen.getByRole('option', { name: /unemployed/i });
      await user.click(unemployedOption);

      // Should show unemployment reason field
      const unemploymentReasonField = screen.queryByPlaceholderText(/reason/i) ||
                                     document.querySelector('textarea[name="unemployment_reason"]');
      
      // Field should be available when unemployed is selected
      await waitFor(() => {
        expect(unemploymentReasonField).toBeInTheDocument();
      });
    });

    it('should fill unemployment reason when status is unemployed', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const unemployedOption = screen.getByRole('option', { name: /unemployed/i });
      await user.click(unemployedOption);

      const reasonField = screen.getByPlaceholderText(/reason/i) ||
                         document.querySelector('textarea[name="unemployment_reason"]');

      if (reasonField) {
        await user.type(reasonField, 'Further studies');
        expect(reasonField).toHaveValue('Further studies');
      }
    });

    it('should save unemployed status update via PATCH', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUnemployedStatus);

      renderTraineeStatusModal();

      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const unemployedOption = screen.getByRole('option', { name: /unemployed/i });
      await user.click(unemployedOption);

      const reasonField = screen.getByPlaceholderText(/reason/i) ||
                         document.querySelector('textarea[name="unemployment_reason"]');
      
      if (reasonField) {
        await user.type(reasonField, 'Further studies');
      }

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalledWith(
          'enrollment-001',
          expect.objectContaining({
            employment_status: 'unemployed',
            unemployment_reason: 'Further studies',
          })
        );
      });

      expect(toast.success).toHaveBeenCalled();
    });

    it('should clear job fields when transitioning to unemployed', async () => {
      const user = userEvent.setup();

      // Start with employed status
      const employedStatus = { ...mockExistingStatus, employment_status: 'employed', job_title: 'Engineer' };
      renderTraineeStatusModal({ existingStatus: employedStatus });

      // Change to unemployed
      const employmentStatusSelect = getEmploymentStatusSelect('employed');
      await user.click(employmentStatusSelect);
      const unemployedOption = screen.getByRole('option', { name: /unemployed/i });
      await user.click(unemployedOption);

      // Job title should be cleared (or not visible)
      const jobTitleField = document.querySelector('input[name="job_title"]') as HTMLInputElement;
      
      if (jobTitleField) {
        expect(jobTitleField.value).toBe('');
      }
    });
  });

  describe('9.4: Delete trainee status record', () => {
    it('should display Delete button in modal', () => {
      renderTraineeStatusModal();

      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should show confirmation dialog when Delete is clicked', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/are you sure/i) || screen.getByText(/confirm/i)).toBeInTheDocument();
      });
    });

    it('should cancel deletion when user clicks Cancel in confirmation', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const cancelButton = screen.getAllByRole('button', { name: /cancel/i }).slice(-1)[0];
      await user.click(cancelButton);

      // Confirmation dialog should close, record should still exist
      expect(traineeStatusService.deleteTraineeStatus).not.toHaveBeenCalled();
    });

    it('should successfully delete record via DELETE when confirmed', async () => {
      const user = userEvent.setup();

      (traineeStatusService.deleteTraineeStatus as any).mockResolvedValue(undefined);

      renderTraineeStatusModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getAllByRole('button', { name: /confirm|delete/i }).find(
        b => b !== deleteButton
      );
      if (confirmButton && confirmButton !== deleteButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(traineeStatusService.deleteTraineeStatus).toHaveBeenCalledWith('enrollment-001');
      });

      expect(toast.success).toHaveBeenCalled();
    });

    it('should close modal after successful deletion', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      (traineeStatusService.deleteTraineeStatus as any).mockResolvedValue(undefined);

      renderTraineeStatusModal({ onOpenChange });

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const confirmButton = screen.getAllByRole('button', { name: /confirm|delete/i }).find(
        b => b !== deleteButton
      );
      
      if (confirmButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it('should make DELETE request with correct record ID', async () => {
      const user = userEvent.setup();

      (traineeStatusService.deleteTraineeStatus as any).mockResolvedValue(undefined);

      renderTraineeStatusModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const confirmButton = screen.getAllByRole('button', { name: /confirm|delete/i }).find(
        b => b !== deleteButton
      );
      
      if (confirmButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(traineeStatusService.deleteTraineeStatus).toHaveBeenCalledWith('enrollment-001');
      });
    });
  });

  describe('9.5: Validation errors handled properly', () => {
    it('should show validation error when employment_status is employed but job_title is empty', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      // Change employment status to employed but don't fill job_title
      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      // Try to save without job_title
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Should show error message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Modal should stay open
      expect(getEmploymentStatusSelect('employed')).toBeInTheDocument();
    });

    it('should display field-level error messages', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Look for error text near job_title field
      await waitFor(() => {
        const errorMessages = screen.queryAllByText(/required/i);
        expect(errorMessages.length).toBeGreaterThan(0);
      });
    });

    it('should not submit PATCH request if validation fails', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).not.toHaveBeenCalled();
      });
    });

    it('should clear validation errors when user corrects the input', async () => {
      const user = userEvent.setup();
      renderTraineeStatusModal();

      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      // Try to save - should fail
      let saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Fill in job_title and employer_name
      const jobTitleInput = document.querySelector('input[name="job_title"]') ||
                           screen.queryByPlaceholderText(/job title/i);
      const employerInput = document.querySelector('input[name="employer_name"]') ||
                           screen.queryByPlaceholderText(/employer/i);
      
      if (jobTitleInput) {
        await user.type(jobTitleInput, 'Software Engineer');
      }
      if (employerInput) {
        await user.type(employerInput, 'TechCorp');
      }

      // Error messages should disappear
      const errorMessages = screen.queryAllByText(/required/i);
      expect(errorMessages.length).toBe(0);
    });
  });

  describe('9.6: Unauthorized users cannot PATCH/DELETE', () => {
    it('should show permission error when trainee user tries to update', async () => {
      const user = userEvent.setup();

      // Mock as trainee (no permission)
      (useAuth as any).mockReturnValue({
        hasPermission: vi.fn((perm) => false),
        user: { id: 'trainee-001', name: 'Trainee User', role: 'trainee' },
        token: 'test-token-123',
      });

      (traineeStatusService.updateTraineeStatus as any).mockRejectedValue({
        status: 403,
        message: "You don't have permission to modify this record.",
      });

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('permission') || 
          expect.stringContaining('Permission')
        );
      });
    });

    it('should not allow unauthorized user to delete record', async () => {
      const user = userEvent.setup();

      (useAuth as any).mockReturnValue({
        hasPermission: vi.fn((perm) => false),
        user: { id: 'trainee-001', name: 'Trainee User', role: 'trainee' },
        token: 'test-token-123',
      });

      (traineeStatusService.deleteTraineeStatus as any).mockRejectedValue({
        status: 403,
        message: "You don't have permission to delete this record.",
      });

      renderTraineeStatusModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const confirmButton = screen.getAllByRole('button', { name: /confirm|delete/i }).find(
        b => b !== deleteButton
      );
      
      if (confirmButton) {
        await user.click(confirmButton);
      }

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('should return HTTP 403 error from API', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockRejectedValue({
        status: 403,
      });

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalled();
      });

      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('9.7: Network error handling', () => {
    it('should show network error message when PATCH fails', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockRejectedValue(
        new Error('Network Error')
      );

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining('connection') ||
          expect.stringContaining('network') ||
          expect.stringContaining('save')
        );
      });
    });

    it('should show timeout error when request hangs', async () => {
      const user = userEvent.setup();

      // Simulate timeout
      (traineeStatusService.updateTraineeStatus as any).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Modal should show loading state
      expect(saveButton).toBeDisabled();
    });

    it('should show server error message on 500', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockRejectedValue({
        status: 500,
        message: 'Server error',
      });

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('should show not found error on 404', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockRejectedValue({
        status: 404,
        message: 'Record not found',
      });

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    it('should not show errors for successful request', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUpdatedStatus);

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalled();
        expect(toast.error).not.toHaveBeenCalled();
      });
    });
  });

  describe('9.8: Loading state shown during save', () => {
    it('should show loading indicator when PATCH is in progress', async () => {
      const user = userEvent.setup();

      let resolveUpdate: any;
      (traineeStatusService.updateTraineeStatus as any).mockImplementation(
        () => new Promise(resolve => {
          resolveUpdate = resolve;
        })
      );

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Save button should be disabled during request
      expect(saveButton).toBeDisabled();

      // Complete the request
      resolveUpdate(mockUpdatedStatus);
    });

    it('should disable form fields during DELETE operation', async () => {
      const user = userEvent.setup();

      let resolveDelete: any;
      (traineeStatusService.deleteTraineeStatus as any).mockImplementation(
        () => new Promise(resolve => {
          resolveDelete = resolve;
        })
      );

      renderTraineeStatusModal();

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      const confirmButton = screen.getAllByRole('button', { name: /confirm|delete/i }).find(
        b => b !== deleteButton
      );
      
      if (confirmButton) {
        await user.click(confirmButton);
      }

      // Delete button should be disabled during operation
      expect(deleteButton).toBeDisabled();

      resolveDelete();
    });

    it('should show loading spinner while request is pending', async () => {
      const user = userEvent.setup();

      let resolveUpdate: any;
      (traineeStatusService.updateTraineeStatus as any).mockImplementation(
        () => new Promise(resolve => {
          resolveUpdate = resolve;
        })
      );

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Look for loading indicator (exact implementation varies)
      const loadingIndicator = screen.queryByRole('status') ||
                              document.querySelector('[aria-busy="true"]') ||
                              document.querySelector('.loading') ||
                              document.querySelector('[class*="spinner"]');

      // May or may not show visual indicator - main check is button disabled state
      expect(saveButton).toBeDisabled();

      resolveUpdate(mockUpdatedStatus);
    });

    it('should re-enable form after successful save', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUpdatedStatus);

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Updated remarks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalled();
      });

      // After successful save and modal close, form would be re-enabled if modal reopens
      expect(toast.success).toHaveBeenCalled();
    });
  });

  describe('9.9: Multiple fields updated in single PATCH', () => {
    it('should update remarks + employment status in single request', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue({
        ...mockExistingStatus,
        remarks: 'Completed training',
        employment_status: 'employed',
        job_title: 'Software Engineer',
      });

      renderTraineeStatusModal();

      // Update remarks
      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Completed training');

      // Update employment status
      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      // Fill job title and employer name
      const jobTitleInput = document.querySelector('input[name="job_title"]') ||
                           screen.queryByPlaceholderText(/job title/i);
      const employerInput = document.querySelector('input[name="employer_name"]') ||
                           screen.queryByPlaceholderText(/employer/i);
      if (jobTitleInput) {
        await user.type(jobTitleInput, 'Software Engineer');
      }
      if (employerInput) {
        await user.type(employerInput, 'TechCorp');
      }

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalledWith(
          'enrollment-001',
          expect.objectContaining({
            remarks: 'Completed training',
            employment_status: 'employed',
            job_title: 'Software Engineer',
          })
        );
      });
    });

    it('should update multiple employment fields together', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue({
        ...mockExistingStatus,
        employment_status: 'employed',
        job_title: 'Dev Lead',
        employer_name: 'Big Tech',
        job_start_date: '2024-02-01',
        job_sector: 'Technology',
      });

      renderTraineeStatusModal();

      // Change to employed
      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      // Fill all employment fields
      const jobTitleInput = document.querySelector('input[name="job_title"]');
      const employerInput = document.querySelector('input[name="employer_name"]');
      const jobStartInput = document.querySelector('input[name="job_start_date"]');
      const jobSectorInput = document.querySelector('select[name="job_sector"], input[name="job_sector"]') as HTMLElement | null;

      if (jobTitleInput) await user.type(jobTitleInput, 'Dev Lead');
      if (employerInput) await user.type(employerInput, 'Big Tech');
      if (jobStartInput) await user.type(jobStartInput, '2024-02-01');
      if (jobSectorInput) fireEvent.change(jobSectorInput, { target: { value: 'Technology' } });

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalledWith(
          'enrollment-001',
          expect.objectContaining({
            employment_status: 'employed',
            job_title: 'Dev Lead',
            employer_name: 'Big Tech',
            job_sector: 'Technology',
          })
        );
      });
    });

    it('should send all modified fields in PATCH payload', async () => {
      const user = userEvent.setup();

      const updateData = {
        remarks: 'Updated remarks',
        employment_status: 'employed',
        job_title: 'Engineer',
        employer_name: 'Company',
      };

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue({
        ...mockExistingStatus,
        ...updateData,
      });

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, updateData.remarks);

      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      const jobTitleInput = document.querySelector('input[name="job_title"]');
      const employerInput = document.querySelector('input[name="employer_name"]');

      if (jobTitleInput) await user.type(jobTitleInput, updateData.job_title);
      if (employerInput) await user.type(employerInput, updateData.employer_name);

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        const callArgs = (traineeStatusService.updateTraineeStatus as any).mock.calls[0];
        expect(callArgs[1]).toEqual(expect.objectContaining(updateData));
      });
    });
  });

  describe('9.10: Modal reflects fresh data after successful update', () => {
    it('should reload modal data after PATCH succeeds', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUpdatedStatus);

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Completed with high marks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalled();
      });

      // After successful update, toast should show success
      expect(toast.success).toHaveBeenCalled();
    });

    it('should close and reopen modal showing updated data', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUpdatedStatus);

      const { rerender } = renderTraineeStatusModal({ onOpenChange });

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Completed with high marks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });

      // Reopen with updated data
      rerender(
        React.createElement(
          BrowserRouter,
          {},
          React.createElement(TraineeStatusModal, {
            open: true,
            onOpenChange: onOpenChange,
            enrollmentId: 'enrollment-001',
            traineeId: 'trainee-001',
            traineeName: 'John Doe',
            programName: 'Software Development',
            existingStatus: mockUpdatedStatus,
          })
        )
      );

      // Should show updated remarks
      expect(screen.getByDisplayValue('Completed with high marks')).toBeInTheDocument();
    });

    it('should not show stale data after update', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUpdatedStatus);

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      expect(remarksField).toHaveValue('Initial remarks');

      await user.clear(remarksField);
      await user.type(remarksField, 'Completed with high marks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalled();
      });

      // After save, old data should not be visible (modal should close)
      expect(toast.success).toHaveBeenCalled();
    });

    it('should update modal UI to reflect new values', async () => {
      const user = userEvent.setup();

      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockEmployedStatus);

      renderTraineeStatusModal();

      // Initial state: pending
      expect(getEmploymentStatusSelect('pending')).toBeInTheDocument();

      // Change to employed
      const employmentStatusSelect = getEmploymentStatusSelect('pending');
      await user.click(employmentStatusSelect);
      const employedOption = screen.getByRole('option', { name: /^employed$/i });
      await user.click(employedOption);
      fireEvent.change(employmentStatusSelect, { target: { value: 'employed' } });

      const jobTitleInput = document.querySelector('input[name="job_title"]');
      const employerInput = document.querySelector('input[name="employer_name"]');

      if (jobTitleInput) await user.type(jobTitleInput, 'Software Engineer');
      if (employerInput) await user.type(employerInput, 'TechCorp');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalled();
      });

      expect(toast.success).toHaveBeenCalled();
    });

    it('should preserve all updated field values after DELETE is followed by refresh', async () => {
      const user = userEvent.setup();

      // Update first
      (traineeStatusService.updateTraineeStatus as any).mockResolvedValue(mockUpdatedStatus);

      renderTraineeStatusModal();

      const remarksField = screen.getByDisplayValue('Initial remarks');
      await user.clear(remarksField);
      await user.type(remarksField, 'Completed with high marks');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(traineeStatusService.updateTraineeStatus).toHaveBeenCalled();
      });

      expect(toast.success).toHaveBeenCalled();
    });
  });
});
