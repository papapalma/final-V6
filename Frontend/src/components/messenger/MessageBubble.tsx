import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Message, messengerApi } from '../../services/messengerService';
import { getFileUrl } from '../../services/api';
import { format } from 'date-fns';
import {
  FileText,
  Download,
  Undo2,
  MoreVertical,
  Loader2,
  ImageOff,
  Check,
  Clock,
  AlertCircle,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Badge } from '../ui/badge';

interface MessageBubbleProps {
  message: Message;
  isCurrentUser: boolean;
  onUnsend?: (messageId: string) => void;
  onStartDM?: (userId: string) => void;
  onRetry?: (clientKey: string) => void;
  showAvatar?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isCurrentUser,
  onUnsend,
  onStartDM,
  onRetry,
  showAvatar = true,
}) => {
  const [isUnsending, setIsUnsending] = useState(false);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  // Load private tenant-scoped image attachments via Bearer-authenticated Blob fetch
  useEffect(() => {
    let isActive = true;
    let createdBlobUrl: string | null = null;

    if (message.isDeleted || !message.attachmentUrl || message.attachmentType !== 'image') {
      setImageBlobUrl(null);
      setImageLoading(false);
      setImageError(false);
      return;
    }

    setImageLoading(true);
    setImageError(false);

    messengerApi
      .fetchAttachmentBlobUrl(message.attachmentUrl)
      .then((blobUrl) => {
        if (!isActive) {
          if (blobUrl.startsWith('blob:')) URL.revokeObjectURL(blobUrl);
          return;
        }
        createdBlobUrl = blobUrl;
        setImageBlobUrl(blobUrl);
      })
      .catch(() => {
        if (isActive) setImageError(true);
      })
      .finally(() => {
        if (isActive) setImageLoading(false);
      });

    return () => {
      isActive = false;
      if (createdBlobUrl && createdBlobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(createdBlobUrl);
      }
    };
  }, [message.isDeleted, message.attachmentUrl, message.attachmentType]);

  const isSending = message.status === 'sending';
  const isFailed = message.status === 'failed';

  // Check if message is within 15-minute unsend window (persisted messages only)
  const createdMs = new Date(message.createdAt).getTime();
  const messageAgeMs = Number.isNaN(createdMs) ? Infinity : Date.now() - createdMs;
  const canUnsend =
    isCurrentUser &&
    !message.isDeleted &&
    !isSending &&
    !isFailed &&
    messageAgeMs <= 15 * 60 * 1000;

  const handleUnsend = async () => {
    if (!onUnsend || isUnsending) return;
    setIsUnsending(true);
    try {
      await onUnsend(message.id);
    } finally {
      setIsUnsending(false);
    }
  };

  const handleDownloadAttachment = async () => {
    if (!message.attachmentUrl || isDownloading) return;
    setIsDownloading(true);
    try {
      await messengerApi.downloadAttachment(
        message.attachmentUrl,
        message.attachmentName || 'Document'
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download attachment');
    } finally {
      setIsDownloading(false);
    }
  };

  let formattedTime = '';
  try {
    formattedTime = format(new Date(message.createdAt), 'h:mm a');
  } catch {
    formattedTime = '';
  }

  const avatarElement = (
    <Avatar className="w-7 h-7 mb-0.5 border border-white/20 shadow-xs">
      <AvatarImage src={message.senderAvatar ? getFileUrl(message.senderAvatar) : undefined} />
      <AvatarFallback className="bg-gradient-to-tr from-blue-600 to-indigo-600 text-white text-[11px] font-medium">
        {(message.senderName || 'U').slice(0, 2).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  );

  // Only newly sent/received live messages animate — historical backlog mounts instantly
  const shouldAnimateEntrance = Boolean(message.isNew);
  const initialVariant = shouldAnimateEntrance
    ? prefersReducedMotion
      ? { opacity: 0 }
      : { opacity: 0, y: 8, scale: 0.97 }
    : false;
  const entranceTransition = prefersReducedMotion
    ? { duration: 0.14, ease: 'easeOut' as const }
    : { type: 'spring' as const, duration: 0.2, bounce: 0 };

  return (
    <motion.div
      initial={initialVariant}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={entranceTransition}
      style={{ transformOrigin: isCurrentUser ? 'bottom right' : 'bottom left' }}
      className={`group flex items-end gap-2 mb-2 ${
        isCurrentUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {/* Avatar for other users */}
      {!isCurrentUser && showAvatar && (
        onStartDM ? (
          <button
            type="button"
            onClick={() => onStartDM(message.senderId)}
            className="rounded-full transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            title={`Message ${message.senderName}`}
            aria-label={`Message ${message.senderName}`}
          >
            {avatarElement}
          </button>
        ) : (
          <div aria-hidden="true">{avatarElement}</div>
        )
      )}

      {/* Bubble Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] flex flex-col ${
          isCurrentUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Sender Name in group chats */}
        {!isCurrentUser && showAvatar && (
          <div className="flex items-center gap-1.5 mb-1 px-1">
            <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">
              {message.senderName}
            </span>
            {message.senderRole !== 'trainee' && (
              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                Staff
              </Badge>
            )}
          </div>
        )}

        {/* Message Content Bubble */}
        <div className="relative group/bubble flex items-center gap-1">
          {/* Action Menu (for current user unsend) */}
          {canUnsend && (
            <div className="opacity-0 group-hover/bubble:opacity-100 transition-opacity">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Message actions"
                    className="size-6 rounded-full text-muted-foreground hover:bg-muted"
                  >
                    <MoreVertical className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32 backdrop-blur-md bg-white/95 dark:bg-slate-900/95">
                  <DropdownMenuItem
                    onClick={handleUnsend}
                    disabled={isUnsending}
                    className="text-red-600 focus:text-red-700 text-xs flex items-center gap-2 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Unsend
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          <div
            className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed shadow-xs break-words select-text transition-opacity duration-150 ${
              isSending ? 'opacity-85' : 'opacity-100'
            } ${
              message.isDeleted
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 italic border border-dashed border-slate-300 dark:border-slate-700'
                : isCurrentUser
                ? `bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs shadow-blue-500/10 ${
                    isFailed ? 'ring-2 ring-destructive/60' : ''
                  }`
                : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-xs'
            }`}
          >
            {/* Attachment preview */}
            {!message.isDeleted && message.attachmentUrl && (
              <div className="mb-2">
                {message.attachmentType === 'image' ? (
                  imageLoading ? (
                    <div className="flex h-36 w-48 items-center justify-center rounded-xl bg-black/10">
                      <Loader2 className="size-5 animate-spin opacity-75" />
                    </div>
                  ) : imageBlobUrl && !imageError ? (
                    <a
                      href={imageBlobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block overflow-hidden rounded-xl border border-black/10 hover:opacity-95 transition-opacity"
                    >
                      <img
                        src={imageBlobUrl}
                        alt={message.attachmentName || 'Attachment'}
                        className="max-h-60 max-w-full object-cover rounded-xl"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDownloadAttachment}
                      disabled={isDownloading}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition-colors ${
                        isCurrentUser
                          ? 'bg-white/15 hover:bg-white/25 text-white'
                          : 'bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <ImageOff className="size-4 shrink-0 opacity-80" />
                      <span className="truncate">{message.attachmentName || 'Download image'}</span>
                      <Download className="ml-auto size-3.5 shrink-0 opacity-75" />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={handleDownloadAttachment}
                    disabled={isDownloading}
                    className={`flex w-full items-center gap-2.5 p-2 rounded-xl transition-colors text-left ${
                      isCurrentUser
                        ? 'bg-white/15 hover:bg-white/25 text-white'
                        : 'bg-slate-100 dark:bg-slate-700/60 hover:bg-slate-200 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <FileText className="w-5 h-5 shrink-0" />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-xs font-medium truncate">
                        {message.attachmentName || 'Document'}
                      </p>
                      <p className="text-[10px] opacity-75">
                        {isDownloading ? 'Downloading...' : 'Click to download'}
                      </p>
                    </div>
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 shrink-0 animate-spin opacity-80" />
                    ) : (
                      <Download className="w-4 h-4 shrink-0 opacity-70" />
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Text Content */}
            {message.content && <p className="whitespace-pre-wrap">{message.content}</p>}

            {/* Timestamp & Delivery Status */}
            {(formattedTime || (isCurrentUser && !message.isDeleted)) && (
              <div
                className={`mt-1 flex items-center justify-end gap-1 text-[10px] select-none ${
                  isCurrentUser ? 'text-blue-100/85' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {formattedTime && <span>{formattedTime}</span>}
                {isCurrentUser && !message.isDeleted && (
                  <span className="inline-flex items-center transition-opacity duration-150">
                    {isSending ? (
                      <Clock className="size-2.5 opacity-80" aria-label="Sending" />
                    ) : isFailed ? (
                      <AlertCircle className="size-3 text-red-200" aria-label="Failed to send" />
                    ) : (
                      <Check className="size-3 opacity-90" aria-label="Sent" />
                    )}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Inline Retry Bar for Failed Optimistic Sends */}
        {isCurrentUser && isFailed && onRetry && (
          <div className="mt-1 flex items-center gap-1.5 px-1 text-[11px] text-destructive">
            <span>Not sent</span>
            <button
              type="button"
              onClick={() => onRetry(message.clientKey || message.id)}
              className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 font-semibold text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RotateCcw className="size-3" />
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};
