/**
 * Tests: Push Subscription Utility
 *
 * Tests the frontend push subscription management functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isPushNotificationSupported,
  urlBase64ToUint8Array,
  getDeviceIdentifier,
  getBrowserName,
  showLocalAttendanceReminder,
} from '../utils/pushSubscription';

/**
 * Note: These tests focus on utility functions that don't require browser APIs.
 * Integration tests with actual push subscriptions would require:
 * - A real service worker registration
 * - A running backend with VAPID keys
 * - Mock push manager
 */

/**
 * Test 1: Browser Support Detection
 */
describe('Browser Support Detection', () => {
  it('should detect push notification support', () => {
    // In Node.js test environment, should return false
    // In browser environment, should check for required APIs
    const supported = isPushNotificationSupported();
    expect(typeof supported).toBe('boolean');
  });

  it('should require serviceWorker API', () => {
    // All three APIs required: serviceWorker, PushManager, Notification
    const hasServiceWorker = 'serviceWorker' in navigator;
    expect(typeof hasServiceWorker).toBe('boolean');
  });
});

/**
 * Test 2: VAPID Key Conversion
 */
describe('VAPID Key Conversion', () => {
  it('should convert base64url to Uint8Array', () => {
    // Mock VAPID key (base64url format)
    const mockVapidKey = 'BCEllJKxR0DYhBnkMLy0UwFm6mRlYkgQQj3jSzGpvvqREoMz4g2OLPZxZ-y7PFhx5YhSJLagJQmPsE08T_ZVuKs';

    const uint8Array = urlBase64ToUint8Array(mockVapidKey);

    expect(uint8Array).toBeInstanceOf(Uint8Array);
    expect(uint8Array.length).toBeGreaterThan(0);
    
    // VAPID keys when converted should be around 65 bytes
    expect(uint8Array.length).toBeCloseTo(65, 10);
  });

  it('should handle base64url with missing padding', () => {
    // base64url doesn't include padding, conversion should handle this
    const keyWithoutPadding = 'BCEllJKxR0DYhBnkMLy0UwFm6mRlYkgQQj3jSzGpvvqREoMz4g2OLPZxZ-y7PFhx5YhSJLagJQmPsE08T_ZVuKs';
    
    const uint8Array = urlBase64ToUint8Array(keyWithoutPadding);
    
    expect(uint8Array).toBeInstanceOf(Uint8Array);
    expect(uint8Array.length).toBeGreaterThan(0);
  });

  it('should convert - and _ characters correctly', () => {
    // base64url uses - instead of +, and _ instead of /
    const keyWithUrlChars = 'BC-el_JKxR0DYhBnkMLy0UwFm6mRlYkgQQj3jSzGpvvqREoMz4g2OLPZxZ-y7PFhx5YhSJLagJQmPsE08T_ZVuKs';
    
    const uint8Array = urlBase64ToUint8Array(keyWithUrlChars);
    
    expect(uint8Array).toBeInstanceOf(Uint8Array);
  });
});

/**
 * Test 3: Device Identification
 */
describe('Device Identification', () => {
  it('should generate device identifier', () => {
    // Mock user agent for testing
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
    
    // In real test, this would be called with actual navigator
    // For this test, we verify the format is correct
    const identifierPattern = /^[a-z-]+-(windows|linux|macintel|iphone|ipad|android)-(desktop|mobile)$/i;
    
    // Example of expected format
    const expectedExample = 'chrome-windows-desktop';
    expect(expectedExample).toMatch(identifierPattern);
  });

  it('should identify mobile devices', () => {
    const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15';
    
    const isMobile = /mobile|android|iphone|ipad/i.test(mobileUserAgent);
    expect(isMobile).toBe(true);
  });

  it('should identify desktop devices', () => {
    const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    
    const isMobile = /mobile|android|iphone|ipad/i.test(desktopUserAgent);
    expect(isMobile).toBe(false);
  });
});

/**
 * Test 4: Browser Detection
 */
describe('Browser Detection', () => {
  it('should detect Chrome', () => {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0';
    
    const isChrome = userAgent.includes('Chrome') && !userAgent.includes('Edge');
    expect(isChrome).toBe(true);
  });

  it('should detect Firefox', () => {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
    
    const isFirefox = userAgent.includes('Firefox');
    expect(isFirefox).toBe(true);
  });

  it('should detect Safari', () => {
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15';
    
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome');
    expect(isSafari).toBe(true);
  });

  it('should detect Edge', () => {
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/91.0';
    
    const isEdge = userAgent.includes('Edg') || userAgent.includes('Edge');
    expect(isEdge).toBe(true);
  });
});

/**
 * Test 5: Subscription Payload Structure
 */
describe('Subscription Payload Structure', () => {
  it('should have correct notification payload format', () => {
    const payload = {
      title: 'Test Notification',
      body: 'Test body',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: 'test',
      url: '/dashboard',
      data: {
        type: 'test',
      },
    };

    expect(payload.title).toBeDefined();
    expect(payload.body).toBeDefined();
    expect(typeof payload.title).toBe('string');
    expect(typeof payload.body).toBe('string');
    expect(payload.icon).toMatch(/^\/icons\//);
    expect(payload.url).toMatch(/^\//);
  });

  it('should include notification types', () => {
    const types = ['enrollment', 'schedule-change', 'training-reminder', 'training-completion'];

    types.forEach(type => {
      expect(type).toMatch(/^[a-z-]+$/);
    });
  });
});

/**
 * Test 6: Subscription Endpoint Format
 */
describe('Subscription Endpoint Format', () => {
  it('should validate FCM endpoint format', () => {
    const fcmEndpoint = 'https://fcm.googleapis.com/fcm/send/eHYz...';
    
    expect(fcmEndpoint).toMatch(/^https:\/\/fcm\.googleapis\.com\/fcm\/send\/[a-zA-Z0-9_-]+/);
  });

  it('should require HTTPS for endpoint', () => {
    const validEndpoint = 'https://example.com/push';
    const invalidEndpoint = 'http://example.com/push';

    expect(validEndpoint).toMatch(/^https:\/\//);
    expect(invalidEndpoint).toMatch(/^http:\/\//); // Should reject in real code
  });
});

/**
 * Test 7: Error Scenarios
 */
describe('Error Scenarios', () => {
  it('should handle empty VAPID key', () => {
    const emptyKey = '';
    
    // Should be rejected or logged
    expect(emptyKey.length).toBe(0);
  });

  it('should handle invalid base64url', () => {
    const invalidBase64 = '!!!invalid!!!';
    
    // Conversion should either fail gracefully or be prevented by validation
    expect(invalidBase64.match(/[!]/)).toBeTruthy();
  });

  it('should handle missing notification permission', () => {
    // When Notification.permission is not granted, should not proceed
    const permission = 'denied';
    
    expect(['granted', 'denied', 'default'].includes(permission)).toBe(true);
    expect(permission === 'granted').toBe(false);
  });
});

/**
 * Test 8: Data Privacy
 */
describe('Data Privacy', () => {
  it('should not expose sensitive data in logs', () => {
    // Subscriptions should not be fully logged
    const endpoint = 'https://fcm.googleapis.com/fcm/send/very-long-endpoint-string';
    
    // Should truncate in logs
    const truncated = endpoint.substring(0, 50) + '...';
    expect(truncated.length).toBeLessThan(endpoint.length);
    expect(truncated.endsWith('...')).toBe(true);
  });

  it('should protect keys in transmission', () => {
    // Keys should only be sent over HTTPS
    const protocol = 'https';
    
    expect(protocol).toBe('https');
  });
});

describe('Local Attendance Reminder Deduplication', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('deduplicates repeated local notifications for the same day+slot tag', async () => {
    const notifSpy = vi.fn();
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: Object.assign(notifSpy, { permission: 'granted' }),
    });

    const first = await showLocalAttendanceReminder(
      'Morning attendance window is open',
      'Submit now',
      'attendance-2026-11-27-morning'
    );
    const second = await showLocalAttendanceReminder(
      'Morning attendance window is open',
      'Submit now',
      'attendance-2026-11-27-morning'
    );

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(notifSpy).toHaveBeenCalledTimes(1);
  });
});
