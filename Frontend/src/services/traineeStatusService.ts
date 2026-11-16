import api from './api';

/**
 * Trainee Status API Service
 * Manages post-graduation outcomes and employment tracking
 */

/**
 * TraineeStatusRecord: Post-graduation outcome tracking
 */
export interface TraineeStatusRecord {
  id: string;
  tenant_id: string;
  trainee_id: string;
  enrollment_id: string;
  tenantId?: string;
  traineeId?: string;
  enrollmentId?: string;

  // Graduation status
  graduation_status: 'pending' | 'graduated' | 'not_completed' | 'suspended';
  graduationStatus?: 'pending' | 'graduated' | 'not_completed' | 'suspended';
  graduation_date?: string | null;
  graduationDate?: string | null;
  certificate_id?: string | null;
  certificateId?: string | null;

  // Employment/outcome status
  employment_status: 'pending' | 'employed' | 'unemployed' | 'self_employed' | 'pursuing_education' | 'deceased';
  employmentStatus?: 'pending' | 'employed' | 'unemployed' | 'self_employed' | 'pursuing_education' | 'deceased';

  // Employment details
  job_title?: string | null;
  jobTitle?: string | null;
  employer_name?: string | null;
  employerName?: string | null;
  job_start_date?: string | null;
  jobStartDate?: string | null;
  job_sector?: string | null;
  jobSector?: string | null;

  // Skills match assessment
  skills_match?: 'exact_match' | 'partial_match' | 'no_match' | 'not_applicable' | null;
  skillsMatch?: 'exact_match' | 'partial_match' | 'no_match' | 'not_applicable' | null;
  skills_match_percentage?: number | null;
  skillsMatchPercentage?: number | null;

  // Remarks and feedback
  remarks?: string | null;
  unemployment_reason?: string | null;
  unemploymentReason?: string | null;

  // Audit
  recorded_by: string;
  recordedBy?: string;
  recorded_at: string;
  recordedAt?: string;
  last_updated_by?: string | null;
  lastUpdatedBy?: string | null;
  updated_at: string;
  updatedAt?: string;
  deleted_at?: string | null;
  deletedAt?: string | null;

  // Relations
  trainee?: any;
  enrollment?: any;
  certificate?: any;
}

/**
 * Create trainee status data
 */
export interface CreateTraineeStatusData {
  trainee_id: string;
  enrollment_id: string;
  graduation_status: 'pending' | 'graduated' | 'not_completed' | 'suspended';
  graduation_date?: string | null;
  certificate_id?: string | null;
  employment_status: 'pending' | 'employed' | 'unemployed' | 'self_employed' | 'pursuing_education' | 'deceased';
  job_title?: string | null;
  employer_name?: string | null;
  job_start_date?: string | null;
  job_sector?: string | null;
  skills_match?: 'exact_match' | 'partial_match' | 'no_match' | 'not_applicable' | null;
  skills_match_percentage?: number | null;
  remarks?: string | null;
  unemployment_reason?: string | null;
}

/**
 * Update trainee status data (partial)
 */
export interface UpdateTraineeStatusData extends Partial<CreateTraineeStatusData> {
  status?: 'pending' | 'employed' | 'unemployed' | 'self_employed' | 'pursuing_education' | 'deceased';
}

/**
 * Employment summary statistics
 */
export interface EmploymentSummary {
  total_completed_trainees: number;
  total_graduated: number;
  total_employed: number;
  total_unemployed: number;
  total_deceased: number;
  employment_rate: number;
  skills_match_stats: {
    exact_match: number;
    partial_match: number;
    no_match: number;
    not_applicable: number;
  };
  average_skills_match_percentage: number;
}

/**
 * Trainee status overview
 */
export interface TraineeStatusOverview {
  graduated_count: number;
  employed_count: number;
  unemployed_count: number;
  deceased_count: number;
  pending_count: number;
}

/**
 * Trainee status filters
 */
export interface TraineeStatusFilters {
  graduation_status?: 'pending' | 'graduated' | 'not_completed' | 'suspended';
  employment_status?: 'pending' | 'employed' | 'unemployed' | 'self_employed' | 'pursuing_education' | 'deceased';
  skills_match?: 'exact_match' | 'partial_match' | 'no_match' | 'not_applicable';
  job_sector?: string;
  program_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

class TraineeStatusService {
  /**
   * Get all trainee status records with filters
   */
  async getTraineeStatusRecords(filters?: TraineeStatusFilters) {
    const response = await api.get<TraineeStatusRecord[]>('/trainee-status', filters);
    return response;
  }

  /**
   * Get trainee status record by ID
   */
  async getTraineeStatusById(id: string): Promise<TraineeStatusRecord> {
    const response = await api.get<TraineeStatusRecord>(`/trainee-status/${id}`);
    return response.data;
  }

  /**
   * Get trainee status for an enrollment
   */
  async getTraineeStatusByEnrollment(enrollmentId: string): Promise<TraineeStatusRecord | null> {
    try {
      const response = await api.get<TraineeStatusRecord>(`/trainee-status/enrollment/${enrollmentId}`);
      return response.data;
    } catch (error: any) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Create new trainee status record
   */
  async createTraineeStatus(data: CreateTraineeStatusData): Promise<TraineeStatusRecord> {
    const response = await api.post<TraineeStatusRecord>('/trainee-status', data);
    return response.data;
  }

  /**
   * Update trainee status record
   */
  async updateTraineeStatus(id: string, data: UpdateTraineeStatusData): Promise<TraineeStatusRecord> {
    const response = await api.put<TraineeStatusRecord>(`/trainee-status/${id}`, data);
    return response.data;
  }

  /**
   * Delete trainee status record
   */
  async deleteTraineeStatus(id: string): Promise<void> {
    await api.delete(`/trainee-status/${id}`);
  }

  /**
   * Get employment summary statistics
   */
  async getEmploymentSummary(filters?: {
    program_id?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<EmploymentSummary> {
    const response = await api.get<EmploymentSummary>('/trainee-status/summary', filters);
    return response.data;
  }

  /**
   * Get trainee status overview for dashboard
   */
  async getTraineeStatusOverview(): Promise<TraineeStatusOverview> {
    const response = await api.get<TraineeStatusOverview>('/trainee-status/overview');
    return response.data;
  }
}

export const traineeStatusService = new TraineeStatusService();
export default traineeStatusService;
