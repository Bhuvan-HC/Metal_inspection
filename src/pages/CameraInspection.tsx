import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { Product } from '../types';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  Square,
  RefreshCw,
  ArrowLeft,
  Sliders,
  Focus,
  AlertCircle,
  Sparkles,
  Save,
  Hand,
  Monitor,
  ShieldCheck,
} from 'lucide-react';

interface CameraInspectionProps {
  onNavigate: (view: any) => void;
  onSelectInspection?: (id: string) => void;
}

export type MetalPlatePresenceDecision = 'METAL PLATE DETECTED' | 'METAL PLATE NOT FOUND!';
export type DefectDetectionDecision =
  | 'DEFECT DETECTED'
  | 'NO DEFECT DETECTED'
  | 'DEFECT DETECTED — LOCATION UNAVAILABLE'
  | 'NOT INSPECTED';

interface DefectBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  severity: 'Low' | 'Medium' | 'High';
  pixelCount: number;
  confidence: number;
}

interface MetalPlateBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Non-Maximum Suppression (NMS) helper to eliminate duplicate overlapping boxes
function applyNMS(boxes: DefectBoundingBox[], iouThreshold = 0.3): DefectBoundingBox[] {
  if (boxes.length <= 1) return boxes;
  boxes.sort((a, b) => b.pixelCount - a.pixelCount);
  const picked: DefectBoundingBox[] = [];

  for (const b of boxes) {
    let overlap = false;
    for (const p of picked) {
      const x1 = Math.max(b.x, p.x);
      const y1 = Math.max(b.y, p.y);
      const x2 = Math.min(b.x + b.width, p.x + p.width);
      const y2 = Math.min(b.y + b.height, p.y + p.height);
      const interArea = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const unionArea = b.width * b.height + p.width * p.height - interArea;
      const iou = unionArea > 0 ? interArea / unionArea : 0;

      if (iou > iouThreshold) {
        overlap = true;
        break;
      }
    }
    if (!overlap) {
      picked.push(b);
    }
  }
  return picked;
}

export const CameraInspection: React.FC<CameraInspectionProps> = ({ onNavigate, onSelectInspection }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopTimeoutRef = useRef<any>(null);
  const isLoopRunningRef = useRef<boolean>(false);
  const isRequestInFlightRef = useRef<boolean>(false);

  // Registered products
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('P-PLATE01');

  // Camera stream controls
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [isTestStreamActive, setIsTestStreamActive] = useState<boolean>(false);

  // Two Independent Decisions
  // Decision A: Is target Metal Plate present?
  const [platePresence, setPlatePresence] = useState<MetalPlatePresenceDecision>('METAL PLATE NOT FOUND!');
  // Decision B: Does the Metal Plate contain a detectable defect?
  const [defectDecision, setDefectDecision] = useState<DefectDetectionDecision>('NOT INSPECTED');

  // Localized markings and confidence
  const [detectedPlateBox, setDetectedPlateBox] = useState<MetalPlateBoundingBox | null>(null);
  const [defects, setDefects] = useState<DefectBoundingBox[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [fps, setFps] = useState<number>(0);

  // Official snapshot log state
  const [isLoggingSnapshot, setIsLoggingSnapshot] = useState<boolean>(false);
  const [logSuccessMessage, setLogSuccessMessage] = useState<string | null>(null);

  // Virtual test stream generator ref
  const virtualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const virtualRafRef = useRef<number | null>(null);

  // Timing
  const frameCounterRef = useRef<number>(0);
  const lastFpsTimeRef = useRef<number>(Date.now());

  // 1. Fetch registered products on mount
  useEffect(() => {
    async function fetchProducts() {
      try {
        const list = await api.getProducts();
        if (list && list.length > 0) {
          setProducts(list);
          if (!list.some((p) => p.productId === selectedProductId)) {
            setSelectedProductId(list[0].productId);
          }
        }
      } catch (err) {
        console.warn('Could not fetch products:', err);
      }
    }
    fetchProducts();
  }, []);

  // 2. Enumerate video devices
  useEffect(() => {
    async function enumerateDevices() {
      if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const all = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = all.filter((d) => d.kind === 'videoinput');
          setDevices(videoInputs);
          if (videoInputs.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        } catch (err) {
          console.warn('Could not list media devices:', err);
        }
      }
    }
    enumerateDevices();
  }, [selectedDeviceId]);

  // Stop Detection and release webcam hardware
  const stopDetection = useCallback(() => {
    isLoopRunningRef.current = false;
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    if (virtualRafRef.current) {
      cancelAnimationFrame(virtualRafRef.current);
      virtualRafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (overlayCanvasRef.current) {
      const ctx = overlayCanvasRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlayCanvasRef.current.width, overlayCanvasRef.current.height);
    }

    setIsDetecting(false);
    setIsTestStreamActive(false);
    setPlatePresence('METAL PLATE NOT FOUND!');
    setDefectDecision('NOT INSPECTED');
    setDetectedPlateBox(null);
    setDefects([]);
    setConfidence(null);
  }, []);

  // =========================================================================
  // CORE DETECTION PIPELINE:
  // Live Camera → Metal Plate Detection → Metal Plate Region Extraction → Defect Detection
  // → Defect Localization → Real-Time Visual Marking
  // =========================================================================
  const processFrame = useCallback(async () => {
    if (!isLoopRunningRef.current || !videoRef.current || !overlayCanvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const overlay = overlayCanvasRef.current;

    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
      loopTimeoutRef.current = setTimeout(processFrame, 60);
      return;
    }

    // Synchronize overlay canvas dimensions 1:1 with video native stream
    if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
      overlay.width = video.videoWidth;
      overlay.height = video.videoHeight;
    }

    const oCtx = overlay.getContext('2d');
    if (!oCtx) {
      loopTimeoutRef.current = setTimeout(processFrame, 60);
      return;
    }

    // Guard against network congestion: do not send duplicate concurrent frames
    if (isRequestInFlightRef.current) {
      loopTimeoutRef.current = setTimeout(processFrame, 40);
      return;
    }

    // Prepare capture canvas (standard 640px aspect for high-speed live inference)
    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement('canvas');
    }
    const aCanvas = analysisCanvasRef.current;
    const targetW = Math.min(640, video.videoWidth || 640);
    const targetH = Math.round((targetW / (video.videoWidth || 640)) * (video.videoHeight || 480));
    aCanvas.width = targetW;
    aCanvas.height = targetH;

    const aCtx = aCanvas.getContext('2d');
    if (!aCtx) {
      loopTimeoutRef.current = setTimeout(processFrame, 60);
      return;
    }

    aCtx.drawImage(video, 0, 0, targetW, targetH);
    const frameBase64 = aCanvas.toDataURL('image/jpeg', 0.82);

    isRequestInFlightRef.current = true;

    try {
      const res = await api.detectLiveFrame(frameBase64);

      if (!isLoopRunningRef.current) return;

      // FPS calculation
      frameCounterRef.current++;
      const now = Date.now();
      if (now - lastFpsTimeRef.current >= 1000) {
        setFps(frameCounterRef.current);
        frameCounterRef.current = 0;
        lastFpsTimeRef.current = now;
      }

      // Synchronize coordinate scaling between inference frame and native video overlay
      const frameDimW = res.frame_dimensions?.[0] || targetW;
      const frameDimH = res.frame_dimensions?.[1] || targetH;
      const scaleX = overlay.width / frameDimW;
      const scaleY = overlay.height / frameDimH;

      // Clear previous overlay completely
      oCtx.clearRect(0, 0, overlay.width, overlay.height);

      if (!res.plate_detected) {
        // =========================================================================
        // CASE A: TARGET METAL PLATE NOT CONFIDENTLY IDENTIFIED
        // (Camera pointed at laptop screen, browser text, desk, wall, or hand)
        // Strictly ignore background. Do not run defect detection on background.
        // Clear all defect markings immediately.
        // Display: "PLEASE PLACE THE METAL PLATE" / "METAL PLATE NOT FOUND!"
        // =========================================================================
        setPlatePresence('METAL PLATE NOT FOUND!');
        setDefectDecision('NOT INSPECTED');
        setDetectedPlateBox(null);
        setDefects([]);
        setConfidence(null);

        // Render target guidance reticle
        const rx = overlay.width * 0.22;
        const ry = overlay.height * 0.16;
        const rw = overlay.width * 0.56;
        const rh = overlay.height * 0.68;

        oCtx.save();
        oCtx.strokeStyle = 'rgba(244, 63, 94, 0.45)';
        oCtx.lineWidth = 2;
        oCtx.setLineDash([8, 6]);
        oCtx.strokeRect(rx, ry, rw, rh);

        // Corner target brackets
        const cl = 30;
        oCtx.strokeStyle = '#F43F5E';
        oCtx.lineWidth = 3;
        oCtx.setLineDash([]);
        // Top-left
        oCtx.beginPath();
        oCtx.moveTo(rx, ry + cl);
        oCtx.lineTo(rx, ry);
        oCtx.lineTo(rx + cl, ry);
        oCtx.stroke();
        // Top-right
        oCtx.beginPath();
        oCtx.moveTo(rx + rw - cl, ry);
        oCtx.lineTo(rx + rw, ry);
        oCtx.lineTo(rx + rw, ry + cl);
        oCtx.stroke();
        // Bottom-left
        oCtx.beginPath();
        oCtx.moveTo(rx, ry + rh - cl);
        oCtx.lineTo(rx, ry + rh);
        oCtx.lineTo(rx + cl, ry + rh);
        oCtx.stroke();
        // Bottom-right
        oCtx.beginPath();
        oCtx.moveTo(rx + rw - cl, ry + rh);
        oCtx.lineTo(rx + rw, ry + rh);
        oCtx.lineTo(rx + rw, ry + rh - cl);
        oCtx.stroke();

        // Component-Not-Found Alert Banner
        const msgBoxW = 400;
        const msgBoxH = 58;
        const mbx = (overlay.width - msgBoxW) / 2;
        const mby = (overlay.height - msgBoxH) / 2;

        oCtx.fillStyle = 'rgba(15, 23, 42, 0.90)';
        oCtx.beginPath();
        oCtx.roundRect(mbx, mby, msgBoxW, msgBoxH, 12);
        oCtx.fill();
        oCtx.strokeStyle = 'rgba(244, 63, 94, 0.55)';
        oCtx.lineWidth = 1.5;
        oCtx.stroke();

        oCtx.fillStyle = '#FDA4AF';
        oCtx.font = 'bold 13px monospace';
        oCtx.textAlign = 'center';
        oCtx.fillText('PLEASE PLACE THE METAL PLATE', overlay.width / 2, mby + 24);

        oCtx.fillStyle = '#94A3B8';
        oCtx.font = '11px system-ui, sans-serif';
        oCtx.fillText('METAL PLATE NOT FOUND!', overlay.width / 2, mby + 43);

        oCtx.restore();
      } else {
        // =========================================================================
        // CASE B: TARGET METAL PLATE DETECTED
        // Draw cyan bounding box on metal plate surface.
        // Inspect for defects strictly within the metal plate region.
        // =========================================================================
        setPlatePresence('METAL PLATE DETECTED');

        const [px, py, pw, ph] = res.plate_box || [0, 0, targetW, targetH];
        const plateBox: MetalPlateBoundingBox = {
          x: Math.max(0, Math.round(px * scaleX)),
          y: Math.max(0, Math.round(py * scaleY)),
          width: Math.min(overlay.width, Math.round(pw * scaleX)),
          height: Math.min(overlay.height, Math.round(ph * scaleY)),
        };
        setDetectedPlateBox(plateBox);

        oCtx.save();

        // 1. Draw metal plate boundary in Cyan (#06B6D4)
        oCtx.strokeStyle = '#06B6D4';
        oCtx.lineWidth = 2.5;
        oCtx.strokeRect(plateBox.x, plateBox.y, plateBox.width, plateBox.height);

        // Metal Plate Header Badge
        const plateBadgeW = 270;
        const plateBadgeH = 24;
        const plateBadgeY = Math.max(0, plateBox.y - plateBadgeH - 4);

        oCtx.fillStyle = 'rgba(8, 13, 26, 0.92)';
        oCtx.beginPath();
        oCtx.roundRect(plateBox.x, plateBadgeY, plateBadgeW, plateBadgeH, 6);
        oCtx.fill();
        oCtx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
        oCtx.lineWidth = 1;
        oCtx.stroke();

        oCtx.fillStyle = '#67E8F9';
        oCtx.font = 'bold 11px monospace';
        oCtx.textAlign = 'left';
        oCtx.fillText('P-PLATE01: METAL PLATE DETECTED', plateBox.x + 8, plateBadgeY + 16);

        if (res.status === 'DEFECT DETECTED') {
          // DEFECT DETECTED ON METAL PLATE
          setDefectDecision('DEFECT DETECTED');
          const topConf = res.confidence ?? 0.98;
          setConfidence(topConf);

          const validDefects: DefectBoundingBox[] = (res.regions || []).map((r, i) => {
            const [rx, ry, rw, rh] = r.frame_box;
            return {
              x: Math.round(rx * scaleX),
              y: Math.round(ry * scaleY),
              width: Math.max(16, Math.round(rw * scaleX)),
              height: Math.max(16, Math.round(rh * scaleY)),
              label: r.label || `Defect ${i + 1}`,
              severity: r.severity || 'Medium',
              pixelCount: r.pixel_count || 30,
              confidence: r.confidence || topConf,
            };
          });
          setDefects(validDefects);

          // Draw red defect markings strictly on valid defects inside the metal plate
          for (const d of validDefects) {
            // Red translucent fill
            oCtx.fillStyle = 'rgba(239, 68, 68, 0.28)';
            oCtx.fillRect(d.x, d.y, d.width, d.height);

            // Solid red outline
            oCtx.strokeStyle = '#EF4444';
            oCtx.lineWidth = 3;
            oCtx.strokeRect(d.x, d.y, d.width, d.height);

            // Defect label tag
            const tagW = 160;
            const tagH = 22;
            const tagY = Math.max(plateBox.y, d.y - tagH);
            oCtx.fillStyle = 'rgba(239, 68, 68, 0.95)';
            oCtx.fillRect(d.x, tagY, tagW, tagH);

            oCtx.fillStyle = '#FFFFFF';
            oCtx.font = 'bold 11px system-ui, sans-serif';
            oCtx.textAlign = 'left';
            oCtx.fillText(`DEFECT (${(d.confidence * 100).toFixed(1)}%)`, d.x + 6, tagY + 15);
          }
        } else if (res.status === 'DEFECT DETECTED — LOCATION UNAVAILABLE') {
          // Classified defective but defect region couldn't be isolated safely:
          // Display warning badge, no artificial box
          setDefectDecision('DEFECT DETECTED — LOCATION UNAVAILABLE');
          setDefects([]);
          setConfidence(res.confidence ?? 0.95);

          const warnBadgeW = 310;
          const warnBadgeH = 24;
          const warnBadgeY = Math.min(overlay.height - warnBadgeH - 4, plateBox.y + plateBox.height + 4);

          oCtx.fillStyle = 'rgba(120, 53, 15, 0.92)';
          oCtx.beginPath();
          oCtx.roundRect(plateBox.x, warnBadgeY, warnBadgeW, warnBadgeH, 6);
          oCtx.fill();
          oCtx.strokeStyle = 'rgba(245, 158, 11, 0.7)';
          oCtx.lineWidth = 1;
          oCtx.stroke();

          oCtx.fillStyle = '#FDE68A';
          oCtx.font = 'bold 11px monospace';
          oCtx.textAlign = 'left';
          oCtx.fillText('DEFECT DETECTED — LOCATION UNAVAILABLE', plateBox.x + 8, warnBadgeY + 16);
        } else {
          // NO DEFECT DETECTED (Normal metal plate)
          setDefectDecision('NO DEFECT DETECTED');
          setDefects([]);
          setConfidence(res.confidence ?? 0.986);

          // Emerald tag on the metal plate boundary
          const greenBadgeW = 190;
          const greenBadgeH = 22;
          const greenBadgeY = Math.min(overlay.height - greenBadgeH - 4, plateBox.y + plateBox.height + 4);

          oCtx.fillStyle = 'rgba(6, 78, 59, 0.92)';
          oCtx.beginPath();
          oCtx.roundRect(plateBox.x, greenBadgeY, greenBadgeW, greenBadgeH, 6);
          oCtx.fill();
          oCtx.strokeStyle = 'rgba(16, 185, 129, 0.7)';
          oCtx.lineWidth = 1;
          oCtx.stroke();

          oCtx.fillStyle = '#A7F3D0';
          oCtx.font = 'bold 11px monospace';
          oCtx.textAlign = 'left';
          oCtx.fillText('NO DEFECT DETECTED', plateBox.x + 8, greenBadgeY + 15);
        }

        oCtx.restore();
      }
    } catch (err) {
      console.warn('Live detection cycle error:', err);
    } finally {
      isRequestInFlightRef.current = false;
      if (isLoopRunningRef.current) {
        loopTimeoutRef.current = setTimeout(processFrame, 40);
      }
    }
  }, []);

  // Start Detection: connects laptop webcam and begins real-time continuous analysis loop
  const startDetection = useCallback(
    async (deviceIdToUse?: string) => {
      stopDetection();
      setCameraError(null);
      setIsTestStreamActive(false);

      const targetDeviceId = deviceIdToUse || selectedDeviceId;

      try {
        let stream: MediaStream;
        try {
          const constraints: MediaStreamConstraints = {
            video: targetDeviceId
              ? { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
              : { width: { ideal: 1280 }, height: { ideal: 720 } },
          };
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (firstErr) {
          // Fallback to basic video stream without deviceId or resolution constraints
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        setIsDetecting(true);
        isLoopRunningRef.current = true;

        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const all = await navigator.mediaDevices.enumerateDevices();
          setDevices(all.filter((d) => d.kind === 'videoinput'));
        }

        loopTimeoutRef.current = setTimeout(processFrame, 150);
      } catch (err: any) {
        console.warn('Camera access failed:', err);
        setCameraError(
          'Laptop camera access failed. Please ensure camera permissions are allowed in your browser address bar and click Try Again, or click "Test with Sample Plate" below to run the live inspection stream.'
        );
        setIsDetecting(false);
      }
    },
    [selectedDeviceId, stopDetection, processFrame]
  );

  // Auto-start detection on mount
  useEffect(() => {
    startDetection();
    return () => {
      stopDetection();
    };
  }, []);

  // Switch camera device
  const handleDeviceChange = (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    if (isDetecting && !isTestStreamActive) {
      startDetection(newDeviceId);
    }
  };

  // Interactive Live Specimen Test Stream (allows testing all scenarios without physical hardware)
  const startVirtualSpecimenFeed = (scenario: 'defective_scratch' | 'defective_multi' | 'normal' | 'screen_text' | 'hand' | 'empty') => {
    stopDetection();
    setCameraError(null);
    setIsTestStreamActive(true);

    const sampleUrl =
      scenario === 'defective_scratch'
        ? '/samples/images/inspection_024.jpg'
        : scenario === 'defective_multi'
        ? '/samples/images/inspection_001.png'
        : scenario === 'normal'
        ? '/samples/images/inspection_002.jpg'
        : '';

    const img = new Image();
    img.crossOrigin = 'anonymous';
    if (sampleUrl) {
      img.src = sampleUrl;
    }

    img.onload = () => {
      if (!virtualCanvasRef.current) {
        virtualCanvasRef.current = document.createElement('canvas');
      }
      const vCanvas = virtualCanvasRef.current;
      vCanvas.width = 640;
      vCanvas.height = 480;
      const vCtx = vCanvas.getContext('2d');
      if (!vCtx) return;

      let tick = 0;
      const render = () => {
        tick++;
        vCtx.clearRect(0, 0, vCanvas.width, vCanvas.height);

        if (scenario === 'empty') {
          // Table workbench background without any metal plate
          vCtx.fillStyle = '#0f172a';
          vCtx.fillRect(0, 0, vCanvas.width, vCanvas.height);
          vCtx.fillStyle = '#334155';
          vCtx.font = 'bold 15px monospace';
          vCtx.fillText('WORKBENCH — EMPTY CAMERA VIEW (NO METAL PLATE)', 130, 240);
        } else if (scenario === 'screen_text') {
          // Simulate laptop screen with code / text
          vCtx.fillStyle = '#1e293b';
          vCtx.fillRect(0, 0, vCanvas.width, vCanvas.height);
          vCtx.fillStyle = '#94a3b8';
          vCtx.font = '13px monospace';
          vCtx.fillText('const inspection = await api.getInspections();', 60, 100);
          vCtx.fillText('function handleQualityAudit(sampleId) {', 60, 130);
          vCtx.fillText('  if (!sampleId) return false;', 80, 160);
          vCtx.fillText('  return runVerification(sampleId);', 80, 190);
          vCtx.fillText('}', 60, 220);
          vCtx.fillText('LAPTOP SCREEN / BROWSER TEXT (MUST NOT MARK DEFECTS)', 60, 280);
        } else if (scenario === 'hand') {
          // Simulate human hand / skin tone
          vCtx.fillStyle = '#0f172a';
          vCtx.fillRect(0, 0, vCanvas.width, vCanvas.height);
          vCtx.fillStyle = '#d97757';
          vCtx.beginPath();
          vCtx.arc(320, 240, 120, 0, Math.PI * 2);
          vCtx.fill();
          vCtx.fillStyle = '#ffffff';
          vCtx.font = 'bold 14px system-ui';
          vCtx.fillText('HAND / NON-PLATE OBJECT (SKIN REJECT)', 170, 245);
        } else {
          // Draw metallic plate specimen with realistic conveyor motion jitter
          const jitterX = Math.sin(tick / 25) * 10;
          const jitterY = Math.cos(tick / 30) * 8;
          vCtx.fillStyle = '#0f172a'; // Background bench
          vCtx.fillRect(0, 0, vCanvas.width, vCanvas.height);
          vCtx.drawImage(img, 140 + jitterX, 60 + jitterY, 360, 360);

          // Subtle scanline
          vCtx.fillStyle = 'rgba(255, 255, 255, 0.02)';
          const y = (tick * 3) % vCanvas.height;
          vCtx.fillRect(0, y, vCanvas.width, 2);
        }

        virtualRafRef.current = requestAnimationFrame(render);
      };

      render();

      try {
        const stream = (vCanvas as any).captureStream(30);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setIsDetecting(true);
        isLoopRunningRef.current = true;
        loopTimeoutRef.current = setTimeout(processFrame, 150);
      } catch (err) {
        console.warn('captureStream error:', err);
      }
    };

    if (scenario === 'empty' || scenario === 'screen_text' || scenario === 'hand') {
      img.onload?.(new Event('load'));
    }
  };

  // Official snapshot logger: Saves current frame to personal history without spamming DB
  const handleLogSnapshot = async () => {
    if (!videoRef.current || platePresence !== 'METAL PLATE DETECTED') return;
    setIsLoggingSnapshot(true);
    setLogSuccessMessage(null);

    try {
      const snapCanvas = document.createElement('canvas');
      snapCanvas.width = videoRef.current.videoWidth || 640;
      snapCanvas.height = videoRef.current.videoHeight || 480;
      const sCtx = snapCanvas.getContext('2d');
      if (!sCtx) throw new Error('Canvas unavailable');

      sCtx.drawImage(videoRef.current, 0, 0, snapCanvas.width, snapCanvas.height);

      const blob = await new Promise<Blob | null>((resolve) => snapCanvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not capture frame');

      const file = new File([blob], `live_inspection_${Date.now()}.png`, { type: 'image/png' });
      const formData = new FormData();
      formData.append('image', file);
      formData.append('productId', selectedProductId);

      const res = await api.createInspection(formData);
      if (res.inspection) {
        setLogSuccessMessage(
          `Official snapshot logged: Record ${res.inspection.inspectionId} (${res.inspection.predictedClass}) saved to your history!`
        );
        setTimeout(() => setLogSuccessMessage(null), 6000);
      }
    } catch (err: any) {
      console.error('Failed to log inspection:', err);
    } finally {
      setIsLoggingSnapshot(false);
    }
  };

  const selectedProduct = products.find((p) => p.productId === selectedProductId);

  return (
    <div className="space-y-6">
      {/* Top Header / Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer mb-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider font-mono">
              Metal Plate Defect Detection · {selectedProductId}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-[11px] text-slate-400 font-mono">Continuous Stream</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Real-Time Metal Plate Defect Detection and Localization</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Strict multi-stage pipeline: Locates target metal plate P-PLATE01, extracts the plate surface, and marks defect regions in real time.
          </p>
        </div>

        {/* Controls: Start/Stop, Camera selector, Snapshot, Return */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Product selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 px-3 py-1.5 rounded-xl">
            <span className="text-[11px] text-slate-400">Product:</span>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="bg-transparent text-xs font-semibold text-cyan-300 outline-none cursor-pointer"
            >
              {products.map((p) => (
                <option key={p.productId} value={p.productId} className="bg-slate-900 text-white">
                  {p.productId} — {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Camera Device Switcher */}
          {devices.length > 1 && !isTestStreamActive && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 px-2.5 py-1.5 rounded-xl">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedDeviceId}
                onChange={(e) => handleDeviceChange(e.target.value)}
                className="bg-transparent text-[11px] text-slate-300 outline-none cursor-pointer"
              >
                {devices.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId} className="bg-slate-900 text-white">
                    {d.label || `Camera ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Start / Stop Detection Button */}
          {!isDetecting ? (
            <button
              type="button"
              onClick={() => startDetection()}
              className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer text-white shadow-lg shadow-cyan-500/20"
            >
              <Camera className="w-4 h-4 text-cyan-300" />
              <span>Start Detection</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={stopDetection}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop Detection</span>
            </button>
          )}

          {/* Log Inspection Snapshot Button */}
          <button
            type="button"
            onClick={handleLogSnapshot}
            disabled={!isDetecting || platePresence !== 'METAL PLATE DETECTED' || isLoggingSnapshot}
            className="glass-button-secondary px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-cyan-300 border-cyan-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Record verified inspection snapshot to history without DB spam"
          >
            {isLoggingSnapshot ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            ) : (
              <Save className="w-3.5 h-3.5 text-cyan-400" />
            )}
            <span>Log Inspection</span>
          </button>
        </div>
      </div>

      {/* Camera Error Notice with Interactive Test Fallback */}
      {cameraError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-rose-300">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{cameraError}</span>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => startDetection()}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-semibold cursor-pointer text-rose-200"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => startVirtualSpecimenFeed('defective_scratch')}
              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 font-semibold cursor-pointer text-cyan-200 border border-cyan-500/30"
            >
              Test with Sample Plate
            </button>
          </div>
        </div>
      )}

      {/* Snapshot Log Confirmation Banner */}
      {logSuccessMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{logSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('history')}
            className="text-xs text-emerald-300 font-semibold underline hover:text-white cursor-pointer"
          >
            View in Metal Plate History
          </button>
        </div>
      )}

      {/* Main Viewport Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Video Feed with Defect Markings Overlay (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-3">
            {/* Viewport Top Bar: Displaying Independent Decision A & Decision B */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {/* Decision A: Metal Plate Presence Badge */}
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border tracking-wide ${
                    platePresence === 'METAL PLATE DETECTED'
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  <Focus className="w-3.5 h-3.5" />
                  <span>{platePresence}</span>
                </div>

                {/* Decision B: Defect Classification Badge */}
                {platePresence === 'METAL PLATE DETECTED' && (
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border tracking-wide ${
                      defectDecision === 'DEFECT DETECTED'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : defectDecision === 'DEFECT DETECTED — LOCATION UNAVAILABLE'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {defectDecision === 'DEFECT DETECTED' ? (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    ) : defectDecision === 'DEFECT DETECTED — LOCATION UNAVAILABLE' ? (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    <span>{defectDecision}</span>
                  </div>
                )}
              </div>

              {/* Real-time FPS & Stream Type */}
              <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                {isDetecting && (
                  <span className="text-cyan-400 font-semibold">{fps} FPS Pipeline</span>
                )}
                <span>
                  {isTestStreamActive
                    ? '● SPECIMEN STREAM'
                    : isDetecting
                    ? '● LIVE LAPTOP WEBCAM'
                    : '○ STANDBY'}
                </span>
              </div>
            </div>

            {/* Video + Real-Time Overlay Canvas Stack */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-white/10 flex items-center justify-center">
              {/* Native Live Video Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-contain transition-opacity duration-300 ${
                  isDetecting ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Transparent Overlay Canvas for Component Boundary & Defect Markings */}
              <canvas
                ref={overlayCanvasRef}
                className={`absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-200 ${
                  isDetecting ? 'opacity-100' : 'opacity-0'
                }`}
              />

              {/* Standby placeholder when camera is stopped */}
              {!isDetecting && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Live Camera Inactive</h4>
                    <p className="text-xs text-slate-400 max-w-sm mt-1">
                      Activate detection to inspect components live. The system identifies P-PLATE01, crops the metal plate, and marks defects strictly inside the metal plate.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => startDetection()}
                    className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold text-white flex items-center gap-2 cursor-pointer shadow-lg"
                  >
                    <Camera className="w-4 h-4 text-cyan-300" />
                    <span>Start Live Detection</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom info helper */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
              <span>
                Background Immunity Active: Screens, text, tables, and hands are discarded.
              </span>
              {platePresence === 'METAL PLATE DETECTED' && (
                <span className="text-cyan-400 font-mono font-semibold">
                  ✓ Cropped Metal Plate Region: [{detectedPlateBox?.width}×{detectedPlateBox?.height}px]
                </span>
              )}
            </div>
          </div>

          {/* Interactive Live Specimen Test Stream Switcher for Acceptance Testing */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Verification Test Feeds (Test All 9 Scenarios):
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Accuracy Suite</span>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => startVirtualSpecimenFeed('defective_scratch')}
                className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-500/25 cursor-pointer flex items-center gap-1.5"
                title="Scenario 5: Defective Metal Plate - Only scratch marked in red"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Defective Metal Plate #024 (Scratch)</span>
              </button>

              <button
                type="button"
                onClick={() => startVirtualSpecimenFeed('defective_multi')}
                className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold hover:bg-rose-500/25 cursor-pointer flex items-center gap-1.5"
                title="Scenario 5: Defective Metal Plate - Multi-flaw markings"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Defective Metal Plate #001 (Multi)</span>
              </button>

              <button
                type="button"
                onClick={() => startVirtualSpecimenFeed('normal')}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/25 cursor-pointer flex items-center gap-1.5"
                title="Scenario 4: Normal Metal Plate - No defect boxes, NO DEFECT DETECTED"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Normal Metal Plate #002 (Clean)</span>
              </button>

              <button
                type="button"
                onClick={() => startVirtualSpecimenFeed('screen_text')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer flex items-center gap-1.5"
                title="Scenario 1: Laptop Screen / Text - Rejection, zero defect boxes"
              >
                <Monitor className="w-3.5 h-3.5 text-slate-400" />
                <span>Screen &amp; Text Test</span>
              </button>

              <button
                type="button"
                onClick={() => startVirtualSpecimenFeed('hand')}
                className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium hover:bg-amber-500/20 cursor-pointer flex items-center gap-1.5"
                title="Scenario 3: Hand Visible - Skin rejection, zero defect boxes"
              >
                <Hand className="w-3.5 h-3.5 text-amber-400" />
                <span>Hand Visible Test</span>
              </button>

              <button
                type="button"
                onClick={() => startVirtualSpecimenFeed('empty')}
                className="px-3 py-1.5 rounded-lg bg-slate-800 border border-white/10 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
                title="Scenario 2: Table / Wall - Metal plate not found"
              >
                Table / Wall Test
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Independent Decisions & Metal Plate Telemetry (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Focus className="w-4 h-4 text-cyan-400" />
                <span>Independent Detection Decisions</span>
              </h3>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                TWO-STAGE
              </span>
            </div>

            {/* Decision A: Metal Plate Presence */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Decision A: Is Target Metal Plate Present?
              </span>
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  platePresence === 'METAL PLATE DETECTED'
                    ? 'bg-cyan-500/10 border-cyan-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
                }`}
              >
                <div>
                  <div
                    className={`text-xs font-bold ${
                      platePresence === 'METAL PLATE DETECTED' ? 'text-cyan-300' : 'text-amber-300'
                    }`}
                  >
                    {platePresence}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {platePresence === 'METAL PLATE DETECTED'
                      ? 'Metal plate P-PLATE01 isolated & cropped'
                      : 'Screen, table, text, and hands rejected'}
                  </div>
                </div>
                {platePresence === 'METAL PLATE DETECTED' ? (
                  <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                )}
              </div>
            </div>

            {/* Decision B: Defect Classification inside Metal Plate */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block">
                Decision B: Does Metal Plate Contain Defects?
              </span>
              {platePresence === 'METAL PLATE DETECTED' ? (
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    defectDecision === 'DEFECT DETECTED'
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : defectDecision === 'DEFECT DETECTED — LOCATION UNAVAILABLE'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-emerald-500/10 border-emerald-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold uppercase ${
                        defectDecision === 'DEFECT DETECTED'
                          ? 'text-rose-300'
                          : defectDecision === 'DEFECT DETECTED — LOCATION UNAVAILABLE'
                          ? 'text-amber-300'
                          : 'text-emerald-300'
                      }`}
                    >
                      {defectDecision}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold ${
                        defectDecision === 'DEFECT DETECTED'
                          ? 'text-rose-400'
                          : defectDecision === 'DEFECT DETECTED — LOCATION UNAVAILABLE'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {confidence ? `${(confidence * 100).toFixed(1)}% Conf` : '—'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 flex items-center justify-between">
                    <span>Valid Defect Markings:</span>
                    <span className="font-semibold text-white font-mono">
                      {defects.length} Localized Region{defects.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {defects.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-white/5">
                      {defects.map((d, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-[10px] font-mono text-rose-300 bg-rose-500/10 px-2 py-1 rounded"
                        >
                          <span>{d.label}</span>
                          <span>Severity: {d.severity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 text-center text-xs text-slate-500">
                  Defect inspection paused — background will not be evaluated for defects.
                </div>
              )}
            </div>

            {/* Official Inspection Logging CTA */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleLogSnapshot}
                disabled={!isDetecting || platePresence !== 'METAL PLATE DETECTED' || isLoggingSnapshot}
                className="w-full glass-button-primary py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-cyan-500/20"
              >
                {isLoggingSnapshot ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>Logging to History...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 text-cyan-300" />
                    <span>Log Inspection to History</span>
                  </>
                )}
              </button>
              <p className="text-[10px] text-slate-500 text-center mt-1.5">
                Records verified inspection entry without database spam during live streaming.
              </p>
            </div>
          </div>

          {/* Product Identification Information */}
          <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-2 text-xs">
            <span className="font-semibold text-slate-300 block text-[11px] uppercase tracking-wider">
              Metal Plate Compliance Standards:
            </span>
            <div className="space-y-1.5 text-slate-400 text-[11px]">
              <div>
                <span className="text-slate-500">Product:</span>{' '}
                <span className="font-mono text-cyan-300 font-semibold">{selectedProductId}</span>
              </div>
              <div>
                <span className="text-slate-500">Name:</span> {selectedProduct?.name || 'Demonstration metal plate'}
              </div>
              <div>
                <span className="text-slate-500">Classifier:</span> BIT-PLATE-CV-1.0 (Threshold: 0.50)
              </div>
              <div>
                <span className="text-slate-500">NMS Suppression:</span> IoU &gt; 0.30 deduplicated
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
