import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { InspectionBatch, Product } from '../types';
import { DefectLocalizationViewer } from '../components/DefectLocalizationViewer';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  FileX2,
  FileCheck2,
  ExternalLink,
  Sparkles,
  Eye,
  X,
  Crosshair,
  Percent,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface BatchInspectionProps {
  onNavigate: (view: any) => void;
  onSelectInspection?: (id: string) => void;
}

export const BatchInspection: React.FC<BatchInspectionProps> = ({ onNavigate, onSelectInspection }) => {
  const { user } = useAuth();
  const isSupervisor = user?.role === 'SUPERVISOR';

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('P-PLATE01');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [activeBatch, setActiveBatch] = useState<InspectionBatch | null>(null);
  const [batchItems, setBatchItems] = useState<any[]>([]);
  const [allBatches, setAllBatches] = useState<InspectionBatch[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedItemForModal, setSelectedItemForModal] = useState<any | null>(null);
  const pollingIntervalRef = useRef<any>(null);

  // Load products and batch history on mount
  const loadBatchList = async () => {
    try {
      const bList = await api.getBatches();
      setAllBatches(bList);
      if (bList.length > 0 && !activeBatch) {
        selectBatchForInspection(bList[0]);
      }
    } catch (err) {
      console.warn('Failed to load batch list:', err);
    }
  };

  const selectBatchForInspection = async (batch: InspectionBatch) => {
    setActiveBatch(batch);
    try {
      const data = await api.getBatchById(batch.batchId);
      setBatchItems(data.items);
      if (['PENDING', 'PROCESSING'].includes(batch.status)) {
        startStatusPolling(batch.batchId);
      }
    } catch (err) {
      console.error('Failed to load batch items:', err);
    }
  };

  useEffect(() => {
    async function fetchProducts() {
      try {
        const list = await api.getProducts();
        if (list && list.length > 0) {
          setProducts(list);
          if (!list.some((p) => p.productId === productId)) {
            setProductId(list[0].productId);
          }
        }
      } catch (err) {
        console.warn('Failed to load products:', err);
      }
    }
    fetchProducts();
    loadBatchList();
  }, []);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files);
    if (selectedFiles.length + newFiles.length > 20) {
      setErrorMessage('Batch limit exceeded: Maximum 20 images allowed per batch.');
      return;
    }
    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setErrorMessage(null);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Preset loader: loads up to 12 sample specimens (both defective and normal)
  const handleLoadSampleBatch = async (count: number = 10) => {
    setErrorMessage(null);
    try {
      const sampleNames = [
        'inspection_024.jpg', // Defective scratch
        'inspection_001.png', // Defective multi
        'inspection_002.jpg', // Normal
        'inspection_003.png', // Defective
        'inspection_004.jpg', // Normal
        'inspection_005.png', // Defective
        'inspection_006.jpg', // Normal
        'inspection_007.png', // Defective
        'inspection_008.jpg', // Normal
        'inspection_009.png', // Defective
        'inspection_010.jpg', // Normal
        'inspection_011.png', // Defective
        'inspection_012.jpg', // Normal
        'inspection_013.png', // Defective
        'inspection_014.jpg', // Normal
        'inspection_015.png', // Defective
        'inspection_016.jpg', // Normal
        'inspection_017.png', // Defective
        'inspection_018.jpg', // Normal
        'inspection_019.png', // Defective
      ].slice(0, count);

      const loadedFiles: File[] = [];
      for (const name of sampleNames) {
        const res = await fetch(`/samples/images/${name}`);
        const blob = await res.blob();
        loadedFiles.push(new File([blob], name, { type: blob.type || 'image/png' }));
      }

      setSelectedFiles(loadedFiles);
    } catch (err) {
      console.error('Failed to load sample batch:', err);
      setErrorMessage('Failed to load preset batch samples');
    }
  };

  const handleSubmitBatch = async () => {
    if (selectedFiles.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('productId', productId);
    selectedFiles.forEach((file) => {
      formData.append('images', file);
    });

    try {
      const response = await api.createBatch(formData);
      setActiveBatch(response.batch);
      setBatchItems(response.items);
      setSelectedFiles([]);

      // Start polling status
      startStatusPolling(response.batch.batchId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit batch');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startStatusPolling = (batchId: string) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const batchData = await api.getBatchById(batchId);
        setActiveBatch(batchData.batch);
        setBatchItems(batchData.items);

        // Check if finished
        if (['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED'].includes(batchData.batch.status)) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } catch (err) {
        console.error('Error polling batch status:', err);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, []);

  const totalProcessed = activeBatch
    ? (activeBatch.completedFiles || 0) + (activeBatch.rejectedFiles || 0) + (activeBatch.failedFiles || 0)
    : 0;
  const progressPercent =
    activeBatch && activeBatch.totalFiles > 0
      ? Math.round((totalProcessed / activeBatch.totalFiles) * 100)
      : 0;

  const normalCount = batchItems.filter((i) => i.predictedClass === 'Normal').length;
  const defectiveCount = batchItems.filter((i) => i.predictedClass === 'Defective').length;
  const passYield =
    totalProcessed > 0 ? ((normalCount / totalProcessed) * 100).toFixed(1) : '100.0';

  return (
    <div className="space-y-6">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                isSupervisor
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                  : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
              }`}
            >
              {isSupervisor ? 'Supervisor Monitoring View' : 'Engineer Batch Inspection'}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400 font-mono">Product: {productId}</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            {isSupervisor ? 'Batch Inspection Runs Monitor' : 'Batch Inspection Workspace'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isSupervisor
              ? 'Real-time multi-specimen screening telemetry. Image upload and batch execution are restricted exclusively to Quality Engineers.'
              : 'Asynchronous multi-specimen screening (up to 20 images) with real-time status tracking and defect localization.'}
          </p>
        </div>

        {/* Header action controls */}
        <div className="flex flex-wrap items-center gap-2">
          {isSupervisor ? (
            <button
              type="button"
              onClick={() => onNavigate('reviews')}
              className="glass-button-primary px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Review Center (Batch Decisions)</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleLoadSampleBatch(10)}
                className="glass-button-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-cyan-300 border-cyan-500/30"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Load 10 Samples</span>
              </button>
              <button
                type="button"
                onClick={() => handleLoadSampleBatch(20)}
                className="glass-button-secondary px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer text-indigo-300 border-indigo-500/30"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Load 20 Max Batch</span>
              </button>
            </>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* SUPERVISOR VIEW: Batch Runs Selector & Status Overview (NO upload image part) */}
      {isSupervisor ? (
        <div className="glass-panel p-5 rounded-2xl border border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                Select Batch Inspection Run to Inspect ({allBatches.length} Total Batches)
              </h3>
            </div>
            <div className="text-[11px] text-slate-400">
              Only Quality Engineers have permission to upload/inspect images.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {allBatches.length === 0 ? (
              <div className="col-span-full py-6 text-center text-xs text-slate-500">
                No batch inspection runs logged yet.
              </div>
            ) : (
              allBatches.map((b) => {
                const isSelected = activeBatch?.batchId === b.batchId;
                return (
                  <button
                    key={b.batchId}
                    type="button"
                    onClick={() => selectBatchForInspection(b)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                      isSelected
                        ? 'bg-indigo-500/15 border-indigo-500/40 shadow-sm'
                        : 'bg-slate-900/60 border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-white truncate">{b.batchId}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : b.status === 'PROCESSING'
                            ? 'bg-cyan-500/20 text-cyan-300 animate-pulse'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 flex justify-between">
                      <span>{b.totalFiles} Specimens</span>
                      <span>By {b.uploaderUsername}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* ENGINEER VIEW: Upload & Staging Area (Allowed for Engineers) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  Staged Batch Images ({selectedFiles.length}/20)
                </span>
                <span className="text-[11px] text-slate-500">Max 20 images per batch run</span>
              </div>

              {/* Dropzone */}
              <label className="border-2 border-dashed border-white/10 hover:border-white/20 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-slate-950/40 transition-all">
                <UploadCloud className="w-8 h-8 text-cyan-400 mb-2" />
                <span className="text-xs font-semibold text-white">Select or drop up to 20 images</span>
                <span className="text-[11px] text-slate-400 mt-0.5">JPEG or PNG, 64–4096px, ≤5MB</span>
                <input
                  type="file"
                  multiple
                  accept="image/png, image/jpeg"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />
              </label>

              {/* File thumbnails grid */}
              {selectedFiles.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Selected Files Ready for Ingestion</span>
                    <button
                      type="button"
                      onClick={() => setSelectedFiles([])}
                      className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-56 overflow-y-auto p-1">
                    {selectedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-xl bg-slate-900 border border-white/5 relative group flex flex-col items-center"
                      >
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(idx)}
                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="text-[10px] font-mono text-cyan-400">#{idx + 1}</span>
                        <span className="text-[11px] text-slate-300 font-mono truncate w-full text-center mt-1">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Settings & Dispatch */}
          <div className="lg:col-span-4 space-y-4">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 block">
                  Target Product Specification
                </label>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  {products.map((p) => (
                    <option key={p.productId} value={p.productId} className="bg-slate-900 text-white">
                      {p.productId} — {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-white/5 text-xs space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Model Pipeline</span>
                  <span className="font-mono text-white">BIT-PLATE-CV-1.0</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Max Batch Size</span>
                  <span className="font-mono text-cyan-400">20 Specimens</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Worker Execution</span>
                  <span className="font-mono text-slate-300">Asynchronous / Queue</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSubmitBatch}
                disabled={selectedFiles.length === 0 || isSubmitting}
                className="w-full glass-button-primary py-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-cyan-500/20"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-cyan-300" />
                    <span>Enqueuing Batch...</span>
                  </>
                ) : (
                  <>
                    <Layers className="w-4 h-4 text-cyan-300" />
                    <span>Dispatch Batch ({selectedFiles.length} Images)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Batch Progress & Metrics */}
      {activeBatch && (
        <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-wide">
                  Batch Inspection Run: {activeBatch.batchId}
                </h3>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                    activeBatch.status === 'COMPLETED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : activeBatch.status === 'PROCESSING'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {activeBatch.status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Product: <span className="text-cyan-300 font-mono">{activeBatch.productId || productId}</span> · Submitted by {activeBatch.uploaderUsername}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-4 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-white/5 text-center min-w-[70px]">
                <div className="text-[10px] text-slate-400">Total</div>
                <div className="text-sm font-bold text-white">{activeBatch.totalFiles}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center min-w-[70px]">
                <div className="text-[10px] text-emerald-400">Normal</div>
                <div className="text-sm font-bold text-emerald-300">{normalCount}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center min-w-[70px]">
                <div className="text-[10px] text-rose-400">Defective</div>
                <div className="text-sm font-bold text-rose-300">{defectiveCount}</div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-center min-w-[70px]">
                <div className="text-[10px] text-cyan-400">Pass Yield</div>
                <div className="text-sm font-bold text-cyan-300">{passYield}%</div>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>Pipeline Progress</span>
              <span>
                {totalProcessed} of {activeBatch.totalFiles} files processed ({progressPercent}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Itemized Grid */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Itemized Specimen Results ({batchItems.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Click any specimen to open visual defect markings & side-by-side view
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {batchItems.map((item) => {
                const isDefective = item.predictedClass === 'Defective';
                const hasLoc = isDefective && item.localization?.available;
                return (
                  <div
                    key={item.inspectionId}
                    onClick={() => setSelectedItemForModal(item)}
                    className="p-3 rounded-xl bg-slate-900/80 border border-white/5 hover:border-cyan-500/40 transition-all cursor-pointer group space-y-2.5"
                  >
                    <div className="aspect-square rounded-lg bg-black/50 overflow-hidden relative border border-white/5 flex items-center justify-center">
                      <img
                        src={item.annotatedImagePath || item.imagePath}
                        alt={item.originalFilename}
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                      {item.predictedClass && (
                        <div
                          className={`absolute top-1.5 left-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase shadow ${
                            isDefective ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {item.predictedClass}
                        </div>
                      )}

                      {hasLoc && (
                        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-slate-900/90 text-[10px] text-rose-300 font-mono border border-rose-500/40">
                          {item.localization.defectCount} Defect{item.localization.defectCount > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-mono text-slate-200 truncate font-semibold">
                        {item.originalFilename}
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>Confidence:</span>
                        <span className="font-mono text-white">
                          {item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : '—'}
                        </span>
                      </div>
                      <div className="text-[10px] text-cyan-400 flex items-center gap-1 group-hover:underline pt-1">
                        <Eye className="w-3 h-3" />
                        <span>Inspect Defect Marking</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Defect Localization Modal for Batch Item Inspection */}
      {selectedItemForModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-white/10 p-6 space-y-4 relative">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Batch Specimen Inspection: {selectedItemForModal.originalFilename}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedItemForModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <DefectLocalizationViewer
              originalImageUrl={selectedItemForModal.imagePath}
              annotatedImageUrl={selectedItemForModal.annotatedImagePath || selectedItemForModal.imagePath}
              predictedClass={selectedItemForModal.predictedClass || 'Normal'}
              confidence={selectedItemForModal.confidence || 0.95}
              defectProbability={selectedItemForModal.defectProbability}
              localization={selectedItemForModal.localization}
              inspectionId={selectedItemForModal.inspectionId}
              productId={selectedItemForModal.productId}
              title={`Specimen: ${selectedItemForModal.originalFilename}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
