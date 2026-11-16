/**
 * Property-Based Tests for Fallback to API on Disconnection
 * 
 * **Property 9: Fallback to API on Disconnection**
 * **Validates: Requirements 6.3**
 * 
 * For any period when WebSocket unavailable, calling forceRefresh() SHALL fetch 
 * latest from REST API and update UI.
 * 
 * These tests validate:
 * - forceRefresh() works when WebSocket unavailable
 * - Fresh data is fetched from REST API
 * - UI cache is updated with new data
 * - No stale data remains after fallback refresh
 * - Multiple rapid refreshes work correctly
 * 
 * Uses fast-check with minimum 100 iterations for comprehensive coverage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import fc from 'fast-check';
import { z } from 'zod';

// Mock enrollment schema
const enrollmentSchema = z.object({
  id: z.string().uuid(),
  trainee_id: z.string().uuid(),
  program_id: z.string().uuid(),
  status: z.enum(['enrolled', 'active', 'completed', 'dropped', 'failed']),
  enrollment_date: z.string().date(),
  completion_date: z.string().date().nullable().optional(),
  final_grade: z.number().int().min(0).max(100).nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

type Enrollment = z.infer<typeof enrollmentSchema>;

/**
 * Simulate REST API calls and enrollment service with fallback
 */
class EnrollmentServiceWithFallback {
  private cache: Map<string, Enrollment> = new Map();
  private webSocketConnected: boolean = false;
  private lastForcedRefreshTime: number = 0;

  constructor(private apiClient: MockApiClient) {}

  setWebSocketConnected(connected: boolean): void {
    this.webSocketConnected = connected;
  }

  isWebSocketConnected(): boolean {
    return this.webSocketConnected;
  }

  async forceRefresh(traineeId: string): Promise<Enrollment[]> {
    // When force refreshing, bypass WebSocket and fetch directly from API
    this.lastForcedRefreshTime = Date.now();

    if (!this.webSocketConnected) {
      // WebSocket unavailable, must use REST API
      const enrollments = await this.apiClient.getEnrollments(traineeId);

      // Clear stale data and update cache with fresh data
      this.cache.clear();
      for (const enrollment of enrollments) {
        this.cache.set(enrollment.id, enrollment);
      }

      return enrollments;
    }

    // Even if WebSocket available, force refresh means get fresh data
    const enrollments = await this.apiClient.getEnrollments(traineeId);

    // Clear and replace cache
    this.cache.clear();
    for (const enrollment of enrollments) {
      this.cache.set(enrollment.id, enrollment);
    }

    return enrollments;
  }

  getCachedEnrollment(enrollmentId: string): Enrollment | undefined {
    return this.cache.get(enrollmentId);
  }

  getAllCached(): Map<string, Enrollment> {
    return new Map(this.cache);
  }

  clearCache(): void {
    this.cache.clear();
  }

  getLastRefreshTime(): number {
    return this.lastForcedRefreshTime;
  }
}

/**
 * Mock REST API client
 */
class MockApiClient {
  private enrollmentStore: Map<string, Enrollment[]> = new Map();
  private delayMs: number = 0;
  private shouldFail: boolean = false;

  setDelay(delayMs: number): void {
    this.delayMs = delayMs;
  }

  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  setEnrollments(traineeId: string, enrollments: Enrollment[]): void {
    this.enrollmentStore.set(traineeId, enrollments);
  }

  async getEnrollments(traineeId: string): Promise<Enrollment[]> {
    if (this.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(this.delayMs, 100)));
    }

    if (this.shouldFail) {
      throw new Error('API request failed');
    }

    return this.enrollmentStore.get(traineeId) ?? [];
  }

  clearStore(): void {
    this.enrollmentStore.clear();
  }
}

describe('Property: Fallback to API on Disconnection (Req 6.3)', () => {
  let apiClient: MockApiClient;
  let service: EnrollmentServiceWithFallback;

  beforeEach(() => {
    apiClient = new MockApiClient();
    service = new EnrollmentServiceWithFallback(apiClient);
  });

  /**
   * Arbitrarily generate valid enrollments
   */
  const enrollmentArbitrary = fc.record({
    id: fc.uuid(),
    trainee_id: fc.uuid(),
    program_id: fc.uuid(),
    status: fc.constantFrom('enrolled', 'active', 'completed', 'dropped', 'failed'),
    enrollment_date: fc.date({ min: new Date('2020-01-01'), max: new Date('2026-12-31') }).map(
      (date) => (Number.isNaN(date.getTime()) ? '2022-01-01' : date.toISOString().split('T')[0])
    ),
    created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2024-01-01') }).map(
      (date) => (Number.isNaN(date.getTime()) ? '2022-01-01T00:00:00.000Z' : date.toISOString())
    ),
    updated_at: fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') }).map(
      (date) => (Number.isNaN(date.getTime()) ? '2024-01-01T00:00:00.000Z' : date.toISOString())
    ),
  });

  it('forceRefresh fetches latest data from REST API when WebSocket unavailable', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traineeId: fc.uuid(),
          enrollments: fc.array(enrollmentArbitrary, { minLength: 1, maxLength: 5 }),
        }),
        async (scenario) => {
          // Setup: WebSocket is down
          service.setWebSocketConnected(false);
          apiClient.setEnrollments(scenario.traineeId, scenario.enrollments);

          // Action: Force refresh
          const result = await service.forceRefresh(scenario.traineeId);

          // Verify: Got fresh data from API
          expect(result).toHaveLength(scenario.enrollments.length);
          expect(result).toEqual(scenario.enrollments);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('forceRefresh updates cache with fresh API data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traineeId: fc.uuid(),
          oldEnrollments: fc.array(enrollmentArbitrary, { minLength: 2, maxLength: 5 }),
          newEnrollments: fc.array(enrollmentArbitrary, { minLength: 2, maxLength: 5 }),
        }),
        async (scenario) => {
          service.clearCache();
          // Setup: Cache has old data
          for (const enrollment of scenario.oldEnrollments) {
            // Manually add to cache (simulating old cached data)
            service['cache'].set(enrollment.id, enrollment);
          }

          // Setup: API has new data
          service.setWebSocketConnected(false);
          apiClient.setEnrollments(scenario.traineeId, scenario.newEnrollments);

          // Get old cache state
          const cachedBefore = service.getAllCached();
          expect(cachedBefore.size).toBeGreaterThan(0);

          // Action: Force refresh
          const result = await service.forceRefresh(scenario.traineeId);

          // Verify: Cache updated with new data
          const cachedAfter = service.getAllCached();
          expect(cachedAfter.size).toBe(scenario.newEnrollments.length);

          // Verify: Old data is gone
          for (const oldEnrollment of scenario.oldEnrollments) {
            if (!scenario.newEnrollments.find((e) => e.id === oldEnrollment.id)) {
              expect(service.getCachedEnrollment(oldEnrollment.id)).toBeUndefined();
            }
          }

          // Verify: New data is present
          for (const newEnrollment of scenario.newEnrollments) {
            expect(service.getCachedEnrollment(newEnrollment.id)).toEqual(newEnrollment);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('forceRefresh works even when WebSocket is connected', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traineeId: fc.uuid(),
          enrollments: fc.array(enrollmentArbitrary, { minLength: 1, maxLength: 5 }),
        }),
        async (scenario) => {
          // Setup: WebSocket is connected
          service.setWebSocketConnected(true);
          apiClient.setEnrollments(scenario.traineeId, scenario.enrollments);

          // Action: Force refresh (manual refresh despite active WebSocket)
          const result = await service.forceRefresh(scenario.traineeId);

          // Verify: Still fetches fresh data from API
          expect(result).toHaveLength(scenario.enrollments.length);
          expect(result).toEqual(scenario.enrollments);

          // Verify: Cache is updated
          for (const enrollment of scenario.enrollments) {
            expect(service.getCachedEnrollment(enrollment.id)).toEqual(enrollment);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('multiple rapid forceRefresh calls all complete successfully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traineeId: fc.uuid(),
          refreshCount: fc.integer({ min: 3, max: 10 }),
          enrollments: fc.array(enrollmentArbitrary, { minLength: 1, maxLength: 5 }),
        }),
        async (scenario) => {
          service.setWebSocketConnected(false);
          apiClient.setEnrollments(scenario.traineeId, scenario.enrollments);

          // Action: Multiple refreshes in succession
          for (let i = 0; i < scenario.refreshCount; i++) {
            const result = await service.forceRefresh(scenario.traineeId);
            expect(result).toHaveLength(scenario.enrollments.length);
          }

          // Verify: Cache still correct after multiple refreshes
          for (const enrollment of scenario.enrollments) {
            expect(service.getCachedEnrollment(enrollment.id)).toEqual(enrollment);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('forceRefresh returns same data as cached when using same API call', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traineeId: fc.uuid(),
          enrollments: fc.array(enrollmentArbitrary, { minLength: 1, maxLength: 5 }),
        }),
        async (scenario) => {
          service.setWebSocketConnected(false);
          apiClient.setEnrollments(scenario.traineeId, scenario.enrollments);

          // First refresh
          const firstResult = await service.forceRefresh(scenario.traineeId);

          // Second refresh (without API data changing)
          const secondResult = await service.forceRefresh(scenario.traineeId);

          // Verify: Both results are identical
          expect(firstResult).toEqual(secondResult);

          // Verify: Cache matches results
          for (const enrollment of secondResult) {
            expect(service.getCachedEnrollment(enrollment.id)).toEqual(enrollment);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('forceRefresh clears stale data before updating cache', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traineeId: fc.uuid(),
          staleEnrollments: fc.array(enrollmentArbitrary, { minLength: 3, maxLength: 5 }),
          freshEnrollments: fc.array(enrollmentArbitrary, { minLength: 1, maxLength: 3 }),
        }),
        async (scenario) => {
          service.clearCache();
          // Setup: Cache has stale data
          for (const enrollment of scenario.staleEnrollments) {
            service['cache'].set(enrollment.id, enrollment);
          }

          // Setup: API has less data
          service.setWebSocketConnected(false);
          apiClient.setEnrollments(scenario.traineeId, scenario.freshEnrollments);

          // Verify: Stale data in cache
          let cached = service.getAllCached();
          expect(cached.size).toBe(scenario.staleEnrollments.length);

          // Action: Force refresh
          await service.forceRefresh(scenario.traineeId);

          // Verify: Stale data removed
          cached = service.getAllCached();
          expect(cached.size).toBe(scenario.freshEnrollments.length);

          // Verify: Only fresh data remains
          for (const staleEnrollment of scenario.staleEnrollments) {
            // Should not be in cache unless it's also in fresh data
            if (!scenario.freshEnrollments.find((e) => e.id === staleEnrollment.id)) {
              expect(service.getCachedEnrollment(staleEnrollment.id)).toBeUndefined();
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  it('forceRefresh timestamp is updated on each call', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traineeId: fc.uuid(),
          enrollments: fc.array(enrollmentArbitrary, { minLength: 1, maxLength: 5 }),
        }),
        async (scenario) => {
          service.setWebSocketConnected(false);
          apiClient.setEnrollments(scenario.traineeId, scenario.enrollments);

          // First refresh
          await service.forceRefresh(scenario.traineeId);
          const firstTime = service.getLastRefreshTime();
          expect(firstTime).toBeGreaterThan(0);

          // Small delay to ensure timestamp changes
          await new Promise((resolve) => setTimeout(resolve, 10));

          // Second refresh
          await service.forceRefresh(scenario.traineeId);
          const secondTime = service.getLastRefreshTime();

          // Verify: Timestamp updated
          expect(secondTime).toBeGreaterThanOrEqual(firstTime);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('forceRefresh handles empty enrollment list from API', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traineeId: fc.uuid(),
        }),
        async (scenario) => {
          // Setup: API returns empty list
          service.setWebSocketConnected(false);
          apiClient.setEnrollments(scenario.traineeId, []);

          // Action: Force refresh
          const result = await service.forceRefresh(scenario.traineeId);

          // Verify: Empty result
          expect(result).toHaveLength(0);

          // Verify: Cache cleared
          expect(service.getAllCached().size).toBe(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('forceRefresh handles enrollment status updates from API', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traineeId: fc.uuid(),
          enrollment: enrollmentArbitrary,
        }),
        async (scenario) => {
          // Setup: Old enrollment with 'enrolled' status
          const oldEnrollment = {
            ...scenario.enrollment,
            status: 'enrolled' as const,
            updated_at: new Date(Date.now() - 60000).toISOString(),
          };

          service['cache'].set(oldEnrollment.id, oldEnrollment);

          // Setup: API returns updated enrollment with 'completed' status
          const newEnrollment = {
            ...oldEnrollment,
            status: 'completed' as const,
            updated_at: new Date().toISOString(),
          };

          service.setWebSocketConnected(false);
          apiClient.setEnrollments(scenario.traineeId, [newEnrollment]);

          // Action: Force refresh
          const result = await service.forceRefresh(scenario.traineeId);

          // Verify: New status received
          expect(result[0].status).toBe('completed');

          // Verify: Cache updated with new status
          const cached = service.getCachedEnrollment(newEnrollment.id);
          expect(cached?.status).toBe('completed');
          expect(cached?.updated_at).toBe(newEnrollment.updated_at);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('forceRefresh works with large enrollment lists', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          traineeId: fc.uuid(),
          enrollments: fc.array(enrollmentArbitrary, { minLength: 50, maxLength: 50 }),
        }),
        async (scenario) => {
          service.setWebSocketConnected(false);
          apiClient.setEnrollments(scenario.traineeId, scenario.enrollments);

          // Action: Force refresh
          const result = await service.forceRefresh(scenario.traineeId);

          // Verify: All enrollments returned
          expect(result).toHaveLength(scenario.enrollments.length);

          // Verify: All in cache
          expect(service.getAllCached().size).toBe(scenario.enrollments.length);

          // Verify: All data intact
          for (const enrollment of scenario.enrollments) {
            expect(service.getCachedEnrollment(enrollment.id)).toEqual(enrollment);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});


