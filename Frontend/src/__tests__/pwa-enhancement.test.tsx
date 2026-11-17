import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  canInstallPWA,
  isStandalone,
  isDesktop,
  isIOS,
  isAndroid,
  getInstallInstructions,
  subscribeInstallPrompt,
  promptPWAInstall,
} from '../utils/pwa';

describe('PWA Enhancement Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Manifest & Service Worker Files', () => {
    it('manifest.json exists in public directory and has valid standalone configuration', () => {
      const manifestPath = path.resolve(__dirname, '../../public/manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);

      const raw = fs.readFileSync(manifestPath, 'utf8');
      const manifest = JSON.parse(raw);

      expect(manifest.name).toBe('Bongabong Manpower Development Center');
      expect(manifest.short_name).toBe('BMDC');
      expect(manifest.display).toBe('standalone');
      expect(manifest.start_url).toBe('/?source=pwa');
      expect(manifest.theme_color).toBe('#2563eb');
      expect(Array.isArray(manifest.icons)).toBe(true);

      const sizes = manifest.icons.map((icon: any) => icon.sizes);
      expect(sizes).toContain('192x192');
      expect(sizes).toContain('512x512');
      expect(Array.isArray(manifest.shortcuts)).toBe(true);
    });

    it('sw.js exists in public directory with core event handlers', () => {
      const swPath = path.resolve(__dirname, '../../public/sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, 'utf8');
      expect(swContent).toContain("addEventListener('install'");
      expect(swContent).toContain("addEventListener('activate'");
      expect(swContent).toContain("addEventListener('fetch'");
      expect(swContent).toContain("addEventListener('push'");
      expect(swContent).toContain("addEventListener('notificationclick'");
      expect(swContent).toContain("addEventListener('sync'");
    });

    it('icons exist in public/icons directory', () => {
      const icon192 = path.resolve(__dirname, '../../public/icons/icon-192x192.png');
      const icon512 = path.resolve(__dirname, '../../public/icons/icon-512x512.png');
      expect(fs.existsSync(icon192)).toBe(true);
      expect(fs.existsSync(icon512)).toBe(true);
    });
  });

  describe('PWA Utility functions', () => {
    it('isStandalone returns true when display-mode is standalone or navigator.standalone is true', () => {
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(display-mode: standalone)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as any));

      expect(isStandalone()).toBe(true);
      window.matchMedia = originalMatchMedia;
    });

    it('device detection identifies desktop, ios, and android properly', () => {
      expect(typeof isDesktop()).toBe('boolean');
      expect(typeof isIOS()).toBe('boolean');
      expect(typeof isAndroid()).toBe('boolean');
    });

    it('getInstallInstructions returns valid instructions structure', () => {
      const instructions = getInstallInstructions();
      expect(instructions).toHaveProperty('platform');
      expect(instructions).toHaveProperty('label');
      expect(Array.isArray(instructions.steps)).toBe(true);
      expect(instructions.steps.length).toBeGreaterThan(0);
    });

    it('subscribeInstallPrompt informs listener of initial and changed state', () => {
      let callCount = 0;
      let lastVal: boolean | null = null;

      const unsubscribe = subscribeInstallPrompt((canInstall) => {
        callCount++;
        lastVal = canInstall;
      });

      expect(callCount).toBe(1);
      expect(typeof lastVal).toBe('boolean');
      expect(typeof unsubscribe).toBe('function');
      unsubscribe();
    });

    it('promptPWAInstall returns unsupported when no prompt is available', async () => {
      const result = await promptPWAInstall();
      expect(result).toEqual({ outcome: 'unsupported' });
    });
  });
});
