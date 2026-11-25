import React, { useState, useRef, ChangeEvent, KeyboardEvent } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Paperclip, Send, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { messengerApi, MessageAttachment } from '../../services/messengerService';
import { toast } from 'sonner';

interface MessageInputProps {
  conversationId?: string;
  onSendMessage: (content: string, attachment?: MessageAttachment) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

export const MessageInput: React.FC<MessageInputProps> = ({
  conversationId,
  onSendMessage,
  placeholder = 'Type a message...',
  disabled = false,
}) => {
  const [content, setContent] = useState('');
  const [attachment, setAttachment] = useState<MessageAttachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const canSend = Boolean((content.trim() || attachment) && !isUploading && !disabled);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size exceeds the 15MB limit');
      return;
    }

    setIsUploading(true);
    try {
      const uploaded = await messengerApi.uploadAttachment(file, conversationId);
      if (!uploaded?.url) {
        throw new Error('Upload succeeded without file URL');
      }
      setAttachment(uploaded);
      toast.success('File attached');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * 0ms non-blocking send: clears input immediately and preserves textarea focus
   * so rapid-fire messages never stall waiting on the network.
   */
  const handleSend = () => {
    const trimmed = content.trim();
    if ((!trimmed && !attachment) || isUploading || disabled) return;

    const outgoingAttachment = attachment || undefined;

    // Clear composer synchronously on the current frame before network dispatch
    setContent('');
    setAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }

    void Promise.resolve(onSendMessage(trimmed, outgoingAttachment)).catch((err: any) => {
      toast.error(err?.message || 'Failed to send message');
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  return (
    <div className="border-t border-border bg-card/90 px-4 py-3 backdrop-blur-md sm:px-6">
      {/* Animated Attachment Preview Chip */}
      <AnimatePresence initial={false}>
        {attachment && (
          <motion.div
            key={attachment.url || attachment.name}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: prefersReducedMotion ? 0.14 : 0.16, ease: EASE_OUT }}
            style={{ transformOrigin: 'left bottom' }}
            className="mb-2 flex w-fit max-w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs text-primary"
          >
            {attachment.type === 'image' ? (
              <ImageIcon className="size-3.5 shrink-0" />
            ) : (
              <Paperclip className="size-3.5 shrink-0" />
            )}
            <span className="max-w-[200px] truncate font-medium">{attachment.name}</span>
            <button
              type="button"
              onClick={() => setAttachment(null)}
              aria-label="Remove attachment"
              className="ml-1 rounded-full p-0.5 transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Row */}
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
        />

        {/* Attachment Trigger */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          className="size-10 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Attach file or photo"
          aria-label="Attach file or photo"
        >
          {isUploading ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <Paperclip className="size-4" />
          )}
        </Button>

        {/* Text Area — never locked while messages dispatch in FIFO queue */}
        <div className="relative flex-1 rounded-2xl border border-border bg-muted/60 transition-all focus-within:border-primary focus-within:bg-card focus-within:ring-2 focus-within:ring-ring/25">
          <textarea
            ref={textareaRef}
            rows={1}
            value={content}
            onChange={handleTextareaInput}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Message input"
            disabled={disabled}
            className="max-h-32 w-full resize-none bg-transparent px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none sm:text-sm"
          />
        </div>

        {/* Tactile Send Button */}
        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          title="Send message"
          className={`messenger-send-btn size-10 shrink-0 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 ${
            canSend ? 'scale-100 opacity-100 shadow-sm' : 'scale-95 opacity-40 shadow-none'
          }`}
        >
          <Send className="ml-0.5 size-4" />
        </Button>
      </div>
    </div>
  );
};
