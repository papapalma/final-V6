/**
 * useRequirementSubmissions Hook
 *
 * Fetches requirement submissions for a specific requirement with support for filtering,
 * sorting, and pagination using React Query.
 *
 * Features:
 * - Uses React Query with queryKey ['requirementSubmissions', 'requirement', requirementId, filters, sort, pagination]
 * - Fetches from GET /api/requirement-definitions/{id}/submissions with query parameters
 * - Supports filtering by: status (pending, submitted, verified, rejected, waived), searchTerm
 * - Supports sorting by: traineeName, status, submittedAt, verifiedAt
 * - Supports pagination: page, limit
 * - Caches data with 2-minute stale time (allows fresh data while reducing API calls)
 * - Provides refetch capability for manual updates
 * - Implements exponential backoff retry strategy (2 retries)
 * - Returns { data, isLoading, isError, error, pagination }
 *
 * **Validates: Frontend data fetching layer**
 *
 * Example usage:
 * ```typescript
 * const { data, isLoading, error, pagination, refetch } = useRequirementSubmissions(
 *   'requirement-123',
 *   {
 *     status: 'pending',
 *     sortBy: 'traineeName',
 *     order: 'asc',
 *     page: 1,
 *     limit: 20
 *   }
 * );
 * 
 * if (isLoading) return <Skeleton />;
 * if (error) return <ErrorMessage error={error} onRetry={refetch} />;
 * return (
 *   <>
 *     <SubmissionTable submissions={data} pagination={pagination} />
 *     <Pagination {...pagination} onPageChange={handlePageChange} />
 *   </>
 * );
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { RequirementSubmission, RequirementSubmissionFilters, RequirementSubmissionSort, PaginationInfo } from '../types/requirements';
import logger from '../utils/logger';
import { queryKeys } from '../services/queryClient';

/**
 * Hook options interface
 */
export interface UseRequirementSubmissionsOptions {
  /**
   * Filter status - can be single status or array
   */
  status?: string | string[];

  /**
   * Sort by column
   */
  sortBy?: string;

  /**
   * Sort order: 'asc' or 'desc'
   */
  order?: 'asc' | 'desc';

  /**
   * Page number (1-indexed)
   */
  page?: number;

  /**
   * Records per page
   */
  limit?: number;

  /**
   * Search term for trainee name or email
   */
  searchTerm?: string;

  /**
   * Whether to enable the query
   * Defaults to true - set to false for conditional queries
   */
  enabled?: boolean;
}

/**
 * Hook return type
 */
export interface UseRequirementSubmissionsResult {
  /** Array of fetched requirement submissions */
  data: RequirementSubmission[];
  
  /** Whether data is currently being fetched */
  isLoading: boolean;
  
  /** Whether an error occurred */
  isError: boolean;
  
  /** Error object if fetch failed, null if successful */
  error: Error | null;
  
  /** Pagination metadata */
  pagination: PaginationInfo;
  
  /** Function to manually refetch the submissions */
  refetch: () => Promise<void>;
}

/**
 * Cache stale time: 2 minutes (120,000 ms)
 * Submissions change less frequently than other data, so a longer stale time is appropriate
 * while still keeping data relatively fresh
 */
const STALE_TIME = 2 * 60 * 1000;

/**
 * Build query string from options
 *
 * Converts option objects into URL query parameters:
 * - status: comma-separated list if array, single value if string
 * - search: search term for trainee name/email
 * - sort_by: column name
 * - sort_order: "asc" or "desc"
 * - page: page number
 * - limit: records per page
 *
 * @param options - Hook options
 * @returns Query string parameters object
 */
function buildQueryParams(options: UseRequirementSubmissionsOptions): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};

  // Add status filter
  if (options.status) {
    if (Array.isArray(options.status)) {
      // Only add if array is not empty
      if (options.status.length > 0) {
        params.status = options.status.join(',');
      }
    } else {
      params.status = options.status;
    }
  }

  // Add search term
  if (options.searchTerm) {
    params.search = options.searchTerm;
  }

  // Add sort parameters
  if (options.sortBy) {
    params.sort_by = options.sortBy;
  }
  if (options.order) {
    params.sort_order = options.order;
  }

  // Add pagination parameters
  if (options.page !== undefined) {
    params.page = options.page.toString();
  }
  if (options.limit !== undefined) {
    params.limit = options.limit.toString();
  }

  return params;
}

/**
 * Hook to fetch requirement submissions with filtering, sorting, and pagination
 *
 * @param requirementId - The ID of the requirement to fetch submissions for
 * @param options - Hook options (status, sortBy, order, page, limit, searchTerm, enabled)
 * @returns Object with data, isLoading, isError, error, pagination, and refetch function
 *
 * Query Behavior:
 * - Query key: ['requirementSubmissions', 'requirement', requirementId, options]
 * - Enabled: enabled parameter (defaults to true)
 * - Stale time: 2 minutes
 * - Retry: 2 attempts with exponential backoff
 * - Refetch on window focus: enabled (keeps data fresh)
 */
export function useRequirementSubmissions(
  requirementId: string,
  options: UseRequirementSubmissionsOptions = {}
): UseRequirementSubmissionsResult {
  const {
    enabled = true,
    page = 1,
    limit = 20,
    ...otherOptions
  } = options;

  /**
   * Query function to fetch submissions from the API
   */
  const queryFn = async () => {
    try {
      logger.info('[useRequirementSubmissions] Fetching from API', {
        requirementId,
        options,
      });

      // Build query parameters
      const queryParams = buildQueryParams({
        ...otherOptions,
        page,
        limit,
      });

      // Fetch from API (api.get already unwraps axiosResponse.data -> { success, data, pagination })
      const response = await api.get<any>(
        `/requirement-definitions/${requirementId}/submissions`,
        queryParams
      );
      const rawBody = response as any;
      const rawItems: any[] = Array.isArray(rawBody?.data)
        ? rawBody.data
        : Array.isArray(rawBody?.data?.data)
          ? rawBody.data.data
          : [];
      const rawPagination = rawBody?.pagination ?? rawBody?.data?.pagination;

      const submissions: RequirementSubmission[] = rawItems.map((item: any) => {
        // Preserve already-normalized camelCase objects
        if (item && typeof item.enrollmentId === 'string' && typeof item.status === 'string') {
          return item as RequirementSubmission;
        }
        return {
          id: item.id ?? item.enrollment_id ?? '',
          enrollmentId: item.enrollment_id ?? item.enrollmentId ?? '',
          requirementId: item.requirement_id ?? item.requirementId ?? requirementId,
          status: item.submission_status ?? item.status ?? 'pending',
          traineeId: item.trainee_id ?? item.traineeId ?? '',
          traineeName: item.trainee_name ?? item.traineeName ?? '',
          ...(item.trainee_email ? { traineeEmail: item.trainee_email } : {}),
          ...(item.document_url ? { documentUrl: item.document_url } : {}),
          ...(item.submitted_at ? { submittedAt: item.submitted_at } : {}),
          ...(item.verified_at ? { verifiedAt: item.verified_at } : {}),
          ...(item.verified_by ? { verifiedBy: item.verified_by } : {}),
          ...(item.rejection_reason ? { rejectionReason: item.rejection_reason } : {}),
          createdAt: item.created_at ?? item.createdAt ?? '',
          updatedAt: item.updated_at ?? item.updatedAt ?? item.created_at ?? '',
        };
      });

      const resolvedPage = rawPagination?.page ?? page;
      const resolvedLimit = rawPagination?.limit ?? limit;
      const resolvedTotal = rawPagination?.total ?? 0;
      const resolvedTotalPages =
        rawPagination?.totalPages ??
        (resolvedLimit > 0 ? Math.ceil(resolvedTotal / resolvedLimit) : 0);

      const paginationData: PaginationInfo = rawPagination
        ? {
            page: resolvedPage,
            limit: resolvedLimit,
            total: resolvedTotal,
            hasMore:
              typeof rawPagination.hasMore === 'boolean'
                ? rawPagination.hasMore
                : resolvedPage < resolvedTotalPages,
          }
        : {
            page,
            limit,
            total: 0,
            hasMore: false,
          };

      logger.info('[useRequirementSubmissions] Fetch successful', {
        requirementId,
        submissionCount: submissions.length,
        pagination: paginationData,
      });

      return {
        data: submissions,
        pagination: paginationData,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to load requirement submissions';

      logger.error('[useRequirementSubmissions] Fetch failed', {
        error: errorMessage,
        requirementId,
        options,
      });

      throw err;
    }
  };

  /**
   * Use React Query to manage the query state
   * Query key includes requirementId and all filtering/sorting/pagination params
   */
  const {
    data,
    isLoading,
    isError,
    error,
    refetch: queryRefetch,
  } = useQuery<
    { data: RequirementSubmission[]; pagination: PaginationInfo },
    Error
  >({
    queryKey: queryKeys.requirementSubmissions.byRequirement(
      requirementId,
      { status: otherOptions.status, searchTerm: otherOptions.searchTerm },
      { sortBy: otherOptions.sortBy, order: otherOptions.order },
      { page, limit }
    ),
    queryFn,
    // Only query if enabled and requirementId is provided
    enabled: enabled && !!requirementId,
    // Data is fresh for 2 minutes
    staleTime: STALE_TIME,
    // Retry twice with exponential backoff
    retry: 2,
    // Refetch on window focus to keep data fresh
    refetchOnWindowFocus: true,
  });

  /**
   * Wrapper around React Query's refetch to provide consistent interface
   */
  const refetch = async () => {
    await queryRefetch();
  };

  // Default pagination values
  const defaultPagination: PaginationInfo = {
    page,
    limit,
    total: 0,
    hasMore: false,
  };

  return {
    data: data?.data ?? [],
    isLoading,
    isError,
    error,
    pagination: data?.pagination ?? defaultPagination,
    refetch,
  };
}
