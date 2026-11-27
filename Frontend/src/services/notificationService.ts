import api from './api';

export interface InAppNotification {
  id: string;
  type: 'activity' | 'overdue' | 'attendance';
  title: string;
  description: string;
  createdAt: string;
  href: string;
}

export interface AttendanceReminderDispatchResult {
  date: string;
  programsChecked: number;
  pendingTrainees: number;
  pushSent: number;
  pushFailed: number;
  pushRemoved: number;
  message?: string;
}

class NotificationService {
  async getNotifications(): Promise<{ notifications: InAppNotification[]; unreadCount: number }> {
    const response = await api.get<{ notifications: InAppNotification[]; unreadCount: number }>('/notifications');
    return response.data;
  }

  async sendAttendanceReminders(
    programId: string,
    sessionLabel?: 'morning' | 'afternoon'
  ): Promise<AttendanceReminderDispatchResult> {
    const response = await api.post<AttendanceReminderDispatchResult>(
      '/notifications/attendance-reminders',
      {
        program_id: programId,
        ...(sessionLabel ? { session_label: sessionLabel } : {}),
      }
    );
    return {
      ...response.data,
      message: response.message,
    };
  }
}

export default new NotificationService();
