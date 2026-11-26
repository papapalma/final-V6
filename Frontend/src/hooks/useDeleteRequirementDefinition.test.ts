import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useDeleteRequirementDefinition } from './useDeleteRequirementDefinition';
import api from '../services/api';

vi.mock('../services/api');
vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('useDeleteRequirementDefinition', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  it('calls DELETE /requirement-definitions/:id and invalidates caches', async () => {
    const deletedPayload = { id: 'req-001', deleted_at: '2026-11-26T00:00:00Z' };
    (api.delete as any).mockResolvedValue({ success: true, data: deletedPayload });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');

    const { result } = renderHook(() => useDeleteRequirementDefinition(), { wrapper });

    let response: any;
    await act(async () => {
      response = await result.current.mutateAsync('req-001');
    });

    expect(api.delete).toHaveBeenCalledWith('/requirement-definitions/req-001');
    expect(response).toEqual(deletedPayload);
    expect(removeSpy).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('throws friendly permission error on 403', async () => {
    (api.delete as any).mockRejectedValue({ status: 403, message: '403 Forbidden' });

    const { result } = renderHook(() => useDeleteRequirementDefinition(), { wrapper });

    await expect(result.current.mutateAsync('req-001')).rejects.toThrow(/permission/i);
  });

  it('rejects empty requirement ID', async () => {
    const { result } = renderHook(() => useDeleteRequirementDefinition(), { wrapper });

    await expect(result.current.mutateAsync('')).rejects.toThrow(/Requirement ID is required/i);
  });
});
