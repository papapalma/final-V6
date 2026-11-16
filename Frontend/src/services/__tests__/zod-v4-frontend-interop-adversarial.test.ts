import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { enrollmentService } from '../enrollmentService';
import api from '../api';
import { parseValidationError, validateTraineeStatus } from '../../types/traineeStatus';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock('../websocket-client', () => ({
  websocketClient: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    onEnrollmentUpdated: vi.fn(() => () => {}),
    onEnrollmentAdded: vi.fn(() => () => {}),
    onEnrollmentRemoved: vi.fn(() => () => {}),
    getConnectionStatus: vi.fn(() => 'connected'),
  },
}));

describe('Adversarial Frontend Zod v4 Interoperability Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enrollmentService.clearCache();
  });

  describe('enrollmentService error handling under Zod v4 schema failures', () => {
    it('fetchEnrollments catches Zod v4 validation errors and formats message without crashing', async () => {
      // Mock API returning invalid enrollment object (e.g., status is an invalid enum value)
      vi.mocked(api.get).mockResolvedValue({
        data: {
          data: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              trainee_id: '550e8400-e29b-41d4-a716-446655440001',
              program_id: '550e8400-e29b-41d4-a716-446655440002',
              status: 'NON_EXISTENT_STATUS', // Invalid enum
              enrollment_date: '2024-01-15',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        },
      });

      await expect(enrollmentService.fetchEnrollments('550e8400-e29b-41d4-a716-446655440001'))
        .rejects
        .toThrow(/Enrollment data validation failed/);
    });

    it('getEnrollment catches Zod v4 validation errors and formats message without crashing', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: {
          data: {
            id: 'not-a-uuid',
            trainee_id: 'not-a-uuid',
            program_id: 'not-a-uuid',
            status: 'enrolled',
            enrollment_date: 'invalid-date',
            created_at: 'bad-date',
            updated_at: 'bad-date',
          },
        },
      });

      await expect(enrollmentService.getEnrollment('any-id'))
        .rejects
        .toThrow(/Enrollment data validation failed/);
    });

    it('updateStatus catches invalid payload errors before network request', async () => {
      // Invalid status
      const invalidPayload: any = {
        status: 'invalid_status',
      };

      await expect(
        enrollmentService.updateStatus('550e8400-e29b-41d4-a716-446655440000', invalidPayload)
      )
        .rejects
        .toThrow(/Enrollment data validation failed/);

      expect(api.patch).not.toHaveBeenCalled();
    });

    it('forceRefresh handles corrupted data cleanly', async () => {
      vi.mocked(api.get).mockResolvedValue({
        data: {
          data: [{ completely: 'wrong_shape' }],
        },
      });

      await expect(enrollmentService.forceRefresh('550e8400-e29b-41d4-a716-446655440001'))
        .rejects
        .toThrow(/Enrollment data validation failed/);
    });
  });

  describe('traineeStatus Zod v4 validation and parseValidationError', () => {
    it('parseValidationError correctly maps issues array from ZodError', () => {
      const dummySchema = z.object({
        fieldA: z.string().min(5, 'fieldA too short'),
        fieldB: z.number().max(10, 'fieldB too large'),
      });

      const result = dummySchema.safeParse({ fieldA: 'abc', fieldB: 20 });
      expect(result.success).toBe(false);

      if (!result.success) {
        const errorMap = parseValidationError(result.error);
        expect(errorMap.fieldA).toBe('fieldA too short');
        expect(errorMap.fieldB).toBe('fieldB too large');
      }
    });

    it('parseValidationError gracefully handles legacy error objects with .errors', () => {
      const legacyMockError = {
        issues: undefined,
        errors: [
          { path: ['legacyField'], message: 'Legacy error message' },
        ],
      };

      const errorMap = parseValidationError(legacyMockError as any);
      expect(errorMap.legacyField).toBe('Legacy error message');
    });

    it('validateTraineeStatus returns structured errors for missing required fields', () => {
      const validation = validateTraineeStatus({
        // Empty object missing required enrollment_id, graduation_status, etc.
      });

      expect(validation.success).toBe(false);
      expect(typeof validation.errors).toBe('object');
      expect(Object.keys(validation.errors).length).toBeGreaterThan(0);
    });
  });
});
