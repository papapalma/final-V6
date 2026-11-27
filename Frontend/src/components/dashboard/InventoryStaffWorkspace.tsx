import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  PackageX,
  RefreshCw,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import PaginationWrapper from '../PaginationWrapper';
import lendingService, { type LendingRecord } from '../../services/lendingService';
import reportService, { type ActivityReport, type InventoryReport } from '../../services/reportService';
import logger from '../../utils/logger';

type LendingTab = 'all' | 'overdue' | 'active';

interface ClassifiedLending {
  record: LendingRecord;
  isOverdue: boolean;
  overdueDays: number;
  borrowerLabel: string;
  itemLabel: string;
}

const LENDINGS_PER_PAGE = 8;
const LOW_STOCK_PER_PAGE = 6;

function formatShortDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function clampRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.max(0, Math.min(1, numerator / denominator));
}

export default function InventoryStaffWorkspace() {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  // Card 1: Overdue & Active Borrowings Queue
  const [rawLendings, setRawLendings] = useState<LendingRecord[]>([]);
  const [lendingLoading, setLendingLoading] = useState(true);
  const [lendingError, setLendingError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LendingTab>('all');
  const [lendingPage, setLendingPage] = useState(1);

  // Card 2 & Category Breakdown: Inventory Report
  const [inventoryReport, setInventoryReport] = useState<InventoryReport | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [lowStockPage, setLowStockPage] = useState(1);

  // Card 3 Trend: Borrowing Activity Trend
  const [trendData, setTrendData] = useState<Array<{ date: string; borrowed: number; returned: number }>>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);

  const fetchOpenLendings = useCallback(async () => {
    try {
      setLendingLoading(true);
      setLendingError(null);
      const response = await lendingService.getLendingRecords();
      const rows = Array.isArray(response?.data) ? response.data : [];
      setRawLendings(rows);
      setLendingPage(1);
    } catch (error) {
      logger.error('Failed to load borrowings queue widget', { error });
      setLendingError('Unable to load active and overdue borrowings right now.');
    } finally {
      setLendingLoading(false);
    }
  }, []);

  const fetchInventoryHealth = useCallback(async () => {
    try {
      setInventoryLoading(true);
      setInventoryError(null);
      const report = await reportService.getInventoryReport();
      setInventoryReport(report ?? null);
      setLowStockPage(1);
    } catch (error) {
      logger.error('Failed to load inventory health widget', { error });
      setInventoryError('Unable to load stock alerts and category breakdown.');
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  const fetchBorrowingTrend = useCallback(async () => {
    try {
      setTrendLoading(true);
      setTrendError(null);
      const activity: ActivityReport = await reportService.getActivityAnalytics();
      const rawTrend = Array.isArray(activity?.trend) ? activity.trend : [];
      const recent = rawTrend.slice(-14).map((entry) => ({
        date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        borrowed: entry.borrowed || 0,
        returned: entry.returned || 0,
      }));
      setTrendData(recent);
    } catch (error) {
      logger.error('Failed to load borrowing trend widget', { error });
      setTrendError('Unable to load borrowing trend.');
    } finally {
      setTrendLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOpenLendings();
    void fetchInventoryHealth();
    void fetchBorrowingTrend();
  }, [fetchOpenLendings, fetchInventoryHealth, fetchBorrowingTrend]);

  const { allOpen, overdueList, activeList } = useMemo(() => {
    const nowMs = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;
    const overdue: ClassifiedLending[] = [];
    const active: ClassifiedLending[] = [];

    for (const record of rawLendings) {
      if (record.status !== 'active' && record.status !== 'overdue') continue;
      const dueMs = record.expected_return_date ? new Date(record.expected_return_date).getTime() : NaN;
      const isOverdue =
        record.status === 'overdue' ||
        (record.status === 'active' && !Number.isNaN(dueMs) && dueMs < nowMs);
      const overdueDays =
        isOverdue && !Number.isNaN(dueMs) ? Math.max(1, Math.floor((nowMs - dueMs) / dayMs)) : 0;
      const traineeName = record.trainee
        ? `${record.trainee.first_name || ''} ${record.trainee.last_name || ''}`.trim()
        : '';
      const classified: ClassifiedLending = {
        record,
        isOverdue,
        overdueDays,
        borrowerLabel: traineeName || record.borrower_name || 'Unknown Borrower',
        itemLabel: record.item?.name || 'Equipment Item',
      };
      if (isOverdue) {
        overdue.push(classified);
      } else {
        active.push(classified);
      }
    }

    const byDueDateAsc = (a: ClassifiedLending, b: ClassifiedLending) => {
      const aTime = a.record.expected_return_date ? new Date(a.record.expected_return_date).getTime() : Infinity;
      const bTime = b.record.expected_return_date ? new Date(b.record.expected_return_date).getTime() : Infinity;
      return aTime - bTime;
    };

    overdue.sort(byDueDateAsc);
    active.sort(byDueDateAsc);

    return {
      allOpen: [...overdue, ...active],
      overdueList: overdue,
      activeList: active,
    };
  }, [rawLendings]);

  const visibleLendings = useMemo(() => {
    if (activeTab === 'overdue') return overdueList;
    if (activeTab === 'active') return activeList;
    return allOpen;
  }, [activeTab, allOpen, overdueList, activeList]);

  const lendingTotalPages = Math.ceil(visibleLendings.length / LENDINGS_PER_PAGE);
  const paginatedLendings = useMemo(() => {
    const start = (lendingPage - 1) * LENDINGS_PER_PAGE;
    return visibleLendings.slice(start, start + LENDINGS_PER_PAGE);
  }, [visibleLendings, lendingPage]);

  const sortedLowStockItems = useMemo(() => {
    const items = inventoryReport?.lowStockItems ?? [];
    return [...items].sort((a, b) => {
      const aAvail = a.available_quantity ?? a.quantity ?? 0;
      const bAvail = b.available_quantity ?? b.quantity ?? 0;
      const aOut = aAvail === 0 || a.status === 'out_of_stock' ? 0 : 1;
      const bOut = bAvail === 0 || b.status === 'out_of_stock' ? 0 : 1;
      if (aOut !== bOut) return aOut - bOut;
      const aRatio = clampRatio(aAvail, Math.max(a.minimum_quantity ?? 1, 1));
      const bRatio = clampRatio(bAvail, Math.max(b.minimum_quantity ?? 1, 1));
      return aRatio - bRatio;
    });
  }, [inventoryReport]);

  const lowStockTotalPages = Math.ceil(sortedLowStockItems.length / LOW_STOCK_PER_PAGE);
  const paginatedLowStock = useMemo(() => {
    const start = (lowStockPage - 1) * LOW_STOCK_PER_PAGE;
    return sortedLowStockItems.slice(start, start + LOW_STOCK_PER_PAGE);
  }, [sortedLowStockItems, lowStockPage]);

  const topCategories = useMemo(() => {
    const byCategory = inventoryReport?.byCategory ?? {};
    const entries = Object.entries(byCategory).sort(([, a], [, b]) => b - a);
    const total = entries.reduce((sum, [, count]) => sum + count, 0);
    return entries.slice(0, 5).map(([name, count]) => ({
      name,
      count,
      ratio: clampRatio(count, total),
    }));
  }, [inventoryReport]);

  const handleTabChange = (tab: LendingTab) => {
    setActiveTab(tab);
    setLendingPage(1);
  };

  const tabOptions: Array<{ key: LendingTab; label: string; count: number }> = [
    { key: 'all', label: 'All Open', count: allOpen.length },
    { key: 'overdue', label: 'Overdue', count: overdueList.length },
    { key: 'active', label: 'Active', count: activeList.length },
  ];

  const emptyQueueCopy: Record<LendingTab, { title: string; subtitle: string }> = {
    all: {
      title: 'All caught up',
      subtitle: 'There are no open equipment borrowings at the moment.',
    },
    overdue: {
      title: 'All caught up — 0 overdue',
      subtitle: 'Every active equipment loan is still within its return date.',
    },
    active: {
      title: 'No upcoming active returns',
      subtitle: 'There are currently no on-schedule active borrowings.',
    },
  };

  return (
    <section
      aria-label="Inventory Operations Workspace"
      className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] items-start"
    >
      {/* 62% Primary Column: Overdue & Active Borrowings Queue */}
      <Card data-testid="inventory-borrowings-queue-card">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary shrink-0" />
              <CardTitle className="text-base font-semibold">Active & Overdue Borrowings</CardTitle>
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Checked-out equipment sorted by return urgency
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm" className="w-fit py-2 px-3.5 text-xs">
            <Link to="/lendings">
              Manage All
              <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Segmented Filter Tabs with Critically Damped Apple Spring */}
          {!lendingLoading && !lendingError && (
            <div
              role="tablist"
              aria-label="Filter borrowings by status"
              className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1"
            >
              {tabOptions.map((tab) => {
                const isSelected = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    onClick={() => handleTabChange(tab.key)}
                    className={`lang-segment-btn relative rounded-md py-1.5 px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      isSelected
                        ? 'text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="inv-lending-tab"
                        transition={
                          shouldReduceMotion
                            ? { duration: 0.12 }
                            : { type: 'spring', duration: 0.22, bounce: 0 }
                        }
                        className="absolute inset-0 rounded-md bg-card shadow-sm"
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-1.5 tabular-nums">
                      <span>{tab.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          tab.key === 'overdue' && tab.count > 0
                            ? 'bg-destructive/15 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {lendingLoading ? (
            <div className="space-y-3" data-testid="borrowings-queue-skeleton">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={`lend-skel-${idx}`} className="flex items-center justify-between gap-4 py-2">
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-44" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-4 w-10" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              ))}
            </div>
          ) : lendingError ? (
            <div
              role="alert"
              className="flex flex-col items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center"
            >
              <div className="flex items-start gap-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <span>{lendingError}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void fetchOpenLendings()}
                className="shrink-0 py-2 px-3.5 text-xs"
              >
                <RefreshCw className="mr-1.5 size-3.5" />
                Retry
              </Button>
            </div>
          ) : visibleLendings.length === 0 ? (
            <div className="req-surface-in flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-6" />
              </div>
              <p className="text-sm font-medium text-foreground">{emptyQueueCopy[activeTab].title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{emptyQueueCopy[activeTab].subtitle}</p>
            </div>
          ) : (
            <div className="req-surface-in">
              {/* Desktop Paginated Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLendings.map((entry) => (
                      <TableRow
                        key={entry.record.id}
                        onClick={() => navigate('/lendings')}
                        className="req-row-interactive cursor-pointer"
                      >
                        <TableCell>
                          <Link
                            to="/lendings"
                            onClick={(e) => e.stopPropagation()}
                            className="block max-w-[220px] truncate font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:underline"
                          >
                            {entry.itemLabel}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm text-muted-foreground">
                          {entry.borrowerLabel}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {entry.record.quantity}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">
                          {formatShortDate(entry.record.expected_return_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1.5">
                            {entry.isOverdue ? (
                              <Badge
                                variant="destructive"
                                className="py-0.5 px-2 text-xs tabular-nums"
                              >
                                Overdue ({entry.overdueDays}d)
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="py-0.5 px-2 text-xs">
                                Active
                              </Badge>
                            )}
                            <ChevronRight className="size-4 text-muted-foreground" />
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Compact Cards */}
              <div className="space-y-3 md:hidden">
                {paginatedLendings.map((entry) => (
                  <Link
                    key={entry.record.id}
                    to="/lendings"
                    className="req-row-interactive block rounded-lg border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{entry.itemLabel}</p>
                        <p className="truncate text-xs text-muted-foreground">{entry.borrowerLabel}</p>
                      </div>
                      {entry.isOverdue ? (
                        <Badge variant="destructive" className="shrink-0 py-0.5 px-2 text-xs tabular-nums">
                          Overdue ({entry.overdueDays}d)
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0 py-0.5 px-2 text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                      <span>Qty: {entry.record.quantity}</span>
                      <span>Due {formatShortDate(entry.record.expected_return_date)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </CardContent>

        {!lendingLoading && !lendingError && lendingTotalPages > 1 && (
          <div className="border-t bg-muted/30 px-6 py-3">
            <PaginationWrapper
              currentPage={lendingPage}
              totalPages={lendingTotalPages}
              onPageChange={setLendingPage}
              itemsCount={visibleLendings.length}
              itemsPerPage={LENDINGS_PER_PAGE}
            />
          </div>
        )}
      </Card>

      {/* 38% Companion Column: Low-Stock Alerts + Category & Borrowing Trend */}
      <div className="space-y-6">
        {/* Card 2: Low-Stock & Out-of-Stock Alerts */}
        <Card data-testid="inventory-low-stock-card">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                <CardTitle className="text-base font-semibold">Low-Stock Alerts</CardTitle>
                {!inventoryLoading && !inventoryError && (
                  <Badge
                    variant={sortedLowStockItems.length > 0 ? 'secondary' : 'outline'}
                    className="py-0.5 px-2 text-xs tabular-nums"
                  >
                    {sortedLowStockItems.length}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Items at or below minimum threshold
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 py-2 px-3 text-xs">
              <Link to="/items?stock=low">
                View Items
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent>
            {inventoryLoading ? (
              <div className="space-y-3" data-testid="low-stock-skeleton">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`stock-skel-${idx}`} className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-1.5 w-full rounded-full" />
                  </div>
                ))}
              </div>
            ) : inventoryError ? (
              <div
                role="alert"
                className="flex flex-col items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-2 text-xs sm:text-sm text-destructive">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span>{inventoryError}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchInventoryHealth()}
                  className="shrink-0 py-2 px-3.5 text-xs"
                >
                  <RefreshCw className="mr-1.5 size-3.5" />
                  Retry
                </Button>
              </div>
            ) : sortedLowStockItems.length === 0 ? (
              <div className="req-surface-in flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="mb-2 size-8 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-medium text-foreground">Stock levels healthy</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  All inventory items are above their minimum thresholds.
                </p>
              </div>
            ) : (
              <div className="req-surface-in space-y-3">
                {paginatedLowStock.map((item) => {
                  const available = item.available_quantity ?? item.quantity ?? 0;
                  const total = Math.max(item.quantity ?? 0, available);
                  const isOut = available === 0 || item.status === 'out_of_stock';
                  const ratio = clampRatio(available, Math.max(total, item.minimum_quantity ?? 1));
                  return (
                    <Link
                      key={item.id}
                      to={isOut ? '/items?stock=out' : '/items?stock=low'}
                      className="req-row-interactive block rounded-lg border p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {item.name}
                        </span>
                        {isOut ? (
                          <Badge variant="destructive" className="shrink-0 py-0.5 px-2 text-[11px]">
                            <PackageX className="mr-1 size-3" />
                            Out of Stock
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 py-0.5 px-2 text-[11px]"
                          >
                            Low Stock
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`req-progress-fill h-full w-full rounded-full ${
                            isOut ? 'bg-destructive' : 'bg-amber-500'
                          }`}
                          style={{ transform: `scaleX(${ratio})` }}
                        />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{item.category || 'General'}</span>
                        <span className="shrink-0 tabular-nums">
                          {available}/{total} avail
                          {typeof item.minimum_quantity === 'number'
                            ? ` (min ${item.minimum_quantity})`
                            : ''}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>

          {!inventoryLoading && !inventoryError && lowStockTotalPages > 1 && (
            <div className="border-t bg-muted/30 px-4 py-3">
              <PaginationWrapper
                currentPage={lowStockPage}
                totalPages={lowStockTotalPages}
                onPageChange={setLowStockPage}
                itemsCount={sortedLowStockItems.length}
                itemsPerPage={LOW_STOCK_PER_PAGE}
              />
            </div>
          )}
        </Card>

        {/* Card 3: Category Breakdown & 14-Day Borrowing Trend */}
        <Card data-testid="inventory-trend-card">
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-primary shrink-0" />
                <CardTitle className="text-base font-semibold">Category & Borrowing Trend</CardTitle>
              </div>
              <CardDescription className="text-xs sm:text-sm">
                Top stock categories and 14-day checkout flow
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="shrink-0 py-2 px-3 text-xs">
              <Link to="/reports">
                Full Reports
                <ArrowRight className="ml-1 size-3.5" />
              </Link>
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Top Categories */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Top Categories
              </h4>
              {inventoryLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-5 w-5/6" />
                  <Skeleton className="h-5 w-4/6" />
                </div>
              ) : inventoryError ? (
                <p className="text-xs text-muted-foreground">Category breakdown unavailable.</p>
              ) : topCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground">No inventory categories recorded yet.</p>
              ) : (
                <div className="req-surface-in space-y-3">
                  {topCategories.map((cat) => (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-foreground">{cat.name}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-muted-foreground">
                          {cat.count}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="req-progress-fill h-full w-full rounded-full bg-primary"
                          style={{ transform: `scaleX(${cat.ratio})` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 14-Day Borrowing vs. Return Trend */}
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Borrowing Activity (Last 14 Days)
              </h4>
              {trendLoading ? (
                <Skeleton className="h-44 w-full rounded-lg" data-testid="borrowing-trend-skeleton" />
              ) : trendError ? (
                <div
                  role="alert"
                  className="flex flex-col items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{trendError}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void fetchBorrowingTrend()}
                    className="shrink-0 py-1.5 px-3 text-xs"
                  >
                    <RefreshCw className="mr-1.5 size-3.5" />
                    Retry
                  </Button>
                </div>
              ) : trendData.length === 0 ? (
                <div className="flex h-32 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                  No borrowing activity recorded in this period
                </div>
              ) : (
                <div className="req-surface-in h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="borrowed"
                        name="Borrowed"
                        stroke="var(--chart-1)"
                        fill="var(--chart-1)"
                        fillOpacity={0.14}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                      <Area
                        type="monotone"
                        dataKey="returned"
                        name="Returned"
                        stroke="var(--chart-3)"
                        fill="var(--chart-3)"
                        fillOpacity={0.12}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
