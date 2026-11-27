/**
 * Program Helper Utilities
 * Contains utility functions for program data processing
 */

export interface Program {
  id: string;
  name: string;
  description: string;
  duration: string;
  type_of_funding: string;
  icon: string;
  status: 'active' | 'inactive';
  rawStatus?: 'active' | 'upcoming' | 'completed' | 'cancelled' | 'inactive';
  startDate: string;
  endDate: string;
  photoUrl: string;
  imagePath?: string; // Original image_path from backend (for checking if real image exists)
  createdAt: string;
  updatedAt: string;
  instructor?: string;
  // Enrollment properties
  enrollment_limit?: number | null;
  max_trainees?: number;
  current_enrollment?: number;
  total_registrations?: number;
}

// Helper function to check if program should be inactive based on end date
export const isProgramExpired = (endDate: string): boolean => {
  if (!endDate) return false;
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to compare only dates
  return end < today;
};

// Helper function to get actual program status
export const getProgramStatus = (program: Program): 'active' | 'inactive' => {
  if (isProgramExpired(program.endDate)) {
    return 'inactive';
  }
  return program.status;
};
