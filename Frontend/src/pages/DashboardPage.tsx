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
import { Users, Package, FileText, TrendingUp, TrendingDown, UserPlus, PackagePlus, QrCode, BarChart, GraduationCap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { dashboardLogger } from '../utils/activityLogger';
import reportService from '../services/reportService';
import activityLogService from '../services/activityLogService';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import logger from '../utils/logger';

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
  const [, setLoading] = useState(true);
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

      const shouldFetchActivity = !isTrainingStaff && hasPermission('canViewActivityLogs');
      const shouldFetchAnalytics = !isTrainingStaff;

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

      // Map backend stats to cards
      const statsCards = [
        ...(!isInventoryStaff ? [{
          label: 'Active Trainees',
          value: data.trainees?.active || 0,
          trend: `${data.trainees?.total || 0} total`,
          trendUp: true,
          icon: Users,
          bg: 'bg-blue-500/10 dark:bg-blue-950/40',
          color: 'text-blue-600 dark:text-blue-400'
        }] : []),
        ...(isLocalAdmin ? [{
          label: 'Total Trainees',
          value: data.trainees?.total || 0,
          trend: `${data.trainees?.completed || 0} completed`,
          trendUp: true,
          icon: Users,
          bg: 'bg-cyan-500/10 dark:bg-cyan-950/40',
          color: 'text-cyan-600 dark:text-cyan-400'
        }, {
          label: 'Total Programs',
          value: data.programs?.total || 0,
          trend: `${data.programs?.ongoing || 0} active`,
          trendUp: true,
          icon: GraduationCap,
          bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
          color: 'text-emerald-600 dark:text-emerald-400'
        }] : []),
        ...(!isTrainingStaff ? [{
          label: 'Available Items',
          value: data.inventory?.available || 0,
          trend: `${data.inventory?.total || 0} total`,
          trendUp: data.inventory?.available > data.inventory?.borrowed,
          icon: Package,
          bg: 'bg-sky-500/10 dark:bg-sky-950/40',
          color: 'text-sky-600 dark:text-sky-400'
        },
        {
          label: 'Active Borrowings',
          value: data.lending?.active || 0,
          trend: `${data.lending?.overdue || 0} overdue`,
          trendUp: false,
          icon: FileText,
          bg: 'bg-indigo-500/10 dark:bg-indigo-950/40',
          color: 'text-indigo-600 dark:text-indigo-400'
        }] : []),
        ...(isTrainingStaff ? [{
          label: 'Total Trainees',
          value: data.trainees?.total || 0,
          trend: `${data.trainees?.completed || 0} completed`,
          trendUp: true,
          icon: Users,
          bg: 'bg-cyan-500/10 dark:bg-cyan-950/40',
          color: 'text-cyan-600 dark:text-cyan-400'
        }, {
          label: 'Completed Trainees',
          value: data.trainees?.completed || 0,
          trend: `${data.trainees?.inactive || 0} inactive`,
          trendUp: true,
          icon: Users,
          bg: 'bg-amber-500/10 dark:bg-amber-950/40',
          color: 'text-amber-600 dark:text-amber-400'
        }, {
          label: 'Active Programs',
          value: data.programs?.ongoing || 0,
          trend: `${data.programs?.total || 0} total`,
          trendUp: true,
          icon: GraduationCap,
          bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
          color: 'text-emerald-600 dark:text-emerald-400'
        }, {
          label: 'Upcoming Programs',
          value: data.programs?.upcoming || 0,
          trend: `${data.programs?.completed || 0} completed`,
          trendUp: true,
          icon: GraduationCap,
          bg: 'bg-violet-500/10 dark:bg-violet-950/40',
          color: 'text-violet-600 dark:text-violet-400'
        }, {
          label: 'Completed Programs',
          value: data.programs?.completed || 0,
          trend: `${data.programs?.total || 0} total programs`,
          trendUp: true,
          icon: GraduationCap,
          bg: 'bg-rose-500/10 dark:bg-rose-950/40',
          color: 'text-rose-600 dark:text-rose-400'
        }] : []),
        ...(isInventoryStaff ? [{
          label: 'Total Inventory Items',
          value: data.inventory?.total || 0,
          trend: `${data.inventory?.lowStock || 0} low stock`,
          trendUp: false,
          icon: Package,
          bg: 'bg-emerald-500/10 dark:bg-emerald-950/40',
          color: 'text-emerald-600 dark:text-emerald-400'
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

  return (
    <DashboardLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome Section */}
        <div>
          <h2>Welcome back!</h2>
          <p className="text-muted-foreground">Here's what's happening with your training center today.</p>
        </div>

        {/* KPI Cards - Desktop 3-column, Mobile single column */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription>{stat.label}</CardDescription>
                <div className={`flex size-10 items-center justify-center rounded-lg ${stat.bg}`}>
                  <stat.icon className={`size-5 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-2">
                  <h1>{stat.value}</h1>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {stat.trendUp ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                    <span>{stat.trend}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions - Desktop */}
        <div className="hidden sm:block">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Frequently used operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-3 ${isTrainingStaff || isInventoryStaff ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                {!isInventoryStaff && <Link to="/trainees/new">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
                    <UserPlus className="size-6" />
                    Add Trainee
                  </Button>
                </Link>}
                {!isTrainingStaff && <Link to="/items/new">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
                    <PackagePlus className="size-6" />
                    Add Item
                  </Button>
                </Link>}
                {isTrainingStaff && <Link to="/programs/new">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
                    <GraduationCap className="size-6" />
                    Add Program
                  </Button>
                </Link>}
                <Link to="/scan">
                  <Button variant="outline" className="h-auto w-full flex-col gap-2 py-4">
                    <QrCode className="size-6" />
                    Scan QR
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions - Mobile (2-Column Grid) */}
        <div className="sm:hidden">
          <div className="mb-3">
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Frequently used operations</CardDescription>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!isInventoryStaff && <Link to="/trainees/new" className="block h-full">
              <Card className="h-full transition-colors active:bg-muted">
                <CardContent className="flex min-h-24 flex-col items-center justify-center gap-2 p-3 text-center">
                  <UserPlus className="size-5" />
                  <span className="text-xs font-medium">Add Trainee</span>
                </CardContent>
              </Card>
            </Link>}
            {!isTrainingStaff && <Link to="/items/new" className="block h-full">
              <Card className="h-full transition-colors active:bg-muted">
                <CardContent className="flex min-h-24 flex-col items-center justify-center gap-2 p-3 text-center">
                  <PackagePlus className="size-5" />
                  <span className="text-xs font-medium">Add Item</span>
                </CardContent>
              </Card>
            </Link>}
            {isTrainingStaff && <Link to="/programs/new" className="block h-full">
              <Card className="h-full transition-colors active:bg-muted">
                <CardContent className="flex min-h-24 flex-col items-center justify-center gap-2 p-3 text-center">
                  <GraduationCap className="size-5" />
                  <span className="text-xs font-medium">Add Program</span>
                </CardContent>
              </Card>
            </Link>}
            <Link to="/scan" className="block h-full">
              <Card className="h-full transition-colors active:bg-muted">
                <CardContent className="flex min-h-24 flex-col items-center justify-center gap-2 p-3 text-center">
                  <QrCode className="size-5" />
                  <span className="text-xs font-medium">Scan QR</span>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>

        {/* Recent Activity - Desktop Table */}
        {!isTrainingStaff && <Card className="hidden md:block">
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
                        <div className="flex items-center gap-2">
                          <p className="text-sm">{item.value}</p>
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