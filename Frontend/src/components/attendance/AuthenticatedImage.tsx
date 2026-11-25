import { useEffect, useState } from 'react';
import { Camera, AlertCircle } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { apiClient, getFileUrl } from '../../services/api';

interface AuthenticatedImageProps {
  path?: string | null;
  alt: string;
  className?: string;
  emptyLabel?: string;
}

/**
 * Loads tenant-scoped private images (e.g. /uploads/{tenant_id}/images/attendance/...)
 * through apiClient so the Authorization: Bearer JWT header is attached.
 */
export default function AuthenticatedImage({
  path,
  alt,
  className = 'w-full h-full object-cover',
  emptyLabel = 'No photo',
}: AuthenticatedImageProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path));
  const [failed, setFailed] = useState<boolean>(false);

  useEffect(() => {
    if (!path) {
      setBlobUrl(null);
      setLoading(false);
      setFailed(false);
      return;
    }

    if (path.startsWith('blob:') || path.startsWith('data:')) {
      setBlobUrl(path);
      setLoading(false);
      setFailed(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;

    setLoading(true);
    setFailed(false);

    const fileUrl = getFileUrl(path);
    apiClient
      .get(fileUrl, { responseType: 'blob' })
      .then((res) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(res.data as Blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        if (!active) return;
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [path]);

  if (!path) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 text-center p-3 w-full h-full">
        <Camera className="size-6 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  if (loading) {
    return <Skeleton className="w-full h-full rounded-lg" />;
  }

  if (failed || !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center gap-1.5 text-center p-3 w-full h-full">
        <AlertCircle className="size-6 text-destructive/70" />
        <p className="text-xs text-muted-foreground">Unable to load photo</p>
      </div>
    );
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}
