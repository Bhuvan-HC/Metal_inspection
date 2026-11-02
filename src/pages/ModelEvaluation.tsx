import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { EvaluationMetrics } from '../types';
import {
  Cpu,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Table,
  Info,
  Layers,
  Sparkles,
} from 'lucide-react';

export const ModelEvaluation: React.FC = () => {
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [filterMismatchOnly, setFilterMismatchOnly] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await api.getEvaluationResults();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load evaluation metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const runEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const data = await api.runEvaluation();
      setMetrics(data);
    } catch (err) {
      console.error('Failed to run evaluation:', err);
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const sampleItems = metrics?.sampleItems || [];
  const filteredSamples = filterMismatchOnly
    ? sampleItems.filter((s) => !s.isCorrect)
    : sampleItems;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Model Evaluation &amp; Ground Truth Benchmarks</h2>
          <p className="text-xs text-slate-400 mt-1">
            Official benchmark against all 60 ground-truth procedural samples (30 Normal, 30 Defective). Excludes intentional validation inputs.
          </p>
        </div>

        <button
          onClick={runEvaluation}
          disabled={isEvaluating}
          className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isEvaluating ? 'animate-spin text-white' : ''}`} />
          <span>{isEvaluating ? 'Evaluating 60 Samples...' : 'Re-Run Model Evaluation'}</span>
        </button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400">Computing 60-sample confusion matrix...</p>
        </div>
      ) : metrics ? (
        <>
          {/* Key Evaluation Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card p-4 rounded-xl border border-white/5">
              <div className="text-slate-400 text-xs font-medium">Defect Recall</div>
              <div className="text-2xl font-bold text-rose-400 font-mono mt-1 tabular-nums">
                {(metrics.defectRecall * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">TP / (TP + FN) · Sensitivity</div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-white/5">
              <div className="text-slate-400 text-xs font-medium">Precision</div>
              <div className="text-2xl font-bold text-cyan-400 font-mono mt-1 tabular-nums">
                {(metrics.precision * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">TP / (TP + FP) · Reliability</div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-white/5">
              <div className="text-slate-400 text-xs font-medium">F1-Score</div>
              <div className="text-2xl font-bold text-indigo-400 font-mono mt-1 tabular-nums">
                {metrics.f1Score.toFixed(3)}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Harmonic mean of precision &amp; recall</div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-white/5">
              <div className="text-slate-400 text-xs font-medium">Overall Accuracy</div>
              <div className="text-2xl font-bold text-emerald-400 font-mono mt-1 tabular-nums">
                {(metrics.accuracy * 100).toFixed(1)}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {metrics.truePositives + metrics.trueNegatives} / {metrics.totalEvaluated} correctly classified
              </div>
            </div>
          </div>

          {/* Confusion Matrix & Technical Explanation */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Confusion Matrix (6 Cols) */}
            <div className="lg:col-span-6 glass-card p-5 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">2×2 Confusion Matrix</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Evaluated across {metrics.totalEvaluated} eligible ground-truth samples
                  </p>
                </div>
                <Table className="w-4 h-4 text-cyan-400" />
              </div>

              {/* Matrix Table */}
              <div className="border border-white/10 rounded-xl overflow-hidden bg-slate-900/40 text-xs">
                <div className="grid grid-cols-3 bg-white/[0.04] text-center font-semibold text-slate-300 py-2 border-b border-white/10">
                  <div className="text-left pl-3 text-slate-500 font-normal">Ground Truth \ Predicted</div>
                  <div className="text-emerald-400">Predicted Normal</div>
                  <div className="text-rose-400">Predicted Defective</div>
                </div>

                {/* Row 1: Actual Normal */}
                <div className="grid grid-cols-3 text-center py-4 border-b border-white/5 items-center">
                  <div className="text-left pl-3 font-semibold text-slate-300">Actual Normal (30)</div>
                  <div>
                    <div className="text-lg font-bold font-mono text-emerald-400 tabular-nums">
                      {metrics.trueNegatives}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase">True Negative (TN)</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold font-mono text-amber-400 tabular-nums">
                      {metrics.falsePositives}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase">False Positive (FP)</div>
                  </div>
                </div>

                {/* Row 2: Actual Defective */}
                <div className="grid grid-cols-3 text-center py-4 items-center">
                  <div className="text-left pl-3 font-semibold text-slate-300">Actual Defective (30)</div>
                  <div>
                    <div className="text-lg font-bold font-mono text-amber-400 tabular-nums">
                      {metrics.falseNegatives}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase">False Negative (FN)</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold font-mono text-rose-400 tabular-nums">
                      {metrics.truePositives}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase">True Positive (TP)</div>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 font-mono">
                <span>Positive Class: Defective</span>
                <span>Decision Rule: Probability ≥ 0.50</span>
              </div>
            </div>

            {/* Scientific Explanation & Limitations (6 Cols) */}
            <div className="lg:col-span-6 glass-card p-5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-semibold text-white">Model Scope &amp; Industrial Validity</h3>
                </div>
                <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200/90 leading-relaxed mb-3">
                  {metrics.modelLimitationsNote}
                </div>

                <div className="space-y-2 text-xs text-slate-400">
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-start gap-2">
                    <span className="font-semibold text-slate-300 min-w-[130px]">Architecture:</span>
                    <span className="text-slate-400 font-mono">17-dimensional image features + Logistic Regression</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-start gap-2">
                    <span className="font-semibold text-slate-300 min-w-[130px]">Fixed Framing:</span>
                    <span className="text-slate-400">Strictly centered plate against dark border, cropped [16:112, 16:112]</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5 flex items-start gap-2">
                    <span className="font-semibold text-slate-300 min-w-[130px]">Validation Files:</span>
                    <span className="text-slate-400 font-mono">Excluded intentionally invalid corrupt/small inputs</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 text-[11px] text-slate-500 flex items-center justify-between">
                <span>Evaluated Set: 60 Samples</span>
                <span>Seed Range: 90000–90059</span>
              </div>
            </div>
          </div>

          {/* Sample Breakdown Grid */}
          <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
            <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">60 Ground-Truth Sample Breakdown</h3>
                <p className="text-xs text-slate-400">Individual prediction verification against labels.csv</p>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterMismatchOnly}
                  onChange={(e) => setFilterMismatchOnly(e.target.checked)}
                  className="rounded"
                />
                <span>Show Mismatches Only ({sampleItems.filter((s) => !s.isCorrect).length})</span>
              </label>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-900 border-b border-white/10 text-slate-400">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Image ID</th>
                    <th className="py-2.5 px-4 font-semibold">Specimen</th>
                    <th className="py-2.5 px-4 font-semibold">Actual Ground Truth</th>
                    <th className="py-2.5 px-4 font-semibold">AI Predicted Class</th>
                    <th className="py-2.5 px-4 font-semibold">Confidence</th>
                    <th className="py-2.5 px-4 font-semibold">Defect Prob</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-mono">
                  {filteredSamples.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-500 text-xs font-sans">
                        No mismatches found! All samples matched ground truth.
                      </td>
                    </tr>
                  ) : (
                    filteredSamples.map((item) => (
                      <tr key={item.imageId} className="hover:bg-white/[0.01]">
                        <td className="py-2 px-4 text-white font-medium">{item.imageId}</td>
                        <td className="py-2 px-4 text-slate-300 font-sans">{item.filename}</td>
                        <td className="py-2 px-4">
                          <span
                            className={`font-semibold ${
                              item.actualLabel === 'Defective' ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {item.actualLabel}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <span
                            className={`font-semibold ${
                              item.predictedClass === 'Defective' ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {item.predictedClass}
                          </span>
                        </td>
                        <td className="py-2 px-4 tabular-nums text-slate-300">
                          {(item.confidence * 100).toFixed(1)}%
                        </td>
                        <td className="py-2 px-4 tabular-nums text-slate-300">
                          {(item.defectProbability * 100).toFixed(2)}%
                        </td>
                        <td className="py-2 px-4 text-right">
                          {item.isCorrect ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold font-sans">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Match
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-semibold font-sans">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Mismatch
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
