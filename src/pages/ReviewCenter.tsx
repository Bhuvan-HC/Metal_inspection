import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Inspection, InspectionBatch, InspectionReview, Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { DefectLocalizationViewer } from '../components/DefectLocalizationViewer';
import {
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Clock,
  Sparkles,
  ExternalLink,
  MessageSquare,
  Lock,
  Layers,
  FileImage,
  Eye,
  Check,
  RotateCcw,
  AlertCircle,
  Crosshair,
} from 'lucide-react';

export const ReviewCenter: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');

  // Products
  const [products, setProducts] = useState<Product[]>([]);

  // Single Inspections State
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [singleDecision, setSingleDecision] = useState<'CONFIRMED' | 'CORRECTED'>('CONFIRMED');
  const [singleReviewedClass, setSingleReviewedClass] = useState<'Normal' | 'Defective'>('Normal');
  const [singleComments, setSingleComments] = useState('');
  const [isSubmittingSingle, setIsSubmittingSingle] = useState(false);
  const [singleSuccessMessage, setSingleSuccessMessage] = useState<string | null>(null);
  const [singleErrorMessage, setSingleErrorMessage] = useState<string | null>(null);

  // Batch Inspections State
  const [batches, setBatches] = useState<InspectionBatch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<InspectionBatch | null>(null);
  const [selectedBatchItems, setSelectedBatchItems] = useState<Inspection[]>([]);
  const [batchDecision, setBatchDecision] = useState<'CONFIRMED' | 'CORRECTED'>('CONFIRMED');
  const [batchComments, setBatchComments] = useState('');
  const [itemOverrides, setItemOverrides] = useState<Record<string, 'Normal' | 'Defective'>>({});
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);
  const [batchSuccessMessage, setBatchSuccessMessage] = useState<string | null>(null);
  const [batchErrorMessage, setBatchErrorMessage] = useState<string | null>(null);
  const [previewItemModal, setPreviewItemModal] = useState<Inspection | null>(null);

  // 403 Security Check Result
  const [denialTestResult, setDenialTestResult] = useState<string | null>(null);

  const isSupervisorOrAdmin = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';

  // Load Single Inspections & Batches
  const loadData = async () => {
    try {
      const [recList, batchList, prodList] = await Promise.all([
        api.getInspections({ status: 'COMPLETED' }),
        api.getBatches(),
        api.getProducts().catch(() => []),
      ]);
      setInspections(recList);
      setBatches(batchList);
      setProducts(prodList);

      if (recList.length > 0 && !selectedInspection) {
        selectSingleRecord(recList[0]);
      }
      if (batchList.length > 0 && !selectedBatch) {
        selectBatchRecord(batchList[0]);
      }
    } catch (err: any) {
      console.error('Failed to load review items:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Single Record Selection
  const selectSingleRecord = (item: Inspection) => {
    setSelectedInspection(item);
    setSingleDecision('CONFIRMED');
    setSingleReviewedClass(item.predictedClass || 'Normal');
    setSingleComments('');
    setSingleSuccessMessage(null);
    setSingleErrorMessage(null);
  };

  const handleSingleDecisionToggle = (newDecision: 'CONFIRMED' | 'CORRECTED') => {
    setSingleDecision(newDecision);
    if (newDecision === 'CONFIRMED' && selectedInspection?.predictedClass) {
      setSingleReviewedClass(selectedInspection.predictedClass);
    } else if (newDecision === 'CORRECTED' && selectedInspection?.predictedClass) {
      setSingleReviewedClass(selectedInspection.predictedClass === 'Normal' ? 'Defective' : 'Normal');
    }
  };

  const handleSubmitSingleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInspection) return;

    setIsSubmittingSingle(true);
    setSingleSuccessMessage(null);
    setSingleErrorMessage(null);

    try {
      await api.submitReview(selectedInspection.inspectionId, {
        decision: singleDecision,
        reviewedClass: singleReviewedClass,
        comments: singleComments,
      });

      setSingleSuccessMessage(
        `Successfully saved review: Decision ${singleDecision} as ${singleReviewedClass}. Original AI record preserved.`
      );
      loadData();
    } catch (err: any) {
      setSingleErrorMessage(err.message || 'Failed to submit review');
    } finally {
      setIsSubmittingSingle(false);
    }
  };

  // Batch Selection
  const selectBatchRecord = async (batch: InspectionBatch) => {
    setSelectedBatch(batch);
    setBatchDecision(batch.reviewStatus === 'CORRECTED' ? 'CORRECTED' : 'CONFIRMED');
    setBatchComments(batch.reviewComments || '');
    setBatchSuccessMessage(null);
    setBatchErrorMessage(null);

    try {
      const data = await api.getBatchById(batch.batchId);
      setSelectedBatchItems(data.items);
      const initialOverrides: Record<string, 'Normal' | 'Defective'> = {};
      data.items.forEach((it) => {
        initialOverrides[it.inspectionId] = it.predictedClass || 'Normal';
      });
      setItemOverrides(initialOverrides);
    } catch (err) {
      console.error('Error fetching batch items:', err);
    }
  };

  const handleToggleItemClass = (inspectionId: string) => {
    setItemOverrides((prev) => ({
      ...prev,
      [inspectionId]: prev[inspectionId] === 'Normal' ? 'Defective' : 'Normal',
    }));
  };

  const handleSubmitBatchReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;

    setIsSubmittingBatch(true);
    setBatchSuccessMessage(null);
    setBatchErrorMessage(null);

    try {
      const itemReviewsPayload = selectedBatchItems.map((it) => ({
        inspectionId: it.inspectionId,
        reviewedClass: itemOverrides[it.inspectionId] || it.predictedClass || 'Normal',
        comments: `Reviewed in batch ${selectedBatch.batchId}`,
      }));

      await api.submitBatchReview(selectedBatch.batchId, {
        decision: batchDecision,
        comments: batchComments,
        itemReviews: itemReviewsPayload,
      });

      setBatchSuccessMessage(
        `Batch review submitted: Marked ${batchDecision} with ${selectedBatchItems.length} item reviews synchronized.`
      );
      loadData();
    } catch (err: any) {
      setBatchErrorMessage(err.message || 'Failed to submit batch review');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  // Authorization Check
  if (!isSupervisorOrAdmin) {
    return (
      <div className="py-16 max-w-xl mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 mx-auto flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white">Supervisor Authorization Required</h2>
        <p className="text-xs text-slate-400">
          You are currently signed in as <span className="font-semibold text-cyan-300">{user?.username}</span> with the{' '}
          <span className="font-semibold text-cyan-300">{user?.role}</span> role.
          By contest security specifications, quality inspection reviews and prediction overrides are strictly restricted to the{' '}
          <span className="text-indigo-300 font-semibold">SUPERVISOR</span> role.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Separate Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Supervisor Quality Review Center</h2>
          <p className="text-xs text-slate-400 mt-1">
            Independent supervisory evaluation with separate decision forms for Single and Batch inspections.
          </p>
        </div>

        {/* Top-Level Tabs: Single vs Batch Decision Forms */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('single')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'single'
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <FileImage className="w-4 h-4" />
            <span>Single Image Review Form</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'batch'
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Batch Inspection Review Form</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: SINGLE IMAGE INSPECTION SUPERVISOR DECISION FORM */}
      {/* ======================================================== */}
      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Queue of Single Inspections (4 Cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-slate-300">
                Single Inspection Queue ({inspections.length})
              </span>
              <span className="text-[11px] text-slate-500">Live DB Records</span>
            </div>

            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {inspections.length === 0 ? (
                <div className="p-8 text-center glass-panel rounded-2xl text-xs text-slate-400">
                  No completed single inspections found.
                </div>
              ) : (
                inspections.map((item) => {
                  const isSelected = selectedInspection?.inspectionId === item.inspectionId;
                  const isDefective = item.predictedClass === 'Defective';
                  return (
                    <div
                      key={item.inspectionId}
                      onClick={() => selectSingleRecord(item)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                          : 'glass-panel border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-black/40 overflow-hidden shrink-0 border border-white/10 flex items-center justify-center">
                        <img
                          src={item.annotatedImagePath || item.imagePath}
                          alt={item.originalFilename}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-semibold text-white truncate">
                            {item.inspectionId}
                          </span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                              isDefective
                                ? 'bg-rose-500/20 text-rose-300'
                                : 'bg-emerald-500/20 text-emerald-300'
                            }`}
                          >
                            {item.predictedClass}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {item.originalFilename}
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                          <span>By {item.uploaderUsername}</span>
                          <span>{item.reviewStatus || 'UNREVIEWED'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Dedicated Single Decision Form & Defect Viewer (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedInspection ? (
              <>
                {/* Visual Defect Marking Viewer for Supervisor */}
                <DefectLocalizationViewer
                  originalImageUrl={selectedInspection.imagePath}
                  annotatedImageUrl={selectedInspection.annotatedImagePath || selectedInspection.imagePath}
                  predictedClass={selectedInspection.predictedClass || 'Normal'}
                  confidence={selectedInspection.confidence || 0.95}
                  defectProbability={selectedInspection.defectProbability}
                  localization={selectedInspection.localization}
                  inspectionId={selectedInspection.inspectionId}
                  productId={selectedInspection.productId}
                  title={`Supervisor Inspection View: ${selectedInspection.inspectionId}`}
                />

                {/* Supervisor Single Decision Form */}
                <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-white/5">
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-wide">
                        Supervisor Single Image Decision Form
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Submit a formal quality decision confirming or overriding the neural model's prediction.
                      </p>
                    </div>

                    <div className="px-3 py-1 rounded-xl bg-slate-900 border border-white/10 text-right">
                      <div className="text-[10px] text-slate-500">AI PREDICTION</div>
                      <div
                        className={`text-xs font-bold ${
                          selectedInspection.predictedClass === 'Defective'
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {selectedInspection.predictedClass} ({(selectedInspection.confidence! * 100).toFixed(1)}%)
                      </div>
                    </div>
                  </div>

                  {singleSuccessMessage && (
                    <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{singleSuccessMessage}</span>
                    </div>
                  )}

                  {singleErrorMessage && (
                    <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{singleErrorMessage}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmitSingleReview} className="space-y-4">
                    {/* Decision Selector: CONFIRMED vs CORRECTED */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 block">
                        Supervisory Decision
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => handleSingleDecisionToggle('CONFIRMED')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            singleDecision === 'CONFIRMED'
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="font-semibold text-xs flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>CONFIRMED</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Confirm AI model's {selectedInspection.predictedClass} classification
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleSingleDecisionToggle('CORRECTED')}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            singleDecision === 'CORRECTED'
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                              : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          <div className="font-semibold text-xs flex items-center gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                            <span>CORRECTED</span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1">
                            Override prediction based on manual quality standard
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Final Classification Selection */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 block">
                        Final Supervised Classification
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                            singleReviewedClass === 'Normal'
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 font-semibold'
                              : 'bg-slate-900 border-white/5 text-slate-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="singleReviewedClass"
                            value="Normal"
                            checked={singleReviewedClass === 'Normal'}
                            onChange={() => setSingleReviewedClass('Normal')}
                            className="hidden"
                          />
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs">Normal (Conforming Part)</span>
                        </label>

                        <label
                          className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${
                            singleReviewedClass === 'Defective'
                              ? 'bg-rose-500/10 border-rose-500/40 text-rose-300 font-semibold'
                              : 'bg-slate-900 border-white/5 text-slate-400'
                          }`}
                        >
                          <input
                            type="radio"
                            name="singleReviewedClass"
                            value="Defective"
                            checked={singleReviewedClass === 'Defective'}
                            onChange={() => setSingleReviewedClass('Defective')}
                            className="hidden"
                          />
                          <AlertTriangle className="w-4 h-4 text-rose-400" />
                          <span className="text-xs">Defective (Non-Conforming)</span>
                        </label>
                      </div>
                    </div>

                    {/* Comments */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 block">
                        Supervisor Quality Notes / Justification
                      </label>
                      <textarea
                        rows={3}
                        value={singleComments}
                        onChange={(e) => setSingleComments(e.target.value)}
                        placeholder="e.g., Scratch verified on metallic plate surface at coordinates [118, 122]. Exceeds class A aesthetic tolerance."
                        className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    {/* Submit Single Review Button */}
                    <button
                      type="submit"
                      disabled={isSubmittingSingle}
                      className="glass-button-primary px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
                    >
                      {isSubmittingSingle ? (
                        <span>Saving Supervisor Review...</span>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-cyan-300" />
                          <span>Submit Single Image Review</span>
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="glass-panel p-12 text-center rounded-2xl text-slate-400 text-xs">
                Select an inspection from the queue to start supervisory review.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: BATCH INSPECTION SUPERVISOR DECISION FORM */}
      {/* ======================================================== */}
      {activeTab === 'batch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Batches List (4 Cols) */}
          <div className="lg:col-span-4 space-y-3">
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-semibold text-slate-300">
                Submitted Batches ({batches.length})
              </span>
              <span className="text-[11px] text-slate-500">Up to 20 images/batch</span>
            </div>

            <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
              {batches.length === 0 ? (
                <div className="p-8 text-center glass-panel rounded-2xl text-xs text-slate-400">
                  No batch inspection records found.
                </div>
              ) : (
                batches.map((b) => {
                  const isSelected = selectedBatch?.batchId === b.batchId;
                  return (
                    <div
                      key={b.batchId}
                      onClick={() => selectBatchRecord(b)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                          : 'glass-panel border-white/5 hover:border-white/15'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-white">
                          {b.batchId}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                            b.reviewStatus === 'CONFIRMED'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : b.reviewStatus === 'CORRECTED'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {b.reviewStatus || 'UNREVIEWED'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span>{b.totalFiles} Specimens</span>
                        <span>Product: {b.productId || 'P-PLATE01'}</span>
                      </div>

                      <div className="text-[10px] text-slate-500 flex justify-between">
                        <span>By {b.uploaderUsername}</span>
                        <span>{new Date(b.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Batch Review Decision Form & Item Overrides (8 Cols) */}
          <div className="lg:col-span-8 space-y-4">
            {selectedBatch ? (
              <div className="glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
                {/* Batch Header Summary */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-wide">
                      Supervisor Batch Decision Form: {selectedBatch.batchId}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Batch-level signoff and item-by-item supervisory review for lot disposition.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Status:</span>
                    <span className="text-xs font-mono font-bold text-cyan-300">
                      {selectedBatch.status}
                    </span>
                  </div>
                </div>

                {batchSuccessMessage && (
                  <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{batchSuccessMessage}</span>
                  </div>
                )}

                {batchErrorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{batchErrorMessage}</span>
                  </div>
                )}

                {/* Batch Form */}
                <form onSubmit={handleSubmitBatchReview} className="space-y-5">
                  {/* Batch Decision Mode */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Batch Quality Disposition
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setBatchDecision('CONFIRMED')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          batchDecision === 'CONFIRMED'
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                            : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>CONFIRMED BATCH</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Approve lot conforming with model findings
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setBatchDecision('CORRECTED')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          batchDecision === 'CORRECTED'
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                            : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-semibold text-xs flex items-center gap-1.5">
                          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                          <span>OVERRIDE / CORRECT BATCH</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                          Apply specific supervisor overrides to batch items
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Batch Supervisor Comments */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      Supervisor Batch Notes & Production Release
                    </label>
                    <textarea
                      rows={2}
                      value={batchComments}
                      onChange={(e) => setBatchComments(e.target.value)}
                      placeholder="e.g., Batch lot passed sample audit. Defective units segregated to quarantine bin."
                      className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Itemized Batch Reviews with Quick Override Switch */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-300">
                        Itemized Batch Review Table ({selectedBatchItems.length} Specimens)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Click 'Override' to invert classification or 'Inspect' to view defect markings
                      </span>
                    </div>

                    <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-950/60 divide-y divide-white/5">
                      {selectedBatchItems.map((item) => {
                        const currentClass = itemOverrides[item.inspectionId] || item.predictedClass;
                        const isOverridden = currentClass !== item.predictedClass;
                        const hasLoc = item.localization?.available;

                        return (
                          <div
                            key={item.inspectionId}
                            className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-black/40 overflow-hidden shrink-0 border border-white/10 flex items-center justify-center">
                                <img
                                  src={item.annotatedImagePath || item.imagePath}
                                  alt={item.originalFilename}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <div>
                                <div className="font-mono font-semibold text-white">
                                  {item.originalFilename}
                                </div>
                                <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>AI:</span>
                                  <span
                                    className={`font-semibold ${
                                      item.predictedClass === 'Defective'
                                        ? 'text-rose-400'
                                        : 'text-emerald-400'
                                    }`}
                                  >
                                    {item.predictedClass} ({(item.confidence! * 100).toFixed(0)}%)
                                  </span>
                                  {hasLoc && (
                                    <span className="text-[10px] text-rose-300 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/30">
                                      {item.localization?.defectCount} Defect Marked
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Supervisor Decision Controls for this item */}
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() => setPreviewItemModal(item)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] flex items-center gap-1 cursor-pointer border border-white/10"
                              >
                                <Eye className="w-3 h-3 text-cyan-400" />
                                <span>Inspect</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleItemClass(item.inspectionId)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                                  currentClass === 'Normal'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                }`}
                              >
                                {currentClass} {isOverridden ? '(Overridden)' : ''}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Submit Batch Review Button */}
                  <button
                    type="submit"
                    disabled={isSubmittingBatch}
                    className="glass-button-primary px-5 py-2.5 rounded-xl text-xs font-semibold text-white flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
                  >
                    {isSubmittingBatch ? (
                      <span>Saving Batch Decision...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-cyan-300" />
                        <span>Submit Batch Review Decision</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <div className="glass-panel p-12 text-center rounded-2xl text-slate-400 text-xs">
                Select a batch from the left column to review.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Item Inspection Modal */}
      {previewItemModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">
                  Batch Specimen Review: {previewItemModal.originalFilename}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItemModal(null)}
                className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <DefectLocalizationViewer
              originalImageUrl={previewItemModal.imagePath}
              annotatedImageUrl={previewItemModal.annotatedImagePath || previewItemModal.imagePath}
              predictedClass={previewItemModal.predictedClass || 'Normal'}
              confidence={previewItemModal.confidence || 0.95}
              defectProbability={previewItemModal.defectProbability}
              localization={previewItemModal.localization}
              inspectionId={previewItemModal.inspectionId}
              productId={previewItemModal.productId}
              title={`Specimen: ${previewItemModal.originalFilename}`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
