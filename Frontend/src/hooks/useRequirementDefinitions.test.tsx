/**
 * Tests for useRequirementDefinitions Hook
 * 
 * **Validates: Requirements FR2.1**
 * 
 * Tests verify:
 * - Hook fetches requirement definitions from API
 * - Query parameters (sort_by, is_active, page, limit) are properly formatted
 * - Loading and error states are correctly returned
 * - Pagination info is properly calculated and returned
 * - Data caching works correctly
 * - Refetch functionality works as expected
 * - Tenant isolation is maintained (automatic via API)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React, { ReactNode } from 'react';
import { useRequirementDefinitions } from './useRequirementDefinitions';
import api from '../services/api';
import logger from '../utils/logger';
import type { RequirementDefinitionsResponse } from '../types/requirementDefinition';

// Mock dependencies
vi.mock('../services/api');
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock data
const mockRequirementDefinitions = [
  {
    id: 'req-001',
    tenant_id: 'tenant-001',
    requirement_type: 'accomplished_learners_profile_form',
    display_name: 'Accomplished Learner\'s Profile Form',
    description: 'Form to capture learner\'s achievements',
    is_mandatory: true,
    is_active: true,
    applicability_rules: null,
    display_order: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    submission_stats: {
      total_trainees: 100,
      pending_count: 20,
      submitted_count: 50,
      verified_count: 30,
      rejected_count: 0,
      waived_count: 0,
      completion_rate: 30,
    },
  },
  {
    id: 'req-002',
    tenant_id: 'tenant-001',
    requirement_type: 'birth_certificate_copy',
    display_name: 'Photocopy of Birth Certificate',
    description: 'NSO or PSA certified copy',
    is_mandatory: true,
    is_active: true,
    applicability_rules: null,
    display_order: 2,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    deleted_at: null,
    submission_stats: {
      total_trainees: 100,
      pending_count: 10,
      submitted_count: 60,
      verified_count: 30,
      rejected_count: 0,
      waived_count: 0,
      completion_rate: 30,
    },
  },
];

const mockResponse: RequirementDefinitionsResponse = {
  success: true,
  data: mockRequirementDefinitions,
  pagination: {
    page: 1,
    limit: 20,
    total: 2,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  },
};

describe('useRequirementDefinitions', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  describe('Basic Functionality', () => {
    it('should fetch requirement definitions on mount using unwrapped ApiResponse envelope', async () => {
      const mockApiGet = vi.fn().mockResolvedValue(mockResponse);
      (api.get as any) = mockApiGet;

      const { result } = renderHook(() => useRequirementDefinitions(), {
        wrapper,
      });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should have data
      expect(result.current.data).toHaveLength(2);
      expect(result.current.data[0].id).toBe('req-001');
      expect(result.current.data[1].id).toBe('req-002');

      // Should not have error
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();

      // API should have been called
      expect(mockApiGet).toHaveBeenCalledWith('/requirement-definitions');
    });

    it('should return pagination info correctly and derive hasNextPage/hasPreviousPage when omitted by backend', async () => {
      const backendWireResponse = {
        success: true,
        data: mockRequirementDefinitions,
        pagination: {
          page: 2,
          limit: 20,
          total: 60,
          totalPages: 3,
        },
      };
      const mockApiGet = vi.fn().mockResolvedValue(backendWireResponse);
      (api.get as any) = mockApiGet;

      const { result } = renderHook(() => useRequirementDefinitions({ page: 2, limit: 20 }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(false);
      expect(result.current.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 60,
        totalPages: 3,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });

    it('should include submission stats in data', async () => {
      const mockApiGet = vi.fn().mockResolvedValue(mockResponse);
      (api.get as any) = mockApiGet;

      const { result } = renderHook(() => useRequirementDefinitions(), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data[0].submission_stats).toEqual({
        total_trainees: 100,
        pending_count: 20,
        submitted_count: 50,
        verified_count: 30,
        rejected_count: 0,
        waived_count: 0,
        completion_rate: 30,
      });
    });
  });

  describe('Query Parameters', () => {
    it('should include sort_by parameter in query string', async () => {
      const mockApiGet = vi.fn().mockResolvedValue(mockResponse);
      (api.get as any) = mockApiGet;

      renderHook(() => useRequirementDefinitions({ sortBy: 'name' }), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('sort_by=name')
      );
    });

    it('should include is_active parameter in query string', async () => {
      const mockApiGet = vi.fn().mockResolvedValue(mockResponse);
      (api.get as any) = mockApiGet;

      renderHook(() => useRequirementDefinitions({ isActive: true }), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      expect(mockApiGet).toHaveBeenCalledWith(
        expect.stringContaining('is_active=true')
      );
    });

    it('should include pagination parameters', async () => {
      const mockApiGet = vi.fn().mockResolvedValue(mockResponse);
      (api.get as any) = mockApiGet;

      renderHook(
        () =>
          useRequirementDefinitions({
            page: 2,
            limit: 50,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      const callUrl = (mockApiGet.mock.calls[0][0] as string);
      expect(callUrl).toContain('page=2');
      expect(callUrl).toContain('limit=50');
    });

    it('should include all parameters together', async () => {
      const mockApiGet = vi.fn().mockResolvedValue(mockResponse);
      (api.get as any) = mockApiGet;

      renderHook(
        () =>
          useRequirementDefinitions({
            sortBy: 'completion_rate',
            isActive: false,
            page: 3,
            limit: 25,
          }),
        { wrapper }
      );

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      const callUrl = (mockApiGet.mock.calls[0][0] as string);
      expect(callUrl).toContain('sort_by=completion_rate');
      expect(callUrl).toContain('is_active=false');
      expect(callUrl).toContain('page=3');
      expect(callUrl).toContain('limit=25');
    });
  });

  describe('Error Handling', () => {
    it('should log errors when API fails', async () => {
      const mockError = new Error('Network Error');
      const mockApiGet = vi.fn().mockRejectedValue(mockError);
      (api.get as any) = mockApiGet;

      renderHook(() => useRequirementDefinitions(), {
        wrapper,
      });

      // Wait for the query to be called
      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      // Logger should be called with error info
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('Refetch Functionality', () => {
    it('should provide refetch function', async () => {
      const mockApiGet = vi
        .fn()
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse);
      (api.get as any) = mockApiGet;

      const { result } = renderHook(() => useRequirementDefinitions(), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockApiGet).toHaveBeenCalledTimes(1);

      // Manually refetch
      await result.current.refetch();

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Conditional Query', () => {
    it('should not fetch if enabled is false', async () => {
      const mockApiGet = vi.fn().mockResolvedValue(mockResponse);
      (api.get as any) = mockApiGet;

      renderHook(() => useRequirementDefinitions({ enabled: false }), {
        wrapper,
      });

      // Wait a bit to ensure no call happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockApiGet).not.toHaveBeenCalled();
    });

    it('should fetch when enabled changes from false to true', async () => {
      const mockApiGet = vi.fn().mockResolvedValue(mockResponse);
      (api.get as any) = mockApiGet;

      let enabled = false;
      const { rerender } = renderHook(
        () => useRequirementDefinitions({ enabled }),
        { wrapper }
      );

      expect(mockApiGet).not.toHaveBeenCalled();

      // Enable the query
      enabled = true;
      rerender();

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });
    });
  });

  describe('Empty Results', () => {
    it('should handle empty results', async () => {
      const emptyResponse: RequirementDefinitionsResponse = {
        success: true,
        data: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      const mockApiGet = vi.fn().mockResolvedValue(emptyResponse);
      (api.get as any) = mockApiGet;

      const { result } = renderHook(() => useRequirementDefinitions(), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.pagination.total).toBe(0);
      expect(result.current.pagination.totalPages).toBe(0);
    });
  });

  describe('Pagination Navigation', () => {
    it('should calculate pagination correctly for multiple pages', async () => {
      const paginatedResponse: RequirementDefinitionsResponse = {
        success: true,
        data: mockRequirementDefinitions,
        pagination: {
          page: 2,
          limit: 20,
          total: 100,
          totalPages: 5,
          hasNextPage: true,
          hasPreviousPage: true,
        },
      };

      const mockApiGet = vi.fn().mockResolvedValue(paginatedResponse);
      (api.get as any) = mockApiGet;

      const { result } = renderHook(
        () => useRequirementDefinitions({ page: 2, limit: 20 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pagination).toEqual({
        page: 2,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNextPage: true,
        hasPreviousPage: true,
      });
    });
  });

  describe('Data Caching', () => {
    it('should use cached data for same query parameters', async () => {
      const mockApiGet = vi.fn().mockResolvedValue(mockResponse);
      (api.get as any) = mockApiGet;

      // First render
      const { result: result1 } = renderHook(
        () => useRequirementDefinitions({ sortBy: 'name' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result1.current.isLoading).toBe(false);
      });

      expect(mockApiGet).toHaveBeenCalledTimes(1);

      // Second render with same parameters (should use cache)
      const { result: result2 } = renderHook(
        () => useRequirementDefinitions({ sortBy: 'name' }),
        { wrapper }
      );

      // Should use cached data immediately
      expect(result2.current.data).toEqual(result1.current.data);
      // API should not be called again due to caching
      expect(mockApiGet).toHaveBeenCalledTimes(1);
    });
  });

  describe('Logging', () => {
    it('should log fetch start and success', async () => {
      const mockApiGet = vi.fn().mockResolvedValue(mockResponse);
      (api.get as any) = mockApiGet;

      renderHook(() => useRequirementDefinitions(), {
        wrapper,
      });

      await waitFor(() => {
        expect(mockApiGet).toHaveBeenCalled();
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Fetching from API'),
        expect.any(Object)
      );

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Fetch successful'),
        expect.any(Object)
      );
    });

    it('should log errors', async () => {
      const mockError = new Error('Network Error');
      const mockApiGet = vi.fn().mockRejectedValue(mockError);
      (api.get as any) = mockApiGet;

      renderHook(() => useRequirementDefinitions(), {
        wrapper,
      });

      await waitFor(() => {
        expect(logger.error).toHaveBeenCalled();
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Fetch failed'),
        expect.any(Object)
      );
    });
  });
});
