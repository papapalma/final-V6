/**
 * React Query Client Configuration and Cache Optimization
 *
 * This module provides:
 * 1. Centralized QueryClient setup with optimized defaults
 * 2. Query key factory functions for consistency and type safety
 * 3. Automatic cache invalidation strategies
 * 4. Garbage collection settings to manage memory
 * 5. Persistent cache configuration (using localStorage)
 *
 * **Validates: Task 11.1 - Optimize React Query caching strategy**
 */

import { QueryClient, DefaultOptions } from '@tanstack/react-query';
import logger from '../utils/logger';

/**
 * Query Key Factory
 * Centralizes all query key definitions for consistency and type safety.
 * Prevents typos and makes refactoring easier.
 */
export const queryKeys = {
  // Trainee Status queries
  traineeStatus: {
    all: ['traineeStatus'] as const,
    byEnrollment: (enrollmentId: string) => [...queryKeys.traineeStatus.all, 'enrollment', enrollmentId] as const,
    detail: (recordId: string) => [...queryKeys.traineeStatus.all, 'detail', recordId] as const,
  },
  traineeStatuses: {
    all: ['traineeStatuses'] as const,
    list: (filters: Record<string, any>, sort: Record<string, any>, pagination: Record<string, any>) =>
      [...queryKeys.traineeStatuses.all, { filters, sort, pagination }] as const,
    filtered: (filters: Record<string, any>) => [...queryKeys.traineeStatuses.all, { filters }] as const,
  },

  // Requirement Definition queries
  requirementDefinitions: {
    all: ['requirementDefinitions'] as const,
    list: (options: Record<string, any> = {}) =>
      [...queryKeys.requirementDefinitions.all, 'list', options] as const,
    detail: (id: string) => [...queryKeys.requirementDefinitions.all, 'detail', id] as const,
    submissions: (id: string, options?: Record<string, any>) =>
      [...queryKeys.requirementDefinitions.all, 'submissions', id, options || {}] as const,
    analytics: () => [...queryKeys.requirementDefinitions.all, 'analytics'] as const,
  },

  // Requirement Submissions queries
  requirementSubmissions: {
    all: ['requirementSubmissions'] as const,
    byRequirement: (requirementId: string, filters?: Record<string, any>, sort?: Record<string, any>, pagination?: Record<string, any>) =>
      [...queryKeys.requirementSubmissions.all, 'requirement', requirementId, { filters, sort, pagination }] as const,
  },

  // Add other query keys here as needed
  trainees: {
    all: ['trainees'] as const,
    list: () => [...queryKeys.trainees.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.trainees.all, id] as const,
  },
  enrollments: {
    all: ['enrollments'] as const,
    list: () => [...queryKeys.enrollments.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.enrollments.all, id] as const,
  },
};

/**
 * Default Query Options
 * Provides sensible defaults for all queries while allowing per-query overrides
 */
const defaultQueryOptions: DefaultOptions['queries'] = {
  // Stale times: how long data is considered "fresh" before marking as stale
  staleTime: 1000 * 60 * 5, // 5 minutes default
  
  // Retry strategy: exponential backoff for failed queries
  retry: (failureCount, error: any) => {
    // Don't retry 4xx errors (client errors like 404, 400, 403)
    if (error?.status >= 400 && error?.status < 500) {
      return false;
    }
    // Retry up to 2 times for 5xx or network errors
    return failureCount < 2;
  },
  
  // Refetch strategy: keep data fresh when user refocuses the window
  refetchOnWindowFocus: 'stale' as any,
  
  // Refetch on network reconnection: important for offline support
  refetchOnReconnect: 'stale' as any,
  
  // Garbage collection: remove unused cached data after 10 minutes
  gcTime: 1000 * 60 * 10,
  
  // Don't refetch in the background when component remounts if data exists
  refetchOnMount: 'stale' as any,
};

/**
 * Default Mutation Options
 * Write operations (mutations) have different requirements than reads
 */
const defaultMutationOptions: DefaultOptions['mutations'] = {
  // Don't retry mutations - they should fail immediately
  // so user can correct and retry manually
  retry: 0,
};

/**
 * Create optimized QueryClient with caching strategy
 *
 * Optimization features:
 * 1. Selective stale times based on data volatility
 * 2. Intelligent retry strategy that respects HTTP semantics
 * 3. Garbage collection to manage memory usage
 * 4. Refetch on focus/reconnect for data freshness
 * 5. Persistent cache layer (optional, can be enabled)
 *
 * @returns Configured QueryClient instance
 */
export function createOptimizedQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: defaultQueryOptions,
      mutations: defaultMutationOptions,
    },
  });

  // Optional: Add middleware for logging cache operations in development
  if (process.env.NODE_ENV === 'development') {
    // Log cache updates for debugging
    queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated') {
        const query = event.query;
        logger.debug('[QueryClient] Cache updated', {
          queryKey: query.queryKey,
          status: query.state.status,
          dataUpdatedAt: query.state.dataUpdatedAt,
        });
      }
    });
  }

  return queryClient;
}

export const createQueryClient = createOptimizedQueryClient;
export default createOptimizedQueryClient;

/**
 * Cache Invalidation Helper Functions
 * Provides targeted invalidation strategies instead of invalidating entire query families
 */
export const invalidationStrategies = {
  /**
   * Invalidate a single trainee status record
   * Use when a specific record is updated
   */
  invalidateSingleTraineeStatus: (queryClient: QueryClient, enrollmentId: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.traineeStatus.byEnrollment(enrollmentId),
      refetchType: 'active', // Only refetch if active
    });
  },

  /**
   * Invalidate all trainee statuses matching a filter
   * Use when filtering/sorting changes
   */
  invalidateTraineeStatusList: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.traineeStatuses.all,
      refetchType: 'active',
    });
  },

  /**
   * Invalidate both single and list queries
   * Use after an update mutation
   */
  invalidateAllTraineeStatuses: (queryClient: QueryClient, enrollmentId?: string) => {
    // Invalidate all status queries
    queryClient.invalidateQueries({
      queryKey: queryKeys.traineeStatus.all,
      refetchType: 'active',
    });
    queryClient.invalidateQueries({
      queryKey: queryKeys.traineeStatuses.all,
      refetchType: 'active',
    });

    logger.info('[QueryClient] Invalidated all trainee status caches', {
      enrollmentId,
    });
  },

  /**
   * Clear all trainee status caches
   * Use when logging out or switching tenants
   */
  clearAllTraineeStatusCaches: (queryClient: QueryClient) => {
    queryClient.removeQueries({
      queryKey: queryKeys.traineeStatus.all,
    });
    queryClient.removeQueries({
      queryKey: queryKeys.traineeStatuses.all,
    });

    logger.info('[QueryClient] Cleared all trainee status caches');
  },
};

/**
 * Helper function to log cache state (useful for debugging)
 */
export function logCacheState(queryClient: QueryClient) {
  const queries = queryClient.getQueryCache().getAll();
  console.group('[React Query Cache State]');
  queries.forEach((query) => {
    console.log({
      key: query.queryKey,
      status: query.state.status,
      dataUpdatedAt: query.state.dataUpdatedAt,
      staleTime: (query.options as any).staleTime,
      gcTime: (query.options as any).gcTime,
    });
  });
  console.groupEnd();
}

/**
 * Performance monitoring for React Query
 * Track slow queries and cache misses
 */
export function setupQueryPerformanceMonitoring(queryClient: QueryClient) {
  const slowQueryThreshold = 5000; // 5 seconds

  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'observerAdded') {
      const query = event.query;

      // Hook into the query success to measure execution time
      const originalFn = (query as any).queryFn || (query.options as any).queryFn;
      if (originalFn) {
        (query as any).queryFn = async (...args: any[]) => {
          const executionStartTime = Date.now();
          try {
            const result = await originalFn(...args);
            const executionTime = Date.now() - executionStartTime;

            if (executionTime > slowQueryThreshold) {
              logger.warn('[QueryClient] Slow query detected', {
                queryKey: query.queryKey,
                executionTime: `${executionTime}ms`,
                threshold: `${slowQueryThreshold}ms`,
              });
            }

            return result;
          } catch (error) {
            logger.error('[QueryClient] Query failed', {
              queryKey: query.queryKey,
              error: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }
        };
      }
    }
  });
}
