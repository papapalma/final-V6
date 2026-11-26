/**
 * useDeleteRequirementDefinition Hook
 *
 * Provides a React Query mutation for soft-deleting requirement definitions
 * via DELETE /api/requirement-definitions/{id} (admin only).
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import logger from '../utils/logger';
import { queryKeys } from '../services/queryClient';

export interface DeleteRequirementResult {
  id: string;
  deleted_at: string;
}

export interface UseDeleteRequirementDefinitionResult {
  mutate: (id: string) => Promise<DeleteRequirementResult>;
  mutateAsync: (id: string) => Promise<DeleteRequirementResult>;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
}

export function useDeleteRequirementDefinition(): UseDeleteRequirementDefinitionResult {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (id: string): Promise<DeleteRequirementResult> => {
      if (!id) {
        throw new Error('Requirement ID is required for deletion');
      }

      try {
        logger.info('[useDeleteRequirementDefinition] Soft-deleting requirement definition', {
          requirementId: id,
        });

        const response = await api.delete<DeleteRequirementResult>(
          `/requirement-definitions/${id}`
        );

        const deleted = response.data ?? { id, deleted_at: new Date().toISOString() };

        logger.info('[useDeleteRequirementDefinition] Deletion successful', {
          requirementId: id,
        });

        return deleted;
      } catch (err: any) {
        const status = err?.status ?? err?.response?.status;
        if (status === 403 || (err instanceof Error && err.message.includes('403'))) {
          throw new Error(
            'You do not have permission to delete requirements. Admin access is required.'
          );
        }
        if (status === 404 || (err instanceof Error && err.message.includes('404'))) {
          throw new Error('Requirement definition not found.');
        }

        const errorMessage =
          err?.message || 'Failed to delete requirement definition';
        logger.error('[useDeleteRequirementDefinition] Deletion failed', {
          requirementId: id,
          error: errorMessage,
        });
        throw new Error(errorMessage);
      }
    },
    onSuccess: (deleted) => {
      if (deleted?.id) {
        queryClient.removeQueries({
          queryKey: queryKeys.requirementDefinitions.detail(deleted.id),
        });
      }
      queryClient.invalidateQueries({
        queryKey: queryKeys.requirementDefinitions.all,
      });
      queryClient.invalidateQueries({
        queryKey: ['requirementsAnalytics'],
      });
    },
    retry: 0,
  });

  const runDelete = (id: string) => {
    const promise = mutation.mutateAsync(id);
    promise.catch(() => {});
    return promise;
  };

  return {
    mutate: runDelete,
    mutateAsync: (id: string) => mutation.mutateAsync(id),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
