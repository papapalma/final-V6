import { api, apiClient, ApiResponse } from './api';

// =============================================================================
// Existing interfaces (preserved exactly)
// =============================================================================

export interface Attendance {
  id: string;
  session_id: string;
  trainee_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  check_in_time?: string;
  check_out_time?: string;
  scanned_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  trainee?: {
    id: string;
    first_name: string;
    last_name: string;
    middle_name: string;
    photo_path?: string;
    thumbnail_path?: string;
  };
  session?: {
    id: string;
    title: string;
    session_date: string;
    start_time: string;
    end_time: string;
    program_id: string;
    program?: {
      id: string;
      name: string;
    };
  };
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  pending?: number;
  attendanceRate?: number;
}

export interface MarkAttendanceData {
  session_id: string;
  trainee_id: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
}

// =============================================================================
// New interfaces — Attendance Module
// =============================================================================

export interface DeviceInfo {
  browser?: string;
  os?: string;
  networkType?: string;
  ip?: string;
  timezone?: string;
  batteryLevel?: number;
  appVersion?: string;
}

/**
 * Extended attendance record with all new attendance module fields.
 * Extends the base Attendance interface.
 */
export interface AttendanceRecord extends Attendance {
  // Selfie paths (relative, served via getFileUrl())
  selfie_morning_path?: string;
  selfie_afternoon_path?: string;

  // Per-session timestamps
  morning_time_in?: string;
  afternoon_time_out?: string;

  // Lateness
  late_duration_minutes?: number;

  // Per-session status (independent of top-level status)
  morning_status?: 'present' | 'late' | 'absent' | 'pending';
  afternoon_status?: 'present' | 'late' | 'absent' | 'pending';

  // GPS metadata
  gps_lat?: number;
  gps_lng?: number;
  gps_accuracy?: number;
  gps_address?: string;

  // Device & submission metadata
  device_info?: DeviceInfo;
  submission_method?: 'self_service' | 'manual' | 'qr_scan';
  attempt_number?: number;

  // Admin verification
  verified_by?: string;
  verified_at?: string;
}

export type CalendarDayStatus =
  | 'present'
  | 'late'
  | 'absent'
  | 'pending'
  | 'excused'
  | 'holiday'
  | 'weekend'
  | 'future'
  | 'no_session';

export interface CalendarDayData {
  date: string;              // YYYY-MM-DD
  status: CalendarDayStatus;
  record?: AttendanceRecord;
}

export interface AttendanceWindowStatus {
  isOpen: boolean;
  session_label: 'morning' | 'afternoon' | null;
  window_open: string | null;      // HH:MM
  window_close: string | null;
  seconds_until_open: number | null;
  seconds_until_close: number | null;
  morning_open?: string | null;
  morning_close?: string | null;
  morning_late_threshold?: number | null;
  afternoon_open?: string | null;
  afternoon_close?: string | null;
  afternoon_late_threshold?: number | null;
}

export interface AttendanceSchedule {
  id: string;
  tenant_id: string;
  program_id: string;
  name: string;
  effective_date_start: string;    // YYYY-MM-DD
  effective_date_end: string;
  morning_open: string;            // HH:MM
  morning_close: string;
  morning_late_threshold: number;
  afternoon_open: string;
  afternoon_close: string;
  afternoon_late_threshold: number;
  status: 'active' | 'inactive' | 'archived';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleData {
  program_id: string;
  name: string;
  effective_date_start: string;
  effective_date_end: string;
  morning_open: string;
  morning_close: string;
  morning_late_threshold?: number;
  afternoon_open: string;
  afternoon_close: string;
  afternoon_late_threshold?: number;
}

export interface AttendanceScheduleOverride {
  id: string;
  schedule_id: string;
  date: string;                    // YYYY-MM-DD
  reason: string;
  is_full_day_off: boolean;
  custom_morning_open?: string | null;
  custom_morning_close?: string | null;
  custom_afternoon_open?: string | null;
  custom_afternoon_close?: string | null;
  created_by?: string;
  created_at: string;
}

export interface CreateOverrideData {
  date: string;
  reason: string;
  is_full_day_off: boolean;
  custom_morning_open?: string | null;
  custom_morning_close?: string | null;
  custom_afternoon_open?: string | null;
  custom_afternoon_close?: string | null;
}

export interface AdminDashboardData {
  summaryCards: {
    presentToday: number;
    lateToday: number;
    absentToday: number;
    pendingCount: number;
    excusedToday: number;
    attendanceRate: number;
  };
  dailyTrend: Array<{
    date: string;
    present: number;
    late: number;
    absent: number;
  }>;
  distribution: {
    present: number;
    late: number;
    absent: number;
    excused: number;
    pending: number;
  };
}

export interface DayAttendanceData {
  records: AttendanceRecord[];
  noRecord: Array<{
    id: string;
    first_name: string;
    last_name: string;
    middle_name: string;
    email: string;
    photo_path?: string;
    thumbnail_path?: string;
    qr_code: string;
  }>;
}

// =============================================================================
// AttendanceService class
// =============================================================================

class AttendanceService {

  // ---------------------------------------------------------------------------
  // Existing methods (preserved exactly)
  // ---------------------------------------------------------------------------

  async getAttendanceBySession(sessionId: string): Promise<ApiResponse<Attendance[]>> {
    return api.get<Attendance[]>('/attendance', { session_id: sessionId });
  }

  async getAttendanceByTrainee(traineeId: string): Promise<ApiResponse<Attendance[]>> {
    return api.get<Attendance[]>('/attendance', { trainee_id: traineeId });
  }

  async getAttendanceStats(programId: string): Promise<ApiResponse<AttendanceStats>> {
    return api.get<AttendanceStats>('/attendance', { program_id: programId, stats: 'true' });
  }

  async getTraineeAttendanceStats(traineeId: string): Promise<ApiResponse<AttendanceStats>> {
    return api.get<AttendanceStats>('/attendance', { trainee_id: traineeId, stats: 'true' });
  }

  async markAttendance(data: MarkAttendanceData): Promise<ApiResponse<AttendanceRecord>> {
    return api.post<AttendanceRecord>('/attendance', data);
  }

  async bulkMarkAbsent(sessionId: string): Promise<ApiResponse<{ markedAbsent: number }>> {
    return api.post<{ markedAbsent: number }>(
      '/attendance?action=bulk_absent',
      { session_id: sessionId }
    );
  }

  /** Get current trainee's own attendance records */
  async getMyAttendance(): Promise<ApiResponse<AttendanceRecord[]>> {
    return api.get<AttendanceRecord[]>('/attendance/me');
  }

  /** Get current trainee's own attendance statistics */
  async getMyAttendanceStats(): Promise<ApiResponse<AttendanceStats>> {
    return api.get<AttendanceStats>('/attendance/me', { type: 'stats' });
  }

  // ---------------------------------------------------------------------------
  // New methods — Attendance Module (Tasks 5+)
  // ---------------------------------------------------------------------------

  /**
   * Get the monthly calendar data for the current trainee.
   * @param yearMonth - e.g. "2025-01"
   */
  async getCalendarMonth(yearMonth: string): Promise<ApiResponse<CalendarDayData[]>> {
    return api.get<CalendarDayData[]>('/attendance/submit', { month: yearMonth });
  }

  /**
   * Get the current attendance window status for the trainee's program.
   * Polls every 30 seconds on the calendar page.
   */
  async getWindowStatus(): Promise<ApiResponse<AttendanceWindowStatus>> {
    return api.get<AttendanceWindowStatus>('/attendance/submit', { window: 'true' });
  }

  /**
   * Submit attendance with selfie (multipart/form-data).
   * Pass a pre-built FormData — axios sets the Content-Type boundary automatically.
   */
  async submitAttendance(formData: FormData): Promise<ApiResponse<AttendanceRecord>> {
    const response = await apiClient.post<ApiResponse<AttendanceRecord>>(
      '/attendance/submit',
      formData,
      // Do NOT set Content-Type — let the browser set it with the correct boundary
    );
    return response.data;
  }

  /**
   * Get a trainee's attendance record for a specific date.
   * Used by the AttendanceDetailsPage.
   */
  async getMyAttendanceByDate(date: string): Promise<ApiResponse<AttendanceRecord[]>> {
    return api.get<AttendanceRecord[]>('/attendance/me', { date });
  }

  /**
   * Get all attendance records for a program on a specific date (admin day-view).
   */
  async getDayAttendance(
    programId: string,
    date: string
  ): Promise<ApiResponse<DayAttendanceData>> {
    return api.get<DayAttendanceData>('/attendance', {
      program_id: programId,
      date,
    });
  }

  /**
   * Get the admin dashboard summary data for a program.
   */
  async getAdminDashboard(
    programId: string,
    filters?: { startDate?: string; endDate?: string; status?: string }
  ): Promise<ApiResponse<AdminDashboardData>> {
    return api.get<AdminDashboardData>('/attendance', {
      dashboard: 'true',
      program_id: programId,
      ...(filters?.startDate ? { start_date: filters.startDate } : {}),
      ...(filters?.endDate   ? { end_date:   filters.endDate   } : {}),
      ...(filters?.status    ? { status:     filters.status    } : {}),
    });
  }

  // ---------------------------------------------------------------------------
  // Schedule management methods
  // ---------------------------------------------------------------------------

  async getSchedules(programId: string): Promise<ApiResponse<AttendanceSchedule[]>> {
    return api.get<AttendanceSchedule[]>('/attendance/schedules', { program_id: programId });
  }

  async getScheduleById(id: string): Promise<ApiResponse<AttendanceSchedule>> {
    return api.get<AttendanceSchedule>(`/attendance/schedules/${id}`);
  }

  async createSchedule(data: CreateScheduleData): Promise<ApiResponse<AttendanceSchedule>> {
    return api.post<AttendanceSchedule>('/attendance/schedules', data);
  }

  async updateSchedule(
    id: string,
    data: Partial<CreateScheduleData>
  ): Promise<ApiResponse<AttendanceSchedule>> {
    return api.put<AttendanceSchedule>(`/attendance/schedules/${id}`, data);
  }

  async activateSchedule(id: string): Promise<ApiResponse<AttendanceSchedule>> {
    return api.patch<AttendanceSchedule>(`/attendance/schedules/${id}`, { action: 'activate' });
  }

  async deactivateSchedule(id: string): Promise<ApiResponse<AttendanceSchedule>> {
    return api.patch<AttendanceSchedule>(`/attendance/schedules/${id}`, { action: 'deactivate' });
  }

  async archiveSchedule(id: string): Promise<ApiResponse<{ id: string }>> {
    return api.delete<{ id: string }>(`/attendance/schedules/${id}`);
  }

  // ---------------------------------------------------------------------------
  // Schedule override methods
  // ---------------------------------------------------------------------------

  async getScheduleOverrides(
    scheduleId: string
  ): Promise<ApiResponse<AttendanceScheduleOverride[]>> {
    return api.get<AttendanceScheduleOverride[]>(
      `/attendance/schedules/${scheduleId}/overrides`
    );
  }

  async createOverride(
    scheduleId: string,
    data: CreateOverrideData
  ): Promise<ApiResponse<AttendanceScheduleOverride>> {
    return api.post<AttendanceScheduleOverride>(
      `/attendance/schedules/${scheduleId}/overrides`,
      data
    );
  }

  async deleteOverride(scheduleId: string, overrideId: string): Promise<ApiResponse<{ id: string }>> {
    return api.delete<{ id: string }>(
      `/attendance/schedules/${scheduleId}/overrides/${overrideId}`
    );
  }
}

export const attendanceService = new AttendanceService();
export default attendanceService;
