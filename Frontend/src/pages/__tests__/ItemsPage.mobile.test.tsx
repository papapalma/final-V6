import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ItemsPage from '../ItemsPage';
import inventoryService from '../../services/inventoryService';

vi.mock('../../components/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Admin', role: 'local_admin', tenantName: 'BMDC' },
    hasPermission: () => true,
  }),
}));

vi.mock('../../components/QRCodeModal', () => ({ default: () => null }));
vi.mock('../../components/ItemDetailsModal', () => ({ default: () => null }));
vi.mock('../../utils/pdfGenerator', () => ({ generateItemsPDF: vi.fn() }));

vi.mock('../../services/inventoryService', () => ({
  default: {
    getInventoryItems: vi.fn(),
  },
}));

describe('ItemsPage mobile parity with desktop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders item photos (with fallback on error) and StockStatusBadge on mobile cards', async () => {
    vi.mocked(inventoryService.getInventoryItems).mockResolvedValue({
      data: [
        {
          id: 'item-low',
          name: 'Power Tools Set',
          category: 'Equipment',
          quantity: 2,
          available_quantity: 2,
          location: 'Storage Room',
          image_path: '/uploads/items/power-tools.jpg',
          thumbnail_path: '/uploads/items/thumbnails/power-tools.webp',
        },
        {
          id: 'item-good',
          name: 'Broom Stick with Handle',
          category: 'Tools',
          quantity: 5,
          available_quantity: 5,
          location: 'Storage Room',
          image_path: null,
          thumbnail_path: null,
        },
        {
          id: 'item-out',
          name: 'Welding Helmet',
          category: 'Safety',
          quantity: 3,
          available_quantity: 0,
          location: 'Workshop',
          image_path: '/uploads/images/defaults/blank-thumbnail.webp',
          thumbnail_path: null,
        },
      ],
    } as any);

    const { container } = render(
      <MemoryRouter>
        <ItemsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Power Tools Set').length).toBeGreaterThan(0);
    });

    const mobileList = container.querySelector('.sm\\:hidden');
    expect(mobileList).toBeTruthy();

    // Mobile renders the real photo for items that have one, and omits blank/null thumbnails
    const mobileImgs = mobileList!.querySelectorAll('img');
    expect(mobileImgs).toHaveLength(1);
    expect(mobileImgs[0].getAttribute('alt')).toBe('Power Tools Set');

    // Mobile displays semantic StockStatusBadge matching desktop (Low Stock, In Stock, Out of Stock)
    expect(mobileList!.textContent).toContain('Low Stock (2/2)');
    expect(mobileList!.textContent).toContain('In Stock (5/5)');
    expect(mobileList!.textContent).toContain('Out of Stock (0/3)');

    // Failing image falls back cleanly to icon without leaving a broken <img>
    fireEvent.error(mobileImgs[0]);
    await waitFor(() => {
      expect(mobileList!.querySelectorAll('img')).toHaveLength(0);
    });
  });
});
