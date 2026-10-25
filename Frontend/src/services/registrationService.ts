import api from './api';

export interface PendingRegistration {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  phone: string;
  sex: 'Male' | 'Female';
  birth_date: string;
  birth_place: string;
  civil_status: string;
  province: string;
  municipality: string;
  barangay: string;
  street: string;
  educational_attainment: string;
  course: string;
  year_graduated: string;
  classification: string;
  disability?: string | null;
  employment_status: string;
  program_id: string;
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive';
  registration_status?: 'pending' | 'approved' | 'rejected' | 'completed';
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  updated_at: string;
  program?: {
    id: string;
    name: string;
    description?: string;
    start_date: string;
    end_date: string;
    status: string;
  };
}

export interface SubmitRegistrationData {
  // Credentials
  username: string;
  email: string;
  password: string;
  // Personal
  first_name: string;
  last_name: string;
  middle_name?: string;
  phone: string;
  sex: 'Male' | 'Female';
  birth_date: string;
  birth_place: string;
  civil_status: 'Single' | 'Married' | 'Widowed' | 'Separated';
  province: string;
  municipality: string;
  barangay: string;
  street: string;
  educational_attainment: string;
  course: string;
  year_graduated: string;
  classification: string;
  disability?: string | null;
  employment_status: string;
  program_id: string;
  tenant_id: string;  // NEW: required field for tenant selection
  enrollment_source?: 'social_share' | 'direct';  // NEW: track enrollment source
}

class RegistrationService {
  /**
   * Submit a new trainee self-registration (public)
   * Can be used for both new trainee signups and existing trainees applying to new programs
   */
  /*async submitRegistration(data: SubmitRegistrationData, isExistingTrainee: boolean = false): Promise<PendingRegistration> {
    const response = await api.post<PendingRegistration>('/registrations', {
      ...data,
      isExistingTrainee, // Pass flag to indicate if this is an existing trainee
    });
    return response.data;
  }
*/
  async submitRegistration(data: SubmitRegistrationData, isExistingTrainee: boolean = false): Promise<PendingRegistration> {
  console.log('[RegistrationService] submitRegistration called with data:', data);
  try {
    console.log('[RegistrationService] Making POST request to /registrations');
    const response = await api.post<PendingRegistration>('/registrations', {
      ...data,
      isExistingTrainee,
    });
    console.log('[RegistrationService] POST /registrations succeeded:', response);
    return response.data;
  } catch (error) {
    console.error('[RegistrationService] POST /registrations FAILED:', error);
    throw error;
  }
}


  /**
   * Get all registrations (admin/staff only)
   */
  async getRegistrations(filters?: { status?: string; search?: string }): Promise<PendingRegistration[]> {
    const params: Record<string, string> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.search) params.search = filters.search;
    const response = await api.get<PendingRegistration[]>('/registrations', Object.keys(params).length ? params : undefined);
    return response.data;
  }

  /**
   * Approve a registration (local_admin / staff_training_coordinator only)
   */
  async approveRegistration(id: string): Promise<{ user: any; trainee: any }> {
    const response = await api.patch<{ user: any; trainee: any }>(`/registrations/${id}`, { action: 'approve' });
    return response.data;
  }

  /**
   * Reject a registration (local_admin / staff_training_coordinator only)
   */
  async rejectRegistration(id: string, rejection_reason?: string): Promise<void> {
    await api.patch(`/registrations/${id}`, { action: 'reject', rejection_reason });
  }

  
}

export default new RegistrationService();
