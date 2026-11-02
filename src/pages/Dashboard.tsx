import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { AnalyticsOverview, Inspection } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileCheck,
  TrendingUp,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  Camera,
  Upload,
  Package,
  Cpu,
  History,
  FileCheck2,
  Info,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';

interface DashboardProps {
  onNavigate: (view: any) => void;
  onSelectInspection?: (id: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectInspection }) => {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [trends, setTrends] = useState<{ date: string; normal: number; defective: number; total: number }[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Review modal state for supervisor
  const [reviewingInspection, setReviewingInspection] = useState<Inspection | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'CONFIRMED' | 'CORRECTED'>('CONFIRMED');
  const [reviewedClass, setReviewedClass] = useState<'Normal' | 'Defective'>('Normal');
  const [reviewComments, setReviewComments] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const loadDashboardData = async () => {
    setIsRefreshing(true);
    try {
      const [overviewData, trendsData, inspectionsData, productsData] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getAnalyticsTrends(),
        api.getInspections(),
        api.getProducts(),
      ]);
      setAnalytics(overviewData);
      setTrends(trendsData);
      setInspections(inspectionsData);
      setProducts(productsData);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingInspection) return;
    setSubmittingReview(true);
    try {
      await api.submitReview(reviewingInspection.inspectionId, {
        decision: reviewDecision,
        reviewedClass,
        comments: reviewComments,
      });
      setReviewingInspection(null);
      setReviewComments('');
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to submit review:', err);
    } finally {
      setSubmittingReview(false);
    }
  };

  const donutColors = ['#10B981', '#F43F5E'];
  const donutData = analytics
    ? [
        { name: 'Normal', value: analytics.normalCount },
        { name: 'Defective', value: analytics.defectiveCount },
      ]
    : [];

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">Loading role dashboard telemetry...</p>
      </div>
    );
  }

  // =========================================================================
  // ROLE A: ADMINISTRATOR DASHBOARD
  // Purpose: Product management.
  // =========================================================================
  if (user?.role === 'ADMIN') {
    return (
      <div className="space-y-6">
        {/* Administrator Header */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                System Administration
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 font-mono">Product Management Console</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Administrator Dashboard</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Manage registered manufactured component specifications, inspect model bindings, and monitor system-wide compliance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadDashboardData}
              disabled={isRefreshing}
              className="glass-button-secondary px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-purple-400' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => onNavigate('products')}
              className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer bg-purple-600 hover:bg-purple-500 shadow-purple-500/20"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Manage Products</span>
            </button>
          </div>
        </div>

        {/* Administrator KPI Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Registered Products</span>
              <Package className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{products.length}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Active inspection pipelines</div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Target Component</span>
              <Cpu className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-xl font-bold text-cyan-300 font-mono">P-PLATE01</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Demonstration metal plate</div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Active Classifier</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-sm font-bold text-emerald-300 font-mono">BIT-PLATE-CV-1.0</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Decision threshold: 0.50</div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Factory Inspections Logged</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono">{analytics?.totalInspections || 0}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">All engineers combined</div>
          </div>
        </div>

        {/* Product Management Section */}
        <div className="glass-card rounded-2xl border border-white/5 p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-400" />
                <span>Product Management Section</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Registered components and optical quality inspection specifications.
              </p>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="text-xs font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Full Registry</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Registered Product Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
            {products.map((p) => (
              <div key={p.id || p.productId} className="glass-card p-5 rounded-xl border border-white/10 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{p.name}</h4>
                      <div className="text-xs font-mono text-purple-300 font-semibold">{p.productId}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    Active
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{p.description}</p>

                <div className="pt-3 border-t border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Product Identification:</span>
                    <span className="font-mono text-slate-200">{p.productId}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Supplied AI Classifier:</span>
                    <span className="font-mono text-cyan-300">BIT-PLATE-CV-1.0</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Classification Categories:</span>
                    <span className="font-medium text-slate-200">Normal · Defective</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Specimen Standardization:</span>
                    <span className="font-mono text-slate-200">128×128 grayscale / 17 features</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Product Identification Information Box */}
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2 mt-4 text-xs text-slate-400">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <Info className="w-4 h-4 text-purple-400" />
              <span>Product Identification &amp; Presence Standards</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Components identified as <strong>P-PLATE01</strong> feature a central metallic plate region (coordinates [16:112, 16:112] in normalized space) surrounded by an optical dark background. The live camera inspection station uses automatic presence verification prior to running the supplied classification model.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ROLE B: ENGINEER DASHBOARD
  // Purpose: Inspect product images and view personal inspection history.
  // =========================================================================
  if (user?.role === 'ENGINEER') {
    const engineerRecent = inspections.slice(0, 6);

    return (
      <div className="space-y-6">
        {/* Engineer Overview Header */}
        <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                Quality Inspection Station
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-xs text-slate-400 font-mono">Engineer: {user.username}</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">Engineer Dashboard</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Inspect product components via image upload or live laptop camera, and review your personal inspection records.
            </p>
          </div>

          <button
            onClick={loadDashboardData}
            disabled={isRefreshing}
            className="glass-button-secondary px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Engineer KPI Metrics (Personal Only) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">My Inspections</span>
              <Layers className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {analytics?.totalInspections || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Submitted by you</div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">My Normal Plates</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
              {analytics?.normalCount || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Verified defect-free</div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">My Defective Plates</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums">
              {analytics?.defectiveCount || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {analytics?.defectRate ? `${analytics.defectRate.toFixed(1)}% defect rate` : '0.0% defect rate'}
            </div>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/5">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Yield Pass Rate</span>
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-300 font-mono tabular-nums">
              {analytics?.totalInspections
                ? `${(((analytics?.normalCount || 0) / analytics.totalInspections) * 100).toFixed(1)}%`
                : '100%'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Component P-PLATE01</div>
          </div>
        </div>

        {/* Primary Action Option Cards: Upload Image & Live Camera Detection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Option 1: Upload Image */}
          <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col justify-between hover:border-cyan-500/40 transition-all group">
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Upload Image Inspection</h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Upload high-resolution PNG or JPEG specimen images for instant AI defect classification using the BIT-PLATE-CV-1.0 classifier.
                </p>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-400">Supported: 64×64 to 4096×4096</span>
              <button
                onClick={() => onNavigate('single-inspection')}
                className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20"
              >
                <span>Upload Image</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Option 2: Live Camera Detection */}
          <div className="glass-card p-6 rounded-2xl border border-cyan-500/30 bg-cyan-950/20 flex flex-col justify-between hover:border-cyan-400 transition-all group relative overflow-hidden">
            <div className="absolute top-3 right-3">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                Live Feed
              </span>
            </div>

            <div className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 group-hover:scale-105 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Metal Plate Detection</h3>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  Real-time metal plate defect detection and localization through your laptop webcam. Accurately verifies metal plate presence and highlights defective areas.
                </p>
              </div>
            </div>

            <div className="pt-5 mt-4 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] font-mono text-cyan-400">Target: P-PLATE01</span>
              <button
                onClick={() => onNavigate('camera-inspection')}
                className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Open Metal Plate Detection</span>
              </button>
            </div>
          </div>
        </div>

        {/* My Inspection History Section */}
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <span>Metal Plate Inspection History</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Recent inspection results uploaded by you ({user.username}). Personal records only.
              </p>
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <span>View Full History</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-white/[0.02] text-slate-400 border-b border-white/5">
                  <th className="py-3 px-4 font-semibold">Image</th>
                  <th className="py-3 px-4 font-semibold">Inspection ID</th>
                  <th className="py-3 px-4 font-semibold">Product</th>
                  <th className="py-3 px-4 font-semibold">AI Prediction</th>
                  <th className="py-3 px-4 font-semibold">Prediction Confidence</th>
                  <th className="py-3 px-4 font-semibold">Inspection Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {engineerRecent.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                      No inspections found in your history yet. Start by uploading an image or using the live camera!
                    </td>
                  </tr>
                ) : (
                  engineerRecent.map((item) => (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 px-4">
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
                      <td className="py-2.5 px-4 font-mono font-medium text-white">{item.inspectionId}</td>
                      <td className="py-2.5 px-4 text-slate-300 font-mono">{item.productId}</td>
                      <td className="py-2.5 px-4">
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
                      <td className="py-2.5 px-4 font-mono tabular-nums text-slate-200 font-semibold">
                        {item.confidence !== undefined ? `${(item.confidence * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td className="py-2.5 px-4">
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
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => {
                            if (onSelectInspection) onSelectInspection(item.inspectionId);
                            else onNavigate('history');
                          }}
                          className="text-cyan-400 hover:text-cyan-300 font-medium text-xs cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ROLE C: SUPERVISOR DASHBOARD
  // Purpose: View all inspections and review results.
  // =========================================================================
  return (
    <div className="space-y-6">
      {/* Supervisor Header */}
      <div className="glass-panel p-6 rounded-2xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Quality Assurance Center
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-xs text-slate-400 font-mono">Supervisor Review Authority</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Supervisor Dashboard</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Audit plant-wide inspections across all engineers, confirm or correct AI model predictions, and maintain quality integrity.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadDashboardData}
            disabled={isRefreshing}
            className="glass-button-secondary px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => onNavigate('reviews')}
            className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Review Center</span>
          </button>
        </div>
      </div>

      {/* Supervisor KPI Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Inspections */}
        <div className="glass-card p-4 rounded-xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Inspections</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white font-mono tabular-nums">
              {analytics?.totalInspections || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Across all engineers ({analytics?.completedInspections || 0} completed)
            </div>
          </div>
        </div>

        {/* Normal Inspections */}
        <div className="glass-card p-4 rounded-xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Normal Count</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400 font-mono tabular-nums">
              {analytics?.normalCount || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {analytics?.totalInspections
                ? `${(((analytics?.normalCount || 0) / analytics.totalInspections) * 100).toFixed(1)}% yield rate`
                : 'No data'}
            </div>
          </div>
        </div>

        {/* Defective Inspections */}
        <div className="glass-card p-4 rounded-xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Defective Count</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-rose-400 font-mono tabular-nums">
              {analytics?.defectiveCount || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {analytics?.defectRate ? `${analytics.defectRate.toFixed(1)}% defect rate` : '0.0%'}
            </div>
          </div>
        </div>

        {/* Pending Reviews */}
        <div className="glass-card p-4 rounded-xl border border-white/5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Pending Reviews</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-400 font-mono tabular-nums">
              {analytics?.pendingReviews || 0}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Awaiting supervisor audit</div>
          </div>
        </div>

        {/* Supervisor Decided */}
        <div className="glass-card p-4 rounded-xl border border-white/5 flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Reviewed Items</span>
            <FileCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-400 font-mono tabular-nums">
              {(analytics?.confirmedReviews || 0) + (analytics?.correctedReviews || 0)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {analytics?.confirmedReviews || 0} confirmed · {analytics?.correctedReviews || 0} corrected
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Area Chart (2 Columns) */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Inspection Activity Trends</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Normal vs. Defective units over time</p>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">P-PLATE01 Batches</span>
          </div>

          <div className="h-56 w-full">
            {trends.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No activity trend records logged yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNormal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorDefective" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(13, 21, 39, 0.95)',
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="normal"
                    name="Normal"
                    stroke="#10B981"
                    fillOpacity={1}
                    fill="url(#colorNormal)"
                  />
                  <Area
                    type="monotone"
                    dataKey="defective"
                    name="Defective"
                    stroke="#F43F5E"
                    fillOpacity={1}
                    fill="url(#colorDefective)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Classification Distribution Donut Chart */}
        <div className="glass-card p-5 rounded-2xl border border-white/5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-white">Classification Ratio</h3>
              <p className="text-xs text-slate-400 mt-0.5">Threshold: 0.50</p>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>

          <div className="h-40 w-full relative flex items-center justify-center">
            {donutData.every((d) => d.value === 0) ? (
              <div className="text-xs text-slate-500">No predictions recorded</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {donutData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={donutColors[index % donutColors.length]} />
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

          <div className="flex items-center justify-around text-xs mt-auto pt-3 border-t border-white/5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-slate-300 font-medium">Normal:</span>
              <span className="text-white font-mono font-bold tabular-nums">{analytics?.normalCount || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span className="text-slate-300 font-medium">Defective:</span>
              <span className="text-white font-mono font-bold tabular-nums">{analytics?.defectiveCount || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* All Inspection Records Section (Across All Engineers) */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>All Inspection Records &amp; Supervisor Review</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comprehensive inspection log from all engineers with separate AI prediction and supervisor review tracking.
            </p>
          </div>
          <button
            onClick={() => onNavigate('reviews')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <span>Open Review Center</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-white/[0.02] text-slate-400 border-b border-white/5">
                <th className="py-3 px-4 font-semibold">Image</th>
                <th className="py-3 px-4 font-semibold">Inspection ID</th>
                <th className="py-3 px-4 font-semibold">Engineer</th>
                <th className="py-3 px-4 font-semibold">Original AI Prediction</th>
                <th className="py-3 px-4 font-semibold">AI Confidence</th>
                <th className="py-3 px-4 font-semibold">Inspection Status</th>
                <th className="py-3 px-4 font-semibold">Supervisor Final Review</th>
                <th className="py-3 px-4 font-semibold text-right">Review Controls</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {inspections.slice(0, 10).map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-2.5 px-4">
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
                  <td className="py-2.5 px-4 font-mono font-medium text-white">{item.inspectionId}</td>
                  <td className="py-2.5 px-4 text-slate-300 font-medium">{item.uploaderUsername}</td>
                  
                  {/* Separate display of original AI prediction */}
                  <td className="py-2.5 px-4">
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

                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-300">
                    {item.confidence !== undefined ? `${(item.confidence * 100).toFixed(1)}%` : '—'}
                  </td>

                  <td className="py-2.5 px-4">
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

                  {/* Separate display of supervisor final review */}
                  <td className="py-2.5 px-4">
                    {item.latestReview ? (
                      <div className="space-y-0.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.latestReview.decision === 'CONFIRMED'
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          <FileCheck className="w-3 h-3" />
                          <span>{item.latestReview.decision}: {item.latestReview.reviewedClass}</span>
                        </span>
                        <div className="text-[10px] text-slate-400">
                          by {item.latestReview.reviewerUsername}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-[11px] italic">Pending Review</span>
                    )}
                  </td>

                  {/* Review controls */}
                  <td className="py-2.5 px-4 text-right">
                    <button
                      onClick={() => {
                        setReviewingInspection(item);
                        setReviewedClass(item.predictedClass || 'Normal');
                        setReviewDecision('CONFIRMED');
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition-all cursor-pointer"
                    >
                      {item.latestReview ? 'Re-Review' : 'Review'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisor Review Modal */}
      {reviewingInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-modal max-w-lg w-full p-6 rounded-2xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-indigo-400" />
                <span>Review Inspection Record</span>
              </h3>
              <span className="font-mono text-xs text-cyan-300">{reviewingInspection.inspectionId}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="aspect-square rounded-xl overflow-hidden bg-slate-950 border border-white/10">
                <img
                  src={reviewingInspection.imagePath}
                  alt="Specimen"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className="text-slate-400 text-[10px]">Original AI Prediction</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {reviewingInspection.predictedClass || 'Uncertain'}
                  </div>
                  <div className="text-[11px] text-cyan-400 font-mono mt-0.5">
                    Confidence: {reviewingInspection.confidence ? `${(reviewingInspection.confidence * 100).toFixed(1)}%` : '—'}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                  <div className="text-slate-400 text-[10px]">Inspected By</div>
                  <div className="text-xs font-semibold text-slate-200 mt-0.5">
                    {reviewingInspection.uploaderUsername}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Product: {reviewingInspection.productId}
                  </div>
                </div>
              </div>
            </div>

            <form onSubmit={handleReviewSubmit} className="space-y-3 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Supervisor Audit Decision</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setReviewDecision('CONFIRMED');
                      setReviewedClass(reviewingInspection.predictedClass || 'Normal');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      reviewDecision === 'CONFIRMED'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-white/5 text-slate-400 border-white/10'
                    }`}
                  >
                    Confirm Prediction
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewDecision('CORRECTED');
                      setReviewedClass(reviewingInspection.predictedClass === 'Defective' ? 'Normal' : 'Defective');
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      reviewDecision === 'CORRECTED'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-white/5 text-slate-400 border-white/10'
                    }`}
                  >
                    Correct Prediction
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Supervisor Final Classification</label>
                <select
                  value={reviewedClass}
                  onChange={(e) => setReviewedClass(e.target.value as 'Normal' | 'Defective')}
                  className="glass-input w-full px-3 py-2 rounded-xl text-xs"
                >
                  <option value="Normal">Normal (Defect-Free)</option>
                  <option value="Defective">Defective (Defect Identified)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Audit Notes / Comments</label>
                <textarea
                  value={reviewComments}
                  onChange={(e) => setReviewComments(e.target.value)}
                  placeholder="e.g. Confirmed hairline scratch or verified normal specular reflection"
                  rows={2}
                  className="glass-input w-full px-3 py-2 rounded-xl text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setReviewingInspection(null)}
                  className="glass-button-secondary px-4 py-2 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  className="glass-button-primary px-5 py-2 rounded-xl text-xs font-semibold cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  {submittingReview ? 'Saving Audit...' : 'Submit Supervisor Review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
