import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '../components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
  UserPlus, Edit, Trash2, Users, Search,
  CheckCircle2, XCircle, Clock, Eye, BookOpen
} from 'lucide-react';
import { getRoleDisplayName, getRoleBadgeColor, UserRole } from '../utils/roles';
import { toast } from 'sonner';
import userService, { User as ApiUser } from '../services/userService';
import registrationService, { PendingRegistration } from '../services/registrationService';
import { useAuth } from '../contexts/AuthContext';
import { ListSkeleton, TableSkeleton } from '../components/LoadingSkeletons';
import TraineePreviewModal from '../components/TraineePreviewModal';

interface User extends ApiUser {}

export default function AccountManagementPage() {
  const { user: currentUser, hasPermission } = useAuth();
  
  // Only local admins can manage accounts
  if (!hasPermission('canManageAccounts')) {
    return (
      <DashboardLayout>
        <div className="container mx-auto py-16">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
            <p className="text-muted-foreground">Only local admins can manage user accounts.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const [activeTab, setActiveTab] = useState('accounts');

  // ── Accounts state ──────────────────────────────────────────────
  const [users, setUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    username: '', email: '', role: 'staff_inventory_manager' as UserRole, password: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ── Pending Registrations state ─────────────────────────────────
  const [registrations, setRegistrations] = useState<PendingRegistration[]>([]);
  const [regSearch, setRegSearch] = useState('');
  const [regStatusFilter, setRegStatusFilter] = useState('pending');
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReg, setSelectedReg] = useState<PendingRegistration | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [selectedRegPreview, setSelectedRegPreview] = useState<PendingRegistration | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [accountsPage, setAccountsPage] = useState(1);
  const [registrationsPage, setRegistrationsPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => { fetchUsers(); fetchRegistrations(); }, []);

  // Refetch accounts when search changes
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => fetchUsers(), 300);
      return () => clearTimeout(t);
    }
  }, [searchQuery]);

  useEffect(() => {
    setAccountsPage(1);
  }, [searchQuery]);

  // Refetch registrations when filters change
  useEffect(() => {
    const t = setTimeout(() => fetchRegistrations(), 300);
    return () => clearTimeout(t);
  }, [regSearch, regStatusFilter]);

  useEffect(() => {
    setRegistrationsPage(1);
  }, [regSearch, regStatusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getUsers({ search: searchQuery || undefined });
      setUsers(data);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async () => {
    try {
      setLoadingRegs(true);
      const data = await registrationService.getRegistrations({
        status: regStatusFilter || undefined,
        search: regSearch || undefined,
      });
      setRegistrations(data);
      // Update badge count separately for 'pending'
      if (regStatusFilter === 'pending') setPendingCount(data.length);
      else {
        const pending = await registrationService.getRegistrations({ status: 'pending' });
        setPendingCount(pending.length);
      }
    } catch (error: any) {
      // Silently fail if no permission
      if (error?.status !== 403) toast.error(error?.message || 'Failed to load registrations');
    } finally {
      setLoadingRegs(false);
    }
  };

  const openReviewModal = (reg: PendingRegistration, action: 'approve' | 'reject') => {
    setSelectedReg(reg);
    setReviewAction(action);
    setRejectReason('');
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = async () => {
    if (!selectedReg) return;
    if (reviewAction === 'reject' && !rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setReviewing(true);
    try {
      if (reviewAction === 'approve') {
        await registrationService.approveRegistration(selectedReg.id);
        toast.success(`Registration approved! Account created for ${selectedReg.first_name} ${selectedReg.last_name}.`);
      } else {
        await registrationService.rejectRegistration(selectedReg.id, rejectReason.trim());
        toast.success('Registration rejected.');
      }
      setReviewModalOpen(false);
      fetchRegistrations();
      fetchUsers();
    } catch (error: any) {
      toast.error(error?.message || `Failed to ${reviewAction} registration`);
    } finally {
      setReviewing(false);
    }
  };

  const openPreviewModal = (reg: PendingRegistration) => {
    setSelectedRegPreview(reg);
    setPreviewModalOpen(true);
  };

  // ── Account CRUD ─────────────────────────────────────────────────
  const validateForm = (isEdit = false): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.username.trim()) errors.username = 'Username is required';
    else if (formData.username.length < 3) errors.username = 'Username must be at least 3 characters';
    else if (formData.username.length > 100) errors.username = 'Username must not exceed 100 characters';
    else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) errors.username = 'Username can only contain letters, numbers, hyphens, and underscores';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.email = 'Invalid email address';
    else if (formData.email.length > 255) errors.email = 'Email must not exceed 255 characters';
    if (!isEdit) {
      if (!formData.password) errors.password = 'Password is required';
      else if (formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    } else if (formData.password) {
      if (formData.password.length < 6) errors.password = 'Password must be at least 6 characters';
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddUser = async () => {
    if (!validateForm(false)) return;
    setSubmitting(true);
    try {
      await userService.createUser({ username: formData.username.trim(), email: formData.email.trim(), password: formData.password, role: formData.role as any });
      await fetchUsers();
      toast.success('User added successfully');
      setAddModalOpen(false);
      resetForm();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditUser = async () => {
    if (!selectedUser || !validateForm(true)) return;
    setSubmitting(true);
    try {
      const updateData: any = { username: formData.username.trim(), email: formData.email.trim(), role: formData.role as any };
      if (formData.password) updateData.password = formData.password;
      await userService.updateUser(selectedUser.id, updateData);
      await fetchUsers();
      toast.success('User updated successfully');
      setEditModalOpen(false);
      setSelectedUser(null);
      resetForm();
    } catch (error: any) {
      if (error?.status === 404) {
        toast.error('User no longer exists. Refreshing list...');
        await fetchUsers();
        setEditModalOpen(false);
        setSelectedUser(null);
        resetForm();
      } else {
        toast.error(error?.message || 'Failed to update user');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.email === 'admin@bmdc.edu.ph') { toast.error('Cannot delete the main admin account'); return; }
    if (confirm(`Are you sure you want to delete ${user.username}?`)) {
      try {
        await userService.deleteUser(user.id);
        await fetchUsers();
        toast.success('User deleted successfully');
      } catch (error: any) {
        if (error?.status === 404) { toast.warning('User was already deleted. Refreshing list...'); await fetchUsers(); }
        else toast.error(error?.message || 'Failed to delete user');
      }
    }
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({ username: user.username, email: user.email, role: user.role, password: '' });
    setFormErrors({});
    setEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ username: '', email: '', role: 'staff_inventory_manager', password: '' });
    setFormErrors({});
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const usersTotalPages = Math.ceil(filteredUsers.length / rowsPerPage);
  const usersStartIndex = (accountsPage - 1) * rowsPerPage;
  const paginatedUsers = filteredUsers.slice(usersStartIndex, usersStartIndex + rowsPerPage);

  const registrationsTotalPages = Math.ceil(registrations.length / rowsPerPage);
  const registrationsStartIndex = (registrationsPage - 1) * rowsPerPage;
  const paginatedRegistrations = registrations.slice(registrationsStartIndex, registrationsStartIndex + rowsPerPage);

  const statusBadge = (status: string) => {
    if (status === 'pending') return <Badge className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300"><Clock className="mr-1 size-3" />Pending</Badge>;
    if (status === 'approved') return <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300"><CheckCircle2 className="mr-1 size-3" />Approved</Badge>;
    return <Badge className="bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300"><XCircle className="mr-1 size-3" />Rejected</Badge>;
  };

  const canReview = currentUser?.role === 'local_admin' || currentUser?.role === 'staff_training_coordinator';

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-lg sm:text-2xl font-bold">
              <Users className="size-6 sm:size-8 flex-shrink-0" />
              <span>Account Management</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">Manage user accounts, permissions, and trainee registrations</p>
          </div>
          <Button onClick={() => { resetForm(); setAddModalOpen(true); }} size="sm" className="sm:size-default w-full sm:w-auto">
            <UserPlus className="mr-2 size-4" />Add User
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="accounts" className="text-xs sm:text-sm">
              <Users className="mr-1 sm:mr-2 size-4" />
              <span className="hidden sm:inline">User Accounts</span>
              <span className="sm:hidden">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="registrations" className="text-xs sm:text-sm relative">
              <BookOpen className="mr-1 sm:mr-2 size-4" />
              <span className="hidden sm:inline">Pending Registrations</span>
              <span className="sm:hidden">Registrations</span>
              {pendingCount > 0 && (
                <span 
                  style={{ backgroundColor: '#FF3B30', color: '#ffffff' }}
                  className="notif-badge-red ml-1 flex min-w-5 h-5 px-1.5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white flex-shrink-0 shadow-sm ring-2 ring-card"
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── ACCOUNTS TAB ── */}
          <TabsContent value="accounts" className="space-y-3 md:space-y-4 mt-4">
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search users..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 text-sm" />
                </div>
              </CardContent>
            </Card>

            {loading && (
              <div className="space-y-3">
                <TableSkeleton rows={5} />
                <div className="sm:hidden">
                  <ListSkeleton rows={4} />
                </div>
              </div>
            )}

            {!loading && (
              <Card className="hidden sm:block overflow-x-auto">
                <CardContent className="p-0">
                  <Table className="text-xs sm:text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">User</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Role</TableHead>
                        <TableHead className="text-xs w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.map(user => (
                        <TableRow key={user.id}>
                          <TableCell className="py-2 sm:py-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="size-8"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{user.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                              <p className="font-medium text-xs sm:text-sm truncate">{user.username}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs sm:text-sm truncate">{user.email}</TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(user.role)} style={(user.role as string) === 'trainee' ? { backgroundColor: '#2563eb', color: 'white', borderColor: '#1e40af' } : undefined}>
                              {getRoleDisplayName(user.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditModal(user)}><Edit className="size-3" /></Button>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteUser(user)} disabled={user.email === 'admin@bmdc.edu.ph'}><Trash2 className="size-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {!loading && (
              <div className="sm:hidden space-y-2">
                {paginatedUsers.map(user => (
                  <Card key={user.id} className="p-0">
                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        <Avatar className="size-10 shrink-0"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{user.username.charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="mb-2">
                            <h4 className="truncate text-sm font-medium">{user.username}</h4>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                          <div className="mb-2">
                            <Badge className={getRoleBadgeColor(user.role)} style={(user.role as string) === 'trainee' ? { backgroundColor: '#2563eb', color: 'white', borderColor: '#1e40af' } : undefined}>
                              {getRoleDisplayName(user.role)}
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" className="flex-1 text-xs h-8" onClick={() => openEditModal(user)}><Edit className="mr-1 size-3" />Edit</Button>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleDeleteUser(user)} disabled={user.email === 'admin@bmdc.edu.ph'}><Trash2 className="size-3" /></Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {!loading && filteredUsers.length === 0 && (
              <div className="py-8 sm:py-12 text-center">
                <Users className="mx-auto mb-4 size-10 sm:size-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No users found</p>
              </div>
            )}

            {!loading && filteredUsers.length > 0 && usersTotalPages > 1 && (
              <div className="flex justify-center overflow-x-auto">
                <Pagination>
                  <PaginationContent className="text-xs sm:text-sm">
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setAccountsPage(prev => Math.max(1, prev - 1))}
                        className={accountsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        size={undefined}
                      />
                    </PaginationItem>

                    {Array.from({ length: usersTotalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === usersTotalPages ||
                        (page >= accountsPage - 1 && page <= accountsPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setAccountsPage(page)}
                              isActive={accountsPage === page}
                              className="cursor-pointer"
                              size={undefined}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }

                      if (page === accountsPage - 2 || page === accountsPage + 2) {
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
                        onClick={() => setAccountsPage(prev => Math.min(usersTotalPages, prev + 1))}
                        className={accountsPage === usersTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        size={undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </TabsContent>

          {/* ── REGISTRATIONS TAB ── */}
          <TabsContent value="registrations" className="space-y-3 md:space-y-4 mt-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1 min-w-0">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search registrations..." value={regSearch} onChange={e => setRegSearch(e.target.value)} className="pl-9 text-sm" />
                  </div>
                  <Select value={regStatusFilter} onValueChange={setRegStatusFilter}>
                    <SelectTrigger className="w-full sm:w-40 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Registration Table (Desktop) */}
            {!loadingRegs && (
              <Card className="hidden sm:block overflow-x-auto">
                <CardContent className="p-0">
                  <Table className="text-xs sm:text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Name</TableHead>
                        <TableHead className="text-xs">Email</TableHead>
                        <TableHead className="text-xs">Program</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs w-[50px]">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedRegistrations.map(reg => (
                        <TableRow 
                          key={reg.id}
                          onClick={() => openPreviewModal(reg)}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="py-2 sm:py-4">
                            <p className="font-medium text-xs sm:text-sm truncate">
                              {reg.first_name} {reg.last_name}
                            </p>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs sm:text-sm truncate">
                            {reg.email}
                          </TableCell>
                          <TableCell className="text-xs sm:text-sm truncate">
                            {reg.program?.name || '—'}
                          </TableCell>
                          <TableCell>
                            {statusBadge(reg.status)}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPreviewModal(reg);
                              }}
                            >
                              <Eye className="size-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Registration Cards (Mobile) */}
            {!loadingRegs && (
              <div className="sm:hidden space-y-2">
                {paginatedRegistrations.map(reg => (
                  <Card 
                    key={reg.id} 
                    className="p-0 cursor-pointer hover:bg-muted/50"
                    onClick={() => openPreviewModal(reg)}
                  >
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        <div>
                          <h4 className="truncate text-sm font-medium">
                            {reg.first_name} {reg.last_name}
                          </h4>
                          <p className="text-xs text-muted-foreground truncate">
                            {reg.email}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-muted-foreground mb-1">Program</p>
                            <p className="text-xs font-medium truncate">
                              {reg.program?.name || '—'}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            {statusBadge(reg.status)}
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPreviewModal(reg);
                              }}
                            >
                              <Eye className="size-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {loadingRegs && (
              <div className="space-y-3">
                <TableSkeleton rows={4} />
                <div className="md:hidden">
                  <ListSkeleton rows={3} />
                </div>
              </div>
            )}

            {!loadingRegs && registrations.length === 0 && (
              <div className="py-8 sm:py-12 text-center">
                <Clock className="mx-auto mb-4 size-10 sm:size-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No {regStatusFilter} registrations</p>
              </div>
            )}

            {!loadingRegs && registrations.length > 0 && registrationsTotalPages > 1 && (
              <div className="flex justify-center overflow-x-auto">
                <Pagination>
                  <PaginationContent className="text-xs sm:text-sm">
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setRegistrationsPage(prev => Math.max(1, prev - 1))}
                        className={registrationsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        size={undefined}
                      />
                    </PaginationItem>

                    {Array.from({ length: registrationsTotalPages }, (_, i) => i + 1).map((page) => {
                      if (
                        page === 1 ||
                        page === registrationsTotalPages ||
                        (page >= registrationsPage - 1 && page <= registrationsPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setRegistrationsPage(page)}
                              isActive={registrationsPage === page}
                              className="cursor-pointer"
                              size={undefined}
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      }

                      if (page === registrationsPage - 2 || page === registrationsPage + 2) {
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
                        onClick={() => setRegistrationsPage(prev => Math.min(registrationsTotalPages, prev + 1))}
                        className={registrationsPage === registrationsTotalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                        size={undefined}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Add User Modal ── */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="w-full max-w-sm mx-auto p-4 sm:p-6 [&_button[type='button']]:hidden">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base sm:text-lg">Add New User</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Create a new user account with specific role and permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="add-username" className="text-xs sm:text-sm">Username *</Label>
              <Input id="add-username" value={formData.username} onChange={e => { setFormData({ ...formData, username: e.target.value }); setFormErrors({ ...formErrors, username: '' }); }} placeholder="john_doe" className={`text-xs sm:text-sm ${formErrors.username ? 'border-destructive' : ''}`} />
              {formErrors.username && <p className="text-xs text-destructive">{formErrors.username}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-email" className="text-xs sm:text-sm">Email Address *</Label>
              <Input id="add-email" type="email" value={formData.email} onChange={e => { setFormData({ ...formData, email: e.target.value }); setFormErrors({ ...formErrors, email: '' }); }} placeholder="john@bmdc.edu.ph" className={`text-xs sm:text-sm ${formErrors.email ? 'border-destructive' : ''}`} />
              {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-role" className="text-xs sm:text-sm">Role *</Label>
              <Select value={formData.role} onValueChange={(v: string) => setFormData({ ...formData, role: v as UserRole })}>
                <SelectTrigger className="text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local_admin">Local Admin</SelectItem>
                  <SelectItem value="staff_inventory_manager">Staff (Inventory)</SelectItem>
                  <SelectItem value="staff_training_coordinator">Staff (Trainees)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="add-password" className="text-xs sm:text-sm">Password *</Label>
              <Input id="add-password" type="password" value={formData.password} onChange={e => { setFormData({ ...formData, password: e.target.value }); setFormErrors({ ...formErrors, password: '' }); }} placeholder="••••••••" className={`text-xs sm:text-sm ${formErrors.password ? 'border-destructive' : ''}`} />
              {formErrors.password && <p className="text-xs text-destructive">{formErrors.password}</p>}
              <p className="text-xs text-muted-foreground">Must be at least 6 characters with uppercase, lowercase, and number</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-3 pt-2">
            <Button variant="outline" onClick={() => setAddModalOpen(false)} disabled={submitting} className="text-xs sm:text-sm">Cancel</Button>
            <Button onClick={handleAddUser} disabled={submitting} className="text-xs sm:text-sm">{submitting ? 'Adding...' : 'Add User'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Modal ── */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="w-full max-w-sm mx-auto p-4 sm:p-6 [&_button[type='button']]:hidden">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base sm:text-lg">Edit User</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">Update user account information and permissions</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-username" className="text-xs sm:text-sm">Username *</Label>
              <Input id="edit-username" value={formData.username} onChange={e => { setFormData({ ...formData, username: e.target.value }); setFormErrors({ ...formErrors, username: '' }); }} placeholder="john_doe" className={`text-xs sm:text-sm ${formErrors.username ? 'border-destructive' : ''}`} />
              {formErrors.username && <p className="text-xs text-destructive">{formErrors.username}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email" className="text-xs sm:text-sm">Email Address *</Label>
              <Input id="edit-email" type="email" value={formData.email} onChange={e => { setFormData({ ...formData, email: e.target.value }); setFormErrors({ ...formErrors, email: '' }); }} placeholder="john@bmdc.edu.ph" className={`text-xs sm:text-sm ${formErrors.email ? 'border-destructive' : ''}`} />
              {formErrors.email && <p className="text-xs text-destructive">{formErrors.email}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-role" className="text-xs sm:text-sm">Role *</Label>
              <Select value={formData.role} onValueChange={(v: string) => setFormData({ ...formData, role: v as UserRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local_admin">Local Admin</SelectItem>
                  <SelectItem value="staff_inventory_manager">Staff (Inventory)</SelectItem>
                  <SelectItem value="staff_training_coordinator">Staff (Trainees)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-password">New Password (optional)</Label>
              <Input id="edit-password" type="password" value={formData.password} onChange={e => { setFormData({ ...formData, password: e.target.value }); setFormErrors({ ...formErrors, password: '' }); }} placeholder="Leave blank to keep current password" className={formErrors.password ? 'border-destructive' : ''} />
              {formErrors.password ? <p className="text-sm text-destructive">{formErrors.password}</p> : <p className="text-xs text-muted-foreground">If changing, must be at least 6 characters with uppercase, lowercase, and number</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={handleEditUser} disabled={submitting}>{submitting ? 'Saving...' : 'Save Changes'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Review Registration Modal ── */}
      <Dialog open={reviewModalOpen} onOpenChange={setReviewModalOpen}>
        <DialogContent className="w-full max-w-sm mx-auto p-4 sm:p-6 max-h-[90vh] overflow-y-auto [&_button[type='button']]:hidden">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base sm:text-lg">
              {selectedReg?.status !== 'pending' ? 'Registration Details' : reviewAction === 'approve' ? 'Approve Registration' : 'Reject Registration'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {selectedReg?.first_name} {selectedReg?.last_name} — {selectedReg?.email}
            </DialogDescription>
          </DialogHeader>

          {selectedReg && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="rounded-lg bg-muted/50 p-2 sm:p-3 text-xs grid grid-cols-2 gap-x-2 gap-y-1.5 sm:gap-x-3 sm:gap-y-2">
                <span className="text-muted-foreground font-medium">Username</span><span className="truncate">@{selectedReg.username}</span>
                <span className="text-muted-foreground font-medium">Program</span><span className="truncate">{selectedReg.program?.name || '—'}</span>
                <span className="text-muted-foreground font-medium">Phone</span><span className="truncate">{selectedReg.phone}</span>
                <span className="text-muted-foreground font-medium">Sex</span><span className="truncate">{selectedReg.sex}</span>
                <span className="text-muted-foreground font-medium">Civil Status</span><span className="truncate">{selectedReg.civil_status}</span>
                <span className="text-muted-foreground font-medium">Education</span><span className="truncate">{selectedReg.educational_attainment}</span>
                <span className="text-muted-foreground font-medium">Employment</span><span className="truncate">{selectedReg.employment_status}</span>
                <span className="text-muted-foreground font-medium">Classification</span><span className="truncate">{selectedReg.classification}</span>
                <span className="col-span-2 text-muted-foreground font-medium text-xs">Address</span>
                <span className="col-span-2 text-xs leading-tight">{selectedReg.street}, {selectedReg.barangay}, {selectedReg.municipality}, {selectedReg.province}</span>
                <span className="text-muted-foreground font-medium">Submitted</span>
                <span className="text-xs">{new Date(selectedReg.created_at).toLocaleDateString()}</span>
              </div>

              {/* Current status */}
              {selectedReg.status !== 'pending' && (
                <div className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Status:</span>
                  <div className="flex flex-col gap-1">
                    {statusBadge(selectedReg.status)}
                    {selectedReg.rejection_reason && (
                      <p className="text-xs text-red-600 dark:text-red-400">Reason: {selectedReg.rejection_reason}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Reject reason input */}
              {selectedReg.status === 'pending' && reviewAction === 'reject' && (
                <div className="space-y-1.5">
                  <Label className="text-xs sm:text-sm">Reason for Rejection *</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Explain why this registration is being rejected..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
              )}

              {selectedReg.status === 'pending' && reviewAction === 'approve' && (
                <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-2 text-xs text-green-800 dark:text-green-300 leading-relaxed">
                  Approving will create a <strong>Trainee</strong> user account and a trainee profile. The applicant will be able to log in immediately.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-3 pt-2">
            <Button variant="outline" onClick={() => setReviewModalOpen(false)} disabled={reviewing} className="text-xs sm:text-sm">
              {selectedReg?.status !== 'pending' ? 'Close' : 'Cancel'}
            </Button>
            {selectedReg?.status === 'pending' && (
              <Button
                onClick={handleReviewSubmit}
                disabled={reviewing}
                className={`${reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'} text-xs sm:text-sm`}
              >
                {reviewing ? 'Processing...' : reviewAction === 'approve' ? 'Approve & Create Account' : 'Reject Registration'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Trainee Preview Modal ── */}
      <TraineePreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        trainee={selectedRegPreview}
        onApprove={() => { fetchRegistrations(); fetchUsers(); }}
        onReject={() => { fetchRegistrations(); fetchUsers(); }}
        isAdminMode={canReview}
      />
    </DashboardLayout>
  );
}












