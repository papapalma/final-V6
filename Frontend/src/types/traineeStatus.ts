import { z } from 'zod';

/**
 * TraineeStatusRecord Interface
 * Matches the backend trainee_status_records schema with all fields
 * for graduation, employment, skills assessment, and audit tracking.
 */
export interface TraineeStatusRecord {
  id: string;
  tenantId: string;
  traineeId: string;
  enrollmentId: string;
  tenant_id?: string;
  trainee_id?: string;
  enrollment_id?: string;

  // Graduation Section
  graduationStatus: 'pending' | 'graduated' | 'not_completed' | 'suspended';
  graduation_status?: 'pending' | 'graduated' | 'not_completed' | 'suspended';
  graduationDate?: string | null; // ISO 8601 date (YYYY-MM-DD)
  graduation_date?: string | null;
  certificateId?: string | null;
  certificate_id?: string | null;

  // Employment Section
  employmentStatus: 'pending' | 'employed' | 'unemployed' | 'self_employed' | 'pursuing_education' | 'deceased';
  employment_status?: 'pending' | 'employed' | 'unemployed' | 'self_employed' | 'pursuing_education' | 'deceased';
  jobTitle?: string | null; // max 255 chars
  job_title?: string | null;
  employerName?: string | null; // max 255 chars
  employer_name?: string | null;
  jobStartDate?: string | null; // ISO 8601 date (YYYY-MM-DD)
  job_start_date?: string | null;
  jobSector?: string | null; // free-text field
  job_sector?: string | null;
  unemploymentReason?: string | null; // max 500 chars
  unemployment_reason?: string | null;

  // Skills Assessment Section
  skillsMatch?: 'exact_match' | 'partial_match' | 'no_match' | 'not_applicable' | null;
  skills_match?: 'exact_match' | 'partial_match' | 'no_match' | 'not_applicable' | null;
  skillsMatchPercentage?: number | null; // 0-100
  skills_match_percentage?: number | null;
  remarks?: string | null; // max 1000 chars

  // Audit Trail Section
  recordedBy: string; // user ID
  recorded_by?: string;
  recordedAt: string; // ISO 8601 timestamp
  recorded_at?: string;
  lastUpdatedBy?: string | null; // user ID
  last_updated_by?: string | null;
  updatedAt: string; // ISO 8601 timestamp
  updated_at?: string;

  // Soft Delete
  deletedAt?: string | null; // ISO 8601 timestamp
  deleted_at?: string | null;
  
  // Relations
  trainee?: any;
  enrollment?: any;
  certificate?: any;
}

/**
 * TraineeStatusCardProps
 * Props interface for the TraineeStatusCard component
 * Used to display a compact summary of trainee status on profile page
 */
export interface TraineeStatusCardProps {
  statusRecord: TraineeStatusRecord | null;
  isLoading?: boolean;
  error?: string;
  onViewDetails?: () => void;
}

/**
 * TraineeStatusTableProps
 * Props interface for the TraineeStatusTable component
 * Used to display multiple trainee status records in a sortable, filterable table
 */
export interface TraineeStatusTableProps {
  records: TraineeStatusRecord[];
  isLoading?: boolean;
  error?: string;
  filters?: TraineeStatusFilters;
  onFiltersChange?: (filters: TraineeStatusFilters) => void;
  sort?: TraineeStatusSort;
  onSortChange?: (sort: TraineeStatusSort) => void;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
  onViewRecord?: (recordId: string) => void;
}

/**
 * TraineeStatusFilters
 * Filter criteria for table view
 * Supports filtering by employment status, skills match, and graduation status
 */
export interface TraineeStatusFilters {
  employmentStatus?: string[];
  skillsMatch?: string[];
  graduationStatus?: string[];
  searchTerm?: string;
}

/**
 * TraineeStatusSort
 * Sort configuration for table view
 * Specifies which column to sort by and sort direction
 */
export interface TraineeStatusSort {
  column: 'name' | 'graduation_date' | 'employment_status' | 'skills_match' | 'recorded_at';
  direction: 'asc' | 'desc';
}

/**
 * PaginationInfo
 * Pagination metadata for table view
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

/**
 * TraineeStatusModalProps
 * Props interface for the TraineeStatusModal component
 * Used to display detailed status information and provide editing capability
 */
export interface TraineeStatusModalProps {
  recordId: string;
  enrollmentId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
  readOnly?: boolean;
}

/**
 * FilterBarProps
 * Props interface for the FilterBar component
 * Used to filter status records by employment, skills, and graduation criteria
 */
export interface FilterBarProps {
  filters: TraineeStatusFilters;
  onFiltersChange: (filters: TraineeStatusFilters) => void;
}

/**
 * Zod Validation Schema for Trainee Status Form
 *
 * Validates all fields including:
 * - Field presence and types
 * - Field length constraints
 * - Range constraints for numeric fields
 * - Conditional validation (job fields required if employed)
 *
 * Conditional Validation Rules:
 * - If employmentStatus is "employed" or "self_employed": jobTitle and employerName are required
 * - If employmentStatus is "unemployed": jobTitle and employerName are optional
 * - If employmentStatus is "pursuing_education" or "deceased": all employment fields are hidden
 * - skillsMatchPercentage must be 0-100 if provided
 * - remarks max 1000 characters
 * - unemploymentReason max 500 characters
 * - jobTitle max 255 characters
 * - employerName max 255 characters
 */
export const traineeStatusSchema = z
  .object({
    // Graduation Section
    graduationStatus: z.enum(['pending', 'graduated', 'not_completed', 'suspended']),
    graduationDate: z.string().date().nullable().optional().or(z.literal('')),

    // Employment Section
    employmentStatus: z.enum(['pending', 'employed', 'unemployed', 'self_employed', 'pursuing_education', 'deceased']),
    jobTitle: z
      .string()
      .max(255, { message: 'Job title must not exceed 255 characters' })
      .nullable()
      .optional()
      .or(z.literal('')),
    employerName: z
      .string()
      .max(255, { message: 'Employer name must not exceed 255 characters' })
      .nullable()
      .optional()
      .or(z.literal('')),
    jobStartDate: z.string().date().nullable().optional().or(z.literal('')),
    jobSector: z.string().nullable().optional().or(z.literal('')),
    unemploymentReason: z
      .string()
      .max(500, { message: 'Unemployment reason must not exceed 500 characters' })
      .nullable()
      .optional()
      .or(z.literal('')),

    // Skills Assessment Section
    skillsMatch: z.enum(['exact_match', 'partial_match', 'no_match', 'not_applicable']).nullable().optional(),
    skillsMatchPercentage: z
      .number()
      .int()
      .min(0, { message: 'Skills match percentage must be between 0 and 100' })
      .max(100, { message: 'Skills match percentage must be between 0 and 100' })
      .nullable()
      .optional(),
    remarks: z
      .string()
      .max(1000, { message: 'Remarks must not exceed 1000 characters' })
      .nullable()
      .optional()
      .or(z.literal('')),
  })
  .refine((data) => {
    // If employed or self-employed, require job_title and employer_name
    if (['employed', 'self_employed'].includes(data.employmentStatus)) {
      const hasJobTitle = data.jobTitle && data.jobTitle.trim() !== '';
      const hasEmployerName = data.employerName && data.employerName.trim() !== '';
      return hasJobTitle && hasEmployerName;
    }
    return true;
  }, {
    message: 'Job title and employer name are required for employed status',
    path: ['jobTitle'],
  });

/**
 * Type inference from Zod schema for use in form handling
 */
export type TraineeStatusFormData = z.infer<typeof traineeStatusSchema>;

/**
 * Employment Status Values
 * Enum-like object for employment status options
 */
export const EMPLOYMENT_STATUS_OPTIONS = {
  PENDING: 'pending',
  EMPLOYED: 'employed',
  UNEMPLOYED: 'unemployed',
  SELF_EMPLOYED: 'self_employed',
  PURSUING_EDUCATION: 'pursuing_education',
  DECEASED: 'deceased',
} as const;

/**
 * Graduation Status Values
 * Enum-like object for graduation status options
 */
export const GRADUATION_STATUS_OPTIONS = {
  PENDING: 'pending',
  GRADUATED: 'graduated',
  NOT_COMPLETED: 'not_completed',
  SUSPENDED: 'suspended',
} as const;

/**
 * Skills Match Values
 * Enum-like object for skills match options
 */
export const SKILLS_MATCH_OPTIONS = {
  EXACT_MATCH: 'exact_match',
  PARTIAL_MATCH: 'partial_match',
  NO_MATCH: 'no_match',
  NOT_APPLICABLE: 'not_applicable',
} as const;

/**
 * Display labels for employment status values
 */
export const EMPLOYMENT_STATUS_LABELS: Record<string, string> = {
  [EMPLOYMENT_STATUS_OPTIONS.PENDING]: 'Pending',
  [EMPLOYMENT_STATUS_OPTIONS.EMPLOYED]: 'Employed',
  [EMPLOYMENT_STATUS_OPTIONS.UNEMPLOYED]: 'Unemployed',
  [EMPLOYMENT_STATUS_OPTIONS.SELF_EMPLOYED]: 'Self-Employed',
  [EMPLOYMENT_STATUS_OPTIONS.PURSUING_EDUCATION]: 'Pursuing Education',
  [EMPLOYMENT_STATUS_OPTIONS.DECEASED]: 'Deceased',
};

/**
 * Display labels for graduation status values
 */
export const GRADUATION_STATUS_LABELS: Record<string, string> = {
  [GRADUATION_STATUS_OPTIONS.PENDING]: 'Pending',
  [GRADUATION_STATUS_OPTIONS.GRADUATED]: 'Graduated',
  [GRADUATION_STATUS_OPTIONS.NOT_COMPLETED]: 'Not Completed',
  [GRADUATION_STATUS_OPTIONS.SUSPENDED]: 'Suspended',
};

/**
 * Display labels for skills match values
 */
export const SKILLS_MATCH_LABELS: Record<string, string> = {
  [SKILLS_MATCH_OPTIONS.EXACT_MATCH]: 'Exact Match',
  [SKILLS_MATCH_OPTIONS.PARTIAL_MATCH]: 'Partial Match',
  [SKILLS_MATCH_OPTIONS.NO_MATCH]: 'No Match',
  [SKILLS_MATCH_OPTIONS.NOT_APPLICABLE]: 'Not Applicable',
};

/**
 * Color coding for employment status badges
 */
export const EMPLOYMENT_STATUS_COLORS: Record<string, string> = {
  [EMPLOYMENT_STATUS_OPTIONS.EMPLOYED]: 'green',
  [EMPLOYMENT_STATUS_OPTIONS.SELF_EMPLOYED]: 'green',
  [EMPLOYMENT_STATUS_OPTIONS.PURSUING_EDUCATION]: 'yellow',
  [EMPLOYMENT_STATUS_OPTIONS.UNEMPLOYED]: 'gray',
  [EMPLOYMENT_STATUS_OPTIONS.DECEASED]: 'black',
  [EMPLOYMENT_STATUS_OPTIONS.PENDING]: 'blue',
};

/**
 * Color coding for graduation status badges
 */
export const GRADUATION_STATUS_COLORS: Record<string, string> = {
  [GRADUATION_STATUS_OPTIONS.GRADUATED]: 'green',
  [GRADUATION_STATUS_OPTIONS.PENDING]: 'yellow',
  [GRADUATION_STATUS_OPTIONS.SUSPENDED]: 'orange',
  [GRADUATION_STATUS_OPTIONS.NOT_COMPLETED]: 'red',
};

/**
 * Color coding for skills match badges
 */
export const SKILLS_MATCH_COLORS: Record<string, string> = {
  [SKILLS_MATCH_OPTIONS.EXACT_MATCH]: 'green',
  [SKILLS_MATCH_OPTIONS.PARTIAL_MATCH]: 'yellow',
  [SKILLS_MATCH_OPTIONS.NO_MATCH]: 'gray',
  [SKILLS_MATCH_OPTIONS.NOT_APPLICABLE]: 'blue',
};

/**
 * Conditional field visibility map
 * Determines which employment-related fields should be visible based on employment status
 */
export const CONDITIONAL_FIELD_VISIBILITY: Record<string, {
  showJobFields: boolean;
  showUnemploymentReason: boolean;
}> = {
  [EMPLOYMENT_STATUS_OPTIONS.EMPLOYED]: {
    showJobFields: true,
    showUnemploymentReason: false,
  },
  [EMPLOYMENT_STATUS_OPTIONS.SELF_EMPLOYED]: {
    showJobFields: true,
    showUnemploymentReason: false,
  },
  [EMPLOYMENT_STATUS_OPTIONS.UNEMPLOYED]: {
    showJobFields: false,
    showUnemploymentReason: true,
  },
  [EMPLOYMENT_STATUS_OPTIONS.PURSUING_EDUCATION]: {
    showJobFields: false,
    showUnemploymentReason: false,
  },
  [EMPLOYMENT_STATUS_OPTIONS.DECEASED]: {
    showJobFields: false,
    showUnemploymentReason: false,
  },
  [EMPLOYMENT_STATUS_OPTIONS.PENDING]: {
    showJobFields: false,
    showUnemploymentReason: false,
  },
};

/**
 * Field requirements map
 * Determines which fields are required based on employment status
 */
export const REQUIRED_FIELDS_BY_STATUS: Record<string, string[]> = {
  [EMPLOYMENT_STATUS_OPTIONS.EMPLOYED]: ['jobTitle', 'employerName'],
  [EMPLOYMENT_STATUS_OPTIONS.SELF_EMPLOYED]: ['jobTitle', 'employerName'],
  [EMPLOYMENT_STATUS_OPTIONS.UNEMPLOYED]: [],
  [EMPLOYMENT_STATUS_OPTIONS.PURSUING_EDUCATION]: [],
  [EMPLOYMENT_STATUS_OPTIONS.DECEASED]: [],
  [EMPLOYMENT_STATUS_OPTIONS.PENDING]: [],
};

/**
 * Validation Error Map Type
 * Maps field names to error messages
 */
export interface ValidationErrorMap {
  [fieldName: string]: string;
}

/**
 * Parse Zod validation errors into field-level error map
 *
 * Converts ZodError format into a simple object mapping field names to error messages.
 * This makes it easy to display validation errors in form fields.
 *
 * Example:
 * ```
 * const schema = z.object({ name: z.string().min(1) });
 * const result = schema.safeParse({});
 * if (!result.success) {
 *   const errors = parseValidationError(result.error);
 *   console.log(errors); // { name: "String must contain at least 1 character(s)" }
 * }
 * ```
 *
 * @param zodError - The ZodError from schema validation
 * @returns Object mapping field names to error messages
 */
export function parseValidationError(zodError: z.ZodError): ValidationErrorMap {
  const errorMap: ValidationErrorMap = {};

  // Iterate through all issues in the Zod error
  const issues = (zodError.issues || (zodError as any).errors || []);
  issues.forEach((error: any) => {
    // Get the field path (e.g., "jobTitle" or "nested.field")
    const fieldPath = error.path.join('.');

    // Use the first error message for each field (prefer custom messages)
    if (!errorMap[fieldPath]) {
      errorMap[fieldPath] = error.message;
    }
  });

  return errorMap;
}

/**
 * Validate trainee status form data against the Zod schema
 *
 * Wraps the schema validation with error parsing for convenient use in components.
 * Returns both success status and error map for easy form state management.
 *
 * Example:
 * ```
 * const formData = { graduationStatus: 'graduated', employmentStatus: 'employed' };
 * const { success, errors } = validateTraineeStatus(formData);
 * if (!success) {
 *   // Show errors in form
 *   setFieldErrors(errors);
 * }
 * ```
 *
 * @param data - The form data to validate (any type, will be validated against schema)
 * @returns Object with success flag and error map (empty if validation passes)
 */
export function validateTraineeStatus(data: unknown): {
  success: boolean;
  errors: ValidationErrorMap;
} {
  const result = traineeStatusSchema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: parseValidationError(result.error),
    };
  }

  return {
    success: true,
    errors: {},
  };
}
