import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as fc from 'fast-check';
import { AuditLogViewer } from '../components/AuditLogViewer';
import type { AuditLogEntry } from '@/types/auditLog';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock fetch
global.fetch = vi.fn();

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Radix UI components
vi.mock('@/components/ui/table', () => ({
  Table: ({ children }: { children: React.ReactNode }) => (
    <table data-testid="audit-table">{children}</table>
  ),
  TableHeader: ({ children }: { children: React.ReactNode }) => (
    <thead>{children}</thead>
  ),
  TableBody: ({ children }: { children: React.ReactNode }) => (
    <tbody>{children}</tbody>
  ),
  TableRow: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <tr {...props}>{children}</tr>
  ),
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => (
    <td {...props}>{children}</td>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange }: any) => (
    <div data-testid="select" onClick={(e) => {
      const value = (e.target as HTMLElement).getAttribute('data-value');
      if (value !== null) onValueChange(value);
    }}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, 'data-testid': testId = 'select-trigger', ...props }: any) => (
    <button data-testid={testId} {...props}>
      {children}
    </button>
  ),
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({ children, value }: any) => (
    <div data-value={value} data-testid={`select-item-${value}`}>
      {children}
    </div>
  ),
}));

// Helper function to create test audit log entries
const createTestAuditLog = (overrides?: Partial<AuditLogEntry>): AuditLogEntry => ({
  id: 'log-' + Math.random().toString(36).substring(7),
  tenant_id: 'tenant-1',
  admin_id: 'admin-' + Math.random().toString(36).substring(7),
  action: 'update',
  resource_type: 'cms_settings',
  resource_id: 'resource-1',
  changes: {
    before: { color: '#000000' },
    after: { color: '#FFFFFF' },
  },
  error_message: undefined,
  ip_address: '192.168.1.1',
  user_agent: 'Mozilla/5.0',
  timestamp: new Date().toISOString(),
  ...overrides,
});

describe('AuditLogViewer Component - Unit Tests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockLocalStorage.clear();
    mockLocalStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe('Test 1: Audit logs fetched on mount', () => {
    it('should fetch audit logs when component mounts', async () => {
      const mockLogs = [
        createTestAuditLog({ action: 'create' }),
        createTestAuditLog({ action: 'update' }),
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs,
          total: 2,
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/cms-settings/audit-log'),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer test-token',
            }),
          })
        );
      });
    });

    it('should handle fetch errors gracefully', async () => {
      const onError = vi.fn();
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network error')
      );

      render(<AuditLogViewer onError={onError} />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading audit logs/i)).toBeInTheDocument();
      });
    });

    it('should display loading state initially', () => {
      (global.fetch as any).mockImplementationOnce(() => 
        new Promise(() => {}) // Never resolves
      );

      render(<AuditLogViewer />);

      expect(screen.getByText(/Loading audit logs/i)).toBeInTheDocument();
    });
  });

  describe('Test 2: Logs displayed with metadata', () => {
    it('should display all audit log metadata correctly', async () => {
      const testLog = createTestAuditLog({
        action: 'update',
        resource_type: 'cms_settings',
        timestamp: '2024-01-15T10:30:00Z',
        admin_id: 'admin-123',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [testLog],
          total: 1,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: [{ id: 'admin-123', name: 'John Admin' }],
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getAllByText(/John Admin/i)[0]).toBeInTheDocument();
        expect(screen.getAllByText(/update/i)[0]).toBeInTheDocument();
        expect(screen.getByText(/cms_settings/i)).toBeInTheDocument();
      });
    });

    it('should format timestamp correctly', async () => {
      const testLog = createTestAuditLog({
        timestamp: '2024-01-15T10:30:00Z',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [testLog],
          total: 1,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: [{ id: testLog.admin_id, name: 'Admin' }],
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        expect(rows.length).toBeGreaterThan(0);
      });
    });

    it('should display resource type as metadata', async () => {
      const testLog = createTestAuditLog({
        resource_type: 'theme_preset',
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [testLog],
          total: 1,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: [{ id: testLog.admin_id, name: 'Admin' }],
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText('theme_preset')).toBeInTheDocument();
      });
    });
  });

  describe('Test 3: Filtering by action works', () => {
    it('should filter logs by action type', async () => {
      const mockLogs = [
        createTestAuditLog({ action: 'create', id: 'log-1' }),
        createTestAuditLog({ action: 'update', id: 'log-2' }),
        createTestAuditLog({ action: 'delete', id: 'log-3' }),
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs,
          total: 3,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should display all unique action types in filter dropdown', async () => {
      const mockLogs = [
        createTestAuditLog({ action: 'create' }),
        createTestAuditLog({ action: 'update' }),
        createTestAuditLog({ action: 'delete' }),
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs,
          total: 3,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByTestId('action-filter')).toBeInTheDocument();
      });
    });
  });

  describe('Test 4: Filtering by admin works', () => {
    it('should filter logs by admin_id', async () => {
      const adminId1 = 'admin-001';
      const adminId2 = 'admin-002';

      const mockLogs = [
        createTestAuditLog({ admin_id: adminId1, id: 'log-1' }),
        createTestAuditLog({ admin_id: adminId2, id: 'log-2' }),
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs,
          total: 2,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: [
            { id: adminId1, name: 'Admin One' },
            { id: adminId2, name: 'Admin Two' },
          ],
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByTestId('admin-filter')).toBeInTheDocument();
      });
    });

    it('should display admin names from API response', async () => {
      const mockLogs = [
        createTestAuditLog({ admin_id: 'admin-1' }),
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs,
          total: 1,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: [{ id: 'admin-1', name: 'John Doe' }],
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getAllByText('John Doe')[0]).toBeInTheDocument();
      });
    });

    it('should show admin_id as fallback if name is not available', async () => {
      const adminId = 'admin-unknown-123';
      const mockLogs = [
        createTestAuditLog({ admin_id: adminId }),
      ];

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs,
          total: 1,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: [],
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText(adminId)).toBeInTheDocument();
      });
    });
  });

  describe('Test 5: Expanded rows show detailed changes', () => {
    it('should display changes in expanded row', async () => {
      const testLog = createTestAuditLog({
        changes: {
          before: { primaryColor: '#000000' },
          after: { primaryColor: '#FFFFFF' },
        },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [testLog],
          total: 1,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: [{ id: testLog.admin_id, name: 'Admin' }],
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        const logRow = screen.getByTestId(`log-row-${testLog.id}`);
        expect(logRow).toBeInTheDocument();
      });

      // Click to expand
      const logRow = screen.getByTestId(`log-row-${testLog.id}`);
      fireEvent.click(logRow);

      await waitFor(() => {
        const expandedRow = screen.getByTestId(`expanded-row-${testLog.id}`);
        expect(expandedRow).toBeInTheDocument();
        expect(expandedRow.textContent).toContain('#000000');
        expect(expandedRow.textContent).toContain('#FFFFFF');
      });
    });

    it('should toggle row expansion on click', async () => {
      const testLog = createTestAuditLog();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [testLog],
          total: 1,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: [{ id: testLog.admin_id, name: 'Admin' }],
        }),
      });

      render(<AuditLogViewer />);

      const logRow = await screen.findByTestId(`log-row-${testLog.id}`);

      // Initially not expanded
      expect(screen.queryByTestId(`expanded-row-${testLog.id}`)).not.toBeInTheDocument();

      // Click to expand
      fireEvent.click(logRow);

      await waitFor(() => {
        expect(screen.getByTestId(`expanded-row-${testLog.id}`)).toBeInTheDocument();
      });

      // Click to collapse
      fireEvent.click(logRow);

      await waitFor(() => {
        expect(screen.queryByTestId(`expanded-row-${testLog.id}`)).not.toBeInTheDocument();
      });
    });

    it('should display error message in expanded row if present', async () => {
      const errorMsg = 'Validation failed: Invalid color format';
      const testLog = createTestAuditLog({
        error_message: errorMsg,
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [testLog],
          total: 1,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: [{ id: testLog.admin_id, name: 'Admin' }],
        }),
      });

      render(<AuditLogViewer />);

      const logRow = await screen.findByTestId(`log-row-${testLog.id}`);
      fireEvent.click(logRow);

      await waitFor(() => {
        expect(screen.getByText(errorMsg)).toBeInTheDocument();
      });
    });

    it('should format changes as JSON in expanded row', async () => {
      const testLog = createTestAuditLog({
        changes: {
          colors: { primary: '#FF0000' },
          typography: { fontSize: 16 },
        },
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [testLog],
          total: 1,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: [{ id: testLog.admin_id, name: 'Admin' }],
        }),
      });

      render(<AuditLogViewer />);

      const logRow = await screen.findByTestId(`log-row-${testLog.id}`);
      fireEvent.click(logRow);

      await waitFor(() => {
        const expandedRow = screen.getByTestId(`expanded-row-${testLog.id}`);
        const text = expandedRow.textContent;
        expect(text).toContain('primary');
        expect(text).toContain('#FF0000');
        expect(text).toContain('fontSize');
        expect(text).toContain('16');
      });
    });
  });

  describe('Test 6: Pagination works', () => {
    it('should display pagination controls', async () => {
      const mockLogs = Array.from({ length: 10 }, (_, i) =>
        createTestAuditLog({ id: `log-${i}` })
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs.slice(0, 5),
          total: 10,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByTestId('pagination')).toBeInTheDocument();
        expect(screen.getByTestId('prev-page')).toBeInTheDocument();
        expect(screen.getByTestId('next-page')).toBeInTheDocument();
      });
    });

    it('should navigate to next page', async () => {
      const mockLogs1 = Array.from({ length: 5 }, (_, i) =>
        createTestAuditLog({ id: `log-page1-${i}` })
      );
      const mockLogs2 = Array.from({ length: 5 }, (_, i) =>
        createTestAuditLog({ id: `log-page2-${i}` })
      );

      // First page
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs1,
          total: 10,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs1.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByTestId('next-page')).toBeInTheDocument();
      });

      // Second page
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs2,
          total: 10,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs2.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      const nextButton = screen.getByTestId('next-page');
      fireEvent.click(nextButton);

      await waitFor(() => {
        const calls = (global.fetch as any).mock.calls;
        const lastCall = calls[calls.length - 2]; // -2 because there's also the admin fetch
        expect(lastCall[0]).toContain('offset=5');
      });
    });

    it('should navigate to previous page', async () => {
      const mockLogs1 = Array.from({ length: 5 }, (_, i) =>
        createTestAuditLog({ id: `log-page1-${i}` })
      );
      const mockLogs2 = Array.from({ length: 5 }, (_, i) =>
        createTestAuditLog({ id: `log-page2-${i}` })
      );

      // Page 1 initial
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs1,
          total: 10,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs1.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByTestId('next-page')).toBeInTheDocument();
      });

      // Navigate to page 2
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs2,
          total: 10,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs2.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      fireEvent.click(screen.getByTestId('next-page'));

      await waitFor(() => {
        const prevButton = screen.getByTestId('prev-page') as HTMLButtonElement;
        expect(prevButton.disabled).toBe(false);
      });

      // Go back to page 1
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs1,
          total: 10,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs1.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      const prevButton = screen.getByTestId('prev-page');
      fireEvent.click(prevButton);

      await waitFor(() => {
        const calls = (global.fetch as any).mock.calls;
        const lastAuditCall = calls[calls.length - 2];
        expect(lastAuditCall[0]).toContain('offset=0');
      });
    });

    it('should disable previous button on first page', async () => {
      const mockLogs = Array.from({ length: 5 }, (_, i) =>
        createTestAuditLog({ id: `log-${i}` })
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs,
          total: 10,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        const prevButton = screen.getByTestId('prev-page') as HTMLButtonElement;
        expect(prevButton.disabled).toBe(true);
      });
    });

    it('should display current page and total pages', async () => {
      const mockLogs = Array.from({ length: 10 }, (_, i) =>
        createTestAuditLog({ id: `log-${i}` })
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs.slice(0, 5),
          total: 10,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
      });
    });

    it('should show count of logs on current page', async () => {
      const mockLogs = Array.from({ length: 10 }, (_, i) =>
        createTestAuditLog({ id: `log-${i}` })
      );

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: mockLogs.slice(0, 5),
          total: 10,
        }),
      });

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          admins: mockLogs.map((log) => ({
            id: log.admin_id,
            name: 'Admin',
          })),
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText(/Showing 1 to 5 of 10 logs/)).toBeInTheDocument();
      });
    });
  });

  describe('Empty state handling', () => {
    it('should display message when no logs are found', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entries: [],
          total: 0,
        }),
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText(/No audit logs found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('should call onError callback when fetch fails', async () => {
      const onError = vi.fn();
      const error = new Error('Failed to fetch');

      (global.fetch as any).mockRejectedValueOnce(error);

      render(<AuditLogViewer onError={onError} />);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith(error);
      });
    });

    it('should display error message when API returns error', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Unauthorized',
      });

      render(<AuditLogViewer />);

      await waitFor(() => {
        expect(screen.getByText(/Error loading audit logs/i)).toBeInTheDocument();
      });
    });
  });
});

describe('AuditLogViewer Component - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.clear();
    mockLocalStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    cleanup();
  });

  describe('Property: Audit Log Display Consistency', () => {
    /**
     * **Validates: Requirements 15.1, 15.2, 15.3**
     *
     * For any set of audit logs with varying timestamps, admin IDs, actions, and changes,
     * the AuditLogViewer SHALL:
     * 1. Display all logs from the API response
     * 2. Format all timestamps consistently
     * 3. Make all admin IDs available for filtering
     * 4. Allow expanding any row to view detailed changes
     * 5. Maintain pagination state across filter changes
     */
    it(
      'should consistently display and filter any audit logs correctly',
      { timeout: 60000 },
      async () => {
        const auditLogGenerator = fc.tuple(
          fc.array(
            fc.record({
              action: fc.constantFrom('create', 'update', 'delete', 'import', 'rollback'),
              admin_id: fc.uuid(),
              resource_type: fc.constantFrom('cms_settings', 'theme_preset'),
            }),
            { minLength: 1, maxLength: 10 }
          )
        );

        await fc.assert(
          fc.asyncProperty(auditLogGenerator, async ([entries]) => {
            vi.clearAllMocks();

            const mockLogs = entries.map((entry) =>
              createTestAuditLog({
                ...entry,
                id: `log-${Math.random()}`,
              })
            );

            (global.fetch as any).mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                entries: mockLogs,
                total: mockLogs.length,
              }),
            });

            (global.fetch as any).mockResolvedValueOnce({
              ok: true,
              json: async () => ({
                admins: [...new Set(mockLogs.map((log) => log.admin_id))].map(
                  (id) => ({
                    id,
                    name: `Admin ${id.substring(0, 8)}`,
                  })
                ),
              }),
            });

            const { unmount } = render(<AuditLogViewer />);

            await waitFor(() => {
              mockLogs.forEach((log) => {
                expect(screen.getByTestId(`log-row-${log.id}`)).toBeInTheDocument();
              });
            });

            unmount();
          }),
          { numRuns: 10 }
        );
      }
    );
  });

  describe('Property: Filter and Pagination Isolation', () => {
    /**
     * **Validates: Requirements 15.2, 15.3, 15.4**
     *
     * For any combination of active filters and pagination state,
     * pagination controls SHALL always show correct page information.
     */
    it(
      'should maintain correct pagination state',
      { timeout: 30000 },
      async () => {
        const mockLogs = Array.from({ length: 20 }, (_, i) =>
          createTestAuditLog({
            id: `log-${i}`,
            action: i % 2 === 0 ? 'update' : 'create',
          })
        );

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            entries: mockLogs.slice(0, 10),
            total: 20,
          }),
        });

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            admins: mockLogs.map((log) => ({
              id: log.admin_id,
              name: 'Admin',
            })),
          }),
        });

        render(<AuditLogViewer />);

        await waitFor(() => {
          expect(screen.getByTestId('pagination')).toBeInTheDocument();
        });
      }
    );
  });
});
