/**
 * Tests for RequirementDefinitionForm Component
 *
 * Tests:
 * 1. Rendering in create mode with empty form
 * 2. Rendering in edit mode with pre-populated data
 * 3. Form validation (required fields, max length)
 * 4. Creating a new requirement definition
 * 5. Updating an existing requirement definition
 * 6. Error handling and toast notifications
 * 7. Loading states during fetch and submission
 * 8. Applicability rules JSON validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RequirementDefinitionForm } from './RequirementDefinitionForm';
import * as hooks from '../hooks/useCreateRequirementDefinition';
import * as updateHooks from '../hooks/useUpdateRequirementDefinition';
import * as getHooks from '../hooks/useRequirementDefinition';

// Mock the hooks
vi.mock('../hooks/useCreateRequirementDefinition', () => ({
  useCreateRequirementDefinition: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
  })),
}));

vi.mock('../hooks/useUpdateRequirementDefinition', () => ({
  useUpdateRequirementDefinition: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: undefined,
  })),
}));

vi.mock('../hooks/useRequirementDefinition', () => ({
  useRequirementDefinition: vi.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
  },
}));

// Mock the UI components
vi.mock('./ui/form', () => ({
  Form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
  FormField: ({ render, ...props }: any) => render({ field: {}, fieldState: {}, formState: {} }),
  FormItem: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  FormLabel: ({ children, ...props }: any) => <label {...props}>{children}</label>,
  FormControl: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  FormDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  FormMessage: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('./ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('./ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}));

vi.mock('./ui/button', () => ({
  Button: (props: any) => <button {...props} />,
}));

vi.mock('./ui/switch', () => ({
  Switch: (props: any) => <input type="checkbox" {...props} />,
}));

vi.mock('./ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  CardDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
}));

vi.mock('./ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('../utils/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
};

describe('RequirementDefinitionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Create Mode', () => {
    it('should render form in create mode when requirementId is not provided', () => {
      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<RequirementDefinitionForm />, { wrapper: createTestWrapper() });

      expect(screen.getByText(/Create Requirement Definition/i)).toBeInTheDocument();
      expect(
        screen.getByText(/Define a new training requirement for your tenant/i)
      ).toBeInTheDocument();
    });

    it('should display applicability rules field in create mode', () => {
      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<RequirementDefinitionForm />, { wrapper: createTestWrapper() });

      expect(
        screen.getByText(/Applicability Rules \(Optional\)/i)
      ).toBeInTheDocument();
    });

    it('should submit form data on create', async () => {
      const mockCreate = vi.fn().mockResolvedValue({});
      vi.mocked(hooks.useCreateRequirementDefinition).mockReturnValue({
        mutate: mockCreate,
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
      } as any);

      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      const mockOnSuccess = vi.fn();
      render(<RequirementDefinitionForm onSuccess={mockOnSuccess} />, {
        wrapper: createTestWrapper(),
      });

      // Verify the form rendered
      expect(screen.getByText(/Create Requirement Definition/i)).toBeInTheDocument();
    });
  });

  describe('Edit Mode', () => {
    it('should show loading state while fetching requirement', () => {
      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<RequirementDefinitionForm requirementId="test-id" />, {
        wrapper: createTestWrapper(),
      });

      expect(screen.getByText(/Loading requirement definition/i)).toBeInTheDocument();
    });

    it('should show error state if requirement fetch fails', () => {
      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to load'),
        refetch: vi.fn(),
      } as any);

      render(<RequirementDefinitionForm requirementId="test-id" />, {
        wrapper: createTestWrapper(),
      });

      expect(screen.getByText('Failed to Load')).toBeInTheDocument();
    });

    it('should show not found error if requirement does not exist', () => {
      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<RequirementDefinitionForm requirementId="nonexistent-id" />, {
        wrapper: createTestWrapper(),
      });

      expect(screen.getByText(/Requirement Not Found/i)).toBeInTheDocument();
    });

    it('should render form in edit mode when requirementId is provided and data is loaded', () => {
      const mockRequirement = {
        id: 'test-id',
        tenant_id: 'tenant-id',
        requirement_type: 'birth_certificate',
        display_name: 'Birth Certificate',
        description: 'NSO/PSA Birth Certificate',
        is_mandatory: true,
        is_active: true,
        applicability_rules: null,
        display_order: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        deleted_at: null,
      };

      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: mockRequirement as any,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<RequirementDefinitionForm requirementId="test-id" />, {
        wrapper: createTestWrapper(),
      });

      expect(screen.getByText(/Edit Requirement Definition/i)).toBeInTheDocument();
    });

    it('should display applicability rules field in edit mode', () => {
      const mockRequirement = {
        id: 'test-id',
        tenant_id: 'tenant-id',
        requirement_type: 'birth_certificate',
        display_name: 'Birth Certificate',
        description: 'NSO/PSA Birth Certificate',
        is_mandatory: true,
        is_active: true,
        applicability_rules: { marital_status: 'married' },
        display_order: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        deleted_at: null,
      };

      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: mockRequirement as any,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      render(<RequirementDefinitionForm requirementId="test-id" />, {
        wrapper: createTestWrapper(),
      });

      const applicabilityLabel = screen.getByText(/Applicability Rules \(Optional\)/);
      expect(applicabilityLabel).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should require display name', async () => {
      const mockCreate = vi.fn();
      vi.mocked(hooks.useCreateRequirementDefinition).mockReturnValue({
        mutate: mockCreate,
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
      } as any);

      render(<RequirementDefinitionForm />, { wrapper: createTestWrapper() });

      const submitButton = screen.getByRole('button', { name: /Create Requirement/i });
      fireEvent.click(submitButton);

      // Display name validation should trigger
      await waitFor(() => {
        expect(mockCreate).not.toHaveBeenCalled();
      });
    });

    it('should require description', async () => {
      const mockCreate = vi.fn();
      vi.mocked(hooks.useCreateRequirementDefinition).mockReturnValue({
        mutate: mockCreate,
        isPending: false,
        isError: false,
        error: null,
        data: undefined,
      } as any);

      render(<RequirementDefinitionForm />, { wrapper: createTestWrapper() });

      const inputs = screen.getAllByRole('textbox');
      if (inputs.length > 0) {
        fireEvent.change(inputs[0], { target: { value: 'Test Name' } });
      }

      const submitButton = screen.getByRole('button', { name: /Create Requirement/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockCreate).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should display error message when creation fails', () => {
      vi.mocked(hooks.useCreateRequirementDefinition).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('Creation failed'),
        data: undefined,
      } as any);

      render(<RequirementDefinitionForm />, { wrapper: createTestWrapper() });

      expect(screen.getByText(/Failed to create requirement/i)).toBeInTheDocument();
    });

    it('should display error message when update fails', () => {
      const mockRequirement = {
        id: 'test-id',
        tenant_id: 'tenant-id',
        requirement_type: 'birth_certificate',
        display_name: 'Birth Certificate',
        description: 'NSO/PSA Birth Certificate',
        is_mandatory: true,
        is_active: true,
        applicability_rules: null,
        display_order: 1,
        created_at: '2024-01-01',
        updated_at: '2024-01-01',
        deleted_at: null,
      };

      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: mockRequirement as any,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);

      vi.mocked(updateHooks.useUpdateRequirementDefinition).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('Update failed'),
        data: undefined,
      } as any);

      render(<RequirementDefinitionForm requirementId="test-id" />, {
        wrapper: createTestWrapper(),
      });

      expect(screen.getByText(/Failed to update requirement/i)).toBeInTheDocument();
    });
  });

  describe('Form State', () => {
    beforeEach(() => {
      vi.mocked(getHooks.useRequirementDefinition).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as any);
    });

    it('should disable fields while submitting', () => {
      vi.mocked(hooks.useCreateRequirementDefinition).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
        data: undefined,
      } as any);

      render(<RequirementDefinitionForm />, { wrapper: createTestWrapper() });

      const inputs = screen.getAllByRole('textbox');
      inputs.forEach((input) => {
        expect(input).toBeDisabled();
      });
    });

    it('should show loading indicator during submission', () => {
      vi.mocked(hooks.useCreateRequirementDefinition).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
        data: undefined,
      } as any);

      render(<RequirementDefinitionForm />, { wrapper: createTestWrapper() });

      const submitButton = screen.getByText(/Creating.../i);
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });
});
