/**
 * AttendanceSubmitFlow
 *
 * Orchestrates the full trainee self-service submission flow:
 *   idle → capturing → submitting → success | error
 *
 * - Opens CameraModal when triggered
 * - Pre-warms GPS immediately when camera opens via watchPosition (high accuracy)
 *   plus a fast low-accuracy fallback for indoor phones & desktop Wi-Fi
 * - Requires a valid GPS fix (<= 5,000m) before submitting; surfaces live GPS
 *   status and Retry inside CameraModal without discarding the preview photo
 * - Collects device info (device_id, device_model, os_version, app_version, timestamp)
 * - Builds FormData and calls attendanceService.submitAttendance
 * - Checks navigator.onLine before opening camera
 * - Shows full-screen loading overlay during submission
 * - Renders AttendanceConfirmation on success
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import CameraModal from './CameraModal';
import AttendanceConfirmation from './AttendanceConfirmation';
import attendanceService from '../../services/attendanceService';
import type {
  AttendanceWindowStatus,
  AttendanceRecord,
} from '../../services/attendanceService';
import {
  MAX_GPS_ACCURACY_M,
  formatGpsDistance,
  type GpsCaptureState,
  type GpsCoords,
} from '../../lib/gpsFormat';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AttendanceSubmitFlowProps {
  /** Current window status — used to know which session label to submit */
  windowStatus: AttendanceWindowStatus | null;
  /** Called after successful submission AND the user clicks "Back to Calendar" */
  onComplete: () => void;
  /** Children render prop: receives the triggerAttendance fn to open the flow */
  children: (triggerAttendance: () => void) => React.ReactNode;
}

type FlowState = 'idle' | 'capturing' | 'submitting' | 'success' | 'error';

const INITIAL_GPS_STATE: GpsCaptureState = {
  status: 'idle',
  coords: null,
  bestRawAccuracy: null,
  errorMessage: null,
};

const GPS_HIGH_ACC_TIMEOUT_MS = 10000;
const GPS_FALLBACK_DELAY_MS = 2500;
const GPS_FALLBACK_TIMEOUT_MS = 10000;

// ---------------------------------------------------------------------------
// Device info helper
// ---------------------------------------------------------------------------

function getOrCreateDeviceId(): string {
  const KEY = 'bmdc_device_id';
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[a-zA-Z0-9-]+$/.test(existing) && existing.length <= 100) {
      return existing;
    }
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, generated);
    return generated;
  } catch {
    return `web-${Date.now()}`;
  }
}

async function collectDeviceInfo(): Promise<Record<string, unknown>> {
  const platform = String((navigator as any).userAgentData?.platform ?? navigator.platform ?? 'Web').slice(0, 50);
  const uaSummary = String(navigator.userAgent || 'Browser').slice(0, 100);
  return {
    device_id: getOrCreateDeviceId(),
    device_model: uaSummary,
    os_version: platform,
    app_version: '1.0.0',
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AttendanceSubmitFlow({
  windowStatus,
  onComplete,
  children,
}: AttendanceSubmitFlowProps) {
  const [flowState, setFlowState] = useState<FlowState>('idle');
  const [successRecord, setSuccessRecord] = useState<AttendanceRecord | null>(null);
  const [gpsState, setGpsState] = useState<GpsCaptureState>(INITIAL_GPS_STATE);

  const watchIdRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureSessionRef = useRef(0);
  const bestCoordsRef = useRef<GpsCoords | null>(null);

  const sessionLabel = windowStatus?.session_label ?? 'morning';

  // ── Stop active GPS watch & fallback timer ───────────────────────────────
  const stopGpsWatch = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (
      watchIdRef.current !== null &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation &&
      typeof navigator.geolocation.clearWatch === 'function'
    ) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = null;
  }, []);

  // ── Pre-warm GPS with high-accuracy watch + fast low-accuracy fallback ───
  const startGpsCapture = useCallback(() => {
    stopGpsWatch();
    captureSessionRef.current += 1;
    const sessionId = captureSessionRef.current;
    bestCoordsRef.current = null;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsState({
        status: 'unsupported',
        coords: null,
        bestRawAccuracy: null,
        errorMessage: 'Geolocation is not supported by this browser. Use a GPS-enabled browser to check in.',
      });
      return;
    }

    setGpsState({
      status: 'locating',
      coords: null,
      bestRawAccuracy: null,
      errorMessage: null,
    });

    let bestRawAccuracy: number | null = null;
    let fallbackTriggered = false;

    const recordPosition = (pos: GeolocationPosition) => {
      if (sessionId !== captureSessionRef.current) return;
      const { latitude, longitude, accuracy } = pos.coords;

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        !Number.isFinite(accuracy) ||
        accuracy < 0 ||
        (latitude === 0 && longitude === 0)
      ) {
        return;
      }

      bestRawAccuracy = bestRawAccuracy === null ? accuracy : Math.min(bestRawAccuracy, accuracy);

      if (accuracy <= MAX_GPS_ACCURACY_M) {
        const prev = bestCoordsRef.current;
        // Prefer more accurate readings, or refresh when precision is already high (<= 50m)
        if (!prev || accuracy < prev.accuracy || accuracy <= 50) {
          const nextCoords: GpsCoords = { latitude, longitude, accuracy };
          bestCoordsRef.current = nextCoords;
          setGpsState({
            status: 'ready',
            coords: nextCoords,
            bestRawAccuracy,
            errorMessage: null,
          });
        }
      }
    };

    const markInaccurateIfUnresolved = () => {
      if (sessionId !== captureSessionRef.current || bestCoordsRef.current) return;
      if (bestRawAccuracy !== null && bestRawAccuracy > MAX_GPS_ACCURACY_M) {
        setGpsState({
          status: 'inaccurate',
          coords: null,
          bestRawAccuracy,
          errorMessage: `GPS accuracy (${formatGpsDistance(bestRawAccuracy)}) exceeds the 5 km limit. Move near a window or turn on Precise Location, then tap Retry.`,
        });
      }
    };

    const triggerLowAccuracyFallback = () => {
      if (fallbackTriggered || sessionId !== captureSessionRef.current || bestCoordsRef.current) {
        return;
      }
      fallbackTriggered = true;

      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          recordPosition(pos);
          markInaccurateIfUnresolved();
        },
        (err) => {
          if (sessionId !== captureSessionRef.current || bestCoordsRef.current) return;
          if (err.code === 1) {
            stopGpsWatch();
            setGpsState({
              status: 'denied',
              coords: null,
              bestRawAccuracy,
              errorMessage: 'Location access is required. Allow location permission in your browser settings, then tap Retry.',
            });
            return;
          }
          if (bestRawAccuracy !== null && bestRawAccuracy > MAX_GPS_ACCURACY_M) {
            markInaccurateIfUnresolved();
            return;
          }
          setGpsState({
            status: 'unavailable',
            coords: null,
            bestRawAccuracy,
            errorMessage: 'Unable to determine your location. Check that device GPS/Location is turned on, then tap Retry.',
          });
        },
        {
          enableHighAccuracy: false,
          maximumAge: 60000,
          timeout: GPS_FALLBACK_TIMEOUT_MS,
        }
      );
    };

    const handleHighAccError = (err: GeolocationPositionError) => {
      if (sessionId !== captureSessionRef.current) return;
      if (err.code === 1) {
        // Permission denied — stop watching immediately and prompt user
        stopGpsWatch();
        setGpsState({
          status: 'denied',
          coords: null,
          bestRawAccuracy,
          errorMessage: 'Location access is required. Allow location permission in your browser settings, then tap Retry.',
        });
        return;
      }
      // Timeout or temporary unavailability — fall back to network/Wi-Fi geolocation right away
      triggerLowAccuracyFallback();
    };

    // Start high-accuracy watchPosition to continuously refine fix while user frames selfie
    if (typeof navigator.geolocation.watchPosition === 'function') {
      watchIdRef.current = navigator.geolocation.watchPosition(
        recordPosition,
        handleHighAccError,
        {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: GPS_HIGH_ACC_TIMEOUT_MS,
        }
      );
    } else {
      navigator.geolocation.getCurrentPosition(
        recordPosition,
        handleHighAccError,
        {
          enableHighAccuracy: true,
          maximumAge: 15000,
          timeout: GPS_HIGH_ACC_TIMEOUT_MS,
        }
      );
    }

    // Schedule fast low-accuracy fallback so indoor phones and desktops lock quickly
    fallbackTimerRef.current = setTimeout(() => {
      triggerLowAccuracyFallback();
    }, GPS_FALLBACK_DELAY_MS);
  }, [stopGpsWatch]);

  // Pre-warm GPS automatically whenever camera opens; clean up on close/unmount
  useEffect(() => {
    if (flowState === 'capturing') {
      startGpsCapture();
    } else {
      stopGpsWatch();
    }
    return () => {
      stopGpsWatch();
    };
  }, [flowState, startGpsCapture, stopGpsWatch]);

  // ── Trigger (called by parent via children render prop) ──────────────────
  const triggerAttendance = useCallback(() => {
    if (!navigator.onLine) {
      toast.error('You must be online to submit attendance');
      return;
    }
    if (!windowStatus?.isOpen) {
      toast.error('Attendance window is currently closed');
      return;
    }
    setFlowState('capturing');
  }, [windowStatus]);

  // ── Camera captured a blob ────────────────────────────────────────────────
  const handleCapture = useCallback(async (blob: Blob) => {
    const gps = bestCoordsRef.current;
    if (
      !gps ||
      !Number.isFinite(gps.accuracy) ||
      gps.accuracy < 0 ||
      gps.accuracy > MAX_GPS_ACCURACY_M ||
      (gps.latitude === 0 && gps.longitude === 0)
    ) {
      toast.error('Location (GPS) is required to submit attendance. Please enable location access and retry.');
      return;
    }

    stopGpsWatch();
    setFlowState('submitting');

    try {
      // Collect device info
      const deviceInfo = await collectDeviceInfo();

      // Build FormData
      const fd = new FormData();
      fd.append('selfie', blob, 'selfie.jpg');
      fd.append('session_label', sessionLabel);
      fd.append('device_info', JSON.stringify(deviceInfo));
      fd.append('gps_lat', String(gps.latitude));
      fd.append('gps_lng', String(gps.longitude));
      fd.append('gps_accuracy', String(gps.accuracy));
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        fd.append('idempotency_key', crypto.randomUUID());
      }

      // Submit
      const response = await attendanceService.submitAttendance(fd);

      if (!response.success || !response.data) {
        throw new Error(response.message ?? 'Submission failed');
      }

      setSuccessRecord(response.data);
      setFlowState('success');
    } catch (err: unknown) {
      const msg =
        (err as any)?.message ??
        (err as any)?.error ??
        'Failed to submit attendance. Please try again.';
      toast.error(msg);
      setFlowState('idle');
    }
  }, [sessionLabel, stopGpsWatch]);

  // ── User closed camera without capturing ─────────────────────────────────
  const handleCameraClose = useCallback(() => {
    stopGpsWatch();
    setGpsState(INITIAL_GPS_STATE);
    setFlowState('idle');
  }, [stopGpsWatch]);

  // ── User clicks "Back to Calendar" on confirmation ───────────────────────
  const handleComplete = useCallback(() => {
    setSuccessRecord(null);
    setGpsState(INITIAL_GPS_STATE);
    setFlowState('idle');
    onComplete();
  }, [onComplete]);

  // ── Render ────────────────────────────────────────────────────────────────

  // Success screen — takes over the whole flow area
  if (flowState === 'success' && successRecord) {
    return (
      <AttendanceConfirmation
        record={successRecord}
        sessionLabel={sessionLabel}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <>
      {/* Render the trigger (e.g. the calendar's Take Attendance button) */}
      {children(triggerAttendance)}

      {/* Camera modal with live pre-warmed GPS indicator & required gate */}
      <CameraModal
        isOpen={flowState === 'capturing'}
        sessionLabel={sessionLabel}
        gpsState={gpsState}
        onRetryGps={startGpsCapture}
        onCapture={handleCapture}
        onClose={handleCameraClose}
      />

      {/* Submitting overlay */}
      {flowState === 'submitting' && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Submitting attendance"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background/90 backdrop-blur-sm"
        >
          <Loader2 className="size-12 animate-spin text-primary" />
          <p className="text-base font-medium text-foreground">Submitting attendance…</p>
          <p className="text-sm text-muted-foreground">Please wait</p>
        </div>
      )}
    </>
  );
}
