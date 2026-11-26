import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LanguageProvider, useLanguage } from '../LanguageContext';
import { usePortalDomLocalizer } from '../../i18n/portalDomLocalizer';

let mockUser: any = null;
let mockIsAuthenticated = false;
const mockUpdateUserPreferredLanguage = vi.fn((lang: 'en' | 'fil') => {
  if (mockUser) {
    mockUser = { ...mockUser, preferredLanguage: lang };
  }
});

vi.mock('../AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
    updateUserPreferredLanguage: mockUpdateUserPreferredLanguage,
  }),
}));

const mockUpdatePreferredLanguageApi = vi.fn().mockResolvedValue({
  id: 'u-1',
  preferred_language: 'fil',
  persisted: true,
});

vi.mock('../../services/authService', () => ({
  default: {
    updatePreferredLanguage: (...args: any[]) => mockUpdatePreferredLanguageApi(...args),
  },
}));

function LanguageHarness() {
  const { language, setLanguage, toggleLanguage, t, tx } = useLanguage();
  usePortalDomLocalizer(language, mockIsAuthenticated && !!mockUser);

  return (
    <div>
      <span data-testid="active-lang">{language}</span>
      <span data-testid="settings-heading">{t('settings.heading')}</span>
      <span data-testid="tx-phrase">{tx('Save Changes')}</span>
      <h2>Account Management</h2>
      <label>First Name *</label>
      <input placeholder="Search users..." />
      <p>Showing 1 to 10 of 42 results</p>
      <div className="printable-report-container">
        <span data-testid="official-print">Official Report Header</span>
        <span>Account Management</span>
      </div>
      <button onClick={() => void setLanguage('fil')}>Set Filipino</button>
      <button onClick={() => void setLanguage('en')}>Set English</button>
      <button onClick={() => void toggleLanguage()}>Toggle</button>
    </div>
  );
}

describe('Per-User LanguageContext & Portal DOM Localizer', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    mockUser = null;
    mockIsAuthenticated = false;
    vi.clearAllMocks();
  });

  it('isolates language per user: User A stays in English while Users B and C use Filipino', async () => {
    // User B logs in and switches to Filipino
    mockUser = { id: 'user-b', name: 'Maria', email: 'b@bmdc.edu', role: 'trainee', preferredLanguage: 'en' };
    mockIsAuthenticated = true;

    const { rerender } = render(
      <LanguageProvider>
        <LanguageHarness />
      </LanguageProvider>
    );

    expect(screen.getByTestId('active-lang')).toHaveTextContent('en');
    fireEvent.click(screen.getByText('Set Filipino'));

    await waitFor(() => {
      expect(screen.getByTestId('active-lang')).toHaveTextContent('fil');
    });
    expect(document.documentElement.lang).toBe('tl');
    expect(localStorage.getItem('bmdc-lang:user-b')).toBe('fil');
    expect(mockUpdatePreferredLanguageApi).toHaveBeenCalledWith('fil');

    // User A logs in on the same browser with preferredLanguage: 'en' -> stays in English!
    mockUser = { id: 'user-a', name: 'Juan', email: 'a@bmdc.edu', role: 'local_admin', preferredLanguage: 'en' };
    rerender(
      <LanguageProvider>
        <LanguageHarness />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-lang')).toHaveTextContent('en');
    });
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByTestId('settings-heading')).toHaveTextContent('Settings');

    // User C logs in from another device where DB already has preferredLanguage: 'fil'
    mockUser = { id: 'user-c', name: 'Pedro', email: 'c@bmdc.edu', role: 'trainee', preferredLanguage: 'fil' };
    rerender(
      <LanguageProvider>
        <LanguageHarness />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-lang')).toHaveTextContent('fil');
    });
    expect(document.documentElement.lang).toBe('tl');
    expect(screen.getByTestId('settings-heading')).toHaveTextContent('Mga Setting');
  });

  it('resets active UI language to English on logout while preserving User B saved preference', async () => {
    mockUser = { id: 'user-b', name: 'Maria', email: 'b@bmdc.edu', role: 'trainee', preferredLanguage: 'fil' };
    mockIsAuthenticated = true;

    const { rerender } = render(
      <LanguageProvider>
        <LanguageHarness />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-lang')).toHaveTextContent('fil');
    });

    // Logout -> unauthenticated public state
    mockUser = null;
    mockIsAuthenticated = false;
    rerender(
      <LanguageProvider>
        <LanguageHarness />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-lang')).toHaveTextContent('en');
    });
    expect(document.documentElement.lang).toBe('en');
    // Saved per-user local cache remains intact for User B's next login
    expect(localStorage.getItem('bmdc-lang:user-b')).toBe('fil');
  });

  it('translates portal DOM strings & placeholders to Filipino and restores verbatim English vice versa while skipping print containers', async () => {
    mockUser = { id: 'user-d', name: 'Ana', email: 'd@bmdc.edu', role: 'staff_inventory_manager', preferredLanguage: 'en' };
    mockIsAuthenticated = true;

    render(
      <LanguageProvider>
        <LanguageHarness />
      </LanguageProvider>
    );

    // Switch English -> Filipino
    fireEvent.click(screen.getByText('Toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('active-lang')).toHaveTextContent('fil');
      expect(screen.getByText('Pamamahala ng Account')).toBeInTheDocument();
      expect(screen.getByText('Unang Pangalan *')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Maghanap ng user...')).toBeInTheDocument();
      expect(screen.getByText('Nagpapakita ng 1 hanggang 10 sa 42 rekord')).toBeInTheDocument();
    });

    // Official print container remains strictly in English!
    const printBlock = document.querySelector('.printable-report-container')!;
    expect(printBlock.textContent).toContain('Account Management');

    // Switch Filipino -> English (vice versa!)
    fireEvent.click(screen.getByText('Toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('active-lang')).toHaveTextContent('en');
      expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
      expect(screen.getByText('First Name *')).toBeInTheDocument();
      expect(screen.getByText('Showing 1 to 10 of 42 results')).toBeInTheDocument();
    });
  });
});
