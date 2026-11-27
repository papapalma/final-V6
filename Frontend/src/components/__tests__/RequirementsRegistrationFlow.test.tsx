import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FilePreviewModal from '../FilePreviewModal';
import TraineePreviewModal from '../TraineePreviewModal';
import api, { apiClient } from '../../services/api';

vi.mock('../../services/api', () => {
  const apiMock = {
    get: vi.fn(),
    post: vi.fn(),
    downloadFile: vi.fn().mockResolvedValue(undefined),
  };
  return {
    default: apiMock,
    api: apiMock,
    apiClient: {
      get: vi.fn(),
    },
    getFileUrl: (p: string) => p,
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

describe('Requirement loading, authenticated preview, and download flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.URL.createObjectURL = vi.fn(() => 'blob:mock-preview-url');
    window.URL.revokeObjectURL = vi.fn();
  });

  it('FilePreviewModal detects image extension with ?v= query param and loads via authenticated apiClient', async () => {
    (apiClient.get as any).mockResolvedValue({
      data: new Blob(['fake-image'], { type: 'image/jpeg' }),
    });

    render(
      <FilePreviewModal
        open={true}
        onOpenChange={vi.fn()}
        traineeId="trainee-123"
        file={{
          file_id: 'file-456',
          file_path: 'http://localhost:3003/api/files/tenant-1/documents/trainees/trainee-123/id_pic.jpg?v=abc123',
          file_name: 'id_pic.jpg',
          requirement_type: 'id_pictures',
          uploaded_at: '2026-11-27T00:00:00Z',
        }}
      />
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith(
        '/trainees/trainee-123/requirements/id_pictures/download?file_id=file-456',
        { responseType: 'blob' }
      );
    });

    const img = await screen.findByRole('img', { name: 'id_pic.jpg' });
    expect(img).toHaveAttribute('src', 'blob:mock-preview-url');
  });

  it('TraineePreviewModal loads requirements without stale cache and downloads using authenticated api.downloadFile', async () => {
    const user = userEvent.setup();
    (api.get as any).mockResolvedValue({
      success: true,
      files: [
        {
          id: 'req-file-1',
          requirement_type: 'birth_certificate_copy',
          file_name: 'birth_cert.pdf',
          file_path: '/uploads/tenant-1/documents/trainees/trainee-9/birth_cert.pdf',
        },
      ],
    });

    render(
      <TraineePreviewModal
        open={true}
        onOpenChange={vi.fn()}
        trainee={{
          id: 'trainee-9',
          username: 'juan',
          email: 'juan@example.com',
          first_name: 'Juan',
          last_name: 'Dela Cruz',
          middle_name: '',
          phone: '09171234567',
          sex: 'Male',
          birth_date: '2000-01-01',
          birth_place: 'Manila',
          civil_status: 'Single',
          province: 'Laguna',
          municipality: 'Calamba',
          barangay: 'Uno',
          street: '123 Main',
          educational_attainment: 'College',
          course: 'BSIT',
          year_graduated: '2022',
          classification: 'Student',
          employment_status: 'Unemployed',
          program_id: 'prog-1',
          status: 'pending',
          created_at: '2026-11-27T00:00:00Z',
          updated_at: '2026-11-27T00:00:00Z',
        }}
      />
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/trainees/trainee-9/requirements',
        undefined,
        { headers: { 'X-Skip-Cache': 'true' } }
      );
    });

    await user.click(screen.getByRole('tab', { name: /Requirements/i }));
    const downloadBtn = await screen.findByRole('button', { name: /Download/i });
    await user.click(downloadBtn);

    expect(api.downloadFile).toHaveBeenCalledWith(
      '/trainees/trainee-9/requirements/birth_certificate_copy/download?file_id=req-file-1',
      'birth_cert.pdf'
    );
  });
});
