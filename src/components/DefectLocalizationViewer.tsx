import React, { useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Eye,
  Columns,
  Layers,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { DefectLocalization, DefectRegion } from '../types';

interface DefectLocalizationViewerProps {
  originalImageUrl: string;
  annotatedImageUrl?: string;
  predictedClass: 'Normal' | 'Defective';
  confidence: number;
  defectProbability?: number;
  localization?: DefectLocalization;
  inspectionId?: string;
  productId?: string;
  title?: string;
}

export const DefectLocalizationViewer: React.FC<DefectLocalizationViewerProps> = ({
  originalImageUrl,
  annotatedImageUrl,
  predictedClass,
  confidence,
  defectProbability,
  localization,
  inspectionId,
  productId,
  title,
}) => {
  const [viewMode, setViewMode] = useState<'annotated' | 'original' | 'sideBySide'>('annotated');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [activeDefectIndex, setActiveDefectIndex] = useState<number | null>(null);

  const isDefective = predictedClass === 'Defective';
  const hasLocalization = isDefective && localization?.available && localization.regions.length > 0;
  const imageToDisplay = viewMode === 'original' ? originalImageUrl : (annotatedImageUrl || originalImageUrl);

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 25, 250));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 25, 75));
  const handleResetZoom = () => setZoomLevel(100);

  const handleDownload = () => {
    const url = annotatedImageUrl || originalImageUrl;
    const link = document.createElement('a');
    link.href = url;
    link.download = `${inspectionId || 'specimen'}_${isDefective ? 'annotated_defects' : 'normal'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
      {/* Header & View Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white tracking-wide">
            {title || 'Visual Defect Localization & Marking'}
          </h3>
          {productId && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-mono">
              {productId}
            </span>
          )}
        </div>

        {/* View Mode Toggle Buttons */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/80 border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('annotated')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'annotated'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
            title="View Defect Highlighted Image"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Defect Highlighted</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('original')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'original'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
            title="View Original Component Image"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Original Specimen</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('sideBySide')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'sideBySide'
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
            title="View Side-by-Side Comparison"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Side-by-Side</span>
          </button>
        </div>
      </div>

      {/* Main Image Display Area with Zoom Controls */}
      <div className="relative rounded-xl overflow-hidden bg-slate-950/90 border border-white/10 min-h-[300px] flex items-center justify-center p-4">
        {/* Floating Zoom Toolbar */}
        <div className="absolute top-3 right-3 z-20 flex items-center gap-1 p-1 rounded-lg bg-slate-900/90 border border-white/10 backdrop-blur-md shadow-lg">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoomLevel <= 75}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-mono font-medium text-slate-400 px-1.5">
            {zoomLevel}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoomLevel >= 250}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-white/10 cursor-pointer ml-1"
            title="Reset Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Status Badge in Viewer */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-2">
          {isDefective ? (
            <div className="px-2.5 py-1 rounded-md bg-rose-500/90 text-white text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-lg">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>DEFECTIVE ({(confidence * 100).toFixed(1)}%)</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-md bg-emerald-500/90 text-white text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>NORMAL ({(confidence * 100).toFixed(1)}%)</span>
            </div>
          )}

          {isDefective && hasLocalization && (
            <div className="px-2 py-0.5 rounded-md bg-slate-900/90 border border-rose-500/40 text-rose-300 text-[11px] font-medium backdrop-blur">
              {localization.regions.length} {localization.regions.length === 1 ? 'Region' : 'Regions'} Localized
            </div>
          )}
        </div>

        {/* Image Containers based on View Mode */}
        {viewMode === 'sideBySide' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {/* Left: Original */}
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Original Specimen
              </span>
              <div className="relative rounded-lg overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center p-2">
                <img
                  src={originalImageUrl}
                  alt="Original Component"
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center' }}
                  className="max-h-[280px] w-auto object-contain rounded transition-transform duration-150"
                />
              </div>
            </div>

            {/* Right: Annotated / Defect Marked */}
            <div className="flex flex-col items-center">
              <span className="text-[11px] font-semibold text-rose-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                <span>Defect Highlighted</span>
                {hasLocalization && <span className="text-[10px] text-rose-300 font-normal">({localization.regions.length} detected)</span>}
              </span>
              <div className="relative rounded-lg overflow-hidden border border-rose-500/30 bg-black/40 flex items-center justify-center p-2">
                <img
                  src={annotatedImageUrl || originalImageUrl}
                  alt="Annotated Component"
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center' }}
                  className="max-h-[280px] w-auto object-contain rounded transition-transform duration-150"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="relative flex items-center justify-center overflow-auto max-h-[380px] p-2">
            <div className="relative inline-block">
              <img
                src={imageToDisplay}
                alt={viewMode === 'annotated' ? 'Defect Marked Specimen' : 'Original Specimen'}
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center' }}
                className="max-h-[340px] w-auto object-contain rounded-lg transition-transform duration-150 border border-white/10 shadow-2xl"
              />

              {/* Dynamic Overlay Box Highlights when hovering on defect regions table */}
              {viewMode === 'annotated' && hasLocalization && (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center' }}
                >
                  {localization.regions.map((reg, idx) => {
                    const isSelected = activeDefectIndex === idx;
                    return (
                      <div
                        key={reg.label}
                        style={{
                          left: `${reg.coordinates.x}%`,
                          top: `${reg.coordinates.y}%`,
                          width: `${reg.coordinates.width}%`,
                          height: `${reg.coordinates.height}%`,
                        }}
                        className={`absolute border-2 transition-all ${
                          isSelected
                            ? 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.8)]'
                            : 'border-rose-500/40'
                        }`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Defect Localization Information & Region Breakdown */}
      {isDefective ? (
        hasLocalization ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-semibold text-rose-300">
                  Identified Defective Regions ({localization.regions.length})
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Red outline (2px) + translucent red mask overlay
              </span>
            </div>

            {/* Regions Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {localization.regions.map((reg: DefectRegion, index: number) => (
                <div
                  key={reg.label}
                  onMouseEnter={() => setActiveDefectIndex(index)}
                  onMouseLeave={() => setActiveDefectIndex(null)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer ${
                    activeDefectIndex === index
                      ? 'bg-rose-500/15 border-rose-400 shadow-md shadow-rose-500/10'
                      : 'bg-slate-900/60 border-white/5 hover:border-rose-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500 inline-block animate-pulse" />
                      {reg.label}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        reg.severity === 'High'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : reg.severity === 'Medium'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      }`}
                    >
                      {reg.severity} Severity
                    </span>
                  </div>

                  <div className="mt-2 text-[11px] font-mono text-slate-400 grid grid-cols-2 gap-x-2 gap-y-1">
                    <div>
                      <span className="text-slate-500">X:</span> {reg.coordinates.x}%
                    </div>
                    <div>
                      <span className="text-slate-500">Y:</span> {reg.coordinates.y}%
                    </div>
                    <div>
                      <span className="text-slate-500">Width:</span> {reg.coordinates.width}%
                    </div>
                    <div>
                      <span className="text-slate-500">Height:</span> {reg.coordinates.height}%
                    </div>
                  </div>

                  {reg.pixel_box && (
                    <div className="mt-1.5 text-[10px] text-slate-500 font-mono">
                      Box: [{reg.pixel_box.join(', ')}] px
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Exact Location Unavailable Warning (Per Contest Spec) */
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="text-xs font-bold text-amber-300">
                Defect Detected — Exact Location Unavailable
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                The classification model confirmed this specimen is Defective with{' '}
                <span className="font-semibold text-white">{(confidence * 100).toFixed(1)}%</span> confidence,
                but subtle surface anomalies could not be isolated into discrete bounding boxes.
                Per inspection protocol, no misleading or random bounding boxes are displayed.
              </p>
            </div>
          </div>
        )
      ) : (
        /* Normal Specimen Clean Banner */
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-300 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Normal Component — Surface Clean, No Defects Found</span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Confidence: {(confidence * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {/* Action Footer: Download Annotated Image */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/5">
        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>
            {isDefective
              ? 'Marked coordinates and annotated specimen preserved in traceability records.'
              : 'Specimen verified within manufacturing tolerance limits.'}
          </span>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          className="glass-button-primary px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto text-white shadow-lg shadow-cyan-500/15"
        >
          <Download className="w-4 h-4 text-cyan-300" />
          <span>Download {isDefective ? 'Annotated Defect Image' : 'Inspection Specimen'}</span>
        </button>
      </div>
    </div>
  );
};
