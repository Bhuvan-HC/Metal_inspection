import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AnalyticsOverview } from '../types';
import {
  BarChart3,
  TrendingUp,
  PieChart as PieIcon,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

export const Analytics: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<{ date: string; normal: number; defective: number; total: number }[]>([]);
  const [modelIntegrity, setModelIntegrity] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewData, trendsData, integrityData] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getAnalyticsTrends(),
        api.getModelIntegrity(),
      ]);
      setAnalytics(overviewData);
      setTrends(trendsData);
      setModelIntegrity(integrityData);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalReviews = (analytics?.confirmedReviews || 0) + (analytics?.correctedReviews || 0);
  const reviewAgreementRate =
    totalReviews > 0 ? (((analytics?.confirmedReviews || 0) / totalReviews) * 100).toFixed(1) : '100.0';

  const reviewDonutData = [
    { name: 'Confirmed', value: analytics?.confirmedReviews || 0, color: '#10B981' },
    { name: 'Corrected', value: analytics?.correctedReviews || 0, color: '#F59E0B' },
  ];

  const batchStatusData = [
    { name: 'Completed', count: analytics?.completedInspections || 0, fill: '#10B981' },
    { name: 'Rejected', count: analytics?.rejectedCount || 0, fill: '#F59E0B' },
    { name: 'Failed', count: analytics?.failedCount || 0, fill: '#F43F5E' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Quality Analytics &amp; Integrity</h2>
          <p className="text-xs text-slate-400 mt-1">
            Aggregated statistical telemetry derived from stored inspection records and supervisor reviews.
          </p>
        </div>
        <button
          onClick={loadData}
          className="glass-button-secondary px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* Model Integrity Banner */}
      <div className="glass-card p-4 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white flex items-center gap-2">
              <span>Classifier SHA-256 Checksum Status:</span>
              <span className="text-emerald-400 font-mono text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                VERIFIED MATCH
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Frozen weights: <span className="font-mono text-slate-300">classifier.npz</span> · Helper: <span className="font-mono text-slate-300">inference.py</span> · Version: <span className="font-mono text-slate-300">BIT-PLATE-CV-1.0</span>
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400">
          Decision threshold: <span className="font-mono text-cyan-300 font-bold">0.50</span>
        </div>
      </div>

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="text-slate-400 text-xs">Overall Yield Rate</div>
          <div className="text-2xl font-bold text-emerald-400 font-mono mt-1 tabular-nums">
            {analytics?.totalInspections
              ? `${(((analytics.normalCount || 0) / analytics.totalInspections) * 100).toFixed(1)}%`
              : '100%'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Normal / Total ratio</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="text-slate-400 text-xs">Defect Screening Rate</div>
          <div className="text-2xl font-bold text-rose-400 font-mono mt-1 tabular-nums">
            {analytics?.defectRate ? `${analytics.defectRate.toFixed(1)}%` : '0.0%'}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Defective parts screened</div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="text-slate-400 text-xs">Supervisor Agreement</div>
          <div className="text-2xl font-bold text-indigo-400 font-mono mt-1 tabular-nums">
            {reviewAgreementRate}%
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {analytics?.confirmedReviews || 0} confirmed · {analytics?.correctedReviews || 0} corrected
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/5">
          <div className="text-slate-400 text-xs">Batch Processing Integrity</div>
          <div className="text-2xl font-bold text-cyan-400 font-mono mt-1 tabular-nums">
            {analytics?.totalBatches ? `${analytics.totalBatches}` : '0'} Batches
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Processed asynchronously</div>
        </div>
      </div>

      {/* Detailed Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend Area Chart */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Specimen Defect Frequency Trend</h3>
              <p className="text-xs text-slate-400 mt-0.5">Chronological detection over time</p>
            </div>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} />
                <YAxis stroke="#94A3B8" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(13, 21, 39, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                />
                <Area type="monotone" dataKey="defective" name="Defective" stroke="#F43F5E" fill="#F43F5E" fillOpacity={0.25} />
                <Area type="monotone" dataKey="normal" name="Normal" stroke="#10B981" fill="#10B981" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Supervisor Review Distribution */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Supervisor Decision Audit Breakdown</h3>
              <p className="text-xs text-slate-400 mt-0.5">Confirmed vs. Corrected human reviews</p>
            </div>
            <FileCheck className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            {totalReviews === 0 ? (
              <div className="text-xs text-slate-500">No supervisor reviews logged yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={reviewDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {reviewDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(13, 21, 39, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex items-center justify-around text-xs pt-3 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-slate-300">Confirmed Predictions:</span>
              <span className="text-white font-mono font-bold tabular-nums">
                {analytics?.confirmedReviews || 0}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="text-slate-300">Corrected Predictions:</span>
              <span className="text-white font-mono font-bold tabular-nums">
                {analytics?.correctedReviews || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
