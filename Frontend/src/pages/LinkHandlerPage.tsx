import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import programSharingService from '../services/programSharingService';
import featureFlagService from '../services/featureFlagService';

/**
 * LinkHandlerPage - Handles social program sharing links
 * 
 * Responsibilities:
 * 1. Check if SOCIAL_PROGRAM_SHARING feature is enabled
 * 2. Extract program_id from URL query parameter
 * 3. Validate the program exists and is active
 * 4. Store program_id in LocalStorage if valid
 * 5. Detect user type (authenticated vs unauthenticated)
 * 6. Route user appropriately based on user type
 * 7. Display loading state during validation
 * 8. Clear URL query parameter after processing
 */
export default function LinkHandlerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, isAuthReady, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureEnabled, setFeatureEnabled] = useState(false);
  const [featureCheckDone, setFeatureCheckDone] = useState(false);

  // Feature is always enabled for social sharing links
  useEffect(() => {
    setFeatureEnabled(true);
    setFeatureCheckDone(true);
  }, []);

  // Process the link
  useEffect(() => {
    if (!featureCheckDone) {
      return;
    }

    const handleProgramLink = async () => {
      try {
        setLoading(true);
        setError(null);

        // Extract program_id from URL query parameter
        const programId = searchParams.get('program_id');

        // If no program_id, redirect to home
        if (!programId) {
          navigate('/', { replace: true });
          return;
        }

        // Validate program_id format (basic UUID check)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(programId)) {
          localStorage.removeItem('selected_program_id');
          setError('Invalid program link format');
          toast.error('Invalid program link');
          navigate('/', { replace: true });
          return;
        }

        // Validate program exists and is active
        try {
          const response = await programSharingService.validateProgramShare(programId);
          
          if (!response.isValid || !response.isActive) {
            localStorage.removeItem('selected_program_id');
            setError('This program is no longer available');
            toast.error('This program is no longer available');
            navigate('/programs', { replace: true });
            return;
          }

          if (!response.isPublic) {
            localStorage.removeItem('selected_program_id');
            setError('This program is not available for public enrollment');
            toast.error('This program is not available for public enrollment');
            navigate('/programs', { replace: true });
            return;
          }

          // Store program_id in LocalStorage
          localStorage.setItem('selected_program_id', programId);

          // Clear URL query parameter and redirect based on user type
          if (!isAuthReady) {
            // Still checking auth status, wait
            return;
          }

          if (isAuthenticated) {
            // Authenticated user - redirect to program page
            navigate(`/programs/${programId}`, { replace: true });
          } else {
            // Unauthenticated user - redirect to login
            navigate('/login', { replace: true });
          }
        } catch (err) {
          localStorage.removeItem('selected_program_id');
          console.error('Error validating program:', err);
          setError('Unable to validate program');
          toast.error('Unable to validate program. Please try again.');
          navigate('/', { replace: true });
        }
      } catch (err) {
        localStorage.removeItem('selected_program_id');
        console.error('Error handling program link:', err);
        setError('An error occurred');
        toast.error('An error occurred processing the link');
        navigate('/', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    // Only process link if auth is ready
    if (isAuthReady) {
      handleProgramLink();
    }
  }, [searchParams, navigate, isAuthenticated, isAuthReady, featureCheckDone, featureEnabled]);

  // Show loading spinner while checking feature flag or validating
  if (loading || !isAuthReady || !featureCheckDone) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-muted-foreground">Validating program...</p>
        </div>
      </div>
    );
  }

  // Show error state if validation failed
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <p className="text-lg text-destructive font-semibold">{error}</p>
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  // This component redirects, so shouldn't render normally
  return null;
}
