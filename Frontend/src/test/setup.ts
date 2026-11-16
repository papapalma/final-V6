import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock IntersectionObserver - needs to be a proper constructor
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  observe() {}
  unobserve() {}
  disconnect() {}
} as any;

// Cleanup after each test case
afterEach(() => {
  cleanup();
  if (typeof document !== 'undefined' && document.body) {
    document.body.innerHTML = '';
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.clear();
    } catch {
      // Ignore errors if localStorage is not accessible
    }
  }
  if (typeof global.gc === 'function') {
    try {
      global.gc();
    } catch {
      // Ignore gc error
    }
  }
});
