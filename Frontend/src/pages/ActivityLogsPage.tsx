import { useState, useMemo, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
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
import { toast } from 'sonner';
import activityLogService, { type ActivityLog } from '../services/activityLogService';
import logger from '../utils/logger';
import {
  Activity,
  Download,
  Filter,
  Trash2,
  Search,
  User,
  TrendingUp,
  Eye,
  Edit,
  Plus,
  X,
  LogIn,
  LogOut,
  ScanLine,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { StatCardsSkeleton, TableSkeleton } from '../components/LoadingSkeletons';
import { Skeleton } from '../components/ui/skeleton';

const actionIcons: Record<string, any> = {
  create: Plus,
  update: Edit,
  delete: X,
  view: Eye,
  search: Search,
  filter: Filter,
  export: Download,
  login: LogIn,
  logout: LogOut,
  scan: ScanLine,
  upload: Upload,
  download: Download,
  borrow: ScanLine,
  return: Upload,
};

const actionColors: Record<string, string> = {
  create: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  update: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  delete: 'bg-red-500/10 text-red-500 border-red-500/20',
  view: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  search: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  filter: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  export: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  login: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  logout: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
  scan: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  upload: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
  download: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  borrow: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
  return: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
};

const moduleColors: Record<string, string> = {
  Trainees: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  Inventory: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  Programs: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
  Lendings: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
  Authentication: 'bg-red-500/10 text-red-700 dark:text-red-300',
  Users: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
};

export default function ActivityLogsPage() {
  const { hasPermission, user } = useAuth();
  
  if (!hasPermission('canViewActivityLogs')) {
    return <Navigate to="/" state={{ openLogin: true }} replace />;
  }
  
  const isSuperAdmin = user?.role === 'super_admin';
  
  const [allLogs, setAllLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<string>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  // Fetch logs from API
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const logs = await activityLogService.getActivityLogs({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setAllLogs(logs);
    } catch (error) {
      logger.error('Failed to fetch activity logs', { error });
      toast.error('Failed to load activity logs');
      setAllLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Refresh logs
  const handleRefresh = () => {
    fetchLogs();
    toast.success('Activity logs refreshed');
  };

  // Calculate stats from fetched logs
  const stats = useMemo(() => {
    const totalActions = allLogs.length;
    const uniqueUsers = new Set(allLogs.map(log => log.userId)).size;
    const actionsByModule: Record<string, number> = {};
    
    allLogs.forEach(log => {
      const module = log.module || 'Unknown';
      actionsByModule[module] = (actionsByModule[module] || 0) + 1;
    });

    return {
      totalActions,
      uniqueUsers,
      actionsByModule,
      recentActivity: allLogs.slice(0, 10),
    };
  }, [allLogs]);

  // Get unique users for filter
  const uniqueUsers = useMemo(() => {
    const users = new Set(allLogs.map(log => log.userName).filter(Boolean));
    return Array.from(users).sort();
  }, [allLogs]);

  // Get unique actions for filter
  const uniqueActions = useMemo(() => {
    const actions = new Set(allLogs.map(log => log.action).filter(Boolean));
    return Array.from(actions).sort();
  }, [allLogs]);

  // Get unique modules for filter
  const uniqueModules = useMemo(() => {
    const modules = new Set(allLogs.map(log => log.module).filter(Boolean));
    return Array.from(modules).sort();
  }, [allLogs]);

  // Get unique tenants for filter (Super Admin only)
  const uniqueTenants = useMemo(() => {
    if (!isSuperAdmin) return [];
    // Use Map to deduplicate by tenant ID
    const tenantMap = new Map<string, string>();
    allLogs.forEach(log => {
      if (log.tenantId && log.tenantName) {
        tenantMap.set(log.tenantId, log.tenantName);
      }
    });
    return Array.from(tenantMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allLogs, isSuperAdmin]);

  // Filter logs client-side
  const filteredLogs = useMemo(() => {
    return allLogs.filter(log => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchableText = `${log.userName} ${log.action} ${log.module} ${log.description} ${log.tenantName || ''}`.toLowerCase();
        if (!searchableText.includes(query)) return false;
      }

      // Action filter
      if (selectedAction !== 'all' && log.action !== selectedAction) {
        return false;
      }

      // Module filter
      if (selectedModule !== 'all' && log.module !== selectedModule) {
        return false;
      }

      // User filter  
      if (selectedUser !== 'all' && log.userName !== selectedUser) {
        return false;
      }

      // Tenant filter (Super Admin only)
      if (isSuperAdmin && selectedTenant !== 'all') {
        if (selectedTenant === 'platform') {
          if (log.scope !== 'platform') return false;
        } else {
          if (log.tenantId !== selectedTenant) return false;
        }
      }

      // Scope filter (Super Admin only)
      if (isSuperAdmin && selectedScope !== 'all') {
        if (log.scope !== selectedScope) return false;
      }

      // Date filters
      if (startDate && new Date(log.createdAt) < new Date(startDate)) {
        return false;
      }

      if (endDate && new Date(log.createdAt) > new Date(endDate + 'T23:59:59')) {
        return false;
      }

      return true;
    });
  }, [allLogs, searchQuery, selectedAction, selectedModule, selectedUser, selectedTenant, selectedScope, startDate, endDate, isSuperAdmin]);

  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const paginatedFilteredLogs = filteredLogs.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedAction, selectedModule, selectedUser, selectedTenant, selectedScope, startDate, endDate]);

  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Logs exported to JSON');
    } catch (error) {
      toast.error('Failed to export logs');
    }
  };

  const handleExportCSV = () => {
    try {
      // Create CSV header
      const headers = ['Timestamp', 'User', 'Action', 'Module', 'Description', 'Entity Type', 'Entity ID'];
      const csvRows = [headers.join(',')];

      // Add data rows
      filteredLogs.forEach(log => {
        const row = [
          log.createdAt,
          log.userName,
          log.action,
          log.module,
          `"${log.description?.replace(/"/g, '""') || ''}"`,
          log.entityType || '',
          log.entityId || '',
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = csvRows.join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Logs exported to CSV');
    } catch (error) {
      toast.error('Failed to export logs');
    }
  };

  const handleClearAllLogs = () => {
    toast.info('Clear all logs feature requires backend implementation');
  };

  const handleClearOldLogs = () => {
    toast.info('Clear old logs feature requires backend implementation');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAction('all');
    setSelectedModule('all');
    setSelectedUser('all');
    setSelectedTenant('all');
    setSelectedScope('all');
    setStartDate('');
    setEndDate('');
  };

  if (loading) {
    return (
      <DashboardLayout title="Activity Logs">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          <StatCardsSkeleton count={4} />

          <div className="flex gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 flex-1" />
            ))}
          </div>

          <TableSkeleton rows={7} />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Activity Logs">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-3 md:gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl md:text-2xl font-bold">Activity Logs</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isSuperAdmin 
                  ? 'Monitor all system activities across all tenants' 
                  : 'Monitor all system activities and user actions'}
              </p>
            </div>
            {isSuperAdmin && (
              <Badge className="w-fit bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                Platform-Wide View
              </Badge>
            )}
          </div>
          
          {/* Action Buttons - Grid on Mobile, Flex on Desktop */}
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading} className="w-full sm:w-auto text-xs sm:text-sm h-9">
              <RefreshCw className={`size-3 sm:size-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline ml-1">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="w-full sm:w-auto text-xs sm:text-sm h-9">
              <Download className="size-3 sm:size-4" />
              <span className="ml-1">CSV</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportJSON} className="w-full sm:w-auto text-xs sm:text-sm h-9">
              <Download className="size-3 sm:size-4" />
              <span className="ml-1">JSON</span>
            </Button>
            {hasPermission('canManageSettings') && (
              <>
                <Button variant="outline" size="sm" onClick={handleClearOldLogs} className="hidden md:inline-flex text-xs sm:text-sm h-9">
                  <Trash2 className="size-3 sm:size-4" />
                  <span className="ml-1">Clear Old</span>
                </Button>
                <Button variant="destructive" size="sm" onClick={handleClearAllLogs} className="hidden md:inline-flex text-xs sm:text-sm h-9">
                  <Trash2 className="size-3 sm:size-4" />
                  <span className="ml-1">Clear All</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="p-3 md:p-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs font-medium">Total Activities</CardTitle>
              <Activity className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg md:text-2xl font-bold">{stats.totalActions.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card className="p-3 md:p-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs font-medium">Unique Users</CardTitle>
              <User className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg md:text-2xl font-bold">{stats.uniqueUsers}</div>
              <p className="text-xs text-muted-foreground">Active users</p>
            </CardContent>
          </Card>

          <Card className="p-3 md:p-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs font-medium">Filtered Results</CardTitle>
              <Filter className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg md:text-2xl font-bold">{filteredLogs.length}</div>
              <p className="text-xs text-muted-foreground">Matching filters</p>
            </CardContent>
          </Card>

          <Card className="p-3 md:p-6">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-0">
              <CardTitle className="text-xs font-medium">Top Module</CardTitle>
              <TrendingUp className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <div className="text-lg md:text-2xl font-bold truncate">
                {Object.entries(stats.actionsByModule).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">Most active</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-full text-sm"
            />
          </div>
          
          {/* Filter Selects - Mobile Stacked, Desktop Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            <Select value={selectedAction} onValueChange={(value: any) => setSelectedAction(value)}>
              <SelectTrigger className="w-full text-xs sm:text-sm">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action, idx) => (
                  <SelectItem key={`action-${idx}-${action}`} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedModule} onValueChange={(value: any) => setSelectedModule(value)}>
              <SelectTrigger className="w-full text-xs sm:text-sm">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {uniqueModules.map((module, idx) => (
                  <SelectItem key={`module-${idx}-${module}`} value={module}>{module}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-full text-xs sm:text-sm">
                <SelectValue placeholder="User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {uniqueUsers.map((user, idx) => (
                  <SelectItem key={`user-${idx}-${user}`} value={user}>{user}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isSuperAdmin && (
              <>
                <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                  <SelectTrigger className="w-full text-xs sm:text-sm">
                    <SelectValue placeholder="Tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tenants</SelectItem>
                    <SelectItem value="platform">Platform-Level</SelectItem>
                    {uniqueTenants.map((tenant, idx) => (
                      <SelectItem key={`tenant-${idx}-${tenant.id}`} value={tenant.id}>{tenant.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedScope} onValueChange={setSelectedScope}>
                  <SelectTrigger className="w-full text-xs sm:text-sm">
                    <SelectValue placeholder="Scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scopes</SelectItem>
                    <SelectItem value="platform">Platform-Level</SelectItem>
                    <SelectItem value="tenant">Tenant-Specific</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Date Filters and Reset - Mobile Stacked, Desktop Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full text-xs sm:text-sm"
              title="Start date"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full text-xs sm:text-sm"
              title="End date"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleResetFilters} 
              title="Reset all filters"
              className="w-full text-xs sm:text-sm"
            >
              <X className="size-3 sm:size-4 mr-1" />
              <span>Reset</span>
            </Button>
          </div>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg md:text-xl">Activity History</CardTitle>
            <CardDescription className="text-xs">Detailed log of all user activities</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden md:block rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Timestamp</TableHead>
                    {isSuperAdmin && <TableHead className="text-xs">Scope</TableHead>}
                    {isSuperAdmin && <TableHead className="text-xs">Tenant</TableHead>}
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Module</TableHead>
                    <TableHead className="text-xs">User</TableHead>
                    <TableHead className="text-xs">Entity Type</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isSuperAdmin ? 9 : 7} className="h-24 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Activity className="size-8 text-muted-foreground" />
                          <p className="text-muted-foreground text-sm">No activity logs found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedFilteredLogs.map((log) => {
                      const ActionIcon = actionIcons[log.action] || Activity;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {format(new Date(log.createdAt), 'MMM dd HH:mm')}
                          </TableCell>
                          {isSuperAdmin && (
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                              >
                                {log.scope === 'platform' ? '🌐' : '🏢'}
                              </Badge>
                            </TableCell>
                          )}
                          {isSuperAdmin && (
                            <TableCell className="text-xs max-w-[100px] truncate">
                              {log.tenantName || '—'}
                            </TableCell>
                          )}
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${actionColors[log.action] || 'bg-gray-500/10 text-gray-500'}`}>
                              <ActionIcon className="mr-1 size-3" />
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${moduleColors[log.module] || 'bg-gray-500/10 text-gray-700'}`}>
                              {log.module}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{log.userName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{log.entityType || '—'}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{log.description}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                              className="h-8 w-8 p-0"
                            >
                              <Eye className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile List View - Scrollable list of all logs */}
            <div className="md:hidden space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <Activity className="size-8 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">No activity logs found</p>
                </div>
              ) : (
                paginatedFilteredLogs.map((log, idx) => {
                  const ActionIcon = actionIcons[log.action] || Activity;
                  return (
                    <button
                      key={`log-${idx}-${log.action}`}
                      onClick={() => setSelectedLog(log)}
                      className="w-full text-left bg-card border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                    >
                      {/* Action and Module */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={`text-xs whitespace-nowrap ${actionColors[log.action] || 'bg-gray-500/10 text-gray-500'}`}
                        >
                          <ActionIcon className="mr-1 size-3" />
                          {log.action}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={`text-xs whitespace-nowrap ${moduleColors[log.module] || 'bg-gray-500/10 text-gray-700'}`}
                        >
                          {log.module}
                        </Badge>
                      </div>

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground mb-1">
                        {format(new Date(log.createdAt), 'PPp')}
                      </p>

                      {/* User - shown only */}
                      <p className="text-sm font-medium">{log.userName}</p>
                    </button>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-center text-xs text-muted-foreground sm:text-left">
                  Showing {startIndex + 1} to {Math.min(startIndex + rowsPerPage, filteredLogs.length)} of {filteredLogs.length} logs
                </p>
                <Pagination className="w-full sm:w-auto">
                  <PaginationContent className="flex-wrap justify-center gap-1 sm:justify-end">
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {/* Show page numbers */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      // Show first page, last page, current page, and adjacent pages
                      if (
                        page === 1 ||
                        page === totalPages ||
                        page === currentPage ||
                        page === currentPage - 1 ||
                        page === currentPage + 1
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }
                      
                      // Show ellipsis for skipped pages
                      if (
                        (page === currentPage - 2) ||
                        (page === currentPage + 2)
                      ) {
                        return (
                          <PaginationItem key={`ellipsis-${page}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      
                      return null;
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Log Details Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 md:p-4">
            <Card className="max-h-[90vh] w-full max-w-sm md:max-w-md overflow-y-auto rounded-lg">
              <CardHeader className="sticky top-0 bg-background border-b py-3 px-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base md:text-lg">Activity Details</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedLog(null)} className="h-8 w-8 p-0 flex-shrink-0">
                    <X className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 p-3 md:p-4">
                <div className="grid gap-2 grid-cols-1">
                  <div>
                    <Label className="text-muted-foreground text-xs font-medium">Timestamp</Label>
                    <p className="font-mono text-xs mt-0.5">
                      {format(new Date(selectedLog.createdAt), 'PPpp')}
                    </p>
                  </div>
                  {isSuperAdmin && (
                    <div>
                      <Label className="text-muted-foreground text-xs font-medium">Scope</Label>
                      <div className="mt-1">
                        <Badge 
                          variant="outline" 
                          className={
                            selectedLog.scope === 'platform'
                              ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20'
                              : 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20'
                          }
                        >
                          {selectedLog.scope === 'platform' ? '🌐 Platform-Level' : '🏢 Tenant-Specific'}
                        </Badge>
                      </div>
                    </div>
                  )}
                  {isSuperAdmin && selectedLog.tenantName && (
                    <div>
                      <Label className="text-muted-foreground text-xs font-medium">Tenant</Label>
                      <p className="text-xs mt-0.5">{selectedLog.tenantName}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-muted-foreground text-xs font-medium">Action</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className={actionColors[selectedLog.action] || 'bg-gray-500/10'}>
                        {selectedLog.action}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs font-medium">Module</Label>
                    <div className="mt-1">
                      <Badge variant="outline" className={moduleColors[selectedLog.module] || 'bg-gray-500/10'}>
                        {selectedLog.module}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs font-medium">User</Label>
                    <p className="text-xs mt-0.5">{selectedLog.userName}</p>
                  </div>
                  {selectedLog.userId && (
                    <div>
                      <Label className="text-muted-foreground text-xs font-medium">User ID</Label>
                      <p className="font-mono text-xs mt-1 break-all">{selectedLog.userId}</p>
                    </div>
                  )}
                  {selectedLog.entityType && (
                    <div>
                      <Label className="text-muted-foreground text-xs font-medium">Entity Type</Label>
                      <p className="text-xs mt-0.5">{selectedLog.entityType}</p>
                    </div>
                  )}
                  {selectedLog.entityId && (
                    <div>
                      <Label className="text-muted-foreground text-xs font-medium">Entity ID</Label>
                      <p className="font-mono text-xs mt-1 break-all">{selectedLog.entityId}</p>
                    </div>
                  )}
                  {selectedLog.ipAddress && (
                    <div>
                      <Label className="text-muted-foreground text-xs font-medium">IP Address</Label>
                      <p className="font-mono text-xs mt-0.5">{selectedLog.ipAddress}</p>
                    </div>
                  )}
                </div>

                {selectedLog.description && (
                  <div>
                    <Label className="text-muted-foreground text-xs font-medium">Description</Label>
                    <p className="text-xs mt-1 whitespace-pre-wrap break-words">{selectedLog.description}</p>
                  </div>
                )}

                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                  <div>
                    <Label className="text-muted-foreground text-xs font-medium">Metadata</Label>
                    <pre className="mt-1 rounded-md bg-muted p-2 text-xs overflow-x-auto max-h-[150px]">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.userAgent && (
                  <div>
                    <Label className="text-muted-foreground text-xs font-medium">User Agent</Label>
                    <p className="text-xs mt-1 font-mono break-words bg-muted p-2 rounded">{selectedLog.userAgent}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

