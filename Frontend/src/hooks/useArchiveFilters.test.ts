import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useArchiveFilters } from './useArchiveFilters';
import api from '../services/api';

vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('useArchiveFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default filters', async () => {
    const mockData = {
      data: {
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      },
    };

    vi.mocked(api.get).mockResolvedValue(mockData);

    const { result } = renderHook(() => useArchiveFilters());

    expect(result.current.filters).toEqual({
      entityType: 'trainee',
      search: '',
      page: 1,
      limit: 20,
    });
  });

  it('setFilters updates state correctly', () => {
    const mockData = {
      data: {
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      },
    };

    vi.mocked(api.get).mockResolvedValue(mockData);

    const { result } = renderHook(() => useArchiveFilters());

    act(() => {
      result.current.setFilters({ entityType: 'trainee' });
    });

    expect(result.current.filters.entityType).toBe('trainee');
  });

  it('resets page to 1 when filters change', () => {
    const mockData = {
      data: {
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      },
    };

    vi.mocked(api.get).mockResolvedValue(mockData);

    const { result } = renderHook(() => useArchiveFilters());

    act(() => {
      result.current.setFilters({ page: 2 });
    });

    expect(result.current.filters.page).toBe(2);

    act(() => {
      result.current.setFilters({ search: 'test' });
    });

    expect(result.current.filters.page).toBe(1);
  });
});
