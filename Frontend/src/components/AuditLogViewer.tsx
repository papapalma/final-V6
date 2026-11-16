import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditLogEntry, AuditLogFilters } from '@/types/auditLog';

interface AuditLogViewerProps {
  onError?: (error: Error) => void;
}

interface ExpandedRows {
  [key: string]: boolean;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ onError }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<ExpandedRows>({});
  const [filters, setFilters] = useState<AuditLogFilters>({
    action: undefined,
    adminId: undefined,
  });
  const [admins, setAdmins] = useState<Array<{ id: string; name: string }>>([]);
  const [pagination, setPagination] = useState({
    limit: 5,
    offset: 0,
    total: 0,
  });

  // Fetch audit logs on component mount and when filters/pagination change
  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          limit: pagination.limit.toString(),
          offset: pagination.offset.toString(),
          ...(filters.action && { action: filters.action }),
          ...(filters.adminId && { admin_id: filters.adminId }),
        });

        const response = await fetch(
          `/api/cms-settings/audit-log?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch audit logs: ${response.statusText}`);
        }

        const data = await response.json();
        setLogs(data.entries || []);
        setPagination((prev) => ({
          ...prev,
          total: data.total || 0,
        }));

        // Extract unique admin IDs and fetch admin names
        if (data.entries && data.entries.length > 0) {
          const uniqueAdminIds: string[] = Array.from(new Set(data.entries.map((log: AuditLogEntry) => log.admin_id)));
          if (uniqueAdminIds.length > 0) {
            await fetchAdminNames(uniqueAdminIds);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch audit logs';
        setError(errorMessage);
        if (onError && err instanceof Error) {
          onError(err);
        }
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, [pagination.limit, pagination.offset, filters, onError]);

  // Fetch admin names to populate the admins dropdown
  const fetchAdminNames = async (adminIds: string[]) => {
    try {
      const response = await fetch('/api/users/admin-names', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ ids: adminIds }),
      });

      if (!response || !response.ok) {
        console.warn('Failed to fetch admin names');
        return;
      }

      const data = await response.json();
      setAdmins(data.admins || []);
    } catch (err) {
      console.warn('Error fetching admin names:', err);
    }
  };

  const getAdminName = useCallback(
    (adminId: string) => {
      const admin = admins.find((a) => a.id === adminId);
      return admin?.name || adminId;
    },
    [admins]
  );

  const toggleRowExpansion = (logId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [logId]: !prev[logId],
    }));
  };

  const handleFilterChange = (filterType: 'action' | 'adminId', value: string) => {
    setFilters((prev) => ({
      ...prev,
      [filterType]: value || undefined,
    }));
    // Reset pagination when filter changes
    setPagination((prev) => ({ ...prev, offset: 0 }));
  };

  const handlePaginationChange = (offset: number) => {
    setPagination((prev) => ({
      ...prev,
      offset,
    }));
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatChanges = (changes: Record<string, unknown>) => {
    return JSON.stringify(changes, null, 2);
  };

  const getUniqueActionTypes = () => {
    const actions = new Set(logs.map((log) => log.action));
    return Array.from(actions).sort();
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Loading audit logs...</p>
      </div>
    );
  }

  if (error && logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-500 mb-2">Error loading audit logs</p>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <div className="w-full space-y-4" data-testid="audit-log-viewer">
      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Filter by Action
          </label>
          <Select
            value={filters.action || ''}
            onValueChange={(value) => handleFilterChange('action', value)}
          >
            <SelectTrigger className="w-full" data-testid="action-filter">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All actions</SelectItem>
              {getUniqueActionTypes().map((action) => (
                <SelectItem key={action} value={action}>
                  {action}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-sm font-medium text-gray-700 block mb-1">
            Filter by Admin
          </label>
          <Select
            value={filters.adminId || ''}
            onValueChange={(value) => handleFilterChange('adminId', value)}
          >
            <SelectTrigger className="w-full" data-testid="admin-filter">
              <SelectValue placeholder="All admins" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All admins</SelectItem>
              {admins.map((admin) => (
                <SelectItem key={admin.id} value={admin.id}>
                  {admin.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {logs.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">No audit logs found</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <React.Fragment key={log.id}>
                    <TableRow
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => toggleRowExpansion(log.id)}
                      data-testid={`log-row-${log.id}`}
                    >
                      <TableCell className="text-center">
                        {expandedRows[log.id] ? (
                          <ChevronUp size={18} />
                        ) : (
                          <ChevronDown size={18} />
                        )}
                      </TableCell>
                      <TableCell>{formatTimestamp(log.timestamp)}</TableCell>
                      <TableCell>{getAdminName(log.admin_id)}</TableCell>
                      <TableCell>
                        <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell>{log.resource_type}</TableCell>
                    </TableRow>

                    {/* Expanded row with detailed changes */}
                    {expandedRows[log.id] && (
                      <TableRow
                        className="bg-gray-50"
                        data-testid={`expanded-row-${log.id}`}
                      >
                        <TableCell colSpan={5}>
                          <div className="p-4 space-y-2">
                            <div>
                              <h4 className="font-semibold text-sm text-gray-700 mb-2">
                                Changes:
                              </h4>
                              <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-64 font-mono text-gray-800">
                                {formatChanges(log.changes)}
                              </pre>
                            </div>
                            {log.error_message && (
                              <div>
                                <h4 className="font-semibold text-sm text-gray-700 mb-2">
                                  Error:
                                </h4>
                                <p className="text-sm text-red-600">{log.error_message}</p>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4" data-testid="pagination">
            <div className="text-sm text-gray-600">
              Showing {pagination.offset + 1} to{' '}
              {Math.min(pagination.offset + pagination.limit, pagination.total)} of{' '}
              {pagination.total} logs
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePaginationChange(Math.max(0, pagination.offset - pagination.limit))}
                disabled={pagination.offset === 0}
                className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                data-testid="prev-page"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePaginationChange(pagination.offset + pagination.limit)}
                disabled={currentPage >= totalPages}
                className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                data-testid="next-page"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogViewer;
