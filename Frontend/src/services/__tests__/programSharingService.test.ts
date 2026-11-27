import { describe, it, expect, vi, beforeEach } from 'vitest';
import programSharingService from '../programSharingService';
import api from '../api';

vi.mock('../api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('programSharingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes snake_case verify-access response (can_access / has_enrolled) to camelCase', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        can_access: true,
        has_enrolled: false,
      },
    } as any);

    const result = await programSharingService.verifyProgramAccess('prog-1', 'user-1');

    expect(result).toEqual({
      canAccess: true,
      hasEnrolled: false,
      reason: undefined,
    });
  });

  it('normalizes already-enrolled snake_case response cleanly', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: {
        can_access: false,
        has_enrolled: true,
        reason: 'Trainee is already enrolled',
      },
    } as any);

    const result = await programSharingService.verifyProgramAccess('prog-1', 'user-1');

    expect(result.canAccess).toBe(false);
    expect(result.hasEnrolled).toBe(true);
    expect(result.reason).toBe('Trainee is already enrolled');
  });
});
