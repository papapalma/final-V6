import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { AlertCircle, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import traineeStatusService, { CreateTraineeStatusData, TraineeStatusRecord } from '../services/traineeStatusService';
import { logger } from '../utils/logger';
import { formatDateDisplay, formatRecordedOnDate, formatCreatedByDate, formatLastUpdatedByDate } from '../utils/dateFormat';
import { validateTraineeStatus } from '../types/traineeStatus';
import {
  StatusBadge,
  GraduationStatusBadge,
  EmploymentStatusBadge,
  SkillsMatchBadge,
} from './StatusBadge';

interface TraineeStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string;
  traineeId: string;
  traineeName?: string;
  programName?: string;
  onStatusCreated?: (record: TraineeStatusRecord) => void;
  existingStatus?: TraineeStatusRecord;
  initialEditMode?: boolean;
}

/**
 * Categorize HTTP error response into user-friendly message
 * Handles specific status codes as per TASK 6.4
 */
function getNetworkErrorMessage(error: any): string {
  if (!error) {
    return 'Failed to save. Please check your connection and try again.';
  }

  const status = error.status || error.response?.status;

  if (status === 403) {
    return "You don't have permission to modify this record.";
  }

  if (status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  if (status === 404) {
    return 'Status record not found. It may have been deleted.';
  }

  if (status >= 500) {
    return 'Server error. Please try again later.';
  }

  if (error.message === 'Network Error' || !navigator.onLine) {
    return 'Failed to save. Please check your connection and try again.';
  }

  return error.message || 'Failed to save. Please check your connection and try again.';
}

export default function TraineeStatusModal({
  open,
  onOpenChange,
  enrollmentId,
  traineeId,
  traineeName,
  programName,
  onStatusCreated,
  existingStatus,
  initialEditMode,
}: TraineeStatusModalProps) {
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [editMode, setEditMode] = useState(
    initialEditMode !== undefined ? initialEditMode : !existingStatus
  );
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  
  const [graduationStatus, setGraduationStatus] = useState<'pending' | 'graduated' | 'not_completed' | 'suspended'>(
    existingStatus?.graduation_status || 'graduated'
  );
  const [graduationDate, setGraduationDate] = useState(existingStatus?.graduation_date || '');
  const [employmentStatus, setEmploymentStatus] = useState<'pending' | 'employed' | 'unemployed' | 'self_employed' | 'pursuing_education' | 'deceased'>(
    existingStatus?.employment_status || 'pending'
  );
  const [jobTitle, setJobTitle] = useState(existingStatus?.job_title || '');
  const [employerName, setEmployerName] = useState(existingStatus?.employer_name || '');
  const [jobStartDate, setJobStartDate] = useState(existingStatus?.job_start_date || '');
  const [jobSector, setJobSector] = useState(existingStatus?.job_sector || '');
  const [skillsMatch, setSkillsMatch] = useState<'exact_match' | 'partial_match' | 'no_match' | 'not_applicable' | ''>(
    existingStatus?.skills_match || ''
  );
  const [skillsMatchPercentage, setSkillsMatchPercentage] = useState(existingStatus?.skills_match_percentage || 0);
  const [remarks, setRemarks] = useState(existingStatus?.remarks || '');
  const [unemploymentReason, setUnemploymentReason] = useState(existingStatus?.unemployment_reason || '');
  
  // Field-level error tracking for TASK 6.2
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Network error state for TASK 6.4
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Confirmation dialog state for unsaved changes
  const [showDiscardConfirmation, setShowDiscardConfirmation] = useState(false);

  // Keyboard navigation refs for TASK 10.2
  const formRef = useRef<HTMLFormElement>(null);

  // Track if form data has changed from initial state (TASK 2.9)
  const trackDirtyState = useCallback(() => {
    if (!existingStatus) {
      // For new records, track actual changes from default values
      const hasChanges =
        graduationStatus !== 'graduated' ||
        graduationDate !== '' ||
        employmentStatus !== 'pending' ||
        jobTitle !== '' ||
        employerName !== '' ||
        jobStartDate !== '' ||
        jobSector !== '' ||
        skillsMatch !== '' ||
        skillsMatchPercentage !== 0 ||
        remarks !== '' ||
        unemploymentReason !== '';
      
      setIsDirty(hasChanges);
      return;
    }

    // For existing records, compare current form state with initial state
    const hasChanges =
      graduationStatus !== (existingStatus.graduation_status || 'graduated') ||
      graduationDate !== (existingStatus.graduation_date || '') ||
      employmentStatus !== (existingStatus.employment_status || 'pending') ||
      jobTitle !== (existingStatus.job_title || '') ||
      employerName !== (existingStatus.employer_name || '') ||
      jobStartDate !== (existingStatus.job_start_date || '') ||
      jobSector !== (existingStatus.job_sector || '') ||
      skillsMatch !== (existingStatus.skills_match || '') ||
      skillsMatchPercentage !== (existingStatus.skills_match_percentage || 0) ||
      remarks !== (existingStatus.remarks || '') ||
      unemploymentReason !== (existingStatus.unemployment_reason || '');

    setIsDirty(hasChanges);
  }, [
    existingStatus,
    graduationStatus,
    graduationDate,
    employmentStatus,
    jobTitle,
    employerName,
    jobStartDate,
    jobSector,
    skillsMatch,
    skillsMatchPercentage,
    remarks,
    unemploymentReason,
  ]);

  // Update dirty state whenever form data changes
  useEffect(() => {
    trackDirtyState();
  }, [trackDirtyState]);

  // Handle keyboard events for modal navigation (TASK 10.2)
  // - Esc key closes the modal
  // - Tab navigates through form fields
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Esc key closes modal (TASK 10.2)
      if (e.key === 'Escape') {
        e.preventDefault();
        onOpenChange(false);
      }

      // Enter key submits form if not in a textarea (TASK 10.2)
      if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
        // Let default browser behavior work for form submission
      }
    };

    // Attach event listener to form
    const form = formRef.current;
    if (form) {
      form.addEventListener('keydown', handleKeyDown);
    }

    // Also listen globally for Esc key
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      if (form) {
        form.removeEventListener('keydown', handleKeyDown);
      }
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onOpenChange]);

  // Handle employment status change with field clearing (TASK 6.3)
  const handleEmploymentStatusChange = (newStatus: string) => {
    setEmploymentStatus(newStatus as any);
    
    // TASK 6.3: Clear job fields when transitioning from employed/self_employed
    if (!['employed', 'self_employed'].includes(newStatus)) {
      setJobTitle('');
      setEmployerName('');
      setJobStartDate('');
      setJobSector('');
    }
    
    // TASK 6.3: Clear unemployment reason when transitioning from unemployed
    if (newStatus !== 'unemployed') {
      setUnemploymentReason('');
    }
    
    // Clear any field errors related to employment fields
    setFieldErrors(prev => ({
      ...prev,
      jobTitle: '',
      employerName: '',
      unemploymentReason: '',
    }));
  };

  // Handle cancel with confirmation if unsaved changes (TASK 2.9)
  const handleCancel = () => {
    if (isDirty) {
      // Prompt for confirmation if there are unsaved changes
      setShowDiscardConfirmation(true);
    } else {
      // No changes, just close
      onOpenChange(false);
    }
  };

  // Handle discarding changes after confirmation (TASK 2.9)
  const handleDiscardChanges = () => {
    setShowDiscardConfirmation(false);
    
    // Reset form data to initial state
    if (existingStatus) {
      setGraduationStatus(existingStatus.graduation_status || 'graduated');
      setGraduationDate(existingStatus.graduation_date || '');
      setEmploymentStatus(existingStatus.employment_status || 'pending');
      setJobTitle(existingStatus.job_title || '');
      setEmployerName(existingStatus.employer_name || '');
      setJobStartDate(existingStatus.job_start_date || '');
      setJobSector(existingStatus.job_sector || '');
      setSkillsMatch((existingStatus.skills_match || '') as any);
      setSkillsMatchPercentage(existingStatus.skills_match_percentage || 0);
      setRemarks(existingStatus.remarks || '');
      setUnemploymentReason(existingStatus.unemployment_reason || '');
    }
    
    setIsDirty(false);
    onOpenChange(false);
  };

  // Validate form and track field-level errors (TASK 6.2, 2.9)
  const validateForm = (): boolean => {
    const formData = {
      graduationStatus,
      graduationDate: graduationDate || null,
      employmentStatus,
      jobTitle: jobTitle || null,
      employerName: employerName || null,
      jobStartDate: jobStartDate || null,
      jobSector: jobSector || null,
      unemploymentReason: unemploymentReason || null,
      skillsMatch: skillsMatch || null,
      skillsMatchPercentage: skillsMatchPercentage || null,
      remarks: remarks || null,
    };

    // Use Zod schema validation (TASK 2.9)
    const { success, errors } = validateTraineeStatus(formData);

    if (!success) {
      setFieldErrors(errors);
      return false;
    }

    setFieldErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation with field-level error display (TASK 6.2)
    if (!validateForm()) {
      toast.error('Please fix the validation errors below');
      return;
    }

    // Clear previous network error (TASK 6.4)
    setNetworkError(null);

    try {
      setLoading(true);
      setIsRetrying(false);

      const data: CreateTraineeStatusData = {
        trainee_id: traineeId,
        enrollment_id: enrollmentId,
        graduation_status: graduationStatus,
        graduation_date: graduationDate || null,
        employment_status: employmentStatus,
        job_title: jobTitle || null,
        employer_name: employerName || null,
        job_start_date: jobStartDate || null,
        job_sector: jobSector || null,
        skills_match: skillsMatch || null,
        skills_match_percentage: skillsMatchPercentage || null,
        remarks: remarks || null,
        unemployment_reason: unemploymentReason || null,
      };

      let result;
      if (existingStatus) {
        const targetId = existingStatus.enrollment_id || enrollmentId || existingStatus.id;
        result = await traineeStatusService.updateTraineeStatus(targetId, data);
        toast.success('Trainee status updated successfully');
      } else {
        result = await traineeStatusService.createTraineeStatus(data);
        toast.success('Trainee status recorded successfully');

        // Automatically link to enrollment on creation
        // (API does this automatically, but ensuring here for offline resilience)
      }

      onStatusCreated?.(result);
      onOpenChange(false);
    } catch (error: any) {
      // TASK 6.4: Network error handling with appropriate messages
      const errorMessage = getNetworkErrorMessage(error);
      setNetworkError(errorMessage);
      
      logger.error('Failed to save trainee status', { error, errorMessage });
      
      // Show toast for immediate feedback
      toast.error(errorMessage);
      
      // Log for debugging
      logger.error('[TraineeStatusModal] Network error', {
        status: error.status || error.response?.status,
        message: error.message,
        errorCode: error.code,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const targetId = existingStatus?.enrollment_id || enrollmentId || existingStatus?.id;
      await traineeStatusService.deleteTraineeStatus(targetId);
      toast.success('Trainee status deleted successfully');
      setShowDeleteConfirmation(false);
      onOpenChange(false);
    } catch (error: any) {
      const errorMessage = getNetworkErrorMessage(error);
      toast.error(errorMessage);
      logger.error('Failed to delete trainee status', { error, errorMessage });
    } finally {
      setDeleteLoading(false);
    }
  };

  /**
   * Retry handler for network errors (TASK 6.4)
   * User can click "Retry" button to attempt the save again
   */
  const handleRetry = async () => {
    setIsRetrying(true);
    await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        role="alertdialog"
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between" id="modal-title">
            <span>Trainee Outcome Tracking</span>
            {existingStatus && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEditMode(true)}
                className="ml-auto"
                aria-label="Enter edit mode"
              >
                Edit
              </Button>
            )}
          </DialogTitle>
          <DialogDescription id="modal-description">
            Record the post-graduation outcome and employment status
            {traineeName && ` for ${traineeName}`}
            {programName && ` - ${programName}`}
          </DialogDescription>
        </DialogHeader>

        <form noValidate onSubmit={handleSubmit} className="space-y-6" ref={formRef} role="form" aria-labelledby="modal-title" aria-describedby="modal-description">
          {/* Network Error Display (TASK 6.4) */}
          {networkError && (
            <div 
              className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
              role="alert"
              aria-live="assertive"
              aria-atomic="true"
            >
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div className="flex-1">
                  <h3 className="font-semibold text-red-800 dark:text-red-300 text-sm mb-1">
                    {networkError.includes('permission') ? 'Permission Denied' : 'Unable to Save'}
                  </h3>
                  <p className="text-red-700 dark:text-red-400 text-sm mb-3">{networkError}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRetry}
                    disabled={loading || isRetrying}
                    className="bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-900/50"
                    aria-label="Retry saving the trainee status"
                  >
                    {isRetrying ? 'Retrying...' : 'Retry'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Graduation Status Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Graduation Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <fieldset className="space-y-3" disabled={!editMode}>
                <legend className="text-sm font-medium">Select graduation status</legend>
                <div className="grid grid-cols-2 gap-3">
                  {(['pending', 'graduated', 'not_completed', 'suspended'] as const).map((status) => (
                    <label key={status} className={`flex items-center gap-2 p-3 border rounded-lg ${editMode ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default opacity-60'}`} >
                      <input
                        type="radio"
                        name="graduation_status"
                        value={status}
                        checked={graduationStatus === status}
                        onChange={(e) => setGraduationStatus(e.target.value as any)}
                        disabled={!editMode}
                        className="w-4 h-4"
                        tabIndex={editMode ? 0 : -1}
                        aria-label={`Graduation status: ${status.replace('_', ' ')}`}
                      />
                      <span className="capitalize">{status.replace('_', ' ')}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              {graduationStatus === 'graduated' && (
                <div>
                  <label htmlFor="graduation-date" className="text-sm font-medium">Graduation Date</label>
                  <p className="text-sm text-muted-foreground mt-1">{formatDateDisplay(graduationDate)}</p>
                  <input
                    id="graduation-date"
                    type="date"
                    value={graduationDate}
                    onChange={(e) => setGraduationDate(e.target.value)}
                    disabled={!editMode}
                    className={`w-full px-3 py-2 border rounded-md mt-2 ${!editMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                    aria-label="Graduation date input"
                    aria-describedby="graduation-date-help"
                    tabIndex={editMode ? 0 : -1}
                  />
                  <p id="graduation-date-help" className="text-xs text-muted-foreground mt-1">
                    Select the date when the trainee graduated
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Employment Status Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Post-Graduation Employment Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3" role="group" aria-label="Employment status selection" style={{ opacity: editMode ? 1 : 0.6, pointerEvents: editMode ? 'auto' : 'none' }}>
                {(['pending', 'employed', 'unemployed', 'self_employed', 'pursuing_education', 'deceased'] as const).map((status) => (
                  <label key={status} className={`flex items-center gap-2 p-3 border rounded-lg ${editMode ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'}`}>
                    <input
                      type="radio"
                      name="employment_status"
                      value={status}
                      checked={employmentStatus === status}
                      onChange={(e) => editMode && handleEmploymentStatusChange(e.target.value)}
                      disabled={!editMode}
                      className="w-4 h-4"
                      tabIndex={editMode ? 0 : -1}
                      aria-label={`Employment status: ${status.replace('_', ' ')}`}
                    />
                    <span className="capitalize text-sm">{status.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>

              <div className="mt-2">
                <label htmlFor="employment-status-select" className="text-sm font-medium sr-only">Employment Status Dropdown</label>
                <select
                  id="employment-status-select"
                  name="employment_status"
                  aria-label="Employment status"
                  value={employmentStatus}
                  onChange={(e) => handleEmploymentStatusChange(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm bg-background"
                >
                  <option value="pending" onClick={() => handleEmploymentStatusChange('pending')}>pending</option>
                  <option value="employed" onClick={() => handleEmploymentStatusChange('employed')}>employed</option>
                  <option value="unemployed" onClick={() => handleEmploymentStatusChange('unemployed')}>unemployed</option>
                  <option value="self_employed" onClick={() => handleEmploymentStatusChange('self_employed')}>self employed</option>
                  <option value="pursuing_education" onClick={() => handleEmploymentStatusChange('pursuing_education')}>pursuing education</option>
                  <option value="deceased" onClick={() => handleEmploymentStatusChange('deceased')}>deceased</option>
                </select>
              </div>

              {/* Job Details (if employed or self-employed) */}
              {(employmentStatus === 'employed' || employmentStatus === 'self_employed') && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div>
                    <label className="text-sm font-medium">Job Title *</label>
                    <input
                      type="text"
                      name="job_title"
                      value={jobTitle}
                      onChange={(e) => {
                        setJobTitle(e.target.value);
                        // Clear error when user starts typing (TASK 6.2)
                        if (fieldErrors.jobTitle) {
                          setFieldErrors(prev => ({ ...prev, jobTitle: '' }));
                        }
                      }}
                      disabled={!editMode}
                      placeholder="e.g., Welding Technician"
                      className={`w-full px-3 py-2 border rounded-md mt-1 ${
                        fieldErrors.jobTitle ? 'border-red-500 bg-red-50' : ''
                      } ${!editMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                      required
                      tabIndex={editMode ? 0 : -1}
                      aria-label="Job title"
                      aria-invalid={!!fieldErrors.jobTitle}
                      aria-describedby={fieldErrors.jobTitle ? 'jobTitle-error' : undefined}
                    />
                    {fieldErrors.jobTitle && (
                      <p className="text-red-600 text-sm mt-1 flex items-center gap-1" id="jobTitle-error" role="alert">
                        <AlertCircle className="w-4 h-4" />
                        {fieldErrors.jobTitle}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Employer/Company Name</label>
                    <input
                      type="text"
                      name="employer_name"
                      value={employerName}
                      onChange={(e) => {
                        setEmployerName(e.target.value);
                        // Clear error when user starts typing (TASK 6.2)
                        if (fieldErrors.employerName) {
                          setFieldErrors(prev => ({ ...prev, employerName: '' }));
                        }
                      }}
                      disabled={!editMode}
                      placeholder="e.g., ABC Manufacturing"
                      className={`w-full px-3 py-2 border rounded-md mt-1 ${
                        fieldErrors.employerName ? 'border-red-500 bg-red-50' : ''
                      } ${!editMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                      tabIndex={editMode ? 0 : -1}
                      aria-label="Employer name"
                      aria-invalid={!!fieldErrors.employerName}
                      aria-describedby={fieldErrors.employerName ? 'employerName-error' : undefined}
                    />
                    {fieldErrors.employerName && (
                      <p className="text-red-600 text-sm mt-1 flex items-center gap-1" id="employerName-error" role="alert">
                        <AlertCircle className="w-4 h-4" />
                        {fieldErrors.employerName}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="job-start-date" className="text-sm font-medium">Job Start Date</label>
                      <p className="text-sm text-muted-foreground mt-1">{formatDateDisplay(jobStartDate)}</p>
                      <input
                        id="job-start-date"
                        name="job_start_date"
                        type="date"
                        value={jobStartDate}
                        onChange={(e) => setJobStartDate(e.target.value)}
                        disabled={!editMode}
                        className={`w-full px-3 py-2 border rounded-md mt-2 ${!editMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                        aria-label="Job start date input"
                        aria-describedby="job-start-date-help"
                        tabIndex={editMode ? 0 : -1}
                      />
                      <p id="job-start-date-help" className="text-xs text-muted-foreground mt-1">
                        The date the trainee started this position
                      </p>
                    </div>

                    <div>
                      <label htmlFor="job-sector" className="text-sm font-medium">Industry/Sector</label>
                      <select
                        id="job-sector"
                        name="job_sector"
                        value={jobSector}
                        onChange={(e) => setJobSector(e.target.value)}
                        disabled={!editMode}
                        className={`w-full px-3 py-2 border rounded-md mt-1 ${!editMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                        aria-label="Industry sector selection"
                        aria-describedby="job-sector-help"
                        tabIndex={editMode ? 0 : -1}
                      >
                        <option value="">Select sector</option>
                        <option value="Manufacturing">Manufacturing</option>
                        <option value="Healthcare">Healthcare</option>
                        <option value="IT/Technology">IT/Technology</option>
                        <option value="Technology">Technology</option>
                        <option value="Construction">Construction</option>
                        <option value="Agriculture">Agriculture</option>
                        <option value="Hospitality">Hospitality</option>
                        <option value="Retail">Retail</option>
                        <option value="Transportation">Transportation</option>
                        <option value="Education">Education</option>
                        <option value="Other">Other</option>
                      </select>
                      <p id="job-sector-help" className="text-xs text-muted-foreground mt-1">
                        The industry or sector where the trainee works
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Unemployment Reason (if unemployed) */}
              {employmentStatus === 'unemployed' && (
                <div className="space-y-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <label htmlFor="unemployment-reason" className="text-sm font-medium">Reason for Unemployment *</label>
                      <input
                        id="unemployment-reason"
                        name="unemployment_reason"
                        type="text"
                        value={unemploymentReason}
                        onChange={(e) => {
                          setUnemploymentReason(e.target.value);
                          // Clear error when user starts typing (TASK 6.2)
                          if (fieldErrors.unemploymentReason) {
                            setFieldErrors(prev => ({ ...prev, unemploymentReason: '' }));
                          }
                        }}
                        disabled={!editMode}
                        placeholder="e.g., No available positions, Relocation, Personal reasons"
                        className={`w-full px-3 py-2 border rounded-md mt-1 ${
                          fieldErrors.unemploymentReason ? 'border-red-500 bg-red-50' : ''
                        } ${!editMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                        required
                        tabIndex={editMode ? 0 : -1}
                        aria-label="Reason for unemployment input"
                        aria-invalid={!!fieldErrors.unemploymentReason}
                        aria-describedby={fieldErrors.unemploymentReason ? 'unemploymentReason-error' : 'unemploymentReason-help'}
                      />
                      {fieldErrors.unemploymentReason && (
                        <p className="text-red-600 text-sm mt-1 flex items-center gap-1" id="unemploymentReason-error" role="alert">
                          <AlertCircle className="w-4 h-4" aria-hidden="true" />
                          {fieldErrors.unemploymentReason}
                        </p>
                      )}
                      {!fieldErrors.unemploymentReason && (
                        <p id="unemploymentReason-help" className="text-xs text-muted-foreground mt-1">
                          Explain why the trainee is not employed
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Skills Match Assessment Section */}
          {employmentStatus === 'employed' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Skills-to-Job Match Assessment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4" style={{ opacity: editMode ? 1 : 0.6 }}>
                <div>
                  <label htmlFor="skills-match-question" className="text-sm font-medium mb-3 block">How well does the job match the training?</label>
                  <fieldset id="skills-match-question" className="space-y-2" disabled={!editMode}>
                    <legend className="sr-only">Skills match assessment options</legend>
                    {(['exact_match', 'partial_match', 'no_match', 'not_applicable'] as const).map((match) => (
                      <label key={match} className={`flex items-center gap-2 p-2 ${editMode ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default'} rounded`}>
                        <input
                          type="radio"
                          name="skills_match"
                          value={match}
                          checked={skillsMatch === match}
                          onChange={(e) => editMode && setSkillsMatch(e.target.value as any)}
                          disabled={!editMode}
                          className="w-4 h-4"
                          tabIndex={editMode ? 0 : -1}
                          aria-label={`Skills match: ${match.replace('_', ' ')}`}
                        />
                        <span className="text-sm">
                          {match === 'exact_match' && '✓ Exact Match - Job aligns perfectly with training'}
                          {match === 'partial_match' && '◐ Partial Match - Job uses some acquired skills'}
                          {match === 'no_match' && '✗ No Match - Job unrelated to training'}
                          {match === 'not_applicable' && '- Not Applicable'}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                </div>

                <div>
                  <label htmlFor="skills-percentage" className="text-sm font-medium flex items-center justify-between">
                    Skills Match Percentage
                    <span className="text-xs text-muted-foreground" aria-live="polite">{skillsMatchPercentage}%</span>
                  </label>
                  <input
                    id="skills-percentage"
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={skillsMatchPercentage}
                    onChange={(e) => editMode && setSkillsMatchPercentage(parseInt(e.target.value))}
                    disabled={!editMode}
                    className={`w-full mt-2 ${!editMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                    aria-label="Skills match percentage slider"
                    aria-describedby="skills-percentage-help"
                    aria-valuenow={skillsMatchPercentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    tabIndex={editMode ? 0 : -1}
                  />
                  <div id="skills-percentage-help" className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0% - No match</span>
                    <span>100% - Perfect match</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Remarks Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Remarks & Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <label htmlFor="remarks" className="text-sm font-medium">Additional Comments</label>
              <textarea
                id="remarks"
                name="remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={!editMode}
                placeholder="Add any relevant notes about the trainee's outcome, job satisfaction, challenges, or other observations..."
                className={`w-full px-3 py-2 border rounded-md mt-1 min-h-24 resize-none ${!editMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                aria-label="Additional remarks text area"
                aria-describedby="remarks-help"
                tabIndex={editMode ? 0 : -1}
              />
              <p id="remarks-help" className="text-xs text-muted-foreground mt-1">Max 2000 characters</p>
            </CardContent>
          </Card>

          {/* Audit Trail Section (only for existing records) */}
          {existingStatus && (
            <Card className="bg-muted/30">
              <CardHeader>
                <CardTitle className="text-sm">Audit Trail</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs text-muted-foreground">
                {existingStatus.recordedBy && existingStatus.recordedAt && (
                  <p>{formatCreatedByDate(existingStatus.recordedBy, existingStatus.recordedAt)}</p>
                )}
                {existingStatus.lastUpdatedBy && existingStatus.updatedAt && (
                  <p>{formatLastUpdatedByDate(existingStatus.lastUpdatedBy, existingStatus.updatedAt)}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-between items-center">
            {existingStatus ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirmation(true)}
                disabled={loading || deleteLoading}
                aria-label="Delete trainee status"
              >
                {deleteLoading ? 'Deleting...' : 'Delete'}
              </Button>
            ) : <div />}

            <div className="flex gap-2 justify-end">
              <Button 
                type="button"
                variant="outline" 
                onClick={handleCancel}
                disabled={loading || deleteLoading}
                tabIndex={0}
                aria-label="Cancel editing"
              >
                <X className="w-4 h-4 mr-1" aria-hidden="true" />
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading || !isDirty || deleteLoading}
                tabIndex={0}
                aria-label={loading ? 'Saving changes...' : isDirty ? 'Save changes - Update Status' : 'No changes to save'}
              >
                <Save className="w-4 h-4 mr-1" aria-hidden="true" />
                {loading ? 'Saving...' : existingStatus ? 'Update Status' : 'Record Status'}
              </Button>
            </div>
          </div>

          {/* Delete confirmation dialog */}
          {showDeleteConfirmation && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="alertdialog" aria-modal="true">
              <div className="bg-white dark:bg-slate-950 rounded-lg p-6 max-w-sm shadow-lg">
                <h3 className="font-semibold text-lg mb-2">Confirm Deletion</h3>
                <p className="text-sm text-muted-foreground mb-4">Are you sure you want to delete this trainee status record? This action cannot be undone.</p>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDeleteConfirmation(false)}
                    disabled={deleteLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteLoading}
                    aria-label="Confirm delete"
                  >
                    {deleteLoading ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Discard changes confirmation dialog */}
          {showDiscardConfirmation && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="alertdialog" aria-modal="true">
              <div className="bg-white dark:bg-slate-950 rounded-lg p-6 max-w-sm shadow-lg">
                <h3 className="font-semibold text-lg mb-2">Discard unsaved changes?</h3>
                <p className="text-sm text-muted-foreground mb-4">You have unsaved changes. Are you sure you want to discard them?</p>
                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDiscardConfirmation(false)}
                    tabIndex={0}
                  >
                    Keep Editing
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDiscardChanges}
                    tabIndex={0}
                  >
                    Discard Changes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
