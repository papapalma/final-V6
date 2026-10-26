import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import {
  FileText,
  Search,
  Check,
  X,
  Loader,
  Download,
  User,
  Mail,
  Phone,
  GraduationCap,
  Clock,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import registrationService from '../services/registrationService';
import api from '../services/api';
import { PaginationWrapper } from '../components/PaginationWrapper';
import logger from '../utils/logger';

interface Registration {
  id: string;
  username?: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  program?: {
    id: string;
    name: string;
  };
  registration_status: 'pending' | 'approved' | 'rejected' | 'completed';
  created_at: string;
  registration_rejection_reason?: string | null;
  enrollments?: Array<{
    id: string;
    program_id: string;
    programs?: {
      id: string;
      name: string;
      description?: string;
      start_date: string;
      end_date: string;
      status: string;
    };
  }>;
}

export default function RegistrationsPage() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [requirementFiles, setRequirementFiles] = useState<any[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchRegistrations();
  }, [statusFilter, page, pageSize]);

  useEffect(() => {
    if (selectedRegistration) {
      loadTraineeRequirements(selectedRegistration.id);
    } else {
      setRequirementFiles([]);
    }
  }, [selectedRegistration]);

  const loadTraineeRequirements = async (traineeId: string) => {
    try {
      setLoadingReqs(true);
      const res = await api.get(`/trainees/${traineeId}/requirements`);
      const files = res?.files || res?.data?.files || res?.data || [];
      setRequirementFiles(Array.isArray(files) ? files : []);
    } catch (err) {
      logger.error('Failed to load trainee requirements', { err });
      setRequirementFiles([]);
    } finally {
      setLoadingReqs(false);
    }
  };

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      const filters: any = {
        status: statusFilter,
      };
      if (searchQuery) {
        filters.search = searchQuery;
      }

      const response = await registrationService.getRegistrations(filters);
      setRegistrations(response || []);
      setTotal(response?.length || 0);
    } catch (error) {
      logger.error('Failed to fetch registrations', { error });
      toast.error('Failed to load registrations');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setPage(1);
    if (query.length > 0) {
      setSearching(true);
      try {
        const response = await registrationService.getRegistrations({ search: query });
        setRegistrations(response || []);
        setTotal(response?.length || 0);
      } catch (error) {
        logger.error('Search failed', { error });
        toast.error('Search failed');
      } finally {
        setSearching(false);
      }
    } else {
      await fetchRegistrations();
    }
  };

  const handleApprove = async () => {
    if (!selectedRegistration) return;
    setProcessing(true);
    const targetId = selectedRegistration.id;
    try {
      await registrationService.approveRegistration(targetId);
      toast.success('Registration approved successfully');
      // Optimistically update local registrations list for fluid exit transition
      setRegistrations(prev =>
        statusFilter === 'pending'
          ? prev.filter(r => r.id !== targetId)
          : prev.map(r => r.id === targetId ? { ...r, registration_status: 'approved' as const } : r)
      );
      // Reset all dialog states first
      setSelectedRegistration(null);
      setActionDialogOpen(false);
      setViewDetailsOpen(false);
      // Then refresh the list after a small delay to ensure dialogs close
      setTimeout(() => {
        fetchRegistrations();
      }, 300);
    } catch (error: any) {
      logger.error('Approval failed', { error });
      toast.error(error?.message || 'Failed to approve registration');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRegistration || !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }
    setProcessing(true);
    const targetId = selectedRegistration.id;
    try {
      await registrationService.rejectRegistration(targetId, rejectionReason);
      toast.success('Registration rejected');
      // Optimistically update local registrations list for fluid exit transition
      setRegistrations(prev =>
        statusFilter === 'pending'
          ? prev.filter(r => r.id !== targetId)
          : prev.map(r => r.id === targetId ? { ...r, registration_status: 'rejected' as const, registration_rejection_reason: rejectionReason } : r)
      );
      // Reset all dialog states first
      setSelectedRegistration(null);
      setActionDialogOpen(false);
      setViewDetailsOpen(false);
      setRejectionReason('');
      // Then refresh the list after a small delay to ensure dialogs close
      setTimeout(() => {
        fetchRegistrations();
      }, 300);
    } catch (error: any) {
      logger.error('Rejection failed', { error });
      toast.error(error?.message || 'Failed to reject registration');
    } finally {
      setProcessing(false);
    }
  };;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending Review</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
      default:
        return null;
    }
  };

  const paginatedRegistrations = registrations.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return (
    <DashboardLayout title="Registration Management">
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg sm:text-xl font-bold">
            <FileText className="size-5 sm:size-6 shrink-0" />
            <span className="truncate">Pending Registrations</span>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Review and approve trainee registration requests
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or username..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
              disabled={searching}
            />
          </div>
          <Select value={statusFilter} onValueChange={(value: any) => {
            setStatusFilter(value);
            setPage(1);
          }}>
            <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Registrations</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Registrations Grid */}
        {loading ? (
          <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : registrations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
              <FileText className="mb-4 size-8 sm:size-12 text-muted-foreground" />
              <p className="text-xs sm:text-sm text-muted-foreground">
                No registrations found
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {paginatedRegistrations.map((registration) => (
                <motion.div
                  layout
                  key={registration.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ duration: 0.22, ease: "easeOut" }}
                  className="flex flex-col"
                >
                  <Card 
                    className="group hover:shadow-lg transition-all cursor-pointer flex flex-col h-full"
                    onClick={() => {
                      setSelectedRegistration(registration);
                      setViewDetailsOpen(true);
                    }}
                  >
                    <CardHeader className="pb-3 sm:pb-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <CardTitle className="truncate text-sm sm:text-base">
                            {registration.first_name} {registration.last_name}
                          </CardTitle>
                          <CardDescription className="text-xs mt-1">
                            @{registration.username}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {getStatusBadge(registration.registration_status)}
                      </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col">
                      <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm flex-1">
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="font-medium break-all truncate">{registration.email}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Phone</p>
                          <p className="font-medium">{registration.phone}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Program</p>
                          <p className="font-medium truncate">{registration.program?.name}</p>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            {new Date(registration.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {registration.registration_status === 'pending' && (
                        <div className="flex gap-2 mt-3 sm:mt-4" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            className="flex-1 h-8 text-xs sm:h-9 sm:text-sm"
                            onClick={() => {
                              setSelectedRegistration(registration);
                              setActionType('approve');
                              setActionDialogOpen(true);
                            }}
                          >
                            <Check className="size-3 sm:size-4 mr-1" />
                            <span className="hidden xs:inline">Approve</span>
                            <span className="inline xs:hidden">OK</span>
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1 h-8 text-xs sm:h-9 sm:text-sm"
                            onClick={() => {
                              setSelectedRegistration(registration);
                              setActionType('reject');
                              setRejectionReason('');
                              setActionDialogOpen(true);
                            }}
                          >
                            <X className="size-3 sm:size-4 mr-1" />
                            <span className="hidden xs:inline">Reject</span>
                            <span className="inline xs:hidden">No</span>
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
        {registrations.length > pageSize && (
          <PaginationWrapper
            currentPage={page}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        )}
      </div>

      {/* View Details Dialog */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent 
          className="w-[94vw] max-w-2xl p-0 overflow-hidden rounded-2xl sm:rounded-3xl border border-border/80 shadow-2xl flex flex-col max-h-[92vh] apple-modal-dialog"
          style={{ backgroundColor: 'var(--card)' }}
        >
          {selectedRegistration && (
            <>
              {/* Apple-style Hero Header */}
              <div 
                className="border-b border-border/60 bg-muted/20 apple-modal-header"
                style={{ padding: '1.5rem 1.5rem 1rem 1.5rem' }}
              >
                <div className="flex items-start justify-between gap-4 pr-8">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Registration Details
                      </span>
                      {getStatusBadge(selectedRegistration.registration_status)}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
                      {selectedRegistration.first_name} {selectedRegistration.last_name}
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span>@{selectedRegistration.username}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {new Date(selectedRegistration.created_at).toLocaleDateString(undefined, { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Scrollable Inset Grouped Content */}
              <div 
                className="space-y-4 overflow-y-auto flex-1 apple-modal-body"
                style={{ padding: '1.5rem', maxHeight: 'calc(92vh - 180px)' }}
              >
                {/* Inset Group 1: Personal & Contact Information */}
                <div className="rounded-xl border border-border/70 bg-muted/30 dark:bg-muted/15 p-4 space-y-3.5">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <User className="size-3.5 text-primary" />
                    <span>Personal & Contact Info</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                    <div>
                      <p className="text-xs text-muted-foreground">Full Name</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {selectedRegistration.first_name} {selectedRegistration.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Username</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        @{selectedRegistration.username}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email Address</p>
                      <a 
                        href={`mailto:${selectedRegistration.email}`}
                        className="text-sm font-semibold text-primary hover:underline break-all mt-0.5 inline-flex items-center gap-1.5"
                      >
                        <Mail className="size-3.5 shrink-0" />
                        <span>{selectedRegistration.email}</span>
                      </a>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone Number</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5 inline-flex items-center gap-1.5">
                        <Phone className="size-3.5 text-muted-foreground shrink-0" />
                        <span>{selectedRegistration.phone || 'None provided'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Inset Group 2: Program Enrollment */}
                <div className="rounded-xl border border-border/70 bg-muted/30 dark:bg-muted/15 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <GraduationCap className="size-4 text-primary" />
                    <span>Program Enrollment</span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/60 bg-background/80">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">Applying for</p>
                      <p className="text-sm font-bold text-foreground capitalize mt-0.5 truncate">
                        {selectedRegistration.program?.name || 'Selected Program'}
                      </p>
                    </div>
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 shrink-0">
                      Target Course
                    </Badge>
                  </div>
                </div>

                {/* Inset Group 3: Submitted Requirements */}
                <div className="rounded-xl border border-border/70 bg-muted/30 dark:bg-muted/15 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <FileCheck className="size-3.5 text-primary" />
                      <span>Submitted Documents</span>
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">
                      {requirementFiles.length} file{requirementFiles.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {loadingReqs ? (
                    <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                      <Loader className="size-3.5 animate-spin" />
                      <span>Loading documents...</span>
                    </div>
                  ) : requirementFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-5 rounded-lg border border-dashed border-border/70 bg-background/50 text-center">
                      <FileText className="size-6 text-muted-foreground/60 mb-1" />
                      <p className="text-xs font-semibold text-foreground">No documents uploaded</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Trainee submitted application without digital attachments.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {requirementFiles.map((rf: any) => (
                        <div 
                          key={rf.id} 
                          className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-background/80 hover:bg-background transition-colors text-xs"
                        >
                          <div className="min-w-0 flex-1 mr-3 flex items-center gap-2.5">
                            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                              <FileText className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-foreground truncate">{rf.file_name || rf.requirement_type}</p>
                              <p className="text-[11px] text-muted-foreground capitalize">
                                {rf.requirement_type?.replace(/_/g, ' ')}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`/api/trainees/${selectedRegistration.id}/requirements/${rf.requirement_type}/download?file_id=${rf.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-semibold text-xs transition-colors shrink-0 active:scale-95"
                          >
                            <Download className="size-3.5" />
                            <span>Download</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rejection Reason (if applicable) */}
                {selectedRegistration.registration_status === 'rejected' && selectedRegistration.registration_rejection_reason && (
                  <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-800 dark:text-red-300">
                      <AlertCircle className="size-3.5" />
                      <span>Rejection Reason</span>
                    </div>
                    <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">
                      {selectedRegistration.registration_rejection_reason}
                    </p>
                  </div>
                )}
              </div>

              {/* Apple Balanced Action Footer */}
              {selectedRegistration.registration_status === 'pending' && (
                <div 
                  className="border-t border-border/60 bg-muted/20 shrink-0 apple-modal-footer"
                  style={{ padding: '1.25rem 1.5rem' }}
                >
                  <div className="flex flex-col sm:flex-row gap-3 w-full">
                    <Button
                      onClick={() => {
                        setActionType('approve');
                        setActionDialogOpen(true);
                      }}
                      className="flex-1 h-11 rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-[0.98] bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center gap-2"
                    >
                      <Check className="size-4.5 stroke-[2.5]" />
                      <span>Approve Registration</span>
                    </Button>
                    <Button
                      onClick={() => {
                        setActionType('reject');
                        setRejectionReason('');
                        setActionDialogOpen(true);
                      }}
                      style={{ backgroundColor: '#FF3B30', color: '#ffffff' }}
                      className="notif-badge-red flex-1 h-11 rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-[0.98] bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 border-none"
                    >
                      <X className="size-4.5 stroke-[2.5]" />
                      <span>Reject Registration</span>
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog (Approve/Reject) */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent 
          className="w-[92vw] max-w-sm rounded-2xl sm:rounded-3xl border border-border/80 shadow-2xl apple-modal-dialog"
          style={{ padding: '1.5rem', backgroundColor: 'var(--card)' }}
        >
          <DialogHeader className="text-center sm:text-center pb-1">
            <div className={`mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl ${
              actionType === 'approve' 
                ? 'bg-primary/10 text-primary' 
                : 'bg-red-500/10 text-red-600 dark:text-red-400'
            }`}>
              {actionType === 'approve' ? <Check className="size-6 stroke-[2.5]" /> : <X className="size-6 stroke-[2.5]" />}
            </div>
            <DialogTitle className="text-lg font-bold">
              {actionType === 'approve' ? 'Approve Registration' : 'Reject Registration'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm mt-1">
              {selectedRegistration && (
                <>
                  {actionType === 'approve'
                    ? `Are you sure you want to approve ${selectedRegistration.first_name} ${selectedRegistration.last_name}'s registration?`
                    : `Please provide a reason for rejecting ${selectedRegistration.first_name} ${selectedRegistration.last_name}'s registration.`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {actionType === 'reject' && (
            <div className="space-y-1.5 my-2">
              <label htmlFor="rejection-reason" className="text-xs font-semibold text-foreground">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="rejection-reason"
                placeholder="Explain why you're rejecting this registration..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full rounded-xl border border-input bg-background p-3 text-xs sm:text-sm placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-h-24 resize-none transition-shadow"
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 mt-3">
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
              disabled={processing}
              className="flex-1 h-10 rounded-xl text-sm font-medium order-2 sm:order-1"
            >
              Cancel
            </Button>
            <Button
              onClick={actionType === 'approve' ? handleApprove : handleReject}
              disabled={processing || (actionType === 'reject' && !rejectionReason.trim())}
              style={actionType === 'reject' ? { backgroundColor: '#FF3B30', color: '#ffffff' } : undefined}
              className={`flex-1 h-10 rounded-xl text-sm font-semibold shadow-sm transition-all active:scale-[0.98] order-1 sm:order-2 ${
                actionType === 'approve' 
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground' 
                  : 'notif-badge-red bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {processing && <Loader className="size-4 mr-2 animate-spin" />}
              {actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
