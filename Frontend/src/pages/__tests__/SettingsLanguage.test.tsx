import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from '../SettingsPage';
import { LanguageProvider } from '../../contexts/LanguageContext';

const mockUser = {
  id: 'trainee-101',
  name: 'Ramon Magsaysay',
  email: 'ramon@bmdc.edu',
  role: 'trainee' as const,
  preferredLanguage: 'en' as const,
};

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: true,
    isAuthReady: true,
    hasPermission: () => false,
    logout: vi.fn(),
    updateUserPreferredLanguage: vi.fn(),
  }),
}));

vi.mock('../../contexts/BrandingContext', () => ({
  useBranding: () => ({
    companyName: 'Bongabong MDC',
    tagline: 'Official Training Center',
    logoUrl: '',
  }),
  getBrandInitials: () => 'BM',
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    isDark: false,
    toggleTheme: vi.fn(),
  }),
}));

vi.mock('../../contexts/MessengerContext', () => ({
  useMessenger: () => ({
    totalUnreadCount: 0,
  }),
}));

vi.mock('../../components/messenger/TraineeMessengerDrawer', () => ({
  TraineeMessengerDrawer: () => null,
}));

vi.mock('../../components/OverdueBellNotification', () => ({
  default: () => null,
}));

vi.mock('../../components/PWAStatus', () => ({
  default: () => <div data-testid="pwa-status-mock">PWA Status</div>,
}));

vi.mock('../../utils/pushSubscription', () => ({
  subscribeToPushNotifications: vi.fn(),
  unsubscribeFromPushNotifications: vi.fn(),
  getUserPushSubscriptions: vi.fn().mockResolvedValue([]),
}));

const mockUpdatePreferredLanguage = vi.fn().mockResolvedValue({
  id: 'trainee-101',
  preferred_language: 'fil',
  persisted: true,
});

vi.mock('../../services/authService', () => ({
  default: {
    updatePreferredLanguage: (...args: any[]) => mockUpdatePreferredLanguage(...args),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SettingsPage Language Segmented Control (English <-> Filipino)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('switches Settings UI and sidebar navigation from English to Filipino and back to English', async () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <LanguageProvider>
          <SettingsPage />
        </LanguageProvider>
      </MemoryRouter>
    );

    expect(screen.getByText('Trainee Settings & Preferences')).toBeInTheDocument();
    expect(screen.getAllByText('Display Language').length).toBeGreaterThan(0);

    // Click the Filipino radio segment
    const filipinoRadios = screen.getAllByRole('radio', { name: /Filipino/i });
    fireEvent.click(filipinoRadios[0]);

    await waitFor(() => {
      expect(screen.getByText('Mga Setting at Kagustuhan ng Trainee')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Wika ng Portal').length).toBeGreaterThan(0);
    expect(mockUpdatePreferredLanguage).toHaveBeenCalledWith('fil');

    // Switch back from Filipino to English (vice versa) via keyboard ArrowLeft
    const radioGroups = screen.getAllByRole('radiogroup');
    fireEvent.keyDown(radioGroups[0], { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(screen.getByText('Trainee Settings & Preferences')).toBeInTheDocument();
    });
    expect(mockUpdatePreferredLanguage).toHaveBeenCalledWith('en');
  });
});
