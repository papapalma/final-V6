/**
 * Unit Tests for Post-Auth Handler
 * 
 * Tests the logic of handling post-authentication routing with program context.
 * Validates: Requirements 4.1, 4.2, 4.3, 5.1
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  handlePostAuth,
  cleanupProgramReference,
  getProgramContext,
  setProgramContext,
} from '../postAuthHandler';
import { programSharingService } from '../../services/programSharingService';
import { logger } from '../logger';

// Mock the programSharingService
vi.mock('../../services/programSharingService', () => ({
  programSharingService: {
    verifyProgramAccess: vi.fn(),
  },
}));

// Mock the logger
vi.mock('../logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('postAuthHandler', () => {
  const mockUserId = 'user-123';
  const mockProgramId = 'prog-456';

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  /**
   * Test Suite: handlePostAuth Function
   * Tests the main logic of post-auth routing
   */
  describe('handlePostAuth', () => {
    /**
     * Test 1.1: Auth Context is Updated After Successful Login
     * Validates: Requirement 4.1
     */
    it('should redirect to program page when program is valid and permitted after login', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: true,
        hasEnrolled: false,
      });

      // Act
      const result = await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(result.targetPath).toBe(`/programs/${mockProgramId}`);
      expect(result.programId).toBe(mockProgramId);
      expect(result.permissionDenied).toBe(false);
      expect(programSharingService.verifyProgramAccess).toHaveBeenCalledWith(
        mockProgramId,
        mockUserId
      );
    });

    /**
     * Test 2.1: Program Context is Preserved During Login
     * Validates: Requirement 4.1
     */
    it('should preserve program context in localStorage during login', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: true,
      });

      // Act
      await handlePostAuth(mockUserId, 'login');

      // Assert - Program context should be checked but not removed
      expect(getProgramContext()).toBe(mockProgramId);
      expect(logger.debug).toHaveBeenCalledWith(
        'Program context found during post-auth',
        expect.objectContaining({
          userId: mockUserId,
          programId: mockProgramId,
        })
      );
    });

    /**
     * Test 3.1: Redirect to Program Detail Page Post-Login
     * Validates: Requirement 4.2
     */
    it('should redirect to correct program detail page with program ID in URL', async () => {
      // Arrange
      const programId = 'prog-789';
      setProgramContext(programId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: true,
      });

      // Act
      const result = await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(result.targetPath).toBe(`/programs/${programId}`);
      expect(result.programId).toBe(programId);
    });

    /**
     * Test 4.1: Handling of Missing Program Context
     * Validates: Requirement 4.3
     */
    it('should redirect to dashboard when no program context exists', async () => {
      // Arrange
      // Don't set any program context

      // Act
      const result = await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(result.targetPath).toBe('/dashboard');
      expect(result.programId).toBeUndefined();
      expect(logger.debug).toHaveBeenCalledWith(
        'No program context found in LocalStorage during post-auth',
        expect.objectContaining({
          userId: mockUserId,
        })
      );
    });

    /**
     * Test 4.2: Handling Missing Program Context During Signup
     * Validates: Requirement 5.1
     */
    it('should redirect to dashboard during signup when no program context exists', async () => {
      // Arrange
      // No program context set

      // Act
      const result = await handlePostAuth(mockUserId, 'signup');

      // Assert
      expect(result.targetPath).toBe('/dashboard');
      expect(result.programId).toBeUndefined();
    });

    /**
     * Test 5.1: Permission Denied After Login
     * Validates: Requirement 4.2, 4.3
     */
    it('should redirect to dashboard when user lacks permission for program', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: false,
        reason: 'User does not meet prerequisites',
      });

      // Act
      const result = await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(result.targetPath).toBe('/dashboard');
      expect(result.programId).toBe(mockProgramId);
      expect(result.permissionDenied).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        'User denied access to program during post-auth',
        expect.objectContaining({
          userId: mockUserId,
          programId: mockProgramId,
          reason: 'User does not meet prerequisites',
        })
      );
    });

    /**
     * Test 5.2: Program Context Cleared on Permission Denied
     * Validates: Requirement 6.2
     */
    it('should clear program context from localStorage when permission denied', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: false,
        reason: 'Private program',
      });

      // Act
      await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(getProgramContext()).toBeNull();
    });

    /**
     * Test 6.1: API Error Handling - Graceful Fallback
     * Validates: Requirement 4.1
     */
    it('should default to dashboard if API error occurs during access verification', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockRejectedValue(
        new Error('API Error')
      );

      // Act
      const result = await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(result.targetPath).toBe('/dashboard');
      expect(result.permissionDenied).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Error verifying program access during post-auth',
        expect.objectContaining({
          programId: mockProgramId,
        })
      );
    });

    /**
     * Test 7.1: Auth Context Updated During Signup
     * Validates: Requirement 5.1
     */
    it('should handle signup context and redirect to program page when valid', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: true,
      });

      // Act
      const result = await handlePostAuth(mockUserId, 'signup');

      // Assert
      expect(result.targetPath).toBe(`/programs/${mockProgramId}`);
      expect(result.permissionDenied).toBe(false);
    });

    /**
     * Test 8.1: Program Permission Verified After Login
     * Validates: Requirement 10.1
     */
    it('should verify program permissions with user ID after login', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: true,
      });

      // Act
      await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(programSharingService.verifyProgramAccess).toHaveBeenCalledWith(
        mockProgramId,
        mockUserId
      );
    });

    /**
     * Test 9.1: Multiple Authentication Attempts
     * Validates: Requirement 4.1
     */
    it('should handle multiple post-auth calls idempotently', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: true,
      });

      // Act
      const result1 = await handlePostAuth(mockUserId, 'login');
      const result2 = await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(result1.targetPath).toBe(result2.targetPath);
      expect(result1.programId).toBe(result2.programId);
    });

    /**
     * Test 10.1: Error Handling During Post-Auth
     * Validates: Requirement 4.1
     */
    it('should handle unexpected errors gracefully', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Act
      const result = await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(result.targetPath).toBe('/dashboard');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should route logged-in trainee to enrollment page when access is granted', async () => {
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: true,
        hasEnrolled: false,
      });

      const result = await handlePostAuth(mockUserId, 'login', 'trainee');

      expect(result.targetPath).toBe(`/programs/${mockProgramId}/enroll`);
      expect(result.permissionDenied).toBe(false);
    });

    it('should route already-enrolled trainee to enrollment page even when canAccess is false', async () => {
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: false,
        hasEnrolled: true,
        reason: 'Trainee is already enrolled',
      });

      const result = await handlePostAuth(mockUserId, 'login', 'trainee');

      expect(result.targetPath).toBe(`/programs/${mockProgramId}/enroll`);
      expect(result.permissionDenied).toBe(false);
    });

    it('should skip trainee access verification for staff/admin roles and route directly to program details', async () => {
      setProgramContext(mockProgramId);

      const result = await handlePostAuth(mockUserId, 'login', 'local_admin');

      expect(result.targetPath).toBe(`/programs/${mockProgramId}`);
      expect(result.permissionDenied).toBe(false);
      expect(programSharingService.verifyProgramAccess).not.toHaveBeenCalled();
    });
  });

  /**
   * Test Suite: cleanupProgramReference Function
   * Tests cleanup logic for program context
   */
  describe('cleanupProgramReference', () => {
    /**
     * Test 1.1: Program Reference Removed After Cleanup
     * Validates: Requirement 6.1, 6.2
     */
    it('should remove program reference from localStorage', () => {
      // Arrange
      setProgramContext(mockProgramId);
      expect(getProgramContext()).toBe(mockProgramId);

      // Act
      cleanupProgramReference();

      // Assert
      expect(getProgramContext()).toBeNull();
      expect(logger.debug).toHaveBeenCalledWith(
        'Program reference cleared from LocalStorage',
        expect.objectContaining({
          programId: mockProgramId,
        })
      );
    });

    /**
     * Test 2.1: Cleanup is Idempotent
     * Validates: Requirement 6.1
     */
    it('should be idempotent when called multiple times', () => {
      // Arrange
      setProgramContext(mockProgramId);

      // Act
      cleanupProgramReference();
      cleanupProgramReference();

      // Assert
      expect(getProgramContext()).toBeNull();
    });

    /**
     * Test 3.1: Force Cleanup Works
     * Validates: Requirement 6.1
     */
    it('should force cleanup even when program reference not present', () => {
      // Arrange
      localStorage.clear();

      // Act - should not throw
      cleanupProgramReference(true);

      // Assert
      expect(getProgramContext()).toBeNull();
    });

    /**
     * Test 4.1: Other LocalStorage Keys Not Affected
     * Validates: Requirement 6.3
     */
    it('should not affect other localStorage keys during cleanup', () => {
      // Arrange
      const otherKey = 'other-key';
      const otherValue = 'other-value';
      localStorage.setItem(otherKey, otherValue);
      setProgramContext(mockProgramId);

      // Act
      cleanupProgramReference();

      // Assert
      expect(getProgramContext()).toBeNull();
      expect(localStorage.getItem(otherKey)).toBe(otherValue);
    });

    /**
     * Test 5.1: Cleanup Logging
     * Validates: Requirement 6.1
     */
    it('should log cleanup operation', () => {
      // Arrange
      setProgramContext(mockProgramId);

      // Act
      cleanupProgramReference();

      // Assert
      expect(logger.debug).toHaveBeenCalledWith(
        'Program reference cleared from LocalStorage',
        { programId: mockProgramId }
      );
    });
  });

  /**
   * Test Suite: getProgramContext Function
   * Tests retrieval of program context
   */
  describe('getProgramContext', () => {
    /**
     * Test 1.1: Program Context Retrieved Successfully
     * Validates: Requirement 2.2
     */
    it('should retrieve program context from localStorage', () => {
      // Arrange
      setProgramContext(mockProgramId);

      // Act
      const context = getProgramContext();

      // Assert
      expect(context).toBe(mockProgramId);
    });

    /**
     * Test 2.1: Program Context Not Found
     * Validates: Requirement 2.2
     */
    it('should return null when program context not found', () => {
      // Arrange - empty localStorage

      // Act
      const context = getProgramContext();

      // Assert
      expect(context).toBeNull();
    });

    /**
     * Test 3.1: Program Context Persistence
     * Validates: Requirement 9.1, 9.2
     */
    it('should persist program context across function calls', () => {
      // Arrange
      setProgramContext(mockProgramId);

      // Act
      const context1 = getProgramContext();
      const context2 = getProgramContext();

      // Assert
      expect(context1).toBe(context2);
      expect(context1).toBe(mockProgramId);
    });
  });

  /**
   * Test Suite: setProgramContext Function
   * Tests storage of program context
   */
  describe('setProgramContext', () => {
    /**
     * Test 1.1: Program Context Stored Successfully
     * Validates: Requirement 2.2
     */
    it('should store program context in localStorage', () => {
      // Arrange - empty localStorage

      // Act
      setProgramContext(mockProgramId);

      // Assert
      expect(getProgramContext()).toBe(mockProgramId);
      expect(logger.debug).toHaveBeenCalledWith(
        'Program context stored in LocalStorage',
        { programId: mockProgramId }
      );
    });

    /**
     * Test 2.1: Program Context Overwrite
     * Validates: Requirement 2.2
     */
    it('should overwrite existing program context', () => {
      // Arrange
      const firstProgramId = 'prog-111';
      const secondProgramId = 'prog-222';
      setProgramContext(firstProgramId);

      // Act
      setProgramContext(secondProgramId);

      // Assert
      expect(getProgramContext()).toBe(secondProgramId);
      expect(getProgramContext()).not.toBe(firstProgramId);
    });

    /**
     * Test 3.1: Program Context Type Safety
     * Validates: Requirement 2.2
     */
    it('should store program context as string', () => {
      // Arrange
      const programId = 'prog-abc-123';

      // Act
      setProgramContext(programId);

      // Assert
      const context = getProgramContext();
      expect(typeof context).toBe('string');
      expect(context).toBe(programId);
    });

    /**
     * Test 4.1: Program Context Invalid UUID Handling
     * Validates: Requirement 2.2
     */
    it('should store any string as program context (validation on backend)', () => {
      // Arrange
      const invalidId = 'not-a-valid-uuid';

      // Act
      setProgramContext(invalidId);

      // Assert
      expect(getProgramContext()).toBe(invalidId);
      // Frontend just stores it; backend validates
    });
  });

  /**
   * Integration Tests: Complete Flows
   */
  describe('Integration: Complete Auth Flows', () => {
    /**
     * Test 1.1: Complete Login Flow with Program Context
     * Validates: Requirements 4.1, 4.2, 4.3, 6.2
     */
    it('should handle complete login flow with program context', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: true,
      });

      // Act
      const result = await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(result.targetPath).toBe(`/programs/${mockProgramId}`);
      expect(result.permissionDenied).toBe(false);
      // Program context should still exist after routing decision
      expect(getProgramContext()).toBe(mockProgramId);
    });

    /**
     * Test 2.1: Complete Login Flow without Program Context
     * Validates: Requirement 7.1, 7.2, 7.3
     */
    it('should handle complete login flow without program context (normal flow)', async () => {
      // Arrange - no program context

      // Act
      const result = await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(result.targetPath).toBe('/dashboard');
      expect(result.programId).toBeUndefined();
    });

    /**
     * Test 3.1: Complete Signup Flow with Program Context
     * Validates: Requirements 5.1, 5.2, 5.3, 5.4
     */
    it('should handle complete signup flow with program context', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: true,
      });

      // Act
      const result = await handlePostAuth(mockUserId, 'signup');

      // Assert
      expect(result.targetPath).toBe(`/programs/${mockProgramId}`);
      expect(result.permissionDenied).toBe(false);
    });

    /**
     * Test 4.1: Permission Denied Flow with Cleanup
     * Validates: Requirements 6.1, 6.2, 10.1, 10.2
     */
    it('should cleanup program context when permission denied', async () => {
      // Arrange
      setProgramContext(mockProgramId);
      vi.mocked(programSharingService.verifyProgramAccess).mockResolvedValue({
        canAccess: false,
        reason: 'Program restricted',
      });

      // Act
      const result = await handlePostAuth(mockUserId, 'login');

      // Assert
      expect(result.targetPath).toBe('/dashboard');
      expect(getProgramContext()).toBeNull();
      cleanupProgramReference();
      expect(getProgramContext()).toBeNull();
    });
  });
});
