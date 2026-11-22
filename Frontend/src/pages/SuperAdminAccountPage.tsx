import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Skeleton } from '../components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, UserCircle2, Building2, CheckCircle2, XCircle, RefreshCw, Mail, Calendar, Shield, LayoutGrid, TableIcon } from 'lucide-react';
import { toast } from 'sonner';
import api from '../services/api';
import logger from '../utils/logger';

type ViewMode = 'table' | 'card';
const VIEW_MODE_KEY = 'superAdminAccountsViewMode';

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

export default function SuperAdminAccountPage() {
  const [localAdmins, setLocalAdmins] = useState<LocalAdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<string>('name-asc');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'table';
  });
  const [selectedAccount, setSelectedAccount] = useState<LocalAdminAccount | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchLocalAdmins = useCallback(async (searchTerm = '') => {
    try {
      setLoading(true);
      const res = await api.get<LocalAdminAccount[]>(
        '/admin/accounts',
        searchTerm ? { search: searchTerm } : undefined
      );
      setLocalAdmins(res.data ?? []);
    } catch (error) {
      logger.error('Failed to fetch local admin accounts', { error });
      toast.error('Failed to load local admin accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLocalAdmins();
  }, [fetchLocalAdmins]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchLocalAdmins(search), 300);
    return () => clearTimeout(t);
  }, [search, fetchLocalAdmins]);

  // Filter and sort accounts
  const filteredSortedAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    let result = q
      ? localAdmins.filter(
          (a) =>
            a.username.toLowerCase().includes(q) ||
            a.email.toLowerCase().includes(q) ||
            (a.tenant_name || '').toLowerCase().includes(q)
        )
      : [...localAdmins];

    switch (sort) {
      case 'name-asc':
        result.sort((a, b) => a.username.localeCompare(b.username));
        break;
      case 'name-desc':
        result.sort((a, b) => b.username.localeCompare(a.username));
        break;
      case 'email-asc':
        result.sort((a, b) => a.email.localeCompare(b.email));
        break;
      case 'email-desc':
        result.sort((a, b) => b.email.localeCompare(a.email));
        break;
      case 'tenant-asc':
        result.sort((a, b) => (a.tenant_name || '').localeCompare(b.tenant_name || ''));
        break;
      case 'tenant-desc':
        result.sort((a, b) => (b.tenant_name || '').localeCompare(a.tenant_name || ''));
        break;
      case 'date-newest':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'date-oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
    }
    return result;
  }, [localAdmins, search, sort]);

  const handleViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  };

  const openAccountDetails = (account: LocalAdminAccount) => {
    setSelectedAccount(account);
    setDetailsOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2">
              <UserCircle2 className="size-8" />
              Account Management
            </h1>
            <p className="text-muted-foreground">
              All local admin accounts across every tenant on the platform
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLocalAdmins(search)}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle2 className="size-5" />
              Local Admin Accounts
            </CardTitle>
            <CardDescription>
              {!loading && (
                <>
                  {filteredSortedAccounts.length} local admin{filteredSortedAccounts.length !== 1 ? 's' : ''}
                  {search ? ` matching "${search}"` : ' across all tenants'}
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>

            {/* Search + Sort + View Toggle */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by username, email, or tenant…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={sort} onValueChange={setSort}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Sort by…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name-asc">Username A → Z</SelectItem>
                      <SelectItem value="name-desc">Username Z → A</SelectItem>
                      <SelectItem value="email-asc">Email A → Z</SelectItem>
                      <SelectItem value="email-desc">Email Z → A</SelectItem>
                      <SelectItem value="tenant-asc">Tenant A → Z</SelectItem>
                      <SelectItem value="tenant-desc">Tenant Z → A</SelectItem>
                      <SelectItem value="date-newest">Date: Newest first</SelectItem>
                      <SelectItem value="date-oldest">Date: Oldest first</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2 border rounded-md p-1">
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="icon"
                      className="size-8"
                      onClick={() => handleViewMode('table')}
                      aria-label="Table view"
                    >
                      <TableIcon className="size-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'card' ? 'default' : 'ghost'}
                      size="icon"
                      className="size-8"
                      onClick={() => handleViewMode('card')}
                      aria-label="Card view"
                    >
                      <LayoutGrid className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Loading */}
            {loading && (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!loading && filteredSortedAccounts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <UserCircle2 className="mb-4 size-12 text-muted-foreground" />
                <p className="font-medium text-muted-foreground">
                  {search
                    ? 'No local admin accounts match your search.'
                    : 'No local admin accounts found.'}
                </p>
              </div>
            )}

            {/* Table View */}
            {!loading && filteredSortedAccounts.length > 0 && viewMode === 'table' && (
              <div className="-mx-6 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Username</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSortedAccounts.map((admin) => (
                      <TableRow
                        key={admin.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openAccountDetails(admin)}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                              <UserCircle2 className="size-4 text-primary" />
                            </div>
                            {admin.username}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {admin.email}
                        </TableCell>
                        <TableCell>
                          {admin.tenant_name ? (
                            <div className="flex items-center gap-1.5">
                              <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="text-sm">{admin.tenant_name}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {admin.tenant_status === 'active' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300">
                              <CheckCircle2 className="mr-1 size-3" /> Active
                            </Badge>
                          ) : admin.tenant_status ? (
                            <Badge variant="secondary">
                              <XCircle className="mr-1 size-3" />
                              {admin.tenant_status.charAt(0).toUpperCase() + admin.tenant_status.slice(1)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {new Date(admin.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); openAccountDetails(admin); }}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Card View */}
            {!loading && filteredSortedAccounts.length > 0 && viewMode === 'card' && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSortedAccounts.map((admin) => (
                  <Card
                    key={admin.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => openAccountDetails(admin)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <UserCircle2 className="size-4 text-primary" />
                          </div>
                          <p className="font-medium truncate">{admin.username}</p>
                        </div>
                        {admin.tenant_status === 'active' ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 shrink-0">
                            <CheckCircle2 className="mr-1 size-3" /> Active
                          </Badge>
                        ) : admin.tenant_status ? (
                          <Badge variant="secondary" className="shrink-0">
                            <XCircle className="mr-1 size-3" />
                            {admin.tenant_status.charAt(0).toUpperCase() + admin.tenant_status.slice(1)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="shrink-0">Unassigned</Badge>
                        )}
                      </div>
                      <div className="space-y-1.5 text-sm text-muted-foreground mb-3">
                        <p className="flex items-center gap-1.5 truncate">
                          <Mail className="size-3.5 shrink-0" />
                          {admin.email}
                        </p>
                        {admin.tenant_name && (
                          <p className="flex items-center gap-1.5 truncate">
                            <Building2 className="size-3.5 shrink-0" />
                            {admin.tenant_name}
                          </p>
                        )}
                        <p className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 shrink-0" />
                          {new Date(admin.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={(e) => { e.stopPropagation(); openAccountDetails(admin); }}
                      >
                        View Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

          </CardContent>
        </Card>

        {/* Account Details Modal */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent hideCloseButton className="w-[92vw] sm:w-full max-w-lg sm:max-w-lg mx-auto p-4 sm:p-6 max-h-[85vh] overflow-y-auto rounded-lg">
            {selectedAccount && (
              <>
                <style>{`
                  .account-details-modal [role="dialog"] button[type="button"] {
                    display: none !important;
                  }
                `}</style>
                <div className="account-details-modal">
                <DialogHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="text-sm sm:text-base font-semibold leading-snug truncate">
                        {selectedAccount.username}
                      </DialogTitle>
                      <DialogDescription className="text-xs mt-0.5">
                        Local Admin Account
                      </DialogDescription>
                    </div>
                    {selectedAccount.tenant_status === 'active' ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 shrink-0 text-xs">
                        <CheckCircle2 className="mr-0.5 size-3" /> Active
                      </Badge>
                    ) : selectedAccount.tenant_status ? (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        <XCircle className="mr-0.5 size-3" />
                        {selectedAccount.tenant_status.charAt(0).toUpperCase() + selectedAccount.tenant_status.slice(1)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0 text-xs">Unassigned</Badge>
                    )}
                  </div>
                </DialogHeader>

                <div className="space-y-3 sm:space-y-4">
                  {/* Account Information */}
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold mb-2">Account Information</h3>
                    <div className="space-y-1.5 sm:space-y-2.5 bg-muted/30 rounded-lg p-2 sm:p-3">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <UserCircle2 className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground text-xs shrink-0 min-w-fit">Username</span>
                        <span className="font-medium text-xs sm:text-sm truncate">{selectedAccount.username}</span>
                      </div>
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Mail className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground text-xs shrink-0 min-w-fit">Email</span>
                        <span className="font-medium text-xs sm:text-sm truncate">{selectedAccount.email}</span>
                      </div>
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Shield className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground text-xs shrink-0 min-w-fit">Role</span>
                        <span className="font-medium text-xs sm:text-sm capitalize">{selectedAccount.role}</span>
                      </div>
                    </div>
                  </div>

                  {/* Tenant Information */}
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold mb-2">Tenant Assignment</h3>
                    <div className="space-y-1.5 sm:space-y-2.5 bg-muted/30 rounded-lg p-2 sm:p-3">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Building2 className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground text-xs shrink-0 min-w-fit">Tenant</span>
                        <span className="font-medium text-xs sm:text-sm">{selectedAccount.tenant_name || '—'}</span>
                      </div>
                      {selectedAccount.tenant_id && (
                        <div className="flex items-start gap-2 sm:gap-3">
                          <Shield className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                          <span className="text-muted-foreground text-xs shrink-0 min-w-fit">Tenant ID</span>
                          <span className="font-mono text-xs text-muted-foreground truncate">{selectedAccount.tenant_id.slice(0, 12)}…</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2 sm:gap-3">
                        <CheckCircle2 className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground text-xs shrink-0 min-w-fit">Status</span>
                        <span className="font-medium text-xs sm:text-sm capitalize">{selectedAccount.tenant_status || '—'}</span>
                      </div>
                      {selectedAccount.tenant_contact_email && (
                        <div className="flex items-start gap-2 sm:gap-3">
                          <Mail className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                          <span className="text-muted-foreground text-xs shrink-0 min-w-fit">Contact</span>
                          <span className="font-medium text-xs sm:text-sm truncate">{selectedAccount.tenant_contact_email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dates */}
                  <div>
                    <h3 className="text-xs sm:text-sm font-semibold mb-2">Dates</h3>
                    <div className="space-y-1.5 sm:space-y-2.5 bg-muted/30 rounded-lg p-2 sm:p-3">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Calendar className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground text-xs shrink-0 min-w-fit">Created</span>
                        <span className="font-medium text-xs sm:text-sm">
                          {new Date(selectedAccount.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 sm:gap-3">
                        <Calendar className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                        <span className="text-muted-foreground text-xs shrink-0 min-w-fit">Updated</span>
                        <span className="font-medium text-xs sm:text-sm">
                          {new Date(selectedAccount.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2 sm:pt-4">
                </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
