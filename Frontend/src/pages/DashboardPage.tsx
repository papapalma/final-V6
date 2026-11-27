import { Link, useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Skeleton } from '../components/ui/skeleton';
import {
  Users,
  UserCheck,
  Award,
  FileText,
  TrendingUp,
  TrendingDown,
  UserPlus,
  PackagePlus,
  QrCode,
  BarChart,
  GraduationCap,
  CalendarClock,
  BookCheck,
  PackageCheck,
  Boxes,
  ClipboardCheck,
  ArrowLeftRight,
  ClipboardList,
  ArrowUpRight,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { dashboardLogger } from '../utils/activityLogger';
import reportService from '../services/reportService';
import activityLogService from '../services/activityLogService';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';
import TrainingStaffWorkspace from '../components/dashboard/TrainingStaffWorkspace';
import InventoryStaffWorkspace from '../components/dashboard/InventoryStaffWorkspace';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, hasPermission, isAuthReady } = useAuth();
  const isLocalAdmin = user?.role === 'local_admin';
  const isInventoryStaff = user?.role === 'staff_inventory_manager';
  const isTrainingStaff = user?.role === 'staff_training_coordinator';
  const [stats, setStats] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const rowsPerPage = 10;

  const totalActivityPages = Math.ceil(recentActivity.length / rowsPerPage);
  const activityStart = (activityPage - 1) * rowsPerPage;
  const paginatedRecentActivity = recentActivity.slice(activityStart, activityStart + rowsPerPage);

  // Redirect trainees to their own dashboard, super_admin to platform dashboard
  useEffect(() => {
    if (user?.role === 'trainee') {
      navigate('/trainee/dashboard', { replace: true });
    } else if (user?.role === 'super_admin') {
      navigate('/super-admin', { replace: true });
    }
  }, [user, navigate]);

  // Fetch dashboard data from backend
  useEffect(() => {
    if (!isAuthReady) {
      return;
    }

    dashboardLogger.viewed();
    fetchDashboardData();
  }, [isAuthReady]);

  useEffect(() => {
    setActivityPage(1);
  }, [recentActivity.length]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const shouldFetchActivity = !isTrainingStaff && !isInventoryStaff && hasPermission('canViewActivityLogs');
      const shouldFetchAnalytics = !isTrainingStaff && !isInventoryStaff;

      // Fire all independent dashboard requests in parallel (capped recent activity logs)
      const [statsResult, activityResult, analyticsResult] = await Promise.allSettled([
        reportService.getDashboardStats(),
        shouldFetchActivity ? activityLogService.getActivityLogs({ limit: 50 }) : Promise.resolve(null),
        shouldFetchAnalytics ? reportService.getActivityAnalytics() : Promise.resolve(null),
      ]);

      if (statsResult.status === 'rejected') {
        throw statsResult.reason;
      }

      const data = statsResult.value;

      // Map backend stats to clickable quick-navigation KPI cards
      const statsCards = [
        ...(!isInventoryStaff ? [{
          label: 'Active Trainees',
          value: data.trainees?.active || 0,
          trend: `${data.trainees?.total || 0} total`,
          trendUp: true,
          href: '/trainees?status=active',
          icon: UserCheck,
          gradient: 'bg-gradient-to-br from-blue-500/12 via-blue-500/4 to-transparent dark:from-blue-500/20 dark:via-blue-500/5 dark:to-transparent',
          border: 'border-blue-200/80 dark:border-blue-800/60',
          iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/25',
        }] : []),
        ...(isLocalAdmin ? [{
          label: 'Total Trainees',
          value: data.trainees?.total || 0,
          trend: `${data.trainees?.completed || 0} completed`,
          trendUp: true,
          href: '/trainees',
          icon: Users,
          gradient: 'bg-gradient-to-br from-cyan-500/12 via-cyan-500/4 to-transparent dark:from-cyan-500/20 dark:via-cyan-500/5 dark:to-transparent',
          border: 'border-cyan-200/80 dark:border-cyan-800/60',
          iconBg: 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-sm shadow-cyan-500/25',
        }, {
          label: 'Total Programs',
          value: data.programs?.total || 0,
          trend: `${data.programs?.ongoing || 0} active`,
          trendUp: true,
          href: '/programs',
          icon: GraduationCap,
          gradient: 'bg-gradient-to-br from-emerald-500/12 via-emerald-500/4 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/5 dark:to-transparent',
          border: 'border-emerald-200/80 dark:border-emerald-800/60',
          iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/25',
        }] : []),
        ...(!isTrainingStaff ? [{
          label: 'Available Items',
          value: data.inventory?.available || 0,
          trend: `${data.inventory?.total || 0} total`,
          trendUp: data.inventory?.available > data.inventory?.borrowed,
          href: '/items?stock=good',
          icon: PackageCheck,
          gradient: 'bg-gradient-to-br from-sky-500/12 via-sky-500/4 to-transparent dark:from-sky-500/20 dark:via-sky-500/5 dark:to-transparent',
          border: 'border-sky-200/80 dark:border-sky-800/60',
          iconBg: 'bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-sm shadow-sky-500/25',
        },
        {
          label: 'Active Borrowings',
          value: data.lending?.active || 0,
          trend: `${data.lending?.overdue || 0} overdue`,
          trendUp: false,
          href: '/lendings',
          icon: ClipboardCheck,
          gradient: 'bg-gradient-to-br from-indigo-500/12 via-indigo-500/4 to-transparent dark:from-indigo-500/20 dark:via-indigo-500/5 dark:to-transparent',
          border: 'border-indigo-200/80 dark:border-indigo-800/60',
          iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/25',
        }] : []),
        ...(isTrainingStaff ? [{
          label: 'Total Trainees',
          value: data.trainees?.total || 0,
          trend: `${data.trainees?.completed || 0} completed`,
          trendUp: true,
          href: '/trainees',
          icon: Users,
          gradient: 'bg-gradient-to-br from-cyan-500/12 via-cyan-500/4 to-transparent dark:from-cyan-500/20 dark:via-cyan-500/5 dark:to-transparent',
          border: 'border-cyan-200/80 dark:border-cyan-800/60',
          iconBg: 'bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-sm shadow-cyan-500/25',
        }, {
          label: 'Completed Trainees',
          value: data.trainees?.completed || 0,
          trend: `${data.trainees?.inactive || 0} inactive`,
          trendUp: true,
          href: '/trainees?status=completed',
          icon: Award,
          gradient: 'bg-gradient-to-br from-amber-500/12 via-amber-500/4 to-transparent dark:from-amber-500/20 dark:via-amber-500/5 dark:to-transparent',
          border: 'border-amber-200/80 dark:border-amber-800/60',
          iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm shadow-amber-500/25',
        }, {
          label: 'Active Programs',
          value: data.programs?.ongoing || 0,
          trend: `${data.programs?.total || 0} total`,
          trendUp: true,
          href: '/programs?status=active',
          icon: GraduationCap,
          gradient: 'bg-gradient-to-br from-emerald-500/12 via-emerald-500/4 to-transparent dark:from-emerald-500/20 dark:via-emerald-500/5 dark:to-transparent',
          border: 'border-emerald-200/80 dark:border-emerald-800/60',
          iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/25',
        }, {
          label: 'Upcoming Programs',
          value: data.programs?.upcoming || 0,
          trend: `${data.programs?.completed || 0} completed`,
          trendUp: true,
          href: '/programs?status=active',
          icon: CalendarClock,
          gradient: 'bg-gradient-to-br from-violet-500/12 via-violet-500/4 to-transparent dark:from-violet-500/20 dark:via-violet-500/5 dark:to-transparent',
          border: 'border-violet-200/80 dark:border-violet-800/60',
          iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-sm shadow-violet-500/25',
        }, {
          label: 'Completed Programs',
          value: data.programs?.completed || 0,
          trend: `${data.programs?.total || 0} total programs`,
          trendUp: true,
          href: '/programs?status=inactive',
          icon: BookCheck,
          gradient: 'bg-gradient-to-br from-rose-500/12 via-rose-500/4 to-transparent dark:from-rose-500/20 dark:via-rose-500/5 dark:to-transparent',
          border: 'border-rose-200/80 dark:border-rose-800/60',
          iconBg: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-sm shadow-rose-500/25',
        }] : []),
        ...(isInventoryStaff ? [{
          label: 'Overdue Returns',
          value: data.lending?.overdue || 0,
          trend: `${data.lending?.active || 0} active loans`,
          trendUp: (data.lending?.overdue || 0) === 0,
          href: '/lendings',
          icon: Clock,
          gradient: 'bg-gradient-to-br from-rose-500/12 via-rose-500/4 to-transparent dark:from-rose-500/20 dark:via-rose-500/5 dark:to-transparent',
          border: 'border-rose-200/80 dark:border-rose-800/60',
          iconBg: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white shadow-sm shadow-rose-500/25',
        }, {
          label: 'Low Stock Alerts',
          value: data.inventory?.lowStock || 0,
          trend: `${data.inventory?.borrowed || 0} units borrowed`,
          trendUp: (data.inventory?.lowStock || 0) === 0,
          href: '/items?stock=low',
          icon: AlertTriangle,
          gradient: 'bg-gradient-to-br from-amber-500/12 via-amber-500/4 to-transparent dark:from-amber-500/20 dark:via-amber-500/5 dark:to-transparent',
          border: 'border-amber-200/80 dark:border-amber-800/60',
          iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm shadow-amber-500/25',
        }, {
          label: 'Total Inventory Items',
          value: data.inventory?.total || 0,
          trend: `${data.inventory?.lowStock || 0} low stock`,
          trendUp: false,
          href: '/items',
          icon: Boxes,
          gradient: 'bg-gradient-to-br from-teal-500/12 via-teal-500/4 to-transparent dark:from-teal-500/20 dark:via-teal-500/5 dark:to-transparent',
          border: 'border-teal-200/80 dark:border-teal-800/60',
          iconBg: 'bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-sm shadow-teal-500/25',
        }] : [])
      ];

      setStats(statsCards);

      if (shouldFetchActivity) {
        if (activityResult.status === 'fulfilled') {
          const activityData = activityResult.value;
          if (activityData && activityData.length > 0) {
            setRecentActivity(activityData);
          }
        } else {
          logger.warn('Failed to fetch activity logs', { error: activityResult.reason });
        }
      }

      if (shouldFetchAnalytics) {
        if (analyticsResult.status === 'fulfilled') {
          const analytics = analyticsResult.value;
          if (analytics && Object.keys(analytics).length > 0) {
            const analyticsArray = [
              {
                category: 'Activity by Module',
                data: Object.entries(analytics.byModule || {}).map(([module, count]: [string, any]) => ({
                  label: module,
                  value: count,
                  percentage: ((count as number) / (analytics.totalActions || 1)) * 100,
                  color: 'bg-blue-500'
                }))
              },
              {
                category: 'Activity by Action',
                data: Object.entries(analytics.byAction || {}).map(([action, count]: [string, any]) => ({
                  label: action,
                  value: count,
                  percentage: ((count as number) / (analytics.totalActions || 1)) * 100,
                  color: 'bg-sky-500'
                }))
              }
            ];
            setAnalyticsData(analyticsArray);
          }
        } else {
          logger.warn('Failed to fetch analytics data', { error: analyticsResult.reason });
        }
      }

    } catch (error) {
      logger.error('Failed to fetch dashboard data', { error });
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const expectedKpiCount = isTrainingStaff ? 6 : 5;
  const kpiGridCols = isTrainingStaff
    ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-6'
    : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5';

  const quickActions = [
    ...(hasPermission('canManageTrainees') ? [{
      label: 'Add Trainee',
      href: '/trainees/new',
      icon: UserPlus,
      gradient: 'bg-gradient-to-br from-blue-500/14 via-blue-500/5 to-transparent dark:from-blue-500/22 dark:via-blue-500/6 dark:to-transparent',
      border: 'border-blue-200/80 dark:border-blue-800/60',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-500/25',
    }] : []),
    ...(hasPermission('canManageItems') ? [{
      label: 'Add Item',
      href: '/items/new',
      icon: PackagePlus,
      gradient: 'bg-gradient-to-br from-sky-500/14 via-sky-500/5 to-transparent dark:from-sky-500/22 dark:via-sky-500/6 dark:to-transparent',
      border: 'border-sky-200/80 dark:border-sky-800/60',
      iconBg: 'bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-sm shadow-sky-500/25',
    }] : []),
    ...(hasPermission('canManagePrograms') ? [{
      label: 'Add Program',
      href: '/programs/new',
      icon: GraduationCap,
      gradient: 'bg-gradient-to-br from-emerald-500/14 via-emerald-500/5 to-transparent dark:from-emerald-500/22 dark:via-emerald-500/6 dark:to-transparent',
      border: 'border-emerald-200/80 dark:border-emerald-800/60',
      iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm shadow-emerald-500/25',
    }] : []),
    ...(hasPermission('canManageLendings') ? [{
      label: 'Borrowing',
      href: '/lendings',
      icon: ArrowLeftRight,
      gradient: 'bg-gradient-to-br from-indigo-500/14 via-indigo-500/5 to-transparent dark:from-indigo-500/22 dark:via-indigo-500/6 dark:to-transparent',
      border: 'border-indigo-200/80 dark:border-indigo-800/60',
      iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-sm shadow-indigo-500/25',
    }] : []),
    ...(hasPermission('canManageTrainees') ? [{
      label: 'Registrations',
      href: '/registrations',
      icon: ClipboardList,
      gradient: 'bg-gradient-to-br from-violet-500/14 via-violet-500/5 to-transparent dark:from-violet-500/22 dark:via-violet-500/6 dark:to-transparent',
      border: 'border-violet-200/80 dark:border-violet-800/60',
      iconBg: 'bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-sm shadow-violet-500/25',
    }] : []),
    ...(hasPermission('canScanQR') ? [{
      label: 'Scan QR',
      href: '/scan',
      icon: QrCode,
      gradient: 'bg-gradient-to-br from-amber-500/14 via-amber-500/5 to-transparent dark:from-amber-500/22 dark:via-amber-500/6 dark:to-transparent',
      border: 'border-amber-200/80 dark:border-amber-800/60',
      iconBg: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-sm shadow-amber-500/25',
    }] : []),
  ];

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h2>Welcome back!</h2>
          <p className="text-muted-foreground">Here's what's happening with your training center today.</p>
        </div>

        {/* KPI Quick-Navigation Cards - Compact single-row desktop grid */}
        <div className={`grid gap-3 ${kpiGridCols}`}>
          {loading && stats.length === 0
            ? Array.from({ length: expectedKpiCount }).map((_, idx) => (
                <Card
                  key={`kpi-skeleton-${idx}`}
                  data-testid="kpi-skeleton-card"
                  className="h-full justify-between gap-3 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="size-9 shrink-0 rounded-lg" />
                  </div>
                  <div>
                    <Skeleton className="h-9 w-16" />
                    <Skeleton className="mt-2 h-3.5 w-20" />
                  </div>
                </Card>
              ))
            : stats.map((stat) => (
                <Link
                  key={stat.label}
                  to={stat.href}
                  className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card
                    interactive
                    className={`h-full justify-between gap-3 p-4 ${stat.gradient} ${stat.border}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-snug line-clamp-1">
                        {stat.label}
                      </span>
                      <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${stat.iconBg}`}>
                        <stat.icon className="size-4" />
                      </div>
                    </div>
                    <div>
                      <p
                        data-testid={`kpi-value-${stat.label}`}
                        className="app-display text-4xl xl:text-[2.5rem] font-extrabold leading-none tracking-tight tabular-nums text-foreground"
                      >
                        {Number(stat.value ?? 0).toLocaleString()}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-1 text-xs">
                          {stat.trendUp ? (
                            <TrendingUp className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <TrendingDown className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                          )}
                          <span className="truncate font-semibold tabular-nums text-foreground/80">
                            {stat.trend}
                          </span>
                        </div>
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground/70 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
        </div>

        {/* Quick Actions - Compact Single-Row Gradient Tiles */}
        {quickActions.length > 0 && (
          <section aria-labelledby="quick-actions-heading">
            <div className="mb-3">
              <h3 id="quick-actions-heading" className="text-base font-semibold leading-snug text-foreground">
                Quick Actions
              </h3>
              <p className="text-xs text-muted-foreground">Frequently used shortcuts</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  to={action.href}
                  className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card
                    interactive
                    className={`h-full flex-row items-center gap-3 py-2.5 px-4 ${action.gradient} ${action.border}`}
                  >
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${action.iconBg}`}>
                      <action.icon className="size-4" />
                    </div>
                    <span className="min-w-0 truncate text-xs sm:text-sm font-semibold text-foreground">
                      {action.label}
                    </span>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Role-Specific Operational Workspaces (Golden Ratio 62/38 Split) */}
        {isTrainingStaff && <TrainingStaffWorkspace />}
        {isInventoryStaff && <InventoryStaffWorkspace />}

        {/* Recent Activity - Desktop Table */}
        {!isTrainingStaff && !isInventoryStaff && <Card className="hidden md:block">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system activity and changes</CardDescription>
          </CardHeader>
          {recentActivity.length > 0 ? (
            <>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecentActivity.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell>{activity.userName}</TableCell>
                        <TableCell>{activity.action}</TableCell>
                        <TableCell>{activity.module}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(activity.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {activity.description}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
              {totalActivityPages > 1 && (
                <div className="border-t px-6 py-3 bg-muted/30">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-xs text-muted-foreground">
                      Page {activityPage} of {totalActivityPages} • Showing {paginatedRecentActivity.length} of {recentActivity.length} entries
                    </div>
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setActivityPage(prev => Math.max(1, prev - 1))}
                            className={activityPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            size={undefined}
                          />
                        </PaginationItem>

                        {Array.from({ length: totalActivityPages }, (_, i) => i + 1).map((page) => {
                          if (
                            page === 1 ||
                            page === totalActivityPages ||
                            (page >= activityPage - 1 && page <= activityPage + 1)
                          ) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  onClick={() => setActivityPage(page)}
                                  isActive={activityPage === page}
                                  className="cursor-pointer"
                                  size={undefined}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            );
                          }

                          if (page === activityPage - 2 || page === activityPage + 2) {
                            return (
                              <PaginationItem key={page}>
                                <PaginationEllipsis />
                              </PaginationItem>
                            );
                          }

                          return null;
                        })}

                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setActivityPage(prev => Math.min(totalActivityPages, prev + 1))}
                            className={activityPage === totalActivityPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                            size={undefined}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                </div>
              )}
            </>
          ) : (
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="mb-4 size-12 text-muted-foreground" />
              <p className="text-muted-foreground">No recent activity</p>
            </CardContent>
          )}
        </Card>}

        {/* Recent Activity - Mobile Cards */}
        {!isInventoryStaff && !isTrainingStaff && <div className="md:hidden">
          <div className="mb-3 flex items-center justify-between">
            <h3>Recent Activity</h3>
            <Link to="/lendings">
              <Button variant="ghost" size="sm">View All</Button>
            </Link>
          </div>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((activity) => (
                <Card key={activity.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="mb-1 font-medium">{activity.userName}</p>
                        <p className="text-sm text-muted-foreground mb-2">{activity.description}</p>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {activity.module}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(activity.createdAt).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <FileText className="mb-4 size-12 text-muted-foreground" />
                  <p className="text-muted-foreground">No recent activity</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>}

        {/* Analytics Section */}
        {!isInventoryStaff && !isTrainingStaff && (analyticsData.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {analyticsData.map((category) => (
              <Card key={category.category}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardDescription>{category.category}</CardDescription>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                    <BarChart className="size-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {category.data.map((item: any) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${item.color}`} />
                          <p className="text-sm">{item.label}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="app-display text-base sm:text-lg font-bold tabular-nums text-foreground">
                            {Number(item.value ?? 0).toLocaleString()}
                          </span>
                          <Progress value={item.percentage} className="h-2 w-24" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart className="mb-4 size-12 text-muted-foreground" />
              <p className="text-muted-foreground">No analytics data available</p>
              <p className="text-sm text-muted-foreground mt-2">Analytics will appear as you add trainees, items, and programs</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}