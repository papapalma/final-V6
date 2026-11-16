/**
 * useCreateRequirementDefinition Hook
 *
 * Provides mutation for creating new requirement definitions using React Query.
 * Handles POST requests to create requirement metadata and admin validation.
 *
 * Features:
 * - Uses React Query useMutation for POST /api/requirement-definitions
 * - Accepts creation fields: display_name, description, is_mandatory, is_active, applicability_rules
 * - Automatically invalidates requirement queries on success
 * - Implements retry: 0 policy (don't retry write operations)
 * - Provides user-friendly error handling with logging
 * - Handles admin-only validation (403 Forbidden for non-admin)
 * - Returns { mutate, isPending, isError, error, data }
 *
 * **Validates: Requirements 2.3, Frontend data fetching layer**
 *
 * Example usage:
 * ```typescript
 * const { mutate, isPending, error } = useCreateRequirementDefinition();
 *
 * const handleCreate = async () => {
 *   try {
 *     mutate({
 *       displayName: 'Birth Certificate',
 *       description: 'NSO/PSA Birth Certificate',
 *       isMandatory: true,
 *       isActive: true,
 *       applicabilityRules: null,
 *     });
 *   } catch (err) {
 *     console.error('Creation failed:', err);
 *   }
 * };
 * ```
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import type {
  RequirementDefinition,
  CreateRequirementPayload,
} from '../types/requirementDefinition';
import logger from '../utils/logger';

/**
 * Hook return type
 */
export interface UseCreateRequirementDefinitionResult {
  /**
   * Mutation function to create a new requirement definition.
   * @param data - Creation payload with required and optional fields
   * @returns Promise with the created requirement definition
   */
  mutate: (data: CreateRequirementPayload) => Promise<RequirementDefinition>;

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
   * The created requirement definition returned from the API
   */
  data?: RequirementDefinition;
}

/**
 * Hook to manage requirement definition mutations (create)
 *
 * Provides mutation for:
 * POST /api/requirement-definitions - create new requirement definition
 *
 * The mutation automatically invalidates requirement definition queries on success
 * to keep the UI in sync with server state.
 *
 * Query invalidation strategy:
 * - Invalidates all requirement definition queries
 * - React Query automatically refetches affected queries based on their staleTime
 * - For requirement list queries: uses staleTime of 5 minutes
 *
 * Error handling:
 * - 403 Forbidden: Non-admin user attempting to create (permission check)
 * - 400 Bad Request: Invalid payload data (missing required fields, invalid JSON in applicability_rules)
 * - 409 Conflict: Duplicate requirement_type for tenant
 * - Other errors: Logged and thrown for caller to handle
 *
 * @returns Object with mutate, isPending, isError, error, and data
 */
export function useCreateRequirementDefinition(): UseCreateRequirementDefinitionResult {
  const queryClient = useQueryClient();

  /**
   * Create mutation for POST /api/requirement-definitions
   *
   * Lifecycle:
   * 1. Validates input parameters (required fields)
   * 2. Sends POST request with creation payload
   * 3. On success: invalidates requirement caches and returns created definition
   * 4. On error: logs error with context and throws for caller to handle
   *
   * Admin-only validation:
   * - Backend will return 403 Forbidden if user is not an admin
   * - Error is properly caught and returned via error state
   */
  const mutation = useMutation({
    mutationFn: async (
      data: CreateRequirementPayload
    ): Promise<RequirementDefinition> => {
      // Validate required inputs
      if (!data.displayName || data.displayName.trim().length === 0) {
        throw new Error('Display name is required for creating requirement');
      }

      if (!data.description || data.description.trim().length === 0) {
        throw new Error('Description is required for creating requirement');
      }

      if (data.isMandatory === undefined) {
        throw new Error('Is mandatory flag is required for creating requirement');
      }

      try {
        logger.info('[useCreateRequirementDefinition] Creating requirement definition', {
          displayName: data.displayName,
          isMandatory: data.isMandatory,
          hasApplicabilityRules: !!data.applicabilityRules,
        });

        // Send POST request to create the requirement
        // API expects data with snake_case field names
        const payloadWithSnakeCase = {
          display_name: data.displayName,
          description: data.description,
          is_mandatory: data.isMandatory,
          is_active: data.isActive ?? true, // Default to active if not specified
          ...(data.applicabilityRules && {
            applicability_rules: data.applicabilityRules,
          }),
        };

        const response = await api.post<RequirementDefinition>(
          '/requirement-definitions',
          payloadWithSnakeCase
        );

        // Extract the created requirement from response
        // API returns { success: true, data: RequirementDefinition }
        const createdRequirement = response.data;

        logger.info('[useCreateRequirementDefinition] Creation successful', {
          requirementId: createdRequirement.id,
          displayName: createdRequirement.display_name,
          createdAt: createdRequirement.created_at,
        });

        return createdRequirement;
      } catch (err) {
        // Check for admin-only authorization error
        if (err instanceof Error && err.message.includes('403')) {
          logger.warn(
            '[useCreateRequirementDefinition] Unauthorized - admin required'
          );
          throw new Error(
            'You do not have permission to create requirements. Admin access is required.'
          );
        }

        // Check for conflict error (duplicate requirement type)
        if (err instanceof Error && err.message.includes('409')) {
          logger.warn(
            '[useCreateRequirementDefinition] Conflict - duplicate requirement type'
          );
          throw new Error(
            'A requirement with this type already exists for your tenant.'
          );
        }

        // Check for bad request error (invalid payload)
        if (err instanceof Error && err.message.includes('400')) {
          logger.warn('[useCreateRequirementDefinition] Bad request - invalid payload', {
            displayName: data.displayName,
          });
          throw new Error(
            'Invalid requirement data. Please check your input and try again.'
          );
        }

        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to create requirement definition';

        logger.error('[useCreateRequirementDefinition] Creation failed', {
          displayName: data.displayName,
          error: errorMessage,
        });

        throw new Error(errorMessage);
      }
    },

    /**
     * On success: invalidate all requirement definition queries
     * This triggers React Query to mark cached data as stale and refetch if needed
     */
    onSuccess: (createdData) => {
      logger.info(
        '[useCreateRequirementDefinition] Invalidating requirement definition queries'
      );

      // Invalidate all requirement definition queries to include the newly created one
      // Using a targeted invalidation pattern to avoid unnecessary refetches
      queryClient.invalidateQueries({
        queryKey: ['requirementDefinitions'],
        refetchType: 'stale' as any,
      });

      // Also refetch the analytics if it exists, since a new requirement affects stats
      queryClient.invalidateQueries({
        queryKey: ['requirementDefinitions', 'analytics'],
        refetchType: 'stale' as any,
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
     * Create a new requirement definition
     * Throws error if validation fails or API call fails
     */
    mutate: (data: CreateRequirementPayload) => {
      const promise = mutation.mutateAsync(data);
      promise.catch(() => {});
      return promise;
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
     * Successfully created requirement definition
     */
    data: mutation.data,
  };
}
