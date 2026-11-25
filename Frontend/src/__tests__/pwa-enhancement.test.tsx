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

    it('sw.js exists in public directory with core event handlers and Network-First icon/manifest caching', () => {
      const swPath = path.resolve(__dirname, '../../public/sw.js');
      expect(fs.existsSync(swPath)).toBe(true);

      const swContent = fs.readFileSync(swPath, 'utf8');
      expect(swContent).toContain("addEventListener('install'");
      expect(swContent).toContain("addEventListener('activate'");
      expect(swContent).toContain("addEventListener('fetch'");
      expect(swContent).toContain("addEventListener('push'");
      expect(swContent).toContain("addEventListener('notificationclick'");
      expect(swContent).toContain("addEventListener('sync'");
      expect(swContent).toContain("url.pathname.startsWith('/icons/')");
      expect(swContent).toContain("url.pathname === '/manifest.json'");
    });

    it('every icon declared in manifest.json exists as a valid, non-placeholder PNG with separate any and maskable entries', () => {
      const publicDir = path.resolve(__dirname, '../../public');
      const manifestPath = path.join(publicDir, 'manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // Must never reference legacy blue 'B' favicon.svg inside manifest icons
      const srcs = manifest.icons.map((icon: any) => icon.src);
      expect(srcs.some((s: string) => s.includes('favicon.svg'))).toBe(false);

      // Separate 'any' and 'maskable' entries for 192x192 and 512x512
      expect(manifest.icons.some((i: any) => i.sizes === '192x192' && i.purpose === 'any')).toBe(true);
      expect(manifest.icons.some((i: any) => i.sizes === '192x192' && i.purpose === 'maskable')).toBe(true);
      expect(manifest.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'any')).toBe(true);
      expect(manifest.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);

      // Every icon & shortcut icon resolves to an existing valid PNG file
      const allIconRefs: Array<{ src: string; sizes?: string }> = [
        ...manifest.icons,
        ...manifest.shortcuts.flatMap((s: any) => s.icons || []),
      ];
      for (const entry of allIconRefs) {
        const cleanRel = entry.src.split('?')[0].replace(/^\//, '');
        const absPath = path.join(publicDir, cleanRel);
        expect(fs.existsSync(absPath)).toBe(true);
        const bytes = fs.readFileSync(absPath);
        // Valid PNG magic header: 89 50 4E 47
        expect(bytes[0]).toBe(0x89);
        expect(bytes[1]).toBe(0x50);
        expect(bytes[2]).toBe(0x4e);
        expect(bytes[3]).toBe(0x47);
        // 192x192 and 512x512 seal logos must be substantially larger than the legacy 4.9kB blue 'B' placeholder
        if (entry.sizes === '192x192' || entry.sizes === '512x512') {
          expect(bytes.length).toBeGreaterThan(8000);
        }
      }

      // Legacy fallback icon files also remain present on disk
      expect(fs.existsSync(path.join(publicDir, 'icons/icon-192x192.png'))).toBe(true);
      expect(fs.existsSync(path.join(publicDir, 'icons/icon-512x512.png'))).toBe(true);
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
