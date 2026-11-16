/**
 * useRequirementDefinition Hook
 *
 * Fetches a single requirement definition by ID using React Query.
 * Provides loading, error states, and refetch functionality.
 *
 * Features:
 * - Uses React Query with queryKey ['requirementDefinitions', 'detail', id]
 * - Fetches from GET /api/requirement-definitions/{id}
 * - Handles null/undefined requirement ID gracefully (doesn't query if missing)
 * - Caches data with 5-minute stale time
 * - Provides refetch capability for manual updates
 * - Implements exponential backoff retry strategy (2 retries)
 * - Returns { data, isLoading, isError, error }
 * - Handles 404 errors gracefully (returns null data)
 *
 * **Validates: Requirements FR1.1, FR2.2 - Frontend data fetching layer**
 *
 * Example usage:
 * ```typescript
 * const { data, isLoading, isError, error } = useRequirementDefinition('req-123');
 * if (isLoading) return <Skeleton />;
 * if (isError) return <ErrorMessage error={error} />;
 * return <RequirementDetail requirement={data} />;
 * ```
 */

import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import type { RequirementDefinition } from '../types/requirementDefinition';
import logger from '../utils/logger';
import { queryKeys } from '../services/queryClient';

/**
 * Hook options interface
 */
export interface UseRequirementDefinitionOptions {
  /**
   * Whether to enable the query.
   * Defaults to true - set to false for conditional queries.
   */
  enabled?: boolean;
}

/**
 * Hook return type
 */
export interface UseRequirementDefinitionResult {
  /** The fetched requirement definition, or null if not found */
  data: RequirementDefinition | null;
  /** Whether data is currently being fetched */
  isLoading: boolean;
  /** Whether the query resulted in an error */
  isError: boolean;
  /** Error object if fetch failed, null if successful */
  error: Error | null;
}

/**
 * Cache stale time: 5 minutes (300,000 ms)
 * Requirement definitions don't change frequently, so 5 minutes is appropriate.
 * This means data is considered fresh for 5 minutes before being eligible for refetch.
 */
const STALE_TIME = 5 * 60 * 1000;

/**
 * Hook to fetch a single requirement definition by ID using React Query
 *
 * @param requirementId - The requirement definition ID to fetch (optional)
 * @param options - Hook options (enabled, etc.)
 * @returns Object with data, isLoading, isError, and error
 *
 * Query Behavior:
 * - Query key: ['requirementDefinitions', 'detail', requirementId]
 * - Enabled: !!requirementId && enabled (doesn't query if requirementId is missing or disabled)
 * - Stale time: 5 minutes
 * - Retry: 2 attempts with exponential backoff, except for 404 errors
 * - Refetch on window focus: enabled (keeps data fresh)
 *
 * Error Handling:
 * - 404 errors return null data without throwing
 * - Other errors are thrown and caught in isError/error states
 */
export function useRequirementDefinition(
  requirementId?: string,
  options: UseRequirementDefinitionOptions = {}
): UseRequirementDefinitionResult {
  const { enabled = true } = options;

  /**
   * Query function to fetch the requirement definition from the API
   */
  const queryFn = async (): Promise<RequirementDefinition | null> => {
    if (!requirementId) {
      return null;
    }

    try {
      logger.info('[useRequirementDefinition] Fetching from API', { requirementId });

      // Fetch from API
      const response = await api.get<RequirementDefinition>(
        `/requirement-definitions/${requirementId}`
      );

      // Extract the definition from response
      // The API returns { success, data: RequirementDefinition | null }
      const definition = response.data || null;

      logger.info('[useRequirementDefinition] Fetch successful', {
        requirementId,
        hasDefinition: !!definition,
      });

      return definition;
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to load requirement definition';

      // Handle 404 gracefully - return null instead of throwing
      if (err instanceof Error && err.message.includes('404')) {
        logger.warn('[useRequirementDefinition] Requirement not found', { requirementId });
        return null;
      }

      logger.error('[useRequirementDefinition] Fetch failed', {
        requirementId,
        error: errorMessage,
      });

      throw err;
    }
  };

  /**
   * Use React Query to manage the query state
   * Query key includes requirementId so each requirement gets its own cache entry
   */
  const {
    data,
    isLoading,
    isError,
    error,
  } = useQuery<RequirementDefinition | null, Error>({
    queryKey: queryKeys.requirementDefinitions.detail(requirementId || ''),
    queryFn,
    // Only query if requirementId exists AND query is enabled
    enabled: !!requirementId && enabled,
    // Data is fresh for 5 minutes
    staleTime: STALE_TIME,
    // Retry twice with exponential backoff (1000ms, 2000ms)
    // Don't retry 4xx errors
    retry: (failureCount, error: any) => {
      if (error?.status >= 400 && error?.status < 500) {
        return false;
      }
      return failureCount < 2;
    },
    // Refetch on window focus to keep data fresh
    refetchOnWindowFocus: true,
  });

  return {
    data: data ?? null,
    isLoading,
    isError,
    error,
  };
}
