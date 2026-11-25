import { useState, useCallback, useMemo, memo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Checkbox } from '../components/ui/checkbox';
import { useArchiveFilters, type ArchivedItem } from '../hooks/useArchiveFilters';
import { TableSkeleton } from '../components/LoadingSkeletons';
import { toast } from 'sonner';
import api from '../services/api';
import logger from '../utils/logger';
import { formatDistanceToNow } from 'date-fns';
import { MoreVertical, Trash2, RotateCcw } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';

const ENTITY_TYPES = [
  { value: 'trainee', label: 'Trainees', color: 'bg-blue-500/10 text-blue-700' },
  { value: 'program', label: 'Programs', color: 'bg-green-500/10 text-green-700' },
  { value: 'item', label: 'Inventory', color: 'bg-yellow-500/10 text-yellow-700' },
  { value: 'trainee_status', label: 'Trainee Status', color: 'bg-purple-500/10 text-purple-700' },
  { value: 'training_requirement_file', label: 'Training Requirement Files', color: 'bg-orange-500/10 text-orange-700' },
];

function getDaysRemainingColor(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'text-red-600 font-semibold';
  if (daysRemaining <= 7) return 'text-orange-600 font-semibold';
  return 'text-green-600';
}

function getEntityTypeBadgeColor(entityType: string): string {
  const entity = ENTITY_TYPES.find((e) => e.value === entityType);
  return entity?.color || 'bg-gray-500/10 text-gray-700';
}

interface ArchivedItemRowProps {
  item: ArchivedItem;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
  onRestore: (item: ArchivedItem) => void;
  onPurge: (item: ArchivedItem) => void;
}

const ArchivedItemRow = memo(function ArchivedItemRow({
  item,
  isSelected,
  onSelect,
  onRestore,
  onPurge,
}: ArchivedItemRowProps) {
  return (
    <TableRow>
      <TableCell className="w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelect(item.id, checked as boolean)}
        />
      </TableCell>
      <TableCell>
        <Badge className={getEntityTypeBadgeColor('trainee')} variant="outline">
          Trainee
        </Badge>
      </TableCell>
      <TableCell className="font-medium">
        {[item.first_name, item.last_name].filter(Boolean).join(' ') || item.email || item.name || item.file_name || 'Unknown'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}
      </TableCell>
      <TableCell>
        <span className={getDaysRemainingColor(item.daysRemaining)}>
          {item.daysRemaining > 0 ? `${item.daysRemaining} days` : 'Ready for purge'}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRestore(item)}
            className="hover:bg-blue-50"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => onPurge(item)}
                disabled={!item.eligibleForPurge}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Purge Permanently
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>
    </TableRow>
  );
});

export default function ArchivePage() {
  const { user, hasPermission } = useAuth();

  // Permission check
  if (!user || user.role !== 'local_admin') {
    return <Navigate to="/" replace />;
  }

  const { items, loading, error, filters, setFilters, pagination, refetch } = useArchiveFilters();
  const [selectedItems, setSelectedItems] = useState<Map<string, boolean>>(new Map());
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ArchivedItem | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectItem = useCallback((id: string, selected: boolean) => {
    setSelectedItems((prev) => {
      const newMap = new Map(prev);
      if (selected) {
        newMap.set(id, true);
      } else {
        newMap.delete(id);
      }
      return newMap;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Map());
    } else {
      const newMap = new Map<string, boolean>();
      items.forEach((item) => {
        newMap.set(item.id, true);
      });
      setSelectedItems(newMap);
    }
  }, [items, selectedItems]);

  const handleRestoreSingle = useCallback((item: ArchivedItem) => {
    setSelectedItem(item);
    setRestoreDialogOpen(true);
  }, []);

  const handlePurgeSingle = useCallback((item: ArchivedItem) => {
    const isEligible = item.eligibleForPurge ?? item.eligible_for_purge;
    const remaining = item.daysRemaining ?? item.days_remaining;
    if (!isEligible) {
      toast.warning(`Not eligible for purge. ${remaining} days remaining.`);
      return;
    }
    setSelectedItem(item);
    setPurgeDialogOpen(true);
  }, []);

  const handleConfirmRestore = useCallback(async () => {
    if (!selectedItem) return;

    try {
      setIsProcessing(true);
      await api.patch('/archive', {
        entityType: 'trainee',
        ids: [selectedItem.id],
      });

      toast.success('Item restored successfully');
      setRestoreDialogOpen(false);
      setSelectedItem(null);
      setSelectedItems(new Map());
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore item';
      logger.error('Restore failed', { error: message });
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedItem, refetch]);

  const handleConfirmPurge = useCallback(async () => {
    if (!selectedItem) return;

    try {
      setIsProcessing(true);
      await api.delete(`/archive/${selectedItem.id}`, {
        params: { entityType: 'trainee' },
      });

      toast.success('Item permanently deleted');
      setPurgeDialogOpen(false);
      setSelectedItem(null);
      setSelectedItems(new Map());
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to purge item';
      logger.error('Purge failed', { error: message });
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedItem, refetch]);

  const handleRestoreSelected = useCallback(async () => {
    if (selectedItems.size === 0) {
      toast.warning('No items selected');
      return;
    }

    try {
      setIsProcessing(true);
      const ids = Array.from(selectedItems.keys());

      await api.patch('/archive', {
        entityType: filters.entityType || 'all',
        ids,
      });

      toast.success(`${ids.length} item(s) restored successfully`);
      setSelectedItems(new Map());
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to restore items';
      logger.error('Bulk restore failed', { error: message });
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedItems, filters.entityType, refetch]);

  const bulkPurgeDisabled = useMemo(() => {
    return Array.from(selectedItems.keys()).some((id) => {
      const item = items.find((i) => i.id === id);
      return item && !(item.eligibleForPurge ?? item.eligible_for_purge);
    });
  }, [selectedItems, items]);

  const handleBulkPurge = useCallback(async () => {
    if (selectedItems.size === 0) {
      toast.warning('No items selected');
      return;
    }

    if (bulkPurgeDisabled) {
      toast.warning('Some items are not eligible for purge yet');
      return;
    }

    try {
      setIsProcessing(true);
      const ids = Array.from(selectedItems.keys());

      // Purge each item individually
      for (const id of ids) {
        await api.delete(`/archive/${id}`, {
          params: { entityType: filters.entityType || 'all' },
        });
      }

      toast.success(`${ids.length} item(s) permanently deleted`);
      setSelectedItems(new Map());
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to purge items';
      logger.error('Bulk purge failed', { error: message });
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [selectedItems, bulkPurgeDisabled, filters.entityType, refetch]);

  const handlePageChange = useCallback(
    (newPage: number) => {
      setFilters({ page: newPage });
    },
    [setFilters]
  );

  if (error) {
    return (
      <DashboardLayout>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">{error}</p>
            <Button onClick={refetch} className="mt-2">
              Retry
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Archive</h1>
          <p className="text-muted-foreground">Manage soft-deleted items and retention policies</p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="entity-type">Entity Type</Label>
                <Select value={filters.entityType} onValueChange={(v) => setFilters({ entityType: v })}>
                  <SelectTrigger id="entity-type">
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="search">Search by name</Label>
                <Input
                  id="search"
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => setFilters({ search: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedItems.size > 0 && (
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="pt-6 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <p className="text-sm font-medium text-blue-900">
                {selectedItems.size} item(s) selected
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRestoreSelected}
                  disabled={isProcessing}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Restore Selected
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkPurge}
                  disabled={isProcessing || bulkPurgeDisabled}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Purge Selected
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Archived Items</CardTitle>
                <CardDescription>
                  {pagination?.total ?? 0} item(s) found
                </CardDescription>
              </div>
              {(items?.length ?? 0) > 0 && (
                <Checkbox
                  checked={selectedItems.size === items.length && items.length > 0}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all items"
                />
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <TableSkeleton rows={5} />
            ) : (items?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground text-lg">No archived items</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={items && selectedItems.size === items.length && items.length > 0}
                            onCheckedChange={handleSelectAll}
                            aria-label="Select all items"
                          />
                        </TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Deleted</TableHead>
                        <TableHead>Days Remaining</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items?.map((item) => (
                        <ArchivedItemRow
                          key={item.id}
                          item={item}
                          isSelected={selectedItems.has(item.id)}
                          onSelect={handleSelectItem}
                          onRestore={handleRestoreSingle}
                          onPurge={handlePurgeSingle}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="mt-6 flex justify-center">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => pagination.page > 1 && handlePageChange(pagination.page - 1)}
                            className={pagination.page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>

                        {pagination.page > 2 && (
                          <>
                            <PaginationItem>
                              <PaginationLink onClick={() => handlePageChange(1)}>1</PaginationLink>
                            </PaginationItem>
                            {pagination.page > 3 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                          </>
                        )}

                        {pagination.page > 1 && (
                          <PaginationItem>
                            <PaginationLink onClick={() => handlePageChange(pagination.page - 1)}>
                              {pagination.page - 1}
                            </PaginationLink>
                          </PaginationItem>
                        )}

                        <PaginationItem>
                          <PaginationLink isActive>{pagination.page}</PaginationLink>
                        </PaginationItem>

                        {pagination.page < pagination.totalPages && (
                          <PaginationItem>
                            <PaginationLink onClick={() => handlePageChange(pagination.page + 1)}>
                              {pagination.page + 1}
                            </PaginationLink>
                          </PaginationItem>
                        )}

                        {pagination.page < pagination.totalPages - 1 && (
                          <>
                            {pagination.page < pagination.totalPages - 2 && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink onClick={() => handlePageChange(pagination.totalPages)}>
                                {pagination.totalPages}
                              </PaginationLink>
                            </PaginationItem>
                          </>
                        )}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => pagination.page < pagination.totalPages && handlePageChange(pagination.page + 1)}
                            className={pagination.page === pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to restore "{selectedItem ? ([selectedItem.first_name, selectedItem.last_name].filter(Boolean).join(' ') || selectedItem.email || selectedItem.name || 'this item') : 'this item'}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore} disabled={isProcessing}>
              {isProcessing ? 'Restoring...' : 'Restore'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purge Dialog */}
      <AlertDialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{selectedItem ? ([selectedItem.first_name, selectedItem.last_name].filter(Boolean).join(' ') || selectedItem.email || selectedItem.name || 'this item') : 'this item'}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmPurge}
              disabled={isProcessing}
              className="bg-red-600 hover:bg-red-700"
            >
              {isProcessing ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
