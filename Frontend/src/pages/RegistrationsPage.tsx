import { useState, useEffect } from 'react';
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
    try {
      await registrationService.approveRegistration(selectedRegistration.id);
      toast.success('Registration approved successfully');
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
    try {
      await registrationService.rejectRegistration(selectedRegistration.id, rejectionReason);
      toast.success('Registration rejected');
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
            {paginatedRegistrations.map((registration) => (
              <Card 
                key={registration.id} 
                className="group hover:shadow-lg transition-all cursor-pointer flex flex-col"
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
            ))}
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
        <DialogContent className="w-[92vw] max-w-2xl flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Registration Details</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Review complete registration information
            </DialogDescription>
          </DialogHeader>

          {selectedRegistration && (
            <>
              <div className="space-y-3 sm:space-y-4 flex-1 overflow-y-auto pr-4">
                {/* Status */}
                <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted">
                  <span className="font-medium text-sm">Status:</span>
                  {getStatusBadge(selectedRegistration.registration_status)}
                </div>

                {/* Personal Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">First Name</p>
                    <p className="font-medium text-sm">{selectedRegistration.first_name}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Last Name</p>
                    <p className="font-medium text-sm">{selectedRegistration.last_name}</p>
                  </div>
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Email</p>
                    <p className="font-medium break-all text-sm">{selectedRegistration.email}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium text-sm">{selectedRegistration.phone}</p>
                  </div>
                </div>

                {/* Account Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Username</p>
                    <p className="font-medium text-sm">@{selectedRegistration.username}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">Program</p>
                    <p className="font-medium text-sm truncate">{selectedRegistration.program?.name}</p>
                  </div>
                </div>

                {/* Submission Date */}
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Submitted On</p>
                  <p className="font-medium text-sm">
                    {new Date(selectedRegistration.created_at).toLocaleString()}
                  </p>
                </div>

                {/* Submitted Requirements */}
                <div className="pt-2 border-t">
                  <p className="text-xs sm:text-sm font-semibold mb-2">Submitted Requirements</p>
                  {loadingReqs ? (
                    <p className="text-xs text-muted-foreground">Loading requirements...</p>
                  ) : requirementFiles.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No documents uploaded</p>
                  ) : (
                    <div className="space-y-2">
                      {requirementFiles.map((rf: any) => (
                        <div key={rf.id} className="flex items-center justify-between p-2 rounded-md bg-muted/40 border text-xs">
                          <div className="min-w-0 flex-1 mr-2">
                            <p className="font-medium truncate">{rf.file_name || rf.requirement_type}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">
                              {rf.requirement_type?.replace(/_/g, ' ')}
                            </p>
                          </div>
                          <a
                            href={`/api/trainees/${selectedRegistration.id}/requirements/${rf.requirement_type}/download?file_id=${rf.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium text-xs shrink-0"
                          >
                            <Download className="size-3" /> Download
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rejection Reason (if applicable) */}
                {selectedRegistration.registration_status === 'rejected' && selectedRegistration.registration_rejection_reason && (
                  <div className="p-2 sm:p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <p className="text-xs sm:text-sm font-medium text-red-800 dark:text-red-300 mb-1">Rejection Reason:</p>
                    <p className="text-xs sm:text-sm text-red-700 dark:text-red-400">
                      {selectedRegistration.registration_rejection_reason}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedRegistration.registration_status === 'pending' && (
                <DialogFooter className="flex flex-col gap-2 mt-4 flex-shrink-0">
                  <Button
                    onClick={() => {
                      setActionType('approve');
                      setActionDialogOpen(true);
                    }}
                    className="w-full h-9 text-sm"
                  >
                    <Check className="size-4 mr-2" />
                    Approve Registration
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setActionType('reject');
                      setRejectionReason('');
                      setActionDialogOpen(true);
                    }}
                    className="w-full h-9 text-sm"
                  >
                    <X className="size-4 mr-2" />
                    Reject Registration
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog (Approve/Reject) */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {actionType === 'approve' ? 'Approve Registration' : 'Reject Registration'}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {selectedRegistration && (
                <>
                  {actionType === 'approve'
                    ? `Approve ${selectedRegistration.first_name} ${selectedRegistration.last_name}'s registration?`
                    : `Reject ${selectedRegistration.first_name} ${selectedRegistration.last_name}'s registration?`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {actionType === 'reject' && (
            <div className="space-y-2">
              <label htmlFor="rejection-reason" className="text-xs sm:text-sm font-medium">
                Rejection Reason *
              </label>
              <textarea
                id="rejection-reason"
                placeholder="Explain why you're rejecting this registration..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs sm:text-sm placeholder-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-20 sm:min-h-24"
              />
            </div>
          )}

          <DialogFooter className="flex flex-col gap-2">
            <Button
              variant={actionType === 'approve' ? 'default' : 'destructive'}
              onClick={actionType === 'approve' ? handleApprove : handleReject}
              disabled={processing || (actionType === 'reject' && !rejectionReason.trim())}
              className="w-full h-9 text-sm"
            >
              {processing && <Loader className="size-4 mr-2 animate-spin" />}
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
              disabled={processing}
              className="w-full h-9 text-sm"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
