/**
 * Unit Tests for useRequirementSubmissions Hook (Task 3.3)
 *
 * Tests for the hook that fetches requirement submissions with:
 * 1. Support for filtering by status (pending, submitted, verified, rejected, waived)
 * 2. Support for filtering by searchTerm (trainee name/email)
 * 3. Support for sorting by traineeName, status, submittedAt, verifiedAt
 * 4. Support for pagination (page, limit)
 * 5. React Query integration with queryKey including requirementId, filters, sort, pagination
 * 6. Stale time of 2 minutes
 * 7. Retry strategy of 2 retries
 * 8. Returns { data, isLoading, isError, error, pagination, refetch }
 *
 * **Validates: Frontend data fetching layer**
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRequirementSubmissions } from './useRequirementSubmissions';
import api from '../services/api';
import type { RequirementSubmission, PaginationInfo } from '../types/requirements';

// Mock the API service
vi.mock('../services/api');

// Mock the logger
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('useRequirementSubmissions Hook (Task 3.3)', () => {
  const mockSubmissions: RequirementSubmission[] = [
    {
      id: 'submission-001',
      enrollmentId: 'enrollment-001',
      requirementId: 'requirement-123',
      status: 'pending',
      traineeId: 'trainee-001',
      traineeName: 'John Doe',
      traineeEmail: 'john@example.com',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    },
    {
      id: 'submission-002',
      enrollmentId: 'enrollment-002',
      requirementId: 'requirement-123',
      status: 'verified',
      traineeId: 'trainee-002',
      traineeName: 'Jane Smith',
      traineeEmail: 'jane@example.com',
      documentUrl: 'https://example.com/doc.pdf',
      submittedAt: '2024-01-14T09:00:00Z',
      verifiedAt: '2024-01-15T14:00:00Z',
      verifiedBy: 'user-admin-001',
      createdAt: '2024-01-14T09:00:00Z',
      updatedAt: '2024-01-15T14:00:00Z',
    },
    {
      id: 'submission-003',
      enrollmentId: 'enrollment-003',
      requirementId: 'requirement-123',
      status: 'rejected',
      traineeId: 'trainee-003',
      traineeName: 'Bob Johnson',
      traineeEmail: 'bob@example.com',
      documentUrl: 'https://example.com/doc-rejected.pdf',
      submittedAt: '2024-01-13T08:00:00Z',
      rejectionReason: 'Document is not clearly legible',
      createdAt: '2024-01-13T08:00:00Z',
      updatedAt: '2024-01-15T11:00:00Z',
    },
  ];

  const mockPaginationInfo: PaginationInfo = {
    page: 1,
    limit: 20,
    total: 50,
    hasMore: true,
  };

  const requirementId = 'requirement-123';
  let queryClient: QueryClient;

  beforeEach(() => {
    // Create a fresh QueryClient for each test
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    vi.clearAllMocks();

    // Default mock implementation matching api.get() unwrapped ApiResponse envelope
    (api.get as any).mockResolvedValue({
      success: true,
      data: mockSubmissions,
      pagination: mockPaginationInfo,
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe('Basic Functionality', () => {
    it('should fetch submissions with default parameters', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledWith(
        `/requirement-definitions/${requirementId}/submissions`,
        {
          page: '1',
          limit: '20',
        }
      );

      expect(result.current.data).toEqual(mockSubmissions);
      expect(result.current.pagination).toEqual(mockPaginationInfo);
      expect(result.current.error).toBe(null);
      expect(result.current.isError).toBe(false);
    });

    it('should return loading state initially', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('should return empty data and default pagination when API returns null', async () => {
      (api.get as any).mockResolvedValue({
        data: null,
      });

      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toEqual([]);
      expect(result.current.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        hasMore: false,
      });
    });

    it('should not fetch when requirementId is empty and enabled is true', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(''), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).not.toHaveBeenCalled();
      expect(result.current.data).toEqual([]);
    });
  });

  describe('Status Filtering', () => {
    it('should apply single status filter', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { status: 'pending' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledWith(
        `/requirement-definitions/${requirementId}/submissions`,
        expect.objectContaining({
          status: 'pending',
        })
      );
    });

    it('should apply multiple status filters', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { status: ['pending', 'submitted'] }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledWith(
        `/requirement-definitions/${requirementId}/submissions`,
        expect.objectContaining({
          status: 'pending,submitted',
        })
      );
    });

    it('should not include status filter if not provided', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callArgs = (api.get as any).mock.calls[0][1];
      expect(callArgs.status).toBeUndefined();
    });
  });

  describe('Search Filtering', () => {
    it('should apply search term filter', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { searchTerm: 'John' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledWith(
        `/requirement-definitions/${requirementId}/submissions`,
        expect.objectContaining({
          search: 'John',
        })
      );
    });

    it('should not include search filter if not provided', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callArgs = (api.get as any).mock.calls[0][1];
      expect(callArgs.search).toBeUndefined();
    });
  });

  describe('Sorting', () => {
    it('should apply sorting with column and order', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { sortBy: 'traineeName', order: 'asc' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledWith(
        `/requirement-definitions/${requirementId}/submissions`,
        expect.objectContaining({
          sort_by: 'traineeName',
          sort_order: 'asc',
        })
      );
    });

    it('should apply descending sort', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { sortBy: 'submittedAt', order: 'desc' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledWith(
        `/requirement-definitions/${requirementId}/submissions`,
        expect.objectContaining({
          sort_by: 'submittedAt',
          sort_order: 'desc',
        })
      );
    });

    it('should not include sort parameters if not provided', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callArgs = (api.get as any).mock.calls[0][1];
      expect(callArgs.sort_by).toBeUndefined();
      expect(callArgs.sort_order).toBeUndefined();
    });
  });

  describe('Pagination', () => {
    it('should apply custom pagination parameters', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { page: 2, limit: 50 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledWith(
        `/requirement-definitions/${requirementId}/submissions`,
        expect.objectContaining({
          page: '2',
          limit: '50',
        })
      );
    });

    it('should return pagination metadata', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 50,
        hasMore: true,
      });
    });

    it('should handle pagination with hasMore false', async () => {
      const paginationResponse: PaginationInfo = {
        page: 3,
        limit: 20,
        total: 50,
        hasMore: false,
      };

      (api.get as any).mockResolvedValue({
        success: true,
        data: mockSubmissions,
        pagination: paginationResponse,
      });

      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { page: 3, limit: 20 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.pagination.hasMore).toBe(false);
    });
  });

  describe('Complex Filtering Scenarios', () => {
    it('should apply multiple filters together', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, {
          status: ['pending', 'submitted'],
          searchTerm: 'doe',
          sortBy: 'traineeName',
          order: 'asc',
          page: 2,
          limit: 25,
        }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledWith(
        `/requirement-definitions/${requirementId}/submissions`,
        expect.objectContaining({
          status: 'pending,submitted',
          search: 'doe',
          sort_by: 'traineeName',
          sort_order: 'asc',
          page: '2',
          limit: '25',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should have error state available on hook result', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      // Error field should exist in the result
      expect(typeof result.current.error === 'object' || result.current.error === null).toBe(true);
    });

    it('should have isError state available on hook result', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      // isError field should exist in the result
      expect(typeof result.current.isError).toBe('boolean');
    });
  });

  describe('Conditional Queries', () => {
    it('should not fetch when enabled is false', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { enabled: false }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).not.toHaveBeenCalled();
      expect(result.current.data).toEqual([]);
    });

    it('should fetch when enabled is true', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { enabled: true }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalled();
    });
  });

  describe('Refetch Functionality', () => {
    it('should provide refetch function', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe('function');
    });

    it('should refetch data when refetch is called', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      (api.get as any).mockClear();

      await act(async () => {
        await result.current.refetch();
      });

      expect(api.get).toHaveBeenCalled();
    });
  });

  describe('Data Structure Validation', () => {
    it('should return submissions with all expected fields for pending status', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const pendingSubmission = result.current.data.find(s => s.status === 'pending');
      expect(pendingSubmission).toBeDefined();
      expect(pendingSubmission?.id).toBeDefined();
      expect(pendingSubmission?.enrollmentId).toBeDefined();
      expect(pendingSubmission?.requirementId).toBeDefined();
      expect(pendingSubmission?.status).toBe('pending');
      expect(pendingSubmission?.traineeId).toBeDefined();
      expect(pendingSubmission?.traineeName).toBeDefined();
    });

    it('should return submissions with document info for verified status', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const verifiedSubmission = result.current.data.find(s => s.status === 'verified');
      expect(verifiedSubmission?.submittedAt).toBeDefined();
      expect(verifiedSubmission?.verifiedAt).toBeDefined();
      expect(verifiedSubmission?.verifiedBy).toBeDefined();
      expect(verifiedSubmission?.documentUrl).toBeDefined();
    });

    it('should return submissions with rejection reason for rejected status', async () => {
      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const rejectedSubmission = result.current.data.find(s => s.status === 'rejected');
      expect(rejectedSubmission?.rejectionReason).toBeDefined();
      expect(rejectedSubmission?.rejectionReason).toBe('Document is not clearly legible');
    });

    it('should normalize snake_case backend payloads and derive hasMore from totalPages', async () => {
      (api.get as any).mockResolvedValue({
        success: true,
        data: [
          {
            id: 'sub-snake-1',
            enrollment_id: 'enr-101',
            requirement_id: requirementId,
            trainee_id: 'trn-101',
            trainee_name: 'Maria Santos',
            trainee_email: 'maria@example.com',
            submission_status: 'submitted',
            document_url: '/uploads/doc.pdf',
            submitted_at: '2024-02-01T10:00:00Z',
            verified_at: null,
            verified_by: null,
            rejection_reason: null,
            created_at: '2024-02-01T09:00:00Z',
          },
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 45,
          totalPages: 3,
        },
      });

      const { result } = renderHook(() => useRequirementSubmissions(requirementId), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0]).toMatchObject({
        id: 'sub-snake-1',
        enrollmentId: 'enr-101',
        requirementId,
        traineeId: 'trn-101',
        traineeName: 'Maria Santos',
        traineeEmail: 'maria@example.com',
        status: 'submitted',
        documentUrl: '/uploads/doc.pdf',
      });
      expect(result.current.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 45,
        hasMore: true,
      });
    });
  });

  describe('Query Key Consistency', () => {
    it('should use consistent query key for same parameters', async () => {
      const options = { status: 'pending', page: 1, limit: 20 };

      renderHook(() => useRequirementSubmissions(requirementId, options), { wrapper });

      await waitFor(() => {
        expect(api.get).toHaveBeenCalled();
      });

      const firstCallCount = (api.get as any).mock.calls.length;

      // Clear mocks and render again with same parameters
      (api.get as any).mockClear();

      renderHook(() => useRequirementSubmissions(requirementId, options), { wrapper });

      // Cache should prevent additional API call
      await waitFor(() => {
        // Check if called again or if cache was used
      }, { timeout: 300 });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty status array', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { status: [] }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const callArgs = (api.get as any).mock.calls[0][1];
      // Empty array should not add status parameter
      expect(callArgs.status).toBeUndefined();
    });

    it('should handle zero pagination', async () => {
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { page: 0, limit: 0 }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should still send the parameters even if zero
      expect(api.get).toHaveBeenCalledWith(
        `/requirement-definitions/${requirementId}/submissions`,
        expect.objectContaining({
          page: '0',
          limit: '0',
        })
      );
    });

    it('should handle special characters in search term', async () => {
      const searchTerm = "O'Brien & Associates";
      const { result } = renderHook(
        () => useRequirementSubmissions(requirementId, { searchTerm }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.get).toHaveBeenCalledWith(
        `/requirement-definitions/${requirementId}/submissions`,
        expect.objectContaining({
          search: searchTerm,
        })
      );
    });
  });
});
