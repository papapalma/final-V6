import axios, { AxiosError } from 'axios';
import { api } from './api';

/**
 * Profile field validation types and interfaces
 */
export interface ValidationError {
  field: string;
  message: string;
}

export interface ProfileField {
  name: string;
  value: string | Date | null;
  type: 'text' | 'email' | 'tel' | 'date' | 'select' | 'textarea';
}

export interface ProfileSection {
  id: string;
  label: string;
  fields: ProfileField[];
}

export interface SaveResult {
  success: boolean;
  message: string;
  errors?: ValidationError[];
  data?: Record<string, any>;
}

/**
 * Email validation function
 * Validates email format according to RFC 5322 simplified rules
 *
 * @param email - Email address to validate
 * @returns boolean - true if email format is valid
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // RFC 5322 simplified regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Phone number validation function
 * Validates phone format (supports multiple formats)
 *
 * @param phone - Phone number to validate
 * @returns boolean - true if phone format is valid
 */
export function validatePhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-(\).]/g, '');

  // Check if it contains only digits and is reasonable length (7-15 digits)
  // Supports international format
  const phoneRegex = /^\+?1?\d{7,15}$/;
  return phoneRegex.test(cleaned);
}

/**
 * Date format validation function
 * Validates if date string is in valid format and represents a valid date
 *
 * @param dateString - Date string to validate
 * @returns boolean - true if date is valid and in the past (birth dates) or reasonable future
 */
export function validateDateFormat(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') {
    return false;
  }

  // Try to parse the date
  const date = new Date(dateString);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return false;
  }

  // Optional: Check if date is not in the future (for birth dates)
  // This is implementation-specific and might need adjustment
  const today = new Date();
  if (date > today) {
    return false;
  }

  return true;
}

/**
 * Validate a single profile field
 *
 * @param field - Field to validate
 * @returns ValidationError | null - Error object if validation fails, null if valid
 */
export function validateField(field: ProfileField): ValidationError | null {
  const { name, value, type } = field;

  // Check for required fields
  if (!value || (typeof value === 'string' && !value.trim())) {
    return {
      field: name,
      message: `${name} is required`,
    };
  }

  // Type-specific validation
  switch (type) {
    case 'email':
      if (!validateEmail(String(value))) {
        return {
          field: name,
          message: `${name} must be a valid email address`,
        };
      }
      break;

    case 'tel':
      if (!validatePhone(String(value))) {
        return {
          field: name,
          message: `${name} must be a valid phone number`,
        };
      }
      break;

    case 'date':
      if (!validateDateFormat(String(value))) {
        return {
          field: name,
          message: `${name} must be a valid date`,
        };
      }
      break;

    default:
      // text, textarea, select - basic string validation
      if (typeof value !== 'string' || value.trim().length === 0) {
        return {
          field: name,
          message: `${name} cannot be empty`,
        };
      }
  }

  return null;
}

/**
 * Validate multiple profile fields
 *
 * @param fields - Array of fields to validate
 * @returns ValidationError[] - Array of validation errors (empty if all valid)
 */
export function validateFields(fields: ProfileField[]): ValidationError[] {
  return fields
    .map(validateField)
    .filter((error): error is ValidationError => error !== null);
}

/**
 * Save a profile section to the backend
 * Batches changes per section for efficient API calls
 *
 * @param sectionId - The section identifier
 * @param data - The profile data to save
 * @returns SaveResult - Result of the save operation
 */
export async function saveSectionChanges(
  sectionId: string,
  data: Record<string, any>
): Promise<SaveResult> {
  try {
    // Prepare the payload
    const payload = {
      section: sectionId,
      data,
    };

    // Make API call to save changes
    const response = await api.put('/api/trainee/profile', payload);

    // Check if response is successful
    if (response.success || (response as any).status === 200 || (response as any).status === 201) {
      return {
        success: true,
        message: `${sectionId} section saved successfully`,
        data: response.data,
      };
    }

    return {
      success: false,
      message: 'Failed to save changes',
    };
  } catch (error) {
    // Handle specific error types
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ message?: string; errors?: ValidationError[] }>;

      if (axiosError.response?.status === 422 || axiosError.response?.status === 400) {
        // Validation error from backend
        return {
          success: false,
          message: axiosError.response.data?.message || 'Validation failed',
          errors: axiosError.response.data?.errors || [],
        };
      }

      if (axiosError.response?.status === 401 || axiosError.response?.status === 403) {
        return {
          success: false,
          message: 'You are not authorized to make this change',
        };
      }

      if (axiosError.response?.status === 404) {
        return {
          success: false,
          message: 'Profile not found',
        };
      }

      if (axiosError.response?.status === 500) {
        return {
          success: false,
          message: 'Server error. Please try again later.',
        };
      }

      // Network error or other axios error
      if (!axiosError.response) {
        return {
          success: false,
          message: 'Network error. Please check your connection.',
        };
      }
    }

    // Generic error
    return {
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
}

/**
 * Revert unsaved changes by clearing them from state
 * Used when user clicks cancel
 *
 * @returns void - Call this to reset unsaved changes
 */
export function resetUnsavedChanges(): void {
  // This is typically called in the component to clear local state
  // The actual reset is handled by the component's state management
}

/**
 * Main profile service object with all validation and save functions
 */
export const profileService = {
  validateEmail,
  validatePhone,
  validateDateFormat,
  validateField,
  validateFields,
  saveSectionChanges,
  resetUnsavedChanges,
};

export default profileService;
