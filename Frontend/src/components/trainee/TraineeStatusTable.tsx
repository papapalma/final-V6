import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../ui/pagination';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import {
  ChevronUp,
  ChevronDown,
  Eye,
  AlertCircle,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import {
  TraineeStatusRecord,
  TraineeStatusFilters,
  TraineeStatusSort,
  PaginationInfo,
  EMPLOYMENT_STATUS_LABELS,
  EMPLOYMENT_STATUS_COLORS,
  GRADUATION_STATUS_LABELS,
  GRADUATION_STATUS_COLORS,
  SKILLS_MATCH_LABELS,
  SKILLS_MATCH_COLORS,
} from '../../types/traineeStatus';
import { formatDateDisplay } from '../../utils/dateFormat';
import {
  StatusBadge,
  GraduationStatusBadge,
  EmploymentStatusBadge,
  SkillsMatchBadge,
} from '../StatusBadge';

interface TraineeStatusTableProps {
  records: TraineeStatusRecord[];
  isLoading?: boolean;
  error?: string;
  filters?: TraineeStatusFilters;
  onFiltersChange?: (filters: TraineeStatusFilters) => void;
  sort?: TraineeStatusSort;
  onSortChange?: (sort: TraineeStatusSort) => void;
  pagination?: PaginationInfo;
  onPageChange?: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  onViewRecord?: (recordId: string) => void;
}

// Utility function to get trainee name from record
const getTraineeName = (record: TraineeStatusRecord): string => {
  // Assuming the record has trainee name or we need to fetch it separately
  // For now, we'll use a placeholder
  return record.traineeId || 'Unknown Trainee';
};

export default function TraineeStatusTable({
  records,
  isLoading,
  error,
  filters = {},
  onFiltersChange,
  sort = { column: 'recorded_at', direction: 'desc' },
  onSortChange,
  pagination = { page: 1, limit: 20, total: 0, hasMore: false },
  onPageChange,
  onLimitChange,
  onViewRecord,
}: TraineeStatusTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [localFilters, setLocalFilters] = useState<TraineeStatusFilters>(filters);
  const [localSort, setLocalSort] = useState<TraineeStatusSort>(sort);
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);

  // Handle sorting with memoized callback
  const handleSort = useCallback((column: TraineeStatusSort['column']) => {
    let newDirection: 'asc' | 'desc' = 'asc';
    
    // If clicking the same column, toggle direction or reset
    if (localSort.column === column) {
      if (localSort.direction === 'asc') {
        newDirection = 'desc';
      } else {
        // Reset to no sort - cycle through asc -> desc -> no sort
        const newSort = { column: 'recorded_at' as const, direction: 'desc' as const };
        setLocalSort(newSort);
        onSortChange?.(newSort);
        return;
      }
    }

    const newSort = { column, direction: newDirection };
    setLocalSort(newSort);
    onSortChange?.(newSort);
  }, [localSort, onSortChange]);

  // Render sort indicator with memoization
  const renderSortIndicator = useCallback((column: TraineeStatusSort['column']) => {
    if (localSort.column !== column) return null;
    
    return localSort.direction === 'asc' ? (
      <ChevronUp className="w-4 h-4 inline ml-1" />
    ) : (
      <ChevronDown className="w-4 h-4 inline ml-1" />
    );
  }, [localSort.column, localSort.direction]);

  // Handle filter changes with memoized callback
  const handleFilterChange = useCallback((filterType: keyof TraineeStatusFilters, values: string[]) => {
    const newFilters = {
      ...localFilters,
      [filterType]: values.length > 0 ? values : undefined,
    };
    setLocalFilters(newFilters);
    onFiltersChange?.(newFilters);
  }, [localFilters, onFiltersChange]);

  // Keyboard navigation handler for table rows (TASK 10.2)
  const handleRowKeyDown = useCallback((event: React.KeyboardEvent<HTMLTableRowElement>, recordId: string, rowIndex: number) => {
    switch (event.key) {
      case 'Enter':
      case ' ':
        // Enter or Space key opens the modal (TASK 10.2)
        event.preventDefault();
        onViewRecord?.(recordId);
        break;
      case 'ArrowDown':
        // Arrow down moves focus to next row (TASK 10.2)
        event.preventDefault();
        if (rowIndex < records.length - 1) {
          setFocusedRowIndex(rowIndex + 1);
        }
        break;
      case 'ArrowUp':
        // Arrow up moves focus to previous row (TASK 10.2)
        event.preventDefault();
        if (rowIndex > 0) {
          setFocusedRowIndex(rowIndex - 1);
        }
        break;
      default:
        break;
    }
  }, [records.length, onViewRecord]);

  // Toggle filter value with memoized callback
  const toggleFilter = useCallback((filterType: keyof TraineeStatusFilters, value: string) => {
    const rawValue = localFilters[filterType];
    const currentValues = Array.isArray(rawValue) ? rawValue : [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    handleFilterChange(filterType, newValues);
  }, [localFilters, handleFilterChange]);

  // Clear all filters with memoized callback
  const handleClearFilters = useCallback(() => {
    setLocalFilters({});
    setSearchTerm('');
    onFiltersChange?.({});
  }, [onFiltersChange]);

  // Memoize pagination calculations to avoid recalculating on every render
  const paginationData = useMemo(() => {
    const totalPages = pagination.total ? Math.ceil(pagination.total / pagination.limit) : 1;
    const startIndex = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const endIndex = Math.min(pagination.page * pagination.limit, pagination.total);
    return { totalPages, startIndex, endIndex };
  }, [pagination.total, pagination.limit, pagination.page]);

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded w-48 mb-2"></div>
            <div className="h-4 bg-muted rounded w-64"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="animate-pulse flex gap-4 p-4 border border-border rounded-lg">
                <div className="h-12 bg-muted rounded flex-1"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-red-200 dark:border-red-900" role="alert" aria-live="polite" aria-label="Error loading trainee status records">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
            <div>
              <p className="font-medium">Failed to load status records</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (records.length === 0) {
    return (
      <Card role="region" aria-label="No trainee status records">
        <CardHeader>
          <CardTitle>Trainee Status Records</CardTitle>
          <CardDescription>View and manage trainee post-graduation status information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" aria-hidden="true" />
            <p className="text-lg font-medium text-muted-foreground">No status records found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or create a new record</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Trainee Status Records</CardTitle>
        <CardDescription>View and manage trainee post-graduation status information</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Filter Bar */}
        <fieldset className="space-y-4 p-4 bg-muted/30 rounded-lg border" role="region" aria-labelledby="filter-legend">
          <legend id="filter-legend" className="text-sm font-semibold">Filter and Search</legend>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Active Filters</span>
            {Object.keys(localFilters).length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="text-xs"
                aria-label="Clear all applied filters"
              >
                <RotateCcw className="w-3 h-3 mr-1" aria-hidden="true" />
                Clear All
              </Button>
            )}
          </div>

          {/* Employment Status Filter */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium">Employment Status</legend>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['employed', 'unemployed', 'self_employed', 'pursuing_education', 'deceased', 'pending'].map(
                (status) => (
                  <label
                    key={status}
                    className="flex items-center gap-2 px-2 py-1 rounded border cursor-pointer hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={(localFilters.employmentStatus || []).includes(status)}
                      onChange={() => toggleFilter('employmentStatus', status)}
                      className="w-4 h-4"
                      aria-label={`Filter by employment status: ${EMPLOYMENT_STATUS_LABELS[status] || status}`}
                    />
                    <span className="text-xs">{EMPLOYMENT_STATUS_LABELS[status] || status}</span>
                  </label>
                )
              )}
            </div>
          </fieldset>

          {/* Skills Match Filter */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium">Skills Match</legend>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['exact_match', 'partial_match', 'no_match', 'not_applicable'].map((match) => (
                <label
                  key={match}
                  className="flex items-center gap-2 px-2 py-1 rounded border cursor-pointer hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={(localFilters.skillsMatch || []).includes(match)}
                    onChange={() => toggleFilter('skillsMatch', match)}
                    className="w-4 h-4"
                    aria-label={`Filter by skills match: ${SKILLS_MATCH_LABELS[match] || match}`}
                  />
                  <span className="text-xs">{SKILLS_MATCH_LABELS[match] || match}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Graduation Status Filter */}
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium">Graduation Status</legend>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {['graduated', 'pending', 'not_completed', 'suspended'].map((status) => (
                <label
                  key={status}
                  className="flex items-center gap-2 px-2 py-1 rounded border cursor-pointer hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={(localFilters.graduationStatus || []).includes(status)}
                    onChange={() => toggleFilter('graduationStatus', status)}
                    className="w-4 h-4"
                    aria-label={`Filter by graduation status: ${GRADUATION_STATUS_LABELS[status] || status}`}
                  />
                  <span className="text-xs">{GRADUATION_STATUS_LABELS[status] || status}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </fieldset>

        {/* Table */}
        <div className="overflow-x-auto" role="region" aria-label="Trainee status records table">
          <Table role="table" aria-label="Trainee status records with sortable columns">
            <TableHeader>
              <TableRow className="bg-muted/50" role="row">
                <TableHead
                  className="cursor-pointer hover:bg-muted text-xs font-semibold"
                  onClick={() => handleSort('name')}
                  role="columnheader"
                  aria-sort={localSort.column === 'name' ? (localSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  aria-label="Trainee name (sortable)"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('name');
                    }
                  }}
                >
                  Trainee Name {renderSortIndicator('name')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted text-xs font-semibold"
                  onClick={() => handleSort('graduation_date')}
                  role="columnheader"
                  aria-sort={localSort.column === 'graduation_date' ? (localSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  aria-label="Graduation status (sortable)"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('graduation_date');
                    }
                  }}
                >
                  Graduation Status {renderSortIndicator('graduation_date')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted text-xs font-semibold"
                  onClick={() => handleSort('employment_status')}
                  role="columnheader"
                  aria-sort={localSort.column === 'employment_status' ? (localSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  aria-label="Employment status (sortable)"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('employment_status');
                    }
                  }}
                >
                  Employment Status {renderSortIndicator('employment_status')}
                </TableHead>
                <TableHead className="text-xs font-semibold" role="columnheader" aria-label="Job title">Job Title</TableHead>
                <TableHead className="text-xs font-semibold" role="columnheader" aria-label="Employer name">Employer</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted text-xs font-semibold"
                  onClick={() => handleSort('skills_match')}
                  role="columnheader"
                  aria-sort={localSort.column === 'skills_match' ? (localSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  aria-label="Skills match (sortable)"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('skills_match');
                    }
                  }}
                >
                  Skills Match {renderSortIndicator('skills_match')}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted text-xs font-semibold"
                  onClick={() => handleSort('recorded_at')}
                  role="columnheader"
                  aria-sort={localSort.column === 'recorded_at' ? (localSort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                  aria-label="Date recorded (sortable)"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSort('recorded_at');
                    }
                  }}
                >
                  Recorded {renderSortIndicator('recorded_at')}
                </TableHead>
                <TableHead className="text-xs font-semibold w-12" role="columnheader" aria-label="Actions">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody role="rowgroup">
              {records.map((record, rowIndex) => (
                <TableRow
                  key={record.id}
                  className={`hover:bg-muted/50 transition-colors ${
                    focusedRowIndex === rowIndex ? 'ring-2 ring-blue-500 ring-inset' : ''
                  }`}
                  style={{
                    backgroundColor:
                      record.employmentStatus === 'employed' ||
                      record.employmentStatus === 'self_employed'
                        ? 'rgba(34, 197, 94, 0.05)'
                        : record.employmentStatus === 'unemployed'
                        ? 'rgba(107, 114, 128, 0.05)'
                        : undefined,
                  }}
                  tabIndex={focusedRowIndex === rowIndex ? 0 : -1}
                  onKeyDown={(e) => handleRowKeyDown(e, record.id, rowIndex)}
                  onFocus={() => setFocusedRowIndex(rowIndex)}
                  role="row"
                  aria-label={`Status record for ${getTraineeName(record)}, employment: ${record.employmentStatus}`}
                >
                  {/* Trainee Name */}
                  <TableCell className="text-sm font-medium" role="gridcell">
                    {getTraineeName(record)}
                  </TableCell>

                  {/* Graduation Status */}
                  <TableCell className="text-sm" role="gridcell">
                    <div className="flex items-center gap-2">
                      <GraduationStatusBadge status={record.graduationStatus} />
                      <span className="text-xs text-muted-foreground">
                        {formatDateDisplay(record.graduationDate)}
                      </span>
                    </div>
                  </TableCell>

                  {/* Employment Status */}
                  <TableCell className="text-sm" role="gridcell">
                    <EmploymentStatusBadge status={record.employmentStatus} />
                  </TableCell>

                  {/* Job Title */}
                  <TableCell className="text-sm max-w-xs" role="gridcell">
                    {record.jobTitle ? (
                      <span title={record.jobTitle} className="truncate block" aria-label={`Job title: ${record.jobTitle}`}>
                        {record.jobTitle}
                      </span>
                    ) : (
                      <span className="text-muted-foreground" aria-label="Not specified">—</span>
                    )}
                  </TableCell>

                  {/* Employer */}
                  <TableCell className="text-sm max-w-xs" role="gridcell">
                    {record.employerName ? (
                      <span title={record.employerName} className="truncate block" aria-label={`Employer: ${record.employerName}`}>
                        {record.employerName}
                      </span>
                    ) : (
                      <span className="text-muted-foreground" aria-label="Not specified">—</span>
                    )}
                  </TableCell>

                  {/* Skills Match */}
                  <TableCell className="text-sm" role="gridcell">
                    <div className="flex items-center gap-1">
                      {record.skillsMatch && (
                        <SkillsMatchBadge
                          match={record.skillsMatch}
                          percentage={record.skillsMatchPercentage}
                        />
                      )}
                      {!record.skillsMatch && (
                        <span className="text-muted-foreground" aria-label="Not specified">—</span>
                      )}
                    </div>
                  </TableCell>

                  {/* Recorded Date */}
                  <TableCell className="text-sm text-muted-foreground" role="gridcell">
                    <span title={record.recordedAt} aria-label={`Recorded: ${formatDateDisplay(record.recordedAt)}`}>{formatDateDisplay(record.recordedAt)}</span>
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-sm" role="gridcell">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewRecord?.(record.id)}
                      title="View details"
                      tabIndex={focusedRowIndex === rowIndex ? 0 : -1}
                      aria-label={`View details for ${getTraineeName(record)}`}
                    >
                      <Eye className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t" role="navigation" aria-label="Table pagination">
          <div className="text-sm text-muted-foreground">
            <span aria-live="polite" aria-atomic="true">
              Showing {paginationData.startIndex}–{paginationData.endIndex} of {pagination.total} records
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Limit Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="records-per-page" className="text-xs font-medium">Records per page:</label>
              <Select
                value={pagination.limit.toString()}
                onValueChange={(value) => onLimitChange?.(parseInt(value))}
              >
                <SelectTrigger className="w-20" id="records-per-page" aria-label="Select number of records to display per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Pagination */}
            <Pagination aria-label="Table page navigation">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => {
                      if (pagination.page > 1) {
                        onPageChange?.(pagination.page - 1);
                      }
                    }}
                    className={
                      pagination.page === 1
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>

                {/* Page numbers */}
                {paginationData.totalPages <= 5
                  ? // Show all pages if 5 or fewer
                    Array.from({ length: paginationData.totalPages }, (_, i) => (
                      <PaginationItem key={i + 1}>
                        <PaginationLink
                          onClick={() => onPageChange?.(i + 1)}
                          isActive={pagination.page === i + 1}
                          className="cursor-pointer"
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))
                  : // Show truncated page numbers if more than 5
                    [
                      <PaginationItem key={1}>
                        <PaginationLink
                          onClick={() => onPageChange?.(1)}
                          isActive={pagination.page === 1}
                          className="cursor-pointer"
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>,
                      pagination.page > 3 && (
                        <PaginationItem key="ellipsis-start">
                          <PaginationEllipsis />
                        </PaginationItem>
                      ),
                      ...Array.from(
                        {
                          length: Math.min(3, Math.max(1, paginationData.totalPages - 2)),
                        },
                        (_, i) => {
                          const pageNum = Math.max(2, pagination.page - 1) + i;
                          if (pageNum >= paginationData.totalPages) return null;
                          return (
                            <PaginationItem key={pageNum}>
                              <PaginationLink
                                onClick={() => onPageChange?.(pageNum)}
                                isActive={pagination.page === pageNum}
                                className="cursor-pointer"
                              >
                                {pageNum}
                              </PaginationLink>
                            </PaginationItem>
                          );
                        }
                      ).filter(Boolean),
                      pagination.page < paginationData.totalPages - 2 && (
                        <PaginationItem key="ellipsis-end">
                          <PaginationEllipsis />
                        </PaginationItem>
                      ),
                      <PaginationItem key={paginationData.totalPages}>
                        <PaginationLink
                          onClick={() => onPageChange?.(paginationData.totalPages)}
                          isActive={pagination.page === paginationData.totalPages}
                          className="cursor-pointer"
                        >
                          {paginationData.totalPages}
                        </PaginationLink>
                      </PaginationItem>,
                    ]}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => {
                      if (pagination.page < paginationData.totalPages) {
                        onPageChange?.(pagination.page + 1);
                      }
                    }}
                    className={
                      pagination.page >= paginationData.totalPages
                        ? 'pointer-events-none opacity-50'
                        : 'cursor-pointer'
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
