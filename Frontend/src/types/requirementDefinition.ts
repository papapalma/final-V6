/**
 * Requirement Definition Types
 * 
 * Type definitions for requirement definitions used throughout the training
 * requirements management system.
 */

/**
 * Submission statistics for a requirement definition
 * Tracks the number of trainees in each submission status
 */
export interface SubmissionStats {
  /** Total number of trainees with this requirement */
  total_trainees: number;
  /** Number of trainees with pending status */
  pending_count: number;
  /** Number of trainees with submitted status */
  submitted_count: number;
  /** Number of trainees with verified status */
  verified_count: number;
  /** Number of trainees with rejected status */
  rejected_count: number;
  /** Number of trainees with waived status */
  waived_count?: number;
  /** Overall completion rate (0-100) */
  completion_rate: number;
}

/**
 * Applicability rules for a requirement
 * Defines conditions for when a requirement applies to a trainee
 * 
 * Example: { marital_status: "married" } means only married trainees must submit
 */
export interface ApplicabilityRules {
  [key: string]: any;
}

/**
 * Requirement Definition
 * Represents a training requirement definition stored in the database
 */
export interface RequirementDefinition {
  /** Unique identifier (UUID) */
  id: string;
  /** Tenant ID for multi-tenancy isolation */
  tenant_id: string;
  /** Requirement type enum (accomplished_learners_profile_form, birth_certificate_copy, etc.) */
  requirement_type: string;
  /** Display name shown to admins and trainees */
  display_name: string;
  /** Detailed description/instructions for trainees */
  description: string;
  /** Whether this requirement is mandatory for all trainees */
  is_mandatory: boolean;
  /** Whether this requirement is currently active */
  is_active: boolean;
  /** Conditions for applicability (e.g., only married women) */
  applicability_rules: ApplicabilityRules | null;
  /** Display order for sorting in UI */
  display_order: number;
  /** Timestamp of creation */
  created_at: string;
  /** Timestamp of last update */
  updated_at: string;
  /** Timestamp of soft delete (null if not deleted) */
  deleted_at: string | null;
  /** Submission statistics for this requirement */
  submission_stats?: SubmissionStats;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  /** Current page number */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  totalPages: number;
  /** Whether there is a next page */
  hasNextPage: boolean;
  /** Whether there is a previous page */
  hasPreviousPage: boolean;
}

/**
 * API Response for requirement definitions list
 */
export interface RequirementDefinitionsResponse {
  /** Success status */
  success: boolean;
  /** Array of requirement definitions */
  data: RequirementDefinition[];
  /** Pagination metadata */
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Query options for useRequirementDefinitions hook
 */
export interface UseRequirementDefinitionsOptions {
  /** Sort by field: name, mandatory, completion_rate */
  sortBy?: 'name' | 'mandatory' | 'completion_rate';
  /** Filter by active status */
  isActive?: boolean;
  /** Pagination page number (1-indexed) */
  page?: number;
  /** Items per page (default 20, max 100) */
  limit?: number;
  /** Whether to enable the query (defaults to true) */
  enabled?: boolean;
}

/**
 * Return type for useRequirementDefinitions hook
 */
export interface UseRequirementDefinitionsResult {
  /** Array of requirement definitions */
  data: RequirementDefinition[];
  /** Whether data is currently being fetched */
  isLoading: boolean;
  /** Whether an error occurred during fetch */
  isError: boolean;
  /** Error object if fetch failed, null otherwise */
  error: Error | null;
  /** Pagination metadata */
  pagination: PaginationInfo;
  /** Function to manually refetch the data */
  refetch: () => Promise<void>;
}

/**
 * Payload for creating a new requirement definition
 * Used by useCreateRequirementDefinition hook
 */
export interface CreateRequirementPayload {
  /** Display name for the requirement */
  displayName: string;
  /** Detailed description/instructions for trainees */
  description: string;
  /** Whether this requirement is mandatory for all trainees */
  isMandatory: boolean;
  /** Whether this requirement is currently active */
  isActive?: boolean;
  /** Conditions for applicability (e.g., only married women) */
  applicabilityRules?: ApplicabilityRules | null;
}

/**
 * Payload for updating a requirement definition
 * Used by useUpdateRequirementDefinition hook
 */
export interface UpdateRequirementPayload {
  /** Display name for the requirement (optional update field) */
  displayName?: string;
  /** Detailed description/instructions for trainees (optional update field) */
  description?: string;
  /** Whether this requirement is mandatory (optional update field) */
  isMandatory?: boolean;
  /** Whether this requirement is currently active (optional update field) */
  isActive?: boolean;
  is_active?: boolean;
  is_mandatory?: boolean;
  display_name?: string;
}
