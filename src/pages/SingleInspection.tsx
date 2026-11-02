import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Inspection, Product } from '../types';
import { DefectLocalizationViewer } from '../components/DefectLocalizationViewer';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileImage,
  RefreshCw,
  Hash,
  Clock,
  Layers,
  ArrowRight,
  Info,
  Camera,
  Download,
  Crosshair,
  ExternalLink,
} from 'lucide-react';

interface SingleInspectionProps {
  onNavigate: (view: any) => void;
  onSelectInspection?: (id: string) => void;
}

export const SingleInspection: React.FC<SingleInspectionProps> = ({ onNavigate, onSelectInspection }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('P-PLATE01');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<Inspection | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<any | null>(null);

  // Load products on mount
  useEffect(() => {
    async function loadProducts() {
      try {
        const prods = await api.getProducts();
        if (prods && prods.length > 0) {
          setProducts(prods);
          if (!prods.some((p) => p.productId === productId)) {
            setProductId(prods[0].productId);
          }
        }
      } catch (err) {
        console.warn('Failed to load products:', err);
      }
    }
    loadProducts();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setErrorMessage(null);
      setValidationDetails(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setErrorMessage(null);
      setValidationDetails(null);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleLoadSample = async (samplePath: string, filename: string) => {
    try {
      const res = await fetch(samplePath);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || 'image/png' });
      setSelectedFile(file);
      setPreviewUrl(samplePath);
      setResult(null);
      setErrorMessage(null);
      setValidationDetails(null);
    } catch (err) {
      console.error('Failed to load sample image:', err);
    }
  };

  const handleRunInspection = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setErrorMessage(null);
    setResult(null);
    setValidationDetails(null);

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('productId', productId);

    try {
      const response = await api.createInspection(formData);
      if (response.inspection) {
        setResult(response.inspection);
      }
      if (response.validation) {
        setValidationDetails(response.validation);
      }
      if (response.error || response.inspection?.status === 'REJECTED') {
        setErrorMessage(response.error || response.inspection?.errorMessage || 'Inspection rejected');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Inspection failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedProduct = products.find((p) => p.productId === productId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Single Image Inspection</h2>
          <p className="text-xs text-slate-400 mt-1">
            Perform rigorous AI visual quality screening with instant defect localization and bounding markings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('camera-inspection')}
          className="glass-button-secondary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 text-cyan-300 border-cyan-500/30 cursor-pointer self-start sm:self-auto hover:bg-cyan-500/10 shadow-lg shadow-cyan-500/10"
        >
          <Camera className="w-4 h-4 text-cyan-400" />
          <span>Switch to Metal Plate Detection</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Upload & Image Workspace (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Specimen Image Upload</span>
              <span className="text-[11px] text-slate-500">Supported: PNG, JPEG (64x64 to 4096px, ≤5MB)</span>
            </div>

            {/* Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all ${
                previewUrl
                  ? 'border-cyan-500/40 bg-slate-900/60'
                  : 'border-white/10 hover:border-white/20 bg-slate-950/40'
              }`}
            >
              {previewUrl ? (
                <div className="space-y-3 w-full flex flex-col items-center">
                  <div className="relative max-h-72 rounded-xl overflow-hidden bg-slate-950 border border-white/10 p-2 flex items-center justify-center shadow-2xl">
                    <img
                      src={previewUrl}
                      alt="Selected Specimen"
                      className="max-h-64 object-contain rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span className="font-mono text-white">{selectedFile?.name}</span>
                    <span>·</span>
                    <span>{((selectedFile?.size || 0) / 1024).toFixed(1)} KB</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setPreviewUrl(null);
                        setResult(null);
                        setErrorMessage(null);
                      }}
                      className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer ml-2"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="cursor-pointer space-y-3 py-6 flex flex-col items-center">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                    <UploadCloud className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white block">
                      Click to upload specimen image
                    </span>
                    <span className="text-xs text-slate-400 block mt-1">
                      or drag and drop your file here
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Quick Test Presets */}
            <div className="space-y-2 pt-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Quick Test Presets (Ground Truth & Validation):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => handleLoadSample('/samples/images/inspection_024.jpg', 'inspection_024.jpg')}
                  className="p-2.5 rounded-xl bg-slate-900 border border-white/5 hover:border-rose-500/30 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xs font-semibold text-slate-200 block group-hover:text-rose-300">
                    Sample #024
                  </span>
                  <span className="text-[10px] text-rose-400">Defective Plate (Scratch)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSample('/samples/images/inspection_001.png', 'inspection_001.png')}
                  className="p-2.5 rounded-xl bg-slate-900 border border-white/5 hover:border-rose-500/30 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xs font-semibold text-slate-200 block group-hover:text-rose-300">
                    Sample #001
                  </span>
                  <span className="text-[10px] text-rose-400">Defective Plate (PNG)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSample('/samples/images/inspection_002.jpg', 'inspection_002.jpg')}
                  className="p-2.5 rounded-xl bg-slate-900 border border-white/5 hover:border-emerald-500/30 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xs font-semibold text-slate-200 block group-hover:text-emerald-300">
                    Sample #002
                  </span>
                  <span className="text-[10px] text-emerald-400">Normal Plate (JPG)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadSample('/samples/validation/too_small.png', 'too_small.png')}
                  className="p-2.5 rounded-xl bg-slate-900 border border-white/5 hover:border-amber-500/30 text-left transition-all cursor-pointer group"
                >
                  <span className="text-xs font-semibold text-slate-200 block group-hover:text-amber-300">
                    Too Small (32px)
                  </span>
                  <span className="text-[10px] text-amber-400">Rejection Test</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Inspection Settings & Action (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-5">
            {/* Dynamic Product Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">
                Target Registered Product
              </label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {products.map((p) => (
                  <option key={p.productId} value={p.productId} className="bg-slate-900 text-white">
                    {p.productId} — {p.name}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-500 block">
                {selectedProduct?.description || 'Centered metal plate specimen evaluating scratches or pits.'}
              </span>
            </div>

            {/* Model Metadata Information */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Model Version</span>
                <span className="font-mono text-white">BIT-PLATE-CV-1.0</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Decision Threshold</span>
                <span className="font-mono text-cyan-400">0.50 (≥0.5 Defective)</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Localization Engine</span>
                <span className="font-mono text-rose-400">Surface Anomaly & Contours</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Feature Pipeline</span>
                <span className="font-mono text-slate-300">17-dim standardized</span>
              </div>
            </div>

            {/* Execute Button */}
            <button
              type="button"
              onClick={handleRunInspection}
              disabled={!selectedFile || isProcessing}
              className="w-full glass-button-primary py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-cyan-500/20"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                  <span>Executing Pipeline Inference...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-cyan-300" />
                  <span>Execute Quality Inspection</span>
                </>
              )}
            </button>

            {/* Error / Rejection Banner */}
            {errorMessage && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-rose-200">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Validation / Inference Rejection</span>
                </div>
                <p className="text-[11px] leading-relaxed text-rose-300/90">{errorMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Defect Localization & Result Viewer */}
      {result && (
        <div className="mt-8">
          <DefectLocalizationViewer
            originalImageUrl={result.imagePath || previewUrl || ''}
            annotatedImageUrl={result.annotatedImagePath || result.imagePath}
            predictedClass={result.predictedClass || 'Normal'}
            confidence={result.confidence || 0.95}
            defectProbability={result.defectProbability}
            localization={result.localization}
            inspectionId={result.inspectionId}
            productId={result.productId || productId}
            title={`Inspection Result: ${result.inspectionId}`}
          />
        </div>
      )}
    </div>
  );
};
