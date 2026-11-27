import { useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import logger from '../utils/logger';

export interface ArchiveFilters {
  entityType: string;
  search: string;
  page: number;
  limit: number;
}

export interface ArchivedItem {
  id: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  role?: string;
  email?: string;
  name?: string;
  file_name?: string;
  deleted_at: string;
  daysSinceDeleted: number;
  daysRemaining: number;
  eligibleForPurge: boolean;
  eligible_for_purge?: boolean;
  days_remaining?: number;
}

export interface ArchiveResponse {
  success: boolean;
  data: ArchivedItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface UseArchiveFiltersResult {
  items: ArchivedItem[];
  loading: boolean;
  error: string | null;
  filters: ArchiveFilters;
  setFilters: (filters: Partial<ArchiveFilters>) => void;
  refetch: () => Promise<void>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useArchiveFilters(): UseArchiveFiltersResult {
  const [filters, setFiltersState] = useState<ArchiveFilters>({
    entityType: 'trainee', // Default to trainee
    search: '',
    page: 1,
    limit: 20,
  });

  const [items, setItems] = useState<ArchivedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  const fetchArchive = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!filters.entityType) {
        setError('Please select an entity type to view archived items');
        setItems([]);
        setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 });
        return;
      }

      const params = new URLSearchParams();
      params.append('entityType', filters.entityType);
      if (filters.search) params.append('search', filters.search);
      params.append('page', String(filters.page));
      params.append('limit', String(filters.limit));

      console.log('[useArchiveFilters] Fetching archive with params:', params.toString());
      const response = await api.get<ArchiveResponse>(`/archive?${params.toString()}`);
      
      // The API returns { success: true, data: [...], pagination: {...} }
      // But axios wraps it, so response.data contains the server response body
      const body = response.data; // This is the server response: { success, data, pagination }
      
      console.log('[useArchiveFilters] Server response body:', body);
      console.log('[useArchiveFilters] Type of body:', typeof body);
      console.log('[useArchiveFilters] Is array?', Array.isArray(body));
      
      if (Array.isArray(body)) {
        // The frontend is receiving an array directly, not the wrapped response
        // This means axios/the API is returning the array as response.data
        console.warn('[useArchiveFilters] Received array directly as response.data');
        setItems(body);
        setPagination({
          page: filters.page,
          limit: filters.limit,
          total: body.length,
          totalPages: 1
        });
        return;
      }
      
      // Normal case: body is { success, data, pagination }
      setItems(body.data || []);
      setPagination(body.pagination);
      console.log('[useArchiveFilters] Successfully set', body.data?.length, 'items');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch archived items';
      console.error('[useArchiveFilters] Error:', message, err);
      logger.error('Archive fetch failed', { error: message });
      setError(message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchArchive();
    }, 300);

    return () => clearTimeout(timer);
  }, [filters, fetchArchive]);

  const setFilters = useCallback((newFilters: Partial<ArchiveFilters>) => {
    setFiltersState((prev) => {
      // Reset to page 1 when entityType or search changes
      const shouldResetPage = newFilters.entityType !== undefined || newFilters.search !== undefined;
      return {
        ...prev,
        ...newFilters,
        page: shouldResetPage ? 1 : newFilters.page || prev.page,
      };
    });
  }, []);

  return {
    items,
    loading,
    error,
    filters,
    setFilters,
    refetch: fetchArchive,
    pagination,
  };
}
