import React, { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Program } from '../utils/programHelpers';
import programService from '../services/programService';
import { getThumbnailUrl } from '../services/api';
import logger from '../utils/logger';

interface ProgramsContextType {
  programs: Program[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  addProgram: (program: Program) => void;
  updateProgram: (program: Program) => void;
  deleteProgram: (programId: string) => void;
  syncPrograms: () => Promise<void>;
}

const ProgramsContext = createContext<ProgramsContextType | undefined>(undefined);

export const ProgramsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  /**
   * Fetch programs from API and update cache
   */
  const syncPrograms = useCallback(async () => {
    try {
      // Only show loading state before first payload arrives (stale-while-revalidate on revisits)
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      setError(null);
      const response = await programService.getPrograms({});
      const programsArray = response?.data || [];
      
      // Transform backend data to frontend Program format
      const transformedPrograms: Program[] = programsArray.map((p: any) => {
        // Use getThumbnailUrl which handles all the path logic properly
        const photoUrl = getThumbnailUrl(p.image_path || null);
        
        logger.debug('Program image processing', { 
          programId: p.id,
          programName: p.name,
          image_path: p.image_path,
          photoUrl,
          hasPhoto: !!photoUrl
        });
        
        return {
          id: p.id,
          name: p.name,
          description: p.description || '',
          duration: p.duration_weeks ? `${p.duration_weeks} weeks` : '',
          type_of_funding: p.type_of_funding || '',
          icon: 'GraduationCap',
          status: p.status === 'active' ? 'active' : 'inactive',
          startDate: p.start_date || '',
          endDate: p.end_date || '',
          photoUrl: photoUrl,
          createdAt: p.created_at || '',
          updatedAt: p.updated_at || '',
          instructor: p.instructor || undefined,
          // Include enrollment and staff-only registration fields from backend
          enrollment_limit: p.enrollment_limit,
          max_trainees: p.max_trainees,
          current_enrollment: p.current_enrollment,
          total_registrations: typeof p.total_registrations === 'number' ? p.total_registrations : undefined,
        };
      });

      hasLoadedRef.current = true;
      setPrograms(transformedPrograms);
      logger.debug('Programs synced', { count: transformedPrograms.length, photoUrls: transformedPrograms.filter(p => p.photoUrl).length });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync programs';
      setError(message);
      logger.error('Failed to sync programs', { error: err });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    syncPrograms();
  }, [syncPrograms]);

  /**
   * Add a new program to cache
   */
  const addProgram = useCallback((program: Program) => {
    setPrograms(prev => {
      // Avoid duplicates
      if (prev.some(p => p.id === program.id)) {
        return prev;
      }
      return [...prev, program];
    });
    logger.debug('Program added to cache', { programId: program.id });
  }, []);

  /**
   * Update a program in cache
   */
  const updateProgram = useCallback((program: Program) => {
    setPrograms(prev =>
      prev.map(p => p.id === program.id ? program : p)
    );
    logger.debug('Program updated in cache', { programId: program.id });
  }, []);

  /**
   * Delete a program from cache
   */
  const deleteProgram = useCallback((programId: string) => {
    setPrograms(prev => prev.filter(p => p.id !== programId));
    logger.debug('Program deleted from cache', { programId });
  }, []);

  /**
   * Manual refetch (alias for syncPrograms)
   */
  const refetch = useCallback(async () => {
    await syncPrograms();
  }, [syncPrograms]);

  const value: ProgramsContextType = {
    programs,
    loading,
    error,
    refetch,
    addProgram,
    updateProgram,
    deleteProgram,
    syncPrograms,
  };

  return (
    <ProgramsContext.Provider value={value}>
      {children}
    </ProgramsContext.Provider>
  );
};

/**
 * Hook to use programs context
 */
export const usePrograms = (): ProgramsContextType => {
  const context = useContext(ProgramsContext);
  if (!context) {
    throw new Error('usePrograms must be used within ProgramsProvider');
  }
  return context;
};
