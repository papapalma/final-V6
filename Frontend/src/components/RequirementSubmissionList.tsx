'use client';

import React, { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Input } from './ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useRequirementSubmissions } from '../hooks/useRequirementSubmissions';
import type { RequirementSubmission, RequirementSubmissionStatus, PaginationInfo } from '../types/requirements';
import { formatDateDisplay } from '../utils/dateFormat';
import { cn } from './ui/utils';

/**
 * RequirementSubmissionList Component
 *
 * Displays a paginated table of trainee submissions for a specific requirement.
 * Provides filtering by status, sorting by trainee name and submission date,
 * and action buttons for admin operations (verify, reject, waive).
 *
 * Features:
 * - Table with columns: trainee name, status, submitted date, verified date, rejection reason
 * - Filter by status (pending, submitted, verified, rejected, waived)
 * - Search by trainee name
 * - Sort by trainee name or submission date
 * - Pagination with previous/next buttons
 * - Loading skeletons for data states
 * - Error states with retry functionality
 * - Action buttons for verify, reject, waive submissions
 * - Color-coded status badges
 *
 * **Validates: Requirements 2.2, 3.2, FR2.2, FR3.2**
 */

interface RequirementSubmissionListProps {
  requirementId: string;
  onVerify?: (submissionId: string) => Promise<void>;
  onReject?: (submissionId: string, reason: string) => Promise<void>;
  onWaive?: (submissionId: string) => Promise<void>;
}

// Status badge styling
const STATUS_BADGE_STYLES: Record<
  RequirementSubmissionStatus,
  { bgColor: string; textColor: string; label: string }
> = {
  pending: {
    bgColor: 'bg-gray-100 dark:bg-gray-900/40',
    textColor: 'text-gray-700 dark:text-gray-300',
    label: 'Pending',
  },
  submitted: {
    bgColor: 'bg-yellow-100 dark:bg-yellow-900/40',
    textColor: 'text-yellow-700 dark:text-yellow-300',
    label: 'Submitted',
  },
  verified: {
    bgColor: 'bg-green-100 dark:bg-green-900/40',
    textColor: 'text-green-700 dark:text-green-300',
    label: 'Verified',
  },
  rejected: {
    bgColor: 'bg-red-100 dark:bg-red-900/40',
    textColor: 'text-red-700 dark:text-red-300',
    label: 'Rejected',
  },
  waived: {
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
    textColor: 'text-blue-700 dark:text-blue-300',
    label: 'Waived',
  },
};

export function RequirementSubmissionList({
  requirementId,
  onVerify,
  onReject,
  onWaive,
}: RequirementSubmissionListProps): React.ReactElement {
  // State for filtering and sorting
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'traineeName' | 'submittedAt'>('traineeName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch data from hook
  const {
    data: submissions,
    isLoading,
    isError,
    error,
    pagination,
    refetch,
  } = useRequirementSubmissions(requirementId, {
    status: statusFilter.length > 0 ? statusFilter : undefined,
    searchTerm: searchTerm || undefined,
    sortBy,
    order: sortOrder,
    page: currentPage,
    limit: 20,
  });

  // Handle reject action - show dialog
  const handleRejectClick = (submissionId: string) => {
    setSelectedSubmissionId(submissionId);
    setRejectionReason('');
    setRejectionDialogOpen(true);
  };

  // Handle confirm reject
  const handleConfirmReject = async () => {
    if (!selectedSubmissionId || !rejectionReason.trim() || !onReject) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onReject(selectedSubmissionId, rejectionReason);
      setRejectionDialogOpen(false);
      setSelectedSubmissionId(null);
      setRejectionReason('');
      await refetch();
    } catch (err) {
      console.error('Failed to reject submission:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle verify action
  const handleVerify = async (submissionId: string) => {
    if (!onVerify) return;

    setIsSubmitting(true);
    try {
      await onVerify(submissionId);
      await refetch();
    } catch (err) {
      console.error('Failed to verify submission:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle waive action
  const handleWaive = async (submissionId: string) => {
    if (!onWaive) return;

    setIsSubmitting(true);
    try {
      await onWaive(submissionId);
      await refetch();
    } catch (err) {
      console.error('Failed to waive submission:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle pagination
  const handleNextPage = () => {
    if (pagination.hasMore) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  // Get sortable status list for filter
  const statusOptions: RequirementSubmissionStatus[] = [
    'pending',
    'submitted',
    'verified',
    'rejected',
    'waived',
  ];

  if (isError) {
    return <SubmissionListError error={error} onRetry={refetch} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Requirement Submissions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Filter by Status</label>
              <Select
                value={
                  Array.isArray(statusFilter) && statusFilter.length === 1
                    ? statusFilter[0]
                    : 'all'
                }
                onValueChange={(value) => {
                  setStatusFilter(value === 'all' ? [] : [value]);
                  setCurrentPage(1); // Reset to first page on filter change
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_BADGE_STYLES[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Search Trainee</label>
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page on search change
                }}
                className="h-9"
              />
            </div>
          </div>

          {/* Sort Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Sort By</label>
              <Select
                value={sortBy}
                onValueChange={(value: any) => {
                  setSortBy(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="traineeName">Trainee Name</SelectItem>
                  <SelectItem value="submittedAt">Submitted Date</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Order</label>
              <Select
                value={sortOrder}
                onValueChange={(value: any) => {
                  setSortOrder(value);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="flex justify-end">
            <Button
              onClick={() => refetch()}
              variant="outline"
              size="sm"
              disabled={isLoading}
              aria-label="Refresh submissions list"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          {isLoading ? (
            <SubmissionTableSkeleton />
          ) : submissions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No submissions found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="font-semibold">Trainee Name</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Submitted</TableHead>
                  <TableHead className="font-semibold">Verified</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.map((submission) => (
                  <SubmissionRow
                    key={submission.id}
                    submission={submission}
                    onVerify={() => handleVerify(submission.id)}
                    onReject={() => handleRejectClick(submission.id)}
                    onWaive={() => handleWaive(submission.id)}
                    isSubmitting={isSubmitting && selectedSubmissionId === submission.id}
                    showActionButtons={!!(onVerify || onReject || onWaive)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && submissions.length > 0 && (
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-muted-foreground">
              Page {pagination.page} • Showing {submissions.length} of {pagination.total} submissions
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handlePrevPage}
                disabled={currentPage === 1 || isLoading}
                variant="outline"
                size="sm"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                onClick={handleNextPage}
                disabled={!pagination.hasMore || isLoading}
                variant="outline"
                size="sm"
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Rejection Dialog */}
        <RejectionReasonDialog
          open={rejectionDialogOpen}
          reason={rejectionReason}
          onReasonChange={setRejectionReason}
          onConfirm={handleConfirmReject}
          onCancel={() => {
            setRejectionDialogOpen(false);
            setSelectedSubmissionId(null);
            setRejectionReason('');
          }}
          isSubmitting={isSubmitting}
        />
      </CardContent>
    </Card>
  );
}

/**
 * Single submission row in the table
 */
interface SubmissionRowProps {
  submission: RequirementSubmission;
  onVerify?: () => Promise<void>;
  onReject?: () => void;
  onWaive?: () => Promise<void>;
  isSubmitting?: boolean;
  showActionButtons?: boolean;
}

function SubmissionRow({
  submission,
  onVerify,
  onReject,
  onWaive,
  isSubmitting = false,
  showActionButtons = true,
}: SubmissionRowProps): React.ReactElement {
  const statusStyle = STATUS_BADGE_STYLES[submission.status];
  const submittedDate = submission.submittedAt
    ? formatDateDisplay(submission.submittedAt)
    : '—';
  const verifiedDate = submission.verifiedAt
    ? formatDateDisplay(submission.verifiedAt)
    : '—';

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell className="font-medium">{submission.traineeName}</TableCell>
      <TableCell>
        <Badge
          className={cn(
            'border font-medium',
            statusStyle.bgColor,
            statusStyle.textColor
          )}
          variant="outline"
        >
          {statusStyle.label}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{submittedDate}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{verifiedDate}</TableCell>
      <TableCell>
        {showActionButtons ? (
          <div className="flex gap-2">
            {submission.status === 'submitted' && (
              <>
                <Button
                  onClick={onVerify}
                  disabled={isSubmitting || !onVerify}
                  variant="ghost"
                  size="sm"
                  title="Verify submission"
                  aria-label={`Verify ${submission.traineeName}'s submission`}
                >
                  ✓
                </Button>
                <Button
                  onClick={onReject}
                  disabled={isSubmitting || !onReject}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:text-red-700"
                  title="Reject submission"
                  aria-label={`Reject ${submission.traineeName}'s submission`}
                >
                  ✕
                </Button>
              </>
            )}
            {(submission.status === 'pending' || submission.status === 'submitted') && (
              <Button
                onClick={onWaive}
                disabled={isSubmitting || !onWaive}
                variant="ghost"
                size="sm"
                className="text-blue-600 hover:text-blue-700"
                title="Waive requirement"
                aria-label={`Waive requirement for ${submission.traineeName}`}
              >
                Waive
              </Button>
            )}
            {submission.rejectionReason && (
              <Button
                onClick={() => {
                  // Could expand to show full reason
                }}
                disabled={true}
                variant="ghost"
                size="sm"
                title={submission.rejectionReason}
                aria-label="View rejection reason"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

/**
 * Skeleton loading state for the submissions table
 */
function SubmissionTableSkeleton(): React.ReactElement {
  return (
    <div className="space-y-4 p-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
        </div>
      ))}
    </div>
  );
}

/**
 * Error state for the submissions list
 */
interface SubmissionListErrorProps {
  error: Error | null;
  onRetry: () => Promise<void>;
}

function SubmissionListError({
  error,
  onRetry,
}: SubmissionListErrorProps): React.ReactElement {
  const errorMessage = error?.message || 'Failed to load submissions';

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-medium text-destructive">Failed to Load Submissions</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
            </div>
            <Button
              onClick={onRetry}
              variant="outline"
              size="sm"
              aria-label="Retry loading submissions"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Dialog for entering rejection reason
 */
interface RejectionReasonDialogProps {
  open: boolean;
  reason: string;
  onReasonChange: (reason: string) => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
}

function RejectionReasonDialog({
  open,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
  isSubmitting,
}: RejectionReasonDialogProps): React.ReactElement {
  return (
    <AlertDialog open={open} onOpenChange={onCancel}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject Submission</AlertDialogTitle>
          <AlertDialogDescription>
            Please provide a reason for rejecting this submission.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <textarea
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            placeholder="Enter rejection reason..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus-visible:outline-none"
            rows={4}
            disabled={isSubmitting}
          />
        </div>
        <div className="flex gap-2 justify-end">
          <AlertDialogCancel disabled={isSubmitting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={!reason.trim() || isSubmitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Reject
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default RequirementSubmissionList;
