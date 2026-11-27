import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AttendanceSubmitFlow from './AttendanceSubmitFlow';
import AttendanceDetailModal from './AttendanceDetailModal';
import type { AttendanceWindowStatus } from '../../services/attendanceService';

const mockSubmitAttendance = vi.fn();

vi.mock('../../services/attendanceService', () => ({
  default: {
    submitAttendance: (...args: any[]) => mockSubmitAttendance(...args),
  },
}));

vi.mock('./AuthenticatedImage', () => ({
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

vi.mock('./CameraModal', () => ({
  default: ({ isOpen, gpsState, onRetryGps, onCapture }: any) => {
    if (!isOpen) return null;
    const isBlocked = Boolean(gpsState && gpsState.status !== 'ready');
    return (
      <div data-testid="camera-modal">
        <span data-testid="gps-status">{gpsState?.status}</span>
        {gpsState?.errorMessage && <p>{gpsState.errorMessage}</p>}
        <button type="button" onClick={onRetryGps}>
          Retry Location
        </button>
        <button
          type="button"
          disabled={isBlocked}
          onClick={() => onCapture(new Blob(['jpeg-bytes'], { type: 'image/jpeg' }))}
        >
          Use Photo
        </button>
      </div>
    );
  },
}));

const OPEN_WINDOW: AttendanceWindowStatus = {
  isOpen: true,
  session_label: 'morning',
  window_open: '07:00:00',
  window_close: '11:55:00',
  seconds_until_open: 0,
  seconds_until_close: 3600,
};

describe('AttendanceSubmitFlow — GPS pre-warm, 5000m cap, fallback & required gate', () => {
  const originalGeo = navigator.geolocation;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalGeo,
    });
  });

  it('pre-warms GPS on camera open and submits indoor/desktop 250m fixes without dropping them', async () => {
    const watchPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 12.7481,
          longitude: 121.4868,
          accuracy: 250,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition);
      return 1;
    });
    const clearWatch = vi.fn();

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition,
        clearWatch,
        getCurrentPosition: vi.fn(),
      },
    });

    mockSubmitAttendance.mockResolvedValue({
      success: true,
      data: {
        id: 'att-1',
        session_id: 'sess-1',
        trainee_id: 'tr-1',
        status: 'present',
        morning_status: 'present',
        morning_time_in: '2026-11-27T01:00:00Z',
        gps_lat: 12.7481,
        gps_lng: 121.4868,
        gps_accuracy: 250,
        gps_address: 'Poblacion, Bongabong, Oriental Mindoro',
        created_at: '2026-11-27T01:00:00Z',
        updated_at: '2026-11-27T01:00:00Z',
      },
    });

    render(
      <AttendanceSubmitFlow windowStatus={OPEN_WINDOW} onComplete={vi.fn()}>
        {(trigger) => <button onClick={trigger}>Punch In</button>}
      </AttendanceSubmitFlow>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Punch In' }));

    await waitFor(() => {
      expect(screen.getByTestId('gps-status')).toHaveTextContent('ready');
    });

    const usePhotoBtn = screen.getByRole('button', { name: 'Use Photo' });
    expect(usePhotoBtn).not.toBeDisabled();

    fireEvent.click(usePhotoBtn);

    await waitFor(() => {
      expect(mockSubmitAttendance).toHaveBeenCalledTimes(1);
    });

    const submittedFormData = mockSubmitAttendance.mock.calls[0][0] as FormData;
    expect(submittedFormData.get('gps_lat')).toBe('12.7481');
    expect(submittedFormData.get('gps_lng')).toBe('121.4868');
    expect(submittedFormData.get('gps_accuracy')).toBe('250');

    // Confirmation screen displays reverse-geocoded address and accuracy quality
    await waitFor(() => {
      expect(screen.getByText('Poblacion, Bongabong, Oriental Mindoro')).toBeInTheDocument();
      expect(screen.getByText(/±250 m · Medium/i)).toBeInTheDocument();
    });
  });

  it('falls back to low-accuracy geolocation when high-accuracy watch times out', async () => {
    const watchPosition = vi.fn((_success: PositionCallback, error?: PositionErrorCallback) => {
      error?.({
        code: 3, // TIMEOUT
        message: 'Timeout expired',
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3,
      } as GeolocationPositionError);
      return 2;
    });

    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 12.7513,
          longitude: 121.4854,
          accuracy: 1200,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      } as GeolocationPosition);
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition,
        clearWatch: vi.fn(),
        getCurrentPosition,
      },
    });

    render(
      <AttendanceSubmitFlow windowStatus={OPEN_WINDOW} onComplete={vi.fn()}>
        {(trigger) => <button onClick={trigger}>Punch In</button>}
      </AttendanceSubmitFlow>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Punch In' }));

    await waitFor(() => {
      expect(getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({ enableHighAccuracy: false })
      );
      expect(screen.getByTestId('gps-status')).toHaveTextContent('ready');
    });
  });

  it('blocks submission when location permission is denied and allows retry when granted', async () => {
    let allowPermission = false;

    const watchPosition = vi.fn((success: PositionCallback, error?: PositionErrorCallback) => {
      if (!allowPermission) {
        error?.({
          code: 1, // PERMISSION_DENIED
          message: 'User denied Geolocation',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError);
      } else {
        success({
          coords: {
            latitude: 12.7485,
            longitude: 121.4871,
            accuracy: 18,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
            toJSON: () => ({}),
          },
          timestamp: Date.now(),
          toJSON: () => ({}),
        } as GeolocationPosition);
      }
      return 3;
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition,
        clearWatch: vi.fn(),
        getCurrentPosition: vi.fn(),
      },
    });

    render(
      <AttendanceSubmitFlow windowStatus={OPEN_WINDOW} onComplete={vi.fn()}>
        {(trigger) => <button onClick={trigger}>Punch In</button>}
      </AttendanceSubmitFlow>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Punch In' }));

    await waitFor(() => {
      expect(screen.getByTestId('gps-status')).toHaveTextContent('denied');
    });

    expect(screen.getByRole('button', { name: 'Use Photo' })).toBeDisabled();
    expect(mockSubmitAttendance).not.toHaveBeenCalled();

    // Grant permission and click Retry Location
    allowPermission = true;
    fireEvent.click(screen.getByRole('button', { name: 'Retry Location' }));

    await waitFor(() => {
      expect(screen.getByTestId('gps-status')).toHaveTextContent('ready');
      expect(screen.getByRole('button', { name: 'Use Photo' })).not.toBeDisabled();
    });
  });
});

describe('AttendanceDetailModal — admin GPS address, accuracy label & Map link', () => {
  it('renders gps_address, coordinates with accuracy quality, and Google Maps link', () => {
    render(
      <AttendanceDetailModal
        isOpen={true}
        onClose={vi.fn()}
        onStatusUpdated={vi.fn()}
        trainee={{ id: 'tr-1', first_name: 'Leah', last_name: 'Salazar' }}
        record={{
          id: 'att-1',
          session_id: 'sess-1',
          trainee_id: 'tr-1',
          status: 'present',
          submission_method: 'self_service',
          gps_lat: 12.7481,
          gps_lng: 121.4868,
          gps_accuracy: 19,
          gps_address: 'Rizal Street, Poblacion, Bongabong, Oriental Mindoro',
          created_at: '2026-11-27T01:00:00Z',
          updated_at: '2026-11-27T01:00:00Z',
        }}
      />
    );

    expect(screen.getByText('Rizal Street, Poblacion, Bongabong, Oriental Mindoro')).toBeInTheDocument();
    expect(screen.getByText(/±19 m · High/i)).toBeInTheDocument();
    const mapLink = screen.getByRole('link', { name: /Map/i });
    expect(mapLink).toHaveAttribute('href', 'https://maps.google.com/maps?q=12.7481,121.4868');
  });
});
