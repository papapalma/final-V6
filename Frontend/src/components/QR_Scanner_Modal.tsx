import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type jsQRType from 'jsqr';
import {
  X, Package, AlertCircle, QrCode,
} from 'lucide-react';
import { toast } from 'sonner';
import inventoryService, { InventoryItem } from '../services/inventoryService';
import { useAuth } from '../contexts/AuthContext';

interface ScannedItemResult {
  item: InventoryItem;
}

interface QR_Scanner_Modal_Props {
  isOpen: boolean;
  onClose: () => void;
  onBorrow?: (item: InventoryItem, borrowerName: string, borrowerContact: string) => Promise<void>;
  onReturn?: (item: InventoryItem) => Promise<void>;
  isProcessing?: boolean;
  initialMode?: 'item' | 'attendance';
  initialProgramId?: string;
  initialSessionId?: string;
}

export function selectCameraStrategy(devices: MediaDeviceInfo[]): MediaTrackConstraints | { video: true } {
  if (!devices || devices.length === 0) {
    return { video: true };
  }

  const backCamera = devices.find(d =>
    ['back', 'rear', 'environment'].some(kw =>
      d.label && d.label.toLowerCase().includes(kw)
    )
  );

  if (backCamera) {
    return {
      deviceId: { exact: backCamera.deviceId },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    };
  }

  return {
    facingMode: 'environment',
    width: { ideal: 1280 },
    height: { ideal: 720 },
  };
}

export function getCameraLabel(device: MediaDeviceInfo): string {
  if (!device || !device.label) return 'Camera';
  const label = device.label.toLowerCase();
  if (label.includes('front') || label.includes('user')) {
    return 'Front';
  }
  if (label.includes('back') || label.includes('rear') || label.includes('environment')) {
    return 'Back';
  }
  return 'Camera';
}

export function getCycledDeviceId(deviceIds: string[], currentDeviceId: string): string {
  if (!deviceIds || deviceIds.length === 0) return currentDeviceId;
  const index = deviceIds.indexOf(currentDeviceId);
  if (index === -1) return deviceIds[0];
  return deviceIds[(index + 1) % deviceIds.length];
}

export default function QR_Scanner_Modal({
  isOpen,
  onClose,
  onBorrow,
  onReturn,
  isProcessing = false,
  initialMode,
  initialProgramId,
  initialSessionId,
}: QR_Scanner_Modal_Props) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const cooldownRef = useRef(false);
  const accessToastShownRef = useRef(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const [jsQR, setJsQR] = useState<typeof jsQRType | null>(null);

  const currentRole = user?.role ?? '';
  const canScanItems = currentRole === 'super_admin' || currentRole === 'local_admin' || currentRole === 'staff_inventory_manager';
  const hasScannerAccess = canScanItems;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [scannedItem, setScannedItem] = useState<ScannedItemResult | null>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'borrow' | 'return'>('borrow');

  const announce = useCallback((message: string) => {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
  }, [stream]);

  const startCamera = async (deviceId?: string) => {
    const targetDeviceId = deviceId || selectedDeviceId;
    setCameraError(null);
    setPermissionDenied(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera not supported');
        return;
      }

      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }

      let videoConstraint: any;
      if (targetDeviceId) {
        videoConstraint = { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } };
      } else {
        let cameraDevices: MediaDeviceInfo[] = [];
        if (navigator.mediaDevices.enumerateDevices) {
          try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            cameraDevices = devices.filter(device => device.kind === 'videoinput');
            setVideoDevices(cameraDevices);
          } catch {
            // ignore
          }
        }
        videoConstraint = selectCameraStrategy(cameraDevices);
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraint,
        audio: false,
      });

      if (navigator.mediaDevices.enumerateDevices) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameraDevices = devices.filter(device => device.kind === 'videoinput');
        setVideoDevices(cameraDevices);
        if (!selectedDeviceId && cameraDevices.length > 0) {
          setSelectedDeviceId(cameraDevices[0].deviceId);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => startDecoding();
      }
      setStream(mediaStream);
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera permission denied');
        setPermissionDenied(true);
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found');
      } else if (err.name === 'NotReadableError') {
        setCameraError('Camera already in use');
      } else {
        setCameraError('Camera error');
      }
    }
  };

  const handleSwitchCamera = async () => {
    if (isSwitching || videoDevices.length <= 1) return;
    setIsSwitching(true);
    try {
      const deviceIds = videoDevices.map(d => d.deviceId);
      const nextId = getCycledDeviceId(deviceIds, selectedDeviceId);
      setSelectedDeviceId(nextId);
      await startCamera(nextId);
    } finally {
      setIsSwitching(false);
    }
  };

  const handleCameraDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId);
    await new Promise(resolve => setTimeout(resolve, 300));
    await startCamera(deviceId);
  };

  const startDecoding = () => {
    if (!jsQR) return;
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { rafRef.current = requestAnimationFrame(tick); return; }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code && !cooldownRef.current) {
        handleQRDetected(code.data);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  const triggerCooldown = (ms = 2000) => {
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, ms);
  };

  const handleQRDetected = useCallback(async (raw: string) => {
    // Don't scan if no permission
    if (!canScanItems) {
      toast.error('No permission to scan');
      return;
    }
    
    // Don't scan if already scanned an item (wait for user action)
    if (scannedItem) {
      return;
    }
    
    // Allow scanning (for first scan or rescans)
    await handleItemScan(raw);
  }, [canScanItems, scannedItem]);

  const handleItemScan = async (raw: string) => {
    console.log('[SCANNER] QR code detected, raw value:', raw);
    
    let qrValue: string | null = null;
    let itemId: string | null = null;
    let isJsonQR = false;
    
    try {
      // Try to parse as JSON (frontend-generated QR with {qrCode?, id, name, category})
      const parsed = JSON.parse(raw);
      console.log('[SCANNER] Parsed JSON QR:', parsed);
      
      // Prefer qrCode if available, fallback to id
      qrValue = parsed.qrCode || parsed.id || null;
      itemId = parsed.id || null;
      isJsonQR = true;
      
      console.log('[SCANNER] JSON QR parsed - qrValue:', qrValue, 'itemId:', itemId);
    } catch {
      // If not JSON, treat as backend-generated QR code value (e.g., ITEM-ABC12345-...)
      qrValue = raw.trim();
      console.log('[SCANNER] Not JSON - treating as raw QR value:', qrValue);
    }
    
    if (!qrValue) {
      console.error('[SCANNER] Invalid QR code - qrValue is null/empty');
      toast.error('Invalid QR code');
      return;
    }
    
    console.log('[SCANNER] Starting item lookup - qrValue:', qrValue, 'isJsonQR:', isJsonQR, 'itemId:', itemId);
    
    setItemLoading(true);
    try {
      let item: InventoryItem | null = null;
      
      // If it looks like a backend QR code (ITEM-...), try scan endpoint first
      if (qrValue.startsWith('ITEM-')) {
        console.log('[SCANNER] QR starts with ITEM- pattern, trying scan endpoint...');
        try {
          item = await inventoryService.scanItemByQRCode(qrValue);
          console.log('[SCANNER] Scan endpoint successful, item found:', item);
        } catch (scanErr) {
          // Fall through to ID lookup
          console.warn('[SCANNER] Scan endpoint failed, trying ID lookup:', scanErr);
        }
      }
      
      // If not found by QR code, try by item ID
      if (!item && itemId) {
        console.log('[SCANNER] Trying ID lookup with itemId:', itemId);
        try {
          item = await inventoryService.getInventoryItemById(itemId);
          console.log('[SCANNER] ID lookup successful, item found:', item);
        } catch (err) {
          console.error('[SCANNER] ID lookup failed:', err);
        }
      }
      
      if (!item) {
        console.error('[SCANNER] Item not found - tried both QR and ID lookup');
        throw new Error('Item not found');
      }
      
      console.log('[SCANNER] Item successfully found:', item);
      triggerCooldown();
      setScannedItem({ item });
      announce(`Item scanned: ${item.name}`);
    } catch (err) {
      console.error('[SCANNER] Failed to scan item:', err);
      toast.error('Item not found. Please check the QR code.');
    } finally {
      setItemLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !jsQR) {
      import('jsqr').then(module => {
        const fn = module.default;
        setJsQR(() => fn);
      }).catch(err => {
        console.error('Failed to load jsQR:', err);
        toast.error('Scanner unavailable');
        setCameraError('Scanner unavailable');
      });
    }
  }, [isOpen, jsQR]);

  useEffect(() => {
    if (!hasScannerAccess || !isOpen) return;
    startCamera();
    return () => {
      stopCamera();
    };
  }, [hasScannerAccess, selectedDeviceId, isOpen]);

  useEffect(() => {
    if (!hasScannerAccess && !accessToastShownRef.current && isOpen) {
      accessToastShownRef.current = true;
      toast.error('No scanner access');
    }
  }, [hasScannerAccess, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setScannedItem(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (stream && videoRef.current && isOpen && jsQR) startDecoding();
  }, [isOpen, jsQR]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else {
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setScannedItem(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-2 pt-4 backdrop-blur-md sm:items-center sm:px-0 sm:pt-0"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div 
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:max-h-[90dvh] sm:w-96 sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <canvas ref={canvasRef} className="hidden" />

        {/* ── Header ────────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-slate-700" />
            <div>
              <h1 className="text-base font-bold text-slate-900">Lending QR Scan</h1>
              <p className="text-xs text-slate-600">Scan items to borrow</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-slate-100 rounded-lg text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Mode & Status ─────────────────────────────────────────────────────── */}
        <div className="px-4 pt-3 pb-2 border-b border-slate-200 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-2">
              <button 
                onClick={() => setSelectedMode('borrow')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                  selectedMode === 'borrow'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                }`}
              >
                BORROW
              </button>
              <button 
                onClick={() => setSelectedMode('return')}
                className={`px-3 py-1.5 text-xs font-semibold rounded transition ${
                  selectedMode === 'return'
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                }`}
              >
                RETURN
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-sm">Status:</span>
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-green-500 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
            </span>
            {cameraError ? 'Error' : 'Ready'}
          </div>
        </div>

        {/* ── Camera ────────────────────────────────────────────────────────────── */}
        <div className="relative aspect-video shrink-0 overflow-hidden border-4 border-green-400 bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`size-full object-cover ${cameraError ? 'hidden' : ''}`}
          />

          {/* Error */}
          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-2 p-4">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-xs text-white text-center">{cameraError}</p>
              {cameraError && (
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="mt-1 text-xs bg-white text-black px-3 py-1 rounded hover:bg-gray-100"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Loading */}
          {itemLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* ── Camera Control ────────────────────────────────────────────────────── */}
        {videoDevices.length > 1 && !cameraError && (
          <div className="px-4 py-2 border-b border-slate-200 shrink-0 flex items-center justify-between gap-2">
            <select 
              value={selectedDeviceId} 
              onChange={(e) => handleCameraDeviceChange(e.target.value)}
              className="flex-1 h-8 text-xs rounded border border-slate-200 bg-white px-2 text-slate-900"
            >
              {videoDevices.map((device, index) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {getCameraLabel(device)} {index + 1}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Switch Camera"
              onClick={handleSwitchCamera}
              disabled={isSwitching}
              className="h-8 px-3 text-xs bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 disabled:opacity-50"
            >
              {isSwitching ? 'Switching...' : 'Switch Camera'}
            </button>
          </div>
        )}

        {/* ── Item Card ─────────────────────────────────────────────────────────── */}
        {scannedItem && (
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-3">
              {/* Item Header */}
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-green-200">
                    <Package className="h-4 w-4 text-green-700" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{scannedItem.item.name}</p>
                    <p className="text-xs text-slate-600 truncate">{scannedItem.item.category}</p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded p-2.5">
                  <p className="text-[10px] text-slate-600 font-bold uppercase">Available</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{scannedItem.item.available_quantity}</p>
                </div>
                <div className="bg-slate-50 rounded p-2.5">
                  <p className="text-[10px] text-slate-600 font-bold uppercase">Total</p>
                  <p className="text-lg font-bold text-slate-900 mt-1">{scannedItem.item.quantity}</p>
                </div>
              </div>

              {/* Location */}
              {scannedItem.item.location && (
                <div className="bg-slate-50 rounded p-2.5">
                  <p className="text-[10px] text-slate-600 font-bold uppercase">Location</p>
                  <p className="text-sm text-slate-900 mt-1 truncate">{scannedItem.item.location}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    console.log('[BUTTON] Action button clicked - selectedMode:', selectedMode, 'scannedItem:', !!scannedItem);
                    if (!scannedItem) {
                      console.error('[BUTTON] No scanned item');
                      return;
                    }
                    if (selectedMode === 'borrow') {
                      console.log('[BUTTON] Calling onBorrow with item only - will open lending form');
                      onBorrow?.(scannedItem.item, '', '');
                    } else {
                      console.log('[BUTTON] Calling onReturn');
                      onReturn?.(scannedItem.item);
                    }
                  }}
                  disabled={selectedMode === 'borrow' && scannedItem.item.available_quantity === 0 || isProcessing}
                  className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold rounded transition"
                >
                  {isProcessing ? 'PROCESSING...' : selectedMode.toUpperCase()}
                </button>
                <button
                  onClick={() => { 
                    console.log('[BUTTON] SCAN AGAIN clicked');
                    setScannedItem(null); 
                    triggerCooldown(500); 
                  }}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-300 disabled:cursor-not-allowed text-slate-900 text-sm font-bold rounded transition"
                >
                  SCAN AGAIN
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Empty State ───────────────────────────────────────────────────────── */}
        {!scannedItem && (
          <div className="flex min-h-20 shrink-0 items-center justify-center p-4">
            <p className="text-sm text-slate-600 text-center">Position QR code in frame to scan</p>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
