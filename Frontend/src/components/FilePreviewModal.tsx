import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import api, { apiClient, getFileUrl } from '../services/api';

export interface FilePreviewData {
  file_id?: string;
  file_path: string;
  file_name: string;
  requirement_type: string;
  uploaded_at?: string;
}

interface FilePreviewModalProps {
  file: FilePreviewData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  traineeId?: string;
}

function extractExtension(value?: string): string {
  if (!value) return '';
  const withoutQuery = value.split(/[?#]/)[0];
  const parts = withoutQuery.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() || '' : '';
}

export default function FilePreviewModal({ file, open, onOpenChange, traineeId }: FilePreviewModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isImage, setIsImage] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setScale(1);
      setRotation(0);
      setIsImage(false);
      setIsPdf(false);
      setPreviewBlobUrl(null);
      setPreviewError(null);
      return;
    }

    const ext = extractExtension(file.file_name) || extractExtension(file.file_path);
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
    
    setIsImage(imageExtensions.includes(ext));
    setIsPdf(ext === 'pdf');
    setScale(1);
    setRotation(0);
  }, [file]);

  useEffect(() => {
    if (!open || !file || !isImage) {
      setPreviewBlobUrl(null);
      setPreviewError(null);
      setLoadingPreview(false);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const loadAuthenticatedPreview = async () => {
      try {
        setLoadingPreview(true);
        setPreviewError(null);
        // Fetch via apiClient so Authorization header is included for tenant-private documents
        const url = traineeId
          ? `/trainees/${traineeId}/requirements/${file.requirement_type}/download${
              file.file_id ? `?file_id=${encodeURIComponent(file.file_id)}` : ''
            }`
          : getFileUrl(file.file_path);
        const response = await apiClient.get(url, { responseType: 'blob' });
        if (cancelled) return;
        const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
        objectUrl = window.URL.createObjectURL(blob);
        setPreviewBlobUrl(objectUrl);
      } catch (err) {
        if (!cancelled) {
          console.error('[FilePreviewModal] Failed to load authenticated preview:', err);
          setPreviewError('Preview could not be loaded. Use Download to view the file.');
          setPreviewBlobUrl(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      }
    };

    loadAuthenticatedPreview();

    return () => {
      cancelled = true;
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
    };
  }, [open, file, isImage, traineeId]);

  const handleDownload = async () => {
    if (!file || !traineeId) return;
    
    try {
      setIsDownloading(true);
      const downloadUrl = `/trainees/${traineeId}/requirements/${file.requirement_type}/download${
        file.file_id ? `?file_id=${encodeURIComponent(file.file_id)}` : ''
      }`;
      const fileName = file.file_name || 'document';
      
      console.log('[FilePreviewModal] Downloading file', { 
        downloadUrl, 
        fileName, 
        traineeId,
        requirementType: file.requirement_type,
        fileSize: 'pending'
      });
      
      await api.downloadFile(downloadUrl, fileName);
      
      console.log('[FilePreviewModal] Download complete');
    } catch (error) {
      console.error('[FilePreviewModal] Download failed:', error);
      alert(error instanceof Error ? error.message : 'Failed to download file. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3));
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5));
  const rotate = () => setRotation(prev => (prev + 90) % 360);

  const formatType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const uploadDate = file?.uploaded_at 
    ? new Date(file.uploaded_at).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    : 'Unknown date';

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="border-b pb-3">
          <div className="flex-1">
            <DialogTitle className="text-lg font-semibold">
              {formatType(file.requirement_type)}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Preview the submitted requirement file and download it if needed.
            </DialogDescription>
            <div className="text-sm text-muted-foreground mt-1 space-y-1">
              <p>File: {file.file_name}</p>
              <p>Uploaded: {uploadDate}</p>
            </div>
          </div>
        </DialogHeader>

        {/* Preview Section */}
        <div className="flex-1 overflow-auto bg-muted/30 rounded-lg flex items-center justify-center min-h-96">
          {isImage ? (
            loadingPreview ? (
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            ) : previewError ? (
              <div className="text-center space-y-2 px-4">
                <p className="text-sm text-muted-foreground">{previewError}</p>
              </div>
            ) : previewBlobUrl ? (
              <div 
                style={{
                  transform: `scale(${scale}) rotate(${rotation}deg)`,
                  transformOrigin: 'center',
                  transition: 'transform 0.2s ease-out',
                }}
              >
                <img 
                  src={previewBlobUrl}
                  alt={file.file_name}
                  className="max-h-96 max-w-2xl object-contain rounded"
                />
              </div>
            ) : null
          ) : isPdf ? (
            <div className="text-center space-y-4">
              <div className="text-6xl">📄</div>
              <div>
                <p className="text-muted-foreground font-medium mb-2">{file.file_name}</p>
                <p className="text-sm text-muted-foreground">PDF file - click download to save</p>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="text-6xl">📎</div>
              <div>
                <p className="text-muted-foreground font-medium mb-2">{file.file_name}</p>
                <p className="text-sm text-muted-foreground">This file type cannot be previewed</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="border-t pt-3 space-y-3">
          {/* Image Controls */}
          {isImage && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={zoomOut}
                disabled={scale <= 0.5}
              >
                <ZoomOut className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-12 text-center">
                {Math.round(scale * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={zoomIn}
                disabled={scale >= 3}
              >
                <ZoomIn className="size-4" />
              </Button>
              <div className="border-l mx-2 h-6" />
              <Button
                variant="outline"
                size="sm"
                onClick={rotate}
              >
                <RotateCw className="size-4" />
              </Button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button onClick={handleDownload} disabled={isDownloading} className="gap-2">
              <Download className="size-4" />
              {isDownloading ? 'Downloading...' : 'Download'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}



