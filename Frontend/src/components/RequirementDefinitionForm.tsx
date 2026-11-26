/**
 * RequirementDefinitionForm Component
 *
 * A controlled form component for creating and editing requirement definitions.
 * Supports both create (POST) and update (PATCH) modes with comprehensive validation.
 *
 * Features:
 * - Create new requirement definitions or edit existing ones
 * - Form validation using Zod schema
 * - Dynamic applicability rules as JSON
 * - Loading and error states during submission
 * - Success/error toast notifications
 * - Field-level error messages
 * - Uses shadcn/ui components (Form, Input, Textarea, Switch, Dialog)
 * - Follows project's form patterns and Tailwind CSS
 *
 * Props:
 * - requirementId?: string - Optional ID for editing mode; if not provided, component is in create mode
 * - onSuccess?: () => void - Optional callback triggered after successful create/update
 *
 * Example:
 * ```tsx
 * // Create mode
 * <RequirementDefinitionForm onSuccess={() => navigate('/requirements')} />
 *
 * // Edit mode
 * <RequirementDefinitionForm
 *   requirementId="uuid-here"
 *   onSuccess={() => navigate('/requirements')}
 * />
 * ```
 *
 * **Validates: Requirements 2.3, 2.4, Frontend admin components**
 */

import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import logger from '../utils/logger';

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from './ui/form';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react';

import { useCreateRequirementDefinition } from '../hooks/useCreateRequirementDefinition';
import { useUpdateRequirementDefinition } from '../hooks/useUpdateRequirementDefinition';
import { useRequirementDefinition } from '../hooks/useRequirementDefinition';
import type { RequirementDefinition } from '../types/requirementDefinition';

/**
 * Zod validation schema for requirement definition form data
 *
 * Validates:
 * - displayName: required, 1-255 characters, trimmed
 * - description: required, 1-1000 characters, trimmed
 * - isMandatory: required boolean
 * - isActive: required boolean
 * - applicabilityRules: optional valid JSON object
 */
const requirementFormSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(255, 'Display name must not exceed 255 characters')
    .transform((val) => val.trim()),

  description: z
    .string()
    .min(1, 'Description is required')
    .max(1000, 'Description must not exceed 1000 characters')
    .transform((val) => val.trim()),

  isMandatory: z
    .boolean()
    .default(true)
    .describe('Whether this requirement is mandatory for all trainees'),

  isActive: z
    .boolean()
    .default(true)
    .describe('Whether this requirement is currently active'),

  applicabilityRules: z
    .string()
    .optional()
    .default('')
    .refine(
      (val) => {
        if (!val || val.trim().length === 0) return true;
        try {
          JSON.parse(val);
          return true;
        } catch {
          return false;
        }
      },
      'Applicability rules must be valid JSON (or leave empty)'
    )
    .transform((val) => {
      if (!val || val.trim().length === 0) return null;
      try {
        return JSON.parse(val);
      } catch {
        return null;
      }
    }),
});

type RequirementFormData = z.infer<typeof requirementFormSchema>;

interface RequirementDefinitionFormProps {
  requirementId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * RequirementDefinitionForm Component
 *
 * A controlled form for creating and editing requirement definitions.
 * Automatically detects create vs. edit mode based on requirementId prop.
 *
 * In edit mode:
 * - Fetches existing requirement data
 * - Pre-populates form fields
 * - Uses PATCH endpoint for updates
 * - Shows loading state while fetching data
 *
 * In create mode:
 * - Starts with empty form
 * - Uses POST endpoint
 * - No initial data fetch
 */
export function RequirementDefinitionForm({
  requirementId,
  onSuccess,
  onCancel,
}: RequirementDefinitionFormProps) {
  const queryClient = useQueryClient();

  // Determine mode (create vs edit)
  const isEditMode = !!requirementId;

  // Fetch existing requirement if in edit mode
  const {
    data: existingRequirement,
    isLoading: isLoadingRequirement,
    isError: isErrorLoadingRequirement,
    error: loadingError,
  } = useRequirementDefinition(requirementId || '');

  // Mutations for create and update
  const {
    mutate: createRequirement,
    isPending: isCreating,
    isError: isCreateError,
    error: createError,
  } = useCreateRequirementDefinition();
  const {
    mutate: updateRequirement,
    isPending: isUpdating,
    isError: isUpdateError,
    error: updateError,
  } = useUpdateRequirementDefinition();

  const isSubmitting = isCreating || isUpdating;

  // Initialize form with React Hook Form and Zod validation
  const form = useForm<any>({
    resolver: zodResolver(requirementFormSchema) as any,
    mode: 'onBlur',
    defaultValues: {
      displayName: '',
      description: '',
      isMandatory: true,
      isActive: true,
      applicabilityRules: '',
    },
  });

  // Populate form when existing requirement is loaded
  useEffect(() => {
    if (existingRequirement && isEditMode) {
      form.reset({
        displayName: existingRequirement.display_name,
        description: existingRequirement.description,
        isMandatory: existingRequirement.is_mandatory,
        isActive: existingRequirement.is_active,
        applicabilityRules: existingRequirement.applicability_rules
          ? JSON.stringify(existingRequirement.applicability_rules, null, 2)
          : '',
      });
    }
  }, [existingRequirement, isEditMode, form]);

  /**
   * Handle form submission
   * Routes to create or update based on mode
   */
  const onSubmit = async (data: RequirementFormData) => {
    try {
      logger.info('[RequirementDefinitionForm] Submitting requirement', {
        mode: isEditMode ? 'edit' : 'create',
        displayName: data.displayName,
      });

      if (isEditMode && requirementId) {
        // Update existing requirement (including applicabilityRules)
        await updateRequirement(requirementId, {
          displayName: data.displayName,
          description: data.description,
          isMandatory: data.isMandatory,
          isActive: data.isActive,
          applicabilityRules: data.applicabilityRules,
        });

        toast.success('Requirement updated successfully');
        logger.info('[RequirementDefinitionForm] Update successful', { requirementId });
      } else {
        // Create new requirement
        await createRequirement({
          displayName: data.displayName,
          description: data.description,
          isMandatory: data.isMandatory,
          isActive: data.isActive ?? true,
          applicabilityRules: data.applicabilityRules,
        });

        toast.success('Requirement created successfully');
        logger.info('[RequirementDefinitionForm] Create successful', {
          displayName: data.displayName,
        });

        // Reset form after successful creation
        form.reset();
      }

      // Call optional callback
      onSuccess?.();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save requirement';

      logger.error('[RequirementDefinitionForm] Submission failed', {
        mode: isEditMode ? 'edit' : 'create',
        error: errorMessage,
      });

      toast.error('Failed to save requirement', {
        description: errorMessage,
      });
    }
  };

  // Show loading state while fetching requirement in edit mode
  if (isEditMode && isLoadingRequirement) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Loading requirement definition...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error state if fetch failed
  if (isEditMode && isErrorLoadingRequirement) {
    return (
      <Card className="req-surface-in border-destructive/30 bg-destructive/10">
        <CardContent className="flex items-start gap-3 py-6">
          <AlertCircle className="size-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-destructive">Failed to Load</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {loadingError?.message ||
                'Could not load the requirement definition. Please try again.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show error if requirement was not found
  if (isEditMode && !isLoadingRequirement && !existingRequirement) {
    return (
      <Card className="req-surface-in border-destructive/30 bg-destructive/10">
        <CardContent className="flex items-start gap-3 py-6">
          <AlertCircle className="size-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-destructive">Requirement Not Found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              The requirement definition you're trying to edit does not exist.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="req-surface-in">
      <CardHeader>
        <CardTitle>
          {isEditMode ? 'Edit Requirement Definition' : 'Create Requirement Definition'}
        </CardTitle>
        <CardDescription>
          {isEditMode
            ? 'Update the requirement definition details. Only active admins can modify requirements.'
            : 'Define a new training requirement for your tenant. All fields are required.'}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Display error if submission failed */}
            {(isCreateError || isUpdateError) && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {isEditMode
                    ? `Failed to update requirement: ${updateError?.message || 'Please check your input and try again.'}`
                    : `Failed to create requirement: ${createError?.message || 'Please check your input and try again.'}`}
                </AlertDescription>
              </Alert>
            )}

            {/* Display Name Field */}
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Display Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Accomplished Learner's Profile Form"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    The name shown to admins and trainees. Max 255 characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description Field */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Description <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide clear instructions for trainees about this requirement. Explain what documents are needed, format requirements, etc."
                      className="min-h-24"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Detailed instructions shown to trainees. Max 1000 characters.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Mandatory Toggle */}
            <FormField
              control={form.control}
              name="isMandatory"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="cursor-pointer">Mandatory Requirement</FormLabel>
                    <FormDescription>
                      If enabled, all trainees must submit this requirement. If disabled, only
                      trainees matching applicability rules must submit it.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Active Toggle */}
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="cursor-pointer">Active</FormLabel>
                    <FormDescription>
                      If enabled, this requirement is shown to trainees and enforced. If disabled,
                      it won't be visible or required.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Applicability Rules Field */}
            <FormField
              control={form.control}
              name="applicabilityRules"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applicability Rules (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={`e.g., {"marital_status": "married"}\n\nLeave empty for all trainees.`}
                      className="font-mono text-sm min-h-24"
                      disabled={isSubmitting}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional JSON rules to limit applicability. Example: only married trainees
                    for marriage certificate. Leave empty if requirement applies to everyone.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <div className="flex gap-3 justify-end pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                className="py-2.5 px-4"
                onClick={() => {
                  if (onCancel) {
                    onCancel();
                  } else {
                    form.reset();
                  }
                }}
              >
                {onCancel ? 'Cancel' : isEditMode ? 'Reset' : 'Clear'}
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="gap-2 py-2.5 px-4"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="size-4" />
                    {isEditMode ? 'Update Requirement' : 'Create Requirement'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
