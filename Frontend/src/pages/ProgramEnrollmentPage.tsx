import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '../components/DashboardLayout';
import TraineeProgramDetailsModal from '../components/TraineeProgramDetailsModal';
import logger from '../utils/logger';
import programService from '../services/programService';
import api from '../services/api';

/**
 * ProgramEnrollmentPage - Trainee enrollment page for shared program links
 * 
 * Responsibilities:
 * 1. Extract program_id from URL params
 * 2. Fetch program details directly from API
 * 3. Check if trainee is already enrolled in the program
 * 4. Show the page first, then open enrollment modal
 * 5. Handle enrollment submission
 * 
 * Requirements: 4.3, 4.4, 5.1
 */
export default function ProgramEnrollmentPage() {
  const { id: programId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [program, setProgram] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [enrollmentOpen, setEnrollmentOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [enrollmentStatus, setEnrollmentStatus] = useState<'accepting' | 'in-progress' | 'completed'>('accepting');
  const [enrollmentDate, setEnrollmentDate] = useState<Date | undefined>();

  // Fetch program data and check enrollment status
  useEffect(() => {
    const fetchData = async () => {
      if (!programId || !user) {
        navigate('/', { replace: true });
        return;
      }

      try {
        setLoading(true);
        
        // Fetch program
        const programData = await programService.getProgramById(programId);
        if (!programData) {
          toast.error('Program not found');
          navigate('/trainee/programs', { replace: true });
          return;
        }
        setProgram(programData);
        logger.debug('Program loaded for enrollment', { programId });

        // Check enrollment status
        try {
          const enrollmentsResponse = await api.get('/trainees/me/enrollments');
          const enrollments = (enrollmentsResponse.data?.data || enrollmentsResponse.data) as any[];
          
          const enrollment = enrollments.find((e: any) => e.program_id === programId);
          
          if (enrollment) {
            setIsEnrolled(true);
            logger.debug('Trainee already enrolled in program', { programId, enrollmentStatus: enrollment.status });
            
            // Set enrollment status based on status field
            if (enrollment.status === 'completed' || enrollment.status === 'graduated') {
              setEnrollmentStatus('completed');
            } else {
              setEnrollmentStatus('in-progress');
            }
            
            // Set enrollment date
            if (enrollment.created_at) {
              setEnrollmentDate(new Date(enrollment.created_at));
            }
          }
        } catch (enrollmentError) {
          logger.debug('Could not fetch enrollment status', { error: enrollmentError });
          // Continue - enrollment check is optional
        }

        // Auto-open the modal after a brief delay
        setTimeout(() => {
          setEnrollmentOpen(true);
        }, 300);
      } catch (error) {
        logger.error('Failed to load program', { error, programId });
        toast.error('Failed to load program details');
        navigate('/trainee/programs', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [programId, user, navigate]);

  const handleEnroll = async () => {
    if (!user || !program) {
      toast.error('Missing required information');
      return;
    }

    setEnrolling(true);
    try {
      // Server resolves the canonical trainees.id from the authenticated JWT
      const response = await programService.enrollTraineeInProgram(program.id, {});

      if (response) {
        toast.success('Successfully enrolled in program!');
        logger.info('Trainee enrolled in program', {
          userId: user.id,
          programId: program.id,
          programName: program.name,
        });
        
        // Clear program from storage after successful enrollment
        localStorage.removeItem('selected_program_id');
        localStorage.removeItem('selected_program_tenant_id');
        
        // Update UI to show enrolled state
        setIsEnrolled(true);
        setEnrollmentStatus('in-progress');
        setEnrollmentDate(new Date());
        
        // Redirect after a delay
        setTimeout(() => {
          navigate('/trainee/programs', { replace: true });
        }, 1000);
      } else {
        toast.error('Failed to enroll in program');
      }
    } catch (error: any) {
      const errorMsg =
        error?.message ||
        (error instanceof Error ? error.message : 'Enrollment failed');
      toast.error(errorMsg);
      logger.error('Failed to enroll trainee', { error });
    } finally {
      setEnrolling(false);
    }
  };

  const handleCancel = () => {
    setEnrollmentOpen(false);
    navigate('/trainee/programs', { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <p className="text-lg text-muted-foreground">Loading program details...</p>
            </div>
          </div>
        ) : program ? (
          <>
            <div className="mb-6">
              <h1 className="text-3xl font-bold">{program.name}</h1>
              <p className="text-muted-foreground mt-2">Program Enrollment</p>
            </div>
          </>
        ) : null}
      </div>

      {program && (
        <TraineeProgramDetailsModal
          program={program}
          open={enrollmentOpen}
          onOpenChange={(open) => {
            if (!open) {
              handleCancel();
            }
          }}
          onEnroll={handleEnroll}
          isEnrolling={enrolling}
          isEnrolled={isEnrolled}
          enrollmentStatus={enrollmentStatus}
          enrollmentDate={enrollmentDate}
        />
      )}
    </DashboardLayout>
  );
}