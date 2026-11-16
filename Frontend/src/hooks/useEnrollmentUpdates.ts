import { useState, useEffect, useCallback } from 'react';
import {
  enrollmentService,
  Enrollment,
  ConnectionStatus,
  EnrollmentUpdateCallback,
} from '../services/enrollmentService';

/**
 * Response object returned by useEnrollmentUpdates hook
 */
export interface UseEnrollmentUpdatesResult {
  /** Array of enrollments for the trainee */
  enrollments: Enrollment[];
  /** Current connection status of WebSocket or REST API fallback */
  connectionStatus: ConnectionStatus;
  /** Whether enrollments are currently being fetched */
  loading: boolean;
  /** Error message if enrollment fetch failed */
  error: string | null;
  /** Manually refresh enrollments from REST API */
  forceRefresh: () => Promise<void>;
  /** Manually refetch enrollments immediately */
  refetch: () => Promise<void>;
}

/**
 * Hook for subscribing to enrollment updates via WebSocket or fallback to REST API.
 *
 * This hook manages real-time enrollment updates by:
 * 1. Fetching initial enrollments for the trainee
 * 2. Subscribing to WebSocket enrollment updates
 * 3. Updating local state when WebSocket events are received
 * 4. Providing connection status information
 * 5. Handling errors gracefully with fallback to REST API
 *
 * **Validates: Requirements 4.4, 13.1**
 *
 * @param traineeId - The ID of the trainee to fetch enrollments for
 * @returns Object containing enrollments, connection status, loading state, and control methods
 *
 * @example
 * ```tsx
 * const { enrollments, connectionStatus, loading, error, forceRefresh } = useEnrollmentUpdates(traineeId);
 *
 * if (loading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 *
 * return (
 *   <div>
 *     {connectionStatus === 'connected' && <span>✓ Connected</span>}
 *     {connectionStatus === 'reconnecting' && <span>⟳ Reconnecting...</span>}
 *     {connectionStatus === 'disconnected' && <span>✗ Offline</span>}
 *     {enrollments.map(e => <EnrollmentCard key={e.id} enrollment={e} />)}
 *   </div>
 * );
 * ```
 */
export function useEnrollmentUpdates(traineeId: string): UseEnrollmentUpdatesResult {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() => {
    try {
      return enrollmentService.getConnectionStatus() || 'connecting';
    } catch {
      return 'connecting';
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Handle enrollment updates from WebSocket events
   * This callback is registered with the enrollmentService and called whenever:
   * - An enrollment is updated (enrollment-updated event)
   * - An enrollment is added (enrollment-added event)
   * - An enrollment is removed (enrollment-removed event)
   */
  const handleEnrollmentUpdate = useCallback<EnrollmentUpdateCallback>((event) => {
    if (event.type === 'updated' && event.enrollment) {
      // Update the enrollment in the list
      setEnrollments((prev) =>
        prev.map((e) => (e.id === event.enrollment!.id ? event.enrollment! : e))
      );
    } else if (event.type === 'added' && event.enrollment) {
      // Add the new enrollment to the list
      setEnrollments((prev) => [...prev, event.enrollment!]);
    } else if (event.type === 'removed' && event.enrollmentId) {
      // Remove the enrollment from the list
      setEnrollments((prev) => prev.filter((e) => e.id !== event.enrollmentId));
    }
  }, []);

  /**
   * Fetch enrollments from the service
   * This handles both initial load and manual refreshes
   */
  const fetchEnrollments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await enrollmentService.fetchEnrollments(traineeId);
      setEnrollments(data);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch enrollments';
      setError(errorMessage);
      if (errorMessage.toLowerCase().includes('validation') || errorMessage.toLowerCase().includes('zod error')) {
        console.error('[Validation Error] Enrollment data validation failed:', {
          error: errorMessage,
          timestamp: new Date().toISOString(),
          traineeId,
        });
      }
      console.error('[useEnrollmentUpdates] Failed to fetch enrollments:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [traineeId]);

  /**
   * Force refresh enrollments from REST API
   * Bypasses cache and WebSocket, fetches directly from API
   */
  const handleForceRefresh = useCallback(async () => {
    try {
      setError(null);
      const data = await enrollmentService.forceRefresh(traineeId);
      setEnrollments(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh enrollments';
      setError(errorMessage);
      console.error('[useEnrollmentUpdates] Force refresh failed:', errorMessage);
    }
  }, [traineeId]);

  /**
   * Refetch enrollments immediately
   */
  const handleRefetch = useCallback(async () => {
    await fetchEnrollments();
  }, [fetchEnrollments]);

  /**
   * Effect: Fetch initial enrollments and subscribe to updates
   * Dependencies: [traineeId, fetchEnrollments, handleEnrollmentUpdate]
   *
   * On mount:
   * - Fetches initial enrollments for the trainee
   * - Registers update callback with enrollmentService
   * - Polls connection status periodically
   *
   * On cleanup:
   * - Unregisters update callback
   * - Stops connection status polling
   */
  useEffect(() => {
    if (!traineeId) return;

    // Fetch initial enrollments
    fetchEnrollments();

    // Subscribe to enrollment updates from WebSocket
    const unsubscribe = enrollmentService.setEnrollmentUpdateHandler(handleEnrollmentUpdate);

    // Poll connection status to keep it up to date
    const statusInterval = setInterval(() => {
      const status = enrollmentService.getConnectionStatus();
      setConnectionStatus(status);
    }, 1000); // Update every second to catch status changes

    return () => {
      // Unsubscribe from updates
      if (unsubscribe) {
        unsubscribe();
      }

      // Stop polling connection status
      clearInterval(statusInterval);
    };
  }, [traineeId, fetchEnrollments, handleEnrollmentUpdate]);

  return {
    enrollments,
    connectionStatus,
    loading,
    error,
    forceRefresh: handleForceRefresh,
    refetch: handleRefetch,
  };
}
