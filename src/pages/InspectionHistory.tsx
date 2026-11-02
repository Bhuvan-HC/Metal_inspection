import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Inspection, InspectionReview } from '../types';
import { useAuth } from '../context/AuthContext';
import { DefectLocalizationViewer } from '../components/DefectLocalizationViewer';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  X,
  Clock,
  Hash,
  ExternalLink,
  ShieldCheck,
  Download,
} from 'lucide-react';

interface InspectionHistoryProps {
  onNavigate: (view: any) => void;
  selectedInspectionId?: string | null;
  onClearSelected?: () => void;
}

export const InspectionHistory: React.FC<InspectionHistoryProps> = ({
  onNavigate,
  selectedInspectionId,
  onClearSelected,
}) => {
  const { user } = useAuth();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterReview, setFilterReview] = useState('ALL');
  const [personalOnly, setPersonalOnly] = useState(false);
  const [activeModalRecord, setActiveModalRecord] = useState<Inspection | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getInspections({
        predictedClass: filterClass,
        status: filterStatus,
        reviewStatus: filterReview,
        personal: personalOnly,
        search,
      });
      setInspections(data);

      if (selectedInspectionId) {
        const found = data.find((i) => i.inspectionId === selectedInspectionId);
        if (found) setActiveModalRecord(found);
      }
    } catch (err) {
      console.error('Failed to load inspections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filterClass, filterStatus, filterReview, personalOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const exportCSV = () => {
    const headers = [
      'Inspection ID',
      'Filename',
      'Product ID',
      'Status',
      'Predicted Class',
      'Confidence',
      'Defect Probability',
      'Review Decision',
      'Uploader',
      'Timestamp',
    ];
    const rows = inspections.map((i) => [
      i.inspectionId,
      i.originalFilename,
      i.productId,
      i.status,
      i.predictedClass || '',
      i.confidence ? `${(i.confidence * 100).toFixed(1)}%` : '',
      i.defectProbability ? `${(i.defectProbability * 100).toFixed(2)}%` : '',
      i.latestReview ? i.latestReview.decision : 'UNREVIEWED',
      i.uploaderUsername,
      i.createdAt,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `inspectai_records_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Metal Plate Inspection History</h2>
          <p className="text-xs text-slate-400 mt-1">
            Search, filter, and audit persistent metal plate quality inspection records with immutable predictions.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="glass-button-secondary px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Summary CSV</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-white/5 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Inspection ID, specimen filename, or uploader..."
              className="glass-input w-full pl-10 pr-4 py-2 rounded-xl text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Predicted Class Filter */}
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="glass-input px-3 py-2 rounded-xl text-xs"
            >
              <option value="ALL">All Predictions</option>
              <option value="Normal">Normal Plates</option>
              <option value="Defective">Defective Plates</option>
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="glass-input px-3 py-2 rounded-xl text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="REJECTED">Validation Rejected</option>
              <option value="FAILED">Failed</option>
            </select>

            {/* Review Status Filter */}
            <select
              value={filterReview}
              onChange={(e) => setFilterReview(e.target.value)}
              className="glass-input px-3 py-2 rounded-xl text-xs"
            >
              <option value="ALL">All Review States</option>
              <option value="UNREVIEWED">Unreviewed</option>
              <option value="CONFIRMED">Supervisor Confirmed</option>
              <option value="CORRECTED">Supervisor Corrected</option>
            </select>

            {user?.role === 'ENGINEER' && (
              <label className="flex items-center gap-1.5 text-xs text-slate-300 px-3 py-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={personalOnly}
                  onChange={(e) => setPersonalOnly(e.target.checked)}
                  className="rounded"
                />
                <span>My Uploads Only</span>
              </label>
            )}

            <button
              type="submit"
              className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* History Table */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/[0.03] text-slate-400 border-b border-white/5">
                <th className="py-3 px-4 font-semibold">Image</th>
                <th className="py-3 px-4 font-semibold">Inspection ID</th>
                <th className="py-3 px-4 font-semibold">Filename</th>
                <th className="py-3 px-4 font-semibold">Product</th>
                <th className="py-3 px-4 font-semibold">AI Prediction</th>
                <th className="py-3 px-4 font-semibold">Confidence</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Review State</th>
                <th className="py-3 px-4 font-semibold">Uploader</th>
                <th className="py-3 px-4 font-semibold text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <span>Loading inspection history...</span>
                  </td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No matching inspections found. Try adjusting your search filters.
                  </td>
                </tr>
              ) : (
                inspections.map((item) => (
                  <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-2 px-4">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-900 border border-white/10 shrink-0">
                        <img
                          src={item.imagePath}
                          alt={item.originalFilename}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-4 font-mono font-medium text-white">{item.inspectionId}</td>
                    <td className="py-2 px-4 text-slate-300 truncate max-w-[140px]" title={item.originalFilename}>
                      {item.originalFilename}
                    </td>
                    <td className="py-2 px-4 font-mono text-slate-300">{item.productId}</td>
                    <td className="py-2 px-4">
                      {item.predictedClass === 'Defective' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          Defective
                        </span>
                      ) : item.predictedClass === 'Normal' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Normal
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-2 px-4 font-mono tabular-nums text-slate-300">
                      {item.confidence !== undefined ? `${(item.confidence * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="py-2 px-4">
                      <span
                        className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.status === 'REJECTED'
                            ? 'bg-amber-500/10 text-amber-400'
                            : item.status === 'FAILED'
                            ? 'bg-rose-500/10 text-rose-400'
                            : 'bg-cyan-500/10 text-cyan-400'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2 px-4">
                      {item.latestReview ? (
                        <span
                          className={`text-[11px] font-semibold flex items-center gap-1 ${
                            item.latestReview.decision === 'CONFIRMED' ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          <FileCheck className="w-3.5 h-3.5" />
                          {item.latestReview.decision}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Unreviewed</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-slate-400 text-[11px]">{item.uploaderUsername}</td>
                    <td className="py-2 px-4 text-right">
                      <button
                        onClick={() => setActiveModalRecord(item)}
                        className="text-cyan-400 hover:text-cyan-300 font-medium text-xs cursor-pointer"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Inspection Modal */}
      {activeModalRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="glass-modal max-w-2xl w-full rounded-2xl border border-white/10 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
                  Inspection Specification
                </span>
                <h3 className="text-lg font-bold text-white font-mono">{activeModalRecord.inspectionId}</h3>
              </div>
              <button
                onClick={() => {
                  setActiveModalRecord(null);
                  if (onClearSelected) onClearSelected();
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="w-full">
                <DefectLocalizationViewer
                  originalImageUrl={activeModalRecord.imagePath}
                  annotatedImageUrl={activeModalRecord.annotatedImagePath || activeModalRecord.imagePath}
                  predictedClass={activeModalRecord.predictedClass || 'Normal'}
                  confidence={activeModalRecord.confidence || 0.95}
                  defectProbability={activeModalRecord.defectProbability}
                  localization={activeModalRecord.localization}
                  inspectionId={activeModalRecord.inspectionId}
                  productId={activeModalRecord.productId}
                  title={`Inspection Record: ${activeModalRecord.inspectionId}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="text-slate-400">Specimen Filename</div>
                  <div className="text-white font-mono font-medium truncate">
                    {activeModalRecord.originalFilename}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="text-slate-400">Registered Product</div>
                  <div className="text-white font-medium">{activeModalRecord.productId}</div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                  <div className="text-slate-400">Model Engine</div>
                  <div className="text-white font-mono">BIT-PLATE-CV-1.0</div>
                </div>
              </div>
            </div>

            {/* Predictions & Supervisor Decoupling Display */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                <div className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
                  Original AI Classification
                </div>
                <div className="text-base font-bold text-white">
                  {activeModalRecord.predictedClass ? (
                    <span
                      className={
                        activeModalRecord.predictedClass === 'Defective' ? 'text-rose-400' : 'text-emerald-400'
                      }
                    >
                      {activeModalRecord.predictedClass}
                    </span>
                  ) : (
                    'Not Available'
                  )}
                </div>
                <div className="text-[11px] text-slate-400">
                  Confidence: {activeModalRecord.confidence ? `${(activeModalRecord.confidence * 100).toFixed(1)}%` : '—'} ·
                  Defect Prob: {activeModalRecord.defectProbability ? `${(activeModalRecord.defectProbability * 100).toFixed(2)}%` : '—'}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2">
                <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider">
                  Supervisor Review
                </div>
                {activeModalRecord.latestReview ? (
                  <>
                    <div className="text-base font-bold text-white flex items-center gap-2">
                      <span
                        className={
                          activeModalRecord.latestReview.reviewedClass === 'Defective'
                            ? 'text-rose-400'
                            : 'text-emerald-400'
                        }
                      >
                        {activeModalRecord.latestReview.reviewedClass}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-mono bg-white/10">
                        {activeModalRecord.latestReview.decision}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 italic">
                      "{activeModalRecord.latestReview.comments}"
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Reviewed by {activeModalRecord.latestReview.reviewerUsername} on{' '}
                      {new Date(activeModalRecord.latestReview.createdAt).toLocaleDateString()}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-slate-400 py-2">
                    Record has not yet been audited by a Quality Supervisor.
                  </div>
                )}
              </div>
            </div>

            {/* SHA-256 and Traceability */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] space-y-1 font-mono">
              <div className="text-slate-400 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-500" />
                <span>SHA-256 Cryptographic Hash:</span>
              </div>
              <div className="text-slate-300 break-all">{activeModalRecord.imageSha256 || 'None computed'}</div>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-white/10">
              <span className="text-xs text-slate-500">
                Uploaded by {activeModalRecord.uploaderUsername} on{' '}
                {new Date(activeModalRecord.createdAt).toLocaleString()}
              </span>

              <div className="flex items-center gap-2">
                {user?.role === 'SUPERVISOR' && (
                  <button
                    onClick={() => {
                      setActiveModalRecord(null);
                      onNavigate('reviews');
                    }}
                    className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Open Review Workspace
                  </button>
                )}
                <button
                  onClick={() => setActiveModalRecord(null)}
                  className="glass-button-secondary px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
