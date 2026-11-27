import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import TrainingStaffWorkspace from '../TrainingStaffWorkspace';
import InventoryStaffWorkspace from '../InventoryStaffWorkspace';
import registrationService from '../../../services/registrationService';
import reportService from '../../../services/reportService';
import lendingService from '../../../services/lendingService';
import api from '../../../services/api';

vi.mock('../../../services/registrationService', () => ({
  default: {
    getRegistrations: vi.fn(),
  },
}));

vi.mock('../../../services/reportService', () => ({
  default: {
    getProgramReport: vi.fn(),
    getInventoryReport: vi.fn(),
    getActivityAnalytics: vi.fn(),
  },
}));

vi.mock('../../../services/lendingService', () => ({
  default: {
    getLendingRecords: vi.fn(),
  },
}));

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="recharts-container">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));

const makeRegistrations = (count: number) =>
  Array.from({ length: count }, (_, idx) => ({
    id: `reg-${idx + 1}`,
    username: `applicant_${idx + 1}`,
    email: `applicant${idx + 1}@bmdc.site`,
    first_name: `Applicant`,
    last_name: `Number${idx + 1}`,
    status: 'pending' as const,
    registration_status: 'pending' as const,
    program_id: 'prog-1',
    created_at: new Date(Date.UTC(2026, 10, 26 - Math.floor(idx / 2))).toISOString(),
    program: { id: 'prog-1', name: 'SMAW NC II', status: 'active' },
  }));

const mockProgramReport = {
  totalPrograms: 2,
  enrollmentRate: 80,
  completionRate: 50,
  byCategory: { active: 2 },
  popularPrograms: [],
  programStats: [
    {
      id: 'prog-1',
      name: 'SMAW NC II',
      status: 'active',
      enrolledCount: 24,
      completedCount: 6,
      completionRate: 25,
      capacity: 30,
      start_date: '2026-10-01',
      end_date: '2026-11-30',
      students: [],
    },
    {
      id: 'prog-2',
      name: 'Dressmaking NC II',
      status: 'upcoming',
      enrolledCount: 10,
      completedCount: 0,
      completionRate: 0,
      capacity: 25,
      start_date: '2026-12-01',
      end_date: '2027-01-15',
      students: [],
    },
  ],
};

const mockReqAnalytics = {
  data: {
    by_requirement: [
      {
        requirement_id: 'req-1',
        requirement_type: 'birth_certificate',
        display_name: 'PSA Birth Certificate',
        is_mandatory: true,
        completion_rate: 42,
        rejection_count: 3,
        rejection_rate: 5,
        total_submissions: 60,
        verified_count: 25,
        pending_count: 20,
        submitted_count: 12,
        waived_count: 0,
      },
      {
        requirement_id: 'req-2',
        requirement_type: 'valid_id',
        display_name: 'Valid Government ID',
        is_mandatory: true,
        completion_rate: 88,
        rejection_count: 0,
        rejection_rate: 0,
        total_submissions: 60,
        verified_count: 53,
        pending_count: 7,
        submitted_count: 0,
        waived_count: 0,
      },
    ],
    summary: {
      avg_completion_rate: 65,
      avg_rejection_rate: 2.5,
      total_requirements: 2,
      total_submissions: 120,
      total_verified: 78,
      total_rejected: 3,
      total_pending: 27,
      total_submitted: 12,
      total_waived: 0,
    },
  },
};

describe('TrainingStaffWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(registrationService.getRegistrations).mockResolvedValue(makeRegistrations(10) as any);
    vi.mocked(reportService.getProgramReport).mockResolvedValue(mockProgramReport as any);
    vi.mocked(api.get).mockResolvedValue(mockReqAnalytics as any);
  });

  it('paginates pending registrations at 8/page and renders program capacity and requirement deep-links', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <TrainingStaffWorkspace />
      </MemoryRouter>
    );

    const regCard = screen.getByTestId('training-pending-registrations-card');
    await waitFor(() => {
      expect(within(regCard).getAllByText('Applicant Number1').length).toBeGreaterThan(0);
    });

    // Page 1 shows applicants 1..8, not 9
    expect(within(regCard).queryByText('Applicant Number9')).not.toBeInTheDocument();

    // Advance to page 2
    await user.click(within(regCard).getByText('2'));
    expect(within(regCard).getAllByText('Applicant Number9').length).toBeGreaterThan(0);

    // Program capacity & requirements compliance links
    const progCard = screen.getByTestId('training-programs-capacity-card');
    await waitFor(() => {
      expect(within(progCard).getByText('SMAW NC II').closest('a')).toHaveAttribute('href', '/programs/prog-1');
    });

    const reqCard = screen.getByTestId('training-requirements-compliance-card');
    await waitFor(() => {
      expect(within(reqCard).getByText('PSA Birth Certificate').closest('a')).toHaveAttribute(
        'href',
        '/admin/requirements/req-1'
      );
    });
  });

  it('isolates an individual card API failure with an inline Retry that recovers without blanking sibling cards', async () => {
    const user = userEvent.setup();
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('Analytics unavailable'))
      .mockResolvedValueOnce(mockReqAnalytics as any);

    render(
      <MemoryRouter>
        <TrainingStaffWorkspace />
      </MemoryRouter>
    );

    // Sibling cards still load cleanly
    await waitFor(() => {
      expect(screen.getAllByText('Applicant Number1').length).toBeGreaterThan(0);
      expect(
        within(screen.getByTestId('training-programs-capacity-card')).getByText('SMAW NC II')
      ).toBeInTheDocument();
    });

    // Requirements card shows isolated error + Retry
    const reqCard = screen.getByTestId('training-requirements-compliance-card');
    expect(within(reqCard).getByRole('alert')).toHaveTextContent(/Unable to load requirements compliance/i);

    await user.click(within(reqCard).getByRole('button', { name: /Retry/i }));

    await waitFor(() => {
      expect(within(reqCard).getByText('PSA Birth Certificate')).toBeInTheDocument();
    });
  });

  it('shows calm positive empty state when there are zero pending registrations', async () => {
    vi.mocked(registrationService.getRegistrations).mockResolvedValue([]);

    render(
      <MemoryRouter>
        <TrainingStaffWorkspace />
      </MemoryRouter>
    );

    const regCard = screen.getByTestId('training-pending-registrations-card');
    await waitFor(() => {
      expect(within(regCard).getByText(/All caught up/i)).toBeInTheDocument();
    });
  });
});

describe('InventoryStaffWorkspace', () => {
  const pastDueIso = '2026-10-01T00:00:00.000Z';
  const futureDueIso = '2026-12-15T00:00:00.000Z';

  const mockLendings = [
    ...Array.from({ length: 5 }, (_, idx) => ({
      id: `overdue-${idx + 1}`,
      item_id: `item-o-${idx + 1}`,
      quantity: 2,
      lent_date: '2026-09-28T00:00:00.000Z',
      expected_return_date: pastDueIso,
      status: idx % 2 === 0 ? ('overdue' as const) : ('active' as const), // covers both overdue & past-due active
      item: { id: `item-o-${idx + 1}`, name: `Welding Helmet ${idx + 1}` },
      trainee: { id: `t-o-${idx + 1}`, first_name: 'Juan', last_name: `Overdue${idx + 1}` },
    })),
    ...Array.from({ length: 5 }, (_, idx) => ({
      id: `active-${idx + 1}`,
      item_id: `item-a-${idx + 1}`,
      quantity: 1,
      lent_date: '2026-11-20T00:00:00.000Z',
      expected_return_date: futureDueIso,
      status: 'active' as const,
      item: { id: `item-a-${idx + 1}`, name: `Digital Multimeter ${idx + 1}` },
      trainee: { id: `t-a-${idx + 1}`, first_name: 'Maria', last_name: `Active${idx + 1}` },
    })),
    {
      id: 'returned-1',
      item_id: 'item-r-1',
      quantity: 1,
      lent_date: '2026-10-01T00:00:00.000Z',
      expected_return_date: pastDueIso,
      status: 'returned' as const,
      item: { id: 'item-r-1', name: 'Returned Wrench' },
      borrower_name: 'Done User',
    },
  ];

  const mockInventoryReport = {
    totalItems: 40,
    byCategory: { Welding: 15, Electrical: 12, Carpentry: 8 },
    lowStockItems: [
      {
        id: 'low-1',
        name: 'Flux Wire Spool',
        category: 'Welding',
        quantity: 10,
        available_quantity: 0,
        minimum_quantity: 5,
        status: 'out_of_stock',
      },
      {
        id: 'low-2',
        name: 'Insulated Gloves',
        category: 'Electrical',
        quantity: 20,
        available_quantity: 3,
        minimum_quantity: 5,
        status: 'low_stock',
      },
    ],
  };

  const mockActivityReport = {
    totalActions: 20,
    byAction: {},
    byModule: {},
    trend: [
      { date: '2026-11-20', borrowed: 5, returned: 3, total: 8 },
      { date: '2026-11-21', borrowed: 4, returned: 6, total: 10 },
    ],
    topUsers: [],
    recent: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(lendingService.getLendingRecords).mockResolvedValue({
      success: true,
      data: mockLendings as any,
    });
    vi.mocked(reportService.getInventoryReport).mockResolvedValue(mockInventoryReport as any);
    vi.mocked(reportService.getActivityAnalytics).mockResolvedValue(mockActivityReport as any);
  });

  it('classifies overdue & active borrowings, filters via segmented tabs, paginates at 8/page, and renders low-stock links', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <InventoryStaffWorkspace />
      </MemoryRouter>
    );

    const queueCard = screen.getByTestId('inventory-borrowings-queue-card');
    await waitFor(() => {
      expect(within(queueCard).getAllByText('Welding Helmet 1').length).toBeGreaterThan(0);
    });

    // Returned items are excluded
    expect(within(queueCard).queryByText('Returned Wrench')).not.toBeInTheDocument();

    // All Open has 10 items (5 overdue + 5 active) -> 8 on page 1, so item #5 of active is on page 2
    expect(within(queueCard).queryByText('Digital Multimeter 5')).not.toBeInTheDocument();
    await user.click(within(within(queueCard).getByRole('navigation')).getByText('2'));
    expect(within(queueCard).getAllByText('Digital Multimeter 5').length).toBeGreaterThan(0);

    // Switch to Overdue tab -> shows all 5 overdue (including past-due active), hides future-due active
    await user.click(within(queueCard).getByRole('tab', { name: /Overdue/i }));
    expect(within(queueCard).getAllByText('Welding Helmet 2').length).toBeGreaterThan(0);
    expect(within(queueCard).queryByText('Digital Multimeter 1')).not.toBeInTheDocument();

    // Switch to Active tab -> shows future-due active only
    await user.click(within(queueCard).getByRole('tab', { name: /Active/i }));
    expect(within(queueCard).getAllByText('Digital Multimeter 1').length).toBeGreaterThan(0);
    expect(within(queueCard).queryByText('Welding Helmet 1')).not.toBeInTheDocument();

    // Low-stock card deep-links out_of_stock to ?stock=out and low_stock to ?stock=low
    const lowStockCard = screen.getByTestId('inventory-low-stock-card');
    await waitFor(() => {
      expect(within(lowStockCard).getByText('Flux Wire Spool').closest('a')).toHaveAttribute(
        'href',
        '/items?stock=out'
      );
      expect(within(lowStockCard).getByText('Insulated Gloves').closest('a')).toHaveAttribute(
        'href',
        '/items?stock=low'
      );
    });

    // Category & Trend card renders top categories and trend chart
    const trendCard = screen.getByTestId('inventory-trend-card');
    expect(within(trendCard).getByText('Welding')).toBeInTheDocument();
    expect(within(trendCard).getByTestId('area-chart')).toBeInTheDocument();
  });

  it('shows positive overdue empty state and recovers from isolated lending error via Retry', async () => {
    const user = userEvent.setup();
    vi.mocked(lendingService.getLendingRecords)
      .mockRejectedValueOnce(new Error('Lending API error'))
      .mockResolvedValueOnce({
        success: true,
        data: [
          {
            id: 'active-only',
            item_id: 'item-1',
            quantity: 1,
            lent_date: '2026-11-20T00:00:00.000Z',
            expected_return_date: futureDueIso,
            status: 'active',
            item: { id: 'item-1', name: 'Clamp Meter' },
            borrower_name: 'On-Time User',
          },
        ] as any,
      });

    render(
      <MemoryRouter>
        <InventoryStaffWorkspace />
      </MemoryRouter>
    );

    const queueCard = screen.getByTestId('inventory-borrowings-queue-card');
    await waitFor(() => {
      expect(within(queueCard).getByRole('alert')).toHaveTextContent(/Unable to load active and overdue/i);
    });

    // Low-stock sibling card still loaded cleanly
    expect(screen.getByText('Flux Wire Spool')).toBeInTheDocument();

    // Retry recovers borrowings queue
    await user.click(within(queueCard).getByRole('button', { name: /Retry/i }));
    await waitFor(() => {
      expect(within(queueCard).getAllByText('Clamp Meter').length).toBeGreaterThan(0);
    });

    // Switch to Overdue tab -> calm positive empty state
    await user.click(within(queueCard).getByRole('tab', { name: /Overdue/i }));
    expect(within(queueCard).getByText(/All caught up — 0 overdue/i)).toBeInTheDocument();
  });
});
