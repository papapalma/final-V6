/**
 * RequirementsManagementPage Tests
 *
 * Comprehensive tests for the RequirementsManagementPage component.
 * Validates:
 * - Page renders with proper title and header
 * - Breadcrumb navigation is displayed
 * - "Add New Requirement" button is present and functional
 * - RequirementDefinitionsList component is rendered
 * - Admin role verification works correctly
 * - Responsive design is applied
 * - Error boundary protects the page
 * - Access denied message shown for non-admin users
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../services/queryClient';
import RequirementsManagementPage from './RequirementsManagementPage';
import * as AuthContext from '../contexts/AuthContext';
import logger from '../utils/logger';

// Mock dependencies
vi.mock('../utils/logger');
vi.mock('../components/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

vi.mock('../components/RequirementDefinitionsList', () => ({
  RequirementDefinitionsList: ({ onRequirementSelect }: { onRequirementSelect: (id: string) => void }) => (
    <div data-testid="requirement-definitions-list">
      <button onClick={() => onRequirementSelect('test-id')}>View Requirement</button>
    </div>
  ),
}));

vi.mock('../components/ErrorBoundary', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  ),
}));

// Mock AuthContext
const mockUseAuth = vi.spyOn(AuthContext, 'useAuth');

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('RequirementsManagementPage', () => {
  const queryClient = createQueryClient();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
  });

  const renderPage = (authValue: any) => {
    mockUseAuth.mockReturnValue(authValue);
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <RequirementsManagementPage />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  describe('Access Control', () => {
    it('should show loading state when user is not authenticated', () => {
      renderPage({ user: null, hasPermission: vi.fn() });
      expect(screen.getByText(/Loading.../i)).toBeInTheDocument();
      expect(screen.getByText(/Verifying authentication status/i)).toBeInTheDocument();
    });

    it('should show access denied for non-admin users', () => {
      renderPage({
        user: { id: '123', role: 'trainee' },
        hasPermission: vi.fn(() => false),
      });
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Only administrators can manage training requirements/i)
      ).toBeInTheDocument();
    });

    it('should allow local_admin users to access', () => {
      renderPage({
        user: { id: '123', role: 'local_admin' },
        hasPermission: vi.fn(() => true),
      });
      expect(screen.getAllByText(/Requirements Management/i)[0]).toBeInTheDocument();
      expect(screen.queryByText(/Access Denied/i)).not.toBeInTheDocument();
    });

    it('should allow super_admin users to access', () => {
      renderPage({
        user: { id: '123', role: 'super_admin' },
        hasPermission: vi.fn(() => true),
      });
      expect(screen.getAllByText(/Requirements Management/i)[0]).toBeInTheDocument();
      expect(screen.queryByText(/Access Denied/i)).not.toBeInTheDocument();
    });

    it('should deny access to staff_trainingcoordinator users', () => {
      renderPage({
        user: { id: '123', role: 'staff_trainingcoordinator' },
        hasPermission: vi.fn(() => false),
      });
      expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
    });
  });

  describe('Page Structure', () => {
    beforeEach(() => {
      renderPage({
        user: { id: '123', role: 'local_admin' },
        hasPermission: vi.fn(() => true),
      });
    });

    it('should render breadcrumb navigation', () => {
      const breadcrumb = screen.getByRole('navigation');
      expect(breadcrumb).toBeInTheDocument();
      expect(screen.getByText(/Dashboard/i)).toBeInTheDocument();
      expect(within(breadcrumb).getByText(/Requirements Management/i)).toBeInTheDocument();
    });

    it('should render page title with icon', () => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Requirements Management/i);
      expect(screen.getByText(/Configure and manage training enrollment requirements/i)).toBeInTheDocument();
    });

    it('should render "Add New Requirement" button', () => {
      const button = screen.getByRole('button', { name: /Add New Requirement/i });
      expect(button).toBeInTheDocument();
    });

    it('should render information alert', () => {
      expect(
        screen.getByText(
          /Manage training enrollment requirements here.*Define requirement types.*set mandatory flags/i
        )
      ).toBeInTheDocument();
    });

    it('should render RequirementDefinitionsList component', () => {
      expect(screen.getByTestId('requirement-definitions-list')).toBeInTheDocument();
    });

    it('should render DashboardLayout', () => {
      expect(screen.getByTestId('dashboard-layout')).toBeInTheDocument();
    });

    it('should render ErrorBoundary', () => {
      expect(screen.getAllByTestId('error-boundary').length).toBeGreaterThan(0);
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      renderPage({
        user: { id: '123', role: 'local_admin' },
        hasPermission: vi.fn(() => true),
      });
    });

    it('should navigate to new requirement form when "Add New Requirement" is clicked', async () => {
      const button = screen.getByRole('button', { name: /Add New Requirement/i });
      fireEvent.click(button);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/requirements/new');
      });
    });

    it('should navigate to requirement detail page when requirement is selected', async () => {
      const viewButton = screen.getByText(/View Requirement/i);
      fireEvent.click(viewButton);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/requirements/test-id');
      });
    });

    it('should disable "Add New Requirement" button during navigation', async () => {
      const button = screen.getByRole('button', { name: /Add New Requirement/i });
      expect(button).not.toBeDisabled();

      fireEvent.click(button);

      // Button should be disabled during navigation
      expect(button).toBeDisabled();
    });
  });

  describe('Logging', () => {
    it('should log page access with user info', () => {
      renderPage({
        user: { id: 'user-123', role: 'local_admin' },
        hasPermission: vi.fn(() => true),
      });

      expect(logger.info).toHaveBeenCalledWith(
        'RequirementsManagementPage mounted',
        expect.objectContaining({
          userRole: 'local_admin',
          userId: 'user-123',
        })
      );
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      renderPage({
        user: { id: '123', role: 'local_admin' },
        hasPermission: vi.fn(() => true),
      });
    });

    it('should apply responsive classes to header', () => {
      const header = screen.getByRole('heading', { level: 1 });
      expect(header?.className).toContain('sm:');
    });

    it('should render responsive button', () => {
      const button = screen.getByRole('button', { name: /Add New Requirement/i });
      expect(button.className).toContain('sm:');
    });

    it('should apply responsive spacing', () => {
      const container = screen.getByTestId('dashboard-layout').querySelector('[class*="space-y"]') as HTMLElement;
      expect(container?.className).toContain('space-y');
      expect(container?.className).toContain('md:');
    });
  });

  describe('Component Integration', () => {
    it('should pass onRequirementSelect callback to RequirementDefinitionsList', () => {
      renderPage({
        user: { id: '123', role: 'local_admin' },
        hasPermission: vi.fn(() => true),
      });

      const listComponent = screen.getByTestId('requirement-definitions-list');
      expect(listComponent).toBeInTheDocument();

      // Verify callback is functional
      const viewButton = screen.getByText(/View Requirement/i);
      fireEvent.click(viewButton);
      expect(mockNavigate).toHaveBeenCalled();
    });
  });
});
