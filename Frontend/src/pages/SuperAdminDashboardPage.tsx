import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { PaginationWrapper } from '../components/PaginationWrapper';
import {
  Building2,
  Plus,
  Users,
  GraduationCap,
  Package,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  ClipboardList,
  Shield,
  RefreshCw,
  ExternalLink,
  Clock,
  Eye,
  Rocket,
  AlertTriangle,
  Search,
  LayoutGrid,
  TableIcon,
  Phone,
  MapPin,
  Mail,
  CalendarDays,
} from 'lucide-react';
import { toast } from 'sonner';
import tenantService, { Tenant, CreateTenantData, PlatformSummary } from '../services/tenantService';
import api from '../services/api';
import logger from '../utils/logger';

// ---------------------------------------------------------------------------
// View mode persistence
// ---------------------------------------------------------------------------
type ViewMode = 'table' | 'card';
const VIEW_MODE_KEY = 'superAdminTenantsViewMode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
  user?: { id: string; email: string; username: string; role: string } | null;
}

interface ExtensionRequest {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'submitted' | 'under_review' | 'approved' | 'in_development' | 'deployed' | 'rejected';
  created_at: string;
  tenant?: { name: string } | null;
  requested_by_user?: { username: string; email: string } | null;
}

interface LocalAdminAccount {
  id: string;
  email: string;
  username: string;
  role: string;
  created_at: string;
  updated_at: string;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_status: string | null;
  tenant_contact_email: string | null;
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PRIORITY_COLOR: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_COLOR: Record<string, string> = {
  submitted: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  approved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  in_development: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  deployed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  in_development: 'In Development',
  deployed: 'Deployed',
  rejected: 'Rejected',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SuperAdminDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect non-super_admin users
  useEffect(() => {
    if (user && user.role !== 'super_admin') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // ── Tenants ──────────────────────────────────────────────────────────────
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantSort, setTenantSort] = useState<string>('name-asc');
  const [tenantsViewMode, setTenantsViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'table';
  });
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantDetailOpen, setTenantDetailOpen] = useState(false);

  // ── Platform summary ─────────────────────────────────────────────────────
  const [platformSummary, setPlatformSummary] = useState<PlatformSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  // ── Audit logs ───────────────────────────────────────────────────────────
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(true);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const AUDIT_LIMIT = 20;

  // ── Extension requests ───────────────────────────────────────────────────
  const [extRequests, setExtRequests] = useState<ExtensionRequest[]>([]);
  const [loadingExt, setLoadingExt] = useState(true);
  const [extTotal, setExtTotal] = useState(0);
  const [extSearch, setExtSearch] = useState('');
  const [extStatusFilter, setExtStatusFilter] = useState<string>('all');
  const [extPriorityFilter, setExtPriorityFilter] = useState<string>('all');
  const [extSort, setExtSort] = useState<string>('date-newest');

  // ── Create tenant dialog ─────────────────────────────────────────────────
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<CreateTenantData>({
    name: '', contactEmail: '', contactPhone: '', address: '',
    adminEmail: '', adminUsername: '', adminPassword: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchTenants = useCallback(async () => {
    try {
      setLoadingTenants(true);
      const response = await tenantService.getTenants();
      setTenants(response.data || []);
    } catch (error) {
      logger.error('Failed to fetch tenants', { error });
      toast.error('Failed to load tenants');
    } finally {
      setLoadingTenants(false);
    }
  }, []);

  const fetchPlatformSummary = useCallback(async () => {
    try {
      setLoadingSummary(true);
      const summary = await tenantService.getPlatformSummary();
      setPlatformSummary(summary);
    } catch (error) {
      logger.error('Failed to fetch platform summary', { error });
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (page = 1) => {
    try {
      setLoadingAudit(true);
      const offset = (page - 1) * AUDIT_LIMIT;
      const res = await api.get<{ data: AuditLogEntry[]; pagination: { total: number } }>(
        '/admin/audit-logs',
        { limit: AUDIT_LIMIT, offset }
      );
      setAuditLogs(res.data?.data ?? []);
      setAuditTotal(res.data?.pagination?.total ?? 0);
      setAuditCurrentPage(page);
    } catch (error) {
      logger.error('Failed to fetch audit logs', { error });
    } finally {
      setLoadingAudit(false);
    }
  }, []);

  const fetchExtRequests = useCallback(async () => {
    try {
      setLoadingExt(true);
      const res = await api.get<{ data: ExtensionRequest[]; total: number }>(
        '/admin/extension-requests',
        { limit: 10 }
      );
      setExtRequests(res.data?.data ?? []);
      setExtTotal(res.data?.total ?? 0);
    } catch (error) {
      logger.error('Failed to fetch extension requests', { error });
    } finally {
      setLoadingExt(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
    fetchPlatformSummary();
    fetchAuditLogs(1);
    fetchExtRequests();
  }, [fetchTenants, fetchPlatformSummary, fetchAuditLogs, fetchExtRequests]);

  // ── Tenants filtered + sorted ─────────────────────────────────────────────

  const filteredSortedTenants = useMemo(() => {
    const q = tenantSearch.trim().toLowerCase();
    let result = q
      ? tenants.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            (t.contactEmail || '').toLowerCase().includes(q)
        )
      : [...tenants];

    switch (tenantSort) {
      case 'name-asc':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'status-active':
        result.sort((a, b) => {
          if (a.status === b.status) return 0;
          return a.status === 'active' ? -1 : 1;
        });
        break;
      case 'status-inactive':
        result.sort((a, b) => {
          if (a.status === b.status) return 0;
          return a.status === 'inactive' ? -1 : 1;
        });
        break;
      case 'date-newest':
        result.sort((a, b) => new Date(b.createdAt || (b as any).created_at).getTime() - new Date(a.createdAt || (a as any).created_at).getTime());
        break;
      case 'date-oldest':
        result.sort((a, b) => new Date(a.createdAt || (a as any).created_at).getTime() - new Date(b.createdAt || (b as any).created_at).getTime());
        break;
    }
    return result;
  }, [tenants, tenantSearch, tenantSort]);

  // ── Audit logs filtered ───────────────────────────────────────────────────

  const filteredAuditLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const matchesSearch =
        !q ||
        (log.user?.username || '').toLowerCase().includes(q) ||
        (log.user?.email || '').toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.entity_type.toLowerCase().includes(q) ||
        (log.ip_address || '').toLowerCase().includes(q);
      const matchesAction =
        auditActionFilter === 'all' || log.action === auditActionFilter;
      return matchesSearch && matchesAction;
    });
  }, [auditLogs, auditSearch, auditActionFilter]);

  const uniqueAuditActions = useMemo(() => {
    const actions = new Set(auditLogs.map((l) => l.action));
    return Array.from(actions).sort();
  }, [auditLogs]);

  // ── Extension requests filtered + sorted ──────────────────────────────────

  const filteredSortedExtRequests = useMemo(() => {
    const q = extSearch.trim().toLowerCase();
    let result = extRequests.filter((req) => {
      const matchesSearch =
        !q ||
        req.title.toLowerCase().includes(q) ||
        (req.tenant?.name || '').toLowerCase().includes(q) ||
        (req.requested_by_user?.username || '').toLowerCase().includes(q) ||
        (req.requested_by_user?.email || '').toLowerCase().includes(q);
      const matchesStatus  = extStatusFilter   === 'all' || req.status   === extStatusFilter;
      const matchesPriority = extPriorityFilter === 'all' || req.priority === extPriorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
    switch (extSort) {
      case 'date-newest': result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case 'date-oldest': result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); break;
      case 'priority-high':
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        result.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9));
        break;
      case 'title-asc': result.sort((a, b) => a.title.localeCompare(b.title)); break;
    }
    return result;
  }, [extRequests, extSearch, extStatusFilter, extPriorityFilter, extSort]);

  const handleTenantsViewMode = (mode: ViewMode) => {
    setTenantsViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const openTenantDetail = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setTenantDetailOpen(true);
  };

  // ── Export handlers ───────────────────────────────────────────────────────

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      await api.downloadFile(
        '/admin/reports/platform-summary?format=csv',
        `platform-summary-${new Date().toISOString().slice(0, 10)}.csv`
      );
      toast.success('CSV export downloaded');
    } catch {
      toast.error('Failed to export CSV');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await api.downloadFile(
        '/admin/reports/platform-summary?format=pdf',
        `platform-summary-${new Date().toISOString().slice(0, 10)}.pdf`
      );
      toast.success('PDF export downloaded');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setExportingPdf(false);
    }
  };

  // ── Tenant actions ────────────────────────────────────────────────────────

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) errors.name = 'Tenant name is required';
    if (!formData.contactEmail.trim()) errors.contactEmail = 'Contact email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactEmail))
      errors.contactEmail = 'Invalid email address';
    if (!formData.adminEmail.trim()) errors.adminEmail = 'Admin email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminEmail))
      errors.adminEmail = 'Invalid admin email address';
    if (!formData.adminUsername.trim()) errors.adminUsername = 'Admin username is required';
    else if (!/^[a-zA-Z0-9_-]+$/.test(formData.adminUsername))
      errors.adminUsername = 'Username can only contain letters, numbers, hyphens, and underscores';
    if (!formData.adminPassword.trim()) errors.adminPassword = 'Admin password is required';
    else if (formData.adminPassword.length < 6) errors.adminPassword = 'Password must be at least 6 characters';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9])/.test(formData.adminPassword))
      errors.adminPassword = 'Password must contain uppercase, lowercase, number, and special character';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateTenant = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      await tenantService.createTenant(formData);
      toast.success(`Tenant "${formData.name}" created successfully`);
      setCreateDialogOpen(false);
      resetForm();
      fetchTenants();
      fetchPlatformSummary();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create tenant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (tenant: Tenant) => {
    try {
      await tenantService.deactivateTenant(tenant.id);
      toast.success(`"${tenant.name}" deactivated`);
      fetchTenants();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to deactivate tenant');
    }
  };

  const handleReactivate = async (tenant: Tenant) => {
    try {
      await tenantService.reactivateTenant(tenant.id);
      toast.success(`"${tenant.name}" reactivated`);
      fetchTenants();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to reactivate tenant');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', contactEmail: '', contactPhone: '', address: '', adminEmail: '', adminUsername: '', adminPassword: '' });
    setFormErrors({});
  };

  // ── Summary cards ─────────────────────────────────────────────────────────

  const summaryCards = platformSummary
    ? [
        {
          label: 'Total Tenants',
          value: platformSummary.totalTenants,
          sub: `${platformSummary.activeTenants} active`,
          icon: Building2,
          bg: 'bg-indigo-500/10 dark:bg-indigo-950/40',
          color: 'text-indigo-600 dark:text-indigo-400',
        },
        {
          label: 'Total Programs',
          value: platformSummary.totalPrograms,
          sub: 'across all tenants',
          icon: GraduationCap,
          bg: 'bg-blue-500/10 dark:bg-blue-950/40',
          color: 'text-blue-600 dark:text-blue-400',
        },
        {
          label: 'Total Trainees',
          value: platformSummary.totalTrainees,
          sub: 'across all tenants',
          icon: Users,
          bg: 'bg-sky-500/10 dark:bg-sky-950/40',
          color: 'text-sky-600 dark:text-sky-400',
        },
        {
          label: 'Total Items',
          value: platformSummary.totalItems,
          sub: 'across all tenants',
          icon: Package,
          bg: 'bg-cyan-500/10 dark:bg-cyan-950/40',
          color: 'text-cyan-600 dark:text-cyan-400',
        },
      ]
    : [];

  const auditTotalPages = Math.ceil(auditTotal / AUDIT_LIMIT);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout title="Super Admin Dashboard">
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg sm:text-xl md:text-2xl font-bold">
              <TrendingUp className="size-5 sm:size-6" />
              Platform Overview
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage all tenants and view aggregated statistics</p>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-2">
            <Button variant="outline" size="sm" asChild className="text-xs sm:text-sm h-9">
              <Link to="/super-admin/reports" className="flex items-center">
                <FileText className="size-3 sm:size-4" />
                <span className="ml-1">Reports</span>
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} disabled={exportingPdf || loadingSummary} className="text-xs sm:text-sm h-9">
              <Download className="size-3 sm:size-4" />
              <span className="ml-1">{exportingPdf ? 'PDF…' : 'PDF'}</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={exportingCsv || loadingSummary} className="text-xs sm:text-sm h-9">
              <Download className="size-3 sm:size-4" />
              <span className="ml-1">{exportingCsv ? 'CSV…' : 'CSV'}</span>
            </Button>
            <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }} className="text-xs sm:text-sm h-9">
              <Plus className="size-3 sm:size-4" />
              <span className="ml-1 hidden sm:inline">Add Tenant</span>
              <span className="ml-1 sm:hidden">Add</span>
            </Button>
          </div>
        </div>

        {/* ── Platform Summary Cards ── */}
        {loadingSummary ? (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-3 sm:p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent></Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((card) => (
              <Card key={card.label}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6">
                  <CardDescription className="text-xs sm:text-sm">{card.label}</CardDescription>
                  <div className={`flex size-8 sm:size-10 items-center justify-center rounded-lg ${card.bg}`}>
                    <card.icon className={`size-4 sm:size-5 ${card.color}`} />
                  </div>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <p className="text-2xl sm:text-3xl font-bold">{card.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* ── Tabbed Sections ── */}
        <Tabs defaultValue="tenants">
          <TabsList className="grid w-full grid-cols-3 h-auto gap-1">
            <TabsTrigger value="tenants" className="flex items-center gap-1 text-xs sm:text-sm py-2">
              <Building2 className="size-3 sm:size-4" />
              <span className="hidden sm:inline">Tenants</span>
              <span className="sm:hidden">T.</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-1 text-xs sm:text-sm py-2">
              <Shield className="size-3 sm:size-4" />
              <span className="hidden sm:inline">Audit Logs</span>
              <span className="sm:hidden">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="extensions" className="flex items-center gap-1 text-xs sm:text-sm py-2">
              <ClipboardList className="size-3 sm:size-4" />
              <span className="hidden sm:inline">Extension Requests</span>
              <span className="sm:hidden">Ext.</span>
              {extTotal > 0 && (
                <Badge className="ml-1 h-4 px-1 text-xs">{extTotal}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── Tenants Tab ── */}
          <TabsContent value="tenants" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="size-5" />
                  Tenant Management
                </CardTitle>
                <CardDescription>All registered tenant instances on the platform</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Search + Sort + View Toggle */}
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by name or email…"
                          value={tenantSearch}
                          onChange={(e) => setTenantSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={tenantSort} onValueChange={setTenantSort}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Sort by…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="name-asc">Name A → Z</SelectItem>
                          <SelectItem value="name-desc">Name Z → A</SelectItem>
                          <SelectItem value="status-active">Status: Active first</SelectItem>
                          <SelectItem value="status-inactive">Status: Inactive first</SelectItem>
                          <SelectItem value="date-newest">Date: Newest first</SelectItem>
                          <SelectItem value="date-oldest">Date: Oldest first</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <div className="hidden sm:flex gap-1 border rounded-md p-1">
                          <Button
                            variant={tenantsViewMode === 'table' ? 'default' : 'ghost'}
                            size="icon"
                            className="size-8"
                            onClick={() => handleTenantsViewMode('table')}
                            aria-label="Table view"
                          >
                            <TableIcon className="size-4" />
                          </Button>
                          <Button
                            variant={tenantsViewMode === 'card' ? 'default' : 'ghost'}
                            size="icon"
                            className="size-8"
                            onClick={() => handleTenantsViewMode('card')}
                            aria-label="Card view"
                          >
                            <LayoutGrid className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {loadingTenants ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : filteredSortedTenants.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Building2 className="mb-4 size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {tenantSearch ? 'No tenants match your search.' : 'No tenants yet. Add your first tenant.'}
                    </p>
                  </div>
                ) : tenantsViewMode === 'table' ? (
                  /* ── Table View ── */
                  <div className="-mx-6 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Contact Email</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[140px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSortedTenants.map((tenant) => (
                          <TableRow
                            key={tenant.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => openTenantDetail(tenant)}
                          >
                            <TableCell className="font-medium">{tenant.name}</TableCell>
                            <TableCell>
                              {tenant.status === 'active' ? (
                                <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300">
                                  <CheckCircle2 className="mr-1 size-3" /> Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <XCircle className="mr-1 size-3" /> Inactive
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{tenant.contactEmail || '—'}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {new Date(tenant.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {tenant.status === 'active' ? (
                                <Button
                                  variant="outline" size="sm"
                                  className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                  onClick={(e) => { e.stopPropagation(); handleDeactivate(tenant); }}
                                >
                                  Deactivate
                                </Button>
                              ) : (
                                <Button
                                  variant="outline" size="sm"
                                  className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/20"
                                  onClick={(e) => { e.stopPropagation(); handleReactivate(tenant); }}
                                >
                                  Reactivate
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  /* ── Card View ── */
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredSortedTenants.map((tenant) => (
                      <Card
                        key={tenant.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => openTenantDetail(tenant)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <Building2 className="size-4 text-primary" />
                              </div>
                              <p className="font-medium truncate">{tenant.name}</p>
                            </div>
                            {tenant.status === 'active' ? (
                              <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 shrink-0">
                                <CheckCircle2 className="mr-1 size-3" /> Active
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="shrink-0">
                                <XCircle className="mr-1 size-3" /> Inactive
                              </Badge>
                            )}
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {tenant.contactEmail && (
                              <p className="flex items-center gap-1.5 truncate">
                                <Mail className="size-3.5 shrink-0" />
                                {tenant.contactEmail}
                              </p>
                            )}
                            <p className="flex items-center gap-1.5">
                              <CalendarDays className="size-3.5 shrink-0" />
                              {new Date(tenant.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="mt-3 flex justify-end">
                            {tenant.status === 'active' ? (
                              <Button
                                variant="outline" size="sm"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={(e) => { e.stopPropagation(); handleDeactivate(tenant); }}
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <Button
                                variant="outline" size="sm"
                                className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/20"
                                onClick={(e) => { e.stopPropagation(); handleReactivate(tenant); }}
                              >
                                Reactivate
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Audit Logs Tab ── */}
          <TabsContent value="audit" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="size-5" />
                    Audit Logs
                  </CardTitle>
                  <CardDescription>
                    Platform-wide event history — {auditTotal.toLocaleString()} total entries
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchAuditLogs(0)} disabled={loadingAudit}>
                  <RefreshCw className={`size-4 ${loadingAudit ? 'animate-spin' : ''}`} />
                </Button>
              </CardHeader>
              <CardContent>
                {/* Search + Action filter */}
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by user, action, entity, or IP…"
                          value={auditSearch}
                          onChange={(e) => setAuditSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                          <SelectValue placeholder="Filter by action…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Actions</SelectItem>
                          {uniqueAuditActions.map((action) => (
                            <SelectItem key={action} value={action}>{action}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {loadingAudit ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : filteredAuditLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <FileText className="mb-4 size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {auditSearch || auditActionFilter !== 'all' ? 'No logs match your filters.' : 'No audit log entries yet.'}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="-mx-6 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time</TableHead>
                            <TableHead>User</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Entity</TableHead>
                            <TableHead>IP</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAuditLogs.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                {fmtDate(log.created_at)}
                              </TableCell>
                              <TableCell className="text-sm">
                                {log.user?.username || log.user?.email || log.user_id?.slice(0, 8) || '—'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {log.action}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {log.entity_type}
                                {log.entity_id ? (
                                  <span className="ml-1 font-mono text-xs opacity-60">
                                    #{log.entity_id.slice(0, 8)}
                                  </span>
                                ) : null}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground font-mono">
                                {log.ip_address || '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {auditTotalPages > 1 && (
                      <div className="flex justify-center pt-4 px-4 py-3 border-t">
                        <PaginationWrapper
                          currentPage={auditCurrentPage}
                          totalPages={auditTotalPages}
                          onPageChange={(page) => fetchAuditLogs(page)}
                        />
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Extension Requests Tab ── */}
          <TabsContent value="extensions" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="size-5" />
                    Extension Requests
                  </CardTitle>
                  <CardDescription>Feature requests from tenants</CardDescription>
                </div>
                <Link to="/extension-requests">
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-2 size-4" />
                    Manage All
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {/* Search + Status + Priority + Sort */}
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Search by title, tenant, or requester…"
                          value={extSearch}
                          onChange={(e) => setExtSearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <Select value={extStatusFilter} onValueChange={setExtStatusFilter}>
                        <SelectTrigger className="w-full sm:w-[160px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="submitted">Submitted</SelectItem>
                          <SelectItem value="under_review">Under Review</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="in_development">In Development</SelectItem>
                          <SelectItem value="deployed">Deployed</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={extPriorityFilter} onValueChange={setExtPriorityFilter}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Priority</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={extSort} onValueChange={setExtSort}>
                        <SelectTrigger className="w-full sm:w-[160px]">
                          <SelectValue placeholder="Sort by…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date-newest">Newest first</SelectItem>
                          <SelectItem value="date-oldest">Oldest first</SelectItem>
                          <SelectItem value="priority-high">Highest priority</SelectItem>
                          <SelectItem value="title-asc">Title A → Z</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {loadingExt ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : filteredSortedExtRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <ClipboardList className="mb-4 size-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {extSearch || extStatusFilter !== 'all' || extPriorityFilter !== 'all'
                        ? 'No requests match your filters.'
                        : 'No extension requests yet.'}
                    </p>
                  </div>
                ) : (
                  <div className="-mx-6 overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Organization</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Submitted</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSortedExtRequests.map((req) => (
                          <TableRow key={req.id}>
                            <TableCell className="font-medium max-w-xs truncate">{req.title}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {req.tenant?.name ?? '—'}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${PRIORITY_COLOR[req.priority]} border-0 capitalize`}>
                                {req.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={`${STATUS_COLOR[req.status]} border-0`}>
                                {STATUS_LABEL[req.status] ?? req.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                              {new Date(req.created_at).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Create Tenant Dialog ── */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="w-96 max-w-[90vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5" />
              Add New Tenant
            </DialogTitle>
            <DialogDescription>
              Create a new tenant instance on the platform. A default Local Admin account will be created automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="tenant-name">Tenant Name *</Label>
              <Input
                id="tenant-name"
                value={formData.name}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, name: e.target.value }));
                  if (formErrors.name) setFormErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder="e.g., Bongabong MDC"
                className={formErrors.name ? 'border-destructive' : ''}
              />
              {formErrors.name && <p className="text-xs text-destructive">{formErrors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-email">Contact Email *</Label>
              <Input
                id="tenant-email"
                type="email"
                value={formData.contactEmail}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, contactEmail: e.target.value }));
                  if (formErrors.contactEmail) setFormErrors(prev => ({ ...prev, contactEmail: '' }));
                }}
                placeholder="admin@tenant.gov.ph"
                className={formErrors.contactEmail ? 'border-destructive' : ''}
              />
              {formErrors.contactEmail && <p className="text-xs text-destructive">{formErrors.contactEmail}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-phone">Contact Phone</Label>
              <Input
                id="tenant-phone"
                value={formData.contactPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                placeholder="09XX-XXX-XXXX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant-address">Address</Label>
              <Input
                id="tenant-address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Municipal Hall, Bongabong, Oriental Mindoro"
              />
            </div>
            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-3">Default Local Admin Account</h3>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin Email *</Label>
              <Input
                id="admin-email"
                type="email"
                value={formData.adminEmail}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, adminEmail: e.target.value }));
                  if (formErrors.adminEmail) setFormErrors(prev => ({ ...prev, adminEmail: '' }));
                }}
                placeholder="admin@tenant.gov.ph"
                className={formErrors.adminEmail ? 'border-destructive' : ''}
              />
              {formErrors.adminEmail && <p className="text-xs text-destructive">{formErrors.adminEmail}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-username">Admin Username *</Label>
              <Input
                id="admin-username"
                value={formData.adminUsername}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, adminUsername: e.target.value }));
                  if (formErrors.adminUsername) setFormErrors(prev => ({ ...prev, adminUsername: '' }));
                }}
                placeholder="admin_username"
                className={formErrors.adminUsername ? 'border-destructive' : ''}
              />
              {formErrors.adminUsername && <p className="text-xs text-destructive">{formErrors.adminUsername}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Admin Password *</Label>
              <Input
                id="admin-password"
                type="password"
                value={formData.adminPassword}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, adminPassword: e.target.value }));
                  if (formErrors.adminPassword) setFormErrors(prev => ({ ...prev, adminPassword: '' }));
                }}
                placeholder="Password123!"
                className={formErrors.adminPassword ? 'border-destructive' : ''}
              />
              {formErrors.adminPassword && <p className="text-xs text-destructive">{formErrors.adminPassword}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateTenant} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Tenant'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Tenant Detail Modal ── */}
      <Dialog open={tenantDetailOpen} onOpenChange={setTenantDetailOpen}>
        <DialogContent className="w-[520px] max-w-[92vw] max-h-[90vh] overflow-y-auto">
          {selectedTenant && (() => {
            const breakdown = platformSummary?.tenantBreakdowns?.find(
              (b) => b.tenantId === selectedTenant.id
            );
            const isActive = selectedTenant.status === 'active';
            return (
              <>
                <DialogHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Building2 className="size-6 text-primary" />
                      </div>
                      <div>
                        <DialogTitle className="text-base font-semibold leading-snug">
                          {selectedTenant.name}
                        </DialogTitle>
                        <DialogDescription className="text-xs mt-0.5">
                          Tenant · ID: <span className="font-mono">{selectedTenant.id.slice(0, 8)}…</span>
                        </DialogDescription>
                      </div>
                    </div>
                    <Badge
                      className={isActive
                        ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 shrink-0'
                        : 'shrink-0'
                      }
                      variant={isActive ? undefined : 'secondary'}
                    >
                      {isActive
                        ? <><CheckCircle2 className="mr-1 size-3" />Active</>
                        : <><XCircle className="mr-1 size-3" />Inactive</>
                      }
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-4">

                  {/* ── Platform stats ── */}
                  {breakdown && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-blue-50/60 dark:bg-blue-950/20 p-3 text-center">
                        <GraduationCap className="size-4 text-blue-500" />
                        <p className="text-xl font-bold">{breakdown.programs}</p>
                        <p className="text-xs text-muted-foreground">Programs</p>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-sky-50/60 dark:bg-sky-950/20 p-3 text-center">
                        <Users className="size-4 text-sky-500" />
                        <p className="text-xl font-bold">{breakdown.trainees}</p>
                        <p className="text-xs text-muted-foreground">Trainees</p>
                      </div>
                      <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-indigo-50/60 dark:bg-indigo-950/20 p-3 text-center">
                        <Package className="size-4 text-indigo-500" />
                        <p className="text-xl font-bold">{breakdown.items}</p>
                        <p className="text-xs text-muted-foreground">Items</p>
                      </div>
                    </div>
                  )}

                  {/* ── Contact information ── */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contact Information</p>
                    <div className="rounded-lg border divide-y text-sm">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <Mail className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground w-16 shrink-0 text-xs">Email</span>
                        <span className="font-medium truncate">{selectedTenant.contactEmail || '—'}</span>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <Phone className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground w-16 shrink-0 text-xs">Phone</span>
                        <span className="font-medium">{selectedTenant.contactPhone || '—'}</span>
                      </div>
                      <div className="flex items-start gap-3 px-3 py-2.5">
                        <MapPin className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground w-16 shrink-0 text-xs mt-0.5">Address</span>
                        <span className="font-medium">{selectedTenant.address || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Dates + Tenant ID ── */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Details</p>
                    <div className="rounded-lg border divide-y text-sm">
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground w-16 shrink-0 text-xs">Created</span>
                        <span className="font-medium">
                          {new Date(selectedTenant.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 px-3 py-2.5">
                        <Shield className="size-4 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground w-16 shrink-0 text-xs">Tenant ID</span>
                        <span className="font-mono text-xs text-muted-foreground truncate">{selectedTenant.id}</span>
                      </div>
                    </div>
                  </div>

                </div>

                <DialogFooter className="pt-2">
                  <Button variant="outline" onClick={() => setTenantDetailOpen(false)}>Close</Button>
                  {isActive ? (
                    <Button
                      variant="destructive"
                      onClick={() => { handleDeactivate(selectedTenant); setTenantDetailOpen(false); }}
                    >
                      Deactivate
                    </Button>
                  ) : (
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => { handleReactivate(selectedTenant); setTenantDetailOpen(false); }}
                    >
                      Reactivate
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
