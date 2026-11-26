import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useUpdateRequirementDefinition } from './useUpdateRequirementDefinition';
import api from '../services/api';
import type {
  RequirementDefinition,
  UpdateRequirementPayload,
} from '../types/requirementDefinition';

// Mock the API service
vi.mock('../services/api');

// Mock the logger
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Create a wrapper for React Query
const createTestWrapper = () => {
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: 0 },
    },
  });

  const wrapper = ({ children }: any) =>
    React.createElement(QueryClientProvider, { client: testQueryClient }, children);

  return { wrapper, testQueryClient };
};

// Mock requirement definition for testing
const mockRequirement: RequirementDefinition = {
  id: 'req-123',
  tenantId: 'tenant-1',
  requirementType: 'birth_certificate',
  displayName: 'Birth Certificate',
  description: 'NSO/PSA Birth Certificate',
  isMandatory: true,
  isActive: true,
  applicabilityRules: null,
  displayOrder: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  deletedAt: null,
};

describe('useUpdateRequirementDefinition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Successful updates', () => {
    it('should update requirement definition with all fields', async () => {
      const { wrapper, testQueryClient } = createTestWrapper();
      const updatedRequirement = {
        ...mockRequirement,
        displayName: 'Updated Birth Certificate',
        description: 'Updated description',
        isMandatory: false,
        isActive: false,
      };

      (api.patch as any).mockResolvedValueOnce({
        success: true,
        data: updatedRequirement,
      });

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      const updatePayload: UpdateRequirementPayload = {
        displayName: 'Updated Birth Certificate',
        description: 'Updated description',
        isMandatory: false,
        isActive: false,
      };

      result.current.mutate('req-123', updatePayload);

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toEqual(updatedRequirement);
      expect(api.patch).toHaveBeenCalledWith(
        '/requirement-definitions/req-123',
        {
          display_name: 'Updated Birth Certificate',
          description: 'Updated description',
          is_mandatory: false,
          is_active: false,
        }
      );
    });

    it('should update requirement with single field (partial update)', async () => {
      const { wrapper } = createTestWrapper();
      const updatedRequirement = {
        ...mockRequirement,
        displayName: 'Updated Name Only',
      };

      (api.patch as any).mockResolvedValueOnce({
        success: true,
        data: updatedRequirement,
      });

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      result.current.mutate('req-123', {
        displayName: 'Updated Name Only',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.data).toEqual(updatedRequirement);
      expect(api.patch).toHaveBeenCalledWith(
        '/requirement-definitions/req-123',
        {
          display_name: 'Updated Name Only',
        }
      );
    });

    it('should convert camelCase to snake_case in API payload', async () => {
      const { wrapper } = createTestWrapper();

      (api.patch as any).mockResolvedValueOnce({
        success: true,
        data: mockRequirement,
      });

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      result.current.mutate('req-123', {
        displayName: 'New Name',
        isMandatory: false,
        isActive: true,
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(api.patch).toHaveBeenCalledWith(
        '/requirement-definitions/req-123',
        {
          display_name: 'New Name',
          is_mandatory: false,
          is_active: true,
        }
      );
    });

    it('should invalidate requirement queries on success', async () => {
      const { wrapper, testQueryClient } = createTestWrapper();
      const invalidateQueriesSpy = vi.spyOn(
        testQueryClient,
        'invalidateQueries'
      );

      (api.patch as any).mockResolvedValueOnce({
        success: true,
        data: mockRequirement,
      });

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      result.current.mutate('req-123', {
        displayName: 'Updated Name',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['requirementDefinitions'],
        })
      );

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['requirementDefinitions', 'detail', 'req-123'],
        })
      );

      invalidateQueriesSpy.mockRestore();
    });

    it('should forward applicabilityRules as applicability_rules in PATCH payload', async () => {
      const { wrapper } = createTestWrapper();

      (api.patch as any).mockResolvedValueOnce({
        success: true,
        data: mockRequirement,
      });

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      await result.current.mutate('req-123', {
        applicabilityRules: { marital_status: 'married' },
      });

      expect(api.patch).toHaveBeenCalledWith(
        '/requirement-definitions/req-123',
        expect.objectContaining({
          applicability_rules: { marital_status: 'married' },
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should handle 403 Forbidden (admin-only) error', async () => {
      const { wrapper } = createTestWrapper();

      const error = new Error('403 Forbidden');
      (api.patch as any).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      result.current.mutate('req-123', {
        displayName: 'Updated Name',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toContain(
        'You do not have permission to update requirements'
      );
    });

    it('should handle 404 Not Found error', async () => {
      const { wrapper } = createTestWrapper();

      const error = new Error('Requirement definition not found');
      (api.patch as any).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      result.current.mutate('nonexistent-id', {
        displayName: 'Updated Name',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toContain(
        'Requirement definition not found'
      );
    });

    it('should handle generic API errors', async () => {
      const { wrapper } = createTestWrapper();

      const error = new Error('Network error');
      (api.patch as any).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      result.current.mutate('req-123', {
        displayName: 'Updated Name',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe('Network error');
    });

    it('should not retry failed mutations', async () => {
      const { wrapper } = createTestWrapper();

      const error = new Error('API Error');
      (api.patch as any).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      result.current.mutate('req-123', {
        displayName: 'Updated Name',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      // Should only call api.patch once, not retry
      expect(api.patch).toHaveBeenCalledTimes(1);
    });
  });;

  describe('Input validation', () => {
    it('should throw error if requirement ID is empty', async () => {
      const { wrapper } = createTestWrapper();

      (api.patch as any).mockResolvedValueOnce({
        success: true,
        data: mockRequirement,
      });

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      result.current.mutate('', {
        displayName: 'Updated Name',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toContain(
        'Requirement ID is required'
      );
      expect(api.patch).not.toHaveBeenCalled();
    });

    it('should throw error if no fields are provided for update', async () => {
      const { wrapper } = createTestWrapper();

      (api.patch as any).mockResolvedValueOnce({
        success: true,
        data: mockRequirement,
      });

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      result.current.mutate('req-123', {});

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toContain(
        'At least one field is required'
      );
      expect(api.patch).not.toHaveBeenCalled();
    });
  });

  describe('Loading and error states', () => {
    it('should have correct initial state', () => {
      const { wrapper } = createTestWrapper();

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      expect(result.current.isPending).toBe(false);
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.data).toBeUndefined();
    });

    it('should update state after successful mutation', async () => {
      const { wrapper } = createTestWrapper();

      (api.patch as any).mockResolvedValueOnce({
        success: true,
        data: mockRequirement,
      });

      const { result } = renderHook(() => useUpdateRequirementDefinition(), {
        wrapper,
      });

      result.current.mutate('req-123', {
        displayName: 'Updated Name',
      });

      await waitFor(() => {
        expect(result.current.isPending).toBe(false);
      });

      expect(result.current.data).toEqual(mockRequirement);
      expect(result.current.isError).toBe(false);
    });
  });
});
