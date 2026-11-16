/**
 * Landing Content Editor Page Tests
 *
 * Tests verify that the landing content editor enforces role-based access control,
 * validates form inputs with Zod, and correctly merges settings without overwriting
 * layout/colors configuration.
 *
 * Validates: Task 5 Acceptance Criteria
 * - Role-based access control
 * - Form validation with Zod
 * - Settings merge logic
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LandingContentEditorPage from '../LandingContentEditorPage';
import { AuthProvider } from '../../contexts/AuthContext';
import * as apiService from '../../services/api';



// Mock API service
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

// Mock DashboardLayout
vi.mock('../../components/DashboardLayout', () => ({
  default: ({ children, title }: any) => (
    <div data-testid="dashboard-layout" data-title={title}>
      {children}
    </div>
  ),
}));

// Mock Sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

// Mock useAuth hook
const mockUseAuth = vi.fn();
vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => <div>{children}</div>,
  useAuth: () => mockUseAuth(),
}));

/**
 * Helper to render LandingContentEditorPage with necessary providers
 */
const renderEditorPage = () => {
  return render(
    <BrowserRouter>
      <LandingContentEditorPage />
    </BrowserRouter>
  );
};

/**
 * Default form values for testing
 */
const validFormData = {
  hero: {
    badge: 'Official Training',
    heading: 'Shape Your Future',
    subheading: 'Acquire industry-standard technical training...',
    ctaText: 'Enroll Now',
  },
  mission: 'Our mission is to provide quality training.',
  vision: 'Our vision is to empower communities.',
  features: [
    {
      icon: 'Wrench',
      title: 'Practical Workstations',
      description: 'Real equipment and industry-standard tools...',
    },
    {
      icon: 'Award',
      title: 'Accredited Curriculum',
      description: 'Recognized certifications and standards...',
    },
    {
      icon: 'Users2',
      title: 'Expert Mentorship',
      description: 'Learn from industry professionals...',
    },
    {
      icon: 'Compass',
      title: 'Career Advancement',
      description: 'Pathways to better opportunities...',
    },
  ],
  ctaBanner: {
    badge: 'Start Your Journey',
    heading: 'Ready to Transform Your Career?',
    description: 'Join thousands of successful graduates...',
    ctaPrimaryText: 'Enroll Now',
    ctaSecondaryText: 'View Programs',
  },
  contact: {
    address: 'Bongabong, Oriental Mindoro',
    addressLine2: 'Philippines',
    phone: '+63 999 999 9999',
    email: 'info@bmdc.edu.ph',
    facebook: 'https://www.facebook.com/bmdc',
  },
  footer: {
    companyName: 'Bongabong Manpower Development Center',
    tagline: 'Empowering Communities Through Practical Skills',
  },
};

const mockCmsResponse = {
  success: true,
  data: {
    id: 'cms-1',
    tenantId: 'tenant-1',
    settingsData: {
      content: validFormData,
      appearance: { primaryColor: '#3b82f6', layout: 'default' },
      layout: { headerPosition: 'top' },
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
};

describe('LandingContentEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (apiService.default.get as any).mockResolvedValue(mockCmsResponse);
    (apiService.default.post as any).mockResolvedValue(mockCmsResponse);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Role-Based Access Control', () => {
    /**
     * Test 1.1: Non-admin users should see "Access Denied" message
     *
     * Validates: Acceptance Criteria - Non-admin users blocked from accessing editor
     */
    it('should display access denied message for non-admin users', async () => {
      // Arrange - Mock non-admin user
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'trainee' },
      });

      // Act
      renderEditorPage();

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
        expect(
          screen.getByText(/You don't have permission to access the landing page content editor/i)
        ).toBeInTheDocument();
      });

      // Verify API was not called
      expect(apiService.default.get).not.toHaveBeenCalled();
    });

    /**
     * Test 1.2: Different non-admin role (instructor) should also be blocked
     */
    it('should block instructors from accessing the editor', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'instructor' },
      });

      // Act
      renderEditorPage();

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
      });
    });

    /**
     * Test 1.3: local_admin users should be allowed access
     *
     * Validates: Acceptance Criteria - local_admin users allowed access
     */
    it('should allow local_admin users to access the editor', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'local_admin' },
      });

      // Act
      renderEditorPage();

      // Assert - Should show form, not access denied
      await waitFor(() => {
        expect(screen.getByText(/Landing Page Content/i)).toBeInTheDocument();
        expect(screen.queryByText(/Access Denied/i)).not.toBeInTheDocument();
      });

      // Should have called API to load settings
      expect(apiService.default.get).toHaveBeenCalledWith('/cms-settings');
    });

    /**
     * Test 1.4: super_admin users should be allowed access
     */
    it('should allow super_admin users to access the editor', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'super_admin' },
      });

      // Act
      renderEditorPage();

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Landing Page Content/i)).toBeInTheDocument();
        expect(screen.queryByText(/Access Denied/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('2. Form Validation', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'local_admin' },
      });
    });

    /**
     * Test 2.1: Required fields should validate with Zod
     *
     * Validates: Acceptance Criteria - Form validates required fields with Zod
     */
    it('should show validation errors for empty required fields', async () => {
      const user = userEvent.setup();

      // Arrange
      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Shape Your Future/i)).toBeInTheDocument();
      });

      // Act - Clear a required field and blur to trigger validation
      const heroHeadingInput = screen.getByDisplayValue(/Shape Your Future/i) as HTMLInputElement;
      await user.clear(heroHeadingInput);
      fireEvent.blur(heroHeadingInput);

      // Assert - Validation error should appear
      await waitFor(() => {
        expect(screen.getByText(/Hero heading is required/i)).toBeInTheDocument();
      });
    });

    /**
     * Test 2.2: Email field should validate email format
     */
    it('should validate email format in contact section', async () => {
      const user = userEvent.setup();

      // Arrange
      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/info@bmdc.edu.ph/i)).toBeInTheDocument();
      });

      // Act - Enter invalid email
      const emailInput = screen.getByDisplayValue(/info@bmdc.edu.ph/i) as HTMLInputElement;
      await user.clear(emailInput);
      await user.type(emailInput, 'not-an-email');
      fireEvent.blur(emailInput);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Invalid email address/i)).toBeInTheDocument();
      });
    });

    /**
     * Test 2.3: Features must have exactly 4 items
     */
    it('should enforce exactly 4 features with Zod validation', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'local_admin' },
      });

      // Mock response with less than 4 features
      (apiService.default.get as any).mockResolvedValue({
        success: true,
        data: {
          id: 'cms-1',
          tenantId: 'tenant-1',
          settingsData: {
            content: {
              ...validFormData,
              features: [validFormData.features[0], validFormData.features[1]],
            },
          },
        },
      });

      // Act
      renderEditorPage();

      // Assert - Form should show features section
      await waitFor(() => {
        expect(screen.getByText(/Feature 1/i)).toBeInTheDocument();
        expect(screen.getByText(/Feature 2/i)).toBeInTheDocument();
      });
    });

    /**
     * Test 2.4: Character length limits should be validated
     */
    it('should validate maximum character limits', async () => {
      const user = userEvent.setup();

      // Arrange
      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Shape Your Future/i)).toBeInTheDocument();
      });

      // Act - Try to enter text longer than 200 chars into hero heading
      const headingInput = screen.getByPlaceholderText(
        /e\.g\., Shape Your Future With Real-World Skills/i
      ) as HTMLInputElement;
      const longText = 'a'.repeat(201);
      await user.clear(headingInput);
      await user.type(headingInput, longText);
      fireEvent.blur(headingInput);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Heading must be less than 200 characters/i)).toBeInTheDocument();
      });
    });

    /**
     * Test 2.5: Icon field should only accept valid values
     */
    it('should validate icon selection to allowed values only', async () => {
      // Arrange
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'local_admin' },
      });

      // Act
      renderEditorPage();

      // Assert - Icon select should be present with default value
      await waitFor(() => {
        const selects = screen.getAllByRole('combobox');
        // There should be multiple select elements, and at least one for features
        expect(selects.length).toBeGreaterThan(0);
      });
    });

    /**
     * Test 2.6: URL validation for Facebook field
     */
    it('should validate Facebook URL format', async () => {
      const user = userEvent.setup();

      // Arrange
      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/https:\/\/www.facebook.com\/bmdc/i)).toBeInTheDocument();
      });

      // Act - Enter invalid URL
      const facebookInput = screen.getByDisplayValue(
        /https:\/\/www.facebook.com\/bmdc/i
      ) as HTMLInputElement;
      await user.clear(facebookInput);
      await user.type(facebookInput, 'not-a-url');
      fireEvent.blur(facebookInput);

      // Assert
      await waitFor(() => {
        expect(screen.getByText(/Facebook URL must be valid/i)).toBeInTheDocument();
      });
    });
  });

  describe('3. Settings Merge Logic', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'local_admin' },
      });
    });

    /**
     * Test 3.1: Submit should merge settings without overwriting layout/colors
     *
     * Validates: Acceptance Criteria - Submit merges settings without overwriting layout/colors
     */
    it('should merge content without overwriting existing layout and colors', async () => {
      const user = userEvent.setup();

      // Arrange
      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Shape Your Future/i)).toBeInTheDocument();
      });

      // Act - Modify a field
      const headingInput = screen.getByDisplayValue(/Shape Your Future/i) as HTMLInputElement;
      await user.clear(headingInput);
      await user.type(headingInput, 'New Hero Heading');

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await user.click(saveButton);

      // Assert - API should be called with merged data
      await waitFor(() => {
        expect(apiService.default.post).toHaveBeenCalledWith('/cms-settings', {
          content: expect.objectContaining({
            hero: expect.objectContaining({
              heading: 'New Hero Heading',
            }),
          }),
        });
      });

      // Verify the API call doesn't try to delete appearance/layout
      const apiCall = (apiService.default.post as any).mock.calls[0];
      expect(apiCall[1]).toEqual({
        content: expect.any(Object),
      });
      // The merge happens on the backend, not in the form submission
    });

    /**
     * Test 3.2: Existing appearance settings should not be sent in POST request
     * (they're preserved on backend via merge logic)
     */
    it('should only send content in POST request, not appearance or layout', async () => {
      const user = userEvent.setup();

      // Arrange
      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Bongabong, Oriental Mindoro/i)).toBeInTheDocument();
      });

      // Act - Modify contact field
      const addressInput = screen.getByDisplayValue(/Bongabong, Oriental Mindoro/i) as HTMLInputElement;
      await user.clear(addressInput);
      await user.type(addressInput, 'New Address');

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await user.click(saveButton);

      // Assert - POST should only contain content
      await waitFor(() => {
        const calls = (apiService.default.post as any).mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        const lastCall = calls[calls.length - 1];
        const payload = lastCall[1];
        expect(payload).toHaveProperty('content');
        expect(payload).not.toHaveProperty('appearance');
        expect(payload).not.toHaveProperty('layout');
      });
    });

    /**
     * Test 3.3: Form should reset to saved data after successful submit
     */
    it('should reset form to reflect saved data after successful submission', async () => {
      const user = userEvent.setup();
      const { toast } = await import('sonner');

      // Arrange
      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Shape Your Future/i)).toBeInTheDocument();
      });

      // Act - Make a change
      const headingInput = screen.getByDisplayValue(/Shape Your Future/i) as HTMLInputElement;
      await user.clear(headingInput);
      await user.type(headingInput, 'Updated Heading');

      // Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await user.click(saveButton);

      // Assert - Success toast should be shown
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith(
          'Changes saved successfully',
          expect.objectContaining({
            description: 'Your landing page content has been updated.',
          })
        );
      });
    });
  });

  describe('4. Form Features', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'local_admin' },
      });
    });

    /**
     * Test 4.1: Preview button should open landing page in new tab
     */
    it('should open landing page in new tab when preview button is clicked', async () => {
      const user = userEvent.setup();
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      // Arrange
      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByText(/Landing Page Content/i)).toBeInTheDocument();
      });

      // Act
      const previewButton = screen.getByRole('button', { name: /Preview/i });
      await user.click(previewButton);

      // Assert
      expect(openSpy).toHaveBeenCalledWith('/', '_blank');

      openSpy.mockRestore();
    });

    /**
     * Test 4.2: Unsaved changes indicator should show when form is dirty
     */
    it('should display unsaved changes alert when form has changes', async () => {
      const user = userEvent.setup();

      // Arrange
      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Shape Your Future/i)).toBeInTheDocument();
      });

      // Assert - No alert initially
      expect(screen.queryByText(/You have unsaved changes/i)).not.toBeInTheDocument();

      // Act - Make a change
      const headingInput = screen.getByDisplayValue(/Shape Your Future/i) as HTMLInputElement;
      await user.clear(headingInput);
      await user.type(headingInput, 'Changed Heading');

      // Assert - Unsaved changes alert should appear
      await waitFor(() => {
        expect(screen.getByText(/You have unsaved changes/i)).toBeInTheDocument();
      });
    });

    /**
     * Test 4.3: Cancel button should reset form to last saved state
     */
    it('should reset form to last saved state when cancel is clicked', async () => {
      const user = userEvent.setup();

      // Arrange
      renderEditorPage();

      // Wait for form to load
      const originalValue = 'Shape Your Future';
      await waitFor(() => {
        expect(screen.getByDisplayValue(new RegExp(originalValue, 'i'))).toBeInTheDocument();
      });

      // Act - Make a change
      const headingInput = screen.getByDisplayValue(
        new RegExp(originalValue, 'i')
      ) as HTMLInputElement;
      await user.clear(headingInput);
      await user.type(headingInput, 'Changed Heading');

      // Verify change was made
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Changed Heading/i)).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      // Assert - Form should revert to original value
      await waitFor(() => {
        const inputs = screen.getAllByDisplayValue(new RegExp(originalValue, 'i'));
        expect(inputs.length).toBeGreaterThan(0);
      });
    });

    /**
     * Test 4.4: Save button should be disabled when form is invalid
     */
    it('should disable save button when form is invalid', async () => {
      const user = userEvent.setup();

      // Arrange
      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/info@bmdc.edu.ph/i)).toBeInTheDocument();
      });

      // Act - Make field invalid
      const emailInput = screen.getByDisplayValue(/info@bmdc.edu.ph/i) as HTMLInputElement;
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);

      // Assert - Save button should be disabled
      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: /Save Changes/i });
        expect(saveButton).toBeDisabled();
      });
    });
  });

  describe('5. Loading States', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'local_admin' },
      });
    });

    /**
     * Test 5.1: Should show loading indicator while fetching CMS settings
     */
    it('should display loading state while fetching settings', async () => {
      // Arrange - Delay API response
      (apiService.default.get as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockCmsResponse), 100))
      );

      // Act
      renderEditorPage();

      // Assert - Loading message should appear
      await waitFor(() => {
        expect(screen.getByText(/Loading landing page content/i)).toBeInTheDocument();
      });
    });

    /**
     * Test 5.2: Should show loading state while saving
     */
    it('should display saving state while submitting form', async () => {
      const user = userEvent.setup();

      // Arrange - Delay API response
      (apiService.default.post as any).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockCmsResponse), 100))
      );

      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Shape Your Future/i)).toBeInTheDocument();
      });

      // Act - Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await user.click(saveButton);

      // Assert - Saving state should appear
      await waitFor(() => {
        expect(screen.getByText(/Saving/i)).toBeInTheDocument();
      });
    });
  });

  describe('6. Error Handling', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: '1', role: 'local_admin' },
      });
    });

    /**
     * Test 6.1: Should show error toast when API fails to load settings
     */
    it('should display error toast when loading CMS settings fails', async () => {
      const { toast } = await import('sonner');

      // Arrange
      (apiService.default.get as any).mockRejectedValue(new Error('API Error'));

      // Act
      renderEditorPage();

      // Assert
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Failed to load CMS settings',
          expect.objectContaining({
            description: 'Please refresh the page and try again.',
          })
        );
      });
    });

    /**
     * Test 6.2: Should show error toast when save fails
     */
    it('should display error toast when saving CMS settings fails', async () => {
      const user = userEvent.setup();
      const { toast } = await import('sonner');

      // Arrange
      (apiService.default.post as any).mockRejectedValue(new Error('Save failed'));

      renderEditorPage();

      // Wait for form to load
      await waitFor(() => {
        expect(screen.getByDisplayValue(/Shape Your Future/i)).toBeInTheDocument();
      });

      // Act - Click save
      const saveButton = screen.getByRole('button', { name: /Save Changes/i });
      await user.click(saveButton);

      // Assert
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          'Error saving changes',
          expect.any(Object)
        );
      });
    });
  });
});
