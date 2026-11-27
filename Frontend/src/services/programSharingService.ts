/**
 * Program Sharing Service
 * 
 * Handles API calls related to social program sharing feature.
 * Validates: Requirements 2.1, 2.3, 2.4, 10.1, 10.2, 10.3, 10.4
 */

import api from './api';

export interface SharedProgramDetails {
  id: string;
  tenant_id?: string;
  name: string;
  description?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  duration_weeks?: number;
  max_trainees?: number;
  enrollment_limit?: number | null;
  current_enrollment?: number;
  image_path?: string | null;
  thumbnail_path?: string | null;
  instructor?: string;
}

export interface ValidateProgramShareResponse {
  isValid: boolean;
  isActive: boolean;
  isPublic: boolean;
  program?: SharedProgramDetails;
  error?: string;
}

export interface VerifyAccessResponse {
  canAccess: boolean;
  hasEnrolled?: boolean;
  reason?: string;
}

export interface ShareableLinkResponse {
  url: string;
  programId: string;
  generatedAt: string;
  og: {
    title: string;
    description: string;
    image?: string;
  };
}

class ProgramSharingService {
  /**
   * Validate program share - check if program is valid, active, and publicly available
   * 
   * @param programId - Program ID to validate
   * @returns Validation result with program details if valid
   */
  async validateProgramShare(programId: string): Promise<ValidateProgramShareResponse> {
    try {
      const response = await api.get<ValidateProgramShareResponse>(
        `programs/${programId}/validate-share`
      );
      return response.data;
    } catch (error) {
      console.error('Error validating program share:', error);
      return {
        isValid: false,
        isActive: false,
        isPublic: false,
        error: 'Failed to validate program',
      };
    }
  }

  /**
   * Verify program access for authenticated user
   * 
   * @param programId - Program ID to check access for
   * @param traineeId - Trainee ID requesting access
   * @returns Access verification result
   */
  async verifyProgramAccess(
    programId: string,
    traineeId: string
  ): Promise<VerifyAccessResponse> {
    try {
      const response = await api.post<any>(
        `programs/${programId}/verify-access`,
        { trainee_id: traineeId }
      );
      const raw = response.data || {};
      return {
        canAccess: Boolean(raw.canAccess ?? raw.can_access ?? false),
        hasEnrolled: Boolean(raw.hasEnrolled ?? raw.has_enrolled ?? false),
        reason: raw.reason,
      };
    } catch (error) {
      console.error('Error verifying program access:', error);
      return {
        canAccess: false,
        reason: 'Failed to verify access',
      };
    }
  }

  /**
   * Get shareable link for a program
   * 
   * @param programId - Program ID to generate link for
   * @returns Shareable link with OG metadata
   */
  async getShareableLink(programId: string): Promise<ShareableLinkResponse> {
    try {
      const response = await api.get<ShareableLinkResponse>(
        `programs/${programId}/share-link`
      );
      return response.data;
    } catch (error) {
      console.error('Error getting shareable link:', error);
      throw error;
    }
  }
}

export const programSharingService = new ProgramSharingService();
export default programSharingService;

