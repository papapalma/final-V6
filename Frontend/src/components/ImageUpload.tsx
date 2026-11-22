import { useState, useRef, DragEvent, MouseEvent } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

interface ImageUploadProps {
  value: string;
  onChange: (value: string) => void;
  /** Optional: receive the raw File object when a new file is selected */
  onFileChange?: (file: File | null) => void;
  label?: string;
  description?: string;
  allowVideo?: boolean;
}

  export default function ImageUpload({ value, onChange, onFileChange, label, description, allowVideo = false }: ImageUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files[0]) {
        handleFile(files[0]);
      }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files[0]) {
        handleFile(files[0]);
      }
    };

    const handleFile = (file: File) => {
        const isVideo = allowVideo && (file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name));
        const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(file.name);

        if (!isImage && !isVideo) {
          alert(allowVideo ? 'Please upload an image (PNG, JPG, WebP) or video (MP4, WebM) file' : 'Please upload an image file');
          return;
        }

          const maxSize = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
          if (file.size > maxSize) {
            alert(isVideo ? 'Video size should be less than 50MB' : 'Image size should be less than 5MB');
            return;
          }

          setIsLoading(true);

            if (isVideo) {
              const url = URL.createObjectURL(file);
              onChange(url);
              onFileChange?.(file);
              setIsLoading(false);
          } else {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              onChange(result);       // base64 preview string
              onFileChange?.(file);   // raw File for actual upload
              setIsLoading(false);
            };
            reader.onerror = () => {
              alert('Error reading file');
              setIsLoading(false);
            };
            reader.readAsDataURL(file);
          }
        };

        const handleRemove = () => {
          onChange('');
          onFileChange?.(null);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        };

        const handleClick = () => {
          fileInputRef.current?.click();
        };

        const isVideo = Boolean(
          allowVideo &&
          value &&
          (
            value.startsWith('data:video/') ||
            value.startsWith('blob:') ||
            /\.(mp4|webm)(\?.*)?$/i.test(value)
          )
        );

        return (
          <div className="space-y-2">
            {label && <label className="text-sm font-medium">{label}</label>}

            <div
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={handleClick}
              className={`
          relative cursor-pointer rounded-lg border-2 border-dashed transition-all
          ${isDragging
                  ? 'border-primary bg-primary/5 scale-[1.02]'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }
          p-3
        `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={allowVideo ? "image/jpeg,image/png,image/webp,video/mp4,video/webm" : "image/*"}
                onChange={handleFileSelect}
                className="hidden"
              />

              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-32 w-full max-w-xs" />
                  <p className="sr-only">Uploading media...</p>
                </div>
              ) : value ? (
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <div className="group relative inline-block max-w-full">
                        {isVideo ? (
                          <div className="relative rounded-md overflow-hidden bg-black/90 shadow">
                            <video
                              src={value}
                              controls
                              playsInline
                              className="h-48 w-auto max-w-full rounded-md object-contain"
                            />
                            <div className="absolute top-2 right-2 flex items-center gap-1.5 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation();
                                  handleClick();
                                }}
                                className="h-7 px-2.5 text-xs shadow-md"
                              >
                                <Upload className="size-3.5 mr-1" />
                                Change
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation();
                                  handleRemove();
                                }}
                                className="h-7 px-2.5 text-xs shadow-md"
                              >
                                <X className="size-3.5 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="relative rounded-md overflow-hidden max-w-full flex justify-center">
                            <img
                              src={value}
                              alt="Upload preview"
                              className="h-48 w-auto max-w-full rounded-md object-cover shadow mx-auto"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation();
                                  handleClick();
                                }}
                              >
                                <Upload className="size-4 mr-2" />
                                Change
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={(e: MouseEvent) => {
                                  e.stopPropagation();
                                  handleRemove();
                                }}
                              >
                                <X className="size-4 mr-2" />
                                Remove
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-center">
                      <div className={`
              flex size-16 items-center justify-center rounded-full transition-all
              ${isDragging ? 'bg-primary/20 scale-110' : 'bg-muted'}
            `}>
                        <ImageIcon className={`size-8 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-medium">
                          {isDragging ? (allowVideo ? 'Drop file here' : 'Drop image here') : 'Click to upload or drag and drop'}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {allowVideo
                            ? 'PNG, JPG, WebP up to 5MB, MP4, WebM up to 50MB'
                            : 'PNG, JPG, GIF, WebP, AVIF up to 5MB'}
                        </p>
                      </div>
                    </div>
        )}
                  </div>

                  {description && !value && (
                    <p className="text-sm text-muted-foreground">{description}</p>
                  )}
                </div>
              );
}
