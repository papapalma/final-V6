'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader } from './ui/card';
import { AlertCircle, CheckCircle2, XCircle, Loader2, Calendar } from 'lucide-react';
import { enrollmentService, Enrollment } from '../services/enrollmentService';
import { useEnrollmentUpdates } from '../hooks/useEnrollmentUpdates';
import ConnectionStatusIndicator from './ConnectionStatusIndicator';
import { toast } from 'sonner';

/**
 * Props interface for EnrollmentManagementSection component
 */
export interface EnrollmentManagementSectionProps {
  /** Unique identifier for the trainee */
  traineeId: string;
  /** Optional callback to handle errors */
  onError?: (error: Error) => void;
}

/**
 * EnrollmentManagementSection Component
 *
 * Displays trainee's current and past enrollments with status management capabilities.
 * Features:
 * - Subscribes to real-time enrollment updates via WebSocket using useEnrollmentUpdates hook
 * - Shows connection status indicator for real-time sync visibility
 * - Lists all enrollments for a trainee with automatic updates
 * - Shows enrollment status with visual indicators
 * - Provides action buttons to update enrollment status
 * - Displays confirmation dialog before applying status changes
 * - Shows success/error notifications after API operations
 * - Automatically updates UI when WebSocket events are received
 * - Handles loading, empty, and error states gracefully
 *
 * **Validates: Requirements 4.6, 6.5**
 *
 * @param props - Component props including traineeId and optional error callback
 * @returns React component displaying enrollment management interface with real-time updates
 */
export default function EnrollmentManagementSection({
  traineeId,
  onError,
}: EnrollmentManagementSectionProps) {
  // Use the WebSocket hook for real-time enrollment updates
  const { enrollments, connectionStatus, loading, error, forceRefresh, refetch } =
    useEnrollmentUpdates(traineeId);

  // Local state for confirmation dialog and updates
  const [confirming, setConfirming] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    enrollmentId: string;
    action: 'complete' | 'fail' | 'drop';
    enrollment: Enrollment;
  } | undefined>(undefined);
  const [updating, setUpdating] = useState(false);

  // Call onError callback if error changes
  useEffect(() => {
    if (error && onError) {
      onError(new Error(error));
    }
  }, [error, onError]);

  /**
   * Handle action button click - open confirmation dialog
   */
  const handleActionClick = useCallback(
    (enrollment: Enrollment, action: 'complete' | 'fail' | 'drop') => {
      setPendingAction({
        enrollmentId: enrollment.id,
        action,
        enrollment,
      });
      setConfirming(true);
    },
    []
  );

  /**
   * Handle confirmation dialog cancel
   */
  const handleCancelConfirmation = useCallback(() => {
    setConfirming(false);
    setPendingAction(undefined);
  }, []);

  /**
   * Handle confirmation dialog confirm - submit status update
   */
  const handleConfirmAction = useCallback(async () => {
    if (!pendingAction) return;

    const { enrollmentId, action, enrollment } = pendingAction;

    try {
      setUpdating(true);

      let payload: any = {};

      if (action === 'complete') {
        const today = new Date();
        const todayISO = today.toISOString().split('T')[0];
        payload = {
          status: 'completed',
          completion_date: todayISO,
        };
      } else if (action === 'fail') {
        payload = {
          status: 'failed',
        };
      } else if (action === 'drop') {
        payload = {
          status: 'dropped',
        };
      }

      await enrollmentService.updateStatus(enrollmentId, payload);

      const actionLabel =
        action === 'complete'
          ? 'Marked as Complete'
          : action === 'fail'
            ? 'Marked as Failed'
            : 'Dropped';

      const programName = enrollment.program?.name || 'Enrollment';
      toast.success(`${programName} ${actionLabel}`, {
        description: 'Status updated successfully. Changes will sync in real-time.',
      });

      setConfirming(false);
      setPendingAction(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update enrollment';

      console.error('Error updating enrollment status', { errorMessage, enrollmentId });

      const isConflict =
        errorMessage.toLowerCase().includes('409') ||
        errorMessage.toLowerCase().includes('conflict');
      const isNotFound =
        errorMessage.toLowerCase().includes('404') ||
        errorMessage.toLowerCase().includes('not found');
      const isForbidden =
        errorMessage.toLowerCase().includes('403') ||
        errorMessage.toLowerCase().includes('forbidden') ||
        errorMessage.toLowerCase().includes('permission');
      const isServerError =
        errorMessage.toLowerCase().includes('500') ||
        errorMessage.toLowerCase().includes('502') ||
        errorMessage.toLowerCase().includes('503');
      const isNetworkError =
        errorMessage.toLowerCase().includes('network') ||
        errorMessage.toLowerCase().includes('econnrefused') ||
        errorMessage.toLowerCase().includes('timeout');

      let displayMessage = errorMessage;
      let title = 'Update Failed';

      if (isForbidden) {
        displayMessage = 'You do not have permission to manage enrollments';
        title = 'Permission Denied';
      } else if (isNotFound) {
        displayMessage = 'Enrollment not found. It may have been deleted.';
        title = 'Enrollment Not Found';
      } else if (isConflict) {
        displayMessage = 'This enrollment was updated by another user. Refreshing...';
        title = 'Data Conflict';
        refetch().catch((err) => console.error('Failed to refresh after conflict', err));
      } else if (isServerError) {
        displayMessage = 'Failed to update enrollment. Please try again.';
        title = 'Server Error';
      } else if (isNetworkError) {
        displayMessage = 'Network error. Please check your connection and try again.';
        title = 'Network Error';
      }

      toast.error(title, {
        description: displayMessage,
      });

      setConfirming(false);
      setPendingAction(undefined);
    } finally {
      setUpdating(false);
    }
  }, [pendingAction, refetch]);

  /**
   * Handle retry button click
   */
  const handleRetry = useCallback(async () => {
    try {
      await refetch();
    } catch (err) {
      console.error('Failed to retry fetch', err);
    }
  }, [refetch]);

  /**
   * Get status badge styling based on enrollment status
   */
  const getStatusStyles = (status: Enrollment['status']) => {
    const styles = {
      enrolled: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Enrolled' },
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
      completed: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Completed' },
      dropped: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Dropped' },
      failed: { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' },
    };
    return styles[status];
  };

  /**
   * Determine which action buttons should be available based on status
   */
  const getAvailableActions = (status: Enrollment['status']) => {
    const terminalStatuses = ['completed', 'dropped', 'failed'];
    const isTerminal = terminalStatuses.includes(status);
    return {
      complete: !isTerminal,
      fail: !isTerminal,
      drop: !isTerminal,
    };
  };

  /**
   * Format date to YYYY-MM-DD format
   */
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  /**
   * Format grade as percentage
   */
  const formatGrade = (grade: number | null | undefined): string => {
    if (grade === null || grade === undefined) return 'N/A';
    return `${grade}%`;
  };

  /**
   * Get error message
   */
  const getErrorMessage = (errorText: string): { title: string; description: string } => {
    if (errorText.toLowerCase().includes('404') || errorText.toLowerCase().includes('not found')) {
      return {
        title: 'Trainee Not Found',
        description: 'The trainee record could not be found. Please verify the trainee ID and try again.',
      };
    }

    if (
      errorText.toLowerCase().includes('403') ||
      errorText.toLowerCase().includes('forbidden') ||
      errorText.toLowerCase().includes('permission')
    ) {
      return {
        title: 'Permission Denied',
        description:
          "You do not have permission to view this trainee's enrollments. Please contact an administrator if you believe this is an error.",
      };
    }

    if (errorText.toLowerCase().includes('409') || errorText.toLowerCase().includes('conflict')) {
      return {
        title: 'Data Conflict',
        description: 'This enrollment was recently updated. Please refresh the page to see the latest information.',
      };
    }

    if (
      errorText.toLowerCase().includes('500') ||
      errorText.toLowerCase().includes('502') ||
      errorText.toLowerCase().includes('503')
    ) {
      return {
        title: 'Server Error',
        description: 'A server error occurred while loading enrollments. Please try again in a moment.',
      };
    }

    if (
      errorText.toLowerCase().includes('network') ||
      errorText.toLowerCase().includes('econnrefused') ||
      errorText.toLowerCase().includes('timeout')
    ) {
      return {
        title: 'Network Error',
        description: 'Unable to connect to the server. Please check your internet connection and try again.',
      };
    }

    if (errorText.toLowerCase().includes('validation') || errorText.toLowerCase().includes('zod error')) {
      return {
        title: 'Data Format Error',
        description:
          'The server returned unexpected data. Please refresh and try again, or contact support if the issue persists.',
      };
    }

    return {
      title: 'Failed to Load Enrollments',
      description: errorText || 'An unexpected error occurred. Please try again.',
    };
  };

  // RENDER COMPONENT
  return (
    <>
      {/* Connection Status Indicator */}
      <div className="mb-4 flex justify-between items-center">
        <h3 className="text-sm font-medium text-muted-foreground">Enrollments</h3>
        <ConnectionStatusIndicator connectionStatus={connectionStatus} showLabel={true} size="sm" />
      </div>

      {/* LOADING STATE */}
      {loading && enrollments.length === 0 ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse" role="status">
              <CardHeader className="space-y-2">
                <div className="h-5 bg-muted rounded w-1/3" />
                <div className="h-4 bg-muted rounded w-1/4" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded w-full" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                  <div className="flex gap-2 pt-2">
                    <div className="h-9 bg-muted rounded w-24" />
                    <div className="h-9 bg-muted rounded w-24" />
                    <div className="h-9 bg-muted rounded w-24" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        /* ERROR STATE */
        (() => {
          const { title, description } = getErrorMessage(error);
          return (
            <Card className="border-destructive bg-destructive/5">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <AlertCircle className="h-6 w-6 text-destructive mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-destructive">{title}</p>
                    <p className="text-sm text-muted-foreground mt-2">{description}</p>
                    <div className="flex gap-3 mt-4">
                      <Button variant="outline" size="sm" onClick={handleRetry} className="gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })()
      ) : enrollments.length === 0 ? (
        /* EMPTY STATE */
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Calendar className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-semibold text-lg text-foreground">No Enrollments</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              This trainee does not have any active or past enrollments at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* ENROLLMENTS LIST */
        <div className="space-y-4">
          {enrollments.map((enrollment) => {
            const statusStyles = getStatusStyles(enrollment.status);
            const availableActions = getAvailableActions(enrollment.status);

            return (
              <Card key={enrollment.id} className="overflow-hidden">
                <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                  {/* Header row with program name and status badge */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base sm:text-lg font-semibold text-foreground truncate">
                        {enrollment.program?.name || 'Program Name Unavailable'}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Enrollment ID: <span className="font-mono">{enrollment.id.slice(0, 8)}...</span>
                      </p>
                    </div>
                    <Badge variant={(statusStyles as any).badgeVariant} className="shrink-0 text-xs">
                      {statusStyles.label}
                    </Badge>
                  </div>

                  {/* Metadata grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 py-3 border-y border-border/50 text-xs sm:text-sm">
                    <div>
                      <span className="text-muted-foreground">Enrolled: </span>
                      <span className="font-medium text-foreground">{formatDate(enrollment.enrollment_date)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Completed: </span>
                      <span className="font-medium text-foreground">{formatDate(enrollment.completion_date)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Final Grade: </span>
                      <span className="font-medium text-foreground">{formatGrade(enrollment.final_grade)}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  {(availableActions.complete || availableActions.fail || availableActions.drop) && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 sm:mt-4 pt-1">
                      {availableActions.complete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActionClick(enrollment, 'complete')}
                          className="text-green-700 border-green-200 hover:bg-green-50 w-full sm:w-auto text-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                          Mark as Complete
                        </Button>
                      )}
                      {availableActions.fail && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleActionClick(enrollment, 'fail')}
                          className="text-red-700 border-red-200 hover:bg-red-50 w-full sm:w-auto text-xs"
                        >
                          <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5" />
                          Mark as Failed
                        </Button>
                      )}
                      {availableActions.drop && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleActionClick(enrollment, 'drop')}
                          className="w-full sm:w-auto text-xs"
                        >
                          Drop Program
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirming} onOpenChange={handleCancelConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === 'complete' && 'Mark Enrollment as Complete?'}
              {pendingAction?.action === 'fail' && 'Mark Enrollment as Failed?'}
              {pendingAction?.action === 'drop' && 'Drop Enrollment?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === 'complete' &&
                `Are you sure you want to mark "${pendingAction?.enrollment.program?.name}" as completed for this trainee?`}
              {pendingAction?.action === 'fail' &&
                `Are you sure you want to mark "${pendingAction?.enrollment.program?.name}" as failed for this trainee?`}
              {pendingAction?.action === 'drop' &&
                `Are you sure you want to drop "${pendingAction?.enrollment.program?.name}" for this trainee?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelConfirmation} disabled={updating}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction} disabled={updating}>
              {updating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
