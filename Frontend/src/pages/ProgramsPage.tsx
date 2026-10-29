import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePrograms } from '../contexts/ProgramsContext';
import DashboardLayout from '../components/DashboardLayout';
import ProgramDetailsModal from '../components/ProgramDetailsModal';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import logger from '../utils/logger';
import PaginationWrapper from '../components/PaginationWrapper';
import { isProgramExpired, getProgramStatus, type Program } from '../utils/programHelpers';
import { 
  GraduationCap, 
  Plus, 
  Pencil, 
  Trash2,
  Laptop,
  Wrench,
  ChefHat,
  Users,
  Briefcase,
  Heart,
  Scissors,
  Paintbrush,
  Camera,
  Music,
  Code,
  Car,
  LayoutGrid,
  TableIcon,
  Building2,
  BarChart3,
  Search,
  X,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import programService from '../services/programService';
import { getThumbnailUrl } from '../services/api';
import { TableSkeleton, CardGridSkeleton } from '../components/LoadingSkeletons';

// Icon options for programs
const iconOptions = [
  { value: 'Laptop', label: 'Computer/Laptop', icon: Laptop },
  { value: 'Wrench', label: 'Technical/Tools', icon: Wrench },
  { value: 'ChefHat', label: 'Culinary/Chef', icon: ChefHat },
  { value: 'Users', label: 'People/Community', icon: Users },
  { value: 'Briefcase', label: 'Business', icon: Briefcase },
  { value: 'Heart', label: 'Healthcare', icon: Heart },
  { value: 'Scissors', label: 'Beauty/Salon', icon: Scissors },
  { value: 'Paintbrush', label: 'Arts/Crafts', icon: Paintbrush },
  { value: 'Camera', label: 'Photography', icon: Camera },
  { value: 'Music', label: 'Music', icon: Music },
  { value: 'Code', label: 'Programming', icon: Code },
  { value: 'Car', label: 'Automotive', icon: Car },
];

const getIconComponent = (iconName: string) => {
  const iconOption = iconOptions.find(opt => opt.value === iconName);
  return iconOption ? iconOption.icon : GraduationCap;
};

export default function ProgramsPage() {
  const { hasPermission, user, isAuthReady } = useAuth();
  const { programs: contextPrograms, loading: contextLoading, refetch: contextRefetch } = usePrograms();
  const navigate = useNavigate();  
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterFunding, setFilterFunding] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [tablePage, setTablePage] = useState(1);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [programStats, setProgramStats] = useState<Record<string, any>>({});
  const [statsLoading, setStatsLoading] = useState<Set<string>>(new Set());
  const tableRowsPerPage = 10;
  const location = useLocation();

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
        setSearchTerm('');
        searchInputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Sync context programs to local state
  useEffect(() => {
    if (contextPrograms.length > 0) {
      setPrograms(contextPrograms);
      setLoading(contextLoading);
    }
  }, [contextPrograms, contextLoading]);

  // Auto-refetch when navigating back to this page
  useEffect(() => {
    if (!isAuthReady) {
      return;
    }
    contextRefetch();
  }, [location.pathname, isAuthReady, contextRefetch]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await contextRefetch();
    setRefreshing(false);
  };

  const handleEdit = (program: Program) => {
    navigate(`/programs/${program.id}/edit`);
  };

  const handleDelete = async () => {
    if (!selectedProgram) return;

    try {
      await programService.deleteProgram(selectedProgram.id);
      await contextRefetch(); // Refresh from context
      setDeleteDialogOpen(false);
      setSelectedProgram(null);
      toast.success('Program deleted successfully');
    } catch (error) {
      logger.error('Failed to delete program', { error });
      toast.error('Failed to delete program');
    }
  };

  const openDeleteDialog = (program: Program) => {
    setSelectedProgram(program);
    setDeleteDialogOpen(true);
  };

  // Instant In-Memory Multi-Field Filter
  const filteredPrograms = programs.filter(program => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      program.name?.toLowerCase().includes(q) ||
      program.description?.toLowerCase().includes(q) ||
      program.type_of_funding?.toLowerCase().includes(q) ||
      program.duration?.toLowerCase().includes(q) ||
      program.instructor?.toLowerCase().includes(q);

    const actualStatus = getProgramStatus(program);
    const matchesStatus = filterStatus === 'all' || actualStatus === filterStatus;

    const matchesFunding = filterFunding === 'all' || program.type_of_funding === filterFunding;

    return matchesSearch && matchesStatus && matchesFunding;
  });

  // Dynamic status counts for Apple HIG capsules (expiration aware)
  const statusCounts = {
    all: programs.length,
    active: programs.filter(p => getProgramStatus(p) === 'active').length,
    inactive: programs.filter(p => getProgramStatus(p) === 'inactive').length,
  };

  // Distinct sorted funding options
  const fundingOptions = Array.from(
    new Set(programs.map(p => p.type_of_funding).filter(Boolean))
  ).sort();

  const isFiltered = searchTerm.trim() !== '' || filterStatus !== 'all' || filterFunding !== 'all';

  const resetFilters = () => {
    setSearchTerm('');
    setFilterStatus('all');
    setFilterFunding('all');
    searchInputRef.current?.focus();
  };

  const tableTotalPages = Math.ceil(filteredPrograms.length / tableRowsPerPage);
  const tableStartIndex = (tablePage - 1) * tableRowsPerPage;
  const paginatedTablePrograms = filteredPrograms.slice(tableStartIndex, tableStartIndex + tableRowsPerPage);

  useEffect(() => {
    setTablePage(1);
  }, [searchTerm, filterStatus, filterFunding, viewMode]);

  const canManage = hasPermission('canManagePrograms');

  // Fetch stats for programs when grid view is active
  useEffect(() => {
    if (viewMode === 'grid' && filteredPrograms.length > 0) {
      filteredPrograms.forEach((program) => {
        if (!programStats[program.id] && !statsLoading.has(program.id)) {
          const newLoading = new Set(statsLoading);
          newLoading.add(program.id);
          setStatsLoading(newLoading);

          programService.getProgramSpecificStats(program.id)
            .then((stats) => {
              setProgramStats((prev) => ({
                ...prev,
                [program.id]: stats,
              }));
            })
            .catch((error) => {
              console.error(`Failed to fetch stats for program ${program.id}:`, error);
            })
            .finally(() => {
              setStatsLoading((prev) => {
                const newLoading = new Set(prev);
                newLoading.delete(program.id);
                return newLoading;
              });
            });
        }
      });
    }
  }, [viewMode, filteredPrograms, programStats, statsLoading]);

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 flex-wrap">
              <GraduationCap className="size-6 sm:size-8 shrink-0" />
              <span className="truncate">Programs Management</span>
              {user?.tenantName && (
                <Badge variant="outline" className="text-xs font-normal">
                  <Building2 className="mr-1 size-3" />
                  <span className="hidden xs:inline">{user.tenantName}</span>
                </Badge>
              )}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Manage training programs offered by {user?.tenantName || 'your organization'}
            </p>
          </div>

          {canManage && (
            <Button onClick={() => navigate('/programs/new')} size="sm" className="w-full sm:w-auto">
              <Plus className="mr-2 size-4" />
              <span className="hidden xs:inline">Add Program</span>
              <span className="inline xs:hidden">Add</span>
            </Button>
          )}
        </div>

        {/* Search and Filters Card (Apple HIG Design) */}
        <Card className="rounded-2xl border border-border/60 bg-card shadow-sm backdrop-blur-sm">
          <CardContent className="p-4 space-y-3">
            {/* Row 1: Search Input (flex-1) + Funding Dropdown + Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search
                  className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  style={{ left: '0.75rem' }}
                />
                <Input
                  ref={searchInputRef}
                  placeholder="Search programs by name, description, funding, duration, or instructor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ paddingLeft: '2.35rem', paddingRight: '2.5rem', height: '2.5rem' }}
                  className="rounded-xl bg-background border-input text-sm focus-visible:ring-2 focus-visible:ring-primary/20"
                />

                {/* Clear Button (✕) when typing, or Shortcut Badge (/) when empty */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5"
                  style={{ right: '0.75rem' }}
                >
                  {searchTerm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
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

              {/* Funding Type Filter Dropdown (Locked to 2.5rem / 40px) */}
              <div className="flex items-center gap-2">
                <Select value={filterFunding} onValueChange={setFilterFunding}>
                  <SelectTrigger
                    style={{ height: '2.5rem' }}
                    className="w-full sm:w-[190px] rounded-xl border border-input bg-background text-sm"
                  >
                    <SelectValue placeholder="All Funding Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Funding Types</SelectItem>
                    {fundingOptions.map(funding => (
                      <SelectItem key={funding} value={funding}>
                        {funding}
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
                  title="Refresh programs"
                >
                  <RefreshCw className="size-4" />
                </Button>

                {/* View Mode Toggle */}
                <div
                  style={{ height: '2.5rem' }}
                  className="hidden sm:flex items-center gap-1 border border-input rounded-xl p-1 bg-muted/20"
                >
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('grid')}
                    className="size-7 rounded-lg"
                    title="Grid View"
                  >
                    <LayoutGrid className="size-3.5" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'default' : 'ghost'}
                    size="icon"
                    onClick={() => setViewMode('table')}
                    className="size-7 rounded-lg"
                    title="Table View"
                  >
                    <TableIcon className="size-3.5" />
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
                  { key: 'inactive', label: 'Inactive', count: statusCounts.inactive },
                ].map((status) => {
                  const isActive = filterStatus === status.key;
                  return (
                    <button
                      key={status.key}
                      type="button"
                      onClick={() => setFilterStatus(status.key as any)}
                      className={`program-pill-base ${isActive ? `program-pill-${status.key}-active` : `program-pill-${status.key}`}`}
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
                  Showing <strong className="font-semibold text-foreground">{filteredPrograms.length}</strong> of {programs.length}
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
              <div className="hidden sm:block">
                <TableSkeleton rows={tableRowsPerPage} />
              </div>
            ) : (
              <CardGridSkeleton count={6} />
            )}
          </>
        )}

        {/* Table View */}
        {!loading && viewMode === 'table' && filteredPrograms.length > 0 && (
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Program</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTablePrograms.map((program) => {
                    const IconComponent = getIconComponent(program.icon);
                    return (
                      <TableRow
                        key={program.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedProgram(program);
                          setDetailsModalOpen(true);
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {program.photoUrl ? (
                              <div className="size-10 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 shrink-0">
                                <img
                                  src={program.photoUrl}
                                  alt={program.name}
                                  className="size-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              </div>
                            ) : (
                              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                                <IconComponent className="size-5 text-primary" />
                              </div>
                            )}
                            <div>
                              <p>{program.name}</p>
                              <p className="text-sm text-muted-foreground truncate max-w-md">
                                {program.description}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{program.duration}</TableCell>
                        <TableCell className="text-muted-foreground">{program.type_of_funding}</TableCell>
                        <TableCell>
                          <Badge variant={program.status === 'active' ? 'default' : 'secondary'}>
                            {program.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {canManage && (
                            <div className="flex gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  handleEdit(program);
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e: React.MouseEvent) => {
                                  e.stopPropagation();
                                  openDeleteDialog(program);
                                }}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {!loading && viewMode === 'table' && tableTotalPages > 1 && (
          <div className="hidden sm:mt-6 sm:flex sm:justify-center">
            <PaginationWrapper
              currentPage={tablePage}
              totalPages={tableTotalPages}
              onPageChange={setTablePage}
            />
          </div>
        )}

        {!loading && viewMode === 'table' && tableTotalPages > 1 && (
          <div className="hidden sm:mt-6 sm:flex sm:justify-center">
            <PaginationWrapper
              currentPage={tablePage}
              totalPages={tableTotalPages}
              onPageChange={setTablePage}
            />
          </div>
        )}

        {/* Programs Grid / Empty State */}
        {!loading && (filteredPrograms.length === 0 ? (
          <Card className="rounded-2xl border-dashed border-border/80 bg-card/50 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground mb-4 shadow-xs">
                <GraduationCap className="size-7" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No programs found</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                {isFiltered
                  ? 'No training programs match your current search query or active filter criteria. Try adjusting or clearing your filters.'
                  : 'No training programs have been created yet.'}
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
        ) : filteredPrograms.length > 0 && (
          <div className={`${viewMode === 'grid' ? 'grid' : 'grid sm:hidden'} gap-3 sm:gap-4 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`}>
            {filteredPrograms.map((program) => {
              const IconComponent = getIconComponent(program.icon);
              const stats = programStats[program.id];
              const isLoadingStats = statsLoading.has(program.id);
              return (
                <Card key={program.id} className="group hover:shadow-lg transition-all cursor-pointer overflow-hidden flex flex-col"
                  onClick={() => {
                    setSelectedProgram(program);
                    setDetailsModalOpen(true);
                  }}
                >
                  {program.photoUrl && (
                    <div className="w-full h-32 sm:h-40 md:h-48 rounded-t-xl overflow-hidden border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
                      <img
                        src={program.photoUrl}
                        alt={program.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <CardHeader className="pb-2 sm:pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex size-10 sm:size-12 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
                        <IconComponent className="size-5 sm:size-6 text-primary" />
                      </div>
                      {canManage && (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              handleEdit(program);
                            }}
                          >
                            <Pencil className="size-3 sm:size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 sm:h-8 sm:w-8"
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              openDeleteDialog(program);
                            }}
                          >
                            <Trash2 className="size-3 sm:size-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <CardTitle className="text-sm sm:text-base line-clamp-2">{program.name}</CardTitle>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge variant={program.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {program.status}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{program.duration}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col gap-3">
                    <CardDescription className="text-xs sm:text-sm line-clamp-2">{program.description}</CardDescription>
                    
                    {/* Enrollment Stats - Label Only (no link) */}
                    {program.current_enrollment !== undefined ? (
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-medium border-t border-gray-200 dark:border-gray-700 pt-2">
                        <Users className="size-3.5 shrink-0" />
                        <span className={program.enrollment_limit && program.current_enrollment >= program.enrollment_limit ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
                          {program.current_enrollment} / {program.enrollment_limit || program.max_trainees} enrolled
                        </span>
                      </div>
                    ) : null}

                    {/* Total Registrations - Label Only (no link) */}
                    {stats && (
                      <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-muted-foreground">
                        <BarChart3 className="size-3.5 shrink-0" />
                        <span>
                          {stats.total_registrations} trying to register
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs sm:text-sm pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="text-muted-foreground">Type of Funding:</span>
                      <span className="font-medium">{program.type_of_funding}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent className="w-[92vw] max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base sm:text-lg">Delete Program?</AlertDialogTitle>
              <AlertDialogDescription className="text-xs sm:text-sm">
                Are you sure you want to delete "{selectedProgram?.name}"? The program will be moved to the archive and can be restored later from the Archive page.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete to Archive
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Program Details Modal */}
        <ProgramDetailsModal
          program={selectedProgram}
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          onEdit={handleEdit}
          canManage={canManage}
        />
      </div>
    </DashboardLayout>
  );
}