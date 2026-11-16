/**
 * useRequirementDefinitions Hook
 *
 * Custom React Query hook for fetching all requirement definitions with filtering,
 * sorting, and pagination support. Automatically handles tenant isolation.
 *
 * Features:
 * - Fetches from GET /api/requirement-definitions
 * - Supports query parameters: sort_by, is_active, page, limit
 * - Returns data, isLoading, isError, error states and pagination info
 * - Implements caching with 5-minute stale time
 * - Automatic tenant isolation (no manual tenant ID needed)
 * - Provides manual refetch capability
 * - Implements exponential backoff retry strategy
 *
 * **Validates: Requirements FR2.1 (Admin Requirements Management Interface)**
 *
 * Example usage:
 * ```typescript
 * const { data, isLoading, error, pagination, refetch } = useRequirementDefinitions({
 *   sortBy: 'name',
 *   isActive: true,
 *   page: 1,
 *   limit: 20,
 * });
 *
 * if (isLoading) return <Skeleton />;
 * if (isError) return <ErrorMessage error={error} onRetry={refetch} />;
 *
 * return (
 *   <>
 *     {data.map(req => (
 *       <RequirementCard key={req.id} requirement={req} />
 *     ))}
 *     <Pagination {...pagination} />
 *   </>
 * );
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { queryKeys } from '../services/queryClient';
import logger from '../utils/logger';
import type {
  RequirementDefinition,
  RequirementDefinitionsResponse,
  UseRequirementDefinitionsOptions,
  UseRequirementDefinitionsResult,
  PaginationInfo,
} from '../types/requirementDefinition';

/**
 * Cache stale time: 5 minutes (300,000 ms)
 * Requirement definitions are relatively static, so a longer stale time is appropriate.
 * This means data is considered fresh for 5 minutes before being eligible for refetch.
 */
const STALE_TIME = 5 * 60 * 1000;

/**
 * Build query string from options
 * Only includes non-undefined parameters in the query string
 */
function buildQueryString(options: UseRequirementDefinitionsOptions): string {
  const params = new URLSearchParams();

  if (options.sortBy) {
    params.append('sort_by', options.sortBy);
  }

  if (options.isActive !== undefined) {
    params.append('is_active', options.isActive ? 'true' : 'false');
  }

  if (options.page !== undefined) {
    params.append('page', String(options.page));
  }

  if (options.limit !== undefined) {
    params.append('limit', String(options.limit));
  }

  return params.toString();
}

/**
 * Hook to fetch requirement definitions with filtering, sorting, and pagination
 *
 * @param options - Hook options (sortBy, isActive, page, limit, enabled)
 * @returns Object with data, isLoading, isError, error, pagination, and refetch
 *
 * Query Behavior:
 * - Query key: ['requirementDefinitions', options]
 * - Endpoint: GET /api/requirement-definitions
 * - Stale time: 5 minutes
 * - Retry: 2 attempts with exponential backoff
 * - Refetch on window focus: enabled (keeps data fresh)
 * - Enabled: respects the enabled option (defaults to true)
 *
 * Automatic tenant isolation:
 * - Tenant context is managed by the API backend
 * - Hook automatically attaches authenticated user context via api service
 * - No manual tenant ID parameter needed
 */
export function useRequirementDefinitions(
  options: UseRequirementDefinitionsOptions = {}
): UseRequirementDefinitionsResult {
  const { enabled = true, ...queryOptions } = options;

  /**
   * Query function to fetch requirement definitions from the API
   */
  const queryFn = async (): Promise<{
    data: RequirementDefinition[];
    pagination: PaginationInfo;
  }> => {
    try {
      const queryString = buildQueryString(queryOptions);
      const url = `/requirement-definitions${queryString ? `?${queryString}` : ''}`;

      logger.info('[useRequirementDefinitions] Fetching from API', {
        url,
        options: queryOptions,
      });

      // Fetch from API with tenant context automatically handled by api service
      const response = await api.get<RequirementDefinitionsResponse>(url);

      // Extract data and pagination from response
      const { data, pagination } = response.data;

      // Transform pagination response to match our interface
      const paginationInfo: PaginationInfo = {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNextPage: pagination.hasNextPage,
        hasPreviousPage: pagination.hasPreviousPage,
      };

      logger.info('[useRequirementDefinitions] Fetch successful', {
        count: data.length,
        page: pagination.page,
        total: pagination.total,
      });

      return {
        data,
        pagination: paginationInfo,
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to load requirement definitions';

      logger.error('[useRequirementDefinitions] Fetch failed', {
        error: errorMessage,
        options: queryOptions,
      });

      throw err;
    }
  };

  /**
   * Use React Query to manage the query state
   * Query key includes options so different filter/sort/page combinations get separate cache entries
   */
  const {
    data,
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery<
    { data: RequirementDefinition[]; pagination: PaginationInfo },
    Error
  >({
    // Create a stable cache key based on all query options
    queryKey: queryKeys.requirementDefinitions.list(queryOptions),
    queryFn,
    // Only query if enabled
    enabled,
    // Data is fresh for 5 minutes
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

  // Default pagination values when data is not yet loaded
  const defaultPagination: PaginationInfo = {
    page: queryOptions.page || 1,
    limit: queryOptions.limit || 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPreviousPage: false,
  };

  return {
    data: data?.data ?? [],
    isLoading,
    isError: !!error,
    error,
    pagination: data?.pagination ?? defaultPagination,
    refetch,
  };
}
