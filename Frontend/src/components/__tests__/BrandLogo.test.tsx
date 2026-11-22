import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrandingProvider, useBranding, CMS_STORAGE_KEY } from '../../contexts/BrandingContext';
import { BrandLogo } from '../BrandLogo';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

const mockGet = vi.fn();
vi.mock('../../services/api', () => ({
  api: {
    get: (...args: any[]) => mockGet(...args),
  },
  getFileUrl: (path: string) => (path.startsWith('http') || path.startsWith('data:') ? path : `http://localhost:3003${path}`),
}));

function BrandingUpdater() {
  const { applyBrandingContent } = useBranding();
  return (
    <button
      type="button"
      onClick={() =>
        applyBrandingContent({
          appearance: { logo: '/uploads/new-org-logo.png' },
          footer: { companyName: 'Acme Training Institute', tagline: 'Skills First' },
        })
      }
    >
      Update Logo
    </button>
  );
}

describe('BrandingContext & BrandLogo', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '<link rel="icon" href="/favicon.svg" /><link rel="apple-touch-icon" href="/icons/icon-192x192.png" />';
    mockGet.mockReset();
    mockGet.mockResolvedValue({ success: true, data: { content: { appearance: { logo: '' } } } });
  });

  it('renders fallback monogram when no logo is set and updates immediately across BrandLogo, localStorage, and favicon when branding changes', async () => {
    render(
      <BrandingProvider>
        <BrandLogo />
        <BrandingUpdater />
      </BrandingProvider>
    );

    expect(screen.getByText('BMDC')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Update Logo' }));

    const img = await screen.findByRole('img', { name: 'Acme Training Institute Logo' });
    expect(img).toHaveAttribute('src', 'http://localhost:3003/uploads/new-org-logo.png');

    // Synced to localStorage for print/PDF/other tabs
    const stored = JSON.parse(localStorage.getItem(CMS_STORAGE_KEY) || '{}');
    expect(stored.appearance.logo).toBe('/uploads/new-org-logo.png');

    // Synced to browser favicon & touch icon
    await waitFor(() => {
      const favicon = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
      expect(favicon?.href).toContain('/uploads/new-org-logo.png');
    });
  });

  it('gracefully falls back to monogram when logo image fails to load', async () => {
    render(
      <BrandingProvider>
        <BrandLogo logoUrl="/uploads/broken.png" companyName="Metro Skills Center" />
      </BrandingProvider>
    );

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const img = screen.getByRole('img', { name: 'Metro Skills Center Logo' });
    fireEvent.error(img);

    expect(screen.getByText('MSC')).toBeInTheDocument();
  });
});
