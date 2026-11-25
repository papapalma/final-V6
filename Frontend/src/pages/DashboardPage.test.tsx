import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';
import reportService from '../services/reportService';
import activityLogService from '../services/activityLogService';
import { getRolePermissions, type UserRole } from '../utils/roles';

const authMockState: { role: UserRole } = {
  role: 'local_admin',
};

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(() => {
    const perms = getRolePermissions(authMockState.role);
    return {
      user: { id: 'u1', name: 'Admin User', role: authMockState.role, tenantName: 'BMDC' },
      hasPermission: (perm: keyof typeof perms) => perms[perm],
      isAuthenticated: true,
      isAuthReady: true,
    };
  }),
}));

vi.mock('../services/reportService', () => ({
  default: {
    getDashboardStats: vi.fn(),
    getActivityAnalytics: vi.fn(),
  },
}));

vi.mock('../services/activityLogService', () => ({
  default: {
    getActivityLogs: vi.fn(),
  },
}));

vi.mock('../utils/activityLogger', () => ({
  dashboardLogger: {
    viewed: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('../components/DashboardLayout', () => ({
  default: ({ children, title }: any) => (
    <div data-testid="dashboard-layout" data-title={title}>
      {children}
    </div>
  ),
}));

const mockStatsPayload = {
  trainees: { active: 1250, total: 2000, completed: 500, inactive: 250 },
  programs: { total: 6, ongoing: 3, upcoming: 1, completed: 2 },
  inventory: { available: 45, total: 50, borrowed: 5, lowStock: 2 },
  lending: { active: 5, overdue: 1 },
};

describe('DashboardPage — Hero KPI Numbers, Zero-CLS Skeletons & Role Quick Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMockState.role = 'local_admin';
    vi.mocked(reportService.getDashboardStats).mockResolvedValue(mockStatsPayload as any);
    vi.mocked(reportService.getActivityAnalytics).mockResolvedValue({} as any);
    vi.mocked(activityLogService.getActivityLogs).mockResolvedValue([] as any);
  });

  it('renders role-matched KPI skeleton placeholders while stats are loading, then swaps in hero numbers immediately', async () => {
    let resolveStats!: (val: any) => void;
    vi.mocked(reportService.getDashboardStats).mockImplementationOnce(
      () => new Promise((resolve) => { resolveStats = resolve; })
    );

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // 5 KPI skeleton slots prevent layout shift for local_admin while loading
    expect(screen.getAllByTestId('kpi-skeleton-card')).toHaveLength(5);

    resolveStats(mockStatsPayload);

    await waitFor(() => {
      expect(screen.queryAllByTestId('kpi-skeleton-card')).toHaveLength(0);
      expect(screen.getByTestId('kpi-value-Active Trainees')).toHaveTextContent('1,250');
    });

    const heroNumber = screen.getByTestId('kpi-value-Active Trainees');
    expect(heroNumber.className).toContain('app-display');
    expect(heroNumber.className).toContain('text-4xl');
    expect(heroNumber.className).toContain('tabular-nums');
  });

  it('renders clickable pre-filtered KPI links and all 6 Quick Actions for local_admin', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Active Trainees')).toBeInTheDocument();
    });

    expect(screen.getByText('Active Trainees').closest('a')).toHaveAttribute('href', '/trainees?status=active');
    expect(screen.getByText('Total Trainees').closest('a')).toHaveAttribute('href', '/trainees');
    expect(screen.getByText('Total Programs').closest('a')).toHaveAttribute('href', '/programs');
    expect(screen.getByText('Available Items').closest('a')).toHaveAttribute('href', '/items?stock=good');
    expect(screen.getByText('Active Borrowings').closest('a')).toHaveAttribute('href', '/lendings');

    expect(screen.getByText('Add Trainee').closest('a')).toHaveAttribute('href', '/trainees/new');
    expect(screen.getByText('Add Item').closest('a')).toHaveAttribute('href', '/items/new');
    expect(screen.getByText('Add Program').closest('a')).toHaveAttribute('href', '/programs/new');
    expect(screen.getByText('Borrowing').closest('a')).toHaveAttribute('href', '/lendings');
    expect(screen.getByText('Registrations').closest('a')).toHaveAttribute('href', '/registrations');
    expect(screen.getByText('Scan QR').closest('a')).toHaveAttribute('href', '/scan');
  });

  it('renders inventory-only KPI links and 3 Quick Actions for staff_inventory_manager', async () => {
    authMockState.role = 'staff_inventory_manager';

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Total Inventory Items')).toBeInTheDocument();
    });

    expect(screen.getByText('Available Items').closest('a')).toHaveAttribute('href', '/items?stock=good');
    expect(screen.getByText('Active Borrowings').closest('a')).toHaveAttribute('href', '/lendings');
    expect(screen.getByText('Total Inventory Items').closest('a')).toHaveAttribute('href', '/items');

    expect(screen.queryByText('Add Trainee')).not.toBeInTheDocument();
    expect(screen.getByText('Add Item').closest('a')).toHaveAttribute('href', '/items/new');
    expect(screen.getByText('Borrowing').closest('a')).toHaveAttribute('href', '/lendings');
    expect(screen.getByText('Scan QR').closest('a')).toHaveAttribute('href', '/scan');
  });

  it('renders training-only pre-filtered KPI links and 4 Quick Actions for staff_training_coordinator', async () => {
    authMockState.role = 'staff_training_coordinator';

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Completed Trainees')).toBeInTheDocument();
    });

    expect(screen.getByText('Completed Trainees').closest('a')).toHaveAttribute('href', '/trainees?status=completed');
    expect(screen.getByText('Active Programs').closest('a')).toHaveAttribute('href', '/programs?status=active');
    expect(screen.getByText('Completed Programs').closest('a')).toHaveAttribute('href', '/programs?status=inactive');

    expect(screen.getByText('Add Trainee').closest('a')).toHaveAttribute('href', '/trainees/new');
    expect(screen.getByText('Add Program').closest('a')).toHaveAttribute('href', '/programs/new');
    expect(screen.getByText('Registrations').closest('a')).toHaveAttribute('href', '/registrations');
    expect(screen.getByText('Scan QR').closest('a')).toHaveAttribute('href', '/scan');
    expect(screen.queryByText('Add Item')).not.toBeInTheDocument();
  });
});
