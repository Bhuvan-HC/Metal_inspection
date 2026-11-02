import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  ScanEye,
  Layers,
  History,
  FileCheck2,
  BarChart3,
  Cpu,
  Package,
  ScrollText,
  LogOut,
  ShieldAlert,
  Menu,
  X,
  CheckCircle2,
  Camera,
} from 'lucide-react';

export type NavView =
  | 'dashboard'
  | 'single-inspection'
  | 'camera-inspection'
  | 'batch-inspection'
  | 'history'
  | 'reviews'
  | 'analytics'
  | 'evaluation'
  | 'products'
  | 'audit';

interface AppLayoutProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentView, onNavigate, children }) => {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isSupervisorOrAdmin = user?.role === 'SUPERVISOR' || user?.role === 'ADMIN';

  // Role-specific sidebar navigation as mandated by requirements
  let navItems: { id: NavView; label: string; icon: any; badge?: string }[] = [];

  if (user?.role === 'ADMIN') {
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'products', label: 'Products', icon: Package },
      { id: 'audit', label: 'Audit Trail', icon: ScrollText },
    ];
  } else if (user?.role === 'ENGINEER') {
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'single-inspection', label: 'Image Inspection', icon: ScanEye },
      { id: 'camera-inspection', label: 'Metal Plate Detection', icon: Camera, badge: 'Live' },
      { id: 'batch-inspection', label: 'Batch Inspection (≤20)', icon: Layers },
      { id: 'history', label: 'Metal Plate Inspection History', icon: History },
    ];
  } else {
    // SUPERVISOR
    navItems = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'history', label: 'Metal Plate Inspection History', icon: History },
      { id: 'reviews', label: 'Review Results', icon: FileCheck2 },
      { id: 'batch-inspection', label: 'Batch Inspection Runs', icon: Layers },
      { id: 'analytics', label: 'Quality Analytics', icon: BarChart3 },
      { id: 'evaluation', label: 'Model Evaluation', icon: Cpu },
    ];
  }

  const handleNavClick = (viewId: NavView, restricted?: boolean) => {
    onNavigate(viewId);
    setMobileMenuOpen(false);
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'SUPERVISOR':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      case 'ENGINEER':
      default:
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-[#080D1A] text-slate-100 flex relative overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="fixed -top-40 -left-40 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed -bottom-40 -right-40 w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 glass-panel border-r border-white/5 shrink-0 z-20 sticky top-0 h-screen">
        {/* Brand */}
        <div className="p-5 border-b border-white/5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <ScanEye className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>InspectAI</span>
            </div>
            <div className="text-[11px] text-slate-400">Quality Intelligence Platform</div>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold uppercase tracking-wider">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Model status indicator */}
        <div className="p-3 mx-3 mb-3 rounded-xl bg-white/[0.03] border border-white/5">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
            <span className="font-semibold text-slate-300">Model Engine</span>
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              Verified
            </span>
          </div>
          <div className="text-xs text-white font-mono font-medium">BIT-PLATE-CV-1.0</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Product: P-PLATE01 · Threshold: 0.5</div>
        </div>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center font-bold text-xs text-slate-200 shrink-0">
              {user?.username.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{user?.username}</div>
              <div
                className={`inline-block text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider border ${getRoleBadgeColor(
                  user?.role
                )}`}
              >
                {user?.role}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        {/* Top Header */}
        <header className="h-16 glass-panel border-b border-white/5 px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>InspectAI</span>
                <span>/</span>
                <span className="text-slate-200 capitalize">{currentView.replace('-', ' ')}</span>
              </div>
              <h1 className="text-sm font-semibold text-white capitalize">
                {currentView === 'dashboard'
                  ? 'Quality Intelligence Center'
                  : currentView.replace('-', ' ')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="text-slate-400">Target Product:</span>
              <span className="font-semibold text-cyan-300">P-PLATE01</span>
            </div>

            <div
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold uppercase tracking-wider border flex items-center gap-1.5 ${getRoleBadgeColor(
                user?.role
              )}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
              <span>{user?.role}</span>
            </div>

            <button
              onClick={logout}
              className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden glass-modal border-b border-white/10 p-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                      : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Viewport Content */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
