const PIN_PREFIX = 'pin_attendance_';
const DEFAULT_PIN_KEY = 'pin_attendance_default';
export const ATTENDANCE_PIN_EVENT = 'attendance-pin-changed';

function getPinKeys(): string[] {
  try {
    return Object.keys(localStorage).filter((key) => key.startsWith(PIN_PREFIX));
  } catch {
    return [];
  }
}

/**
 * Attendance is pinned automatically by default for trainees unless explicitly unpinned ('false').
 */
export function isProgramAttendancePinned(programId?: string): boolean {
  if (!programId) {
    return isDashboardAttendancePinned();
  }
  try {
    return localStorage.getItem(`${PIN_PREFIX}${programId}`) !== 'false';
  } catch {
    return true;
  }
}

export function isDashboardAttendancePinned(activeProgramId?: string): boolean {
  try {
    const keys = getPinKeys();
    if (keys.some((key) => localStorage.getItem(key) === 'true')) {
      return true;
    }
    if (activeProgramId && localStorage.getItem(`${PIN_PREFIX}${activeProgramId}`) === 'false') {
      return false;
    }
    if (keys.length > 0 && keys.every((key) => localStorage.getItem(key) === 'false')) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export function setAttendancePinned(pinned: boolean, programId?: string): void {
  try {
    if (pinned) {
      const targetKey = programId ? `${PIN_PREFIX}${programId}` : DEFAULT_PIN_KEY;
      localStorage.setItem(targetKey, 'true');
    } else {
      const keys = getPinKeys();
      if (programId) {
        localStorage.setItem(`${PIN_PREFIX}${programId}`, 'false');
      } else if (keys.length === 0) {
        localStorage.setItem(DEFAULT_PIN_KEY, 'false');
      }
      // When unpinning from dashboard (no programId), clear any previously pinned program keys too
      if (!programId) {
        for (const key of keys) {
          localStorage.setItem(key, 'false');
        }
      }
    }
  } catch {
    // Ignore storage quota/access errors
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ATTENDANCE_PIN_EVENT));
  }
}
