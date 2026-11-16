/**
 * RequirementDefinitionsList Component
 *
 * Displays a list of requirement definitions in a table format with:
 * - Columns: displayName, description, isMandatory, isActive, completionRate
 * - Filtering by isActive status
 * - Sorting by name, mandatory flag, completion rate
 * - Pagination with page/limit controls
 * - Submission statistics display
 * - Loading skeletons and error states
 * - Action buttons to view details, edit, or delete (soft delete)
 *
 * **Validates: Requirements 4.1, Admin requirements management components**
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRequirementDefinitions } from '../hooks/useRequirementDefinitions';
import { useUpdateRequirementDefinition } from '../hooks/useUpdateRequirementDefinition';
import { RequirementDefinition } from '../types/requirementDefinition';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/pagination';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Input } from './ui/input';
import { toast } from 'sonner';
import {
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from './ui/dropdown-menu';
import logger from '../utils/logger';

/**
 * Props for RequirementDefinitionsList component
 */
export interface RequirementDefinitionsListProps {
  /**
   * Optional callback when a requirement is selected/clicked
   * Useful for navigation to detail page
   * @param id - The ID of the selected requirement definition
   */
  onRequirementSelect?: (id: string) => void;
}

/**
 * RequirementDefinitionsList Component
 */
export function RequirementDefinitionsList({
  onRequirementSelect,
}: RequirementDefinitionsListProps) {
  // State for filtering and pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [sortBy, setSortBy] = useState<'name' | 'mandatory' | 'completion_rate'>(
    'name'
  );
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>(
    'all'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const { mutate: updateRequirement } = useUpdateRequirementDefinition();

  // Determine isActive query parameter based on filter
  const isActiveQuery =
    activeFilter === 'all' ? undefined : activeFilter === 'active';

  // Fetch requirement definitions from API
  const { data, isLoading, isError, error, pagination, refetch } =
    useRequirementDefinitions({
      page,
      limit,
      sortBy,
      isActive: isActiveQuery,
    });

  // Filter data by search term (client-side filtering on display_name and description)
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) {
      return data;
    }

    const lowerSearchTerm = searchTerm.toLowerCase();
    return data.filter(
      (req) =>
        req.display_name.toLowerCase().includes(lowerSearchTerm) ||
        req.description.toLowerCase().includes(lowerSearchTerm)
    );
  }, [data, searchTerm]);

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    logger.info('[RequirementDefinitionsList] Page changed', { newPage });
  };

  // Handle limit change
  const handleLimitChange = (newLimit: string) => {
    const limitNum = parseInt(newLimit, 10);
    setLimit(limitNum);
    setPage(1); // Reset to first page when changing limit
    logger.info('[RequirementDefinitionsList] Limit changed', { limit: limitNum });
  };

  // Handle sort change
  const handleSortChange = (newSort: string) => {
    setSortBy(newSort as 'name' | 'mandatory' | 'completion_rate');
    setPage(1); // Reset to first page when changing sort
    logger.info('[RequirementDefinitionsList] Sort changed', { sortBy: newSort });
  };

  // Handle filter change
  const handleFilterChange = (newFilter: string) => {
    setActiveFilter(newFilter as 'all' | 'active' | 'inactive');
    setPage(1); // Reset to first page when changing filter
    logger.info('[RequirementDefinitionsList] Filter changed', {
      filter: newFilter,
    });
  };

  // Handle view details action
  const handleViewDetails = (requirement: RequirementDefinition) => {
    logger.info('[RequirementDefinitionsList] View details clicked', {
      requirementId: requirement.id,
    });
    if (onRequirementSelect) {
      onRequirementSelect(requirement.id);
    } else {
      navigate(`/admin/requirements/${requirement.id}`);
    }
  };

  // Handle edit action
  const handleEdit = (requirement: RequirementDefinition) => {
    logger.info('[RequirementDefinitionsList] Edit clicked', {
      requirementId: requirement.id,
    });
    navigate(`/admin/requirements/${requirement.id}/edit`);
  };

  // Handle delete action (soft delete)
  const handleDelete = (requirement: RequirementDefinition) => {
    logger.info('[RequirementDefinitionsList] Delete clicked', {
      requirementId: requirement.id,
    });
    if (window.confirm(`Delete "${requirement.display_name}"?`)) {
      try {
        updateRequirement(requirement.id, { isActive: false });
        toast.success('Requirement deleted successfully');
        void refetch();
      } catch (err) {
        logger.error('[RequirementDefinitionsList] Delete failed', { error: err });
        toast.error('Failed to delete requirement');
      }
    }
  };

  // Generate pagination items
  const getPaginationItems = () => {
    const items = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    if (startPage > 1) {
      items.push(
        <PaginationItem key="1">
          <PaginationLink onClick={() => handlePageChange(1)}>1</PaginationLink>
        </PaginationItem>
      );
      if (startPage > 2) {
        items.push(<PaginationEllipsis key="ellipsis-start" />);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => handlePageChange(i)}
            isActive={i === page}
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (endPage < pagination.totalPages) {
      if (endPage < pagination.totalPages - 1) {
        items.push(<PaginationEllipsis key="ellipsis-end" />);
      }
      items.push(
        <PaginationItem key={pagination.totalPages}>
          <PaginationLink onClick={() => handlePageChange(pagination.totalPages)}>
            {pagination.totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  // Loading skeleton state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Requirement Definitions</CardTitle>
          <CardDescription>
            Manage training requirement definitions for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="h-10 bg-muted rounded flex-1 animate-pulse" />
              <div className="h-10 bg-muted rounded w-32 animate-pulse" />
              <div className="h-10 bg-muted rounded w-32 animate-pulse" />
            </div>
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-16 bg-muted rounded animate-pulse"
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Requirement Definitions</CardTitle>
          <CardDescription>
            Manage training requirement definitions for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="font-semibold text-lg mb-2">Error Loading Requirements</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              {error instanceof Error ? error.message : 'An error occurred while fetching requirements.'}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state (no data from API)
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Requirement Definitions</CardTitle>
          <CardDescription>
            Manage training requirement definitions for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <Eye className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg mb-2">No Requirements Found</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              {activeFilter !== 'all'
                ? `No ${activeFilter} requirement definitions found. Try changing the filter.`
                : 'No requirement definitions have been created yet. Create your first requirement to get started.'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty search results state
  if (filteredData.length === 0 && searchTerm) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Requirement Definitions</CardTitle>
          <CardDescription>
            Manage training requirement definitions for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <Input
                  placeholder="Search by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Select value={activeFilter} onValueChange={handleFilterChange}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">No Results Found</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  No requirements match &quot;{searchTerm}&quot;. Try adjusting your search or filters.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Requirement Definitions</CardTitle>
          <CardDescription>
            Manage training requirement definitions for your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Filters and Search */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <Input
                  placeholder="Search by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                <Select value={activeFilter} onValueChange={handleFilterChange}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="mandatory">Mandatory</SelectItem>
                    <SelectItem value="completion_rate">Completion Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Display Name</TableHead>
                    <TableHead className="w-[250px]">Description</TableHead>
                    <TableHead className="w-[100px]">Type</TableHead>
                    <TableHead className="text-center w-[80px]">Mandatory</TableHead>
                    <TableHead className="text-center w-[80px]">Active</TableHead>
                    <TableHead className="text-center w-[120px]">Completion Rate</TableHead>
                    <TableHead className="text-center w-[150px]">Submissions</TableHead>
                    <TableHead className="text-center w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((requirement) => (
                    <TableRow
                      key={requirement.id}
                      className="hover:bg-muted/50 cursor-pointer"
                    >
                      <TableCell className="font-semibold">
                        <button
                          onClick={() => handleViewDetails(requirement)}
                          className="text-left hover:underline"
                        >
                          {requirement.display_name}
                        </button>
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">
                        {requirement.description}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {requirement.requirement_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={requirement.is_mandatory ? 'default' : 'secondary'}
                        >
                          {requirement.is_mandatory ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant={requirement.is_active ? 'default' : 'outline'}
                          className={
                            requirement.is_active
                              ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                              : 'text-muted-foreground'
                          }
                        >
                          {requirement.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {requirement.submission_stats ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-sm font-medium">
                              {requirement.submission_stats.completion_rate}%
                            </span>
                            <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-primary h-full transition-all"
                                style={{
                                  width: `${requirement.submission_stats.completion_rate}%`,
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No data
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                          {requirement.submission_stats && (
                            <>
                              <div className="flex items-center gap-0.5">
                                <Clock className="h-3 w-3 text-yellow-500" />
                                <span>{requirement.submission_stats.pending_count}</span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <CheckCircle2 className="h-3 w-3 text-green-500" />
                                <span>{requirement.submission_stats.verified_count}</span>
                              </div>
                              <div className="flex items-center gap-0.5">
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                                <span>{requirement.submission_stats.rejected_count}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              ⋮
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleViewDetails(requirement)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleEdit(requirement)}
                            >
                              <Edit2 className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(requirement)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Items per page:</span>
                <Select value={String(limit)} onValueChange={handleLimitChange}>
                  <SelectTrigger className="w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * limit + 1} to{' '}
                {Math.min(page * limit, pagination.total)} of{' '}
                {pagination.total} requirements
              </div>

              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() =>
                        pagination.hasPreviousPage && handlePageChange(page - 1)
                      }
                      className={
                        !pagination.hasPreviousPage
                          ? 'pointer-events-none opacity-50'
                          : 'cursor-pointer'
                      }
                    />
                  </PaginationItem>
                  {getPaginationItems()}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        pagination.hasNextPage && handlePageChange(page + 1)
                      }
                      className={
                        !pagination.hasNextPage
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
    </div>
  );
}
