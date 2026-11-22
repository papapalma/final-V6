import { useState, ImgHTMLAttributes } from 'react';
import { Skeleton } from './skeleton';
import { cn } from './utils';
import { ImageOff, BookOpen } from 'lucide-react';

interface ImageWithSkeletonProps extends ImgHTMLAttributes<HTMLImageElement> {
  containerClassName?: string;
  fallbackIcon?: React.ReactNode;
}

export function ImageWithSkeleton({
  src,
  alt,
  className,
  containerClassName,
  fallbackIcon,
  ...props
}: ImageWithSkeletonProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={cn('relative w-full h-full overflow-hidden bg-muted/40', containerClassName)}>
      {/* Animated shimmer skeleton shown while loading */}
      {!isLoaded && !hasError && (
        <Skeleton className="absolute inset-0 w-full h-full rounded-none" />
      )}

      {/* Actual image */}
      {!hasError && src ? (
        <img
          src={src}
          alt={alt || ''}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          onError={() => {
            setHasError(true);
            setIsLoaded(true);
          }}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
          {...props}
        />
      ) : (
        /* Fallback placeholder when image is missing or broken */
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/50 text-muted-foreground p-4 text-center">
          {fallbackIcon || <BookOpen className="size-8 stroke-1 text-primary/40 mb-1" />}
          <span className="text-xs font-medium text-muted-foreground/80 line-clamp-1">
            {alt || 'Program Image'}
          </span>
        </div>
      )}
    </div>
  );
}

export default ImageWithSkeleton;
