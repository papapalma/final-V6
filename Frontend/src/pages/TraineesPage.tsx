import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import DeleteConfirmationDialog from '../components/DeleteConfirmationDialog';
import TraineeDetailsModal, { TraineeDetailsTab } from '../components/TraineeDetailsModal';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, UserPlus, Edit, MoreVertical, RefreshCw, Download, LayoutGrid, TableIcon, QrCode, Eye, Building2, Trash2, Save, KeyRound, ShieldCheck, Copy, Check, X, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import PaginationWrapper from '../components/PaginationWrapper';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import { generateTraineePDF } from '../utils/pdfGenerator';
import { traineeLogger } from '../utils/activityLogger';
import traineeService from '../services/traineeService';
import programService from '../services/programService';
import { enrollmentService } from '../services/enrollmentService';
import api from '../services/api';
import { TableSkeleton, CardGridSkeleton, ListSkeleton } from '../components/LoadingSkeletons';
import { toast } from 'sonner';
import logger from '../utils/logger';
import { getThumbnailUrl } from '../services/api';

type ViewMode = 'table' | 'card';

export default function TraineesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [currentPage, setCurrentPage] = useState(1);

  // Apple-style Keyboard Shortcut: Press '/' to focus search, 'Escape' to clear and blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl?.getAttribute('role') === 'combobox';

      if (e.key === '/' && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'Escape' && activeEl === searchInputRef.current) {
        e.preventDefault();
        setSearchQuery('');
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [selectedTrainee, setSelectedTrainee] = useState<any | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsInitialTab, setDetailsInitialTab] = useState<TraineeDetailsTab>('info');
  const itemsPerPage = 10;
  const { hasPermission, user } = useAuth();
  const isTrainingStaff = user?.role === 'staff_training_coordinator';
  const navigate = useNavigate();
  const [trainees, setTrainees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [programMap, setProgramMap] = useState<Record<string, string>>({});
  const [selectedTraineeForDeletion, setSelectedTraineeForDeletion] = useState<any | null>(null);
  const [deletionConfirmDialogOpen, setDeletionConfirmDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [resetPasswordTrainee, setResetPasswordTrainee] = useState<any | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSuccessCredentials, setResetSuccessCredentials] = useState<{
    fullName: string;
    email: string;
    password: string;
  } | null>(null);
  const [copiedResetCredentials, setCopiedResetCredentials] = useState(false);
  const [remarks, setRemarks] = useState<Record<string, string>>({});
  const [savingRemark, setSavingRemark] = useState<Record<string, boolean>>({});

  // Fetch programs then trainees on mount
  useEffect(() => {
    const init = async () => {
      try {
        const progRes = await programService.getPrograms();
        const map: Record<string, string> = {};
        (progRes.data || []).forEach((p: any) => { map[p.id] = p.name; });
        setProgramMap(map);
        await fetchTrainees();
      } catch {
        await fetchTrainees();
      }
    };
    init();
  }, []);

  const fetchTrainees = async () => {
    try {
      setLoading(true);
      const response = await traineeService.getTrainees({
        search: searchQuery || undefined,
        status: filterStatus !== 'all' ? filterStatus : undefined
      });
      
      // Fetch enrollments for each trainee to get their actual programs
      const mappedTraineesPromises = (response.data || []).map(async (trainee: any) => {
        try {
          // Fetch enrollments for this trainee
          const enrollments = await enrollmentService.fetchEnrollments(trainee.id);
          
          // Get all enrolled programs
          const enrolledPrograms = enrollments
            .filter((e: any) => e.program?.name)
            .map((e: any) => e.program.name);
          
          // Transform enrollments to Training format
          const trainings = enrollments.map((enrollment: any) => ({
            program: enrollment.program?.name || 'Unknown Program',
            status: enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1),
            dateEnrolled: enrollment.enrollment_date 
              ? new Date(enrollment.enrollment_date).toLocaleDateString() 
              : '',
            dateCompleted: enrollment.completion_date
              ? new Date(enrollment.completion_date).toLocaleDateString()
              : null,
          }));
          
          return {
            id: trainee.id,
            traineeId: trainee.id.slice(0, 8),
            name: `${trainee.first_name} ${trainee.last_name}`,
            firstName: trainee.first_name,
            lastName: trainee.last_name,
            email: trainee.email,
            phone: trainee.phone,
            contact: trainee.phone,
            photoUrl: getThumbnailUrl(trainee.thumbnail_path || trainee.photo_path) || undefined,
            status: trainee.status.charAt(0).toUpperCase() + trainee.status.slice(1),
            enrollmentDate: trainee.enrollment_date,
            programId: trainee.program_id,
            programName: enrolledPrograms.length > 0 ? enrolledPrograms.join(', ') : null,
            employmentStatus: trainee.employment_status || 'Unknown',
            trainings: trainings,
            createdAt: trainee.created_at,
            updatedAt: trainee.updated_at
          };
        } catch (error) {
          // If fetching enrollments fails, return trainee without program info
          logger.warn('Failed to fetch enrollments for trainee', { traineeId: trainee.id, error });
          return {
            id: trainee.id,
            traineeId: trainee.id.slice(0, 8),
            name: `${trainee.first_name} ${trainee.last_name}`,
            firstName: trainee.first_name,
            lastName: trainee.last_name,
            email: trainee.email,
            phone: trainee.phone,
            contact: trainee.phone,
            photoUrl: getThumbnailUrl(trainee.thumbnail_path || trainee.photo_path) || undefined,
            status: trainee.status.charAt(0).toUpperCase() + trainee.status.slice(1),
            enrollmentDate: trainee.enrollment_date,
            programId: trainee.program_id,
            programName: null,
            employmentStatus: trainee.employment_status || 'Unknown',
            trainings: [],
            createdAt: trainee.created_at,
            updatedAt: trainee.updated_at
          };
        }
      });
      
      const mappedTrainees = await Promise.all(mappedTraineesPromises);
      setTrainees(mappedTrainees);
      
      if (!isTrainingStaff) {
        await fetchAllRemarks(mappedTrainees.map(t => t.id));
      }
    } catch (error) {
      logger.error('Failed to fetch trainees', { error });
      toast.error('Failed to load trainees');
      setTrainees([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllRemarks = async (traineeIds: string[]) => {
    try {
      const remarksPromises = traineeIds.map(async (traineeId) => {
        try {
          const response = await api.get(`/trainees/${traineeId}/remarks`);
          const latestRemark = response.data?.[0];
          return { traineeId, remark: latestRemark?.remark || '' };
        } catch (error) {
          return { traineeId, remark: '' };
        }
      });
      
      const remarksArray = await Promise.all(remarksPromises);
      const remarksMap: Record<string, string> = {};
      remarksArray.forEach(({ traineeId, remark }) => {
        remarksMap[traineeId] = remark;
      });
      setRemarks(remarksMap);
    } catch (error) {
      logger.error('Failed to fetch remarks', { error });
    }
  };

  const handleSaveRemark = async (traineeId: string, remark: string) => {
    if (!remark.trim()) {
      toast.error('Remark cannot be empty');
      return;
    }

    try {
      setSavingRemark(prev => ({ ...prev, [traineeId]: true }));
      await api.post(`/trainees/${traineeId}/remarks`, { remark: remark.trim() });
      setRemarks(prev => ({ ...prev, [traineeId]: remark.trim() }));
      toast.success('Remark saved successfully');
    } catch (error: any) {
      logger.error('Failed to save remark', { error, traineeId });
      toast.error(error?.message || 'Failed to save remark');
    } finally {
      setSavingRemark(prev => ({ ...prev, [traineeId]: false }));
    }
  };

  // Refetch when filters change
  useEffect(() => {
    if (!loading) {
      fetchTrainees();
    }
  }, [searchQuery, filterStatus]);

  // Load view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('traineesViewMode') as ViewMode;
    if (savedViewMode) {
      setViewMode(savedViewMode);
    }
  }, [isTrainingStaff]);

  // Save view mode to localStorage
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('traineesViewMode', mode);
    setCurrentPage(1); // Reset to first page when changing view
  };

  const openTraineeDetails = async (trainee: any, initialTab: TraineeDetailsTab = 'info') => {
    try {
      // Fetch fresh enrollments from API
      const enrollments = await enrollmentService.fetchEnrollments(trainee.id);
      
      // Transform enrollments to Training format
      const trainings = enrollments.map((enrollment: any) => ({
        program: enrollment.program?.name || 'Unknown Program',
        status: enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1),
        dateEnrolled: enrollment.enrollment_date 
          ? new Date(enrollment.enrollment_date).toLocaleDateString() 
          : '',
        dateCompleted: enrollment.completion_date
          ? new Date(enrollment.completion_date).toLocaleDateString()
          : null,
      }));
      
      // Create trainee object with fresh trainings
      const traineeWithFreshData = {
        ...trainee,
        trainings,
      };
      
      setSelectedTrainee(traineeWithFreshData);
      setDetailsInitialTab(initialTab);
      setDetailsModalOpen(true);
      
      // Log trainee view
      traineeLogger.viewed(trainee.name, trainee.id.toString());
    } catch (error) {
      logger.error('Failed to fetch enrollments for modal', { error, traineeId: trainee.id });
      toast.error('Failed to load enrollments');
      
      // Open modal with empty trainings array on error
      setSelectedTrainee({
        ...trainee,
        trainings: [],
      });
      setDetailsInitialTab(initialTab);
      setDetailsModalOpen(true);
      
      // Still log the view even on error
      traineeLogger.viewed(trainee.name, trainee.id.toString());
    }
  };

  const handleTraineeClick = (trainee: any) => {
    openTraineeDetails(trainee, 'info');
  };

  const handleEditFromModal = (id: number) => {
    navigate(`/trainees/${id}/edit`);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchTrainees();
    setRefreshing(false);
  };

  const handleBulkDownload = () => {
    filteredTrainees.forEach((trainee, index) => {
      // Add a small delay between downloads to prevent browser blocking
      setTimeout(() => {
        generateTraineePDF(trainee);
      }, index * 500);
    });
    
    // Log bulk export
    traineeLogger.exported('PDF', filteredTrainees.length);
  };

  /**
   * Opens the deletion confirmation dialog for a trainee
   * 
   * Sets the trainee as selected and displays the confirmation dialog.
   * Called when user clicks the delete option from the dropdown menu.
   * 
   * @param trainee - The trainee object to be deleted
   * 
   * @example
   * ```tsx
   * handleDeleteClick(trainee); // Opens confirmation dialog
   * ```
   */
  const handleDeleteClick = (trainee: any) => {
    setSelectedTraineeForDeletion(trainee);
    setDeletionConfirmDialogOpen(true);
  };

  /**
   * Executes the trainee deletion after user confirmation
   * 
   * Calls the API to soft-delete the trainee, removes it from the list immediately,
   * closes both confirmation and details dialogs, displays a success notification,
   * and logs the deletion event.
   * 
   * Sets `isDeleting` to true during the operation to show loading states in the UI.
   * On error, calls `handleDeleteError` to display appropriate error messages.
   * 
   * @async
   * 
   * @throws Will not throw - errors are caught and handled by `handleDeleteError`
   * 
   * @example
   * ```tsx
   * // Called from DeleteConfirmationDialog onConfirm callback
   * await handleConfirmDelete();
   * ```
   */
  const handleConfirmDelete = async () => {
    if (!selectedTraineeForDeletion) return;

    try {
      setIsDeleting(true);
      await traineeService.deleteTrainee(String(selectedTraineeForDeletion.id));

      // Remove from list (works for both table and card views)
      setTrainees(prev => prev.filter(t => t.id !== selectedTraineeForDeletion.id));

      // Close dialogs
      setDeletionConfirmDialogOpen(false);
      setDetailsModalOpen(false);
      setSelectedTraineeForDeletion(null);

      // Show success notification
      toast.success(`Trainee ${selectedTraineeForDeletion.name} has been deleted successfully.`);

      // Log the deletion
      traineeLogger.deleted(selectedTraineeForDeletion.name, selectedTraineeForDeletion.id.toString());
    } catch (error: any) {
      handleDeleteError(error);
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Closes the deletion confirmation dialog without deleting the trainee
   * 
   * Clears the selected trainee and closes the confirmation dialog.
   * Called when user clicks Cancel in the confirmation dialog.
   * No API calls are made.
   * 
   * @example
   * ```tsx
   * handleCancelDelete(); // Closes confirmation dialog
   * ```
   */
  const handleCancelDelete = () => {
    setDeletionConfirmDialogOpen(false);
    setSelectedTraineeForDeletion(null);
  };

  /**
   * Handles errors that occur during trainee deletion
   * 
   * Displays an error toast with a message appropriate to the HTTP status code.
   * Keeps the confirmation dialog open to allow the user to retry the deletion.
   * 
   * Error messages:
   * - 403 Forbidden: "You don't have permission to delete this trainee."
   * - 404 Not Found: "Trainee not found or already deleted."
   * - Other errors: "Failed to delete trainee. Please try again later."
   * 
   * @param error - The error object from the API call, should contain `response?.status`
   * 
   * @example
   * ```tsx
   * try {
   *   await traineeService.deleteTrainee(id);
   * } catch (error) {
   *   handleDeleteError(error); // Shows error toast
   * }
   * ```
   */
  const handleDeleteError = (error: any) => {
    const status = error?.status ?? error?.response?.status;
    let message = 'Failed to delete trainee. Please try again later.';

    if (status === 403) {
      message = "You don't have permission to delete this trainee.";
    } else if (status === 404) {
      message = 'Trainee not found or already deleted.';
    } else if (error?.message) {
      message = error.message;
    }

    toast.error(message);
    // Keep dialog open for retry
  };

  const handleResetPasswordClick = (trainee: any) => {
    setResetPasswordTrainee(trainee);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetPasswordTrainee) return;
    try {
      setIsResettingPassword(true);
      const res = await traineeService.resetTraineePassword(String(resetPasswordTrainee.id));
      setResetSuccessCredentials({
        fullName: resetPasswordTrainee.name || `${resetPasswordTrainee.first_name || ''} ${resetPasswordTrainee.last_name || ''}`.trim(),
        email: res.email || resetPasswordTrainee.email,
        password: res.default_password || 'Admin123',
      });
      setResetPasswordTrainee(null);
      toast.success('Password reset successfully to Admin123');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to reset password');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const filteredTrainees = trainees.filter(trainee => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      trainee.name?.toLowerCase().includes(q) ||
      trainee.traineeId?.toLowerCase().includes(q) ||
      trainee.id?.toString().toLowerCase().includes(q) ||
      trainee.email?.toLowerCase().includes(q) ||
      trainee.contact?.toLowerCase().includes(q) ||
      trainee.phone?.toLowerCase().includes(q) ||
      trainee.programName?.toLowerCase().includes(q) ||
      trainee.trainings?.some((training: { program: string }) =>
        training.program?.toLowerCase().includes(q)
      );

    const matchesStatus =
      filterStatus === 'all' || trainee.status?.toLowerCase() === filterStatus.toLowerCase();

    const matchesProgram =
      filterProgram === 'all' ||
      trainee.programName === filterProgram ||
      trainee.programId === filterProgram ||
      trainee.trainings?.some((training: { program: string }) => training.program === filterProgram);

    return matchesSearch && matchesStatus && matchesProgram;
  });

  // Dynamic status counts for Apple HIG capsules
  const statusCounts = {
    all: trainees.length,
    active: trainees.filter(t => t.status?.toLowerCase() === 'active').length,
    completed: trainees.filter(t => t.status?.toLowerCase() === 'completed').length,
    inactive: trainees.filter(t => t.status?.toLowerCase() === 'inactive').length,
  };

  // Distinct sorted program options for the program dropdown
  const programOptions = Array.from(
    new Set([
      ...Object.values(programMap),
      ...trainees.map(t => t.programName).filter(Boolean),
    ])
  ).sort();

  const isFiltered = searchQuery.trim() !== '' || filterStatus !== 'all' || filterProgram !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setFilterStatus('all');
    setFilterProgram('all');
    searchInputRef.current?.focus();
  };

  const getTraineeStatusClass = (status: string) =>
    status === 'Active'
      ? 'border-green-200 bg-green-100 text-green-800 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300'
      : '';

  // Pagination
  const totalPages = Math.ceil(filteredTrainees.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedTrainees = filteredTrainees.slice(startIndex, endIndex);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus, filterProgram]);
  
  // Log search when query changes
  useEffect(() => {
    if (searchQuery) {
      traineeLogger.searched(searchQuery, filteredTrainees.length);
    }
  }, [searchQuery, filteredTrainees.length]);
  
  // Log filter when status changes
  useEffect(() => {
    if (filterStatus !== 'all') {
      traineeLogger.filtered({ status: filterStatus }, filteredTrainees.length);
    }
  }, [filterStatus, filteredTrainees.length]);

  return (
    <DashboardLayout title="Trainee Management">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2">
              Trainees
              {user?.tenantName && (
                <Badge variant="outline" className="text-xs font-normal">
                  <Building2 className="mr-1 size-3" />
                  {user.tenantName}
                </Badge>
              )}
            </h2>
            <p className="text-muted-foreground">
              Manage trainee profiles and registrations for {user?.tenantName || 'your organization'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none"
              onClick={handleBulkDownload}
              disabled={filteredTrainees.length === 0}
            >
              <Download className="mr-2 size-4" />
              Download All ({filteredTrainees.length})
            </Button>
            {hasPermission('canManageTrainees') && (
              <Button className="flex-1 sm:flex-none" onClick={() => navigate('/trainees/new')}>
                <UserPlus className="mr-2 size-4" />
                Add Trainee
              </Button>
            )}
          </div>
        </div>

        {/* Search and Filters Card (Apple HIG Design) */}
        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            {/* Row 1: Search Input (flex-1) + Program Dropdown + Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  style={{ left: '0.75rem' }}
                />
                <Input
                  ref={searchInputRef}
                  placeholder="Search trainees by name, ID, email, program, or contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.35rem', paddingRight: '2.5rem', height: '2.5rem' }}
                  className="rounded-xl bg-background border-input text-sm focus-visible:ring-2 focus-visible:ring-primary/20"
                />

                {/* Clear Button (✕) when typing, or Shortcut Badge (/) when empty */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5"
                  style={{ right: '0.75rem' }}
                >
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/80 active:scale-95 transition-all"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : (
                    <div className="hidden sm:flex items-center gap-1 pointer-events-none">
                      <kbd className="inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/70 bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-xs">
                        /
                      </kbd>
                    </div>
                  )}
                </div>
              </div>

              {/* Program Filter Dropdown (Locked to 2.5rem / 40px) */}
              <div className="flex items-center gap-2">
                <Select value={filterProgram} onValueChange={setFilterProgram}>
                  <SelectTrigger
                    style={{ height: '2.5rem' }}
                    className="w-full sm:w-[200px] rounded-xl border border-input bg-background text-sm"
                  >
                    <SelectValue placeholder="All Programs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {programOptions.map(progName => (
                      <SelectItem key={progName} value={progName}>
                        {progName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Refresh Button */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  style={{ height: '2.5rem', width: '2.5rem' }}
                  className={`rounded-xl border border-input bg-background text-foreground hover:bg-muted shrink-0 ${refreshing ? 'animate-spin' : ''}`}
                  title="Refresh trainees"
                >
                  <RefreshCw className="size-4" />
                </Button>

                {/* View Mode Toggle */}
                <div
                  style={{ height: '2.5rem' }}
                  className="hidden sm:flex items-center gap-1 border border-input rounded-xl p-1 bg-muted/20"
                >
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => handleViewModeChange('table')}
                    className="size-7 rounded-lg"
                    title="Table View"
                  >
                    <TableIcon className="size-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => handleViewModeChange('card')}
                    className="size-7 rounded-lg"
                    title="Grid View"
                  >
                    <LayoutGrid className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Row 2: Status Capsule Filter Pills & Live Feedback */}
            <div className="pt-3 border-t border-border/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 select-none">
                  Status:
                </span>

                {[
                  { key: 'all', label: 'All', count: statusCounts.all },
                  { key: 'active', label: 'Active', count: statusCounts.active },
                  { key: 'completed', label: 'Completed', count: statusCounts.completed },
                  { key: 'inactive', label: 'Inactive', count: statusCounts.inactive },
                ].map((status) => {
                  const isActive = filterStatus === status.key;
                  return (
                    <button
                      key={status.key}
                      type="button"
                      onClick={() => setFilterStatus(status.key)}
                      className={`trainee-pill-base ${isActive ? `trainee-pill-${status.key}-active` : `trainee-pill-${status.key}`}`}
                    >
                      <span>{status.label}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold transition-colors ${
                          isActive ? 'bg-white/25 text-white' : 'bg-black/5 dark:bg-white/10 text-muted-foreground'
                        }`}
                      >
                        {status.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Live Match Counter & Reset Action */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                <span>
                  Showing <strong className="font-semibold text-foreground">{filteredTrainees.length}</strong> of {trainees.length}
                </span>
                {isFiltered && (
                  <>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-primary hover:underline font-medium cursor-pointer"
                    >
                      Reset filters
                    </button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <>
            {viewMode === 'table' ? (
              <>
                <div className="hidden sm:block">
                  <TableSkeleton rows={itemsPerPage} />
                </div>
                <div className="sm:hidden">
                  <ListSkeleton rows={5} />
                </div>
              </>
            ) : (
              <>
                <div className="hidden sm:block">
                  <CardGridSkeleton count={6} />
                </div>
                <div className="sm:hidden">
                  <ListSkeleton rows={5} />
                </div>
              </>
            )}
          </>
        )}

        {/* Desktop Table View */}
        {!loading && viewMode === 'table' && (
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trainee</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Contact</TableHead>
                    {!isTrainingStaff && <TableHead>Employment Status</TableHead>}
                    {!isTrainingStaff && <TableHead>Remarks</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTrainees.map((trainee) => (
                    <TableRow 
                      key={trainee.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleTraineeClick(trainee)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            {trainee.photoUrl && (
                              <img
                                src={trainee.photoUrl}
                                alt={trainee.name}
                                className="size-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {trainee.name.split(' ').map((n: string) => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p>{trainee.name}</p>
                            <p className="text-sm text-muted-foreground">{trainee.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{trainee.programName || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{trainee.contact}</TableCell>
                      {!isTrainingStaff && <TableCell>
                        <Badge
                          variant={
                            trainee.employmentStatus === 'Employed' ? 'default' :
                            trainee.employmentStatus === 'Self-employed' ? 'secondary' :
                            trainee.employmentStatus === 'Unemployed' ? 'outline' :
                            trainee.employmentStatus === 'Student' ? 'default' :
                            'outline'
                          }
                        >
                          {trainee.employmentStatus}
                        </Badge>
                      </TableCell>}
                      {!isTrainingStaff && <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2 min-w-[200px]">
                          <Input
                            type="text"
                            placeholder="Add remark..."
                            value={remarks[trainee.id] || ''}
                            onChange={(e) => setRemarks(prev => ({ ...prev, [trainee.id]: e.target.value }))}
                            className="h-8 text-sm"
                            disabled={savingRemark[trainee.id]}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleSaveRemark(trainee.id, remarks[trainee.id] || '')}
                            disabled={savingRemark[trainee.id] || !remarks[trainee.id]?.trim()}
                          >
                            {savingRemark[trainee.id] ? (
                              <div className="animate-spin h-3 w-3 border-2 border-transparent border-t-primary rounded-full" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>}
                      <TableCell>
                        <Badge
                          variant={
                            trainee.status === 'Active' ? 'outline' :
                            trainee.status === 'Completed' ? 'secondary' :
                            'outline'
                          }
                          className={getTraineeStatusClass(trainee.status)}
                        >
                          {trainee.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              openTraineeDetails(trainee, 'info');
                            }}>
                              <Eye className="mr-2 size-4" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              navigate(`/trainees/${trainee.id}/edit`);
                            }}>
                              <Edit className="mr-2 size-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              generateTraineePDF(trainee);
                            }}>
                              <Download className="mr-2 size-4" />
                              Download PDF
                            </DropdownMenuItem>
                            {hasPermission('canManageTrainees') && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    handleResetPasswordClick(trainee);
                                  }}
                                >
                                  <KeyRound className="mr-2 size-4" />
                                  Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    handleDeleteClick(trainee);
                                  }}
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Desktop Card View */}
        {!loading && viewMode === 'card' && (
          <div className="hidden sm:grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedTrainees.map((trainee) => (
              <Card 
                key={trainee.id} 
                className="group transition-all hover:shadow-lg cursor-pointer"
                onClick={() => handleTraineeClick(trainee)}
              >
                <CardContent className="p-6">
                  <div className="mb-4 flex items-start gap-3">
                    <Avatar className="size-12">
                      {trainee.photoUrl && (
                        <img
                          src={trainee.photoUrl}
                          alt={trainee.name}
                          className="size-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {trainee.name.split(' ').map((n: string) => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="truncate">{trainee.name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{trainee.trainings.map((training: {program: string}) => training.program).join(', ')}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge
                        variant={
                            trainee.status === 'Active' ? 'outline' :
                          trainee.status === 'Completed' ? 'secondary' :
                          'outline'
                        }
                        className={`shrink-0 ${getTraineeStatusClass(trainee.status)}`}
                      >
                        {trainee.status}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                          <Button variant="outline" size="icon" className="size-8 h-8 w-8 border-border bg-background p-0 text-foreground hover:bg-muted">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              openTraineeDetails(trainee, 'info');
                            }}>
                              <Eye className="mr-2 size-4" />
                              Preview
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            navigate(`/trainees/${trainee.id}/edit`);
                          }}>
                            <Edit className="mr-2 size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            generateTraineePDF(trainee);
                          }}>
                            <Download className="mr-2 size-4" />
                            Download PDF
                          </DropdownMenuItem>
                          {hasPermission('canManageTrainees') && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  handleResetPasswordClick(trainee);
                                }}
                              >
                                <KeyRound className="mr-2 size-4" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  handleDeleteClick(trainee);
                                }}
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="mr-2 size-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  
                  <div className="mb-4 space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>
                      <span className="truncate">{trainee.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Contact:</span>
                      <span>{trainee.contact}</span>
                    </div>
                    {!isTrainingStaff && (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Employment:</span>
                          <Badge variant="outline" className="text-xs">{trainee.employmentStatus}</Badge>
                        </div>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Input
                            type="text"
                            placeholder="Add remark..."
                            value={remarks[trainee.id] || ''}
                            onChange={(e) => setRemarks(prev => ({ ...prev, [trainee.id]: e.target.value }))}
                            className="h-8 min-w-0 flex-1 text-sm"
                            disabled={savingRemark[trainee.id]}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 shrink-0 border-border bg-background p-0 text-foreground hover:bg-muted"
                            onClick={() => handleSaveRemark(trainee.id, remarks[trainee.id] || '')}
                            disabled={savingRemark[trainee.id] || !remarks[trainee.id]?.trim()}
                          >
                            {savingRemark[trainee.id] ? (
                              <div className="size-3 animate-spin rounded-full border-2 border-transparent border-t-primary" />
                            ) : (
                              <Save className="size-3" />
                            )}
                          </Button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="mt-4 overflow-hidden">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          navigate(`/trainees/${trainee.id}/edit`);
                        }}
                      >
                        <Edit className="mr-2 size-4" />
                        Edit Trainee
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="flex-1"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          openTraineeDetails(trainee, 'info');
                        }}
                      >
                        <Eye className="mr-2 size-4" />
                        View
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Mobile Card View */}
        {!loading && <div className="sm:hidden space-y-3">
          {paginatedTrainees.map((trainee) => (
            <Card 
              key={trainee.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleTraineeClick(trainee)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="size-12">
                    {trainee.photoUrl && (
                      <img
                        src={trainee.photoUrl}
                        alt={trainee.name}
                        className="size-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {trainee.name.split(' ').map((n: string) => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{trainee.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{trainee.trainings.map((training: {program: string}) => training.program).join(', ')}</p>
                      </div>
                      <Badge
                        variant={
                          trainee.status === 'Active' ? 'outline' :
                          trainee.status === 'Completed' ? 'secondary' :
                          'outline'
                        }
                        className={`shrink-0 ${getTraineeStatusClass(trainee.status)}`}
                      >
                        {trainee.status}
                      </Badge>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground truncate">{trainee.contact}</p>
                      <div className="flex gap-1 shrink-0">
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="size-8 border-border bg-background text-foreground hover:bg-muted"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            navigate(`/trainees/${trainee.id}/edit`);
                          }}
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button 
                          variant="outline" 
                          size="icon"
                          className="size-8 border-border bg-background text-foreground hover:bg-muted"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            openTraineeDetails(trainee, 'info');
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                        {hasPermission('canManageTrainees') && (
                          <Button 
                            variant="outline" 
                            size="icon"
                            className="size-8 border-border bg-background text-foreground hover:bg-muted"
                            title="Reset Password to Admin123"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleResetPasswordClick(trainee);
                            }}
                          >
                            <KeyRound className="size-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {!isTrainingStaff && (
                        <div className="mt-3 space-y-2 text-sm" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Employment:</span>
                          <Badge variant="outline" className="text-xs">{trainee.employmentStatus}</Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            placeholder="Add remark..."
                            value={remarks[trainee.id] || ''}
                            onChange={(e) => setRemarks(prev => ({ ...prev, [trainee.id]: e.target.value }))}
                            className="h-8 min-w-0 flex-1 text-sm"
                            disabled={savingRemark[trainee.id]}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 shrink-0 border-border bg-background p-0 text-foreground hover:bg-muted"
                            onClick={() => handleSaveRemark(trainee.id, remarks[trainee.id] || '')}
                            disabled={savingRemark[trainee.id] || !remarks[trainee.id]?.trim()}
                          >
                            {savingRemark[trainee.id] ? (
                              <div className="size-3 animate-spin rounded-full border-2 border-transparent border-t-primary" />
                            ) : (
                              <Save className="size-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>}

        {!loading && filteredTrainees.length === 0 && (
          <Card className="rounded-2xl border-dashed border-border/80 bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-4 shadow-xs">
                <Search className="size-6" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No trainees found</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                {isFiltered
                  ? 'No trainees match your current search query or active filter criteria. Try adjusting or clearing your filters.'
                  : 'No trainees have been registered yet.'}
              </p>
              {isFiltered && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetFilters}
                  className="mt-5 rounded-xl border-input text-xs font-medium"
                >
                  <RotateCcw className="mr-1.5 size-3.5" />
                  Reset all filters
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {!loading && filteredTrainees.length > 0 && totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <PaginationWrapper
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsCount={filteredTrainees.length}
              itemsPerPage={itemsPerPage}
            />
          </div>
        )}
      </div>

      <TraineeDetailsModal 
        open={detailsModalOpen} 
        onOpenChange={setDetailsModalOpen} 
        trainee={selectedTrainee} 
        initialTab={detailsInitialTab}
        onEdit={handleEditFromModal}
      />

      <DeleteConfirmationDialog
        open={deletionConfirmDialogOpen}
        trainee={selectedTraineeForDeletion}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Password Reset Confirmation Dialog */}
      <Dialog open={!!resetPasswordTrainee} onOpenChange={(open) => {
        if (!open && !isResettingPassword) setResetPasswordTrainee(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
              <KeyRound className="size-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              Reset Password to Admin123
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              Are you sure you want to reset the password for{' '}
              <span className="font-semibold text-foreground">
                {resetPasswordTrainee?.name || resetPasswordTrainee?.first_name}
              </span>
              ? The password will be set to <span className="font-mono font-bold text-foreground">Admin123</span> and the account will be immediately active with no OTP required.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetPasswordTrainee(null)}
              disabled={isResettingPassword}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmResetPassword}
              disabled={isResettingPassword}
            >
              {isResettingPassword ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Resetting...
                </span>
              ) : (
                'Confirm Reset'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Success Dialog */}
      <Dialog open={!!resetSuccessCredentials} onOpenChange={(open) => {
        if (!open) setResetSuccessCredentials(null);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-6" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">
              Password Reset Complete
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              The trainee account has been updated with the default credentials:
            </DialogDescription>
          </DialogHeader>

          {resetSuccessCredentials && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Trainee</span>
                  <p className="text-sm font-semibold text-foreground">{resetSuccessCredentials.fullName}</p>
                </div>
                <Separator />
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Login Email</span>
                  <p className="font-mono text-sm font-semibold text-primary">{resetSuccessCredentials.email}</p>
                </div>
                <Separator />
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Default Password</span>
                  <p className="font-mono text-sm font-bold tracking-wide text-foreground">{resetSuccessCredentials.password}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    const text = `Trainee Account Credentials\nName: ${resetSuccessCredentials.fullName}\nEmail: ${resetSuccessCredentials.email}\nDefault Password: ${resetSuccessCredentials.password}`;
                    navigator.clipboard.writeText(text);
                    setCopiedResetCredentials(true);
                    toast.success('Credentials copied to clipboard');
                    setTimeout(() => setCopiedResetCredentials(false), 2000);
                  }}
                >
                  {copiedResetCredentials ? (
                    <>
                      <Check className="mr-2 size-4 text-emerald-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 size-4" />
                      Copy Credentials
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-end">
            <Button
              type="button"
              onClick={() => setResetSuccessCredentials(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
