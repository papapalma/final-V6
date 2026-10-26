import { isAuthRateLimitDisabled } from '@/utils/rateLimit';

describe('Authentication Rate Limit Bypass', () => {
  const originalEnv = process.env.DISABLE_AUTH_RATE_LIMIT;

  afterEach(() => {
    process.env.DISABLE_AUTH_RATE_LIMIT = originalEnv;
  });

  describe('isAuthRateLimitDisabled()', () => {
    it('should return true by default when env var is not set', () => {
      delete process.env.DISABLE_AUTH_RATE_LIMIT;
      expect(isAuthRateLimitDisabled()).toBe(true);
    });

    it('should return true when env var is explicitly set to "true"', () => {
      process.env.DISABLE_AUTH_RATE_LIMIT = 'true';
      expect(isAuthRateLimitDisabled()).toBe(true);
    });

    it('should return false when env var is explicitly set to "false"', () => {
      process.env.DISABLE_AUTH_RATE_LIMIT = 'false';
      expect(isAuthRateLimitDisabled()).toBe(false);
    });
  });
});
