import { useState, useEffect } from 'react';
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
import { Search, UserPlus, Edit, MoreVertical, RefreshCw, Download, LayoutGrid, TableIcon, QrCode, Eye, Building2, Trash2, Save } from 'lucide-react';
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
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [currentPage, setCurrentPage] = useState(1);
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

  const filteredTrainees = trainees.filter(trainee => {
    const matchesSearch = trainee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         trainee.trainings.some((training: {program: string}) => training.program.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === 'all' || trainee.status.toLowerCase() === filterStatus.toLowerCase();
    return matchesSearch && matchesStatus;
  });

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
  }, [searchQuery, filterStatus]);
  
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

        {/* Search and Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search trainees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleRefresh}
                  className={refreshing ? 'animate-spin' : ''}
                >
                  <RefreshCw className="size-4" />
                </Button>
                <div className="hidden sm:flex gap-1 border rounded-md p-1">
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => handleViewModeChange('table')}
                    className="size-8"
                  >
                    <TableIcon className="size-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'card' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => handleViewModeChange('card')}
                    className="size-8"
                  >
                    <LayoutGrid className="size-4" />
                  </Button>
                </div>
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
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No trainees found</p>
          </div>
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
    </DashboardLayout>
  );
}
