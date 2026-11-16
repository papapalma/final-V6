/**
 * useTraineeStatuses Hook
 *
 * Fetches multiple trainee status records with support for filtering, sorting,
 * and pagination using React Query.
 *
 * Features:
 * - Uses React Query with queryKey ['traineeStatuses', filters, sort, pagination]
 * - Fetches from GET /api/trainee-status with query parameters
 * - Supports filtering by: employmentStatus[], skillsMatch[], graduationStatus[]
 * - Supports sorting by: column (name, graduation_date, employment_status, skills_match, recorded_at), direction (asc, desc)
 * - Supports pagination: page, limit
 * - Automatically resets page to 1 when filters or sort change
 * - Caches data with 1-minute stale time (table view use case - more frequent updates)
 * - Provides refetch capability for manual updates
 * - Implements exponential backoff retry strategy (2 retries)
 * - Returns { records, isLoading, error, pagination, refetch }
 *
 * **Validates: Requirements 3.0, 16.0, 17.0**
 *
 * Example usage:
 * ```typescript
 * const { records, isLoading, error, pagination, refetch } = useTraineeStatuses(
 *   {
 *     employmentStatus: ['employed'],
 *     skillsMatch: ['exact_match', 'partial_match']
 *   },
 *   { column: 'recorded_at', direction: 'desc' },
 *   { page: 1, limit: 20 }
 * );
 * 
 * if (isLoading) return <Skeleton />;
 * if (error) return <ErrorMessage error={error} onRetry={refetch} />;
 * return (
 *   <>
 *     <TraineeStatusTable records={records} pagination={pagination} />
 *     <Pagination {...pagination} onPageChange={handlePageChange} />
 *   </>
 * );
 * ```
 */

import { useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { TraineeStatusRecord, TraineeStatusFilters, TraineeStatusSort, PaginationInfo } from '../types/traineeStatus';
import logger from '../utils/logger';
import { queryKeys } from '../services/queryClient';

/**
 * Hook options interface
 */
export interface UseTraineeStatusesOptions {
  /**
   * Whether to enable the query.
   * Defaults to true - set to false for conditional queries.
   */
  enabled?: boolean;
}

/**
 * Hook return type
 */
export interface UseTraineeStatusesResult {
  /** Array of fetched trainee status records */
  records: TraineeStatusRecord[];
  /** Whether data is currently being fetched */
  isLoading: boolean;
  /** Error object if fetch failed, null if successful */
  error: Error | null;
  /** Pagination metadata */
  pagination: PaginationInfo;
  /** Function to manually refetch the status records */
  refetch: () => Promise<void>;
}

/**
 * Cache stale time: 1 minute (60,000 ms) for table view
 * Table view is used for analysis with more frequent user interactions,
 * so 1 minute stale time keeps data relatively fresh while reducing API calls.
 */
const STALE_TIME = 1 * 60 * 1000;

/**
 * Build query string from filters and pagination parameters
 *
 * Converts filter objects into URL query parameters:
 * - employment_status: comma-separated list (e.g., "employed,self_employed")
 * - skills_match: comma-separated list (e.g., "exact_match,partial_match")
 * - graduation_status: comma-separated list (e.g., "graduated,pending")
 * - sort_by: column name
 * - sort_dir: "asc" or "desc"
 * - page: page number
 * - limit: records per page
 *
 * @param filters - TraineeStatusFilters object
 * @param sort - TraineeStatusSort object (column and direction)
 * @param pagination - Pagination object (page and limit)
 * @returns Query string parameters object
 */
function buildQueryParams(
  filters: TraineeStatusFilters,
  sort: TraineeStatusSort,
  pagination: { page: number; limit: number }
): Record<string, string | undefined> {
  const params: Record<string, string | undefined> = {};

  // Add filter parameters if they exist
  if (filters.employmentStatus && filters.employmentStatus.length > 0) {
    params.employment_status = filters.employmentStatus.join(',');
  }

  if (filters.skillsMatch && filters.skillsMatch.length > 0) {
    params.skills_match = filters.skillsMatch.join(',');
  }

  if (filters.graduationStatus && filters.graduationStatus.length > 0) {
    params.graduation_status = filters.graduationStatus.join(',');
  }

  if (filters.searchTerm) {
    params.search = filters.searchTerm;
  }

  // Add sort parameters
  params.sort_by = sort.column;
  params.sort_dir = sort.direction;

  // Add pagination parameters
  params.page = pagination.page.toString();
  params.limit = pagination.limit.toString();

  return params;
}

/**
 * Hook to fetch multiple trainee status records with filtering, sorting, and pagination
 *
 * @param filters - Filter criteria (employmentStatus, skillsMatch, graduationStatus, searchTerm)
 * @param sort - Sort configuration (column, direction)
 * @param pagination - Pagination configuration (page, limit)
 * @param options - Hook options (enabled, etc.)
 * @returns Object with records, isLoading, error, pagination, and refetch function
 *
 * Query Behavior:
 * - Query key: ['traineeStatuses', filters, sort, pagination]
 * - Enabled: enabled parameter (defaults to true)
 * - Stale time: 1 minute (for table view with frequent updates)
 * - Retry: 2 attempts with exponential backoff
 * - Refetch on window focus: enabled (keeps data fresh)
 * - When filters or sort changes, page automatically resets to 1 in the calling component
 */
export function useTraineeStatuses(
  filters: TraineeStatusFilters = {},
  sort: TraineeStatusSort = { column: 'recorded_at', direction: 'desc' },
  pagination: { page: number; limit: number } = { page: 1, limit: 20 },
  options: UseTraineeStatusesOptions = {}
): UseTraineeStatusesResult {
  const { enabled = true } = options;

  /**
   * Query function to fetch the status records from the API
   */
  const queryFn = async () => {
    try {
      logger.info('[useTraineeStatuses] Fetching from API', {
        filters,
        sort,
        pagination,
      });

      // Build query parameters
      const queryParams = buildQueryParams(filters, sort, pagination);

      // Fetch from API
      const response = await api.get<{
        records: TraineeStatusRecord[];
        pagination: PaginationInfo;
      }>('/trainee-status', queryParams);

      // Extract records and pagination info
      const records = response.data?.records || [];
      const paginationData = response.data?.pagination || {
        page: pagination.page,
        limit: pagination.limit,
        total: 0,
        hasMore: false,
      };

      logger.info('[useTraineeStatuses] Fetch successful', {
        recordCount: records.length,
        pagination: paginationData,
      });

      return {
        records,
        pagination: paginationData,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to load trainee statuses';

      logger.error('[useTraineeStatuses] Fetch failed', {
        error: errorMessage,
        filters,
        sort,
        pagination,
      });

      throw err;
    }
  };

  /**
   * Use React Query to manage the query state
   * Query key includes all filtering/sorting/pagination params so each combination gets cached separately
   * Using centralized query key factory for consistency and ease of cache management
   */
  const {
    data,
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery<
    { records: TraineeStatusRecord[]; pagination: PaginationInfo },
    Error
  >({
    queryKey: queryKeys.traineeStatuses.list(filters, sort, pagination),
    queryFn,
    // Only query if enabled
    enabled,
    // Data is fresh for 1 minute
    staleTime: STALE_TIME,
    // Retry twice with exponential backoff (1000ms, 2000ms)
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
    page: pagination.page,
    limit: pagination.limit,
    total: 0,
    hasMore: false,
  };

  return {
    records: data?.records ?? [],
    isLoading,
    error,
    pagination: data?.pagination ?? defaultPagination,
    refetch,
  };
}

/**
 * Hook for resetting pagination when filters or sort changes
 * This utility hook helps manage the common pattern of resetting to page 1
 * when filters or sort criteria change.
 *
 * Example usage:
 * ```typescript
 * const [page, setPage] = useState(1);
 * const [filters, setFilters] = useState({});
 * 
 * useResetPaginationOnFilterChange(filters, sort, () => setPage(1));
 * ```
 */
export function useResetPaginationOnFilterChange(
  filters: TraineeStatusFilters,
  sort: TraineeStatusSort,
  onReset: () => void
) {
  // Create a stable string representation of filters and sort
  const filterSortKey = JSON.stringify({ filters, sort });

  // Use a ref to track previous value
  const prevKeyRef = useRef<string>('');

  useEffect(() => {
    if (prevKeyRef.current && prevKeyRef.current !== filterSortKey) {
      // Filters or sort changed, reset to page 1
      onReset();
    }
    prevKeyRef.current = filterSortKey;
  }, [filterSortKey, onReset]);
}
