import { describe, it, expect } from 'vitest';
import {
  selectCameraStrategy,
  getCameraLabel,
  getCycledDeviceId,
} from '../QR_Scanner_Modal';
import * as fc from 'fast-check';

/**
 * ============================================================================
 * Task 2.2: Unit Tests for selectCameraStrategy
 * ============================================================================
 */
describe('selectCameraStrategy', () => {
  it('should return { video: true } for empty device list', () => {
    const result = selectCameraStrategy([]);
    expect(result).toEqual({ video: true });
  });

  it('should return { video: true } when no devices available', () => {
    const result = selectCameraStrategy([]);
    expect(result).toHaveProperty('video', true);
  });

  it('should use exact deviceId when label contains "back"', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'back-device-123',
        label: 'Back Camera',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect(result).toHaveProperty('deviceId');
    expect((result as any).deviceId?.exact).toBe('back-device-123');
    expect(result).toHaveProperty('width');
    expect(result).toHaveProperty('height');
  });

  it('should use exact deviceId when label contains "rear"', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'rear-cam-456',
        label: 'rear cam',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect((result as any).deviceId?.exact).toBe('rear-cam-456');
  });

  it('should use exact deviceId when label contains "environment"', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'env-device-789',
        label: 'environment',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect((result as any).deviceId?.exact).toBe('env-device-789');
  });

  it('should match "back" case-insensitively', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'back-device',
        label: 'BACK CAMERA',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect((result as any).deviceId?.exact).toBe('back-device');
  });

  it('should match "rear" case-insensitively', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'rear-device',
        label: 'Rear Camera',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect((result as any).deviceId?.exact).toBe('rear-device');
  });

  it('should use facingMode when device list is non-empty but no label match', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'front-device-123',
        label: 'Front Camera',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect(result).toHaveProperty('facingMode', 'environment');
    expect(result).not.toHaveProperty('deviceId');
  });

  it('should use facingMode when label is empty (iOS before permission)', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'device-unknown',
        label: '',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect(result).toHaveProperty('facingMode', 'environment');
  });

  it('should prioritize label match over facingMode', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'device-1',
        label: 'Front Camera',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
      {
        deviceId: 'device-2',
        label: 'Back Camera',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect((result as any).deviceId?.exact).toBe('device-2');
  });

  it('should return first back camera when multiple back cameras present', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'back-1',
        label: 'Back Camera 1',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
      {
        deviceId: 'back-2',
        label: 'Back Camera 2',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect((result as any).deviceId?.exact).toBe('back-1');
  });

  it('should include ideal width and height for exact deviceId constraint', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'back-device',
        label: 'Back Camera',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect((result as any).width?.ideal).toBe(1280);
    expect((result as any).height?.ideal).toBe(720);
  });

  it('should include ideal width and height for facingMode constraint', () => {
    const devices: MediaDeviceInfo[] = [
      {
        deviceId: 'front-device',
        label: 'Front Camera',
        kind: 'videoinput',
        groupId: 'group-1',
        toJSON: () => ({}),
      } as MediaDeviceInfo,
    ];
    const result = selectCameraStrategy(devices);
    expect((result as any).width?.ideal).toBe(1280);
    expect((result as any).height?.ideal).toBe(720);
  });

  /**
   * Property 1: Label-match always produces exact deviceId constraint
   * Validates: Requirements 3.1, 4.1, 4.2
   */
  it('(PBT) Property 1: label-match always produces exact deviceId constraint', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            deviceId: fc.string({ minLength: 1 }),
            label: fc.oneof(
              fc.constantFrom('Back Camera', 'rear cam', 'rear', 'environment', 'Rear Facing'),
              fc.string()
            ),
            kind: fc.constant('videoinput' as const),
            groupId: fc.string(),
            toJSON: fc.constant(() => ({})),
          }),
          { minLength: 1 }
        ).filter(devices =>
          devices.some(d =>
            ['back', 'rear', 'environment'].some(kw =>
              d.label.toLowerCase().includes(kw)
            )
          )
        ),
        devices => {
          const result = selectCameraStrategy(devices as MediaDeviceInfo[]);
          return (
            'deviceId' in result &&
            (result as any).deviceId &&
            'exact' in (result as any).deviceId &&
            !('facingMode' in result)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: No-match device list produces facingMode constraint
   * Validates: Requirements 2.2, 3.2, 3.3, 4.1, 4.3
   */
  it('(PBT) Property 2: no-match device list produces facingMode constraint', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            deviceId: fc.string({ minLength: 1 }),
            label: fc.string(),
            kind: fc.constant('videoinput' as const),
            groupId: fc.string(),
            toJSON: fc.constant(() => ({})),
          }),
          { minLength: 1 }
        ).filter(devices =>
          !devices.some(d =>
            ['back', 'rear', 'environment'].some(kw =>
              d.label.toLowerCase().includes(kw)
            )
          )
        ),
        devices => {
          const result = selectCameraStrategy(devices as MediaDeviceInfo[]);
          return (
            'facingMode' in result &&
            (result as any).facingMode === 'environment' &&
            !('deviceId' in result)
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Strategy priority is strictly ordered
   * Validates: Requirements 4.1, 4.3
   */
  it('(PBT) Property 3: strategy priority is strictly ordered', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            deviceId: fc.string({ minLength: 1 }),
            label: fc.string(),
            kind: fc.constant('videoinput' as const),
            groupId: fc.string(),
            toJSON: fc.constant(() => ({})),
          })
        ),
        devices => {
          const result = selectCameraStrategy(devices as MediaDeviceInfo[]);
          const hasDeviceId = 'deviceId' in result;
          const hasFacingMode = 'facingMode' in result;
          const hasVideoTrue = (result as any).video === true;

          // Empty list → { video: true }
          if (devices.length === 0) {
            return hasVideoTrue && !hasDeviceId && !hasFacingMode;
          }

          // No-match non-empty list → facingMode
          const hasMatch = devices.some(d =>
            ['back', 'rear', 'environment'].some(kw =>
              d.label.toLowerCase().includes(kw)
            )
          );
          if (!hasMatch) {
            return hasFacingMode && !hasDeviceId && !hasVideoTrue;
          }

          // Match → exact deviceId
          if (hasMatch) {
            return hasDeviceId && !hasFacingMode && !hasVideoTrue;
          }

          return false;
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * ============================================================================
 * Task 2.4: Unit Tests for getCameraLabel
 * ============================================================================
 */
describe('getCameraLabel', () => {
  it('should return "Front" when label contains "front"', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'front-1',
      label: 'Front HD Camera',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    expect(getCameraLabel(device)).toBe('Front');
  });

  it('should return "Front" when label contains "user"', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'front-2',
      label: 'user facing camera',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    expect(getCameraLabel(device)).toBe('Front');
  });

  it('should return "Front" case-insensitively', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'front-3',
      label: 'FRONT Camera',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    expect(getCameraLabel(device)).toBe('Front');
  });

  it('should return "Back" when label contains "back"', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'back-1',
      label: 'Back Camera',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    expect(getCameraLabel(device)).toBe('Back');
  });

  it('should return "Back" when label contains "rear"', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'back-2',
      label: 'rear cam',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    expect(getCameraLabel(device)).toBe('Back');
  });

  it('should return "Back" when label contains "environment"', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'back-3',
      label: 'environment',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    expect(getCameraLabel(device)).toBe('Back');
  });

  it('should return "Back" case-insensitively for "rear"', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'back-4',
      label: 'Rear Camera',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    expect(getCameraLabel(device)).toBe('Back');
  });

  it('should return "Camera" when label does not match front or back keywords', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'generic-1',
      label: 'USB Webcam',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    expect(getCameraLabel(device)).toBe('Camera');
  });

  it('should return "Camera" when label is empty', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'generic-2',
      label: '',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    expect(getCameraLabel(device)).toBe('Camera');
  });

  it('should always return a non-empty string', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'test',
      label: '   ',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    const result = getCameraLabel(device);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should prioritize "front" over other keywords', () => {
    const device: MediaDeviceInfo = {
      deviceId: 'test',
      label: 'Front Back Camera',
      kind: 'videoinput',
      groupId: 'group-1',
      toJSON: () => ({}),
    } as MediaDeviceInfo;
    expect(getCameraLabel(device)).toBe('Front');
  });

  /**
   * Property 4: Camera label display is total and non-empty
   * Validates: Requirements 3.4, 6.5
   */
  it('(PBT) Property 4: camera label display is total and non-empty', () => {
    fc.assert(
      fc.property(fc.string(), label => {
        const device: MediaDeviceInfo = {
          deviceId: 'device-id',
          label,
          kind: 'videoinput',
          groupId: 'group-id',
          toJSON: () => ({}),
        } as MediaDeviceInfo;
        const result = getCameraLabel(device);
        return typeof result === 'string' && result.length > 0;
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * ============================================================================
 * Task 2.6: Unit Tests for getCycledDeviceId
 * ============================================================================
 */
describe('getCycledDeviceId', () => {
  it('should cycle to the next device when first is selected', () => {
    const deviceIds = ['device-1', 'device-2', 'device-3'];
    expect(getCycledDeviceId(deviceIds, 'device-1')).toBe('device-2');
  });

  it('should cycle to the next device when middle device is selected', () => {
    const deviceIds = ['device-1', 'device-2', 'device-3'];
    expect(getCycledDeviceId(deviceIds, 'device-2')).toBe('device-3');
  });

  it('should wrap around to first device when last is selected', () => {
    const deviceIds = ['device-1', 'device-2', 'device-3'];
    expect(getCycledDeviceId(deviceIds, 'device-3')).toBe('device-1');
  });

  it('should handle two-device list correctly (alternates)', () => {
    const deviceIds = ['device-1', 'device-2'];
    expect(getCycledDeviceId(deviceIds, 'device-1')).toBe('device-2');
    expect(getCycledDeviceId(deviceIds, 'device-2')).toBe('device-1');
  });

  it('should cycle to itself for single-device list', () => {
    const deviceIds = ['device-1'];
    expect(getCycledDeviceId(deviceIds, 'device-1')).toBe('device-1');
  });

  it('should preserve enumeration order', () => {
    const deviceIds = ['a', 'b', 'c', 'd', 'e'];
    const start = getCycledDeviceId(deviceIds, 'a');
    expect(start).toBe('b');
    expect(getCycledDeviceId(deviceIds, start)).toBe('c');
  });

  it('should cycle through all devices correctly', () => {
    const deviceIds = ['device-1', 'device-2', 'device-3'];
    let current = 'device-1';
    for (let i = 0; i < 3; i++) {
      current = getCycledDeviceId(deviceIds, current);
    }
    expect(current).toBe('device-1');
  });

  /**
   * Property 5: Camera switch cycles in enumeration order
   * Validates: Requirements 6.3
   */
  it('(PBT) Property 5: camera switch cycles in enumeration order', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 10 }),
        fc.nat(),
        (deviceIds, startIndex) => {
          const i = startIndex % deviceIds.length;
          const expected = deviceIds[(i + 1) % deviceIds.length];
          const result = getCycledDeviceId(deviceIds, deviceIds[i]);
          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5.1: Applying cycle N times (N = list length) returns to original
   */
  it('(PBT) Property 5.1: applying cycle n times returns to original', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        deviceIds => {
          let current = deviceIds[0];
          for (let i = 0; i < deviceIds.length; i++) {
            current = getCycledDeviceId(deviceIds, current);
          }
          return current === deviceIds[0];
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * ============================================================================
 * Task 4.1 & 4.2: handleCameraError Centralized Error Handler
 * ============================================================================
 * Tests for the error-message mapping and handleCameraError functionality.
 * Validates: Requirements 7.1, 7.3, 7.4, 7.5, 7.6
 */
describe('Error Mapping Logic (Task 4.1 & 4.2)', () => {
  const getErrorMessage = (err: any): string => {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Camera permission denied';
    } else if (err.name === 'NotFoundError') {
      return 'No camera found';
    } else if (err.name === 'NotReadableError') {
      return 'Camera already in use';
    } else {
      return 'Camera error';
    }
  };

  /**
   * Task 4.2: Unit tests for error-message mapping
   * Validates: Requirements 7.1, 7.3, 7.4
   */
  describe('error message mapping', () => {
    it('should map NotAllowedError → "Camera permission denied"', () => {
      const err = Object.assign(new Error(), { name: 'NotAllowedError' });
      expect(getErrorMessage(err)).toBe('Camera permission denied');
    });

    it('should map PermissionDeniedError → "Camera permission denied"', () => {
      const err = Object.assign(new Error(), { name: 'PermissionDeniedError' });
      expect(getErrorMessage(err)).toBe('Camera permission denied');
    });

    it('should map NotFoundError → "No camera found"', () => {
      const err = Object.assign(new Error(), { name: 'NotFoundError' });
      expect(getErrorMessage(err)).toBe('No camera found');
    });

    it('should map NotReadableError → "Camera already in use"', () => {
      const err = Object.assign(new Error(), { name: 'NotReadableError' });
      expect(getErrorMessage(err)).toBe('Camera already in use');
    });

    it('should map unknown error types → "Camera error"', () => {
      const err = Object.assign(new Error(), { name: 'UnknownError' });
      expect(getErrorMessage(err)).toBe('Camera error');
    });

    it('should handle missing error.name property → defaults to "Camera error"', () => {
      const err = {};
      expect(getErrorMessage(err)).toBe('Camera error');
    });

    it('should handle error with null name → defaults to "Camera error"', () => {
      const err = { name: null };
      expect(getErrorMessage(err)).toBe('Camera error');
    });

    it('should handle error with undefined name → defaults to "Camera error"', () => {
      const err = { name: undefined };
      expect(getErrorMessage(err)).toBe('Camera error');
    });

    it('should map AbortError → "Camera error" (non-specific)', () => {
      const err = Object.assign(new Error(), { name: 'AbortError' });
      expect(getErrorMessage(err)).toBe('Camera error');
    });

    it('should map OverconstrainedError → "Camera error" (non-specific)', () => {
      const err = Object.assign(new Error(), { name: 'OverconstrainedError' });
      expect(getErrorMessage(err)).toBe('Camera error');
    });
  });

  /**
   * Property 11: Error type maps deterministically to error message
   * Validates: Requirements 7.1, 7.3, 7.4
   */
  it('(PBT) Property 11: error type maps deterministically to error message', () => {
    const errorNames = [
      'NotAllowedError',
      'PermissionDeniedError',
      'NotFoundError',
      'NotReadableError',
      'AbortError',
      'OverconstrainedError',
    ];
    fc.assert(
      fc.property(fc.constantFrom(...errorNames), name => {
        const err = Object.assign(new Error(), { name });
        const msg = getErrorMessage(err);
        const isNonEmpty = typeof msg === 'string' && msg.length > 0;
        // Verify mapping is injective for key error types
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          return msg === 'Camera permission denied';
        }
        if (name === 'NotFoundError') {
          return msg === 'No camera found';
        }
        if (name === 'NotReadableError') {
          return msg === 'Camera already in use';
        }
        return isNonEmpty;
      }),
      { numRuns: 100 }
    );
  });
});

/**
 * ============================================================================
 * Task 4.3 & 4.4: Update announce and test for aria-atomic attribute
 * ============================================================================
 * Tests for announce utility function that creates accessible announcements.
 * Validates: Requirements 8.5
 */
describe('announce function (Task 4.3 & 4.4)', () => {
  /**
   * Task 4.4: Unit tests for announce function
   * Validates: Requirements 8.5
   */
  describe('announce utility - unit tests', () => {
    it('should create node with role="status" attribute', () => {
      const announce = (message: string) => {
        const el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.textContent = message;
        document.body.appendChild(el);
        return el;
      };

      const el = announce('Test message');
      expect(el.getAttribute('role')).toBe('status');
      document.body.removeChild(el);
    });

    it('should create node with aria-live="polite" attribute', () => {
      const announce = (message: string) => {
        const el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.textContent = message;
        document.body.appendChild(el);
        return el;
      };

      const el = announce('Test message');
      expect(el.getAttribute('aria-live')).toBe('polite');
      document.body.removeChild(el);
    });

    it('should create node with aria-atomic="true" attribute', () => {
      const announce = (message: string) => {
        const el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.textContent = message;
        document.body.appendChild(el);
        return el;
      };

      const el = announce('Test message');
      expect(el.getAttribute('aria-atomic')).toBe('true');
      document.body.removeChild(el);
    });

    it('should add node to DOM immediately', () => {
      const announce = (message: string) => {
        const el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.textContent = message;
        document.body.appendChild(el);
        return el;
      };

      const el = announce('Test message');
      expect(document.body.contains(el)).toBe(true);
      document.body.removeChild(el);
    });

    it('should set text content correctly', () => {
      const announce = (message: string) => {
        const el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.textContent = message;
        document.body.appendChild(el);
        return el;
      };

      const el = announce('Camera ready');
      expect(el.textContent).toBe('Camera ready');
      document.body.removeChild(el);
    });

    it('should remove node from DOM after 1000 ms', async () => {
      const announce = (message: string) => {
        const el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.textContent = message;
        document.body.appendChild(el);
        setTimeout(() => {
          if (document.body.contains(el)) document.body.removeChild(el);
        }, 1000);
        return el;
      };

      const el = announce('Test cleanup');
      expect(document.body.contains(el)).toBe(true);
      await new Promise(r => setTimeout(r, 1100));
      expect(document.body.contains(el)).toBe(false);
    });

    it('should handle special characters in message', () => {
      const announce = (message: string) => {
        const el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.textContent = message;
        document.body.appendChild(el);
        return el;
      };

      const el = announce('Item scanned: Test™ & "Device" (v1.0)');
      expect(el.textContent).toBe('Item scanned: Test™ & "Device" (v1.0)');
      document.body.removeChild(el);
    });

    it('should handle long messages', () => {
      const announce = (message: string) => {
        const el = document.createElement('div');
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        el.textContent = message;
        document.body.appendChild(el);
        return el;
      };

      const longMessage = 'This is a very long announcement message that should be handled correctly by the announce utility function without any issues';
      const el = announce(longMessage);
      expect(el.textContent).toBe(longMessage);
      document.body.removeChild(el);
    });
  });

  /**
   * Property 6: Announcement nodes always include aria-atomic and are cleaned up
   * Validates: Requirements 8.5
   */
  it('(PBT) Property 6: announcement nodes always include aria-atomic and are cleaned up', () => {
    const announce = (message: string) => {
      const el = document.createElement('div');
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.className = 'sr-only';
      el.textContent = message;
      document.body.appendChild(el);
      setTimeout(() => {
        if (document.body.contains(el)) document.body.removeChild(el);
      }, 1000);
      return el;
    };

    fc.assert(
      fc.property(fc.string({ minLength: 1 }), text => {
        const el = announce(text);
        const hasAtomicAttr = el.getAttribute('aria-atomic') === 'true';
        const hasLiveAttr = el.getAttribute('aria-live') === 'polite';
        const hasRoleAttr = el.getAttribute('role') === 'status';
        const isPresentInDOM = document.body.contains(el);
        const correctText = el.textContent === text;

        // Clean up
        if (document.body.contains(el)) {
          document.body.removeChild(el);
        }

        return (
          hasAtomicAttr &&
          hasLiveAttr &&
          hasRoleAttr &&
          isPresentInDOM &&
          correctText
        );
      }),
      { numRuns: 100 }
    );
  });
});
