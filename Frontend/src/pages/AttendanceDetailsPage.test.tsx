import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AttendanceDetailsPage from './AttendanceDetailsPage';

const mockGetMyAttendanceByDate = vi.fn();
const mockGetWindowStatus = vi.fn();
const mockApiClientGet = vi.fn();

vi.mock('../components/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

vi.mock('../services/attendanceService', () => ({
  default: {
    getMyAttendanceByDate: (...args: any[]) => mockGetMyAttendanceByDate(...args),
    getWindowStatus: (...args: any[]) => mockGetWindowStatus(...args),
  },
}));

vi.mock('../services/api', () => ({
  getFileUrl: (p: string) => `http://localhost:3003/api/files/${p.replace(/^\/uploads\//, '')}`,
  apiClient: {
    get: (...args: any[]) => mockApiClientGet(...args),
  },
}));

describe('AttendanceDetailsPage — SelfiePanel authenticated full-size view', () => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let blobCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    blobCounter = 0;
    URL.createObjectURL = vi.fn(() => `blob:http://localhost:5173/selfie-${++blobCounter}`);
    URL.revokeObjectURL = vi.fn();

    mockGetWindowStatus.mockResolvedValue({ data: null });
    mockGetMyAttendanceByDate.mockResolvedValue({
      data: [
        {
          id: 'att-1',
          session_id: 'sess-12345678',
          trainee_id: 'tr-1',
          status: 'present',
          morning_time_in: '2026-11-26T00:15:00.000Z',
          afternoon_time_out: '2026-11-26T08:15:00.000Z',
          selfie_morning_path: '/uploads/194876de-a68c-4d33-8f80-c0978e5d44b3/images/attendance/seed-attendance-male-1-am.jpg',
          selfie_afternoon_path: '/uploads/194876de-a68c-4d33-8f80-c0978e5d44b3/images/attendance/seed-attendance-male-1-pm.jpg',
        },
      ],
    });
    mockApiClientGet.mockResolvedValue({
      data: new Blob(['fake-jpeg'], { type: 'image/jpeg' }),
    });
  });

  afterEach(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it('fetches morning & afternoon selfies with apiClient and points View full size links to authenticated blob URLs', async () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/trainee/attendance/2026-11-26']}>
        <Routes>
          <Route path="/trainee/attendance/:date" element={<AttendanceDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    const links = await waitFor(() => {
      const found = screen.getAllByRole('link', { name: /View full size/i });
      expect(found).toHaveLength(2);
      return found;
    });

    expect(mockApiClientGet).toHaveBeenCalledTimes(2);
    expect(mockApiClientGet).toHaveBeenCalledWith(
      expect.stringContaining('/api/files/194876de-a68c-4d33-8f80-c0978e5d44b3/images/attendance/seed-attendance-male-1-am.jpg'),
      { responseType: 'blob' }
    );
    expect(mockApiClientGet).toHaveBeenCalledWith(
      expect.stringContaining('/api/files/194876de-a68c-4d33-8f80-c0978e5d44b3/images/attendance/seed-attendance-male-1-pm.jpg'),
      { responseType: 'blob' }
    );

    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^blob:/);
      expect(link.getAttribute('href')).not.toContain('/api/files/');
    }

    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });
});

describe('AttendanceDetailsPage — today attendance window, schedule & rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Local time 09:05 AM on 2026-11-27 (past 8:00 AM cutoff in 7:00 AM - 11:55 AM window)
    vi.setSystemTime(new Date(2026, 10, 27, 9, 5, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows Punch In Now, Late Check-In badge, schedule times, and rules for today when window is open past cutoff', async () => {
    mockGetMyAttendanceByDate.mockResolvedValue({ data: [] });
    mockGetWindowStatus.mockResolvedValue({
      data: {
        isOpen: true,
        session_label: 'morning',
        window_open: '07:00:00',
        window_close: '11:55:00',
        seconds_until_open: 0,
        seconds_until_close: 170 * 60,
        morning_open: '07:00:00',
        morning_close: '11:55:00',
        morning_late_threshold: 60,
        afternoon_open: '12:00:00',
        afternoon_close: '22:00:00',
        afternoon_late_threshold: 60,
      },
    });

    render(
      <MemoryRouter initialEntries={['/trainee/attendance/2026-11-27']}>
        <Routes>
          <Route path="/trainee/attendance/:date" element={<AttendanceDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Morning Attendance Window Open')).toBeInTheDocument();
    });

    expect(screen.getByText('Late Check-In')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Punch In Now/i })).toBeInTheDocument();
    expect(screen.getByText('Attendance Schedule & Rules')).toBeInTheDocument();
    expect(screen.getByText('7:00 AM – 11:55 AM')).toBeInTheDocument();
    expect(screen.getByText('12:00 PM – 10:00 PM')).toBeInTheDocument();
    expect(screen.getByText(/On-Time vs\. Late:/i)).toBeInTheDocument();
    expect(screen.queryByText(/No attendance record for this date/i)).not.toBeInTheDocument();
  });

  it('shows Attendance Window Currently Closed with next opening time & rules for today when closed (never No attendance record)', async () => {
    mockGetMyAttendanceByDate.mockResolvedValue({ data: [] });
    mockGetWindowStatus.mockResolvedValue({
      data: {
        isOpen: false,
        session_label: 'afternoon',
        window_open: '12:00:00',
        window_close: '22:00:00',
        seconds_until_open: 175 * 60,
        seconds_until_close: null,
        morning_open: '07:00:00',
        morning_close: '11:55:00',
        morning_late_threshold: 60,
        afternoon_open: '12:00:00',
        afternoon_close: '22:00:00',
        afternoon_late_threshold: 60,
      },
    });

    render(
      <MemoryRouter initialEntries={['/trainee/attendance/2026-11-27']}>
        <Routes>
          <Route path="/trainee/attendance/:date" element={<AttendanceDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Attendance Window Currently Closed')).toBeInTheDocument();
    });

    expect(screen.getByText(/Afternoon session opens at 12:00 PM/i)).toBeInTheDocument();
    expect(screen.getByText('Attendance Schedule & Rules')).toBeInTheDocument();
    expect(screen.queryByText(/No attendance record for this date/i)).not.toBeInTheDocument();
  });

  it('keeps No attendance record for this date on past dates with no record', async () => {
    mockGetMyAttendanceByDate.mockResolvedValue({ data: [] });
    mockGetWindowStatus.mockResolvedValue({ data: null });

    render(
      <MemoryRouter initialEntries={['/trainee/attendance/2026-11-20']}>
        <Routes>
          <Route path="/trainee/attendance/:date" element={<AttendanceDetailsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No attendance record for this date.')).toBeInTheDocument();
    });
  });
});
