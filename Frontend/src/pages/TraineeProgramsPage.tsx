import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DashboardLayout from '../components/DashboardLayout';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  GraduationCap,
  Calendar,
  CheckCircle2,
  User,
  Building2,
  Search,
  BookOpen,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import programService from '../services/programService';
import registrationService from '../services/registrationService';
import traineeService from '../services/traineeService';
import { enrollmentService } from '../services/enrollmentService';
import api, { getThumbnailUrl } from '../services/api';
import logger from '../utils/logger';
import { ProgramCard } from '../components/programs/ProgramCard';
import TraineeProgramDetailsModal from '../components/TraineeProgramDetailsModal';

interface Program {
  id: string;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  instructor?: string | null;
  duration_weeks?: number;
  max_trainees?: number;
  thumbnail_path?: string;
  image_path?: string;
  icon?: string;
}

interface EnrollmentData {
  programId: string;
  isEnrolled: boolean;
  enrollmentStatus: 'accepting' | 'in-progress' | 'completed';
  enrollmentDate?: Date;
  graduatedDate?: Date;
}

const getIconComponent = (iconName?: string): React.ReactNode => {
  if (!iconName) return <GraduationCap className="size-5 text-primary" />;
  // Return a generic graduation cap since we don't have icon mapping
  return <GraduationCap className="size-5 text-primary" />;
};

export default function TraineeProgramsPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [enrollmentData, setEnrollmentData] = useState<Map<string, EnrollmentData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  const [programDetailsModalOpen, setProgramDetailsModalOpen] = useState(false);

  useEffect(() => {
    // Clear all caches to ensure fresh data from server
    traineeService.clearProfileCache?.();
    enrollmentService.clearCache();
    fetchPrograms();
  }, []);

  const fetchEnrollmentData = async (programList: Program[]) => {
    try {
      // Fetch trainee's enrollment status for all programs
      // This API endpoint should return enrollment data for all programs the trainee is enrolled in
      const response = await api.get('/trainees/me/enrollments');
      const enrollments = (response.data?.data || response.data) as any[];
      
      // Build a map of program ID to enrollment data
      const enrollmentMap = new Map<string, EnrollmentData>();
      
      // Initialize all programs as not enrolled
      programList.forEach(program => {
        enrollmentMap.set(program.id, {
          programId: program.id,
          isEnrolled: false,
          enrollmentStatus: 'accepting',
        });
      });

      // Update with actual enrollment data
      enrollments.forEach((enrollment: any) => {
        const programId = enrollment.program_id;
        if (enrollmentMap.has(programId)) {
          // Map enrollment API status to button state values
          const mappedStatus: 'accepting' | 'in-progress' | 'completed' = 
            enrollment.status === 'completed' ? 'completed' : (enrollment.status ? 'in-progress' : 'accepting');
          
          enrollmentMap.set(programId, {
            programId,
            isEnrolled: true,
            enrollmentStatus: mappedStatus,
            enrollmentDate: enrollment.enrollment_date ? new Date(enrollment.enrollment_date) : undefined,
            graduatedDate: enrollment.completed_date ? new Date(enrollment.completed_date) : undefined,
          });
        }
      });

      setEnrollmentData(enrollmentMap);
    } catch (error) {
      logger.error('Failed to fetch enrollment data', { error });
      // Continue without enrollment data rather than blocking the page
      // Initialize all programs as not enrolled with accepting status
      const enrollmentMap = new Map<string, EnrollmentData>();
      programList.forEach(program => {
        enrollmentMap.set(program.id, {
          programId: program.id,
          isEnrolled: false,
          enrollmentStatus: 'accepting',
        });
      });
      setEnrollmentData(enrollmentMap);
    }
  };

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const response = await programService.getPrograms({ status: 'active' });
      const programsArray = response.data || [];
      // Map API response to include thumbnail data
      const mappedPrograms: Program[] = programsArray.map((serviceProgram: any) => ({
        id: serviceProgram.id,
        name: serviceProgram.name,
        description: serviceProgram.description || '',
        start_date: serviceProgram.start_date,
        end_date: serviceProgram.end_date,
        status: serviceProgram.status,
        instructor: serviceProgram.instructor,
        duration_weeks: serviceProgram.duration_weeks,
        max_trainees: serviceProgram.max_trainees,
        thumbnail_path: serviceProgram.thumbnail_path,
        image_path: serviceProgram.image_path,
        icon: serviceProgram.icon || 'GraduationCap',
      }));
      setPrograms(mappedPrograms);
      
      // Fetch enrollment data after programs are loaded
      await fetchEnrollmentData(mappedPrograms);
    } catch (error) {
      logger.error('Failed to fetch programs', { error });
      toast.error('Failed to load programs');
    } finally {
      setLoading(false);
    }
  };


  const handleApply = async () => {
    if (!selectedProgram) return;
    setApplying(true);
    try {
      // Fetch the trainee's own profile to get their existing details
      const profileRes = await api.get('/trainees/me');
      const trainee = profileRes.data as any;

      if (!trainee) {
        toast.error('Could not load your trainee profile. Please contact staff.');
        return;
      }

      // Submit a pending registration (application) to the chosen program
      // using the trainee's existing profile data
      const registrationData = {
        username:               `trainee_${trainee.id.slice(0, 8)}`,
        email:                  trainee.email,
        password:               '',          // empty — trainee already has an account
        first_name:             trainee.first_name,
        last_name:              trainee.last_name,
        middle_name:            trainee.middle_name || '',
        phone:                  trainee.phone,
        sex:                    trainee.sex,
        birth_date:             trainee.birth_date,
        birth_place:            trainee.birth_place,
        civil_status:           trainee.civil_status,
        province:               trainee.province,
        municipality:           trainee.municipality,
        barangay:               trainee.barangay,
        street:                 trainee.street,
        educational_attainment: trainee.educational_attainment,
        course:                 trainee.course || '',
        year_graduated:         trainee.year_graduated || '',
        classification:         trainee.classification || 'Unemployed', // Ensure non-empty for validation
        disability:             trainee.disability || null,
        employment_status:      trainee.employment_status,
        program_id:             selectedProgram.id,
        tenant_id:              trainee.tenant_id,
      };

      console.log('[TraineeProgramsPage] Submitting registration with data:', registrationData);

      await registrationService.submitRegistration(registrationData, true); // true = existing trainee

      // Update enrollment state for this program
      const updatedEnrollment: EnrollmentData = {
        programId: selectedProgram.id,
        isEnrolled: true,
        enrollmentStatus: 'in-progress',
        enrollmentDate: new Date(),
      };
      setEnrollmentData(prev => new Map(prev).set(selectedProgram.id, updatedEnrollment));

      toast.success('Application submitted!', {
        description: `Your application for "${selectedProgram.name}" has been submitted for staff review.`,
      });
      setApplyDialogOpen(false);
      setSelectedProgram(null);
    } catch (error: any) {
      // Handle 409 Conflict (incomplete enrollment)
      if (error.response?.status === 409) {
        const conflictMessage = error.response?.data?.error || 
          'You are already enrolled in an incomplete program. Please complete or drop your current program before applying to a new one.';
        toast.error('Cannot Apply', {
          description: conflictMessage,
        });
        console.warn('[TraineeProgramsPage] Conflict error (409):', conflictMessage);
      } else {
        // Handle other errors
        toast.error(error?.message || 'Failed to submit application');
        console.error('[TraineeProgramsPage] Error submitting registration:', error);
      }
    } finally {
      setApplying(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredPrograms = programs.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout title="Available Programs">
      <main className="w-full">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Available Programs</h1>
            <p className="text-muted-foreground mt-2">
              Browse and enroll in training programs offered by {user?.tenantName || 'your organization'}
            </p>
          </div>

          {/* Search Bar */}
          <div className="flex items-center gap-2 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
            <Search className="h-5 w-5 text-gray-400 shrink-0" />
            <Input
              placeholder="Search programs by name, instructor, or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent focus:outline-none focus:ring-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-900 rounded transition-colors shrink-0"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            )}
          </div>

          {/* Programs Grid */}
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-10 w-full mt-4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredPrograms.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {searchQuery ? 'No programs match your search' : 'No programs available'}
                </p>
                <p className="text-muted-foreground mt-2">
                  {searchQuery 
                    ? 'Try adjusting your search terms' 
                    : 'Check back soon for new training opportunities'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Showing <span className="font-bold text-gray-900 dark:text-white">{filteredPrograms.length}</span> program{filteredPrograms.length !== 1 ? 's' : ''}
              </p>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filteredPrograms.map((program) => {
                  const IconComponent = getIconComponent(program.icon);
                  const photoUrl = getThumbnailUrl(program.thumbnail_path || program.image_path);
                  const enrollment = enrollmentData.get(program.id);
                  
                  return (
                    <div
                      key={program.id}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedProgram(program);
                        setProgramDetailsModalOpen(true);
                      }}
                    >
                      <ProgramCard
                        program={{
                          id: program.id,
                          name: program.name,
                          description: program.description,
                          start_date: program.start_date,
                          end_date: program.end_date,
                          status: program.status,
                          instructor: program.instructor,
                          duration_weeks: program.duration_weeks,
                          max_trainees: program.max_trainees,
                          thumbnail_path: program.thumbnail_path,
                          image_path: program.image_path,
                          icon: IconComponent,
                        }}
                        photoUrl={photoUrl || undefined}
                        isEnrolled={enrollment?.isEnrolled || false}
                        enrollmentStatus={enrollment?.enrollmentStatus || 'accepting'}
                        enrollmentDate={enrollment?.enrollmentDate}
                        graduatedDate={enrollment?.graduatedDate}
                        onEnroll={() => {
                          setSelectedProgram(program);
                          setApplyDialogOpen(true);
                        }}
                        isEnrolling={applying && selectedProgram?.id === program.id}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="w-full max-w-lg rounded-xl">
          <DialogHeader className="space-y-3">
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-2.5 rounded-lg bg-primary/10 dark:bg-primary/20">
                <GraduationCap className="h-6 w-6 text-primary" />
              </div>
              Apply for Program
            </DialogTitle>
            <DialogDescription className="text-base pt-2">
              Confirm your application. Your submission will be reviewed by staff before enrollment is confirmed.
            </DialogDescription>
          </DialogHeader>
          {selectedProgram && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-900/50 dark:to-gray-800/30 p-5 space-y-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white">{selectedProgram.name}</h3>
                {selectedProgram.description && (
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{selectedProgram.description}</p>
                )}
              </div>
              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-gray-950/40">
                  <Calendar className="h-5 w-5 text-primary/60 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Duration</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{formatDate(selectedProgram.start_date)} – {formatDate(selectedProgram.end_date)}</p>
                  </div>
                </div>
                {selectedProgram.instructor && (
                  <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-gray-950/40">
                    <User className="h-5 w-5 text-primary/60 shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Instructor</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{selectedProgram.instructor}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4">
            <CheckCircle2 className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-200">
              <p className="font-semibold">Application will be reviewed</p>
              <p className="text-xs mt-1 opacity-90">Staff will review your application and notify you of the outcome via email.</p>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2.5 sm:flex-col pt-2">
            <Button 
              onClick={handleApply} 
              disabled={applying}
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            >
              {applying ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-transparent border-t-white mr-2"></div>
                  Submitting Application...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                  Submit Application
                </>
              )}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setApplyDialogOpen(false)} 
              disabled={applying}
              size="lg"
              className="w-full"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trainee Program Details Modal */}
      <TraineeProgramDetailsModal
        program={selectedProgram}
        open={programDetailsModalOpen}
        onOpenChange={setProgramDetailsModalOpen}
        onEnroll={() => {
          setProgramDetailsModalOpen(false);
          setApplyDialogOpen(true);
        }}
        isEnrolling={applying && selectedProgram?.id !== undefined}
        isEnrolled={selectedProgram ? (enrollmentData.get(selectedProgram.id)?.isEnrolled || false) : false}
        enrollmentStatus={selectedProgram ? (enrollmentData.get(selectedProgram.id)?.enrollmentStatus || 'accepting') : 'accepting'}
        enrollmentDate={selectedProgram ? enrollmentData.get(selectedProgram.id)?.enrollmentDate : undefined}
        graduatedDate={selectedProgram ? enrollmentData.get(selectedProgram.id)?.graduatedDate : undefined}
      />
    </DashboardLayout>
  );
}
