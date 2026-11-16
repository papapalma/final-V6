import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

export interface SubmittedTraineeRequirementFile {
  id: string;
  trainee_id: string;
  trainee_name: string;
  trainee_email: string;
  requirement_type: string;
  file_path: string;
  file_name: string;
  file_size_bytes: number;
  uploaded_at: string;
}

interface SubmittedTraineesResponse {
  data: SubmittedTraineeRequirementFile[];
  pagination?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export function useRequirementSubmittedTrainees(requirementId: string) {
  const [data, setData] = useState<SubmittedTraineeRequirementFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<SubmittedTraineesResponse>(
        `/requirement-definitions/${requirementId}/submitted-trainees?limit=100`
      );
      const items = Array.isArray(response.data)
        ? (response.data as SubmittedTraineeRequirementFile[])
        : (response.data?.data || []);
      setData(items);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load submitted trainees'));
    } finally {
      setIsLoading(false);
    }
  }, [requirementId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { data, isLoading, error, refetch };
}
