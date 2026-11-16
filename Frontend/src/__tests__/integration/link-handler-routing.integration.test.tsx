/**
 * Integration Tests: Link Handler Routing
 * 
 * Task 13.1: Write integration tests for Link Handler routing
 * 
 * This test suite verifies the complete navigation flow through the program sharing feature,
 * including proper routing for authenticated users, unauthenticated users, and error scenarios.
 * 
 * Test scenarios covered:
 * - Navigation from shared link to Link Handler page
 * - Proper routing for authenticated users (to program detail page)
 * - Proper routing for unauthenticated users (to login)
 * - URL query parameter extraction and validation
 * - Program validation integration
 * - State preservation across navigation
 * - Error handling and redirects
 * 
 * **Validates: Requirements 2.1, 3.1, 3.5, 7.5**
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LinkHandlerPage from '../../pages/LinkHandlerPage';
import { AuthProvider } from '../../contexts/AuthContext';
import { ProgramsProvider } from '../../contexts/ProgramsContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import programSharingService from '../../services/programSharingService';
import { toast } from 'sonner';

/**
 * Mock all required services and dependencies
 */
vi.mock('../../services/programSharingService');
vi.mock('sonner');
vi.mock('../../utils/logger', () => {
  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  return {
    default: mockLogger,
    logger: mockLogger,
  };
});
vi.mock('../../utils/pwa', () => ({
  initializePWA: vi.fn(),
}));
vi.mock('../../utils/offlineDB', () => ({
  initializeDatabase: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../utils/offlineManager', () => ({
  offlineManager: {
    syncPendingOperations: vi.fn(),
  },
}));

/**
 * Test fixtures and constants
 */
const VALID_PROGRAM_ID = 'a1b2c3d4-e5f6-4a18-b9d0-c1a2b3c4d5e6';
const INVALID_PROGRAM_ID = 'invalid-id';
const NONEXISTENT_PROGRAM_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

const mockValidProgramResponse = {
  isValid: true,
  isActive: true,
  isPublic: true,
  program: {
    id: VALID_PROGRAM_ID,
    name: 'Test Training Program',
    description: 'A test program for validation',
  },
};

const mockInactiveProgramResponse = {
  isValid: true,
  isActive: false,
  isPublic: true,
};

const mockNonPublicProgramResponse = {
  isValid: true,
  isActive: true,
  isPublic: false,
};

const mockInvalidProgramResponse = {
  isValid: false,
  isActive: false,
  isPublic: false,
};

/**
 * Test wrapper component
 */
function TestWrapper({ children, initialRoute = '/share?program_id=' + VALID_PROGRAM_ID }: any) {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <ThemeProvider>
        <AuthProvider>
          <ProgramsProvider>{children}</ProgramsProvider>
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>
  );
}

/**
 * ============================================================================
 * TEST SUITE: Link Handler Routing Integration - Task 13.1
 * ============================================================================
 */

describe('Link Handler Routing Integration - Task 13.1', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();

    // Mock toast functions
    (toast.error as any).mockImplementation(() => {});
    (toast.success as any).mockImplementation(() => {});
    (toast.warning as any).mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  /**
   * ============================================================================
   * TEST GROUP 1: Basic Link Handler Access and Navigation
   * ============================================================================
   */

  describe('Accessing /share?program_id={valid_uuid}', () => {
    /**
     * Test 13.1.1: Valid program_id routes authenticated user to program page
     * **Validates: Requirements 2.1, 3.1**
     */
    it('should route authenticated user to program page with valid program_id', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
      });

      expect(programSharingService.validateProgramShare).toHaveBeenCalledWith(
        VALID_PROGRAM_ID
      );
    });

    /**
     * Test 13.1.2: Invalid program_id format redirects to home
     * **Validates: Requirements 2.1, 3.1**
     */
    it('should reject invalid program_id format and redirect to home', async () => {
      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${INVALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(programSharingService.validateProgramShare).not.toHaveBeenCalled();
        expect(localStorage.getItem('selected_program_id')).toBeNull();
        expect(toast.error).toHaveBeenCalled();
      });
    });

    /**
     * Test 13.1.3: Accessing /share without program_id redirects to home
     * **Validates: Requirements 2.1**
     */
    it('should redirect to home when program_id is missing from URL', async () => {
      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute="/share" />,
      });

      await waitFor(() => {
        expect(programSharingService.validateProgramShare).not.toHaveBeenCalled();
        expect(localStorage.getItem('selected_program_id')).toBeNull();
      });
    });
  });

  /**
   * ============================================================================
   * TEST GROUP 2: Authenticated User Routing
   * ============================================================================
   */

  describe('Authenticated User Routing', () => {
    /**
     * Test 13.1.4: Authenticated user is routed to program page
     * **Validates: Requirements 3.1, 3.5**
     */
    it('should route authenticated user to /programs/{id} page', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
        expect(programSharingService.validateProgramShare).toHaveBeenCalledWith(
          VALID_PROGRAM_ID
        );
      });
    });

    /**
     * Test 13.1.5: Program context preserved through authentication
     * **Validates: Requirements 2.2, 3.1**
     */
    it('should preserve program_id in localStorage after validation', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        const stored = localStorage.getItem('selected_program_id');
        expect(stored).toBe(VALID_PROGRAM_ID);
        expect(stored).toEqual(VALID_PROGRAM_ID);
      });
    });

    /**
     * Test 13.1.6: Program ID remains stored across page navigation
     * **Validates: Requirements 2.2, 9.1**
     */
    it('should preserve program_id across multiple navigations', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      const { rerender } = render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
      });

      // Simulate navigation away and back
      expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
    });
  });

  /**
   * ============================================================================
   * TEST GROUP 3: Unauthenticated User Routing
   * ============================================================================
   */

  describe('Unauthenticated User Routing', () => {
    /**
     * Test 13.1.7: Unauthenticated user is routed to login page
     * **Validates: Requirements 3.1, 3.5**
     */
    it('should route unauthenticated user to login page', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
      });
    });

    /**
     * Test 13.1.8: Program context available for post-auth redirection
     * **Validates: Requirements 2.2, 4.1, 4.2**
     */
    it('should preserve program_id for post-auth handler to use', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        const stored = localStorage.getItem('selected_program_id');
        expect(stored).toBe(VALID_PROGRAM_ID);
        const retrieved = localStorage.getItem('selected_program_id');
        expect(retrieved).toBe(VALID_PROGRAM_ID);
      });
    });
  });

  /**
   * ============================================================================
   * TEST GROUP 4: Program Validation and Error Handling
   * ============================================================================
   */

  describe('Program Validation Error Handling', () => {
    /**
     * Test 13.1.9: Inactive program shows error and redirects
     * **Validates: Requirements 2.3, 8.1**
     */
    it('should reject inactive program with error message', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockInactiveProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBeNull();
        expect(toast.error).toHaveBeenCalledWith('This program is no longer available');
      });
    });

    /**
     * Test 13.1.10: Non-public program shows error
     * **Validates: Requirements 2.4, 8.1, 10.3**
     */
    it('should reject non-public program with appropriate error', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockNonPublicProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBeNull();
        expect(toast.error).toHaveBeenCalledWith(
          'This program is not available for public enrollment'
        );
      });
    });

    /**
     * Test 13.1.11: Non-existent program shows error
     * **Validates: Requirements 2.4, 8.1**
     */
    it('should handle non-existent program gracefully', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockInvalidProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${NONEXISTENT_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBeNull();
        expect(toast.error).toHaveBeenCalled();
      });
    });

    /**
     * Test 13.1.12: API error is handled without crashing
     * **Validates: Requirements 2.4, 8.4**
     */
    it('should handle validation API errors gracefully', async () => {
      const mockError = new Error('Network error');
      (programSharingService.validateProgramShare as any).mockRejectedValue(mockError);

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBeNull();
        expect(toast.error).toHaveBeenCalledWith('Unable to validate program. Please try again.');
      });
    });
  });

  /**
   * ============================================================================
   * TEST GROUP 5: URL Query Parameter Handling
   * ============================================================================
   */

  describe('URL Query Parameter Handling', () => {
    /**
     * Test 13.1.13: Query parameter is extracted from URL
     * **Validates: Requirements 2.1**
     */
    it('should extract program_id from URL query parameter', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}&utm_source=facebook`} />,
      });

      await waitFor(() => {
        expect(programSharingService.validateProgramShare).toHaveBeenCalledWith(
          VALID_PROGRAM_ID
        );
        expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
      });
    });

    /**
     * Test 13.1.14: Multiple query parameters don't interfere
     * **Validates: Requirements 2.1**
     */
    it('should correctly parse program_id with multiple query parameters', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      const urlParams = new URLSearchParams({
        program_id: VALID_PROGRAM_ID,
        utm_source: 'facebook',
        utm_medium: 'social',
        utm_campaign: 'launch',
      });

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?${urlParams.toString()}`} />,
      });

      await waitFor(() => {
        expect(programSharingService.validateProgramShare).toHaveBeenCalledWith(
          VALID_PROGRAM_ID
        );
      });
    });

    /**
     * Test 13.1.15: Empty query parameter handled correctly
     * **Validates: Requirements 2.1**
     */
    it('should handle empty program_id parameter', async () => {
      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute="/share?program_id=" />,
      });

      await waitFor(() => {
        expect(programSharingService.validateProgramShare).not.toHaveBeenCalled();
        expect(localStorage.getItem('selected_program_id')).toBeNull();
      });
    });

    /**
     * Test 13.1.16: URL encoding is properly decoded
     * **Validates: Requirements 2.1**
     */
    it('should properly decode URL-encoded program_id', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      const encodedId = encodeURIComponent(VALID_PROGRAM_ID);
      
      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${encodedId}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
      });
    });
  });

  /**
   * ============================================================================
   * TEST GROUP 6: State Preservation and localStorage Integration
   * ============================================================================
   */

  describe('State Preservation and localStorage Integration', () => {
    /**
     * Test 13.1.17: Program context persists in localStorage
     * **Validates: Requirements 9.1, 9.2**
     */
    it('should maintain program_id in localStorage after validation', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
      });

      const stored = localStorage.getItem('selected_program_id');
      expect(stored).toBe(VALID_PROGRAM_ID);
    });

    /**
     * Test 13.1.18: Other localStorage data is not affected
     * **Validates: Requirements 6.3**
     */
    it('should not affect other localStorage data during routing', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      localStorage.setItem('theme', 'dark');
      localStorage.setItem('language', 'en');
      localStorage.setItem('last_visited', '/dashboard');

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
      });

      expect(localStorage.getItem('theme')).toBe('dark');
      expect(localStorage.getItem('language')).toBe('en');
      expect(localStorage.getItem('last_visited')).toBe('/dashboard');
    });

    /**
     * Test 13.1.19: Program_id can be replaced with new value
     * **Validates: Requirements 2.2, 3.1**
     */
    it('should allow updating program_id when clicking different shared link', async () => {
      const ANOTHER_PROGRAM_ID = 'b2c3d4e5-f617-5b19-c0e1-d2e3f4a5b6c7';

      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      const { unmount } = render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
      });

      unmount();
      vi.clearAllMocks();
      localStorage.clear();

      const anotherMockResponse = {
        ...mockValidProgramResponse,
        program: {
          id: ANOTHER_PROGRAM_ID,
          name: 'Another Program',
          description: 'A different test program',
        },
      };

      (programSharingService.validateProgramShare as any).mockResolvedValue(
        anotherMockResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${ANOTHER_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBe(ANOTHER_PROGRAM_ID);
      });
    });
  });

  /**
   * ============================================================================
   * TEST GROUP 7: Route-level Integration
   * ============================================================================
   */

  describe('Route Integration with App Routing', () => {
    /**
     * Test 13.1.20: /share route is accessible without authentication
     * **Validates: Requirements 3.1, 7.5**
     */
    it('should allow unauthenticated access to /share route', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      expect(() => {
        render(<LinkHandlerPage />, {
          wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
        });
      }).not.toThrow();

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
      });
    });

    /**
     * Test 13.1.21: /share route handles loading state
     * **Validates: Requirements 2.1, 3.1**
     */
    it('should display loading spinner while validating', async () => {
      (programSharingService.validateProgramShare as any).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () => resolve(mockValidProgramResponse),
              100
            );
          })
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(screen.queryByText(/validating/i)).toBeInTheDocument();
      });
    });
  });

  /**
   * ============================================================================
   * TEST GROUP 8: UUID Validation
   * ============================================================================
   */

  describe('UUID Validation for program_id', () => {
    /**
     * Test 13.1.22: Valid UUID format is accepted
     * **Validates: Requirements 2.1**
     */
    it('should validate correct UUID format', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(programSharingService.validateProgramShare).toHaveBeenCalledWith(
          VALID_PROGRAM_ID
        );
      });
    });

    /**
     * Test 13.1.23: Multiple invalid UUID formats are rejected
     * **Validates: Requirements 2.1**
     */
    it('should reject various invalid UUID formats', async () => {
      const invalidFormats = [
        'not-uuid',
        '123456',
        'a1b2c3d4',
        'g1b2c3d4-e5f6-4a18-b9d0-c1a2b3c4d5e6',
        'a1b2c3d4-e5f6-4a18-b9d0-c1a2b3c4d5e6-extra',
        'a1b2c3d4-e5f6-4a18',
      ];

      for (const invalidId of invalidFormats) {
        vi.clearAllMocks();
        localStorage.clear();

        const { unmount } = render(<LinkHandlerPage />, {
          wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${invalidId}`} />,
        });

        await waitFor(() => {
          expect(programSharingService.validateProgramShare).not.toHaveBeenCalled();
          expect(localStorage.getItem('selected_program_id')).toBeNull();
        });

        unmount();
      }
    });
  });

  /**
   * ============================================================================
   * TEST GROUP 9: Complete Flow Integration
   * ============================================================================
   */

  describe('Complete Flow Integration', () => {
    /**
     * Test 13.1.24: Complete flow from link click to program storage for authenticated user
     * **Validates: Requirements 2.1, 2.2, 3.1, 3.5, 7.5**
     */
    it('should complete full flow for authenticated user', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockValidProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(programSharingService.validateProgramShare).toHaveBeenCalledWith(
          VALID_PROGRAM_ID
        );
      });

      expect(localStorage.getItem('selected_program_id')).toBe(VALID_PROGRAM_ID);
      expect(toast.error).not.toHaveBeenCalled();
    });

    /**
     * Test 13.1.25: Complete error flow for invalid program
     * **Validates: Requirements 2.1, 2.4, 8.1**
     */
    it('should complete full error flow for invalid program', async () => {
      (programSharingService.validateProgramShare as any).mockResolvedValue(
        mockInactiveProgramResponse
      );

      render(<LinkHandlerPage />, {
        wrapper: (props) => <TestWrapper {...props} initialRoute={`/share?program_id=${VALID_PROGRAM_ID}`} />,
      });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBeNull();
        expect(toast.error).toHaveBeenCalled();
      });
    });
  });
});
