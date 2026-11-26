/**
 * useUpdateRequirementDefinition Hook
 *
 * Provides mutation for updating requirement definitions using React Query.
 * Handles PATCH requests to update requirement metadata and admin validation.
 *
 * Features:
 * - Uses React Query useMutation for PATCH /api/requirement-definitions/{id}
 * - Accepts updateable fields: display_name, description, is_mandatory, is_active
 * - Automatically invalidates requirement queries on success
 * - Implements retry: 0 policy (don't retry write operations)
 * - Provides user-friendly error handling with logging
 * - Handles admin-only validation (403 Forbidden for non-admin)
 * - Returns { mutate, isPending, isError, error, data }
 *
 * **Validates: Requirements 2.4, Frontend data fetching layer**
 *
 * Example usage:
 * ```typescript
 * const { mutate, isPending, error } = useUpdateRequirementDefinition();
 * 
 * const handleUpdate = async (requirementId: string) => {
 *   try {
 *     mutate({
 *       id: requirementId,
 *       data: {
 *         displayName: 'Updated Name',
 *         description: 'Updated description',
 *         isMandatory: false,
 *       },
 *     });
 *   } catch (err) {
 *     console.error('Update failed:', err);
 *   }
 * };
 * ```
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type {
  RequirementDefinition,
  UpdateRequirementPayload,
} from '../types/requirementDefinition';
import logger from '../utils/logger';
import { queryKeys } from '../services/queryClient';

/**
 * Hook return type
 */
export interface UseUpdateRequirementDefinitionResult {
  /**
   * Mutation function to update a requirement definition.
   * @param id - The ID of the requirement definition to update
   * @param data - Partial data to update (only provided fields will be updated)
   * @returns Promise with the updated requirement definition
   */
  mutate: (
    id: string,
    data: UpdateRequirementPayload
  ) => Promise<RequirementDefinition>;

  mutateAsync?: (
    id: string,
    data: UpdateRequirementPayload
  ) => Promise<RequirementDefinition>;

  /**
   * True if mutation is currently in progress (loading state)
   */
  isPending: boolean;

  /**
   * True if mutation has failed
   */
  isError: boolean;

  /**
   * Error object if mutation fails, null if successful or not yet executed
   */
  error: Error | null;

  /**
   * The updated requirement definition returned from the API
   */
  data?: RequirementDefinition;
}

/**
 * Hook to manage requirement definition mutations (update)
 *
 * Provides mutation for:
 * PATCH /api/requirement-definitions/{id} - update requirement definition
 *
 * The mutation automatically invalidates requirement definition queries on success
 * to keep the UI in sync with server state.
 *
 * Query invalidation strategy:
 * - Invalidates all requirement definition queries
 * - React Query automatically refetches affected queries based on their staleTime
 * - For single requirement queries: uses staleTime of 5 minutes
 * - For requirement list queries: uses staleTime of 1 minute
 *
 * Error handling:
 * - 403 Forbidden: Non-admin user attempting to update (permission check)
 * - 404 Not Found: Requirement definition not found
 * - 400 Bad Request: Invalid payload data
 * - Other errors: Logged and thrown for caller to handle
 *
 * @returns Object with mutate, isPending, isError, error, and data
 */
export function useUpdateRequirementDefinition(): UseUpdateRequirementDefinitionResult {
  const queryClient = useQueryClient();

  /**
   * Update mutation for PATCH /api/requirement-definitions/{id}
   *
   * Lifecycle:
   * 1. Validates input parameters (id and data)
   * 2. Sends PATCH request with partial update data
   * 3. On success: invalidates requirement caches and returns updated definition
   * 4. On error: logs error with context and throws for caller to handle
   *
   * Admin-only validation:
   * - Backend will return 403 Forbidden if user is not an admin
   * - Error is properly caught and returned via error state
   */
  const mutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: UpdateRequirementPayload;
    }): Promise<RequirementDefinition> => {
      // Validate required inputs
      if (!id) {
        throw new Error('Requirement ID is required for update');
      }

      if (!data || Object.keys(data).length === 0) {
        throw new Error('At least one field is required to update');
      }

      try {
        logger.info('[useUpdateRequirementDefinition] Updating requirement definition', {
          requirementId: id,
          fieldCount: Object.keys(data).length,
          fields: Object.keys(data),
        });

        // Send PATCH request to update the requirement
        // API expects data with snake_case field names
        const resolvedDisplayName = data.displayName ?? data.display_name;
        const resolvedIsMandatory = data.isMandatory ?? data.is_mandatory;
        const resolvedIsActive = data.isActive ?? data.is_active;
        const resolvedApplicabilityRules =
          data.applicabilityRules !== undefined
            ? data.applicabilityRules
            : data.applicability_rules;

        const payloadWithSnakeCase = {
          ...(resolvedDisplayName !== undefined && { display_name: resolvedDisplayName }),
          ...(data.description !== undefined && { description: data.description }),
          ...(resolvedIsMandatory !== undefined && {
            is_mandatory: resolvedIsMandatory,
          }),
          ...(resolvedIsActive !== undefined && { is_active: resolvedIsActive }),
          ...(resolvedApplicabilityRules !== undefined && {
            applicability_rules: resolvedApplicabilityRules,
          }),
        };

        const response = await api.patch<RequirementDefinition>(
          `/requirement-definitions/${id}`,
          payloadWithSnakeCase
        );

        // Extract the updated requirement from response
        // API returns { success: true, data: RequirementDefinition }
        const updatedRequirement = response.data;

        logger.info('[useUpdateRequirementDefinition] Update successful', {
          requirementId: id,
          updatedAt: (updatedRequirement as any)?.updatedAt || (updatedRequirement as any)?.updated_at,
        });

        return updatedRequirement;
      } catch (err) {
        // Check for admin-only authorization error
        if (err instanceof Error && err.message.includes('403')) {
          logger.warn(
            '[useUpdateRequirementDefinition] Unauthorized - admin required',
            {
              requirementId: id,
            }
          );
          throw new Error(
            'You do not have permission to update requirements. Admin access is required.'
          );
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to update requirement definition';

        logger.error('[useUpdateRequirementDefinition] Update failed', {
          requirementId: id,
          error: errorMessage,
        });

        throw new Error(errorMessage);
      }
    },

    /**
     * On success: invalidate all requirement definition queries
     * This triggers React Query to mark cached data as stale and refetch if needed
     */
    onSuccess: (updatedData) => {
      logger.info(
        '[useUpdateRequirementDefinition] Invalidating requirement definition queries'
      );

      // Invalidate requirement definition list & detail queries using canonical queryKeys
      queryClient.invalidateQueries({
        queryKey: queryKeys.requirementDefinitions.all,
      });

      if (updatedData?.id) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.requirementDefinitions.detail(updatedData.id),
        });
      }

      queryClient.invalidateQueries({
        queryKey: ['requirementsAnalytics'],
      });
    },

    /**
     * Mutation options:
     * - retry: 0 -> Don't retry failed write operations
     *   Write operations should fail immediately so user can correct/retry manually
     */
    retry: 0,
  });

  return {
    /**
     * Update a requirement definition
     * Throws error if validation fails or API call fails
     */
    mutate: (id: string, data: UpdateRequirementPayload) => {
      const promise = mutation.mutateAsync({ id, data });
      promise.catch(() => {});
      return promise;
    },

    mutateAsync: (id: string, data: UpdateRequirementPayload) => {
      return mutation.mutateAsync({ id, data });
    },

    /**
     * Loading state: true if mutation is in progress
     */
    isPending: mutation.isPending,

    /**
     * Error state: true if mutation has failed
     */
    isError: mutation.isError,

    /**
     * Error object: returns error if mutation failed, null otherwise
     */
    error: mutation.error,

    /**
     * Successfully updated requirement definition
     */
    data: mutation.data,
  };
}
