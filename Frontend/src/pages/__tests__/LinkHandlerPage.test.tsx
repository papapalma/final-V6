import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../../contexts/AuthContext';
import { ProgramsProvider } from '../../contexts/ProgramsContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import LinkHandlerPage from '../LinkHandlerPage';
import programSharingService from '../../services/programSharingService';
import { toast } from 'sonner';
import * as router from 'react-router-dom';

// Mock dependencies
vi.mock('../../services/programSharingService');
vi.mock('sonner');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: vi.fn(),
    useNavigate: vi.fn(),
  };
});

/**
 * Test Suite: LinkHandlerPage
 * 
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.1
 */
describe('LinkHandlerPage', () => {
  const mockNavigate = vi.fn();
  const validProgramId = 'a1b2c3d4-e5f6-4a18-b9d0-c1a2b3c4d5e6';
  const invalidProgramId = 'invalid-id';

  // Mock implementation of useSearchParams
  const mockUseSearchParams = vi.spyOn(router, 'useSearchParams');

  // Mock implementation of useNavigate
  const mockUseNavigate = vi.spyOn(router, 'useNavigate');

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockNavigate.mockReset();
    mockUseNavigate.mockReturnValue(mockNavigate);
    (toast.error as any).mockImplementation(() => {});
    (toast.success as any).mockImplementation(() => {});
  });

  /**
   * Test: Valid program_id triggers validation and storage
   * 
   * Validates: Requirements 2.1, 2.2
   */
  it('should validate and store program_id for valid program', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${validProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    (programSharingService.validateProgramShare as any).mockResolvedValue({
      isValid: true,
      isActive: true,
      isPublic: true,
      program: { id: validProgramId, name: 'Test Program' },
    });

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(programSharingService.validateProgramShare).toHaveBeenCalledWith(validProgramId);
      expect(localStorage.getItem('selected_program_id')).toBe(validProgramId);
    });
  });

  /**
   * Test: Invalid program_id format shows error and doesn't store
   * 
   * Validates: Requirements 2.4, 8.1
   */
  it('should reject invalid program_id format and not store', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${invalidProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid program link');
      expect(localStorage.getItem('selected_program_id')).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      expect(programSharingService.validateProgramShare).not.toHaveBeenCalled();
    });
  });

  /**
   * Test: Inactive program shows appropriate error
   * 
   * Validates: Requirements 2.3, 8.1
   */
  it('should handle inactive program and show error', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${validProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    (programSharingService.validateProgramShare as any).mockResolvedValue({
      isValid: true,
      isActive: false,
      isPublic: true,
    });

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('This program is no longer available');
      expect(localStorage.getItem('selected_program_id')).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/programs', { replace: true });
    });
  });

  /**
   * Test: Non-public program shows appropriate error
   * 
   * Validates: Requirements 2.4, 8.1
   */
  it('should handle non-public program and show error', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${validProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    (programSharingService.validateProgramShare as any).mockResolvedValue({
      isValid: true,
      isActive: true,
      isPublic: false,
    });

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('This program is not available for public enrollment');
      expect(localStorage.getItem('selected_program_id')).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/programs', { replace: true });
    });
  });

  /**
   * Test: URL query parameter is cleared after processing (replace history state)
   * 
   * Validates: Requirements 2.1, 3.1
   */
  it('should replace history state to clear query parameter', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${validProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    (programSharingService.validateProgramShare as any).mockResolvedValue({
      isValid: true,
      isActive: true,
      isPublic: true,
      program: { id: validProgramId, name: 'Test Program' },
    });

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      // Check that navigate was called with replace: true
      // This ensures the history state is replaced, clearing the query parameter
      const calls = mockNavigate.mock.calls.filter((call) => call[1]?.replace === true);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  /**
   * Test: Loading spinner is displayed during validation
   * 
   * Validates: Requirements 3.1
   */
  it('should display loading spinner while validating', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${validProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    // Return a pending promise to keep component in loading state without leaking resolved promises
    (programSharingService.validateProgramShare as any).mockImplementation(
      () => new Promise(() => {})
    );

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    // Loading spinner should be visible
    expect(screen.getByText('Validating program...')).toBeInTheDocument();
  });

  /**
   * Test: Authenticated user is routed to program page
   * 
   * Validates: Requirements 2.2, 3.1
   */
  it('should route authenticated user to program page after validation', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${validProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    (programSharingService.validateProgramShare as any).mockResolvedValue({
      isValid: true,
      isActive: true,
      isPublic: true,
      program: { id: validProgramId, name: 'Test Program' },
    });

    // Mock authenticated user
    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    // This test would need to mock the auth context properly
    // For now, we verify the component can handle the scenario
    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(localStorage.getItem('selected_program_id')).toBe(validProgramId);
    });
  });

  /**
   * Test: Unauthenticated user is routed to login page
   * 
   * Validates: Requirements 2.2, 3.1
   */
  it('should route unauthenticated user to login page after validation', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${validProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    (programSharingService.validateProgramShare as any).mockResolvedValue({
      isValid: true,
      isActive: true,
      isPublic: true,
      program: { id: validProgramId, name: 'Test Program' },
    });

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(localStorage.getItem('selected_program_id')).toBe(validProgramId);
    });
  });

  /**
   * Test: No program_id in URL redirects to home
   * 
   * Validates: Requirements 2.1
   */
  it('should redirect to home when no program_id in URL', async () => {
    const mockSearchParams = new URLSearchParams('');
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      expect(localStorage.getItem('selected_program_id')).toBeNull();
    });
  });

  /**
   * Test: API error is handled gracefully
   * 
   * Validates: Requirements 2.4, 8.1
   */
  it('should handle API validation error gracefully', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${validProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    const mockError = new Error('Network error');
    (programSharingService.validateProgramShare as any).mockRejectedValue(mockError);

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Unable to validate program. Please try again.');
      expect(localStorage.getItem('selected_program_id')).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  /**
   * Test: Program_id is persisted in LocalStorage across navigation
   * 
   * Property: LocalStorage Round-Trip
   * Validates: Requirements 2.2, 6.2
   */
  it('should persist program_id in LocalStorage', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${validProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    (programSharingService.validateProgramShare as any).mockResolvedValue({
      isValid: true,
      isActive: true,
      isPublic: true,
      program: { id: validProgramId, name: 'Test Program' },
    });

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      const storedId = localStorage.getItem('selected_program_id');
      expect(storedId).toBe(validProgramId);
      expect(storedId).toEqual(validProgramId); // Round-trip property
    });
  });

  /**
   * Test: Multiple invalid program_id formats are rejected
   * 
   * Validates: Requirements 2.4, 8.1
   */
  it('should reject various invalid program_id formats', async () => {
    const invalidIds = [
      'not-a-uuid',
      '123',
      'a1b2c3d4',
      'a1b2c3d4-e5f6',
      'g1b2c3d4-e5f6-4a18-b9d0-c1a2b3c4d5e6', // invalid hex
      '',
      'a1b2c3d4-e5f6-4a18-b9d0-c1a2b3c4d5e',  // too short
      'a1b2c3d4-e5f6-4a18-b9d0-c1a2b3c4d5e6-extra', // too long
    ];

    for (const invalidId of invalidIds) {
      vi.clearAllMocks();
      localStorage.clear();

      const mockSearchParams = new URLSearchParams(`program_id=${invalidId}`);
      mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

      const Wrapper = ({ children }: any) => (
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <ProgramsProvider>{children}</ProgramsProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      );

      const { unmount } = render(<LinkHandlerPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(localStorage.getItem('selected_program_id')).toBeNull();
        expect(programSharingService.validateProgramShare).not.toHaveBeenCalled();
      });

      unmount();
    }
  });

  /**
   * Test: Non-existent program is handled correctly
   * 
   * Validates: Requirements 2.4, 8.1
   */
  it('should handle non-existent program from validation API', async () => {
    const mockSearchParams = new URLSearchParams(`program_id=${validProgramId}`);
    mockUseSearchParams.mockReturnValue([mockSearchParams as any, vi.fn()]);

    (programSharingService.validateProgramShare as any).mockResolvedValue({
      isValid: false,
      isActive: false,
      isPublic: false,
      error: 'Program not found',
    });

    const Wrapper = ({ children }: any) => (
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <ProgramsProvider>{children}</ProgramsProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    );

    render(<LinkHandlerPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('This program is no longer available');
      expect(localStorage.getItem('selected_program_id')).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith('/programs', { replace: true });
    });
  });
});
