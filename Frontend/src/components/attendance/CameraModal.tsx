/**
 * CameraModal
 *
 * Full-screen live front-camera selfie capture.
 * - Uses getUserMedia({ video: { facingMode: 'user' } })
 * - Gallery upload (<input type="file">) remains intentionally disabled in production
 * - Optical shutter flash + tactile pointer-down feedback (Apple Fluid Principles)
 * - DEV-only (import.meta.env.DEV) simulated camera stream fallback when no physical
 *   camera is available so automated E2E /browser tests exercise the full capture ->
 *   preview -> JPEG blob -> upload -> verification pipeline without weakening prod security.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { X, Camera, RotateCcw, Check, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export interface CameraModalProps {
  isOpen: boolean;
  sessionLabel: 'morning' | 'afternoon';
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

type CameraState = 'loading' | 'live' | 'simulated_dev' | 'preview' | 'denied' | 'unsupported';

export default function CameraModal({
  isOpen,
  sessionLabel,
  onCapture,
  onClose,
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simCanvasRef = useRef<HTMLCanvasElement>(null);
  const simRafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [state, setState] = useState<CameraState>('loading');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [shutterFlash, setShutterFlash] = useState(false);

  const sessionText = sessionLabel === 'morning' ? 'Morning Time In' : 'Afternoon Time Out';

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (simRafRef.current !== null) {
      cancelAnimationFrame(simRafRef.current);
      simRafRef.current = null;
    }
  }, []);

  const revokePreview = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  // DEV-only animated synthetic camera stream so /browser E2E tests produce a real JPEG blob
  const startDevSimulatedCamera = useCallback(() => {
    if (!import.meta.env.DEV) return;
    stopStream();
    revokePreview();
    setPreviewBlob(null);
    setState('simulated_dev');
  }, [stopStream, revokePreview]);

  useEffect(() => {
    if (!import.meta.env.DEV || state !== 'simulated_dev') return;

    let running = true;
    const renderFrame = () => {
      if (!running) return;
      const c = simCanvasRef.current;
      if (c) {
        c.width = 640;
        c.height = 480;
        const ctx = c.getContext('2d');
        if (ctx) {
          // Subtle studio gradient background
          const grad = ctx.createLinearGradient(0, 0, 640, 480);
          grad.addColorStop(0, '#0f172a');
          grad.addColorStop(1, '#1e3a8a');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 640, 480);

          // Portrait silhouette inside the face guide
          ctx.fillStyle = '#38bdf8';
          ctx.beginPath();
          ctx.arc(320, 195, 62, 0, Math.PI * 2);
          ctx.fill();

          ctx.beginPath();
          ctx.ellipse(320, 365, 115, 92, 0, Math.PI, 0, false);
          ctx.fill();

          // Live timestamp & session watermark
          ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
          ctx.fillRect(20, 412, 600, 48);
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 16px system-ui, sans-serif';
          ctx.fillText(`BMDC DEV CAMERA · ${sessionText.toUpperCase()}`, 36, 434);
          ctx.fillStyle = '#93c5fd';
          ctx.font = '13px monospace';
          ctx.fillText(new Date().toLocaleString(), 36, 452);
        }
      }
      simRafRef.current = requestAnimationFrame(renderFrame);
    };

    simRafRef.current = requestAnimationFrame(renderFrame);
    return () => {
      running = false;
      if (simRafRef.current !== null) {
        cancelAnimationFrame(simRafRef.current);
        simRafRef.current = null;
      }
    };
  }, [state, sessionText]);

  const startCamera = useCallback(async () => {
    setState('loading');
    revokePreview();
    setPreviewBlob(null);

    if (import.meta.env.DEV && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('testCamera') === '1') {
        startDevSimulatedCamera();
        return;
      }
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unsupported');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setState('live');
      }
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setState('denied');
      } else {
        setState('unsupported');
      }
    }
  }, [revokePreview, startDevSimulatedCamera]);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopStream();
      revokePreview();
      setPreviewBlob(null);
      setState('loading');
    }
    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const finalizeCanvasBlob = useCallback((sourceCanvas: HTMLCanvasElement) => {
    setShutterFlash(true);
    setTimeout(() => setShutterFlash(false), 160);

    sourceCanvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setPreviewBlob(blob);
        setPreviewUrl(url);
        stopStream();
        setState('preview');
      },
      'image/jpeg',
      0.85
    );
  }, [stopStream]);

  const handleCapture = useCallback(() => {
    if (import.meta.env.DEV && state === 'simulated_dev' && simCanvasRef.current) {
      finalizeCanvasBlob(simCanvasRef.current);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    finalizeCanvasBlob(canvas);
  }, [state, finalizeCanvasBlob]);

  const handleRetake = useCallback(() => {
    revokePreview();
    setPreviewBlob(null);
    startCamera();
  }, [revokePreview, startCamera]);

  const handleConfirm = useCallback(() => {
    if (previewBlob) {
      onCapture(previewBlob);
    }
  }, [previewBlob, onCapture]);

  const handleClose = useCallback(() => {
    stopStream();
    revokePreview();
    setPreviewBlob(null);
    setState('loading');
    onClose();
  }, [stopStream, revokePreview, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Take attendance selfie"
      className="att-camera-sheet fixed inset-0 z-50 flex flex-col bg-black"
    >
      <canvas ref={canvasRef} className="hidden" />

      {/* Optical shutter flash on capture */}
      {shutterFlash && (
        <div
          aria-hidden="true"
          className="att-shutter-flash pointer-events-none fixed inset-0 z-30 bg-white"
        />
      )}

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 z-20 absolute top-0 left-0 right-0">
        <Badge
          variant="secondary"
          className="bg-black/60 text-white border-white/30 backdrop-blur-xs py-1 px-2.5 text-xs"
        >
          {sessionLabel === 'morning' ? '☀' : '🌙'} {sessionText}
        </Badge>

        <span className="text-white/70 text-xs hidden sm:block">
          {state === 'simulated_dev' ? 'Simulated Camera (DEV)' : 'Front camera'}
        </span>

        <button
          onClick={handleClose}
          aria-label="Close camera"
          className="flex items-center justify-center size-10 rounded-full bg-black/60 text-white hover:bg-black/80 active:scale-95 transition-all backdrop-blur-xs"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        {state === 'loading' && (
          <div className="flex flex-col items-center gap-3 text-white">
            <Loader2 className="size-10 animate-spin text-white/70" />
            <p className="text-sm text-white/70">Starting camera…</p>
          </div>
        )}

        {state === 'unsupported' && (
          <div className="flex flex-col items-center gap-4 text-white px-8 text-center max-w-md">
            <AlertCircle className="size-12 text-red-400" />
            <p className="text-base font-semibold">Camera not available</p>
            <p className="text-sm text-white/70">
              Your device or browser doesn&apos;t have an active camera feed.
              Please use a modern browser on a device with a front camera.
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              {import.meta.env.DEV && (
                <Button
                  onClick={startDevSimulatedCamera}
                  className="gap-2 py-2.5 px-4 bg-primary hover:bg-primary/90 text-white"
                >
                  <Sparkles className="size-4" />
                  Use Simulated Camera (DEV)
                </Button>
              )}
              <Button variant="secondary" onClick={handleClose} className="py-2.5 px-4">
                Close
              </Button>
            </div>
          </div>
        )}

        {state === 'denied' && (
          <div className="flex flex-col items-center gap-4 text-white px-8 text-center max-w-md">
            <AlertCircle className="size-12 text-yellow-400" />
            <p className="text-base font-semibold">Camera access denied</p>
            <p className="text-sm text-white/70">
              Please allow camera access in your browser settings, then try again.
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <Button variant="secondary" onClick={startCamera} className="py-2.5 px-4">
                Try again
              </Button>
              {import.meta.env.DEV && (
                <Button
                  onClick={startDevSimulatedCamera}
                  className="gap-2 py-2.5 px-4 bg-primary hover:bg-primary/90 text-white"
                >
                  <Sparkles className="size-4" />
                  Use Simulated Camera (DEV)
                </Button>
              )}
              <Button variant="outline" className="text-white border-white/30 py-2.5 px-4" onClick={handleClose}>
                Close
              </Button>
            </div>
          </div>
        )}

        {(state === 'live' || state === 'loading') && (
          <div className={`relative w-full h-full flex items-center justify-center ${state === 'loading' ? 'opacity-0' : 'opacity-100'} transition-opacity`}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }}
            />

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <svg viewBox="0 0 300 380" className="w-48 sm:w-64 opacity-70" aria-hidden="true">
                <ellipse
                  cx="150" cy="190"
                  rx="120" ry="160"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.5"
                  strokeDasharray="8 4"
                />
              </svg>
            </div>

            <p className="absolute bottom-24 left-0 right-0 text-center text-white/80 text-xs pointer-events-none">
              Position your face within the guide
            </p>
          </div>
        )}

        {import.meta.env.DEV && state === 'simulated_dev' && (
          <div className="relative w-full h-full flex items-center justify-center">
            <canvas
              ref={simCanvasRef}
              className="max-w-full max-h-full aspect-[4/3] rounded-xl border border-white/20 shadow-2xl object-contain"
            />
          </div>
        )}

        {state === 'preview' && previewUrl && (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              src={previewUrl}
              alt="Captured selfie preview"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
            <p className="absolute top-16 left-0 right-0 text-center text-white font-medium text-sm">
              Preview — looks good?
            </p>
          </div>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex items-center justify-center gap-6 py-6 px-4 z-20">
        {(state === 'live' || state === 'simulated_dev') && (
          <button
            onClick={handleCapture}
            aria-label="Capture selfie"
            className="att-punch-trigger flex items-center justify-center size-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 active:scale-95 text-white shadow-lg cursor-pointer"
          >
            <Camera className="size-7" />
          </button>
        )}

        {state === 'preview' && (
          <>
            <Button
              variant="secondary"
              size="lg"
              onClick={handleRetake}
              className="gap-2 py-3 px-5 bg-white/20 hover:bg-white/30 text-white border-white/30"
              aria-label="Retake selfie"
            >
              <RotateCcw className="size-4" />
              Retake
            </Button>

            <Button
              size="lg"
              onClick={handleConfirm}
              className="gap-2 py-3 px-5 bg-emerald-500 hover:bg-emerald-600 text-white border-0"
              aria-label="Confirm selfie"
            >
              <Check className="size-4" />
              Use Photo
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
